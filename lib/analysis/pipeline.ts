// lib/analysis/pipeline.ts — Two-pass analysis orchestrator
//
// From IMPLEMENTATION_PLAN.md §4.2.
// Takes a parsed PGN + an AnalysisEngine interface and produces a GameReport.
//
// Pass A (scan): analyze all positions at depth 12, MultiPV 2
// Pass B (verify): re-analyze "interesting" plies at depth 20, MultiPV 3
// Then: classify all moves using the eval results
//
// The pipeline takes an AnalysisEngine interface (not a concrete engine)
// so it can be tested with mocks.

import type {
  AnalysisEngine,
  AnalysisProgress,
  Classification,
  EvalResult,
  GameReport,
  MoveReport,
} from '../types';
import type { ParsedGame } from '../pgn/parse';
import { classifyGame } from './classify';
import { computeGameStats } from './accuracy';
import { getOpeningInfo } from './openingBook';
import { findKeyMoments } from './keyMoments';
import { computePhaseAccuracies } from './phases';
import { expectedPointsWithMate, toMoverPerspective } from './winProb';
import { isSacrifice } from './sacrifice';

// ── Configuration ────────────────────────────────────────────────────────────

/** Scan pass configuration. */
const SCAN_DEPTH = 12;
const SCAN_MULTI_PV = 2;

/** Verify pass configuration. */
const VERIFY_DEPTH = 20;
const VERIFY_SACRIFICE_DEPTH = 22;
const VERIFY_MULTI_PV = 3;

/** Threshold for "interesting" plies that need verification. */
const VERIFY_EP_THRESHOLD = 0.04;

// ── Pipeline ─────────────────────────────────────────────────────────────────

export interface PipelineOptions {
  /** Player rating for leniency. Default: 1500. */
  playerRating?: number;
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
  /** Progress callback. */
  onProgress?: AnalysisProgress;
}

/**
 * Determine which plies need verification (Pass B).
 *
 * A ply is "interesting" if:
 * - |Δwin%| > VERIFY_EP_THRESHOLD between before and after evals
 * - Candidate for brilliant or great classification
 */
function findInterestingPlies(
  game: ParsedGame,
  evalMap: Map<string, EvalResult[]>,
): Set<number> {
  const interesting = new Set<number>();

  for (const move of game.moves) {
    const beforeEvals = evalMap.get(move.fenBefore);
    const afterEvals = evalMap.get(move.fenAfter);

    if (!beforeEvals?.[0] || !afterEvals?.[0]) continue;

    const before = toMoverPerspective(
      beforeEvals[0].cp,
      beforeEvals[0].mate,
      move.color,
    );
    const after = toMoverPerspective(
      afterEvals[0].cp,
      afterEvals[0].mate,
      move.color,
    );

    const epBefore = expectedPointsWithMate(before.cp, before.mate);
    const epAfter = expectedPointsWithMate(after.cp, after.mate);
    const epDelta = Math.abs(epBefore - epAfter);

    // 1. Eval delta exceeds threshold (blunders, mistakes, swings)
    if (epDelta > VERIFY_EP_THRESHOLD) {
      interesting.add(move.ply);
    }

    // 2. Candidate for Great Move (only-move candidate or game-turning)
    const pv1 = beforeEvals.find((e) => e.multipv === 1);
    const pv2 = beforeEvals.find((e) => e.multipv === 2);
    if (pv1 && pv2) {
      const bestMover = toMoverPerspective(pv1.cp, pv1.mate, move.color);
      const altMover = toMoverPerspective(pv2.cp, pv2.mate, move.color);
      const bestEp = expectedPointsWithMate(bestMover.cp, bestMover.mate);
      const altEp = expectedPointsWithMate(altMover.cp, altMover.mate);

      if (bestEp - altEp >= 0.08) {
        interesting.add(move.ply);
      }
    }

    if ((epBefore < 0.50 && epAfter >= 0.50) || (epBefore < 0.75 && epAfter >= 0.90)) {
      interesting.add(move.ply);
    }

    // 3. Candidate for Brilliant (sacrifice candidate)
    // Sacrifices must be verified at depth 20 before classify; epAfter of −8.5 at depth 12 is a shallow-eval false negative.
    if (isSacrifice(move.fenBefore, move.uci, move.fenAfter, move.color)) {
      interesting.add(move.ply);
    }
  }

  return interesting;
}

/**
 * Run the two-pass analysis pipeline.
 *
 * 1. Parse PGN → positions
 * 2. Pass A: scan all positions at depth 12, MultiPV 2
 * 3. Pass B: re-analyze interesting plies at depth 20, MultiPV 3
 * 4. Classify all moves
 * 5. Compute accuracy, phases, key moments, opening info
 * 6. Emit GameReport
 */
export async function analyzeGame(
  game: ParsedGame,
  engine: AnalysisEngine,
  options: PipelineOptions = {},
): Promise<GameReport> {
  const {
    playerRating = 1500,
    signal,
    onProgress,
  } = options;

  const totalPlies = game.moves.length;
  const evalMap = new Map<string, EvalResult[]>();

  // ── Pass A: Scan (Parallel across worker pool) ────────────────────────────

  const fensToScan: string[] = [];
  for (const move of game.moves) {
    if (!fensToScan.includes(move.fenBefore)) {
      fensToScan.push(move.fenBefore);
    }
  }
  if (game.moves.length > 0) {
    const lastFen = game.moves[game.moves.length - 1].fenAfter;
    if (!fensToScan.includes(lastFen)) {
      fensToScan.push(lastFen);
    }
  }

  await Promise.all(
    fensToScan.map(async (fen) => {
      if (signal?.aborted) {
        throw new DOMException('Analysis aborted', 'AbortError');
      }
      const evals = await engine.analyze(fen, {
        depth: SCAN_DEPTH,
        multiPv: SCAN_MULTI_PV,
        signal,
      });
      evalMap.set(fen, evals);
    }),
  );

  // ── Pass B: Verify (Parallel across worker pool) ──────────────────────────

  const interestingPlies = findInterestingPlies(game, evalMap);
  const verifyFens = new Map<string, number>();

  for (const move of game.moves) {
    const isSac = isSacrifice(move.fenBefore, move.uci, move.fenAfter, move.color);
    if (isSac) {
      // Sacrifices must be re-searched at depth >= 22 on the verify pass
      const targetBefore = Math.max(verifyFens.get(move.fenBefore) ?? 0, VERIFY_SACRIFICE_DEPTH);
      verifyFens.set(move.fenBefore, targetBefore);
      const targetAfter = Math.max(verifyFens.get(move.fenAfter) ?? 0, VERIFY_SACRIFICE_DEPTH);
      verifyFens.set(move.fenAfter, targetAfter);
    } else if (interestingPlies.has(move.ply)) {
      if (!verifyFens.has(move.fenBefore)) {
        verifyFens.set(move.fenBefore, VERIFY_DEPTH);
      }
      if (!verifyFens.has(move.fenAfter)) {
        verifyFens.set(move.fenAfter, VERIFY_DEPTH);
      }
    }
  }

  await Promise.all(
    Array.from(verifyFens.entries()).map(async ([fen, depth]) => {
      if (signal?.aborted) {
        throw new DOMException('Analysis aborted', 'AbortError');
      }
      const deeperEvals = await engine.analyze(fen, {
        depth,
        multiPv: VERIFY_MULTI_PV,
        signal,
      });
      evalMap.set(fen, deeperEvals);
    }),
  );

  // ── Classify ──────────────────────────────────────────────────────────────

  const reports = classifyGame(game, evalMap, playerRating);

  // Fire progress for each ply in order
  if (onProgress) {
    for (const report of reports) {
      onProgress(report.ply, totalPlies, report);
    }
  }

  // ── Compute summary stats ─────────────────────────────────────────────────

  const movesUci = game.moves.map((m) => m.uci);
  const openingInfo = getOpeningInfo(movesUci);
  const keyMoments = findKeyMoments(reports);

  // Compute accuracy and ACPL using the existing computeGameStats
  const stats = computeGameStats(reports);

  // Phase-split accuracy
  const phases = computePhaseAccuracies(reports, openingInfo.bookPlies);

  // Classification counts per side
  const counts = countClassificationsPerSide(reports);

  return {
    moves: reports,
    accuracy: stats.accuracy,
    acpl: stats.acpl,
    estElo: stats.estElo,
    counts,
    phases,
    keyMoments,
    opening: openingInfo,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function countClassificationsPerSide(
  reports: MoveReport[],
): Record<Classification, { white: number; black: number }> {
  const counts: Record<Classification, { white: number; black: number }> = {
    brilliant: { white: 0, black: 0 },
    great: { white: 0, black: 0 },
    best: { white: 0, black: 0 },
    excellent: { white: 0, black: 0 },
    good: { white: 0, black: 0 },
    book: { white: 0, black: 0 },
    inaccuracy: { white: 0, black: 0 },
    mistake: { white: 0, black: 0 },
    miss: { white: 0, black: 0 },
    blunder: { white: 0, black: 0 },
    forced: { white: 0, black: 0 },
  };

  for (const report of reports) {
    const side = report.ply % 2 === 1 ? 'white' : 'black';
    counts[report.classification][side]++;
  }

  return counts;
}
