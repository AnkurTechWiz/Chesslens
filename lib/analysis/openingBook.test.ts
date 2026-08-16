import { describe, it, expect, beforeEach } from 'vitest';
import {
  lookupOpening,
  isBookMove,
  getOpeningInfo,
  resetOpeningBook,
} from './openingBook';

describe('openingBook', () => {
  beforeEach(() => {
    resetOpeningBook();
  });

  describe('lookupOpening', () => {
    it('finds Italian Game for Italian mainline moves', () => {
      // 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6
      const moves = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'c2c3', 'g8f6'];
      const result = lookupOpening(moves);
      expect(result).not.toBeNull();
      expect(result!.eco).toBe('C50');
      expect(result!.name).toContain('Italian');
      expect(result!.bookPlies).toBeGreaterThanOrEqual(8);
    });

    it('finds Pirc Defense for Kasparov-Topalov opening', () => {
      // 1.e4 d6 2.d4 Nf6 3.Nc3 g6
      const moves = ['e2e4', 'd7d6', 'd2d4', 'g8f6', 'b1c3', 'g7g6'];
      const result = lookupOpening(moves);
      expect(result).not.toBeNull();
      expect(result!.eco).toBe('B07');
      expect(result!.name).toContain('Pirc');
    });

    it('finds Sicilian Sveshnikov for the 60-move fixture opening', () => {
      // 1.e4 c5 2.Nf3 Nc6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 e5
      const moves = ['e2e4', 'c7c5', 'g1f3', 'b8c6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'e7e5'];
      const result = lookupOpening(moves);
      expect(result).not.toBeNull();
      expect(result!.eco).toBe('B33');
    });

    it('returns null for empty move list', () => {
      expect(lookupOpening([])).toBeNull();
    });

    it('returns null for nonsense moves', () => {
      const moves = ['a2a4', 'h7h5', 'a4a5', 'h5h4'];
      const result = lookupOpening(moves);
      // May match partial (a2a4 is not in any standard opening)
      // This should return null or a very short match
      expect(result === null || result.bookPlies <= 1).toBe(true);
    });

    it('matches partial prefixes', () => {
      // 1.e4 e5 should match something (C20 King's Pawn Game)
      const moves = ['e2e4', 'e7e5'];
      const result = lookupOpening(moves);
      expect(result).not.toBeNull();
      expect(result!.bookPlies).toBeGreaterThanOrEqual(2);
    });
  });

  describe('isBookMove', () => {
    it('returns true for plies within book', () => {
      expect(isBookMove(1, 8)).toBe(true);
      expect(isBookMove(4, 8)).toBe(true);
      expect(isBookMove(8, 8)).toBe(true);
    });

    it('returns false for plies beyond book', () => {
      expect(isBookMove(9, 8)).toBe(false);
      expect(isBookMove(20, 8)).toBe(false);
    });

    it('returns false for ply 0', () => {
      expect(isBookMove(0, 8)).toBe(false);
    });
  });

  describe('getOpeningInfo', () => {
    it('returns opening info for known opening', () => {
      const moves = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'];
      const info = getOpeningInfo(moves);
      expect(info.eco).toBeTruthy();
      expect(info.name).toBeTruthy();
      expect(info.bookPlies).toBeGreaterThan(0);
    });

    it('returns default for unrecognized opening', () => {
      const info = getOpeningInfo([]);
      expect(info.eco).toBe('');
      expect(info.name).toBe('Unknown Opening');
      expect(info.bookPlies).toBe(0);
    });
  });
});
