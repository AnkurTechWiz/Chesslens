// lib/engine/uci.test.ts — Unit tests for the pure UCI parsing layer
// These run in Node, no DOM needed, no workers.

import { describe, it, expect } from 'vitest';
import { parseInfoLine } from './uci';

describe('parseInfoLine', () => {
  it('parses a basic depth + cp info line', () => {
    const line =
      'info depth 12 seldepth 15 multipv 1 score cp 30 nodes 50000 nps 1000000 time 50 pv e2e4 e7e5 g1f3';
    const result = parseInfoLine(line);
    expect(result).not.toBeNull();
    expect(result?.depth).toBe(12);
    expect(result?.seldepth).toBe(15);
    expect(result?.multipv).toBe(1);
    expect(result?.cp).toBe(30);
    expect(result?.mate).toBeNull();
    expect(result?.pv).toEqual(['e2e4', 'e7e5', 'g1f3']);
    expect(result?.nps).toBe(1_000_000);
    expect(result?.nodes).toBe(50_000);
    expect(result?.time).toBe(50);
  });

  it('parses a mate score line', () => {
    const line = 'info depth 5 seldepth 6 multipv 1 score mate 3 nodes 100 nps 50000 time 2 pv d1h5 g6f7';
    const result = parseInfoLine(line);
    expect(result?.mate).toBe(3);
    expect(result?.cp).toBeNull();
    expect(result?.pv).toEqual(['d1h5', 'g6f7']);
  });

  it('parses a negative mate score (being mated)', () => {
    const line = 'info depth 4 multipv 1 score mate -2 pv e1d1';
    const result = parseInfoLine(line);
    expect(result?.mate).toBe(-2);
    expect(result?.cp).toBeNull();
  });

  it('parses a negative cp score', () => {
    const line = 'info depth 10 multipv 1 score cp -85 pv e7e5';
    const result = parseInfoLine(line);
    expect(result?.cp).toBe(-85);
  });

  it('returns null for info string lines', () => {
    const line = 'info string NNUE evaluation using nn-5af11540bbfe.nnue enabled';
    expect(parseInfoLine(line)).toBeNull();
  });

  it('returns null for non-info lines', () => {
    expect(parseInfoLine('bestmove e2e4 ponder e7e5')).toBeNull();
    expect(parseInfoLine('uciok')).toBeNull();
    expect(parseInfoLine('readyok')).toBeNull();
    expect(parseInfoLine('')).toBeNull();
  });

  it('defaults multipv to 1 when not present', () => {
    const line = 'info depth 8 score cp 15 pv e2e4';
    const result = parseInfoLine(line);
    expect(result?.multipv).toBe(1);
  });

  it('parses multipv 2 correctly', () => {
    const line = 'info depth 12 multipv 2 score cp 18 pv d2d4 d7d5';
    const result = parseInfoLine(line);
    expect(result?.multipv).toBe(2);
    expect(result?.pv).toEqual(['d2d4', 'd7d5']);
  });

  it('returns empty pv array when pv token is absent', () => {
    const line = 'info depth 1 multipv 1 score cp 0';
    const result = parseInfoLine(line);
    expect(result?.pv).toEqual([]);
  });

  it('handles lines where score appears before multipv', () => {
    // Some Stockfish versions emit tokens in different orders
    const line = 'info score cp 40 depth 10 multipv 1 pv g1f3';
    const result = parseInfoLine(line);
    expect(result?.depth).toBe(10);
    expect(result?.cp).toBe(40);
  });
});

describe('UciWrapper (mock integration)', () => {
  // We don't load a real Stockfish binary here — those tests live in tests/engine/.
  // This just verifies the UciWrapper correctly handles a scripted exchange.

  it('resolve analyze() when bestmove is received', async () => {
    const { UciWrapper } = await import('./uci');
    const lines: string[] = [];
    const workerLike = {
      postMessage(msg: string) {
        lines.push(msg);
      },
      onmessage: null as ((event: { data: string }) => void) | null,
    };

    const uci = new UciWrapper(workerLike);

    // Simulate engine responses via a scripted sequence
    async function simulateEngine(): Promise<void> {
      // Respond to `uci` → `uciok`
      await tick();
      workerLike.onmessage?.({ data: 'id name SF16' });
      workerLike.onmessage?.({ data: 'uciok' });
      // Respond to `isready` → `readyok`
      await tick();
      workerLike.onmessage?.({ data: 'readyok' });
    }

    simulateEngine().catch(() => {});
    await uci.init();

    // Now simulate an analysis exchange
    const analyzePromise = uci.analyze('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', {
      depth: 3,
    });

    await tick();
    workerLike.onmessage?.({
      data: 'info depth 1 multipv 1 score cp 10 pv e2e4',
    });
    workerLike.onmessage?.({
      data: 'info depth 2 multipv 1 score cp 20 pv e2e4 e7e5',
    });
    workerLike.onmessage?.({
      data: 'info depth 3 multipv 1 score cp 25 pv e2e4 e7e5 g1f3',
    });
    workerLike.onmessage?.({ data: 'bestmove e2e4 ponder e7e5' });

    const results = await analyzePromise;
    expect(results).toHaveLength(1);
    expect(results[0].depth).toBe(3);
    expect(results[0].cp).toBe(25);
    expect(results[0].pv).toEqual(['e2e4', 'e7e5', 'g1f3']);
  });

  it('rejects analyze() on AbortSignal', async () => {
    const { UciWrapper } = await import('./uci');
    const workerLike = {
      postMessage(_msg: string) {},
      onmessage: null as ((event: { data: string }) => void) | null,
    };

    const uci = new UciWrapper(workerLike);

    // Manually init via scripted responses
    const initPromise = uci.init();
    await tick();
    workerLike.onmessage?.({ data: 'uciok' });
    await tick();
    workerLike.onmessage?.({ data: 'readyok' });
    await initPromise;

    const ac = new AbortController();
    const analyzePromise = uci.analyze(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      { depth: 10, signal: ac.signal },
    );

    ac.abort();

    await expect(analyzePromise).rejects.toThrow();
  });

  it('sends go depth (not go movetime or go infinite)', async () => {
    const { UciWrapper } = await import('./uci');
    const sent: string[] = [];
    const workerLike = {
      postMessage(msg: string) { sent.push(msg); },
      onmessage: null as ((event: { data: string }) => void) | null,
    };

    const uci = new UciWrapper(workerLike);

    const initPromise = uci.init();
    await tick();
    workerLike.onmessage?.({ data: 'uciok' });
    await tick();
    workerLike.onmessage?.({ data: 'readyok' });
    await initPromise;

    const analyzePromise = uci.analyze(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      { depth: 12 },
    );

    await tick();
    workerLike.onmessage?.({ data: 'info depth 12 multipv 1 score cp 25 pv e2e4' });
    workerLike.onmessage?.({ data: 'bestmove e2e4' });
    await analyzePromise;

    // Must contain 'go depth' — never 'go movetime' or 'go infinite'
    const goCmd = sent.find((s) => s.startsWith('go '));
    expect(goCmd).toBe('go depth 12');
    expect(sent).not.toContain(expect.stringContaining('movetime'));
    expect(sent).not.toContain(expect.stringContaining('go infinite'));
  });
});

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
