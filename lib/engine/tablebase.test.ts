import { describe, it, expect, vi, beforeEach } from 'vitest';
import { countPieces, fetchTablebaseVerdict } from './tablebase';

describe('tablebase client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly counts pieces in FEN', () => {
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    expect(countPieces(startFen)).toBe(32);

    const endgameFen = '8/8/4k3/8/8/4K3/4P3/8 w - - 0 1'; // 3 pieces: K, k, P
    expect(countPieces(endgameFen)).toBe(3);
  });

  it('skips fetching for >7 pieces and returns null', async () => {
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const verdict = await fetchTablebaseVerdict(startFen);
    expect(verdict).toBeNull();
  });

  it('parses valid tablebase response', async () => {
    const endgameFen = '8/8/4k3/8/8/4K3/4P3/8 w - - 0 1';
    
    // Mock global fetch
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        category: 'win',
        dtz: 14,
        dtm: 29,
        checkmate: false,
        stalemate: false,
        moves: [{ uci: 'e3e4', san: 'Ke4' }],
      }),
    }));

    const verdict = await fetchTablebaseVerdict(endgameFen);
    expect(verdict).toBeDefined();
    expect(verdict?.category).toBe('win');
    expect(verdict?.dtz).toBe(14);
    expect(verdict?.dtm).toBe(29);
    expect(verdict?.bestSan).toBe('Ke4');
  });

  it('degrades silently on network/offline failure', async () => {
    const endgameFen = '8/8/4k3/8/8/4K3/4P3/8 w - - 0 1';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network offline')));

    const verdict = await fetchTablebaseVerdict(endgameFen);
    expect(verdict).toBeNull();
  });
});
