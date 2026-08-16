// lib/store/settingsStore.ts — Settings Zustand Store with Dexie persistence (Phase 6)

import { create } from 'zustand';
import { db } from '@/lib/storage/db';
import { soundManager } from '@/lib/sound/soundManager';

export type BoardTheme = 'green' | 'slate' | 'wood' | 'ocean' | 'amber';
export type PieceSet = 'cburnett' | 'classic' | 'modern';
export type CoachVerbosity = 'concise' | 'detailed' | 'bullet';

export interface SettingsState {
  boardTheme: BoardTheme;
  pieceSet: PieceSet;
  soundVolume: number;
  soundMuted: boolean;
  analysisDepth: number;
  showArrows: boolean;
  coachVerbosity: CoachVerbosity;
  reducedMotion: boolean;
  isLoaded: boolean;

  setBoardTheme: (theme: BoardTheme) => void;
  setPieceSet: (pieceSet: PieceSet) => void;
  setSoundVolume: (volume: number) => void;
  setSoundMuted: (muted: boolean) => void;
  setAnalysisDepth: (depth: number) => void;
  setShowArrows: (show: boolean) => void;
  setCoachVerbosity: (verbosity: CoachVerbosity) => void;
  setReducedMotion: (reduced: boolean) => void;
  clearEvalCache: () => Promise<number>;
  loadSettings: () => Promise<void>;
}

const DEFAULT_SETTINGS = {
  boardTheme: 'green' as BoardTheme,
  pieceSet: 'cburnett' as PieceSet,
  soundVolume: 0.7,
  soundMuted: false,
  analysisDepth: 12,
  showArrows: true,
  coachVerbosity: 'concise' as CoachVerbosity,
  reducedMotion: false,
};

async function persistSetting(key: string, value: unknown) {
  try {
    await db.settings.put({ key, value });
  } catch (err) {
    console.warn('[Settings] Failed to persist setting:', key, err);
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  isLoaded: false,

  setBoardTheme: (boardTheme) => {
    set({ boardTheme });
    persistSetting('boardTheme', boardTheme);
  },

  setPieceSet: (pieceSet) => {
    set({ pieceSet });
    persistSetting('pieceSet', pieceSet);
  },

  setSoundVolume: (soundVolume) => {
    const clamped = Math.max(0, Math.min(1, soundVolume));
    set({ soundVolume: clamped });
    soundManager.setVolume(clamped);
    persistSetting('soundVolume', clamped);
  },

  setSoundMuted: (soundMuted) => {
    set({ soundMuted });
    soundManager.setMuted(soundMuted);
    persistSetting('soundMuted', soundMuted);
  },

  setAnalysisDepth: (analysisDepth) => {
    const clamped = Math.max(10, Math.min(22, analysisDepth));
    set({ analysisDepth: clamped });
    persistSetting('analysisDepth', clamped);
  },

  setShowArrows: (showArrows) => {
    set({ showArrows });
    persistSetting('showArrows', showArrows);
  },

  setCoachVerbosity: (coachVerbosity) => {
    set({ coachVerbosity });
    persistSetting('coachVerbosity', coachVerbosity);
  },

  setReducedMotion: (reducedMotion) => {
    set({ reducedMotion });
    persistSetting('reducedMotion', reducedMotion);
  },

  clearEvalCache: async () => {
    try {
      const count = await db.evals.count();
      await db.evals.clear();
      return count;
    } catch (err) {
      console.error('[Settings] Failed to clear eval cache:', err);
      return 0;
    }
  },

  loadSettings: async () => {
    if (get().isLoaded) return;
    try {
      const rows = await db.settings.toArray();
      const settingsMap: Record<string, unknown> = {};
      for (const row of rows) {
        settingsMap[row.key] = row.value;
      }

      const boardTheme = (settingsMap.boardTheme as BoardTheme) || DEFAULT_SETTINGS.boardTheme;
      const pieceSet = (settingsMap.pieceSet as PieceSet) || DEFAULT_SETTINGS.pieceSet;
      const soundVolume = typeof settingsMap.soundVolume === 'number' ? settingsMap.soundVolume : DEFAULT_SETTINGS.soundVolume;
      const soundMuted = typeof settingsMap.soundMuted === 'boolean' ? settingsMap.soundMuted : DEFAULT_SETTINGS.soundMuted;
      const analysisDepth = typeof settingsMap.analysisDepth === 'number' ? settingsMap.analysisDepth : DEFAULT_SETTINGS.analysisDepth;
      const showArrows = typeof settingsMap.showArrows === 'boolean' ? settingsMap.showArrows : DEFAULT_SETTINGS.showArrows;
      const coachVerbosity = (settingsMap.coachVerbosity as CoachVerbosity) || DEFAULT_SETTINGS.coachVerbosity;
      const reducedMotion = typeof settingsMap.reducedMotion === 'boolean' ? settingsMap.reducedMotion : DEFAULT_SETTINGS.reducedMotion;

      // Synchronize sound manager
      soundManager.setVolume(soundVolume);
      soundManager.setMuted(soundMuted);

      set({
        boardTheme,
        pieceSet,
        soundVolume,
        soundMuted,
        analysisDepth,
        showArrows,
        coachVerbosity,
        reducedMotion,
        isLoaded: true,
      });
    } catch (err) {
      console.warn('[Settings] Failed to load settings from Dexie:', err);
      set({ isLoaded: true });
    }
  },
}));
