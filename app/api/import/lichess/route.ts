// app/api/import/lichess/route.ts — Stateless proxy for Lichess Public API
// Fetches games for a username in PGN format with clocks & opening info.
// Abides strictly by AGENTS.md: zero server database, purely stateless proxy.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { splitMultiGamePgn, parsePgnHeaders } from '@/lib/pgn/parse';
import type { ImportedGameCandidate } from '../chesscom/route';

const QuerySchema = z.object({
  username: z.string().trim().min(1).max(50),
  count: z.coerce.number().int().min(1).max(50).default(10),
});

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
    const lichessRes = await fetch(
      `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${count}&clocks=true&evals=true&opening=true`,
      {
        headers: {
          'User-Agent': userAgent,
          Accept: 'application/x-chess-pgn',
        },
        next: { revalidate: 60 },
      },
    );

    if (lichessRes.status === 404) {
      return NextResponse.json(
        { error: `Player "${username}" not found on Lichess` },
        { status: 404 },
      );
    }

    if (lichessRes.status === 429) {
      return NextResponse.json(
        { error: 'Lichess rate limit reached. Please wait a moment and try again.' },
        { status: 429 },
      );
    }

    if (!lichessRes.ok) {
      return NextResponse.json(
        { error: `Lichess API returned status ${lichessRes.status}` },
        { status: lichessRes.status },
      );
    }

    const pgnText = await lichessRes.text();
    const rawGames = splitMultiGamePgn(pgnText);

    const collectedGames: ImportedGameCandidate[] = [];

    for (let i = 0; i < rawGames.length && collectedGames.length < count; i++) {
      const pgn = rawGames[i];
      if (!pgn || !pgn.trim()) continue;

      const headers = parsePgnHeaders(pgn);
      const site = (headers.Site as string) || '';
      const lichessId = site ? site.split('/').pop() || `lichess-${i}` : `lichess-${i}`;

      const playedAtStr = (headers.UTCDate as string) || (headers.Date as string);
      const playedAt = playedAtStr ? new Date(playedAtStr.replace(/\./g, '-')).getTime() || Date.now() : Date.now();

      const whiteElo = typeof headers.WhiteElo === 'number' ? headers.WhiteElo : undefined;
      const blackElo = typeof headers.BlackElo === 'number' ? headers.BlackElo : undefined;

      collectedGames.push({
        id: `lichess-${lichessId}`,
        source: 'lichess',
        pgn,
        white: (headers.White as string) || 'White',
        black: (headers.Black as string) || 'Black',
        whiteElo,
        blackElo,
        result: (headers.Result as string) || '*',
        timeControl: (headers.TimeControl as string) || undefined,
        playedAt,
        url: site || undefined,
      });
    }

    return NextResponse.json({
      username,
      source: 'lichess',
      total: collectedGames.length,
      games: collectedGames,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch from Lichess';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
