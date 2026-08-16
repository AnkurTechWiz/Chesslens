import { describe, it, expect } from 'vitest';
import { findKeyMoments } from './keyMoments';
import type { MoveReport } from '../types';

function makeMoveReport(overrides: Partial<MoveReport> & { ply: number }): MoveReport {
  return {
    san: 'e4',
    uci: 'e2e4',
    fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    cpBefore: 0,
    mateBefore: null,
    cpAfter: 0,
    mateAfter: null,
    winBefore: 50,
    winAfter: 50,
    epLoss: 0,
    classification: 'best',
    best: { uci: 'e2e4', san: 'e4', cp: 0, mate: null, pv: ['e2e4'] },
    motifs: [],
    accuracy: 100,
    depth: 12,
    ...overrides,
  };
}

describe('keyMoments', () => {
  it('returns empty for no moves', () => {
    expect(findKeyMoments([])).toEqual([]);
  });

  it('includes brilliant moves', () => {
    const moves = [
      makeMoveReport({ ply: 1 }),
      makeMoveReport({ ply: 2, classification: 'brilliant', epLoss: 0 }),
      makeMoveReport({ ply: 3 }),
    ];
    const moments = findKeyMoments(moves);
    expect(moments).toContain(2);
  });

  it('includes blunders', () => {
    const moves = [
      makeMoveReport({ ply: 1 }),
      makeMoveReport({ ply: 2, classification: 'blunder', epLoss: 0.3 }),
      makeMoveReport({ ply: 3 }),
    ];
    const moments = findKeyMoments(moves);
    expect(moments).toContain(2);
  });

  it('includes misses', () => {
    const moves = [
      makeMoveReport({ ply: 1 }),
      makeMoveReport({ ply: 2, classification: 'miss', epLoss: 0.15 }),
      makeMoveReport({ ply: 3 }),
    ];
    const moments = findKeyMoments(moves);
    expect(moments).toContain(2);
  });

  it('fills up to maxMoments with biggest eval swings', () => {
    const moves = [
      makeMoveReport({ ply: 1, epLoss: 0.01 }),
      makeMoveReport({ ply: 2, epLoss: 0.15 }),
      makeMoveReport({ ply: 3, epLoss: 0.02 }),
      makeMoveReport({ ply: 4, epLoss: 0.25 }),
      makeMoveReport({ ply: 5, epLoss: 0.01 }),
    ];
    const moments = findKeyMoments(moves, 3);
    expect(moments).toHaveLength(3);
    expect(moments).toContain(4); // Biggest swing
    expect(moments).toContain(2); // Second biggest
  });

  it('returns sorted by ply', () => {
    const moves = [
      makeMoveReport({ ply: 1 }),
      makeMoveReport({ ply: 5, classification: 'blunder', epLoss: 0.3 }),
      makeMoveReport({ ply: 3, classification: 'brilliant', epLoss: 0 }),
      makeMoveReport({ ply: 7, classification: 'miss', epLoss: 0.2 }),
    ];
    const moments = findKeyMoments(moves, 3);
    expect(moments).toEqual([3, 5, 7]);
  });
});
