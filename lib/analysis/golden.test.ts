// lib/analysis/golden.test.ts — Golden fixture integration tests
//
// These are the Phase 3 acceptance criteria from IMPLEMENTATION_PLAN.md §7.
// Uses real PGN fixtures with hand-crafted mock eval data.
// Tests written FIRST per AGENTS.md §3 and §6.
//
// The mock evals are carefully chosen to trigger the exact classification
// conditions for each fixture. This tests the classification logic in isolation;
// the engine integration is Phase 2's job (already verified).

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import type { EvalResult } from '../types';
import { classifyGame } from './classify';
import { parsePgn } from '../pgn/parse';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Read a PGN fixture file. */
function readFixture(name: string): string {
  return fs.readFileSync(
    path.join(__dirname, '../../tests/fixtures', name),
    'utf-8',
  );
}

/**
 * Build mock eval data for a list of FENs.
 *
 * The evalMap maps FEN → { cp, mate, bestUci, bestSan, altCp, altMate, altUci, altSan, pv }.
 * Values are from White's perspective (standard UCI convention).
 */
function buildMockEvals(
  evalMap: Record<string, {
    cp?: number | null;
    mate?: number | null;
    bestUci?: string;
    bestSan?: string;
    altCp?: number | null;
    altMate?: number | null;
    altUci?: string;
    altSan?: string;
    pv?: string[];
  }>,
): Map<string, EvalResult[]> {
  const result = new Map<string, EvalResult[]>();
  for (const [fen, data] of Object.entries(evalMap)) {
    const evals: EvalResult[] = [
      {
        multipv: 1,
        fen,
        depth: 20,
        cp: data.cp ?? null,
        mate: data.mate ?? null,
        pv: data.pv ?? [data.bestUci ?? 'e2e4'],
        engine: 'sf18',
      },
    ];
    if (data.altCp !== undefined || data.altMate !== undefined) {
      evals.push({
        multipv: 2,
        fen,
        depth: 20,
        cp: data.altCp ?? null,
        mate: data.altMate ?? null,
        pv: [data.altUci ?? 'a2a3'],
        engine: 'sf18',
      });
    }
    result.set(fen, evals);
  }
  return result;
}

/**
 * Build a full eval map for a game by walking through the PGN
 * and assigning evals to each FEN. Takes a function that returns
 * eval data for each ply.
 */
function buildGameEvals(
  pgnText: string,
  evalFn: (ply: number, fenBefore: string, san: string, fenAfter: string) => {
    cp?: number | null;
    mate?: number | null;
    bestUci?: string;
    bestSan?: string;
    altCp?: number | null;
    altMate?: number | null;
    altUci?: string;
    altSan?: string;
    pv?: string[];
  },
): Map<string, EvalResult[]> {
  const game = parsePgn(pgnText);
  const evalMap: Record<string, {
    cp?: number | null;
    mate?: number | null;
    bestUci?: string;
    bestSan?: string;
    altCp?: number | null;
    altMate?: number | null;
    altUci?: string;
    altSan?: string;
    pv?: string[];
  }> = {};

  for (const move of game.moves) {
    const data = evalFn(move.ply, move.fenBefore, move.san, move.fenAfter);
    evalMap[move.fenBefore] = data;
  }
  // Also need eval for the final position
  // Use a large positive cp to indicate a decisive result if checkmate
  if (game.moves.length > 0) {
    const lastMove = game.moves[game.moves.length - 1];
    if (!evalMap[lastMove.fenAfter]) {
      // Default: large advantage for the side that just moved
      // (last mover's perspective). From White's perspective:
      const lastMoverIsWhite = lastMove.color === 'w';
      evalMap[lastMove.fenAfter] = { cp: lastMoverIsWhite ? 10000 : -10000 };
    }
  }

  return buildMockEvals(evalMap);
}

// ── Golden Fixture Tests ─────────────────────────────────────────────────────

describe('golden fixtures', () => {
  // ── 1. Kasparov–Topalov 1999: 24.Rxd4!! → brilliant ──────────────────────

  it('Kasparov–Topalov 1999: move 24 Rxd4 is classified Brilliant', () => {
    const pgn = readFixture('kasparov-topalov.pgn');
    const game = parsePgn(pgn);

    // Move 24 is ply 47 (White's 24th move = 24*2 - 1 = 47).
    // All evals are from WHITE's perspective (standard UCI convention).
    //
    // Brilliant conditions (§3.4) for ply 47:
    //   1. epLoss <= 0.02 (move is best or near-best)
    //   2. sacrifice (piece capturable at static loss after move)
    //   3. epBefore <= 0.97 (not already dominating)
    //   4. epAfter >= 0.50 (not losing after)
    //   5. altEp >= 0.5 (non-sac alternative exists)
    //   6. legalMoves > 1 (not forced)
    const evals = buildGameEvals(pgn, (ply, _fenBefore, _san, _fenAfter) => {
      if (ply === 47) {
        // Position before Rxd4: White moderately ahead
        // cp: 100 from White's perspective → epBefore ≈ 0.59 (≤ 0.97 ✓)
        return {
          cp: 100,
          bestUci: 'd1d4', bestSan: 'Rxd4',
          altCp: 80,
          altUci: 'a1a2', altSan: 'Ra2',
          pv: ['d1d4', 'c5d4'],
        };
      }
      // Position AFTER Rxd4 (= before ply 48): White still ahead.
      // cp: 120 from White's perspective → epAfter ≈ 0.61 (≥ 0.50 ✓)
      // CRITICAL: this must be POSITIVE because White is winning after the sac.
      if (ply === 48) {
        return {
          cp: 120,
          bestUci: 'c5d4', bestSan: 'cxd4',
          altCp: 100,
          pv: ['c5d4'],
        };
      }
      // Default: stable mild White advantage, no wild swings
      // Keeps prevClassification away from blunder/mistake for all plies
      const cp = ply % 2 === 1 ? 40 : 40;  // Always +0.4 from White's view
      return { cp, altCp: cp - 5 };
    });

    const reports = classifyGame(game, evals, 1500);

    const move24 = reports.find((r) => r.ply === 47);
    expect(move24).toBeDefined();
    expect(move24!.classification).toBe('brilliant');
  });

  // ── 2. Opera Game: sacrifices → brilliant; final mate → best/forced ──────

  it('Opera Game: at least one sacrifice is Brilliant', () => {
    const pgn = readFixture('opera-game.pgn');
    const game = parsePgn(pgn);

    // Key Morphy sacrifices:
    // Ply 19: 10.Nxb5 (sac piece for attack)
    // Ply 25: 13.Rxd7! (exchange sac)
    // Ply 31: 16.Qb8+! (queen sac leading to mate)
    // Ply 33: 17.Rd8# (mate)
    //
    // ALL evals from White's perspective.
    const evals = buildGameEvals(pgn, (ply) => {
      // Opening: stable, mild White edge
      if (ply <= 16) {
        return { cp: 30, altCp: 25 };
      }

      // Ply 17-18: transition, White building
      if (ply <= 18) {
        return { cp: 60, altCp: 50 };
      }

      // Ply 19: 10.Nxb5 — sacrifice. White moderately ahead, not dominating.
      // Before: cp 80 → ep ~0.57. After (ply 20 before): cp 150 → ep ~0.66
      // altCp: 30 → ep ~0.53 → gap ≈ 0.04 (not enough for Great-only, needs sac)
      if (ply === 19) {
        return {
          cp: 80,
          bestUci: 'c3b5', bestSan: 'Nxb5',
          altCp: 30,
          altUci: 'a2a3', altSan: 'a3',
          pv: ['c3b5', 'c6b5'],
        };
      }
      // After Nxb5: White is doing well. cp from White's perspective = positive
      if (ply === 20) {
        return { cp: 150, altCp: 130 };
      }

      // Ply 21-24: White building attack, steady advantage
      if (ply >= 21 && ply <= 24) {
        return { cp: 180, altCp: 160 };
      }

      // Ply 25: 13.Rxd7! — exchange sacrifice
      if (ply === 25) {
        return {
          cp: 200,
          bestUci: 'd1d7', bestSan: 'Rxd7',
          altCp: 100,
          altUci: 'a2a3', altSan: 'a3',
          pv: ['d1d7', 'd8d7'],
        };
      }
      // After Rxd7: White clearly ahead
      if (ply === 26) {
        return { cp: 250, altCp: 200 };
      }

      // Ply 27-30: Escalating White advantage
      if (ply >= 27 && ply <= 30) {
        return { cp: 350, altCp: 300 };
      }

      // Ply 31: 16.Qb8+! — queen sac, mate in 2
      if (ply === 31) {
        return {
          cp: null, mate: 2,
          bestUci: 'b3b8', bestSan: 'Qb8+',
          altCp: 500,
          altUci: 'a2a3', altSan: 'a3',
          pv: ['b3b8', 'd7b8', 'd1d8'],
        };
      }
      // After Qb8+ (ply 32): Black must take, White has mate in 1.
      // From White's perspective: mate: 1 (White delivers mate in 1 move).
      if (ply === 32) {
        return { cp: null, mate: 1, altCp: null, altMate: 1 };
      }

      // Ply 33: 17.Rd8# — checkmate, forced (only legal mating move)
      if (ply === 33) {
        return {
          cp: null, mate: 1,
          bestUci: 'd1d8', bestSan: 'Rd8#',
          pv: ['d1d8'],
        };
      }

      // Fallback
      return { cp: 200, altCp: 180 };
    });

    const reports = classifyGame(game, evals, 1500);

    // At least one sacrifice should be brilliant
    const brilliants = reports.filter((r) => r.classification === 'brilliant');
    expect(brilliants.length).toBeGreaterThanOrEqual(1);

    // Final mate (Rd8#) should be best or forced
    const finalMove = reports[reports.length - 1];
    expect(['best', 'forced']).toContain(finalMove.classification);
  });

  // ── 3. Saving move → Great ───────────────────────────────────────────────

  it('Saving-move fixture: at least one move is classified Great', () => {
    const pgn = readFixture('saving-move.pgn');
    const game = parsePgn(pgn);

    // One specific move (the "saving" move) has:
    // - epLoss <= 0.02 (it's the best/near-best)
    // - second-best is much worse (gap >= 0.10 EP)
    // → "only move that holds" → Great
    const evals = buildGameEvals(pgn, (ply) => {
      // Ply 27 (14.Nd5): a critical saving move
      // Only Nd5 holds; everything else loses
      if (ply === 27) {
        return {
          cp: -50,  // White slightly worse but tenable
          bestUci: 'c3d5', bestSan: 'Nd5',
          altCp: -300,  // Alternatives are much worse → big gap
          altUci: 'a2a3', altSan: 'a3',
          pv: ['c3d5', 'a5d8'],
        };
      }
      // After Nd5: position stabilizes
      if (ply === 28) {
        return { cp: 50, altCp: 30 };
      }

      // Default: mostly equal game, stable
      return { cp: 20, altCp: 15 };
    });

    const reports = classifyGame(game, evals, 1500);

    const greats = reports.filter((r) => r.classification === 'great');
    expect(greats.length).toBeGreaterThanOrEqual(1);
  });

  // ── 4. Hanging queen → Miss with hanging_piece motif ─────────────────────

  it('Hanging-queen fixture: at least one Miss with hanging_piece motif', () => {
    const pgn = readFixture('hanging-queen.pgn');
    const game = parsePgn(pgn);

    // Game: 1.e4 e5 2.Qh5 Nc6 3.Bc4 g6 4.Qf3 Nf6 5.Qb3 Nd4 6.Bxf7+ Ke7
    //        7.Qc4 b5 8.Qc3 Nxe4 ...
    //
    // Scenario: At ply 10 (5...Nd4), Black plays Nd4 which is a blunder
    // (leaves material en prise). Then at ply 11 (6.Bxf7+), White has
    // a strong capture available but let's set up ply 15 (8.Qc3) as the miss:
    //
    // Ply 14 (7...b5): Black blunders — best move was different
    // Ply 15 (8.Qc3): White misses capturing the Nd4 knight (value 3)
    //
    // All evals from White's perspective.
    const evals = buildGameEvals(pgn, (ply, _fenBefore, _san) => {
      // Ply 14 (7...b5): Black blunders.
      // Engine says best for Black was ...Qd7 (defend), not ...b5
      // Before: Black was doing OK (cp: -50 = Black slightly ahead)
      // After b5: White has huge advantage (cp: 400 at ply 15)
      if (ply === 14) {
        return {
          cp: -50,
          bestUci: 'd8d7', bestSan: 'Qd7',  // Engine best ≠ played b5
          altCp: -30,
          altUci: 'a7a6', altSan: 'a6',
          pv: ['d8d7'],
        };
      }

      // Ply 15 (8.Qc3): White's miss.
      // Best move is Qxd4 — captures the Black Nd4 knight (value 3 → hanging_piece)
      // But White played Qc3 (passive).
      // Before: cp: 400 (White has huge advantage from Black's blunder)
      // After Qc3 (ply 16 before): cp drops to 100 (White let it slip)
      if (ply === 15) {
        return {
          cp: 400,
          bestUci: 'c4d4', bestSan: 'Qxd4',  // Captures knight on d4 (value 3)
          altCp: 350,
          altUci: 'c4b5', altSan: 'Qxb5',
          pv: ['c4d4'],
        };
      }

      // After the miss (ply 16): eval dropped
      if (ply === 16) {
        return { cp: 100, altCp: 80 };
      }

      // Default: stable, mild White edge
      return { cp: 30, altCp: 25 };
    });

    const reports = classifyGame(game, evals, 1500);

    // Find moves classified as miss
    const misses = reports.filter((r) => r.classification === 'miss');
    expect(misses.length).toBeGreaterThanOrEqual(1);

    // At least one miss should have the hanging_piece motif
    const hangingMisses = misses.filter((r) => r.motifs.includes('hanging_piece'));
    expect(hangingMisses.length).toBeGreaterThanOrEqual(1);
  });

  // ── 5. Italian mainline moves 1–8 → all Book ─────────────────────────────

  it('Italian mainline: moves 1–8 are all classified Book', () => {
    const pgn = readFixture('italian-mainline.pgn');
    const game = parsePgn(pgn);

    // All positions are book moves — evals don't matter for book classification
    const evals = buildGameEvals(pgn, (ply) => {
      const cp = ply % 2 === 1 ? 30 : -30;
      return { cp, altCp: cp - (ply % 2 === 1 ? 5 : -5) };
    });

    const reports = classifyGame(game, evals, 1500);

    // All 8 moves should be book
    expect(reports.length).toBe(8);
    for (const report of reports) {
      expect(report.classification).toBe('book');
    }
  });

  // ── 6. Club game → at most 1 brilliant ───────────────────────────────────

  it('Club game: at most 1 Brilliant (guards against badge inflation)', () => {
    const pgn = readFixture('club-game.pgn');
    const game = parsePgn(pgn);

    // Normal club game: no dramatic sacrifices
    // All evals are moderate, no sac conditions
    const evals = buildGameEvals(pgn, (ply) => {
      // Mild advantage oscillation, no extreme swings
      const base = ply % 2 === 1 ? 20 : -20;
      const drift = Math.sin(ply * 0.3) * 30;
      const cp = Math.round(base + drift);
      return {
        cp,
        altCp: cp - (ply % 2 === 1 ? 8 : -8),
      };
    });

    const reports = classifyGame(game, evals, 1400);

    const brilliants = reports.filter((r) => r.classification === 'brilliant');
    expect(brilliants.length).toBeLessThanOrEqual(1);
  });

  // ── 7. Determinism: same input → identical output ────────────────────────

  it('Determinism: classifyGame twice with same input → deep-equal reports', () => {
    const pgn = readFixture('kasparov-topalov.pgn');
    const game = parsePgn(pgn);

    const evals = buildGameEvals(pgn, (ply) => {
      const cp = ply % 2 === 1 ? 50 : -50;
      return { cp, altCp: cp - (ply % 2 === 1 ? 10 : -10) };
    });

    const reports1 = classifyGame(game, evals, 1500);
    const reports2 = classifyGame(game, evals, 1500);

    expect(reports1).toEqual(reports2);
  });

  // ── 8. Calibration: 500-Elo game bounds ──────────────────────────────────

  it('Calibration: 500-Elo game bounds (calibration-500.pgn)', async () => {
    const pgn = readFixture('calibration-500.pgn');
    const game = parsePgn(pgn);

    // Load precomputed engine evaluations
    const rawEvals = JSON.parse(readFixture('calibration-500.evals.json')) as Record<string, EvalResult[]>;
    const evalMap = new Map<string, EvalResult[]>(Object.entries(rawEvals));

    const reports = classifyGame(game, evalMap, 500);
    const { computeGameStats } = await import('./accuracy');
    const stats = computeGameStats(reports);

    const whiteReports = reports.filter((r) => r.ply % 2 === 1);
    const blackReports = reports.filter((r) => r.ply % 2 === 0);

    const whiteBests = whiteReports.filter((r) => r.classification === 'best');
    const blackBests = blackReports.filter((r) => r.classification === 'best');
    const whiteExcellents = whiteReports.filter((r) => r.classification === 'excellent');
    const blackExcellents = blackReports.filter((r) => r.classification === 'excellent');

    const brilliants = reports.filter((r) => r.classification === 'brilliant');
    const greats = reports.filter((r) => r.classification === 'great');
    const bests = reports.filter((r) => r.classification === 'best');
    const excellents = reports.filter((r) => r.classification === 'excellent');
    const misses = reports.filter((r) => r.classification === 'miss');
    const blunders = reports.filter((r) => r.classification === 'blunder');

    expect(brilliants.length).toBeLessThanOrEqual(1);
    expect(greats.length).toBeLessThanOrEqual(5);
    expect(bests.length).toBeGreaterThanOrEqual(15);
    expect(bests.length).toBeLessThanOrEqual(25);
    expect(excellents.length).toBeGreaterThanOrEqual(20);
    expect(excellents.length).toBeLessThanOrEqual(35);
    expect(misses.length).toBeLessThanOrEqual(3);
    expect(blunders.length).toBeLessThanOrEqual(4);

    // Color-specific bounds
    expect(whiteBests.length).toBeGreaterThanOrEqual(5);
    expect(whiteBests.length).toBeLessThanOrEqual(12);
    expect(blackBests.length).toBeGreaterThanOrEqual(10);
    expect(blackBests.length).toBeLessThanOrEqual(16);

    expect(whiteExcellents.length).toBeGreaterThanOrEqual(12);
    expect(whiteExcellents.length).toBeLessThanOrEqual(20);
    expect(blackExcellents.length).toBeGreaterThanOrEqual(8);
    expect(blackExcellents.length).toBeLessThanOrEqual(15);

    expect(stats.accuracy.white).toBeGreaterThanOrEqual(55);
    expect(stats.accuracy.white).toBeLessThanOrEqual(80);
    expect(stats.accuracy.black).toBeGreaterThanOrEqual(55);
    expect(stats.accuracy.black).toBeLessThanOrEqual(85);

    expect(stats.acpl.white).toBeLessThan(150);
    expect(stats.acpl.black).toBeLessThan(150);

    // Assert estimated Elo bounds for 500-level game (between 350 and 950)
    expect(stats.estElo.white).toBeGreaterThanOrEqual(350);
    expect(stats.estElo.white).toBeLessThanOrEqual(950);
    expect(stats.estElo.black).toBeGreaterThanOrEqual(350);
    expect(stats.estElo.black).toBeLessThanOrEqual(950);
  });
});
