// lib/analysis/sacrifice.ts — Static Exchange Evaluation (SEE) + hanging detection
//
// From IMPLEMENTATION_PLAN.md §3.4.
// Pure function — no React, no DOM, no fetch, no Date.now().
//
// Uses chess.js for board state parsing only.

import { Chess, type PieceSymbol, type Color } from 'chess.js';

/** Standard piece values in pawn units for SEE calculations. */
const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 100, // Effectively infinite — king captures are allowed in SEE but it's never "worth" trading
};

// ── Geometry-based attack detection (turn-independent) ───────────────────────

const FILES = 'abcdefgh';
const RANKS = '12345678';

function sqToCoord(sq: string): [number, number] {
  return [FILES.indexOf(sq[0]), RANKS.indexOf(sq[1])];
}

function coordToSq(file: number, rank: number): string | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return FILES[file] + RANKS[rank];
}

interface BoardPiece {
  type: PieceSymbol;
  color: Color;
  square: string;
}

function readBoard(fen: string): Map<string, BoardPiece> {
  const chess = new Chess(fen);
  const board = chess.board();
  const map = new Map<string, BoardPiece>();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (p) {
        map.set(p.square, { type: p.type, color: p.color, square: p.square });
      }
    }
  }
  return map;
}

/**
 * Find all pieces of `color` that can attack `targetSq` on the given board.
 * This is turn-independent — it works regardless of whose move it is.
 */
function findAttackers(
  boardMap: Map<string, BoardPiece>,
  targetSq: string,
  color: Color,
): BoardPiece[] {
  const [tf, tr] = sqToCoord(targetSq);
  const attackers: BoardPiece[] = [];

  for (const piece of boardMap.values()) {
    if (piece.color !== color) continue;
    const [pf, pr] = sqToCoord(piece.square);

    switch (piece.type) {
      case 'p': {
        // Pawns attack diagonally forward
        const dir = color === 'w' ? 1 : -1;
        if (pr + dir === tr && Math.abs(pf - tf) === 1) {
          attackers.push(piece);
        }
        break;
      }
      case 'n': {
        const df = Math.abs(pf - tf);
        const dr = Math.abs(pr - tr);
        if ((df === 1 && dr === 2) || (df === 2 && dr === 1)) {
          attackers.push(piece);
        }
        break;
      }
      case 'b': {
        if (Math.abs(pf - tf) === Math.abs(pr - tr) && pf !== tf) {
          if (isPathClear(boardMap, pf, pr, tf, tr)) {
            attackers.push(piece);
          }
        }
        break;
      }
      case 'r': {
        if ((pf === tf || pr === tr) && (pf !== tf || pr !== tr)) {
          if (isPathClear(boardMap, pf, pr, tf, tr)) {
            attackers.push(piece);
          }
        }
        break;
      }
      case 'q': {
        const isDiag = Math.abs(pf - tf) === Math.abs(pr - tr) && pf !== tf;
        const isStraight = (pf === tf || pr === tr) && (pf !== tf || pr !== tr);
        if (isDiag || isStraight) {
          if (isPathClear(boardMap, pf, pr, tf, tr)) {
            attackers.push(piece);
          }
        }
        break;
      }
      case 'k': {
        if (Math.abs(pf - tf) <= 1 && Math.abs(pr - tr) <= 1 && (pf !== tf || pr !== tr)) {
          attackers.push(piece);
        }
        break;
      }
    }
  }

  // Sort by piece value ascending (cheapest attacker first — SEE always uses LVA)
  attackers.sort((a, b) => PIECE_VALUES[a.type] - PIECE_VALUES[b.type]);
  return attackers;
}

function isPathClear(
  boardMap: Map<string, BoardPiece>,
  fromFile: number,
  fromRank: number,
  toFile: number,
  toRank: number,
): boolean {
  const df = Math.sign(toFile - fromFile);
  const dr = Math.sign(toRank - fromRank);
  let f = fromFile + df;
  let r = fromRank + dr;
  while (f !== toFile || r !== toRank) {
    const sq = coordToSq(f, r);
    if (sq && boardMap.has(sq)) return false;
    f += df;
    r += dr;
  }
  return true;
}

// ── SEE Algorithm ────────────────────────────────────────────────────────────

/**
 * Static Exchange Evaluation (SEE) for a capture on `toSquare`.
 *
 * Evaluates the sequence of captures on a single square, always using
 * the least valuable attacker. Returns the material balance in pawn units
 * from the perspective of the side that initiates the capture sequence.
 *
 * This implementation is turn-independent (works regardless of FEN side-to-move).
 *
 * @param fen - Board position in FEN
 * @param toSquare - The square where captures happen
 * @param initiatingSide - The side that starts the capture exchange
 * @returns Material balance in pawn units (positive = good for initiator)
 */
export function see(fen: string, toSquare: string, initiatingSide: 'w' | 'b'): number {
  const boardMap = readBoard(fen);
  const sq = toSquare;
  const targetPiece = boardMap.get(sq);

  if (!targetPiece) {
    return 0; // No piece on square
  }

  // Can't capture your own piece
  if (targetPiece.color === initiatingSide) {
    return 0;
  }

  // Build the gain array using the standard SEE minimax approach
  const gains: number[] = [];
  let sideToCapture: Color = initiatingSide;

  // Piece currently sitting on the target square
  let currentVictimValue = PIECE_VALUES[targetPiece.type];

  // Simulate exchanges using a mutable copy of the board
  const simBoard = new Map(boardMap);

  const maxDepth = 32;
  for (let depth = 0; depth < maxDepth; depth++) {
    // Check for attackers BEFORE adding gain — if no attacker can reach
    // the square, the capture never happens and SEE is 0 (for depth 0)
    // or the exchange stops (for deeper depths).
    const attackers = findAttackers(simBoard, sq, sideToCapture);
    if (attackers.length === 0) break;

    gains.push(currentVictimValue);

    const attacker = attackers[0]; // LVA

    // King can't capture if the other side still has attackers
    if (attacker.type === 'k') {
      const otherSide: Color = sideToCapture === 'w' ? 'b' : 'w';
      const defAttackers = findAttackers(simBoard, sq, otherSide);
      // Filter out the piece that's currently on sq (it was just captured conceptually)
      const realDefenders = defAttackers.filter((a) => a.square !== sq);
      if (realDefenders.length > 0) {
        break; // King can't walk into defended square
      }
    }

    // The new victim is the attacker (which is now on the square)
    currentVictimValue = PIECE_VALUES[attacker.type];

    // Remove the attacker from its original square
    simBoard.delete(attacker.square);
    // Update the piece on the target square to be the attacker
    simBoard.delete(sq);
    simBoard.set(sq, { ...attacker, square: sq });

    // Switch sides
    sideToCapture = sideToCapture === 'w' ? 'b' : 'w';
  }

  // If no attacker could reach the square, the capture never happens
  if (gains.length === 0) {
    return 0;
  }

  // Minimax the gain array from the back
  // gains[i] represents the value of the piece that can be captured at depth i
  // We compute the net gain using negamax:
  // At each depth, the capturing side gains the victim but might lose its attacker
  // to a recapture, so it only captures if the net is positive.
  for (let i = gains.length - 1; i > 0; i--) {
    gains[i - 1] = Math.min(gains[i - 1], gains[i - 1] - gains[i]);
  }

  return gains[0];
}

// ── Hanging material ─────────────────────────────────────────────────────────

/**
 * Detect hanging material after a move.
 *
 * Checks all pieces of the mover that can be captured by the opponent
 * at a material profit. Returns the worst-case loss (negative = hanging).
 */
export function hangingMaterialAfter(fenAfter: string, mover: 'w' | 'b'): number {
  const boardMap = readBoard(fenAfter);
  const opponent: Color = mover === 'w' ? 'b' : 'w';

  let worstHanging = 0;

  for (const piece of boardMap.values()) {
    if (piece.color !== mover) continue;
    if (piece.type === 'k') continue;

    const seeValue = see(fenAfter, piece.square, opponent);
    if (seeValue > 0) {
      const loss = -seeValue;
      if (loss < worstHanging) {
        worstHanging = loss;
      }
    }
  }

  return worstHanging;
}

// ── Sacrifice detection ──────────────────────────────────────────────────────

/**
 * Check if a move qualifies as a sacrifice per §3.4 condition (2).
 *
 * A sacrifice requires:
 * - A piece (value ≥ 3) is capturable at a static loss after the move,
 *   with SEE ≤ -1.5 pawn units (or ≤ -1.0 for ratings < 1200)
 * - OR the move itself is a capture that loses material by SEE
 * - OR it leaves a hanging piece the opponent can win
 */
export function isSacrifice(
  fenBefore: string,
  moveUci: string,
  fenAfter: string,
  mover: 'w' | 'b',
  _playerRating?: number,
): boolean {
  const fromSquare = moveUci.slice(0, 2);
  const toSquare = moveUci.slice(2, 4);

  const beforeBoard = readBoard(fenBefore);
  const afterBoard = readBoard(fenAfter);
  const opponent: Color = mover === 'w' ? 'b' : 'w';

  // The piece moved by the player
  const movedPiece = beforeBoard.get(fromSquare);

  // Helper: check if opponent has a hanging piece of equal/greater value that mover can immediately recapture
  const hasEqualOrGreaterRecapture = (sacrificedValue: number): boolean => {
    for (const oppPiece of afterBoard.values()) {
      if (oppPiece.color !== opponent) continue;
      if (oppPiece.type === 'k') continue;
      const val = PIECE_VALUES[oppPiece.type];
      if (val >= sacrificedValue) {
        // Can mover capture this opponent piece profitably in fenAfter?
        const seeCap = see(fenAfter, oppPiece.square, mover);
        if (seeCap > 0) return true;
      }
    }
    return false;
  };

  // Case 1: The move itself is a capture where the captured piece has lower value than the attacker,
  // giving a negative SEE <= -1.0 (e.g. Minor piece captures defended pawn SEE = -1, or Rook captures pawn SEE = -4)
  const targetPiece = beforeBoard.get(toSquare);
  if (targetPiece && targetPiece.color !== mover && movedPiece) {
    const movedVal = PIECE_VALUES[movedPiece.type];
    if (movedVal >= 3) {
      const captureValue = see(fenBefore, toSquare, mover);
      if (captureValue <= -1.0) {
        if (!hasEqualOrGreaterRecapture(Math.abs(captureValue))) {
          return true;
        }
      }
    }
  }

  // Case 2: The move is NOT a capture and places a piece (value >= 3) on an attacked square where opponent can capture at static profit (SEE >= 1.0)
  if (!targetPiece && movedPiece && PIECE_VALUES[movedPiece.type] >= 3) {
    const seeLoss = see(fenAfter, toSquare, opponent);
    if (seeLoss >= 1.0) {
      if (!hasEqualOrGreaterRecapture(seeLoss)) {
        return true;
      }
    }
  }

  // Case 3: The move un-shields/leaves a piece (value >= 3) hanging that was NOT already hanging in fenBefore
  for (const piece of afterBoard.values()) {
    if (piece.color !== mover) continue;
    if (piece.type === 'k' || piece.type === 'p') continue;
    if (piece.square === toSquare) continue;

    const seeAfter = see(fenAfter, piece.square, opponent);
    if (seeAfter >= 1.5) {
      // Must NOT have been already hanging before the move!
      const seeBefore = see(fenBefore, piece.square, opponent);
      if (seeBefore < 1.0) {
        if (!hasEqualOrGreaterRecapture(seeAfter)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Get the value of a piece in pawn units.
 * Exported for use by other modules.
 */
export function pieceValue(piece: PieceSymbol): number {
  return piece === 'k' ? 0 : PIECE_VALUES[piece];
}
