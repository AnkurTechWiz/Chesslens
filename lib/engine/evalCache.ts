// lib/engine/evalCache.ts — IndexedDB eval cache (Phase 2)
//
// Cache key format: sha1(fen)|depth|multipv|engine
// Using a deterministic hash avoids FEN whitespace sensitivity.
// LRU pruning fires when storage is low; durable storage is requested on init.

import { db, requestPersistentStorage } from '../storage/db';
import type { CachedEval, EvalResult } from '../types';

// ── SHA-1 helper ─────────────────────────────────────────────────────────────
// Uses the Web Crypto API (available in all modern browsers and Node 18+).
// Returns a lowercase hex string.

async function sha1hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Build the deterministic cache key for a given request. */
export async function buildCacheKey(
  fen: string,
  depth: number,
  multipv: number,
  engine: string,
): Promise<string> {
  const fenHash = await sha1hex(fen);
  return `${fenHash}|${depth}|${multipv}|${engine}`;
}

// ── Init ─────────────────────────────────────────────────────────────────────

let persistRequested = false;

/**
 * Call once during app startup to request durable storage.
 * Idempotent.
 */
export async function initEvalCache(): Promise<void> {
  if (persistRequested) return;
  persistRequested = true;
  await requestPersistentStorage();
}

// ── Read / Write ──────────────────────────────────────────────────────────────

/**
 * Retrieve cached eval results for a position.
 * Returns an array of `EvalResult` (one per multipv line), or `null` on miss.
 * Updates `lastUsed` timestamps on hit (for LRU tracking).
 */
export async function getCachedEvals(
  fen: string,
  depth: number,
  multipv: number,
  engine: string,
): Promise<EvalResult[] | null> {
  const results: EvalResult[] = [];
  const now = Date.now();

  for (let rank = 1; rank <= multipv; rank++) {
    const key = await buildCacheKey(fen, depth, rank, engine);
    const row = await db.evals.get(key);
    if (!row) return null; // Any line missing → full miss

    // Update LRU timestamp
    await db.evals.update(key, { lastUsed: now });

    results.push({
      multipv: rank,
      fen: row.fen,
      depth: row.depth,
      cp: row.cp,
      mate: row.mate,
      pv: row.pv,
      engine: row.engine,
    });
  }

  return results;
}

/**
 * Store a set of eval results for a position.
 * Each multipv line is stored as a separate row, keyed by rank.
 */
export async function putCachedEvals(results: EvalResult[]): Promise<void> {
  if (results.length === 0) return;
  const now = Date.now();

  const rows: CachedEval[] = await Promise.all(
    results.map(async (r) => {
      const key = await buildCacheKey(r.fen, r.depth, r.multipv, r.engine);
      return {
        key,
        fen: r.fen,
        cp: r.cp,
        mate: r.mate,
        pv: r.pv,
        depth: r.depth,
        multipv: r.multipv,
        engine: r.engine,
        lastUsed: now,
      } satisfies CachedEval;
    }),
  );

  await db.evals.bulkPut(rows);
}

// ── LRU Pruning ───────────────────────────────────────────────────────────────

/** Maximum estimated storage bytes before we prune (default 150 MB). */
const DEFAULT_MAX_CACHE_BYTES = 150 * 1024 * 1024;

/**
 * Prune LRU eval rows when estimated storage usage exceeds `maxBytes`.
 * Removes the oldest 25% of rows by `lastUsed`.
 * Call periodically (e.g. after every batch analysis) or on app startup.
 */
export async function pruneEvalCache(maxBytes = DEFAULT_MAX_CACHE_BYTES): Promise<number> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return 0;

  const { usage = 0, quota = Infinity } = await navigator.storage.estimate();
  const isLow = usage > maxBytes || usage > quota * 0.8;
  if (!isLow) return 0;

  // Collect all rows sorted by lastUsed ascending (oldest first)
  const all = await db.evals.orderBy('lastUsed').toArray();
  const pruneCount = Math.ceil(all.length * 0.25);
  if (pruneCount === 0) return 0;

  const toDelete = all.slice(0, pruneCount).map((r) => r.key);
  await db.evals.bulkDelete(toDelete);
  return toDelete.length;
}

/** Clear all cached evaluations from IndexedDB. */
export async function clearEvalCache(): Promise<void> {
  await db.evals.clear();
}
