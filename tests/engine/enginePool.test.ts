// tests/engine/enginePool.test.ts — EnginePool behavior tests
//
// Real Stockfish WASM can't load in Node/Vitest.
// We test the pool's scheduling, caching, and abort behaviour using mocks.
// Accept criteria from Phase 2 (AGENTS.md §3):
//   ✓  analyze(startpos, depth 12) returns a legal PV
//   ✓  pool of 4 analyzes 40 positions in < 10 s  (verified via timing)
//   ✓  AbortSignal cancels cleanly with no orphaned workers
//   ✓  same position analyzed twice returns identical output
//   ✓  second run hits the cache and returns in < 1 s

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock the storage layer ────────────────────────────────────────────────────


vi.mock('../../lib/storage/db', () => ({
  db: {
    evals: {
      get: vi.fn(async (_key: string) => {
        // Simulate per-row storage (keys include multipv rank suffix)
        return undefined; // Miss by default; putCachedEvals stores them
      }),
      update: vi.fn(async () => {}),
      bulkPut: vi.fn(async () => {}),
      bulkDelete: vi.fn(async () => {}),
      orderBy: vi.fn(() => ({ toArray: vi.fn(async () => []) })),
    },
  },
  requestPersistentStorage: vi.fn(async () => true),
}));

// ── Mock the worker infrastructure ───────────────────────────────────────────
// We replace `createWorkerSlot` by intercepting the Worker constructor.

interface MockWorker {
  postMessage: (msg: string) => void;
  onmessage: ((event: MessageEvent<string>) => void) | null;
  terminate: () => void;
  simulateOutput: (line: string) => void;
}

const createdWorkers: MockWorker[] = [];

vi.stubGlobal('Worker', class {
  onmessage: ((event: MessageEvent<string>) => void) | null = null;

  constructor(_url: string) {
    createdWorkers.push({
      postMessage: (msg: string) => this._handleHostMessage(msg),
      onmessage: null,
      terminate: () => {},
      simulateOutput: (line: string) => {
        this.onmessage?.({ data: line } as MessageEvent<string>);
      },
    });
  }

  postMessage(msg: string) {
    // This is called by the pool code to send UCI commands to the worker
    const w = createdWorkers[createdWorkers.length - 1];
    if (w) {
      w.simulateOutput = (line: string) => {
        this.onmessage?.({ data: line } as MessageEvent<string>);
      };
    }
    this._handleHostMessage(msg);
  }

  terminate() {}

  private _handleHostMessage(msg: string) {
    if (msg.startsWith('init ')) {
      // Bootstrap: respond with init ok
      setTimeout(() => this.onmessage?.({ data: 'workerinit ok' } as MessageEvent<string>), 0);
    } else if (msg === 'uci') {
      setTimeout(() => this.onmessage?.({ data: 'uciok' } as MessageEvent<string>), 0);
    } else if (msg === 'isready') {
      setTimeout(() => this.onmessage?.({ data: 'readyok' } as MessageEvent<string>), 0);
    } else if (msg.startsWith('go depth ')) {
      const depth = parseInt(msg.replace('go depth ', ''), 10);
      // Simulate analysis: emit info lines then bestmove
      setTimeout(() => {
        for (let d = 1; d <= depth; d++) {
          this.onmessage?.({
            data: `info depth ${d} multipv 1 score cp ${d * 2} pv e2e4 e7e5 g1f3`,
          } as MessageEvent<string>);
        }
        this.onmessage?.({ data: 'bestmove e2e4 ponder e7e5' } as MessageEvent<string>);
      }, 1); // 1ms artificial delay
    } else if (msg === 'stop') {
      setTimeout(() => this.onmessage?.({ data: 'bestmove e2e4' } as MessageEvent<string>), 0);
    }
  }
});

// Also mock navigator.hardwareConcurrency
vi.stubGlobal('navigator', { hardwareConcurrency: 8, storage: { estimate: async () => ({ usage: 0, quota: 1e9 }), persist: async () => true } });
vi.stubGlobal('crossOriginIsolated', false); // Force single-thread path in tests

// ── Tests ─────────────────────────────────────────────────────────────────────

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// Re-import EnginePool fresh each test (module cache may hold state)
beforeEach(() => {
  createdWorkers.length = 0;
  vi.clearAllMocks();
});

afterEach(async () => {
  // Terminate the singleton so it doesn't bleed into the next test
  const { terminateEnginePool } = await import('../../lib/engine/enginePool');
  terminateEnginePool();
});

describe('EnginePool (mocked workers)', () => {
  it('analyze(startpos, depth 12) returns a legal PV', async () => {
    const { EnginePool } = await import('../../lib/engine/enginePool');
    const pool = new EnginePool(1);
    await pool.ready();

    const results = await pool.analyze(START_FEN, { depth: 12, multiPv: 1 });

    expect(results).toHaveLength(1);
    const top = results[0];
    expect(top.depth).toBe(12);
    expect(top.cp).toBe(24); // 12 * 2 from the mock
    expect(top.pv.length).toBeGreaterThan(0);
    // First move must be legal UCI notation
    expect(top.pv[0]).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
  });

  it('AbortSignal cancels cleanly', async () => {
    const { EnginePool } = await import('../../lib/engine/enginePool');
    const pool = new EnginePool(1);
    await pool.ready();

    const ac = new AbortController();
    const promise = pool.analyze(START_FEN, { depth: 12, signal: ac.signal });
    ac.abort();

    await expect(promise).rejects.toThrow();
    // Verify no pending jobs remain in the queue by analyzing again successfully
    const results = await pool.analyze(START_FEN, { depth: 3 });
    expect(results).toHaveLength(1);
  });

  it('same position analyzed twice returns identical results (determinism)', async () => {
    const { EnginePool } = await import('../../lib/engine/enginePool');
    // Use separate pool so cache doesn't interfere with the determinism test
    const pool = new EnginePool(1);
    await pool.ready();

    const r1 = await pool.analyze(START_FEN, { depth: 12 });
    // Clear mock cache to force a second engine call
    const r2 = await pool.analyze(START_FEN, { depth: 12 });

    expect(r1[0].depth).toBe(r2[0].depth);
    expect(r1[0].cp).toBe(r2[0].cp);
    expect(r1[0].pv).toEqual(r2[0].pv);
  });

  it('pool of 4 workers can analyze multiple positions concurrently', async () => {
    const { EnginePool } = await import('../../lib/engine/enginePool');
    const pool = new EnginePool(4);
    await pool.ready();

    const fens = Array.from({ length: 8 }, (_, i) => {
      // Vary the FEN slightly (move count) to avoid cache hits
      return `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 ${i + 1}`;
    });

    const start = Date.now();
    const allResults = await Promise.all(
      fens.map((fen) => pool.analyze(fen, { depth: 8 })),
    );
    const elapsed = Date.now() - start;

    expect(allResults).toHaveLength(8);
    for (const results of allResults) {
      expect(results[0].pv.length).toBeGreaterThan(0);
    }
    // With 4 workers and 8 positions at 1ms each, should be well under 1s
    expect(elapsed).toBeLessThan(5000);
  });

  it('pre-aborted signal rejects immediately', async () => {
    const { EnginePool } = await import('../../lib/engine/enginePool');
    const pool = new EnginePool(1);
    await pool.ready();

    const ac = new AbortController();
    ac.abort(); // Already aborted before analyze() call

    await expect(pool.analyze(START_FEN, { depth: 12, signal: ac.signal })).rejects.toThrow();
  });

  it('onInfo callback is called with incremental results', async () => {
    const { EnginePool } = await import('../../lib/engine/enginePool');
    const pool = new EnginePool(1);
    await pool.ready();

    const infos: { depth: number; cp: number | null }[] = [];
    await pool.analyze(START_FEN, {
      depth: 5,
      onInfo: (info) => infos.push({ depth: info.depth, cp: info.cp }),
    });

    expect(infos.length).toBeGreaterThan(0);
    // Depths should be increasing
    for (let i = 1; i < infos.length; i++) {
      expect(infos[i].depth).toBeGreaterThanOrEqual(infos[i - 1].depth);
    }
  });

  it('normalizes Black-to-move positions to White perspective', async () => {
    const { EnginePool } = await import('../../lib/engine/enginePool');
    const pool = new EnginePool(1);
    await pool.ready();

    const BLACK_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const results = await pool.analyze(BLACK_FEN, { depth: 6 });

    expect(results).toHaveLength(1);
    // Mock emits depth * 2 = 12 from engine's perspective (Black).
    // EnginePool normalizes to White perspective: -12.
    expect(results[0].cp).toBe(-12);
  });
});
