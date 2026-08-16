// lib/store/reviewStore.test.ts — Unit tests for analysis playback & follow behavior

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useReviewStore } from './reviewStore';
import { useGameStore } from './gameStore';
import { useSettingsStore } from './settingsStore';
import { parsePgn } from '../pgn/parse';
import type { MoveReport, GameReport } from '../types';

// Mock analyzeGame to control progression
vi.mock('../analysis/pipeline', () => ({
  analyzeGame: vi.fn(),
}));

import { analyzeGame } from '../analysis/pipeline';

const SAMPLE_PGN = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6';

const createMockMoveReport = (ply: number, san: string): MoveReport => ({
  ply,
  san,
  uci: 'e2e4',
  fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
  cpBefore: 30,
  mateBefore: null,
  cpAfter: 30,
  mateAfter: null,
  winBefore: 0.5,
  winAfter: 0.5,
  epLoss: 0,
  classification: 'book',
  best: { uci: 'e2e4', san: 'e4', cp: 30, mate: null, pv: ['e2e4'] },
  accuracy: 100,
  comment: 'Book move.',
  depth: 12,
  motifs: [],
});

describe('ReviewStore Playback & Follow Mode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGameStore.setState({
      game: null,
      currentPly: 0,
      boardFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      orientation: 'white',
      isPlaying: false,
    });
    useReviewStore.setState({
      status: 'idle',
      gameReport: null,
      partialReports: [],
      progress: null,
      error: null,
      isFollowingAnalysis: false,
    });
    useSettingsStore.setState({
      reducedMotion: false,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    useReviewStore.getState().cancelAnalysis();
    vi.useRealTimers();
  });

  it('starts analysis with isFollowingAnalysis enabled and plays moves in sequence', async () => {
    const parsed = parsePgn(SAMPLE_PGN);
    useGameStore.getState().loadPgn(SAMPLE_PGN);
    expect(useGameStore.getState().currentPly).toBe(0);

    let progressCb: ((ply: number, total: number, partial: MoveReport) => void) | undefined;
    (analyzeGame as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (_game, _engine, opts) => {
        progressCb = opts?.onProgress;
        return new Promise((_, reject) => {
          opts?.signal?.addEventListener('abort', () => {
            reject(new DOMException('AbortError', 'AbortError'));
          });
        });
      }
    );

    const promise = useReviewStore.getState().startAnalysis(parsed);

    expect(useReviewStore.getState().status).toBe('analyzing');
    expect(useReviewStore.getState().isFollowingAnalysis).toBe(true);

    // Stream ply 1 & 2
    if (progressCb) {
      progressCb(1, 8, createMockMoveReport(1, 'e4'));
      progressCb(2, 8, createMockMoveReport(2, 'e5'));
    }

    // Ply 1 plays immediately on arrival
    expect(useGameStore.getState().currentPly).toBe(1);

    // Advance timer by 140ms -> queued Ply 2 plays
    vi.advanceTimersByTime(140);
    expect(useGameStore.getState().currentPly).toBe(2);

    useReviewStore.getState().cancelAnalysis();
    await promise.catch(() => {});
  });

  it('pauses playback when user manually interacts or jumps to a move', async () => {
    const parsed = parsePgn(SAMPLE_PGN);
    useGameStore.getState().loadPgn(SAMPLE_PGN);

    let progressCb: ((ply: number, total: number, partial: MoveReport) => void) | undefined;
    (analyzeGame as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (_game, _engine, opts) => {
        progressCb = opts?.onProgress;
        return new Promise((_, reject) => {
          opts?.signal?.addEventListener('abort', () => {
            reject(new DOMException('AbortError', 'AbortError'));
          });
        });
      }
    );

    const promise = useReviewStore.getState().startAnalysis(parsed);

    if (progressCb) {
      progressCb(1, 8, createMockMoveReport(1, 'e4'));
      progressCb(2, 8, createMockMoveReport(2, 'e5'));
      progressCb(3, 8, createMockMoveReport(3, 'Nf3'));
    }

    // Ply 1 plays immediately
    expect(useGameStore.getState().currentPly).toBe(1);

    // User manually jumps to ply 3
    useGameStore.getState().jumpToPly(3);
    expect(useReviewStore.getState().isFollowingAnalysis).toBe(false);
    expect(useGameStore.getState().currentPly).toBe(3);

    // Advancing timers should not change the user's selected ply
    vi.advanceTimersByTime(500);
    expect(useGameStore.getState().currentPly).toBe(3);

    // Resume following
    useReviewStore.getState().resumeFollow();
    expect(useReviewStore.getState().isFollowingAnalysis).toBe(true);

    useReviewStore.getState().cancelAnalysis();
    await promise.catch(() => {});
  });

  it('pauses playback when board is flipped or nextMove is called', async () => {
    const parsed = parsePgn(SAMPLE_PGN);
    useGameStore.getState().loadPgn(SAMPLE_PGN);

    (analyzeGame as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (_game, _engine, opts) => {
        return new Promise((_, reject) => {
          opts?.signal?.addEventListener('abort', () => {
            reject(new DOMException('AbortError', 'AbortError'));
          });
        });
      }
    );

    const promise = useReviewStore.getState().startAnalysis(parsed);
    expect(useReviewStore.getState().isFollowingAnalysis).toBe(true);

    // User flips board
    useGameStore.getState().toggleFlip();
    expect(useReviewStore.getState().isFollowingAnalysis).toBe(false);

    useReviewStore.getState().cancelAnalysis();
    await promise.catch(() => {});
  });

  it('jumps to ply 0 when analysis finishes if user was still following', async () => {
    const parsed = parsePgn(SAMPLE_PGN);
    useGameStore.getState().loadPgn(SAMPLE_PGN);

    const mockReport: GameReport = {
      moves: [
        createMockMoveReport(1, 'e4'),
        createMockMoveReport(2, 'e5'),
      ],
      accuracy: { white: 95, black: 90 },
      acpl: { white: 10, black: 15 },
      estElo: { white: 2000, black: 1950 },
      counts: {
        brilliant: { white: 0, black: 0 },
        great: { white: 0, black: 0 },
        best: { white: 0, black: 0 },
        excellent: { white: 0, black: 0 },
        good: { white: 0, black: 0 },
        book: { white: 1, black: 1 },
        inaccuracy: { white: 0, black: 0 },
        mistake: { white: 0, black: 0 },
        miss: { white: 0, black: 0 },
        blunder: { white: 0, black: 0 },
        forced: { white: 0, black: 0 },
      },
      phases: {
        opening: { white: 95, black: 90 },
        middlegame: { white: 0, black: 0 },
        endgame: { white: 0, black: 0 },
      },
      keyMoments: [],
      opening: { eco: 'C42', name: 'Open Game', bookPlies: 2 },
    };

    (analyzeGame as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (_game, _engine, opts) => {
        opts?.onProgress?.(1, 2, mockReport.moves[0]);
        opts?.onProgress?.(2, 2, mockReport.moves[1]);
        return mockReport;
      }
    );

    await useReviewStore.getState().startAnalysis(parsed);

    // Move 1 played immediately
    expect(useGameStore.getState().currentPly).toBe(1);

    // After 140ms, move 2 plays
    vi.advanceTimersByTime(140);
    expect(useGameStore.getState().currentPly).toBe(2);

    // Advance timer to trigger completion jump to ply 0
    vi.advanceTimersByTime(140);
    expect(useGameStore.getState().currentPly).toBe(0);
    expect(useReviewStore.getState().isFollowingAnalysis).toBe(false);
  });

  it('stays on user-selected move if user paused playback before analysis finished', async () => {
    const parsed = parsePgn(SAMPLE_PGN);
    useGameStore.getState().loadPgn(SAMPLE_PGN);

    let resolvePromise: (val: GameReport) => void;
    const pendingPromise = new Promise<GameReport>((resolve) => {
      resolvePromise = resolve;
    });

    const mockReport: GameReport = {
      moves: [
        createMockMoveReport(1, 'e4'),
        createMockMoveReport(2, 'e5'),
      ],
      accuracy: { white: 95, black: 90 },
      acpl: { white: 10, black: 15 },
      estElo: { white: 2000, black: 1950 },
      counts: {
        brilliant: { white: 0, black: 0 },
        great: { white: 0, black: 0 },
        best: { white: 0, black: 0 },
        excellent: { white: 0, black: 0 },
        good: { white: 0, black: 0 },
        book: { white: 1, black: 1 },
        inaccuracy: { white: 0, black: 0 },
        mistake: { white: 0, black: 0 },
        miss: { white: 0, black: 0 },
        blunder: { white: 0, black: 0 },
        forced: { white: 0, black: 0 },
      },
      phases: {
        opening: { white: 95, black: 90 },
        middlegame: { white: 0, black: 0 },
        endgame: { white: 0, black: 0 },
      },
      keyMoments: [],
      opening: { eco: 'C42', name: 'Open Game', bookPlies: 2 },
    };

    (analyzeGame as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (_game, _engine, opts) => {
        opts?.onProgress?.(1, 2, mockReport.moves[0]);
        return pendingPromise;
      }
    );

    const startPromise = useReviewStore.getState().startAnalysis(parsed);

    // Move 1 played immediately
    expect(useGameStore.getState().currentPly).toBe(1);

    // User pauses by jumping to ply 1 manually
    useGameStore.getState().jumpToPly(1);
    expect(useReviewStore.getState().isFollowingAnalysis).toBe(false);

    // Now analysis completes
    resolvePromise!(mockReport);
    await startPromise;

    // Advance timers
    vi.advanceTimersByTime(500);

    // Because user paused, board stays on ply 1 and does NOT jump to ply 0
    expect(useGameStore.getState().currentPly).toBe(1);
  });

  it('jumps directly to target ply when reducedMotion is enabled', async () => {
    useSettingsStore.setState({ reducedMotion: true });

    const parsed = parsePgn(SAMPLE_PGN);
    useGameStore.getState().loadPgn(SAMPLE_PGN);

    let progressCb: ((ply: number, total: number, partial: MoveReport) => void) | undefined;
    (analyzeGame as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (_game, _engine, opts) => {
        progressCb = opts?.onProgress;
        return new Promise((_, reject) => {
          opts?.signal?.addEventListener('abort', () => {
            reject(new DOMException('AbortError', 'AbortError'));
          });
        });
      }
    );

    const promise = useReviewStore.getState().startAnalysis(parsed);

    if (progressCb) {
      progressCb(1, 8, createMockMoveReport(1, 'e4'));
      progressCb(2, 8, createMockMoveReport(2, 'e5'));
      progressCb(3, 8, createMockMoveReport(3, 'Nf3'));
      progressCb(4, 8, createMockMoveReport(4, 'Nc6'));
    }

    // With reduced motion, advancing the timer jumps directly to target ply (4) without move-by-move spring delays
    vi.advanceTimersByTime(40);
    expect(useGameStore.getState().currentPly).toBe(4);

    useReviewStore.getState().cancelAnalysis();
    await promise.catch(() => {});
  });
});
