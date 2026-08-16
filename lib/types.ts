// Shared domain types for ChessLens (AGENTS.md & plan §6)

export type Classification =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder'
  | 'forced';

export interface MoveBestLine {
  uci: string;
  san: string;
  cp: number | null;
  mate: number | null;
  pv: string[];
}

export interface MoveAlternative {
  uci: string;
  san: string;
  cp: number | null;
  mate?: number | null;
}

export interface MoveReport {
  ply: number;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  cpBefore: number | null;
  mateBefore: number | null;
  cpAfter: number | null;
  mateAfter: number | null;
  winBefore: number;
  winAfter: number;
  epLoss: number;
  classification: Classification;
  best: MoveBestLine;
  alt?: MoveAlternative;
  motifs: string[];
  accuracy: number;
  clockMs?: number;
  timeSpentMs?: number;
  comment?: string;
  depth: number;
}

export interface PhaseAccuracy {
  opening: { white: number; black: number };
  middlegame: { white: number; black: number };
  endgame: { white: number; black: number };
}

export interface OpeningInfo {
  eco: string;
  name: string;
  bookPlies: number;
}

export interface GameReport {
  moves: MoveReport[];
  accuracy: { white: number; black: number };
  acpl: { white: number; black: number };
  counts: Record<Classification, { white: number; black: number }>;
  estElo: { white: number; black: number };
  phases: PhaseAccuracy;
  keyMoments: number[];
  opening: OpeningInfo;
}

export interface SavedGame {
  id: string; // uuid
  pgn: string;
  white: string;
  black: string;
  whiteElo?: number;
  blackElo?: number;
  result: string;
  eco?: string;
  opening?: string;
  timeControl?: string;
  playedAt?: number;
  source: 'paste' | 'file' | 'chesscom' | 'lichess';
  report: GameReport;
  engineVersion: string;
  depth: number;
  createdAt: number;
}

export interface CachedEval {
  key: string; // sha1(fen)|depth|multipv|engine
  fen: string;
  cp: number | null;
  mate: number | null;
  pv: string[];
  depth: number;
  multipv: number;
  engine: string;
  lastUsed: number;
}

export interface TrainerCard {
  id: string;
  gameId?: string;
  fen: string;
  solutionUci: string;
  pv: string[];
  motifs: string[];
  classification: Classification;
  ease: number; // 2.5 default (SM-2 lite)
  interval: number;
  reps: number;
  dueAt: number;
  lastResult?: 'again' | 'hard' | 'good' | 'easy';
  createdAt: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

// ────────────────────────────────────────────────────────────────────────────
// Engine layer types (Phase 2)
// ────────────────────────────────────────────────────────────────────────────

/** Capabilities detected at engine-pool startup. */
export interface EngineCapabilities {
  /** Which JS/WASM bundle is loaded. */
  build: 'single' | 'mt' | 'no-simd';
  /** Number of OS threads the pool is using (single-threaded builds = 1). */
  threads: number;
  /** Whether WASM SIMD is supported by the browser. */
  simd: boolean;
  /** Whether `crossOriginIsolated` is true (required for SharedArrayBuffer / mt). */
  crossOriginIsolated: boolean;
  /** Human-readable label shown in the engine badge. */
  label: string;
  /** Engine version string embedded in the JS filename. */
  version: string;
}

/**
 * One UCI `info` line parsed during incremental analysis.
 * All values are from White's perspective (standard UCI) — callers must flip
 * for Black-to-move positions when displaying.
 */
export interface SearchInfo {
  /** UCI multipv line index (1-based). */
  multipv: number;
  /** Current search depth. */
  depth: number;
  /** Selective search depth (may exceed depth). */
  seldepth?: number;
  /** Centipawn score from White's perspective, or null when mate is set. */
  cp: number | null;
  /** Mate-in-N from White's perspective (negative = being mated), or null. */
  mate: number | null;
  /** Best move sequence in UCI notation (e.g. ["e2e4", "e7e5"]). */
  pv: string[];
  /** Nodes per second, if reported. */
  nps?: number;
  /** Total nodes searched, if reported. */
  nodes?: number;
  /** Time spent in ms, if reported. */
  time?: number;
}

/**
 * Final evaluation result for a single multipv line.
 * Stored in the eval cache and returned from `EnginePool.analyze()`.
 */
export interface EvalResult {
  /** 1-based multipv rank. */
  multipv: number;
  /** FEN this eval belongs to. */
  fen: string;
  /** Final depth reached. */
  depth: number;
  /** Centipawn score from White's perspective, or null when mate is set. */
  cp: number | null;
  /** Mate-in-N from White's perspective (negative = being mated), or null. */
  mate: number | null;
  /** Principal variation in UCI notation. */
  pv: string[];
  /** Engine identifier (used as part of cache key). */
  engine: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Classification layer types (Phase 3)
// ────────────────────────────────────────────────────────────────────────────

/**
 * All data needed to classify a single move.
 *
 * All eval values are in the **mover's perspective** (positive = good for mover).
 * Callers must convert from White-perspective storage before constructing this.
 */
export interface MoveContext {
  /** 1-based ply number. */
  ply: number;
  /** SAN of the move played. */
  san: string;
  /** UCI of the move played. */
  uci: string;
  /** FEN before the move. */
  fenBefore: string;
  /** FEN after the move. */
  fenAfter: string;
  /** Side that made this move. */
  moverColor: 'w' | 'b';

  /** Number of legal moves in the position before the move. */
  legalMoveCount: number;

  // ── Engine evals (mover's perspective) ──

  /** CP of the position before the move (mover's perspective), or null when mate. */
  cpBefore: number | null;
  /** Mate-in-N before the move (mover's perspective), or null. */
  mateBefore: number | null;
  /** CP of the position after the move (mover's perspective), or null when mate. */
  cpAfter: number | null;
  /** Mate-in-N after the move (mover's perspective), or null. */
  mateAfter: number | null;

  /** Best move UCI from the engine PV1. */
  bestUci: string;
  /** Best move SAN. */
  bestSan: string;
  /** Best move CP (mover's perspective), or null when mate. */
  bestCp: number | null;
  /** Best move mate-in-N (mover's perspective), or null. */
  bestMate: number | null;
  /** Best move principal variation. */
  bestPv: string[];

  /** Second-best move CP (mover's perspective), or null. */
  altCp: number | null;
  /** Second-best move mate-in-N (mover's perspective), or null. */
  altMate: number | null;
  /** Second-best move UCI, or empty string if no second-best. */
  altUci: string;
  /** Second-best move SAN, or empty string. */
  altSan: string;

  // ── Contextual ──

  /** Number of plies in opening book for this game. */
  bookPlies: number;
  /** Classification of the previous move (for Miss detection). null for ply 1. */
  prevClassification: Classification | null;
  /** Player rating (for leniency). */
  playerRating: number;

  /** Clock time remaining in ms (optional, for time_pressure motif). */
  clockMs?: number;
  /** Time spent on this move in ms (optional). */
  timeSpentMs?: number;
  /** Search depth of the eval for this position. */
  depth: number;
}

/**
 * Engine interface for the analysis pipeline.
 * Abstracts over the real EnginePool for testability with mocks.
 */
export interface AnalysisEngine {
  /** Analyze a position, returning eval results sorted by multipv rank. */
  analyze(
    fen: string,
    opts: {
      depth: number;
      multiPv: number;
      signal?: AbortSignal;
    },
  ): Promise<EvalResult[]>;
}

/**
 * Progress callback for analysis pipeline.
 * Fires after each ply is classified, in order.
 */
export type AnalysisProgress = (
  ply: number,
  total: number,
  partial: MoveReport,
) => void;

