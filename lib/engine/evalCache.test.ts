// lib/engine/evalCache.test.ts — Unit tests for the eval cache
//
// Dexie/IndexedDB is mocked out since we're in a Node test environment.
// We test the public interface: getCachedEvals / putCachedEvals / buildCacheKey.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CachedEval, EvalResult } from '../types';

// ── Mock Dexie before any imports that use it ─────────────────────────────────

const mockEvalStore = new Map<string, CachedEval>();

vi.mock('../storage/db', () => ({
  db: {
    evals: {
      get: vi.fn(async (key: string) => mockEvalStore.get(key) ?? undefined),
      update: vi.fn(async () => {}),
      bulkPut: vi.fn(async (rows: CachedEval[]) => {
        for (const row of rows) mockEvalStore.set(row.key, row);
      }),
      bulkDelete: vi.fn(async (keys: string[]) => {
        for (const key of keys) mockEvalStore.delete(key);
      }),
      clear: vi.fn(async () => {
        mockEvalStore.clear();
      }),
      orderBy: vi.fn(() => ({
        toArray: vi.fn(async () => Array.from(mockEvalStore.values())),
      })),
    },
  },
  requestPersistentStorage: vi.fn(async () => true),
}));

// Also mock crypto.subtle for Node (Node 20+ has it natively, but jsdom may not)
// Vitest runs in Node, which has globalThis.crypto available.

import { buildCacheKey, getCachedEvals, putCachedEvals, clearEvalCache } from './evalCache';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

beforeEach(() => {
  mockEvalStore.clear();
});

describe('buildCacheKey', () => {
  it('produces a deterministic key for the same inputs', async () => {
    const key1 = await buildCacheKey(START_FEN, 12, 1, 'sf16');
    const key2 = await buildCacheKey(START_FEN, 12, 1, 'sf16');
    expect(key1).toBe(key2);
  });

  it('produces different keys for different depths', async () => {
    const key12 = await buildCacheKey(START_FEN, 12, 1, 'sf16');
    const key20 = await buildCacheKey(START_FEN, 20, 1, 'sf16');
    expect(key12).not.toBe(key20);
  });

  it('produces different keys for different multipv ranks', async () => {
    const key1 = await buildCacheKey(START_FEN, 12, 1, 'sf16');
    const key2 = await buildCacheKey(START_FEN, 12, 2, 'sf16');
    expect(key1).not.toBe(key2);
  });

  it('produces different keys for different engine versions', async () => {
    const keyA = await buildCacheKey(START_FEN, 12, 1, 'sf16');
    const keyB = await buildCacheKey(START_FEN, 12, 1, 'sf17');
    expect(keyA).not.toBe(keyB);
  });

  it('key format is sha1hex|depth|multipv|engine', async () => {
    const key = await buildCacheKey(START_FEN, 12, 1, 'sf16');
    // Format: <40-char hex>|12|1|sf16
    expect(key).toMatch(/^[0-9a-f]{40}\|12\|1\|sf16$/);
  });
});

describe('getCachedEvals', () => {
  it('returns null on cache miss', async () => {
    const result = await getCachedEvals(START_FEN, 12, 1, 'sf16');
    expect(result).toBeNull();
  });

  it('returns cached results on hit', async () => {
    const evalResult: EvalResult = {
      multipv: 1,
      fen: START_FEN,
      depth: 12,
      cp: 30,
      mate: null,
      pv: ['e2e4', 'e7e5'],
      engine: 'sf16',
    };
    await putCachedEvals([evalResult]);

    const results = await getCachedEvals(START_FEN, 12, 1, 'sf16');
    expect(results).not.toBeNull();
    expect(results).toHaveLength(1);
    expect(results![0].cp).toBe(30);
    expect(results![0].pv).toEqual(['e2e4', 'e7e5']);
  });

  it('returns null if any multipv line is missing', async () => {
    // Put only rank 1, but request multiPv=2
    const evalResult: EvalResult = {
      multipv: 1,
      fen: START_FEN,
      depth: 12,
      cp: 30,
      mate: null,
      pv: ['e2e4'],
      engine: 'sf16',
    };
    await putCachedEvals([evalResult]);

    const results = await getCachedEvals(START_FEN, 12, 2, 'sf16');
    expect(results).toBeNull();
  });

  it('returns all multipv lines when all are cached', async () => {
    const evalResults: EvalResult[] = [
      { multipv: 1, fen: START_FEN, depth: 12, cp: 30, mate: null, pv: ['e2e4'], engine: 'sf16' },
      { multipv: 2, fen: START_FEN, depth: 12, cp: 20, mate: null, pv: ['d2d4'], engine: 'sf16' },
    ];
    await putCachedEvals(evalResults);

    const results = await getCachedEvals(START_FEN, 12, 2, 'sf16');
    expect(results).toHaveLength(2);
    expect(results![0].multipv).toBe(1);
    expect(results![1].multipv).toBe(2);
  });
});

describe('putCachedEvals', () => {
  it('stores results retrievable by getCachedEvals', async () => {
    const input: EvalResult = {
      multipv: 1,
      fen: START_FEN,
      depth: 12,
      cp: 50,
      mate: null,
      pv: ['g1f3'],
      engine: 'sf16',
    };
    await putCachedEvals([input]);

    const cached = await getCachedEvals(START_FEN, 12, 1, 'sf16');
    expect(cached![0].cp).toBe(50);
  });

  it('handles mate scores correctly (does not coerce to cp)', async () => {
    const input: EvalResult = {
      multipv: 1,
      fen: START_FEN,
      depth: 5,
      cp: null,
      mate: 3,
      pv: ['d1h5'],
      engine: 'sf16',
    };
    await putCachedEvals([input]);

    const cached = await getCachedEvals(START_FEN, 5, 1, 'sf16');
    expect(cached![0].cp).toBeNull();
    expect(cached![0].mate).toBe(3);
  });

  it('is idempotent (overwriting same key is safe)', async () => {
    const input: EvalResult = {
      multipv: 1,
      fen: START_FEN,
      depth: 12,
      cp: 30,
      mate: null,
      pv: ['e2e4'],
      engine: 'sf16',
    };
    await putCachedEvals([input]);
    await putCachedEvals([input]); // overwrite same key

    const cached = await getCachedEvals(START_FEN, 12, 1, 'sf16');
    expect(cached).toHaveLength(1);
  });
});

describe('clearEvalCache', () => {
  it('clears all cached entries', async () => {
    const input: EvalResult = {
      multipv: 1,
      fen: START_FEN,
      depth: 12,
      cp: 30,
      mate: null,
      pv: ['e2e4'],
      engine: 'sf16',
    };
    await putCachedEvals([input]);
    expect(await getCachedEvals(START_FEN, 12, 1, 'sf16')).not.toBeNull();

    await clearEvalCache();
    expect(await getCachedEvals(START_FEN, 12, 1, 'sf16')).toBeNull();
  });
});
