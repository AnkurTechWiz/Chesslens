// app/api/tablebase/route.ts — Stateless proxy to Lichess Endgame Tablebase API (≤7 pieces)
// Purity/Constraint rule: Zero DB/disk writes. In-memory LRU only. Degrades silently offline.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const QuerySchema = z.object({
  fen: z.string().min(10).max(120),
});

// In-memory LRU cache for function instance
const tablebaseLru = new Map<string, unknown>();
const MAX_LRU_SIZE = 500;

function countPiecesInFen(fen: string): number {
  const boardPart = fen.split(' ')[0] || '';
  let pieceCount = 0;
  for (const ch of boardPart) {
    if (ch !== '/' && isNaN(parseInt(ch, 10))) {
      pieceCount++;
    }
  }
  return pieceCount;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parseResult = QuerySchema.safeParse({
      fen: searchParams.get('fen'),
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid FEN parameter', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { fen } = parseResult.data;
    const pieceCount = countPiecesInFen(fen);

    if (pieceCount > 7) {
      return NextResponse.json(
        { error: 'Tablebase only supports positions with ≤ 7 pieces', supported: false },
        { status: 400 }
      );
    }

    // Check in-memory cache
    if (tablebaseLru.has(fen)) {
      return NextResponse.json(tablebaseLru.get(fen));
    }

    // Fetch from Lichess Tablebase API
    const upstreamUrl = `https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000); // 4s timeout

    try {
      const response = await fetch(upstreamUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'ChessLens/1.0 (Free Game Review)',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return NextResponse.json(
          { error: `Upstream tablebase returned ${response.status}`, ok: false },
          { status: 502 }
        );
      }

      const data = await response.json();

      // LRU cache insertion
      if (tablebaseLru.size >= MAX_LRU_SIZE) {
        const firstKey = tablebaseLru.keys().next().value;
        if (firstKey) tablebaseLru.delete(firstKey);
      }
      tablebaseLru.set(fen, data);

      return NextResponse.json(data);
    } catch {
      clearTimeout(timeout);
      return NextResponse.json(
        { error: 'Tablebase upstream unreachable or offline', ok: false },
        { status: 503 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: 'Internal error processing tablebase request', ok: false },
      { status: 500 }
    );
  }
}
