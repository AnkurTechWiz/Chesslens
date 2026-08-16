// lib/analysis/tactics.ts — Motif tagging + rule-based coach-text templates
//
// From IMPLEMENTATION_PLAN.md §3.8.
// Pure function — no React, no DOM, no fetch, no Date.now().
// This is the ONLY coach text source; it works offline with no API key.

import { Chess, type Square, type Color } from 'chess.js';
import type { Classification } from '../types';
import { pieceValue } from './sacrifice';
import type { GamePhase } from './phases';

// ── Motif types ──────────────────────────────────────────────────────────────

export type Motif =
  | 'hanging_piece'
  | 'fork'
  | 'pin'
  | 'skewer'
  | 'discovered_attack'
  | 'back_rank'
  | 'missed_mate'
  | 'allowed_mate'
  | 'pawn_structure_damage'
  | 'overloaded_defender'
  | 'trapped_piece'
  | 'lost_castling_safety'
  | 'traded_into_bad_endgame'
  | 'time_pressure';

// ── Motif detection input ────────────────────────────────────────────────────

export interface MotifInput {
  fenBefore: string;
  fenAfter: string;
  moverColor: 'w' | 'b';
  classification: Classification;
  bestUci: string;
  bestPv: string[];
  playedUci: string;
  bestCp: number | null;
  bestMate: number | null;
  playedCp: number | null;
  playedMate: number | null;
  clockMs?: number;
  prevClockMs?: number;
}

// ── Motif detection ──────────────────────────────────────────────────────────

/**
 * Detect tactical motifs for a move.
 *
 * Uses light heuristics on the position and best PV to tag why a mistake/miss/blunder
 * happened, or what makes a move brilliant/great.
 */
export function detectMotifs(input: MotifInput): Motif[] {
  const motifs: Motif[] = [];
  const { fenBefore, fenAfter, moverColor, classification, bestUci, bestMate, playedMate, bestPv, clockMs } = input;

  const isError = classification === 'mistake' || classification === 'miss' || classification === 'blunder';

  // ── Missed mate ──
  if (bestMate !== null && bestMate > 0 && (playedMate === null || playedMate <= 0)) {
    motifs.push('missed_mate');
  }

  // ── Allowed mate ──
  if (playedMate !== null && playedMate < 0 && (bestMate === null || bestMate >= 0)) {
    motifs.push('allowed_mate');
  }

  // ── Hanging piece ──
  if (isError) {
    const hanging = detectHangingPiece(fenBefore, fenAfter, moverColor, bestUci);
    if (hanging) {
      motifs.push('hanging_piece');
    }
  }

  // ── Fork detection ──
  if (bestPv.length > 0) {
    const fork = detectFork(fenBefore, bestUci, moverColor);
    if (fork) {
      motifs.push('fork');
    }
  }

  // ── Back rank ──
  if (bestMate !== null && bestMate > 0 && bestMate <= 5) {
    const backRank = detectBackRank(fenBefore, bestUci, moverColor);
    if (backRank) {
      motifs.push('back_rank');
    }
  }

  // ── Time pressure ──
  if (clockMs !== undefined && clockMs < 30000) {
    motifs.push('time_pressure');
  }

  // ── Lost castling safety ──
  if (isError) {
    const castlingSafety = detectLostCastlingSafety(fenBefore, fenAfter, moverColor);
    if (castlingSafety) {
      motifs.push('lost_castling_safety');
    }
  }

  return motifs;
}

// ── Heuristic helpers ────────────────────────────────────────────────────────

function detectHangingPiece(
  fenBefore: string,
  fenAfter: string,
  moverColor: 'w' | 'b',
  bestUci: string,
): boolean {
  try {
    // Check if the best move was a capture of a high-value piece
    const chess = new Chess(fenBefore);
    const bestTo = bestUci.slice(2, 4) as Square;
    const targetPiece = chess.get(bestTo);

    if (targetPiece && targetPiece.color !== moverColor && pieceValue(targetPiece.type) >= 3) {
      // The best move captures a valuable piece — if we didn't play it, it was hanging
      return true;
    }

    // Also check if a pawn can capture something valuable
    if (targetPiece && targetPiece.color !== moverColor && pieceValue(targetPiece.type) >= 1) {
      // Check the piece that could have been captured
      const afterChess = new Chess(fenAfter);
      const stillThere = afterChess.get(bestTo);
      if (stillThere && stillThere.color !== moverColor) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

function detectFork(
  fen: string,
  bestUci: string,
  moverColor: 'w' | 'b',
): boolean {
  try {
    const chess = new Chess(fen);
    const moveResult = chess.move({
      from: bestUci.slice(0, 2) as Square,
      to: bestUci.slice(2, 4) as Square,
      promotion: bestUci.length > 4 ? (bestUci[4] as 'q' | 'r' | 'b' | 'n') : undefined,
    });

    if (!moveResult) return false;

    // After the best move, check if the moved piece attacks 2+ valuable enemy pieces
    const to = moveResult.to as Square;
    const movedPiece = chess.get(to);
    if (!movedPiece) return false;

    // Only knights, queens, and pawns typically create forks
    if (!['n', 'q', 'p'].includes(movedPiece.type)) return false;

    // Check all opponent pieces that this piece attacks
    const opponentColor: Color = moverColor === 'w' ? 'b' : 'w';
    const attackedPieces = chess.moves({ square: to, verbose: true })
      .filter((m) => {
        const target = chess.get(m.to as Square);
        return target && target.color === opponentColor && pieceValue(target.type) >= 3;
      });

    return attackedPieces.length >= 2;
  } catch {
    return false;
  }
}

function detectBackRank(
  fen: string,
  bestUci: string,
  moverColor: 'w' | 'b',
): boolean {
  try {
    // Check if the best move targets the back rank
    const toSquare = bestUci.slice(2, 4);
    const targetRank = toSquare[1];

    // Back rank for opponent: rank 8 for Black pieces, rank 1 for White pieces
    const opponentBackRank = moverColor === 'w' ? '8' : '1';
    return targetRank === opponentBackRank;
  } catch {
    return false;
  }
}

function detectLostCastlingSafety(
  fenBefore: string,
  fenAfter: string,
  moverColor: 'w' | 'b',
): boolean {
  try {
    // Check if the move resulted in losing castling rights
    const before = fenBefore.split(' ');
    const after = fenAfter.split(' ');
    const castlingBefore = before[2] || '-';
    const castlingAfter = after[2] || '-';

    if (moverColor === 'w') {
      const hadCastling = castlingBefore.includes('K') || castlingBefore.includes('Q');
      const hasCastling = castlingAfter.includes('K') || castlingAfter.includes('Q');
      return hadCastling && !hasCastling;
    } else {
      const hadCastling = castlingBefore.includes('k') || castlingBefore.includes('q');
      const hasCastling = castlingAfter.includes('k') || castlingAfter.includes('q');
      return hadCastling && !hasCastling;
    }
  } catch {
    return false;
  }
}

// ── Coach text generation ────────────────────────────────────────────────────

export interface CoachTextInput {
  classification: Classification;
  motifs: Motif[];
  san: string;
  bestSan: string;
  bestPv: string[];
  phase: GamePhase;
  epLoss: number;
  mateBefore: number | null;
  mateAfter: number | null;
  bestMate: number | null;
}

/**
 * Template library: maps (classification, motif, phase) → coach sentence.
 *
 * This is the ONLY coach text source. It works offline, no API key needed.
 * The optional LLM route only rewrites/enriches; it never blocks rendering.
 */
const COACH_TEMPLATES: Record<string, string[]> = {
  // ── Brilliant ──
  'brilliant:default': [
    'A stunning sacrifice! {san} gives up material for a decisive advantage.',
    'Incredible! {san} is a brilliant sacrifice that the engine confirms as best.',
  ],
  'brilliant:fork': [
    'Brilliant! {san} sacrifices material to set up a devastating fork.',
  ],
  'brilliant:back_rank': [
    'A spectacular sacrifice! {san} exploits the back rank weakness.',
  ],

  // ── Great ──
  'great:default': [
    'Great find! {san} was the only move that holds the position.',
    'Excellent! {san} was the critical move in this position.',
  ],
  'great:fork': [
    'Great move! {san} sets up a winning fork.',
  ],

  // ── Best ──
  'best:default': [
    'Best move. {san} is the engine\'s top choice.',
  ],

  // ── Excellent ──
  'excellent:default': [
    'Strong move. {san} is nearly as good as the best option.',
  ],

  // ── Good ──
  'good:default': [
    'Solid. {san} keeps the position healthy.',
  ],

  // ── Book ──
  'book:default': [
    'Theory. {san} is a standard opening move.',
  ],

  // ── Inaccuracy ──
  'inaccuracy:default': [
    'Slight inaccuracy. {bestSan} was more precise.',
  ],
  'inaccuracy:hanging_piece': [
    'Inaccuracy — {bestSan} would have won material.',
  ],

  // ── Mistake ──
  'mistake:default': [
    'Mistake. {bestSan} was significantly better.',
  ],
  'mistake:hanging_piece': [
    'Mistake! You left material hanging. {bestSan} wins a piece.',
  ],
  'mistake:fork': [
    'Mistake. You missed {bestSan}, which creates a fork.',
  ],
  'mistake:missed_mate': [
    'Mistake! Mate was available: {bestSan}.',
  ],
  'mistake:back_rank': [
    'Mistake. {bestSan} exploits the back rank for a decisive advantage.',
  ],
  'mistake:lost_castling_safety': [
    'Mistake. This move compromises your king safety.',
  ],
  'mistake:time_pressure': [
    'Time pressure mistake. {bestSan} was the right move.',
  ],

  // ── Miss ──
  'miss:default': [
    'Missed opportunity! {bestSan} was much stronger.',
  ],
  'miss:hanging_piece': [
    'You missed it! Your opponent left a piece hanging — {bestSan} wins material.',
  ],
  'miss:missed_mate': [
    'Missed checkmate! {bestSan} delivers mate.',
  ],
  'miss:fork': [
    'Missed a fork! {bestSan} attacks multiple pieces.',
  ],
  'miss:time_pressure': [
    'Time trouble — you missed {bestSan}.',
  ],

  // ── Blunder ──
  'blunder:default': [
    'Blunder! {bestSan} was essential. This move throws away the position.',
  ],
  'blunder:hanging_piece': [
    'Blunder! You left a piece hanging. {bestSan} was necessary.',
  ],
  'blunder:missed_mate': [
    'Blunder! You had checkmate with {bestSan}.',
  ],
  'blunder:allowed_mate': [
    'Blunder! This allows your opponent to deliver checkmate.',
  ],
  'blunder:back_rank': [
    'Blunder! Back rank mate is now threatened. {bestSan} was the defense.',
  ],
  'blunder:fork': [
    'Blunder! {bestSan} creates a winning fork.',
  ],
  'blunder:time_pressure': [
    'Time pressure blunder. {bestSan} saves the position.',
  ],

  // ── Forced ──
  'forced:default': [
    '{san} — the only legal move.',
  ],
};

/**
 * Generate coach text for a move based on its classification and motifs.
 *
 * Uses the template library to produce a human-readable explanation.
 * Replaces {san}, {bestSan}, and {bestPv} placeholders.
 */
export function generateCoachText(input: CoachTextInput): string {
  const { classification, motifs, san, bestSan, bestPv, bestMate } = input;

  // Try to find a template matching the first motif
  let templates: string[] | undefined;
  for (const motif of motifs) {
    templates = COACH_TEMPLATES[`${classification}:${motif}`];
    if (templates) break;
  }

  // Fall back to default template
  if (!templates) {
    templates = COACH_TEMPLATES[`${classification}:default`];
  }

  if (!templates || templates.length === 0) {
    return `${san} was played.`;
  }

  // Pick a template deterministically based on san hash
  let hash = 0;
  for (let i = 0; i < san.length; i++) {
    hash = (hash * 31 + san.charCodeAt(i)) | 0;
  }
  const template = templates[Math.abs(hash) % templates.length];

  // Replace placeholders
  let text = template
    .replace(/\{san\}/g, san)
    .replace(/\{bestSan\}/g, bestSan)
    .replace(/\{bestPv\}/g, bestPv.slice(0, 3).join(' '));

  // Add mate info if applicable
  if (bestMate !== null && bestMate > 0 && motifs.includes('missed_mate')) {
    text += ` Mate in ${bestMate}.`;
  }

  return text;
}
