// lib/analysis/openingBook.ts — ECO/book detection from bundled compact dataset
//
// From IMPLEMENTATION_PLAN.md §3.3 (Book check).
// Pure function — no React, no DOM, no fetch, no Date.now().
//
// The ECO data is lazy-loaded from a compact JSON file.

import type { OpeningInfo } from '../types';

interface EcoEntry {
  eco: string;
  name: string;
  uci: string; // space-separated UCI moves
}

let ecoData: EcoEntry[] | null = null;

/**
 * Lazy-load the ECO opening book data.
 * Returns the parsed entries. Subsequent calls return cached data.
 */
export function loadOpeningBook(): EcoEntry[] {
  if (ecoData) return ecoData;

  // Dynamic import workaround for JSON: we use require-style for Vitest/Node
  // and rely on resolveJsonModule + bundler for production.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const data = require('./data/eco.json') as EcoEntry[];
  ecoData = data;
  return ecoData;
}

/**
 * Reset the cached opening book (for testing).
 */
export function resetOpeningBook(): void {
  ecoData = null;
}

/**
 * Look up the opening for a game given its UCI move sequence.
 *
 * Finds the longest matching prefix in the ECO database.
 * Returns the ECO code, opening name, and how many plies are "in book".
 *
 * @param movesUci - Array of UCI moves from the start of the game (e.g. ["e2e4", "e7e5", ...])
 * @returns Opening info or null if no match found
 */
export function lookupOpening(movesUci: string[]): OpeningInfo | null {
  const book = loadOpeningBook();
  if (movesUci.length === 0) return null;

  let bestMatch: { eco: string; name: string; bookPlies: number } | null = null;

  for (const entry of book) {
    const entryMoves = entry.uci.split(' ');
    const entryLength = entryMoves.length;

    // Skip entries longer than the game
    if (entryLength > movesUci.length) continue;

    // Check if all entry moves match the game moves at the same positions
    let matches = true;
    for (let i = 0; i < entryLength; i++) {
      if (entryMoves[i] !== movesUci[i]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      // Keep the longest match
      if (!bestMatch || entryLength > bestMatch.bookPlies) {
        bestMatch = {
          eco: entry.eco,
          name: entry.name,
          bookPlies: entryLength,
        };
      }
    }
  }

  return bestMatch;
}

/**
 * Check if a specific ply is within recognized opening theory.
 *
 * @param ply - 1-based ply number
 * @param bookPlies - Number of plies that are in book (from lookupOpening)
 * @returns true if this ply is a book move
 */
export function isBookMove(ply: number, bookPlies: number): boolean {
  return ply >= 1 && ply <= bookPlies;
}

/**
 * Get opening info for a game, with a default fallback.
 *
 * @param movesUci - Array of UCI moves from the start
 * @returns OpeningInfo with eco, name, and bookPlies
 */
export function getOpeningInfo(movesUci: string[]): OpeningInfo {
  const result = lookupOpening(movesUci);
  if (result) {
    return result;
  }
  return {
    eco: '',
    name: 'Unknown Opening',
    bookPlies: 0,
  };
}
