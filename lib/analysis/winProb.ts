// lib/analysis/winProb.ts — Win probability sigmoid and expected points
//
// Exact constants from IMPLEMENTATION_PLAN.md §3.1.
// Pure function — no React, no DOM, no fetch, no Date.now().
//
// CRITICAL: mate scores NEVER pass through the sigmoid.
// #3 → 100%, #-3 → 0%. A mate-to-cp downgrade is a full-magnitude swing.

/**
 * Clamp a number to [lo, hi].
 * Exported for reuse in other analysis modules.
 */
export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

/**
 * Lichess-calibrated sigmoid: centipawns → win% (0–100).
 * `cp` is from the perspective of the player we are scoring.
 *
 * Formula: 50 + 50 * (2 / (1 + exp(-0.00368208 * clamp(cp, -1000, 1000))) - 1)
 */
export function winPercent(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamp(cp, -1000, 1000))) - 1);
}

/**
 * Win% for mate scores. Never pushed through the sigmoid.
 * mateIn > 0 → 100 (we are delivering mate)
 * mateIn < 0 → 0   (we are getting mated)
 * mateIn === 0 → checkmate already happened, context-dependent (treat as 100 for the winner)
 */
export function mateWinPercent(mateIn: number): number {
  return mateIn > 0 ? 100 : 0;
}

/**
 * Expected points (0..1) from centipawns. chess.com's EP model operates in this space.
 */
export function expectedPoints(cp: number): number {
  return winPercent(cp) / 100;
}

/**
 * Win% with explicit mate handling.
 * If mate is non-null, uses mateWinPercent (never the sigmoid).
 * If cp is non-null, uses the sigmoid.
 * Falls back to 50 if both are null.
 */
export function winPercentWithMate(
  cp: number | null,
  mate: number | null,
): number {
  if (mate !== null && mate !== undefined) {
    return mateWinPercent(mate);
  }
  if (cp !== null && cp !== undefined) {
    return winPercent(cp);
  }
  return 50;
}

/**
 * Expected points (0..1) with explicit mate handling.
 * If mate is non-null: 1.0 (delivering mate) or 0.0 (being mated).
 * If cp is non-null: sigmoid-based.
 * Falls back to 0.5 if both are null.
 */
export function expectedPointsWithMate(
  cp: number | null,
  mate: number | null,
): number {
  return winPercentWithMate(cp, mate) / 100;
}

/**
 * Convert engine eval (White's perspective) to the mover's perspective.
 * If moverColor is 'b', negate. If 'w', keep as-is.
 *
 * IMPORTANT: Only call this inside classify(). Storage always uses White's perspective.
 */
export function toMoverPerspective(
  cp: number | null,
  mate: number | null,
  moverColor: 'w' | 'b',
): { cp: number | null; mate: number | null } {
  if (moverColor === 'w') {
    return { cp, mate };
  }
  return {
    cp: cp !== null ? -cp : null,
    mate: mate !== null ? -mate : null,
  };
}
