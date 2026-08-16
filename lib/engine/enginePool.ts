// lib/engine/enginePool.ts — Stockfish WASM worker pool (Phase 2)
//
// ARCHITECTURE (from AGENTS.md rule 1 and plan §4):
//   • Single-threaded Stockfish workers run in parallel over DIFFERENT positions.
//   • Never a single multi-threaded engine for the whole analysis — that's slower and
//     requires SharedArrayBuffer across the board.
//   • Multi-threaded build ("max strength") is OPTIONAL, behind capability detection.
//   • Pool size = min(hardwareConcurrency - 1, 8), floor 2.
//   • Per-worker mutex: one job at a time per worker. Round-robin job queue.
//   • AbortSignal → sends `stop` to the worker, drains bestmove, cleans up.
//   • Components MUST NOT touch workers directly. Only use EnginePool.
//   • The engine runs in the browser. Never in a serverless function.

import { UciWrapper } from './uci';
import { getCachedEvals, putCachedEvals, initEvalCache } from './evalCache';
import type { EvalResult, SearchInfo, EngineCapabilities } from '../types';

// ── Capability detection ──────────────────────────────────────────────────────

const ENGINE_VERSION = 'sf18.v4';

/** Probe whether WASM SIMD is supported via a tiny feature-detection module. */
async function detectSimd(): Promise<boolean> {
  try {
    // Minimal SIMD probe — same technique Lichess uses.
    // This WASM binary is a single instruction that uses SIMD; it throws if unsupported.
    const probe = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, // magic
      0x01, 0x00, 0x00, 0x00, // version
      0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b, // type section: () -> v128
      0x03, 0x02, 0x01, 0x00, // func section
      0x0a, 0x0a, 0x01, 0x08, 0x00, 0xfd, 0x0f, 0x00, 0x00, 0x00, 0x00, 0x0b, // code: v128.const
    ]);
    await WebAssembly.compile(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect engine capabilities and return the appropriate JS/WASM build URLs.
 * Called once during EnginePool construction.
 */
export async function detectCapabilities(): Promise<EngineCapabilities> {
  const isolated = typeof crossOriginIsolated !== 'undefined' ? crossOriginIsolated : false;
  const simd = await detectSimd();

  // Single-threaded workers across the EnginePool (poolSize workers, Threads 1 each).
  // This ensures robust portability without requiring auxiliary pthread scripts.
  const build: EngineCapabilities['build'] = 'single';
  const threads = 1;

  const label = simd
    ? 'SF18-lite · SIMD'
    : 'SF18-lite · single-thread';

  return {
    build,
    threads,
    simd,
    crossOriginIsolated: isolated,
    label,
    version: ENGINE_VERSION,
  };
}

// ── Worker wrapper ────────────────────────────────────────────────────────────

interface WorkerSlot {
  worker: Worker;
  uci: UciWrapper;
  busy: boolean;
}

/** Resolve the public URL for the engine script. */
function engineScriptUrl(build: EngineCapabilities['build']): string {
  const filename =
    build === 'mt' ? 'stockfish-18-lite-mt.v1.js' : 'stockfish-18-lite-single.v1.js';
  return `/engine/${filename}`;
}

/** Create and initialize a single Stockfish worker slot. */
async function createWorkerSlot(scriptUrl: string): Promise<WorkerSlot> {
  const worker = new Worker(scriptUrl);

  // Wire up the UCI bridge using the standard WorkerLike interface.
  const workerLike = {
    postMessage(msg: string) {
      worker.postMessage(msg);
    },
    onmessage: null as ((event: { data: string }) => void) | null,
  };
  worker.onmessage = (event: MessageEvent<string>) => {
    workerLike.onmessage?.({ data: event.data });
  };

  let errorHandler: ((err: unknown) => void) | null = null;
  const errorPromise = new Promise<never>((_, reject) => {
    errorHandler = (err: unknown) => {
      const msg = err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Worker failed to load';
      reject(new Error(`Stockfish worker error: ${msg}`));
    };
    if (typeof worker.addEventListener === 'function') {
      worker.addEventListener('error', errorHandler as EventListener);
    } else {
      worker.onerror = errorHandler;
    }
  });

  const uci = new UciWrapper(workerLike);

  try {
    // UCI handshake — send uci, wait for uciok, then isready/readyok.
    await Promise.race([uci.init(), errorPromise]);
  } finally {
    if (typeof worker.removeEventListener === 'function' && errorHandler) {
      worker.removeEventListener('error', errorHandler as EventListener);
    } else if (worker.onerror === errorHandler) {
      worker.onerror = null;
    }
  }

  // Always Threads 1 per worker (parallelism via pool, not per-engine threads)
  await uci.setOption('Threads', '1');
  // Fixed Hash size for determinism
  await uci.setOption('Hash', '16');

  return { worker, uci, busy: false };
}

// ── Job queue ─────────────────────────────────────────────────────────────────

interface QueuedJob {
  fen: string;
  depth: number;
  multiPv: number;
  signal: AbortSignal | undefined;
  onInfo: ((info: SearchInfo) => void) | undefined;
  resolve: (results: EvalResult[]) => void;
  reject: (err: unknown) => void;
}

// ── EnginePool ────────────────────────────────────────────────────────────────

export interface AnalyzeOptions {
  /** Depth to analyze. Must be finite. Never Infinity for classification. */
  depth: number;
  /** Number of top lines to return (MultiPV). Default 1. */
  multiPv?: number;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
  /** Live-update callback as info lines arrive. */
  onInfo?: (info: SearchInfo) => void;
}

/**
 * A pool of Stockfish Web Workers.
 *
 * Each worker handles one analysis job at a time (mutex enforced).
 * Jobs are queued and dispatched round-robin to the first free worker.
 * Results are cached in IndexedDB; a cache hit bypasses the engine.
 *
 * Usage:
 *   const pool = new EnginePool();
 *   await pool.ready();
 *   const lines = await pool.analyze(fen, { depth: 12, multiPv: 2 });
 */
export class EnginePool {
  private slots: WorkerSlot[] = [];
  private queue: QueuedJob[] = [];
  private caps: EngineCapabilities | null = null;
  private initPromise: Promise<void> | null = null;

  /** How many workers to create. */
  private readonly poolSize: number;

  constructor(poolSize?: number) {
    const hw = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 2) : 2;
    this.poolSize = poolSize ?? Math.min(Math.max(hw - 1, 2), 8);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  /**
   * Initialize the pool. Idempotent — safe to call multiple times.
   * Resolves when all workers are ready.
   */
  ready(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._init();
    return this.initPromise;
  }

  private async _init(): Promise<void> {
    await initEvalCache();
    this.caps = await detectCapabilities();
    const url = engineScriptUrl(this.caps.build);

    // Spin up all workers in parallel
    this.slots = await Promise.all(
      Array.from({ length: this.poolSize }, () => createWorkerSlot(url)),
    );
  }

  /** Detected engine capabilities. Available after `ready()`. */
  get capabilities(): EngineCapabilities | null {
    return this.caps;
  }

  /** Terminate all workers and clear the queue. */
  terminate(): void {
    for (const slot of this.slots) {
      try {
        slot.worker.terminate();
      } catch {
        // Ignore — worker may already be dead
      }
    }
    this.slots = [];

    for (const job of this.queue) {
      job.reject(new DOMException('AbortError', 'AbortError'));
    }
    this.queue = [];
    this.initPromise = null;
  }

  // ── Analysis ──────────────────────────────────────────────────────────────────

  /**
   * Analyze a position at the given depth and return the top N lines.
   *
   * The result is deterministic: same FEN + depth + multiPv + engine → same output.
   * A cache hit returns immediately from IndexedDB (< 1 ms typically).
   *
   * @throws DOMException('AbortError') if `opts.signal` is aborted.
   */
  async analyze(fen: string, opts: AnalyzeOptions): Promise<EvalResult[]> {
    await this.ready();

    const { depth, multiPv = 1, signal, onInfo } = opts;

    if (signal?.aborted) {
      throw new DOMException('AbortError', 'AbortError');
    }

    // Cache check
    const engine = this.caps?.version ?? ENGINE_VERSION;
    const cached = await getCachedEvals(fen, depth, multiPv, engine);
    if (cached) {
      // Replay cached info lines to the callback if requested
      if (onInfo) {
        for (const r of cached) {
          onInfo({
            multipv: r.multipv,
            depth: r.depth,
            cp: r.cp,
            mate: r.mate,
            pv: r.pv,
          });
        }
      }
      return cached;
    }

    // Queue the job
    return new Promise<EvalResult[]>((resolve, reject) => {
      const job: QueuedJob = { fen, depth, multiPv, signal, onInfo, resolve, reject };
      this.queue.push(job);
      this._drain();
    });
  }

  // ── Internal queue drain ─────────────────────────────────────────────────────

  private _drain(): void {
    for (const slot of this.slots) {
      if (slot.busy || this.queue.length === 0) continue;
      const job = this.queue.shift()!;
      this._runJob(slot, job);
    }
  }

  private async _runJob(slot: WorkerSlot, job: QueuedJob): Promise<void> {
    slot.busy = true;

    const { fen, depth, multiPv, signal, onInfo, resolve, reject } = job;

    if (signal?.aborted) {
      slot.busy = false;
      reject(new DOMException('AbortError', 'AbortError'));
      this._drain();
      return;
    }

    try {
      const isBlack = fen.split(' ')[1] === 'b';
      const infoLines = await slot.uci.analyze(fen, {
        depth,
        multiPv,
        signal,
        onInfo: onInfo
          ? (info) => {
              onInfo({
                ...info,
                cp: info.cp !== null ? (isBlack ? -info.cp : info.cp) : null,
                mate: info.mate !== null ? (isBlack ? -info.mate : info.mate) : null,
              });
            }
          : undefined,
      });

      const engine = this.caps?.version ?? ENGINE_VERSION;

      const results: EvalResult[] = infoLines.map((info) => ({
        multipv: info.multipv,
        fen,
        depth: info.depth,
        cp: info.cp !== null ? (isBlack ? -info.cp : info.cp) : null,
        mate: info.mate !== null ? (isBlack ? -info.mate : info.mate) : null,
        pv: info.pv,
        engine,
      }));

      // Persist to cache
      await putCachedEvals(results);

      resolve(results);
    } catch (err) {
      reject(err);
    } finally {
      slot.busy = false;
      this._drain();
    }
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

// Module-level singleton — exported for use from the store and EngineLines panel.
// Components MUST use this, not create their own EnginePool instances.
let _pool: EnginePool | null = null;

export function getEnginePool(): EnginePool {
  if (!_pool) {
    _pool = new EnginePool();
  }
  return _pool;
}

/** Terminate the singleton pool (e.g. when unmounting the app). */
export function terminateEnginePool(): void {
  _pool?.terminate();
  _pool = null;
}

export { clearEvalCache } from './evalCache';
