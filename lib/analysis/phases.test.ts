import { describe, it, expect } from 'vitest';
import { detectPhase, splitByPhase } from './phases';

describe('phases', () => {
  describe('detectPhase', () => {
    it('returns opening for early plies within book', () => {
      const startFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
      expect(detectPhase(startFen, 8, 1)).toBe('opening');
      expect(detectPhase(startFen, 8, 8)).toBe('opening');
      expect(detectPhase(startFen, 8, 10)).toBe('opening'); // bookPlies + 2
    });

    it('returns middlegame for positions beyond book with full material', () => {
      // Position after several moves, lots of material still on board
      const midFen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
      expect(detectPhase(midFen, 4, 15)).toBe('middlegame');
    });

    it('returns endgame for positions with ≤ 13 non-pawn material', () => {
      // K+R vs K+R = 5+5 = 10 non-pawn material (≤ 13)
      const endFen = '4k3/8/8/8/8/8/8/4K2R w - - 0 1';
      expect(detectPhase(endFen, 0, 40)).toBe('endgame');
    });

    it('returns endgame for positions with ≤ 6 pieces', () => {
      // K+R+P vs K+P = 4 non-king pieces + 2 kings = 6 total pieces
      const endFen = '4k3/4p3/8/8/8/8/4P3/4K2R w - - 0 1';
      expect(detectPhase(endFen, 0, 50)).toBe('endgame');
    });

    it('opening overrides endgame detection for early plies', () => {
      // Even if material is low, if ply ≤ bookPlies+2, it's opening
      const endFen = '4k3/8/8/8/8/8/8/4K2R w - - 0 1';
      expect(detectPhase(endFen, 5, 3)).toBe('opening');
    });

    // BLACK-TO-MOVE: no special handling needed (phase detection is color-agnostic)
    it('works for Black-to-move positions', () => {
      const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 4';
      expect(detectPhase(fen, 4, 15)).toBe('middlegame');
    });
  });

  describe('splitByPhase', () => {
    it('returns empty arrays for no moves', () => {
      const result = splitByPhase([], 0);
      expect(result.opening).toHaveLength(0);
      expect(result.middlegame).toHaveLength(0);
      expect(result.endgame).toHaveLength(0);
    });
  });
});
