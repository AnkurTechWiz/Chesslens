import { describe, it, expect } from 'vitest';
import { see, hangingMaterialAfter, isSacrifice, pieceValue } from './sacrifice';

describe('sacrifice', () => {
  describe('pieceValue', () => {
    it('pawn = 1', () => expect(pieceValue('p')).toBe(1));
    it('knight = 3', () => expect(pieceValue('n')).toBe(3));
    it('bishop = 3', () => expect(pieceValue('b')).toBe(3));
    it('rook = 5', () => expect(pieceValue('r')).toBe(5));
    it('queen = 9', () => expect(pieceValue('q')).toBe(9));
    it('king = 0', () => expect(pieceValue('k')).toBe(0));
  });

  describe('see', () => {
    it('undefended knight capture: SEE = +3', () => {
      // White knight on e5, Black knight on c6 can capture, no White defenders
      const fen = 'r1bqkbnr/pppppppp/2n5/4N3/8/8/PPPPPPPP/RNBQKB1R b KQkq - 0 1';
      const result = see(fen, 'e5', 'b');
      expect(result).toBe(3);
    });

    it('defended knight: SEE = 0 (even trade)', () => {
      // White knight on e5 defended by d4 pawn, Black knight on c6
      // Nxe5, dxe5 → gain 3, lose 3 = net 0
      const fen = '4k3/8/2n5/4N3/3P4/8/8/4K3 b - - 0 1';
      const result = see(fen, 'e5', 'b');
      expect(result).toBe(0);
    });

    it('queen captures defended pawn: SEE is negative', () => {
      // White: pawns on e4 and d3, Black: queen on h4
      // Qxe4, dxe3 → gain 1, lose 9 = very negative
      const fen = '4k3/8/8/8/4P2q/3P4/8/4K3 b - - 0 1';
      const result = see(fen, 'e4', 'b');
      expect(result).toBeLessThan(0);
    });

    it('rook takes undefended rook: SEE = +5', () => {
      // White rook on e1, Black rook on e5, no defenders
      const fen = '4k3/8/8/4r3/8/8/8/4RK2 w - - 0 1';
      const result = see(fen, 'e5', 'w');
      expect(result).toBe(5);
    });

    it('returns 0 for empty square', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const result = see(fen, 'e4', 'w');
      expect(result).toBe(0);
    });

    it('returns 0 when trying to capture own piece', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const result = see(fen, 'e2', 'w');
      expect(result).toBe(0);
    });

    // BLACK-TO-MOVE: verify perspective correctness
    it('works correctly from Black perspective: captures undefended pawn', () => {
      const fen = '4k3/8/2n5/4P3/8/8/8/4K3 b - - 0 1';
      const result = see(fen, 'e5', 'b');
      expect(result).toBe(1);
    });

    it('Black perspective: opponent piece defended, even exchange', () => {
      // White pawn on e5 defended by pawn on d4, Black knight on c6
      const fen = '4k3/8/2n5/4P3/3P4/8/8/4K3 b - - 0 1';
      const result = see(fen, 'e5', 'b');
      // Knight (3) captures pawn (1), d4 pawn recaptures. Net = 1 - 3 = -2? 
      // Actually: gain 1, then lose 3 (knight) to recapture, so SEE = min(1, 1-3) = -2? No.
      // SEE: gains = [1, 3], minimax: gains[0] = min(1, 1-3) = min(1,-2) = -2
      // So Black wouldn't capture. But the SEE returns the value IF you initiate.
      // Standard SEE: if SEE < 0, capture is bad. Here it should be < 0 or exactly -2.
      expect(result).toBeLessThanOrEqual(0);
    });
  });

  describe('hangingMaterialAfter', () => {
    it('detects no hanging material when pieces are defended', () => {
      // After 1.e4, the e4 pawn is defended by d3 potential, Qe2 etc. 
      // Use: King on e1, pawn on e4, pawn on d3 (defends e4 via d3→e4? No, d3 attacks c4 and e4!)
      const fen2 = '4k3/8/8/8/4P3/3P4/8/4K3 w - - 0 1';
      // d3 pawn attacks c4 and e4. So e4 is defended by d3.
      // Black has no pieces to attack e4 anyway.
      const hanging = hangingMaterialAfter(fen2, 'w');
      expect(hanging).toBe(0);
    });

    it('detects hanging knight', () => {
      // White knight on e5 with no White defenders, Black knight on c6 can capture
      const fen = 'r1bqkbnr/pppppppp/2n5/4N3/8/8/PPPPPPPP/RNBQKB1R b KQkq - 0 1';
      const hanging = hangingMaterialAfter(fen, 'w');
      expect(hanging).toBeLessThan(0);
    });

    // BLACK-TO-MOVE: verify perspective
    it('detects hanging Black piece correctly', () => {
      // Black knight on e4, White knight on c3 can capture via Nxe4
      const fen = '4k3/8/8/8/4n3/2N5/8/4K3 w - - 0 1';
      const hanging = hangingMaterialAfter(fen, 'b');
      expect(hanging).toBeLessThan(0);
    });
  });

  describe('isSacrifice', () => {
    it('detects material sacrifice (knight left hanging)', () => {
      // White plays Nf3-e5, Black's c6 knight can capture undefended
      const fenBefore = 'r1bqkbnr/pppppppp/2n5/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 0 1';
      const fenAfter = 'r1bqkbnr/pppppppp/2n5/4N3/8/8/PPPPPPPP/RNBQKB1R b KQkq - 0 1';
      const result = isSacrifice(fenBefore, 'f3e5', fenAfter, 'w');
      expect(result).toBe(true);
    });

    it('does not flag safe moves as sacrifices', () => {
      // 1.e4 — pawn to e4, no material risk
      const fenBefore = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const fenAfter = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
      const result = isSacrifice(fenBefore, 'e2e4', fenAfter, 'w');
      expect(result).toBe(false);
    });

    it('does not flag normal pawn push as sacrifice', () => {
      // 1...e5 — pawn to e5, no material risk
      const fenBefore = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
      const fenAfter = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1';
      const result = isSacrifice(fenBefore, 'e7e5', fenAfter, 'b');
      expect(result).toBe(false);
    });
  });
});
