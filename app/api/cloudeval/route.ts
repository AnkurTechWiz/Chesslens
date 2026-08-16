// app/api/cloudeval/route.ts — Stateless proxy to Lichess Cloud Eval API
// Purity/Constraint rule: Zero DB/disk writes. In-memory LRU only. Degrades silently offline.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const QuerySchema = z.object({
  fen: z.string().min(10).max(120),
  multiPv: z.coerce.number().min(1).max(5).default(1),
});

// In-memory LRU cache for function instance
const cloudEvalLru = new Map<string, unknown>();
const MAX_LRU_SIZE = 500;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parseResult = QuerySchema.safeParse({
      fen: searchParams.get('fen'),
      multiPv: searchParams.get('multiPv'),
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { fen, multiPv } = parseResult.data;
    const cacheKey = `${fen}|${multiPv}`;

    // Check in-memory cache
    if (cloudEvalLru.has(cacheKey)) {
      return NextResponse.json(cloudEvalLru.get(cacheKey));
    }

    // Fetch from Lichess Cloud Eval API
    const upstreamUrl = `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=${multiPv}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500); // 3.5s timeout

    try {
      const response = await fetch(upstreamUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'ChessLens/1.0 (Free Game Review)',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.status === 404) {
        return NextResponse.json({ error: 'No cloud eval available', found: false }, { status: 404 });
      }

      if (!response.ok) {
        return NextResponse.json(
          { error: `Upstream returned ${response.status}`, ok: false },
          { status: 502 }
        );
      }

      const data = await response.json();

      // LRU cache insertion
      if (cloudEvalLru.size >= MAX_LRU_SIZE) {
        const firstKey = cloudEvalLru.keys().next().value;
        if (firstKey) cloudEvalLru.delete(firstKey);
      }
      cloudEvalLru.set(cacheKey, data);

      return NextResponse.json(data);
    } catch {
      clearTimeout(timeout);
      return NextResponse.json(
        { error: 'Cloud eval upstream unreachable or offline', ok: false },
        { status: 503 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: 'Internal error processing cloud eval request', ok: false },
      { status: 500 }
    );
  }
}
