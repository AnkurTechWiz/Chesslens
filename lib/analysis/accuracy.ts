// lib/analysis/accuracy.ts — Per-move & game accuracy, ACPL, estimated Elo
//
// Exact formulas from IMPLEMENTATION_PLAN.md §3.7.
// Pure function — no React, no DOM, no fetch, no Date.now().

import { clamp } from './winProb';
import type { MoveReport, PhaseAccuracy } from '../types';

/**
 * Per-move accuracy (Lichess formula), on win% scale (0..100).
 *
 * Formula: clamp(103.1668 * exp(-0.04354 * (wpBefore - wpAfter)) - 3.1669, 0, 100)
 *
 * `wpBefore` and `wpAfter` are win percentages from the mover's perspective (0..100).
 * A perfect move (wpBefore === wpAfter) yields ~100.
 * A blunder (large wpBefore - wpAfter) yields near 0.
 */
export function moveAccuracy(wpBefore: number, wpAfter: number): number {
  const wpDrop = wpBefore - wpAfter;
  if (wpDrop <= 0) return 100;
  return clamp(103.1668 * Math.exp(-0.04354 * wpDrop) - 3.1669, 0, 100);
}

/**
 * Arithmetic mean of an array of numbers.
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/**
 * Standard deviation of an array of numbers.
 */
function stdev(values: number[]): number {
  if (values.length <= 1) return 0;
  const m = mean(values);
  let sumSq = 0;
  for (const v of values) sumSq += (v - m) * (v - m);
  return Math.sqrt(sumSq / values.length);
}

/**
 * Harmonic mean of an array of positive numbers.
 * Values ≤ 0 are treated as a small epsilon to avoid division by zero.
 */
function harmonicMean(values: number[]): number {
  if (values.length === 0) return 0;
  const EPS = 5.0;
  let recipSum = 0;
  for (const v of values) {
    recipSum += 1 / Math.max(v, EPS);
  }
  return values.length / recipSum;
}

/**
 * Volatility-weighted mean of move accuracies.
 *
 * Volatility = stdev of win% in a sliding window of ceil(len/10) clamped [2,8].
 * Higher-volatility positions get more weight (they matter more for the game outcome).
 */
function volatilityWeightedMean(
  moveAccuracies: number[],
  winPercentHistory: number[],
): number {
  const n = moveAccuracies.length;
  if (n === 0) return 0;
  if (n === 1) return moveAccuracies[0];

  const windowSize = clamp(Math.ceil(n / 10), 2, 8);

  const weights: number[] = [];
  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(n, start + windowSize);
    const window = winPercentHistory.slice(start, end);
    const vol = stdev(window);
    // Weight = 1 + volatility/50 → more volatile positions count more
    weights.push(1 + vol / 50);
  }

  let weightedSum = 0;
  let totalWeight = 0;
  for (let i = 0; i < n; i++) {
    weightedSum += moveAccuracies[i] * weights[i];
    totalWeight += weights[i];
  }

  return totalWeight > 0 ? weightedSum / totalWeight : mean(moveAccuracies);
}

/**
 * Game accuracy = mean(volatilityWeightedMean(moveAccuracies), harmonicMean(moveAccuracies))
 *
 * From plan §3.7.
 */
export function gameAccuracy(
  moveAccuracies: number[],
  winPercentHistory: number[],
): number {
  if (moveAccuracies.length === 0) return 0;
  const vwm = volatilityWeightedMean(moveAccuracies, winPercentHistory);
  const hm = harmonicMean(moveAccuracies);
  return (vwm + hm) / 2;
}

/**
 * Average centipawn loss, with each per-move loss capped at 1000.
 */
export function acpl(cpLosses: number[]): number {
  if (cpLosses.length === 0) return 0;
  let sum = 0;
  for (const loss of cpLosses) {
    sum += Math.min(Math.abs(loss), 1000);
  }
  return sum / cpLosses.length;
}

export interface EloErrorContext {
  blunders?: number;
  mistakes?: number;
  misses?: number;
  seriousErrors?: number;
}

/**
 * Estimated Elo from accuracy, ACPL, and blunder/mistake rate.
 *
 * Smooth monotone curve anchored to calibration reference points:
 * - accuracy ~66%, ACPL ~90, 2+ serious errors → ~450
 * - accuracy ~75%, ACPL ~55 → ~1000
 * - accuracy ~85%, ACPL ~30 → ~1600
 * - accuracy ~92%, ACPL ~15 → ~2100
 * - accuracy ~97%, ACPL ~8 → ~2500
 *
 * Heavily weights ACPL and error rate so beginner games with blunders are not rated ~1600.
 * Output clamped to [250, 2800].
 * Returns { elo, range } where range is ±150.
 */
export function estimatedElo(
  accuracy: number,
  acplVal: number,
  moveCount: number = 30,
  optionsOrErrors?: number | EloErrorContext,
  _phaseAccuracies?: Partial<PhaseAccuracy>,
): { elo: number; range: number } {
  // ACPL model: exponential drop from 2900 down to 250
  const acplElo = 250 + 2650 * Math.exp(-acplVal / 46);

  // Accuracy model: smooth power curve from 200 up to 2850
  const accNorm = clamp(accuracy / 100, 0, 1);
  const accElo = 200 + 2650 * Math.pow(accNorm, 3.5);

  // Blend: 60% ACPL, 40% accuracy
  const blended = 0.6 * acplElo + 0.4 * accElo;

  // Serious error penalty
  let seriousErrors = 0;
  if (typeof optionsOrErrors === 'number') {
    seriousErrors = optionsOrErrors;
  } else if (optionsOrErrors && typeof optionsOrErrors === 'object') {
    const blunders = optionsOrErrors.blunders ?? 0;
    const mistakes = optionsOrErrors.mistakes ?? 0;
    const misses = optionsOrErrors.misses ?? 0;
    seriousErrors =
      optionsOrErrors.seriousErrors ??
      blunders * 1.0 + mistakes * 0.6 + misses * 0.4;
  }

  // Normalize error count to a standard 30-move game
  const effectiveMoves = Math.max(15, moveCount);
  const normalizedErrors = seriousErrors * (30 / effectiveMoves);
  const errorPenalty = 500 * (1 - Math.exp(-normalizedErrors / 2.8));

  // Clamp output to 250..2800
  const elo = Math.round(clamp(blended - errorPenalty, 250, 2800));

  return { elo, range: 150 };
}

/**
 * Compute per-side accuracy, ACPL, and estimated Elo from a list of MoveReports.
 */
export function computeGameStats(moves: MoveReport[]): {
  accuracy: { white: number; black: number };
  acpl: { white: number; black: number };
  estElo: { white: number; black: number };
} {
  const whiteAccuracies: number[] = [];
  const blackAccuracies: number[] = [];
  const whiteCpLosses: number[] = [];
  const blackCpLosses: number[] = [];
  const whiteWinPercents: number[] = [];
  const blackWinPercents: number[] = [];
  let whiteBlunders = 0;
  let whiteMistakes = 0;
  let whiteMisses = 0;
  let blackBlunders = 0;
  let blackMistakes = 0;
  let blackMisses = 0;

  for (const move of moves) {
    const isWhite = move.ply % 2 === 1;
    if (move.classification === 'blunder') {
      if (isWhite) whiteBlunders++;
      else blackBlunders++;
    } else if (move.classification === 'mistake') {
      if (isWhite) whiteMistakes++;
      else blackMistakes++;
    } else if (move.classification === 'miss') {
      if (isWhite) whiteMisses++;
      else blackMisses++;
    }

    // Skip forced moves for accuracy calculation
    if (move.classification === 'forced') continue;

    const isBook = move.classification === 'book';
    const hasMate = move.mateBefore !== null || move.mateAfter !== null;

    if (isWhite) {
      whiteAccuracies.push(move.accuracy);
      whiteWinPercents.push(move.winBefore);
      // Exclude book moves and forced-mate positions from ACPL; ensure mate is not fed as raw centipawns; cap loss at 1000
      if (!isBook && !hasMate && move.cpBefore !== null && move.cpAfter !== null) {
        whiteCpLosses.push(Math.min(1000, Math.max(0, move.cpBefore - move.cpAfter)));
      }
    } else {
      blackAccuracies.push(move.accuracy);
      blackWinPercents.push(move.winBefore);
      // Exclude book moves and forced-mate positions from ACPL; ensure mate is not fed as raw centipawns; cap loss at 1000
      if (!isBook && !hasMate && move.cpBefore !== null && move.cpAfter !== null) {
        // For Black, cp loss is White's drop negated: move.cpAfter - move.cpBefore
        blackCpLosses.push(Math.min(1000, Math.max(0, move.cpAfter - move.cpBefore)));
      }
    }
  }

  const whiteAcc = gameAccuracy(whiteAccuracies, whiteWinPercents);
  const blackAcc = gameAccuracy(blackAccuracies, blackWinPercents);
  const whiteAcpl = acpl(whiteCpLosses);
  const blackAcpl = acpl(blackCpLosses);

  return {
    accuracy: {
      white: Math.round(whiteAcc * 10) / 10,
      black: Math.round(blackAcc * 10) / 10,
    },
    acpl: {
      white: Math.round(whiteAcpl * 10) / 10,
      black: Math.round(blackAcpl * 10) / 10,
    },
    estElo: {
      white: estimatedElo(whiteAcc, whiteAcpl, whiteAccuracies.length, {
        blunders: whiteBlunders,
        mistakes: whiteMistakes,
        misses: whiteMisses,
      }).elo,
      black: estimatedElo(blackAcc, blackAcpl, blackAccuracies.length, {
        blunders: blackBlunders,
        mistakes: blackMistakes,
        misses: blackMisses,
      }).elo,
    },
  };
}
