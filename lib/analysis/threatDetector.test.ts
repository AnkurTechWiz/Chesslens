import { describe, it, expect } from 'vitest';
import { detectThreats } from './threatDetector';

describe('threatDetector', () => {
  it('detects no severe threats in the starting position', () => {
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const threats = detectThreats(startFen);
    expect(threats.length).toBe(0);
  });

  it('detects queen attack/check threat in Scholar mate setup', () => {
    // White queen on h5 threatening Qxf7# against Black king
    const fen = 'r1bqkb1r/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 2 4';
    const threats = detectThreats(fen);
    expect(threats.length).toBeGreaterThan(0);
    const mateThreat = threats.find((t) => t.from === 'h5' && t.to === 'f7');
    expect(mateThreat).toBeDefined();
    expect(mateThreat?.isCheck).toBe(true);
    expect(mateThreat?.isCapture).toBe(true);
  });

  it('detects fork and piece capture threats', () => {
    // White knight on d5 attacking Black queen on c7 and pawn on e7
    const fen = 'r1b1k2r/ppq1nppp/8/3Np3/8/8/PPPP1PPP/R1BQKBNR w KQkq - 0 1';
    const threats = detectThreats(fen);
    const queenCapture = threats.find((t) => t.from === 'd5' && t.to === 'c7');
    expect(queenCapture).toBeDefined();
    expect(queenCapture?.isCapture).toBe(true);
    expect(queenCapture?.threatenedPiece).toBe('q');
  });

  it('handles invalid FEN gracefully without throwing', () => {
    expect(detectThreats('invalid-fen')).toEqual([]);
  });
});
