// lib/analysis/threatDetector.ts — Pure tactical threat detection (Phase 6)
// Analyzes what the side to move is threatening in the current position.
// Purity rule: Pure function, deterministic, zero React/DOM/fetch imports.

import { Chess, type Square } from 'chess.js';

export interface ThreatInfo {
  from: Square;
  to: Square;
  attackerPiece: string;
  threatenedPiece?: string;
  isCheck: boolean;
  isCapture: boolean;
  weight: number;
}

const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 100,
};

/**
 * Detect tactical threats that the side to move can execute immediately.
 * Returns threats sorted from highest to lowest severity.
 */
export function detectThreats(fen: string): ThreatInfo[] {
  try {
    const chess = new Chess(fen);
    const moves = chess.moves({ verbose: true });
    const threats: ThreatInfo[] = [];

    for (const m of moves) {
      const isCheck = m.san.includes('+') || m.san.includes('#');
      const isCapture = Boolean(m.captured);
      const capturedVal = m.captured ? PIECE_VALUES[m.captured.toLowerCase()] || 0 : 0;
      const attackerVal = PIECE_VALUES[m.piece.toLowerCase()] || 1;

      // Only include captures, checks, or promotions as active threats
      if (isCapture || isCheck || m.promotion) {
        let weight = 0;
        if (isCheck) weight += 15;
        if (isCapture) weight += capturedVal * 2 - (attackerVal > capturedVal ? 1 : 0);
        if (m.promotion) weight += 8;

        threats.push({
          from: m.from,
          to: m.to,
          attackerPiece: m.piece,
          threatenedPiece: m.captured,
          isCheck,
          isCapture,
          weight,
        });
      }
    }

    // Sort threats by descending weight
    return threats.sort((a, b) => b.weight - a.weight);
  } catch {
    return [];
  }
}
