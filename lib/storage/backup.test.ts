// lib/storage/backup.test.ts — Tests for JSON backup export/import and schema validation

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SavedGame, TrainerCard, Setting } from '../types';

const mockGames: SavedGame[] = [];
const mockCards: TrainerCard[] = [];
const mockSettings: Setting[] = [];

vi.mock('./db', () => ({
  db: {
    games: {
      toArray: vi.fn(async () => [...mockGames]),
      bulkPut: vi.fn(async (items: SavedGame[]) => {
        for (const item of items) {
          const idx = mockGames.findIndex((g) => g.id === item.id);
          if (idx >= 0) mockGames[idx] = item;
          else mockGames.push(item);
        }
      }),
    },
    cards: {
      toArray: vi.fn(async () => [...mockCards]),
      bulkPut: vi.fn(async (items: TrainerCard[]) => {
        for (const item of items) {
          const idx = mockCards.findIndex((c) => c.id === item.id);
          if (idx >= 0) mockCards[idx] = item;
          else mockCards.push(item);
        }
      }),
    },
    settings: {
      toArray: vi.fn(async () => [...mockSettings]),
      bulkPut: vi.fn(async (items: Setting[]) => {
        for (const item of items) {
          const idx = mockSettings.findIndex((s) => s.key === item.key);
          if (idx >= 0) mockSettings[idx] = item;
          else mockSettings.push(item);
        }
      }),
    },
    transaction: vi.fn(async (_mode, _tables, callback) => {
      return callback();
    }),
  },
}));

import { createBackupPayload, importBackup, BackupDataSchema } from './backup';

beforeEach(() => {
  mockGames.length = 0;
  mockCards.length = 0;
  mockSettings.length = 0;
});

describe('Backup Subsystem', () => {
  it('creates a valid JSON backup payload adhering to schema', async () => {
    mockGames.push({
      id: 'game-1',
      pgn: '1. e4 e5',
      white: 'Magnus',
      black: 'Hikaru',
      result: '1-0',
      source: 'paste',
      report: {} as unknown as SavedGame['report'],
      engineVersion: 'sf18',
      depth: 12,
      createdAt: 1700000000000,
    });

    mockCards.push({
      id: 'card-1',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      solutionUci: 'e2e4',
      pv: ['e2e4', 'e7e5'],
      motifs: ['opening'],
      classification: 'blunder',
      ease: 2.5,
      interval: 1,
      reps: 0,
      dueAt: 1700000000000,
      createdAt: 1700000000000,
    });

    mockSettings.push({
      key: 'soundMuted',
      value: false,
    });

    const payload = await createBackupPayload();
    expect(typeof payload).toBe('string');

    const parsed = JSON.parse(payload);
    expect(parsed.app).toBe('ChessLens');
    expect(parsed.version).toBe(1);
    expect(parsed.games).toHaveLength(1);
    expect(parsed.cards).toHaveLength(1);
    expect(parsed.settings).toHaveLength(1);

    const validated = BackupDataSchema.safeParse(parsed);
    expect(validated.success).toBe(true);
  });

  it('imports valid backup and merges into Dexie collections', async () => {
    const backupJson = JSON.stringify({
      app: 'ChessLens',
      version: 1,
      exportedAt: Date.now(),
      games: [
        {
          id: 'imported-game-1',
          pgn: '1. d4 d5',
          white: 'Ding',
          black: 'Nepo',
          result: '1/2-1/2',
          source: 'lichess',
          createdAt: 1700000000000,
        },
      ],
      cards: [
        {
          id: 'imported-card-1',
          fen: '8/8/8/8/8/8/8/8 w - - 0 1',
          solutionUci: 'a1a8',
          pv: ['a1a8'],
          motifs: ['endgame'],
          classification: 'miss',
          ease: 2.5,
          interval: 1,
          reps: 0,
          dueAt: 1700000000000,
          createdAt: 1700000000000,
        },
      ],
      settings: [
        {
          key: 'boardTheme',
          value: 'emerald',
        },
      ],
    });

    const result = await importBackup(backupJson);
    expect(result.success).toBe(true);
    expect(result.gamesImported).toBe(1);
    expect(result.cardsImported).toBe(1);
    expect(result.settingsImported).toBe(1);

    expect(mockGames).toHaveLength(1);
    expect(mockGames[0].id).toBe('imported-game-1');
    expect(mockCards).toHaveLength(1);
    expect(mockSettings).toHaveLength(1);
  });

  it('rejects invalid backup schemas safely without throwing unhandled exceptions', async () => {
    const invalidJson = JSON.stringify({
      app: 'UnrecognizedApp',
      version: 'not-a-number',
    });

    const result = await importBackup(invalidJson);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.gamesImported).toBe(0);
  });

  it('handles malformed non-JSON input gracefully', async () => {
    const result = await importBackup('<html><body>Not JSON</body></html>');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
