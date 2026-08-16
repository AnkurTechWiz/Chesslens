// lib/store/batchStore.ts — State management for batch game imports and worker queue review
// Abides strictly by AGENTS.md: zero server database, purely client-side Web Worker analysis.

import { create } from 'zustand';
import type { ImportedGameCandidate } from '@/app/api/import/chesscom/route';
import { parsePgn } from '../pgn/parse';
import { analyzeGame } from '../analysis/pipeline';
import { getEnginePool } from '../engine/enginePool';
import { db } from '../storage/db';
import { createCardsFromGameReport } from '../storage/trainer';
import type { SavedGame } from '../types';

export interface BatchState {
  isModalOpen: boolean;
  platform: 'chesscom' | 'lichess';
  username: string;
  count: number;
  isLoading: boolean;
  error: string | null;
  candidates: ImportedGameCandidate[];
  selectedIds: string[];
  isProcessing: boolean;
  processingGameIndex: number;
  totalGamesToProcess: number;
  currentPly: number;
  totalPlies: number;
  analyzedCount: number;

  // Actions
  openModal: (platform?: 'chesscom' | 'lichess') => void;
  closeModal: () => void;
  setPlatform: (platform: 'chesscom' | 'lichess') => void;
  setUsername: (username: string) => void;
  setCount: (count: number) => void;
  fetchGames: () => Promise<void>;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  startBatchAnalysis: () => Promise<void>;
  cancelBatchAnalysis: () => void;
}

let batchAbortController: AbortController | null = null;

export const useBatchStore = create<BatchState>((set, get) => ({
  isModalOpen: false,
  platform: 'chesscom',
  username: '',
  count: 10,
  isLoading: false,
  error: null,
  candidates: [],
  selectedIds: [],
  isProcessing: false,
  processingGameIndex: 0,
  totalGamesToProcess: 0,
  currentPly: 0,
  totalPlies: 0,
  analyzedCount: 0,

  openModal: (platform = 'chesscom') => {
    set({ isModalOpen: true, platform, error: null });
  },

  closeModal: () => {
    set({ isModalOpen: false, error: null });
  },

  setPlatform: (platform) => set({ platform, error: null }),
  setUsername: (username) => set({ username, error: null }),
  setCount: (count) => set({ count }),

  fetchGames: async () => {
    const { platform, username, count } = get();
    if (!username.trim()) {
      set({ error: 'Please enter a username' });
      return;
    }

    set({ isLoading: true, error: null, candidates: [], selectedIds: [] });

    try {
      const res = await fetch(
        `/api/import/${platform}?username=${encodeURIComponent(username.trim())}&count=${count}`,
      );
      const data = await res.json();

      if (!res.ok) {
        set({
          isLoading: false,
          error: data.error || `Failed to fetch games from ${platform}`,
        });
        return;
      }

      const fetchedGames: ImportedGameCandidate[] = data.games || [];
      const allIds = fetchedGames.map((g) => g.id);

      set({
        isLoading: false,
        candidates: fetchedGames,
        selectedIds: allIds, // Select all by default
        error: fetchedGames.length === 0 ? 'No games found for this user.' : null,
      });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Network request failed',
      });
    }
  },

  toggleSelect: (id: string) => {
    const { selectedIds } = get();
    const isSelected = selectedIds.includes(id);
    const updated = isSelected
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    set({ selectedIds: updated });
  },

  selectAll: () => {
    const { candidates } = get();
    set({ selectedIds: candidates.map((c) => c.id) });
  },

  deselectAll: () => {
    set({ selectedIds: [] });
  },

  startBatchAnalysis: async () => {
    const { candidates, selectedIds } = get();
    const gamesToAnalyze = candidates.filter((c) => selectedIds.includes(c.id));

    if (gamesToAnalyze.length === 0) return;

    if (batchAbortController) {
      batchAbortController.abort();
    }
    const abortController = new AbortController();
    batchAbortController = abortController;

    set({
      isProcessing: true,
      processingGameIndex: 0,
      totalGamesToProcess: gamesToAnalyze.length,
      currentPly: 0,
      totalPlies: 0,
      analyzedCount: 0,
      error: null,
    });

    const engine = getEnginePool();

    try {
      for (let i = 0; i < gamesToAnalyze.length; i++) {
        if (abortController.signal.aborted) break;

        const candidate = gamesToAnalyze[i];
        const parsed = parsePgn(candidate.pgn);

        if (!parsed || parsed.moves.length === 0) {
          continue;
        }

        set({
          processingGameIndex: i + 1,
          currentPly: 0,
          totalPlies: parsed.moves.length,
        });

        const report = await analyzeGame(parsed, engine, {
          signal: abortController.signal,
          onProgress: (ply, total) => {
            set({
              currentPly: ply,
              totalPlies: total,
            });
          },
        });

        if (abortController.signal.aborted) break;

        const now = Date.now();
        const savedGame: SavedGame = {
          id: candidate.id,
          pgn: candidate.pgn,
          white: candidate.white,
          black: candidate.black,
          whiteElo: candidate.whiteElo,
          blackElo: candidate.blackElo,
          result: candidate.result,
          eco: report.opening.eco,
          opening: report.opening.name,
          timeControl: candidate.timeControl,
          playedAt: candidate.playedAt || now,
          source: candidate.source,
          report,
          engineVersion: 'sf18',
          depth: 12,
          createdAt: now,
        };

        // Save reviewed game to Dexie
        await db.games.put(savedGame);

        // Extract blunders and populate trainer deck
        await createCardsFromGameReport(savedGame.id, report);

        set((state) => ({ analyzedCount: state.analyzedCount + 1 }));
      }

      set({
        isProcessing: false,
        isModalOpen: false,
      });
    } catch (err: unknown) {
      if (!abortController.signal.aborted) {
        set({
          isProcessing: false,
          error: err instanceof Error ? err.message : 'Batch analysis failed',
        });
      } else {
        set({ isProcessing: false });
      }
    } finally {
      batchAbortController = null;
    }
  },

  cancelBatchAnalysis: () => {
    if (batchAbortController) {
      batchAbortController.abort();
      batchAbortController = null;
    }
    set({ isProcessing: false });
  },
}));
