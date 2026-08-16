import { create } from 'zustand';
import type { GameReport, MoveReport } from '../types';
import type { ParsedGame } from '../pgn/parse';
import { analyzeGame } from '../analysis/pipeline';
import { getEnginePool } from '../engine/enginePool';
import { useGameStore } from './gameStore';
import { useSettingsStore } from './settingsStore';

export type ReviewStatus = 'idle' | 'analyzing' | 'done' | 'error';
export type ReviewTab = 'summary' | 'moves' | 'moments';

export interface AnalysisProgressInfo {
  ply: number;
  total: number;
  percent: number;
  currentPass: 'scan' | 'verify';
}

export interface ReviewState {
  status: ReviewStatus;
  gameReport: GameReport | null;
  partialReports: MoveReport[];
  progress: AnalysisProgressInfo | null;
  error: string | null;
  activeTab: ReviewTab;
  showArrows: boolean;
  showEngineLines: boolean;
  debugMode: boolean;
  isFollowingAnalysis: boolean;

  // Actions
  startAnalysis: (game: ParsedGame, playerRating?: number) => Promise<void>;
  cancelAnalysis: () => void;
  pauseFollow: () => void;
  resumeFollow: () => void;
  setFollowAnalysis: (follow: boolean) => void;
  setActiveTab: (tab: ReviewTab) => void;
  toggleArrows: () => void;
  setShowArrows: (show: boolean) => void;
  toggleEngineLines: () => void;
  setShowEngineLines: (show: boolean) => void;
  setDebugMode: (debug: boolean) => void;
  clearReview: () => void;
}

let activeAbortController: AbortController | null = null;
const PLAYBACK_STEP_MS = 140;

let playbackTimer: ReturnType<typeof setTimeout> | null = null;
let currentPlaybackPly = 0;
let targetPlaybackPly = 0;
let isAnalysisDone = false;
let isAnimatingStep = false;

function stopPlaybackRunner() {
  if (playbackTimer) {
    clearTimeout(playbackTimer);
    playbackTimer = null;
  }
  isAnimatingStep = false;
}

function checkReducedMotion(): boolean {
  try {
    const fromSettings = useSettingsStore.getState().reducedMotion;
    if (fromSettings) return true;
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  } catch {
    // fallback
  }
  return false;
}

function tickPlaybackRunner() {
  stopPlaybackRunner();

  const state = useReviewStore.getState();
  if (!state.isFollowingAnalysis || (state.status !== 'analyzing' && !isAnalysisDone)) {
    return;
  }

  const reducedMotion = checkReducedMotion();

  if (currentPlaybackPly < targetPlaybackPly) {
    if (reducedMotion) {
      currentPlaybackPly = targetPlaybackPly;
      useGameStore.getState().jumpToPly(currentPlaybackPly, false, true);
    } else {
      currentPlaybackPly += 1;
      useGameStore.getState().jumpToPly(currentPlaybackPly, false, true);
    }

    const nextDelay = reducedMotion ? 40 : PLAYBACK_STEP_MS;
    isAnimatingStep = true;
    playbackTimer = setTimeout(() => {
      isAnimatingStep = false;
      tickPlaybackRunner();
    }, nextDelay);
  } else {
    // currentPlaybackPly === targetPlaybackPly
    isAnimatingStep = false;
    if (isAnalysisDone) {
      // Completed all moves!
      if (useReviewStore.getState().isFollowingAnalysis) {
        useGameStore.getState().jumpToPly(0, false, true);
        useReviewStore.setState({ isFollowingAnalysis: false });
      }
    } else {
      // Waiting for next batch of plies from analysis
      playbackTimer = setTimeout(() => {
        tickPlaybackRunner();
      }, 80);
    }
  }
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  status: 'idle',
  gameReport: null,
  partialReports: [],
  progress: null,
  error: null,
  activeTab: 'summary',
  showArrows: true,
  showEngineLines: false,
  debugMode: false,
  isFollowingAnalysis: false,

  startAnalysis: async (game: ParsedGame, playerRating = 1500) => {
    if (!game || game.moves.length === 0) return;

    // Cancel any ongoing analysis
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }

    stopPlaybackRunner();
    currentPlaybackPly = 0;
    targetPlaybackPly = 0;
    isAnalysisDone = false;

    // Reset board to starting position
    useGameStore.getState().jumpToPly(0, false, true);

    const abortController = new AbortController();
    activeAbortController = abortController;

    const totalPlies = game.moves.length;

    set({
      status: 'analyzing',
      isFollowingAnalysis: true,
      gameReport: null,
      partialReports: [],
      error: null,
      progress: {
        ply: 0,
        total: totalPlies,
        percent: 0,
        currentPass: 'scan',
      },
    });

    // Start playback runner
    tickPlaybackRunner();

    try {
      const engine = getEnginePool();

      const report = await analyzeGame(game, engine, {
        playerRating,
        signal: abortController.signal,
        onProgress: (ply, total, partial) => {
          // Streamed in order
          const currentPartial = get().partialReports;
          const updated = [...currentPartial];
          // Ensure at correct index (ply - 1)
          updated[ply - 1] = partial;

          targetPlaybackPly = Math.max(targetPlaybackPly, ply);

          set({
            partialReports: updated,
            progress: {
              ply,
              total,
              percent: Math.min(100, Math.round((ply / total) * 100)),
              currentPass: ply < total ? 'scan' : 'verify',
            },
          });

          // Wake runner if following and idle
          if (get().isFollowingAnalysis) {
            if (!playbackTimer || !isAnimatingStep) {
              tickPlaybackRunner();
            }
          }
        },
      });

      if (activeAbortController === abortController) {
        isAnalysisDone = true;
        targetPlaybackPly = report.moves.length;

        set({
          status: 'done',
          gameReport: report,
          partialReports: report.moves,
          progress: {
            ply: totalPlies,
            total: totalPlies,
            percent: 100,
            currentPass: 'verify',
          },
        });
        activeAbortController = null;

        // If playback caught up or reduced motion, finish up
        if (currentPlaybackPly >= targetPlaybackPly) {
          if (get().isFollowingAnalysis) {
            useGameStore.getState().jumpToPly(0, false, true);
            set({ isFollowingAnalysis: false });
          }
          stopPlaybackRunner();
        } else if (get().isFollowingAnalysis) {
          if (!playbackTimer) {
            tickPlaybackRunner();
          }
        }
      }
    } catch (err: unknown) {
      if (activeAbortController === abortController) {
        stopPlaybackRunner();
        isAnalysisDone = false;
        const isAbort =
          err instanceof DOMException && err.name === 'AbortError';
        if (!isAbort) {
          const message =
            err instanceof Error ? err.message : 'Analysis failed unexpectedly';
          set({
            status: 'error',
            isFollowingAnalysis: false,
            error: message,
          });
        } else {
          set({
            status: 'idle',
            isFollowingAnalysis: false,
            progress: null,
          });
        }
        activeAbortController = null;
      }
    }
  },

  pauseFollow: () => {
    stopPlaybackRunner();
    set({ isFollowingAnalysis: false });
  },

  resumeFollow: () => {
    const { status } = get();
    if (status === 'analyzing') {
      set({ isFollowingAnalysis: true });
      currentPlaybackPly = useGameStore.getState().currentPly;
      tickPlaybackRunner();
    }
  },

  setFollowAnalysis: (follow: boolean) => {
    if (follow) {
      get().resumeFollow();
    } else {
      get().pauseFollow();
    }
  },

  cancelAnalysis: () => {
    stopPlaybackRunner();
    isAnalysisDone = false;
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    set({
      status: 'idle',
      isFollowingAnalysis: false,
      progress: null,
    });
  },

  setActiveTab: (tab: ReviewTab) => {
    set({ activeTab: tab });
  },

  toggleArrows: () => {
    set((state) => ({ showArrows: !state.showArrows }));
  },

  setShowArrows: (show: boolean) => {
    set({ showArrows: show });
  },

  toggleEngineLines: () => {
    set((state) => ({ showEngineLines: !state.showEngineLines }));
  },

  setShowEngineLines: (show: boolean) => {
    set({ showEngineLines: show });
  },

  setDebugMode: (debug: boolean) => {
    set({ debugMode: debug });
  },

  clearReview: () => {
    stopPlaybackRunner();
    isAnalysisDone = false;
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    set({
      status: 'idle',
      isFollowingAnalysis: false,
      gameReport: null,
      partialReports: [],
      progress: null,
      error: null,
    });
  },
}));
