// lib/analysis/phases.ts — Game phase detection
//
// From IMPLEMENTATION_PLAN.md §3.7.
// Pure function — no React, no DOM, no fetch, no Date.now().

import { Chess, type PieceSymbol } from 'chess.js';
import type { MoveReport, PhaseAccuracy } from '../types';

export type GamePhase = 'opening' | 'middlegame' | 'endgame';

/** Standard piece values for material counting. */
const NON_PAWN_VALUES: Record<PieceSymbol, number> = {
  p: 0, // Pawns don't count as "non-pawn material"
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0, // King doesn't count
};

/**
 * Count total non-pawn material on the board.
 */
function totalNonPawnMaterial(fen: string): number {
  const chess = new Chess(fen);
  const board = chess.board();
  let total = 0;

  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (piece) {
        total += NON_PAWN_VALUES[piece.type];
      }
    }
  }

  return total;
}

/**
 * Count total pieces on the board (excluding kings).
 */
function totalPieces(fen: string): number {
  const chess = new Chess(fen);
  const board = chess.board();
  let count = 0;

  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (piece && piece.type !== 'k') {
        count++;
      }
    }
  }

  return count;
}

/**
 * Detect the game phase for a given position.
 *
 * From §3.7:
 * - opening = ply <= bookPlies + 2
 * - endgame = total non-pawn material ≤ 13 OR ≤ 6 pieces
 * - middlegame = everything else
 */
export function detectPhase(fen: string, bookPlies: number, ply: number): GamePhase {
  if (ply <= bookPlies + 2) {
    return 'opening';
  }

  const nonPawnMat = totalNonPawnMaterial(fen);
  const pieces = totalPieces(fen);

  if (nonPawnMat <= 13 || pieces <= 6) {
    return 'endgame';
  }

  return 'middlegame';
}

/**
 * Split move reports into game phases.
 */
export function splitByPhase(
  moves: MoveReport[],
  bookPlies: number,
): { opening: MoveReport[]; middlegame: MoveReport[]; endgame: MoveReport[] } {
  const opening: MoveReport[] = [];
  const middlegame: MoveReport[] = [];
  const endgame: MoveReport[] = [];

  for (const move of moves) {
    const phase = detectPhase(move.fenBefore, bookPlies, move.ply);
    switch (phase) {
      case 'opening':
        opening.push(move);
        break;
      case 'middlegame':
        middlegame.push(move);
        break;
      case 'endgame':
        endgame.push(move);
        break;
    }
  }

  return { opening, middlegame, endgame };
}

/**
 * Compute accuracy by phase for each side.
 */
export function computePhaseAccuracies(
  moves: MoveReport[],
  bookPlies: number,
): PhaseAccuracy {
  const { opening, middlegame, endgame } = splitByPhase(moves, bookPlies);

  const phaseAccForSide = (phaseMoves: MoveReport[], isWhite: boolean): number => {
    const accuracies = phaseMoves
      .filter((m) => {
        const isW = m.ply % 2 === 1;
        return isW === isWhite && m.classification !== 'forced';
      })
      .map((m) => m.accuracy);

    if (accuracies.length === 0) return 100;
    return accuracies.reduce((sum, a) => sum + a, 0) / accuracies.length;
  };

  return {
    opening: {
      white: Math.round(phaseAccForSide(opening, true) * 10) / 10,
      black: Math.round(phaseAccForSide(opening, false) * 10) / 10,
    },
    middlegame: {
      white: Math.round(phaseAccForSide(middlegame, true) * 10) / 10,
      black: Math.round(phaseAccForSide(middlegame, false) * 10) / 10,
    },
    endgame: {
      white: Math.round(phaseAccForSide(endgame, true) * 10) / 10,
      black: Math.round(phaseAccForSide(endgame, false) * 10) / 10,
    },
  };
}
