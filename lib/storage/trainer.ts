// lib/storage/trainer.ts — Spaced Repetition (SM-2 Lite) Blunder Trainer engine
// Persists purely in local IndexedDB (Dexie db.cards).

import { db } from './db';
import type { TrainerCard, GameReport, Classification } from '../types';

export type SM2Grade = 'again' | 'hard' | 'good' | 'easy';

/**
 * Calculates new interval, ease factor, reps, and next due date based on SM-2 algorithm.
 */
export function calculateSM2(
  card: TrainerCard,
  grade: SM2Grade,
  now = Date.now(),
): TrainerCard {
  let reps = card.reps;
  let interval = card.interval;
  let ease = card.ease || 2.5;

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  switch (grade) {
    case 'again':
      reps = 0;
      interval = 1;
      ease = Math.max(1.3, ease - 0.2);
      break;

    case 'hard':
      reps += 1;
      interval = Math.max(1, Math.round(interval * 1.2));
      ease = Math.max(1.3, ease - 0.15);
      break;

    case 'good':
      reps += 1;
      if (reps === 1) {
        interval = 1;
      } else if (reps === 2) {
        interval = 6;
      } else {
        interval = Math.max(1, Math.round(interval * ease));
      }
      break;

    case 'easy':
      reps += 1;
      if (reps === 1) {
        interval = 3;
      } else if (reps === 2) {
        interval = 10;
      } else {
        interval = Math.max(1, Math.round(interval * ease * 1.3));
      }
      ease += 0.15;
      break;
  }

  const dueAt = now + interval * ONE_DAY_MS;

  return {
    ...card,
    reps,
    interval,
    ease: Math.round(ease * 100) / 100,
    dueAt,
    lastResult: grade,
  };
}

/**
 * Grade a trainer card, recalculate SM-2 scheduling, and save to local IndexedDB.
 */
export async function gradeTrainerCard(
  card: TrainerCard,
  grade: SM2Grade,
): Promise<TrainerCard> {
  const updated = calculateSM2(card, grade);
  await db.cards.put(updated);
  return updated;
}

/**
 * Scan a GameReport for Blunders, Misses, and Mistakes, creating trainer cards.
 * Avoids duplicate cards with identical FEN positions.
 */
export async function createCardsFromGameReport(
  gameId: string,
  gameReport: GameReport,
): Promise<number> {
  if (!gameReport || !gameReport.moves) return 0;

  const targetClassifications: Classification[] = ['blunder', 'miss', 'mistake'];
  const candidates = gameReport.moves.filter(
    (m) =>
      targetClassifications.includes(m.classification) &&
      m.best &&
      m.best.uci &&
      m.best.uci.length >= 4,
  );

  if (candidates.length === 0) return 0;

  // Retrieve existing card FENs to avoid duplicate cards for same position
  const existingCards = await db.cards.toArray();
  const existingFens = new Set(existingCards.map((c) => c.fen));

  const newCards: TrainerCard[] = [];
  const now = Date.now();

  for (const move of candidates) {
    if (existingFens.has(move.fenBefore)) continue;
    existingFens.add(move.fenBefore);

    const cardId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `card-${now}-${Math.random().toString(36).substring(2, 9)}`;

    newCards.push({
      id: cardId,
      gameId,
      fen: move.fenBefore,
      solutionUci: move.best.uci,
      pv: move.best.pv || [move.best.uci],
      motifs: move.motifs || [],
      classification: move.classification,
      ease: 2.5,
      interval: 1,
      reps: 0,
      dueAt: now,
      createdAt: now,
    });
  }

  if (newCards.length > 0) {
    await db.cards.bulkPut(newCards);
  }

  return newCards.length;
}

/**
 * Creates a single trainer card from an individual move report (e.g. from Retry mode).
 */
export async function createCardFromMove(
  fenBefore: string,
  solutionUci: string,
  pv: string[],
  motifs: string[],
  classification: Classification,
  gameId?: string,
): Promise<TrainerCard | null> {
  const existing = await db.cards.where('fen').equals(fenBefore).first();
  if (existing) {
    return existing;
  }

  const now = Date.now();
  const cardId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `card-${now}-${Math.random().toString(36).substring(2, 9)}`;

  const card: TrainerCard = {
    id: cardId,
    gameId,
    fen: fenBefore,
    solutionUci,
    pv,
    motifs,
    classification,
    ease: 2.5,
    interval: 1,
    reps: 0,
    dueAt: now,
    createdAt: now,
  };

  await db.cards.put(card);
  return card;
}
