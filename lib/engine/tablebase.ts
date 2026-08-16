// lib/engine/tablebase.ts — Client-side tablebase client for <= 7 piece endgame positions
// Fetches from /api/tablebase with automatic offline graceful degradation.

export interface TablebaseVerdict {
  category: 'win' | 'loss' | 'draw' | 'mate' | 'unknown';
  dtz: number | null;
  dtm: number | null;
  checkmate: boolean;
  stalemate: boolean;
  bestUci?: string;
  bestSan?: string;
}

export function countPieces(fen: string): number {
  const boardPart = fen.split(' ')[0] || '';
  let count = 0;
  for (const ch of boardPart) {
    if (ch !== '/' && isNaN(parseInt(ch, 10))) {
      count++;
    }
  }
  return count;
}

/**
 * Fetch exact endgame tablebase evaluation if position has <= 7 pieces.
 * Returns null if unsupported, offline, or unavailable.
 */
export async function fetchTablebaseVerdict(fen: string): Promise<TablebaseVerdict | null> {
  try {
    if (typeof fetch === 'undefined') return null;
    if (countPieces(fen) > 7) return null;

    const res = await fetch(`/api/tablebase?fen=${encodeURIComponent(fen)}`);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data || data.ok === false || data.error) return null;

    let category: TablebaseVerdict['category'] = 'unknown';
    if (data.category === 'win' || data.category === 'loss' || data.category === 'draw' || data.category === 'mate') {
      category = data.category;
    } else if (data.dtz === 0 && data.checkmate) {
      category = 'mate';
    } else if (data.dtz === 0 && data.stalemate) {
      category = 'draw';
    } else if (typeof data.dtz === 'number') {
      category = data.dtz > 0 ? 'win' : data.dtz < 0 ? 'loss' : 'draw';
    }

    const topMove = Array.isArray(data.moves) && data.moves.length > 0 ? data.moves[0] : undefined;

    return {
      category,
      dtz: typeof data.dtz === 'number' ? data.dtz : null,
      dtm: typeof data.dtm === 'number' ? data.dtm : null,
      checkmate: Boolean(data.checkmate),
      stalemate: Boolean(data.stalemate),
      bestUci: topMove?.uci,
      bestSan: topMove?.san,
    };
  } catch {
    // Offline or network error: degrade silently
    return null;
  }
}
