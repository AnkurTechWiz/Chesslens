import { describe, it, expect } from 'vitest';
import {
  clamp,
  winPercent,
  mateWinPercent,
  expectedPoints,
  expectedPointsWithMate,
  winPercentWithMate,
  toMoverPerspective,
} from './winProb';

describe('winProb', () => {
  describe('clamp', () => {
    it('clamps to lower bound', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });
    it('clamps to upper bound', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });
    it('passes through values in range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });
  });

  describe('winPercent', () => {
    it('returns 50 for cp=0 (equal position)', () => {
      expect(winPercent(0)).toBe(50);
    });

    it('returns a value around 59 for cp=100 (roughly +1 pawn)', () => {
      const wp = winPercent(100);
      expect(wp).toBeGreaterThan(58);
      expect(wp).toBeLessThan(60);
    });

    it('is symmetric: winPercent(-cp) + winPercent(cp) = 100', () => {
      for (const cp of [50, 100, 200, 500, 800, 1000]) {
        expect(winPercent(-cp) + winPercent(cp)).toBeCloseTo(100, 8);
      }
    });

    it('clamps at ±1000: extreme values do not blow up', () => {
      const wp5000 = winPercent(5000);
      const wp1000 = winPercent(1000);
      expect(wp5000).toBe(wp1000);
    });

    it('is monotonically increasing', () => {
      let prev = winPercent(-1000);
      for (let cp = -900; cp <= 1000; cp += 100) {
        const curr = winPercent(cp);
        expect(curr).toBeGreaterThanOrEqual(prev);
        prev = curr;
      }
    });

    it('returns near 97 for cp=1000 (decisive advantage)', () => {
      const wp = winPercent(1000);
      expect(wp).toBeGreaterThan(96);
      expect(wp).toBeLessThan(99);
    });
  });

  describe('mateWinPercent', () => {
    it('returns 100 for positive mate (delivering mate)', () => {
      expect(mateWinPercent(3)).toBe(100);
      expect(mateWinPercent(1)).toBe(100);
      expect(mateWinPercent(20)).toBe(100);
    });

    it('returns 0 for negative mate (being mated)', () => {
      expect(mateWinPercent(-3)).toBe(0);
      expect(mateWinPercent(-1)).toBe(0);
      expect(mateWinPercent(-20)).toBe(0);
    });

    it('returns 0 for mate=0 (already mated)', () => {
      expect(mateWinPercent(0)).toBe(0);
    });
  });

  describe('expectedPoints', () => {
    it('returns 0.5 for cp=0', () => {
      expect(expectedPoints(0)).toBe(0.5);
    });

    it('returns EP in [0, 1] range', () => {
      for (const cp of [-500, -100, 0, 100, 500]) {
        const ep = expectedPoints(cp);
        expect(ep).toBeGreaterThanOrEqual(0);
        expect(ep).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('winPercentWithMate', () => {
    it('uses mate score when mate is non-null', () => {
      expect(winPercentWithMate(null, 3)).toBe(100);
      expect(winPercentWithMate(null, -3)).toBe(0);
    });

    it('uses cp when mate is null', () => {
      expect(winPercentWithMate(100, null)).toBeCloseTo(winPercent(100), 8);
    });

    it('mate takes priority over cp', () => {
      // Even if cp suggests otherwise, mate score wins
      expect(winPercentWithMate(-500, 3)).toBe(100);
      expect(winPercentWithMate(500, -3)).toBe(0);
    });

    it('returns 50 when both are null', () => {
      expect(winPercentWithMate(null, null)).toBe(50);
    });
  });

  describe('expectedPointsWithMate', () => {
    it('returns 1.0 for positive mate', () => {
      expect(expectedPointsWithMate(null, 3)).toBe(1.0);
    });

    it('returns 0.0 for negative mate', () => {
      expect(expectedPointsWithMate(null, -3)).toBe(0.0);
    });

    it('returns 0.5 when both null', () => {
      expect(expectedPointsWithMate(null, null)).toBe(0.5);
    });

    it('uses sigmoid for cp-only', () => {
      expect(expectedPointsWithMate(200, null)).toBeCloseTo(
        winPercent(200) / 100,
        8,
      );
    });
  });

  describe('toMoverPerspective', () => {
    it('keeps values unchanged for White', () => {
      const result = toMoverPerspective(100, null, 'w');
      expect(result).toEqual({ cp: 100, mate: null });
    });

    it('negates cp for Black', () => {
      const result = toMoverPerspective(100, null, 'b');
      expect(result).toEqual({ cp: -100, mate: null });
    });

    it('negates mate for Black', () => {
      const result = toMoverPerspective(null, 3, 'b');
      expect(result).toEqual({ cp: null, mate: -3 });
    });

    it('handles null values for Black', () => {
      const result = toMoverPerspective(null, null, 'b');
      expect(result).toEqual({ cp: null, mate: null });
    });

    // BLACK-TO-MOVE: verify perspective correctness
    it('Black advantage: White cp=-200 → Black mover cp=+200', () => {
      const result = toMoverPerspective(-200, null, 'b');
      expect(result.cp).toBe(200);
    });

    it('Black being mated: White mate=+3 → Black mover mate=-3', () => {
      const result = toMoverPerspective(null, 3, 'b');
      expect(result.mate).toBe(-3);
    });

    it('White being mated: White mate=-3 → Black mover mate=+3', () => {
      const result = toMoverPerspective(null, -3, 'b');
      expect(result.mate).toBe(3);
    });
  });
});
