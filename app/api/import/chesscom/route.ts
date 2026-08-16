// app/api/import/chesscom/route.ts — Stateless proxy for Chess.com Public API
// Fetches player archives, parses games, and returns sanitized PGN candidates.
// Abides strictly by AGENTS.md: zero server database, purely stateless.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const QuerySchema = z.object({
  username: z.string().trim().min(1).max(50),
  count: z.coerce.number().int().min(1).max(50).default(10),
});

export interface ChessComGameItem {
  url?: string;
  pgn?: string;
  time_control?: string;
  end_time?: number;
  rated?: boolean;
  rules?: string;
  white?: {
    username?: string;
    rating?: number;
    result?: string;
  };
  black?: {
    username?: string;
    rating?: number;
    result?: string;
  };
}

export interface ImportedGameCandidate {
  id: string;
  source: 'chesscom' | 'lichess';
  pgn: string;
  white: string;
  black: string;
  whiteElo?: number;
  blackElo?: number;
  result: string;
  timeControl?: string;
  playedAt: number;
  url?: string;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parseResult = QuerySchema.safeParse({
    username: url.searchParams.get('username'),
    count: url.searchParams.get('count') || undefined,
  });

  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parseResult.error.flatten() },
      { status: 400 },
    );
  }

  const { username, count } = parseResult.data;
  const userAgent = 'ChessLens/1.0 (+https://chesslens.app)';

  try {
    // 1. Fetch archives list
    const archivesRes = await fetch(
      `https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}/games/archives`,
      {
        headers: {
          'User-Agent': userAgent,
          Accept: 'application/json',
        },
        next: { revalidate: 60 },
      },
    );

    if (archivesRes.status === 404) {
      return NextResponse.json(
        { error: `Player "${username}" not found on Chess.com` },
        { status: 404 },
      );
    }

    if (archivesRes.status === 429) {
      return NextResponse.json(
        { error: 'Chess.com rate limit reached. Please wait a moment and try again.' },
        { status: 429 },
      );
    }

    if (!archivesRes.ok) {
      return NextResponse.json(
        { error: `Chess.com API returned status ${archivesRes.status}` },
        { status: archivesRes.status },
      );
    }

    const archivesData = (await archivesRes.json()) as { archives?: string[] };
    const archives = archivesData.archives || [];

    if (archives.length === 0) {
      return NextResponse.json({ games: [] });
    }

    // 2. Fetch the most recent archives in reverse order
    const collectedGames: ImportedGameCandidate[] = [];
    const reversedArchives = [...archives].reverse();

    for (const archiveUrl of reversedArchives) {
      if (collectedGames.length >= count) break;

      const monthRes = await fetch(archiveUrl, {
        headers: {
          'User-Agent': userAgent,
          Accept: 'application/json',
        },
      });

      if (!monthRes.ok) continue;

      const monthData = (await monthRes.json()) as { games?: ChessComGameItem[] };
      const rawGames = monthData.games || [];

      // Most recent games in the month are at the end
      const reversedMonthGames = [...rawGames].reverse();

      for (const g of reversedMonthGames) {
        if (collectedGames.length >= count) break;
        if (g.rules && g.rules !== 'chess') continue; // Standard chess only
        if (!g.pgn) continue;

        let result = '*';
        if (g.white?.result === 'win') result = '1-0';
        else if (g.black?.result === 'win') result = '0-1';
        else if (g.white?.result && ['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'].includes(g.white.result)) {
          result = '1/2-1/2';
        }

        const playedAt = (g.end_time || Math.floor(Date.now() / 1000)) * 1000;
        const gameId = g.url
          ? g.url.split('/').pop() || `chesscom-${playedAt}`
          : `chesscom-${playedAt}-${Math.random().toString(36).substring(2, 7)}`;

        collectedGames.push({
          id: `chesscom-${gameId}`,
          source: 'chesscom',
          pgn: g.pgn,
          white: g.white?.username || 'White',
          black: g.black?.username || 'Black',
          whiteElo: g.white?.rating,
          blackElo: g.black?.rating,
          result,
          timeControl: g.time_control,
          playedAt,
          url: g.url,
        });
      }
    }

    return NextResponse.json({
      username,
      source: 'chesscom',
      total: collectedGames.length,
      games: collectedGames,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch from Chess.com';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
