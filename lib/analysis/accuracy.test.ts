import { describe, it, expect } from 'vitest';
import {
  moveAccuracy,
  gameAccuracy,
  acpl,
  estimatedElo,
} from './accuracy';

describe('accuracy', () => {
  describe('moveAccuracy', () => {
    it('returns ~100 for no win% drop (perfect move)', () => {
      const acc = moveAccuracy(50, 50);
      expect(acc).toBeCloseTo(100, 0);
    });

    it('returns ~100 when position improves (wpAfter > wpBefore)', () => {
      const acc = moveAccuracy(50, 60);
      // wpDrop is negative → exp(positive) → very high
      expect(acc).toBe(100); // clamped at 100
    });

    it('returns a low value for a large win% drop (blunder)', () => {
      const acc = moveAccuracy(90, 50);
      expect(acc).toBeLessThan(25);
      expect(acc).toBeGreaterThanOrEqual(0);
    });

    it('returns 0 for an extreme blunder', () => {
      const acc = moveAccuracy(95, 5);
      expect(acc).toBe(0);
    });

    it('handles equal winning positions', () => {
      // Both high: still ~100
      const acc = moveAccuracy(95, 95);
      expect(acc).toBeCloseTo(100, 0);
    });

    // BLACK-TO-MOVE: verify perspective correctness
    it('works correctly for Black perspective (wp already from mover view)', () => {
      // Black had 60% win, dropped to 40%: same formula
      const acc = moveAccuracy(60, 40);
      expect(acc).toBeLessThan(70);
      expect(acc).toBeGreaterThan(0);
    });

    it('small drop yields high accuracy (losing 2 win% scores ~94%)', () => {
      // 2% drop on 0-100 win% scale
      const acc = moveAccuracy(50, 48);
      expect(acc).toBeGreaterThan(90);
      expect(acc).toBeLessThan(96);
    });

    it('large drop yields low accuracy (losing 50 win% scores ~12%)', () => {
      // 50% drop on 0-100 win% scale
      const acc = moveAccuracy(100, 50);
      expect(acc).toBeGreaterThan(5);
      expect(acc).toBeLessThan(15);
    });
  });

  describe('gameAccuracy', () => {
    it('returns 0 for empty arrays', () => {
      expect(gameAccuracy([], [])).toBe(0);
    });

    it('returns ~100 for all-perfect moves', () => {
      const accuracies = [100, 100, 100, 100, 100];
      const winPcts = [50, 52, 55, 58, 60];
      const acc = gameAccuracy(accuracies, winPcts);
      expect(acc).toBeCloseTo(100, 0);
    });

    it('returns lower value when some moves are poor', () => {
      const accuracies = [100, 100, 10, 100, 100];
      const winPcts = [50, 55, 55, 30, 35];
      const acc = gameAccuracy(accuracies, winPcts);
      expect(acc).toBeLessThan(90);
      expect(acc).toBeGreaterThan(0);
    });

    it('harmonic mean penalizes low outliers', () => {
      // One bad move should pull the average down noticeably
      const allGood = gameAccuracy([95, 95, 95, 95, 95], [50, 52, 54, 56, 58]);
      const oneBad = gameAccuracy([95, 95, 5, 95, 95], [50, 52, 54, 56, 58]);
      expect(oneBad).toBeLessThan(allGood - 10);
    });
  });

  describe('acpl', () => {
    it('returns 0 for no losses', () => {
      expect(acpl([0, 0, 0])).toBe(0);
    });

    it('calculates average correctly', () => {
      expect(acpl([10, 20, 30])).toBe(20);
    });

    it('caps per-move loss at 1000', () => {
      // 100, 200, 2000 → capped to 100, 200, 1000 → avg = 433.33
      const result = acpl([100, 200, 2000]);
      expect(result).toBeCloseTo((100 + 200 + 1000) / 3, 1);
    });

    it('returns 0 for empty array', () => {
      expect(acpl([])).toBe(0);
    });

    it('handles negative values by using absolute value', () => {
      expect(acpl([-50, 50])).toBe(50);
    });
  });

  describe('estimatedElo', () => {
    it('returns an elo number with ±150 range clamped within [250, 2800]', () => {
      const result = estimatedElo(80, 30, 40);
      expect(result.range).toBe(150);
      expect(typeof result.elo).toBe('number');
      expect(result.elo).toBeGreaterThanOrEqual(250);
      expect(result.elo).toBeLessThanOrEqual(2800);
    });

    it('higher accuracy / lower ACPL → higher estimated Elo', () => {
      const good = estimatedElo(95, 10, 40);
      const bad = estimatedElo(50, 80, 40);
      expect(good.elo).toBeGreaterThan(bad.elo);
    });

    it('zero ACPL and 100% accuracy yields maximum Elo (2800)', () => {
      const perfect = estimatedElo(100, 0, 40);
      expect(perfect.elo).toBe(2800);
    });

    it('anchors to calibration reference points', () => {
      // 1. accuracy ~66%, ACPL ~90, 2+ serious errors → ~450
      const p1 = estimatedElo(66, 90, 30, { blunders: 1, mistakes: 1, misses: 1 });
      expect(p1.elo).toBeGreaterThanOrEqual(380);
      expect(p1.elo).toBeLessThanOrEqual(520);

      // 2. accuracy ~75%, ACPL ~55 → ~1000
      const p2 = estimatedElo(75, 55, 30);
      expect(p2.elo).toBeGreaterThanOrEqual(950);
      expect(p2.elo).toBeLessThanOrEqual(1150);

      // 3. accuracy ~85%, ACPL ~30 → ~1600
      const p3 = estimatedElo(85, 30, 30);
      expect(p3.elo).toBeGreaterThanOrEqual(1500);
      expect(p3.elo).toBeLessThanOrEqual(1700);

      // 4. accuracy ~92%, ACPL ~15 → ~2100
      const p4 = estimatedElo(92, 15, 30);
      expect(p4.elo).toBeGreaterThanOrEqual(2000);
      expect(p4.elo).toBeLessThanOrEqual(2200);

      // 5. accuracy ~97%, ACPL ~8 → ~2500
      const p5 = estimatedElo(97, 8, 30);
      expect(p5.elo).toBeGreaterThanOrEqual(2400);
      expect(p5.elo).toBeLessThanOrEqual(2600);
    });

    it('penalizes error rate: 72% accuracy with 2 blunders is beginner (< 800), not 1600', () => {
      const beginnerWithBlunders = estimatedElo(72, 70, 30, { blunders: 2 });
      expect(beginnerWithBlunders.elo).toBeLessThan(800);
    });

    it('clamps lower bound to 250 for terrible games', () => {
      const awful = estimatedElo(20, 250, 30, { blunders: 5, mistakes: 4 });
      expect(awful.elo).toBe(250);
    });

    it('GM quality play (e.g. Kasparov–Topalov) estimates 2400+ for both sides', () => {
      const kasparov = estimatedElo(97.5, 7.5, 44, { blunders: 0, mistakes: 0, misses: 0 });
      const topalov = estimatedElo(96.0, 9.5, 44, { blunders: 0, mistakes: 0, misses: 0 });
      expect(kasparov.elo).toBeGreaterThanOrEqual(2400);
      expect(topalov.elo).toBeGreaterThanOrEqual(2400);
    });
  });

  describe('computeGameStats', () => {
    it('excludes book moves from ACPL and handles mate scores safely', async () => {
      const { computeGameStats } = await import('./accuracy');
      const stats = computeGameStats([
        {
          ply: 1,
          san: 'e4',
          uci: 'e2e4',
          fenBefore: 'start',
          fenAfter: 'after-e4',
          cpBefore: 20,
          mateBefore: null,
          cpAfter: 15,
          mateAfter: null,
          winBefore: 52,
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
          san: 'e5',
          uci: 'e7e5',
          fenBefore: 'after-e4',
          fenAfter: 'after-e5',
          cpBefore: 15,
          mateBefore: null,
          cpAfter: 15,
          mateAfter: null,
          winBefore: 48,
          winAfter: 48,
          epLoss: 0,
          classification: 'book',
          best: { uci: 'e7e5', san: 'e5', cp: -15, mate: null, pv: ['e7e5'] },
          motifs: [],
          accuracy: 100,
          depth: 12,
        },
        {
          ply: 3,
          san: 'Nf3',
          uci: 'g1f3',
          fenBefore: 'after-e5',
          fenAfter: 'after-Nf3',
          cpBefore: 20,
          mateBefore: null,
          cpAfter: -10, // 30 cp loss
          mateAfter: null,
          winBefore: 53,
          winAfter: 48,
          epLoss: 0.05,
          classification: 'good',
          best: { uci: 'g1f3', san: 'Nf3', cp: 20, mate: null, pv: ['g1f3'] },
          motifs: [],
          accuracy: 85,
          depth: 12,
        },
      ]);

      // White ACPL should only be from ply 3 (30 cp), book move ply 1 (5 cp) excluded
      expect(stats.acpl.white).toBe(30);
      expect(stats.acpl.black).toBe(0);
    });
  });
});

