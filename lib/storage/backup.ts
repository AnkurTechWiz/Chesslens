// lib/storage/backup.ts — Export and Import JSON backups of the local Dexie DB
// No server involved; purely on-device serialization and restoration.

import { z } from 'zod';
import { db } from './db';
import type { SavedGame, TrainerCard, Setting } from '../types';

export const BackupDataSchema = z.object({
  app: z.literal('ChessLens').or(z.literal('openreview')),
  version: z.number().int().positive(),
  exportedAt: z.number().positive(),
  games: z.array(z.record(z.unknown())),
  cards: z.array(z.record(z.unknown())),
  settings: z.array(z.record(z.unknown())),
});

export type BackupData = z.infer<typeof BackupDataSchema>;

export interface ImportResult {
  success: boolean;
  gamesImported: number;
  cardsImported: number;
  settingsImported: number;
  error?: string;
}

/**
 * Generate a complete JSON backup of the user's saved games, trainer cards, and settings.
 * Evals are excluded because they are cached data that can be recomputed.
 */
export async function createBackupPayload(): Promise<string> {
  const [games, cards, settings] = await Promise.all([
    db.games.toArray(),
    db.cards.toArray(),
    db.settings.toArray(),
  ]);

  const payload = {
    app: 'ChessLens',
    version: 1,
    exportedAt: Date.now(),
    games,
    cards,
    settings,
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Initiates a browser file download of the full JSON backup.
 */
export async function exportBackup(): Promise<void> {
  if (typeof window === 'undefined') return;

  const jsonString = await createBackupPayload();
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `chesslens-backup-${dateStr}.json`;

  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Validate and import a backup JSON string into the local IndexedDB.
 * Merges records by primary key (id for games/cards, key for settings) so existing records are updated and never duplicated.
 */
export async function importBackup(jsonString: string): Promise<ImportResult> {
  try {
    const rawParsed = JSON.parse(jsonString);
    const validated = BackupDataSchema.parse(rawParsed);

    const games = validated.games as unknown as SavedGame[];
    const cards = validated.cards as unknown as TrainerCard[];
    const settings = validated.settings as unknown as Setting[];

    await db.transaction('rw', [db.games, db.cards, db.settings], async () => {
      if (games.length > 0) {
        await db.games.bulkPut(games);
      }
      if (cards.length > 0) {
        await db.cards.bulkPut(cards);
      }
      if (settings.length > 0) {
        await db.settings.bulkPut(settings);
      }
    });

    return {
      success: true,
      gamesImported: games.length,
      cardsImported: cards.length,
      settingsImported: settings.length,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Invalid backup format or schema';
    return {
      success: false,
      gamesImported: 0,
      cardsImported: 0,
      settingsImported: 0,
      error: message,
    };
  }
}
