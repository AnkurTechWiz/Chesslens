// app/api/coach/route.ts — Stateless Coach Explanation route (disabled by default)
// Per AGENTS.md rule 7 & prompt: Coach commentary is generated 100% offline from
// tactics.ts templates. This endpoint is stateless, does not require an LLM, and
// returns offline template responses by default.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateCoachText, type Motif } from '@/lib/analysis/tactics';
import type { Classification } from '@/lib/types';

const BodySchema = z.object({
  classification: z.string(),
  motifs: z.array(z.string()).default([]),
  bestSan: z.string().optional(),
  playedSan: z.string().optional(),
  phase: z.enum(['opening', 'middlegame', 'endgame']).default('middlegame'),
});

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parseResult = BodySchema.safeParse(json);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { classification, motifs, bestSan, playedSan, phase } = parseResult.data;

    // Use rule-based offline template generator
    const comment = generateCoachText({
      classification: classification as Classification,
      motifs: motifs as Motif[],
      san: playedSan || '',
      bestSan: bestSan || '',
      bestPv: [],
      phase,
      epLoss: 0,
      mateBefore: null,
      mateAfter: null,
      bestMate: null,
    });

    return NextResponse.json({
      comment,
      source: 'template',
      llmEnabled: false,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to generate coach commentary' },
      { status: 500 }
    );
  }
}
