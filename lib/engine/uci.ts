// lib/engine/uci.ts — Promise-based UCI protocol wrapper for Stockfish WASM
//
// CONTRACT (from AGENTS.md rule 5 and plan §4):
//   • Only `go depth N` — NEVER `go movetime`, NEVER `go infinite` for classification.
//   • `Threads 1` per worker instance (parallelism is at pool level, not engine level).
//   • Deterministic: same FEN + same depth → same output, every time.
//   • Mate scores must never be coerced to centipawns.

import type { SearchInfo } from '../types';

/** The raw worker interface the UCI wrapper communicates through. */
export interface WorkerLike {
  postMessage(msg: string): void;
  onmessage: ((event: { data: string }) => void) | null;
}

/** Options for a single analysis request. */
export interface AnalyzeOptions {
  /** Depth to search. MUST be finite. Do not pass Infinity. */
  depth: number;
  /** Number of best lines to return (MultiPV). Default 1. */
  multiPv?: number;
  /** AbortSignal — sends `stop` and rejects the promise on abort. */
  signal?: AbortSignal;
  /** Called with each incremental UCI `info` line as it arrives. */
  onInfo?: (info: SearchInfo) => void;
}

/**
 * Parse a single UCI `info` output line into a `SearchInfo` object.
 * Returns `null` for lines that are not analysys info (e.g. `info string ...`).
 *
 * Pure function — no I/O, testable in isolation.
 */
export function parseInfoLine(line: string): SearchInfo | null {
  if (!line.startsWith('info ')) return null;
  // Skip info strings (not numeric data)
  if (line.includes(' string ')) return null;
  // Must have a depth token
  if (!line.includes(' depth ')) return null;

  const tokens = line.split(' ');
  const get = (key: string): string | undefined => {
    const idx = tokens.indexOf(key);
    return idx !== -1 ? tokens[idx + 1] : undefined;
  };
  const getNum = (key: string): number | undefined => {
    const val = get(key);
    return val !== undefined ? parseInt(val, 10) : undefined;
  };

  const depth = getNum('depth');
  if (depth === undefined || isNaN(depth)) return null;

  const multipv = getNum('multipv') ?? 1;
  const seldepth = getNum('seldepth');
  const nps = getNum('nps');
  const nodes = getNum('nodes');
  const time = getNum('time');

  // Score: either `score cp <n>` or `score mate <n>`
  let cp: number | null = null;
  let mate: number | null = null;
  const scoreIdx = tokens.indexOf('score');
  if (scoreIdx !== -1) {
    const scoreType = tokens[scoreIdx + 1];
    const scoreVal = parseInt(tokens[scoreIdx + 2] ?? '', 10);
    if (!isNaN(scoreVal)) {
      if (scoreType === 'cp') {
        cp = scoreVal;
      } else if (scoreType === 'mate') {
        mate = scoreVal;
      }
    }
  }

  // PV: everything after the `pv` token
  const pvIdx = tokens.indexOf('pv');
  const pv: string[] = pvIdx !== -1 ? tokens.slice(pvIdx + 1) : [];

  return {
    multipv,
    depth,
    ...(seldepth !== undefined && { seldepth }),
    cp,
    mate,
    pv,
    ...(nps !== undefined && { nps }),
    ...(nodes !== undefined && { nodes }),
    ...(time !== undefined && { time }),
  };
}

/**
 * Wraps a Stockfish Web Worker with a promise-based UCI API.
 *
 * Usage:
 *   const uci = new UciWrapper(worker);
 *   await uci.init();
 *   await uci.setOption('Threads', '1');
 *   const lines = await uci.analyze(fen, { depth: 12, multiPv: 2 });
 */
export class UciWrapper {
  private readonly worker: WorkerLike;
  /** Resolves when the engine has sent `readyok` after `isready`. */
  private readyPromise: Promise<void> | null = null;

  constructor(worker: WorkerLike) {
    this.worker = worker;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private send(cmd: string): void {
    this.worker.postMessage(cmd);
  }

  /**
   * Wait for a specific token to appear in the engine output.
   * Resolves with the full line containing the token.
   */
  private waitFor(token: string, timeoutMs = 10_000): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.worker.onmessage = null;
        reject(new Error(`UCI timeout waiting for "${token}"`));
      }, timeoutMs);

      const prev = this.worker.onmessage;
      this.worker.onmessage = (event) => {
        const line = event.data;
        if (line.includes(token)) {
          clearTimeout(timer);
          this.worker.onmessage = prev;
          resolve(line);
        } else {
          // Let previous handler see non-matching lines too
          prev?.({ data: line });
        }
      };
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Initialise the engine: send `uci`, wait for `uciok`, then `isready` / `readyok`.
   * Must be called once before any analysis.
   */
  async init(): Promise<void> {
    this.send('uci');
    await this.waitFor('uciok', 15_000);
    this.send('isready');
    await this.waitFor('readyok', 15_000);
  }

  /** Send a single `setoption` command. */
  async setOption(name: string, value: string): Promise<void> {
    this.send(`setoption name ${name} value ${value}`);
    // No ack expected for setoption — just a synchronous write.
  }

  /**
   * Ensure the engine is ready.
   * Sends `isready` and waits for `readyok`. Idempotent.
   */
  async ready(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    this.send('isready');
    this.readyPromise = this.waitFor('readyok').then(() => {
      this.readyPromise = null;
    });
    return this.readyPromise;
  }

  /**
   * Analyze a position.
   *
   * @param fen  The position in FEN notation.
   * @param opts Analysis options (depth, multiPv, signal, onInfo).
   * @returns    The last `SearchInfo` object for each multipv line (final depth).
   *
   * IMPORTANT: uses `go depth N` only — never `go movetime` or `go infinite`.
   */
  async analyze(fen: string, opts: AnalyzeOptions): Promise<SearchInfo[]> {
    const { depth, multiPv = 1, signal, onInfo } = opts;

    if (!Number.isFinite(depth) || depth < 1) {
      throw new Error(`UciWrapper.analyze: depth must be a positive finite integer, got ${depth}`);
    }

    // Position
    this.send('ucinewgame');
    this.send(`position fen ${fen}`);

    // MultiPV
    if (multiPv > 1) {
      this.send(`setoption name MultiPV value ${multiPv}`);
    } else {
      this.send('setoption name MultiPV value 1');
    }

    // Final results keyed by multipv rank
    const results = new Map<number, SearchInfo>();

    return new Promise<SearchInfo[]>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('AbortError', 'AbortError'));
        return;
      }

      const onAbort = (): void => {
        this.worker.onmessage = null;
        this.send('stop');
        reject(new DOMException('AbortError', 'AbortError'));
      };

      signal?.addEventListener('abort', onAbort, { once: true });

      this.worker.onmessage = (event) => {
        const line = (event.data as string).trim();

        if (line.startsWith('info ')) {
          const info = parseInfoLine(line);
          if (info) {
            results.set(info.multipv, info);
            onInfo?.(info);
          }
        } else if (line.startsWith('bestmove')) {
          signal?.removeEventListener('abort', onAbort);
          this.worker.onmessage = null;
          resolve(Array.from(results.values()).sort((a, b) => a.multipv - b.multipv));
        }
      };

      // ONLY `go depth N` — per AGENTS.md rule 5 and plan §3.9
      this.send(`go depth ${depth}`);
    });
  }

  /**
   * Send `stop` to halt an in-progress search immediately.
   * The engine will emit a `bestmove` shortly after.
   */
  stop(): void {
    this.send('stop');
  }

  /** Send `quit` to cleanly shut down the engine. */
  quit(): void {
    this.send('quit');
  }
}
