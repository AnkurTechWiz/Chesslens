// lib/analysis/pipeline.test.ts — Tests for the two-pass analysis pipeline
//
// Uses a mock engine that returns pre-computed eval data.

import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import type { AnalysisEngine, EvalResult, MoveReport } from '../types';
import { parsePgn } from '../pgn/parse';
import { analyzeGame } from './pipeline';

// ── Mock Engine ──────────────────────────────────────────────────────────────

/**
 * Mock engine that returns the same eval for any FEN:
 * cp: 30 from White's perspective, with a simple PV.
 *
 * Tracks how many times analyze() was called to verify two-pass behavior.
 */
function createMockEngine(): AnalysisEngine & { callCount: number; fensAnalyzed: string[] } {
  const mock = {
    callCount: 0,
    fensAnalyzed: [] as string[],
    async analyze(
      fen: string,
      opts: { depth: number; multiPv: number; signal?: AbortSignal },
    ): Promise<EvalResult[]> {
      mock.callCount++;
      mock.fensAnalyzed.push(fen);

      const evals: EvalResult[] = [
        {
          multipv: 1,
          fen,
          depth: opts.depth,
          cp: 30,
          mate: null,
          pv: ['e2e4'],
          engine: 'mock-sf18',
        },
      ];

      if (opts.multiPv >= 2) {
        evals.push({
          multipv: 2,
          fen,
          depth: opts.depth,
          cp: 20,
          mate: null,
          pv: ['d2d4'],
          engine: 'mock-sf18',
        });
      }

      if (opts.multiPv >= 3) {
        evals.push({
          multipv: 3,
          fen,
          depth: opts.depth,
          cp: 10,
          mate: null,
          pv: ['g1f3'],
          engine: 'mock-sf18',
        });
      }

      return evals;
    },
  };
  return mock;
}

function readFixture(name: string): string {
  return fs.readFileSync(
    path.join(__dirname, '../../tests/fixtures', name),
    'utf-8',
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('pipeline', () => {
  it('produces a complete GameReport with all required fields', async () => {
    const pgn = readFixture('italian-mainline.pgn');
    const game = parsePgn(pgn);
    const engine = createMockEngine();

    const report = await analyzeGame(game, engine);

    // Structure checks
    expect(report.moves).toHaveLength(8);
    expect(report.accuracy).toBeDefined();
    expect(report.accuracy.white).toBeGreaterThanOrEqual(0);
    expect(report.accuracy.black).toBeGreaterThanOrEqual(0);
    expect(report.acpl).toBeDefined();
    expect(report.counts).toBeDefined();
    expect(report.keyMoments).toBeDefined();
    expect(report.opening).toBeDefined();
    expect(report.opening.eco).toBeTruthy();

    // Every move has required MoveReport fields
    for (const move of report.moves) {
      expect(move.san).toBeTruthy();
      expect(move.uci).toBeTruthy();
      expect(move.fenBefore).toBeTruthy();
      expect(move.fenAfter).toBeTruthy();
      expect(move.classification).toBeTruthy();
      expect(typeof move.accuracy).toBe('number');
      expect(typeof move.epLoss).toBe('number');
    }
  });

  it('calls the engine for all positions (Pass A)', async () => {
    const pgn = readFixture('italian-mainline.pgn');
    const game = parsePgn(pgn);
    const engine = createMockEngine();

    await analyzeGame(game, engine);

    // 8 moves = 8 before-FENs + 1 final after-FEN = 9 positions minimum
    // Some FENs may be de-duped (unlikely for a real game)
    expect(engine.callCount).toBeGreaterThanOrEqual(9);
  });

  it('fires progress callback in ply order', async () => {
    const pgn = readFixture('italian-mainline.pgn');
    const game = parsePgn(pgn);
    const engine = createMockEngine();

    const progressCalls: { ply: number; total: number }[] = [];
    const onProgress = vi.fn((ply: number, total: number, _partial: MoveReport) => {
      progressCalls.push({ ply, total });
    });

    await analyzeGame(game, engine, { onProgress });

    expect(onProgress).toHaveBeenCalledTimes(8);
    // Verify ply order
    for (let i = 0; i < progressCalls.length; i++) {
      expect(progressCalls[i].ply).toBe(i + 1);
      expect(progressCalls[i].total).toBe(8);
    }
  });

  it('produces deterministic results', async () => {
    const pgn = readFixture('italian-mainline.pgn');
    const game = parsePgn(pgn);

    const report1 = await analyzeGame(game, createMockEngine());
    const report2 = await analyzeGame(game, createMockEngine());

    expect(report1.moves.map((m) => m.classification))
      .toEqual(report2.moves.map((m) => m.classification));
    expect(report1.accuracy).toEqual(report2.accuracy);
  });

  it('analyzes Kasparov-Topalov fixture through pipeline and classifies 24. Rxd4 as brilliant', async () => {
    const pgn = readFixture('kasparov-topalov.pgn');
    const game = parsePgn(pgn);

    // Engine mock that simulates SF18-lite behavior on Kasparov-Topalov:
    // Move 24 (ply 47) Rxd4 is the engine's best move with -800cp before & after (horizon-limited)
    const depthsRequested: { fen: string; depth: number }[] = [];
    const engine: AnalysisEngine = {
      async analyze(fen: string, opts: { depth: number; multiPv: number }) {
        depthsRequested.push({ fen, depth: opts.depth });

        const isRxd4Before = fen.includes('4PQ2') && fen.includes('1K1R4');
        const isRxd4After = fen.includes('1K1R1Q2') || fen.includes('3R4');

        if (isRxd4Before) {
          return [
            {
              multipv: 1,
              fen,
              depth: opts.depth,
              cp: -800, // horizon-limited eval from SF18-lite
              mate: null,
              pv: ['d1d4', 'c5d4'],
              engine: 'sf18.v3',
            },
            {
              multipv: 2,
              fen,
              depth: opts.depth,
              cp: -900,
              mate: null,
              pv: ['f4f6'],
              engine: 'sf18.v3',
            },
          ];
        }

        if (isRxd4After) {
          return [
            {
              multipv: 1,
              fen,
              depth: opts.depth,
              cp: -800, // Black is +800 -> White is -800
              mate: null,
              pv: ['c5d4'],
              engine: 'sf18.v3',
            },
          ];
        }

        // Default evals for other moves
        return [
          {
            multipv: 1,
            fen,
            depth: opts.depth,
            cp: 30,
            mate: null,
            pv: ['e2e4'],
            engine: 'sf18.v3',
          },
        ];
      },
    };

    const report = await analyzeGame(game, engine, { playerRating: 2800 });
    expect(report.moves).toHaveLength(87);

    const move24 = report.moves[46];
    expect(move24.ply).toBe(47);
    expect(move24.san).toBe('Rxd4');
    expect(move24.uci).toBe('d1d4');
    expect(move24.classification).toBe('brilliant');

    // Verify Pass B requested depth >= 22 for the sacrifice position
    const rxd4DepthCalls = depthsRequested.filter((d) => d.fen === move24.fenBefore);
    expect(rxd4DepthCalls.some((d) => d.depth >= 22)).toBe(true);
  });

  it('analyzes headerless movetext-only PGN through pipeline', async () => {
    const rawMovetext = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O';
    const game = parsePgn(rawMovetext);
    const engine = createMockEngine();

    const progressCalls: number[] = [];
    const report = await analyzeGame(game, engine, {
      onProgress: (ply) => {
        progressCalls.push(ply);
      },
    });

    expect(report.moves).toHaveLength(16);
    expect(progressCalls).toHaveLength(16);
    expect(report.accuracy.white).toBeGreaterThanOrEqual(0);
    expect(report.accuracy.black).toBeGreaterThanOrEqual(0);
  });

  it('handles abort signal', async () => {
    const pgn = readFixture('club-game.pgn');
    const game = parsePgn(pgn);
    const engine = createMockEngine();

    const controller = new AbortController();
    // Abort immediately
    controller.abort();

    await expect(
      analyzeGame(game, engine, { signal: controller.signal }),
    ).rejects.toThrow('Analysis aborted');
  });

  it('handles engine analysis failures gracefully', async () => {
    const pgn = readFixture('italian-mainline.pgn');
    const game = parsePgn(pgn);
    const failingEngine: AnalysisEngine = {
      analyze: async () => {
        throw new Error('Engine worker crashed');
      },
    };

    await expect(analyzeGame(game, failingEngine)).rejects.toThrow('Engine worker crashed');
  });
});
