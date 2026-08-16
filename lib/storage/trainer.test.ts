// lib/storage/trainer.test.ts — Tests for SM-2 spaced repetition math and card generation

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TrainerCard, GameReport } from '../types';

const mockCardsStore = new Map<string, TrainerCard>();

vi.mock('./db', () => ({
  db: {
    cards: {
      toArray: vi.fn(async () => Array.from(mockCardsStore.values())),
      put: vi.fn(async (card: TrainerCard) => {
        mockCardsStore.set(card.id, card);
      }),
      bulkPut: vi.fn(async (cards: TrainerCard[]) => {
        for (const c of cards) mockCardsStore.set(c.id, c);
      }),
      where: vi.fn((field: string) => ({
        equals: vi.fn((val: string) => ({
          first: vi.fn(async () => {
            if (field === 'fen') {
              for (const c of mockCardsStore.values()) {
                if (c.fen === val) return c;
              }
            }
            return undefined;
          }),
        })),
      })),
    },
  },
}));

import { calculateSM2, createCardsFromGameReport } from './trainer';

beforeEach(() => {
  mockCardsStore.clear();
});

describe('Trainer Subsystem', () => {
  const baseCard: TrainerCard = {
    id: 'test-card-1',
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
    solutionUci: 'f1b5',
    pv: ['f1b5', 'a7a6'],
    motifs: ['pin'],
    classification: 'blunder',
    ease: 2.5,
    interval: 1,
    reps: 0,
    dueAt: 1700000000000,
    createdAt: 1700000000000,
  };

  describe('SM-2 Algorithm Transitions', () => {
    it('handles "again" grade: resets reps to 0 and interval to 1 day', () => {
      const advancedCard: TrainerCard = {
        ...baseCard,
        reps: 4,
        interval: 14,
        ease: 2.5,
      };

      const graded = calculateSM2(advancedCard, 'again', 1700000000000);
      expect(graded.reps).toBe(0);
      expect(graded.interval).toBe(1);
      expect(graded.ease).toBe(2.3); // 2.5 - 0.2
      expect(graded.lastResult).toBe('again');
      expect(graded.dueAt).toBe(1700000000000 + 24 * 60 * 60 * 1000);
    });

    it('enforces minimum ease floor of 1.3', () => {
      const lowEaseCard: TrainerCard = {
        ...baseCard,
        ease: 1.35,
      };

      const graded = calculateSM2(lowEaseCard, 'again');
      expect(graded.ease).toBe(1.3);
    });

    it('handles "good" progression: reps 1 -> interval 1d, reps 2 -> interval 6d, reps 3 -> interval * ease', () => {
      const now = 1700000000000;
      // Step 1: Rep 0 -> Rep 1
      const step1 = calculateSM2(baseCard, 'good', now);
      expect(step1.reps).toBe(1);
      expect(step1.interval).toBe(1);

      // Step 2: Rep 1 -> Rep 2
      const step2 = calculateSM2(step1, 'good', now);
      expect(step2.reps).toBe(2);
      expect(step2.interval).toBe(6);

      // Step 3: Rep 2 -> Rep 3
      const step3 = calculateSM2(step2, 'good', now);
      expect(step3.reps).toBe(3);
      expect(step3.interval).toBe(Math.round(6 * 2.5)); // 15
    });

    it('handles "easy" grade: boosts ease and accelerates intervals', () => {
      const graded = calculateSM2(baseCard, 'easy', 1700000000000);
      expect(graded.reps).toBe(1);
      expect(graded.interval).toBe(3);
      expect(graded.ease).toBe(2.65); // 2.5 + 0.15
      expect(graded.lastResult).toBe('easy');
    });
  });

  describe('createCardsFromGameReport', () => {
    it('creates cards from blunders, misses, and mistakes with deduplication', async () => {
      const mockReport: GameReport = {
        moves: [
          {
            ply: 1,
            san: 'e4',
            uci: 'e2e4',
            fenBefore: 'startpos-fen-1',
            fenAfter: 'fen-after-1',
            cpBefore: 0,
            mateBefore: null,
            cpAfter: 20,
            mateAfter: null,
            winBefore: 50,
            winAfter: 52,
            epLoss: 0,
            classification: 'book',
            best: { uci: 'e2e4', san: 'e4', cp: 20, mate: null, pv: ['e2e4'] },
            motifs: [],
            accuracy: 100,
            depth: 12,
          },
          {
            ply: 2,
            san: 'f6',
            uci: 'f7f6',
            fenBefore: 'fen-after-1',
            fenAfter: 'fen-after-2',
            cpBefore: -20,
            mateBefore: null,
            cpAfter: -250,
            mateAfter: null,
            winBefore: 48,
            winAfter: 20,
            epLoss: 0.28,
            classification: 'blunder',
            best: { uci: 'e7e5', san: 'e5', cp: -20, mate: null, pv: ['e7e5', 'g1f3'] },
            motifs: ['weak_king'],
            accuracy: 15,
            depth: 12,
          },
          {
            ply: 3,
            san: 'd3',
            uci: 'd2d3',
            fenBefore: 'fen-after-2',
            fenAfter: 'fen-after-3',
            cpBefore: 250,
            mateBefore: null,
            cpAfter: 120,
            mateAfter: null,
            winBefore: 80,
            winAfter: 65,
            epLoss: 0.15,
            classification: 'miss',
            best: { uci: 'd1h5', san: 'Qh5+', cp: 250, mate: null, pv: ['d1h5', 'g7g6'] },
            motifs: ['missed_mate'],
            accuracy: 45,
            depth: 12,
          },
        ],
        accuracy: { white: 80, black: 60 },
        acpl: { white: 35, black: 90 },
        counts: {} as unknown as GameReport['counts'],
        estElo: { white: 1600, black: 1400 },
        phases: {} as unknown as GameReport['phases'],
        keyMoments: [2, 3],
        opening: { eco: 'B00', name: 'King Pawn Game', bookPlies: 1 },
      };

      const createdCount = await createCardsFromGameReport('game-123', mockReport);
      expect(createdCount).toBe(2);
      expect(mockCardsStore.size).toBe(2);

      // Running again on the same report should deduplicate and create 0 new cards
      const secondRun = await createCardsFromGameReport('game-123', mockReport);
      expect(secondRun).toBe(0);
    });
  });
});
