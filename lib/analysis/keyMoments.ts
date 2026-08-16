// lib/analysis/keyMoments.ts — Identify key moments in a game
//
// Pure function — no React, no DOM, no fetch, no Date.now().

import type { MoveReport, Classification } from '../types';

/** Classifications that are always key moments. */
const KEY_CLASSIFICATIONS: Set<Classification> = new Set([
  'brilliant',
  'great',
  'blunder',
  'miss',
]);

/**
 * Find the key moments in a game.
 *
 * Key moments are:
 * 1. Brilliant moves
 * 2. Great moves
 * 3. Blunders
 * 4. Misses
 * 5. The biggest eval swings (top N by |epLoss|)
 *
 * @param moves - The move reports for the game
 * @param maxMoments - Maximum number of key moments to return (default 10)
 * @returns Array of ply indices for the key moments, sorted by ply
 */
export function findKeyMoments(moves: MoveReport[], maxMoments = 10): number[] {
  const momentSet = new Set<number>();

  // Add all specially classified moves
  for (const move of moves) {
    if (KEY_CLASSIFICATIONS.has(move.classification)) {
      momentSet.add(move.ply);
    }
  }

  // If we need more, add the biggest eval swings
  if (momentSet.size < maxMoments) {
    const remaining = maxMoments - momentSet.size;
    const swings = moves
      .filter((m) => !momentSet.has(m.ply) && m.classification !== 'forced' && m.classification !== 'book')
      .map((m) => ({ ply: m.ply, swing: Math.abs(m.epLoss) }))
      .sort((a, b) => b.swing - a.swing);

    for (let i = 0; i < Math.min(remaining, swings.length); i++) {
      momentSet.add(swings[i].ply);
    }
  }

  // Return sorted by ply
  return Array.from(momentSet).sort((a, b) => a - b);
}
