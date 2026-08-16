// lib/storage/db.ts — ChessLens IndexedDB schema via Dexie
// All user data lives here, entirely client-side. No server, no auth.
// See docs/IMPLEMENTATION_PLAN.md §6 for the full schema spec.

import Dexie, { type Table } from 'dexie';
import type { CachedEval, SavedGame, TrainerCard, Setting } from '../types';

class ChessLensDB extends Dexie {
  games!: Table<SavedGame, string>;
  evals!: Table<CachedEval, string>;
  cards!: Table<TrainerCard, string>;
  settings!: Table<Setting, string>;

  constructor() {
    super('chesslens');
    this.version(1).stores({
      // Primary key first, then indexed fields.
      games: 'id, playedAt, createdAt, white, black, eco',
      evals: 'key, lastUsed',
      cards: 'id, dueAt, gameId, classification',
      settings: 'key',
    });
  }
}

export const db = new ChessLensDB();

/**
 * Request durable (non-evictable) storage if the browser supports it.
 * Call once during app initialization; idempotent.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  if (!navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
