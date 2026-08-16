// lib/analysis/classify.ts — Move classification cascade
//
// THE CORE: implements the classification engine from IMPLEMENTATION_PLAN.md §3.3–3.6.
// Pure function — no React, no DOM, no fetch, no Date.now().
//
// Cascade priority (first match wins):
// 1. Forced   : legalMoves.length === 1
// 2. Book     : ply <= bookPlies
// 3. Brilliant: isBrilliant(...)  — all conditions from §3.4
// 4. Great    : isGreat(...)      — only-saving-move OR game-turning from §3.5
// 5. Miss     : isMiss(...)       — conditions from §3.6
// 6. EP-threshold cascade: Best → Excellent → Good → Inaccuracy → Mistake → Blunder

import { Chess } from 'chess.js';
import type {
  Classification,
  MoveContext,
  MoveReport,
  EvalResult,
} from '../types';
import type { ParsedGame } from '../pgn/parse';
import {
  expectedPointsWithMate,
  winPercentWithMate,
  toMoverPerspective,
  clamp,
} from './winProb';
import { moveAccuracy } from './accuracy';
import { isSacrifice } from './sacrifice';
import { isBookMove, getOpeningInfo } from './openingBook';
import { detectMotifs, generateCoachText, type Motif } from './tactics';
import { detectPhase } from './phases';

// ── Leniency ─────────────────────────────────────────────────────────────────

/**
 * Rating-adaptive leniency from §3.2.
 * Lower-rated players get more generous thresholds.
 *
 * Formula: clamp(1.6 - rating / 2500, 1.0, 1.6)
 */
export function leniency(rating: number = 1500): number {
  return clamp(1.6 - rating / 2500, 1.0, 1.6);
}

// ── EP-threshold classification ──────────────────────────────────────────────

/** Raw EP-loss thresholds from §3.2 (before leniency scaling). */
const EP_THRESHOLDS = {
  excellent: 0.02,
  good: 0.05,
  inaccuracy: 0.10,
  mistake: 0.20,
  // blunder: > 0.20
} as const;

function epThresholdClassify(epLoss: number, rating: number): Classification {
  const len = leniency(rating);

  if (epLoss <= EP_THRESHOLDS.excellent * len) return 'excellent';
  if (epLoss <= EP_THRESHOLDS.good * len) return 'good';
  if (epLoss <= EP_THRESHOLDS.inaccuracy * len) return 'inaccuracy';
  if (epLoss <= EP_THRESHOLDS.mistake * len) return 'mistake';
  return 'blunder';
}

// ── Brilliant detection (§3.4) ───────────────────────────────────────────────

function isBrilliantCheck(ctx: MoveContext): boolean {
  // Condition 0: must be re-verified at deep search (depth >= 20)
  if (ctx.depth < 20) return false;

  // Condition 4: not forced (legalMoveCount > 1)
  if (ctx.legalMoveCount <= 1) return false;

  const isBest = ctx.uci === ctx.bestUci;
  const epBefore = expectedPointsWithMate(ctx.cpBefore, ctx.mateBefore);
  const epAfter = expectedPointsWithMate(ctx.cpAfter, ctx.mateAfter);
  const epLoss = Math.max(0, epBefore - epAfter);

  // Condition 2: played move is engine best (uci === bestUci) or epLoss <= 0.02
  if (!isBest && epLoss > 0.02) return false;

  // Condition 3: reject if already completely winning (epBefore > 0.97)
  if (epBefore > 0.97) return false;

  // Condition 5: not losing by your own choice: epAfter >= 0.50 OR (uci === bestUci AND epAfter >= epBefore - 0.02)
  // That last OR is required when the engine's absolute eval is horizon-wrong but it still picks the sac as best.
  const notLosingByChoice = epAfter >= 0.50 || (isBest && epAfter >= epBefore - 0.02);
  if (!notLosingByChoice) return false;

  // Condition 1: the move sacrifices material (SEE <= -1.5, not a pawn, not a trivial recapture)
  const sac = isSacrifice(
    ctx.fenBefore,
    ctx.uci,
    ctx.fenAfter,
    ctx.moverColor,
    ctx.playerRating,
  );
  if (!sac) return false;

  return true;
}

// ── Great detection (§3.5) ───────────────────────────────────────────────────

function isGreatCheck(ctx: MoveContext): boolean {
  // Must be verified at deep search (depth >= 18) per §3.5
  if (ctx.depth < 18) return false;

  const epBefore = expectedPointsWithMate(ctx.cpBefore, ctx.mateBefore);
  const epAfter = expectedPointsWithMate(ctx.cpAfter, ctx.mateAfter);
  const epLoss = Math.max(0, epBefore - epAfter);

  // Must be best/near-best
  if (epLoss > 0.02) return false;

  // Punishing opponent's blunder/mistake is simply BEST, not Great
  const prevWasBlunder =
    ctx.prevClassification === 'mistake' ||
    ctx.prevClassification === 'blunder';
  if (prevWasBlunder) {
    return false;
  }

  const bestEp = expectedPointsWithMate(ctx.bestCp, ctx.bestMate);

  // Condition A: Only-move — second-best is genuinely much worse (gap >= 0.10 EP)
  if (ctx.altUci && (ctx.altCp !== null || ctx.altMate !== null)) {
    const altEp = expectedPointsWithMate(ctx.altCp, ctx.altMate);
    if (bestEp - altEp >= 0.10) return true;
  }

  // Condition B: Game-turning — flips assessment across critical boundary
  // Saved a lost position: epBefore < 0.5 && epAfter >= 0.5
  // or broke through to dominating: epBefore < 0.75 && epAfter >= 0.90
  const isGameTurning =
    (epBefore < 0.50 && epAfter >= 0.50) ||
    (epBefore < 0.75 && epAfter >= 0.90);

  if (isGameTurning) {
    // Must not be an ordinary recapture/trade where alternatives also held
    if (ctx.altUci && (ctx.altCp !== null || ctx.altMate !== null)) {
      const altEp = expectedPointsWithMate(ctx.altCp, ctx.altMate);
      if (bestEp - altEp >= 0.05) {
        return true;
      }
    } else {
      return true;
    }
  }

  return false;
}

// ── Miss detection (§3.6) ────────────────────────────────────────────────────

function isMissCheck(ctx: MoveContext): boolean {
  // Never fire on consecutive plies
  if (ctx.prevClassification === 'miss') return false;

  const epBefore = expectedPointsWithMate(ctx.cpBefore, ctx.mateBefore);
  const epAfter = expectedPointsWithMate(ctx.cpAfter, ctx.mateAfter);

  // Miss must never fire while still winning. Require epAfter < 0.75.
  if (epAfter >= 0.75) return false;

  // Cannot miss if already completely lost before the move
  if (epBefore <= 0.03) return false;

  const prevWasBad =
    ctx.prevClassification === 'mistake' ||
    ctx.prevClassification === 'blunder';
  const bestIsMate = ctx.bestMate !== null && ctx.bestMate > 0;

  // 1. Only fire when opponent just made a mistake/blunder OR mate-in-N was available
  if (!prevWasBad && !bestIsMate) return false;

  const epLoss = Math.max(0, epBefore - epAfter);
  const len = leniency(ctx.playerRating);

  const mateDropped =
    bestIsMate &&
    (ctx.mateAfter === null || ctx.mateAfter <= 0);
  const dropSignificant = epLoss >= 0.10 * len;

  if (!dropSignificant && !mateDropped) return false;

  return true;
}

// ── Main classification cascade ──────────────────────────────────────────────

/**
 * Classify a single move using the priority cascade from §3.3.
 *
 * All eval values in ctx must be in the mover's perspective.
 */
export function classifyMove(ctx: MoveContext): Classification {
  // 1. Forced: only 1 legal move
  if (ctx.legalMoveCount === 1) {
    return 'forced';
  }

  // 2. Book: ply within book — mask any other label
  if (isBookMove(ctx.ply, ctx.bookPlies)) {
    return 'book';
  }

  const epBefore = expectedPointsWithMate(ctx.cpBefore, ctx.mateBefore);
  const epAfter = expectedPointsWithMate(ctx.cpAfter, ctx.mateAfter);
  const epLoss = Math.max(0, epBefore - epAfter);

  // 3. Brilliant
  if (isBrilliantCheck(ctx)) {
    return 'brilliant';
  }

  // 4. Great
  if (isGreatCheck(ctx)) {
    return 'great';
  }

  // 5. Miss
  if (isMissCheck(ctx)) {
    return 'miss';
  }

  // 6. EP-threshold cascade
  let label: Classification;
  if (ctx.uci === ctx.bestUci) {
    label = 'best';
  } else {
    label = epThresholdClassify(epLoss, ctx.playerRating);
  }

  // ── Decided-Position Guards ──────────────────────────────────────────────
  // Guard A: If player was already completely lost (epBefore <= 0.03), cap worst label at 'inaccuracy'.
  // You cannot blunder a game that is already lost.
  if (epBefore <= 0.03) {
    if (label === 'blunder' || label === 'mistake' || label === 'miss') {
      label = 'inaccuracy';
    }
  }

  // Guard B: If player was completely winning (epBefore >= 0.97) and is still completely winning (epAfter >= 0.90),
  // cap worst label at 'good'. A slower mate is not a blunder.
  if (epBefore >= 0.97 && epAfter >= 0.90) {
    if (label === 'inaccuracy' || label === 'mistake' || label === 'blunder' || label === 'miss') {
      label = 'good';
    }
  }

  return label;
}

// ── Full game classification ─────────────────────────────────────────────────

/**
 * Classify all moves in a game, producing MoveReport[].
 *
 * @param game - Parsed PGN game
 * @param evalMap - Map from FEN → EvalResult[] (multipv sorted)
 * @param playerRating - Rating for leniency
 * @returns Array of MoveReport, one per ply
 */
export function classifyGame(
  game: ParsedGame,
  evalMap: Map<string, EvalResult[]>,
  playerRating: number = 1500,
): MoveReport[] {
  const reports: MoveReport[] = [];

  // Get opening info for book detection
  const movesUci = game.moves.map((m) => m.uci);
  const openingInfo = getOpeningInfo(movesUci);

  let prevClassification: Classification | null = null;

  for (const move of game.moves) {
    const moverColor = move.color;
    const fen = move.fenBefore;

    // Get eval for position before this move
    const posEvals = evalMap.get(fen) ?? [];
    const pv1 = posEvals.find((e) => e.multipv === 1);
    const pv2 = posEvals.find((e) => e.multipv === 2);

    // Get eval for position after this move
    const afterEvals = evalMap.get(move.fenAfter) ?? [];
    const afterPv1 = afterEvals.find((e) => e.multipv === 1);

    // Convert evals from White's perspective to mover's perspective
    const before = toMoverPerspective(
      pv1?.cp ?? null,
      pv1?.mate ?? null,
      moverColor,
    );
    const after = toMoverPerspective(
      afterPv1?.cp ?? null,
      afterPv1?.mate ?? null,
      // After the move, it's the opponent's turn — but the eval we have is
      // from White's perspective. We want the eval FROM THE MOVER's perspective
      // (how good is the position for the person who just moved).
      // If mover was White, the after-eval is from Black-to-move → negate to get White's view (= mover's view)
      // If mover was Black, the after-eval is from White-to-move → keep as-is, then negate for Black's view
      // Actually: the after-eval is ALREADY from White's perspective in storage.
      // We want it from the MOVER's perspective. So:
      // If mover is White: mover's view = White's view = no flip
      // If mover is Black: mover's view = negate White's view
      moverColor,
    );

    // Best move from PV1: convert to mover's perspective
    const bestMover = toMoverPerspective(
      pv1?.cp ?? null,
      pv1?.mate ?? null,
      moverColor,
    );

    // Alt move from PV2
    const altMover = toMoverPerspective(
      pv2?.cp ?? null,
      pv2?.mate ?? null,
      moverColor,
    );

    // Determine best move SAN — try to get it from PV1
    const bestUci = pv1?.pv?.[0] ?? move.uci;
    let bestSan = '';
    try {
      const chess = new Chess(fen);
      const bestMove = chess.move({
        from: bestUci.slice(0, 2),
        to: bestUci.slice(2, 4),
        promotion: bestUci.length > 4 ? bestUci[4] as 'q' | 'r' | 'b' | 'n' : undefined,
      });
      bestSan = bestMove?.san ?? bestUci;
    } catch {
      bestSan = bestUci;
    }

    // Count legal moves
    let legalMoveCount: number;
    try {
      const chess = new Chess(fen);
      legalMoveCount = chess.moves().length;
    } catch {
      legalMoveCount = 20;
    }

    // Alt SAN
    const altUci = pv2?.pv?.[0] ?? '';
    let altSan = '';
    if (altUci) {
      try {
        const chess = new Chess(fen);
        const altMove = chess.move({
          from: altUci.slice(0, 2),
          to: altUci.slice(2, 4),
          promotion: altUci.length > 4 ? altUci[4] as 'q' | 'r' | 'b' | 'n' : undefined,
        });
        altSan = altMove?.san ?? altUci;
      } catch {
        altSan = altUci;
      }
    }

    // Build MoveContext
    const ctx: MoveContext = {
      ply: move.ply,
      san: move.san,
      uci: move.uci,
      fenBefore: move.fenBefore,
      fenAfter: move.fenAfter,
      moverColor,
      legalMoveCount,
      cpBefore: before.cp,
      mateBefore: before.mate,
      cpAfter: after.cp,
      mateAfter: after.mate,
      bestUci,
      bestSan,
      bestCp: bestMover.cp,
      bestMate: bestMover.mate,
      bestPv: pv1?.pv ?? [],
      altCp: altMover.cp,
      altMate: altMover.mate,
      altUci,
      altSan,
      bookPlies: openingInfo.bookPlies,
      prevClassification,
      playerRating,
      clockMs: move.clockMs,
      timeSpentMs: move.timeSpentMs,
      depth: pv1?.depth ?? 12,
    };

    // Classify
    const classification = classifyMove(ctx);

    // Compute accuracy
    const wpBefore = winPercentWithMate(before.cp, before.mate);
    const wpAfter = winPercentWithMate(after.cp, after.mate);
    const acc = moveAccuracy(wpBefore, wpAfter);

    // EP loss
    const epBefore = expectedPointsWithMate(before.cp, before.mate);
    const epAfter = expectedPointsWithMate(after.cp, after.mate);
    const epLoss = Math.max(0, epBefore - epAfter);

    // Detect phase for coach text
    const phase = detectPhase(move.fenBefore, openingInfo.bookPlies, move.ply);

    // Detect motifs
    const motifs = detectMotifs({
      fenBefore: move.fenBefore,
      fenAfter: move.fenAfter,
      moverColor,
      classification,
      bestUci,
      bestPv: pv1?.pv ?? [],
      playedUci: move.uci,
      bestCp: bestMover.cp,
      bestMate: bestMover.mate,
      playedCp: after.cp,
      playedMate: after.mate,
      clockMs: move.clockMs,
    });

    // Generate coach text
    const comment = generateCoachText({
      classification,
      motifs: motifs as Motif[],
      san: move.san,
      bestSan,
      bestPv: pv1?.pv ?? [],
      phase,
      epLoss,
      mateBefore: before.mate,
      mateAfter: after.mate,
      bestMate: bestMover.mate,
    });

    const report: MoveReport = {
      ply: move.ply,
      san: move.san,
      uci: move.uci,
      fenBefore: move.fenBefore,
      fenAfter: move.fenAfter,
      cpBefore: pv1?.cp ?? null,       // Store in White's perspective
      mateBefore: pv1?.mate ?? null,   // Store in White's perspective
      cpAfter: afterPv1?.cp ?? null,   // Store in White's perspective
      mateAfter: afterPv1?.mate ?? null,
      winBefore: wpBefore,
      winAfter: wpAfter,
      epLoss,
      classification,
      best: {
        uci: bestUci,
        san: bestSan,
        cp: pv1?.cp ?? null,
        mate: pv1?.mate ?? null,
        pv: pv1?.pv ?? [],
      },
      alt: pv2
        ? {
            uci: altUci,
            san: altSan,
            cp: pv2.cp,
            mate: pv2.mate,
          }
        : undefined,
      motifs: motifs as string[],
      accuracy: acc,
      clockMs: move.clockMs,
      timeSpentMs: move.timeSpentMs,
      comment,
      depth: pv1?.depth ?? 12,
    };

    reports.push(report);
    prevClassification = classification;
  }

  return reports;
}
