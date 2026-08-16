import { create } from 'zustand';
import { Chess, type Square } from 'chess.js';
import { parsePgn, type ParsedGame, type ParsedMove } from '../pgn/parse';
import { soundManager } from '../sound/soundManager';
import { useReviewStore } from './reviewStore';

const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

export interface MaterialAdvantage {
  white: number;
  black: number;
}

export interface CapturedPieces {
  white: string[]; // Pieces captured by White (i.e. Black pieces lost)
  black: string[]; // Pieces captured by Black (i.e. White pieces lost)
}

export interface GameState {
  game: ParsedGame | null;
  currentPly: number;
  boardFen: string;
  orientation: 'white' | 'black';
  isPlaying: boolean;
  autoplaySpeed: number; // in milliseconds (e.g. 1000)
  isMuted: boolean;
  selectedSquare: string | null;
  legalMoves: string[];
  pendingPromotion: { from: string; to: string } | null;
  lastMoveSquares: { from: string; to: string } | null;
  inCheck: boolean;
  isCheckmate: boolean;
  checkSquare: string | null;
  capturedPieces: CapturedPieces;
  materialAdvantage: MaterialAdvantage;
  error: string | null;

  // Actions
  loadPgn: (pgnText: string, jumpToEnd?: boolean) => boolean;
  jumpToPly: (ply: number, playSound?: boolean, isPlayback?: boolean) => void;
  nextMove: () => void;
  prevMove: () => void;
  firstMove: () => void;
  lastMove: () => void;
  togglePlay: () => void;
  setAutoplaySpeed: (speed: number) => void;
  toggleFlip: () => void;
  setOrientation: (orientation: 'white' | 'black') => void;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
  selectSquare: (square: string | null) => void;
  makeMove: (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => boolean;
  cancelPromotion: () => void;
  clearError: () => void;
}

function calculateBoardStats(fen: string) {
  const chess = new Chess(fen);
  const inCheck = chess.inCheck();
  const isCheckmate = chess.isCheckmate();

  let checkSquare: string | null = null;
  if (inCheck) {
    const turn = chess.turn();
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === 'k' && piece.color === turn) {
          checkSquare = piece.square;
          break;
        }
      }
      if (checkSquare) break;
    }
  }

  // Count pieces remaining
  const whitePieces: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  const blackPieces: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };

  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type !== 'k') {
        if (p.color === 'w') {
          whitePieces[p.type] = (whitePieces[p.type] || 0) + 1;
        } else {
          blackPieces[p.type] = (blackPieces[p.type] || 0) + 1;
        }
      }
    }
  }

  // Starting counts: 8p, 2n, 2b, 2r, 1q
  const initial = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const capturedByWhite: string[] = [];
  const capturedByBlack: string[] = [];

  for (const type of ['q', 'r', 'b', 'n', 'p']) {
    const missingBlack = Math.max(0, initial[type as keyof typeof initial] - (blackPieces[type] || 0));
    for (let i = 0; i < missingBlack; i++) {
      capturedByWhite.push(`b${type.toUpperCase()}`);
    }

    const missingWhite = Math.max(0, initial[type as keyof typeof initial] - (whitePieces[type] || 0));
    for (let i = 0; i < missingWhite; i++) {
      capturedByBlack.push(`w${type.toUpperCase()}`);
    }
  }

  let whiteScore = 0;
  for (const [t, count] of Object.entries(whitePieces)) {
    whiteScore += (PIECE_VALUES[t] || 0) * count;
  }

  let blackScore = 0;
  for (const [t, count] of Object.entries(blackPieces)) {
    blackScore += (PIECE_VALUES[t] || 0) * count;
  }

  const materialAdvantage: MaterialAdvantage = {
    white: whiteScore > blackScore ? whiteScore - blackScore : 0,
    black: blackScore > whiteScore ? blackScore - whiteScore : 0,
  };

  return {
    inCheck,
    isCheckmate,
    checkSquare,
    capturedPieces: {
      white: capturedByWhite,
      black: capturedByBlack,
    },
    materialAdvantage,
  };
}

function checkPauseFollow() {
  try {
    const review = useReviewStore.getState();
    if (review.status === 'analyzing' && review.isFollowingAnalysis) {
      review.pauseFollow();
    }
  } catch {
    // Ignore if store not yet initialized
  }
}

const DEFAULT_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const useGameStore = create<GameState>((set, get) => ({
  game: null,
  currentPly: 0,
  boardFen: DEFAULT_FEN,
  orientation: 'white',
  isPlaying: false,
  autoplaySpeed: 1000,
  isMuted: false,
  selectedSquare: null,
  legalMoves: [],
  pendingPromotion: null,
  lastMoveSquares: null,
  inCheck: false,
  isCheckmate: false,
  checkSquare: null,
  capturedPieces: { white: [], black: [] },
  materialAdvantage: { white: 0, black: 0 },
  error: null,

  loadPgn: (pgnText: string, jumpToEnd = false) => {
    const parsed = parsePgn(pgnText);
    if (parsed.error && parsed.moves.length === 0) {
      set({ error: parsed.error });
      return false;
    }

    const targetPly = jumpToEnd ? parsed.moves.length : 0;
    const currentMove: ParsedMove | undefined = targetPly > 0 ? parsed.moves[targetPly - 1] : undefined;
    const targetFen = currentMove ? currentMove.fenAfter : parsed.startingFen;
    const stats = calculateBoardStats(targetFen);

    set({
      game: parsed,
      currentPly: targetPly,
      boardFen: targetFen,
      lastMoveSquares: currentMove ? { from: currentMove.from, to: currentMove.to } : null,
      selectedSquare: null,
      legalMoves: [],
      pendingPromotion: null,
      isPlaying: false,
      error: parsed.error || null,
      ...stats,
    });

    return true;
  },

  jumpToPly: (ply: number, playSound = true, isPlayback = false) => {
    if (!isPlayback) {
      checkPauseFollow();
    }

    const { game, currentPly: prevPly } = get();
    if (!game) return;

    const clampedPly = Math.max(0, Math.min(ply, game.moves.length));
    if (clampedPly === prevPly && ply === prevPly) return;

    let targetFen = game.startingFen;
    let lastMoveSquares: { from: string; to: string } | null = null;
    let moveObj: ParsedMove | undefined;

    if (clampedPly > 0) {
      moveObj = game.moves[clampedPly - 1];
      targetFen = moveObj.fenAfter;
      lastMoveSquares = { from: moveObj.from, to: moveObj.to };
    }

    const stats = calculateBoardStats(targetFen);

    set({
      currentPly: clampedPly,
      boardFen: targetFen,
      lastMoveSquares,
      selectedSquare: null,
      legalMoves: [],
      pendingPromotion: null,
      ...stats,
    });

    if (playSound) {
      if (clampedPly === prevPly + 1 && moveObj) {
        if (stats.isCheckmate) {
          soundManager.play('gameEnd');
        } else if (stats.inCheck) {
          soundManager.play('check');
        } else if (moveObj.isCastling) {
          soundManager.play('castle');
        } else if (moveObj.captured) {
          soundManager.play('capture');
        } else if (moveObj.promotion) {
          soundManager.play('promote');
        } else {
          soundManager.play('move');
        }
      } else {
        soundManager.play('move');
      }
    }
  },

  nextMove: () => {
    const { currentPly, game } = get();
    if (game && currentPly < game.moves.length) {
      get().jumpToPly(currentPly + 1, true);
    } else {
      if (get().isPlaying) {
        set({ isPlaying: false });
      }
    }
  },

  prevMove: () => {
    const { currentPly } = get();
    if (currentPly > 0) {
      get().jumpToPly(currentPly - 1, true);
    }
  },

  firstMove: () => {
    get().jumpToPly(0, true);
  },

  lastMove: () => {
    const { game } = get();
    if (game) {
      get().jumpToPly(game.moves.length, true);
    }
  },

  togglePlay: () => {
    const { isPlaying, currentPly, game } = get();
    if (!game) return;

    if (!isPlaying && currentPly >= game.moves.length) {
      // Loop around to start if at the end
      get().jumpToPly(0, false);
    }
    set({ isPlaying: !isPlaying });
  },

  setAutoplaySpeed: (speed: number) => {
    set({ autoplaySpeed: speed });
  },

  toggleFlip: () => {
    checkPauseFollow();
    const { orientation } = get();
    set({ orientation: orientation === 'white' ? 'black' : 'white' });
  },

  setOrientation: (orientation: 'white' | 'black') => {
    checkPauseFollow();
    set({ orientation });
  },

  toggleMute: () => {
    const newMuted = !get().isMuted;
    soundManager.setMuted(newMuted);
    set({ isMuted: newMuted });
  },

  setMuted: (muted: boolean) => {
    soundManager.setMuted(muted);
    set({ isMuted: muted });
  },

  selectSquare: (square: string | null) => {
    if (square) {
      checkPauseFollow();
    }

    if (!square) {
      set({ selectedSquare: null, legalMoves: [] });
      return;
    }

    const { boardFen } = get();
    const chess = new Chess(boardFen);
    const piece = chess.get(square as Square);

    if (!piece || piece.color !== chess.turn()) {
      set({ selectedSquare: null, legalMoves: [] });
      return;
    }

    const moves = chess.moves({ square: square as Square, verbose: true });
    const legalDestinations = moves.map((m) => m.to);

    set({
      selectedSquare: square,
      legalMoves: legalDestinations,
    });
  },

  makeMove: (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
    checkPauseFollow();
    const { boardFen, game, currentPly } = get();
    const chess = new Chess(boardFen);
    const piece = chess.get(from as Square);

    // Check if this is a pawn promotion move without a promotion piece specified
    if (
      piece &&
      piece.type === 'p' &&
      ((piece.color === 'w' && to.endsWith('8')) || (piece.color === 'b' && to.endsWith('1')))
    ) {
      if (!promotion) {
        set({ pendingPromotion: { from, to } });
        return false;
      }
    }

    try {
      const moveRes = chess.move({
        from: from as Square,
        to: to as Square,
        promotion: promotion || 'q',
      });

      if (!moveRes) {
        soundManager.play('illegal');
        set({ selectedSquare: null, legalMoves: [] });
        return false;
      }

      const fenAfter = chess.fen();
      const stats = calculateBoardStats(fenAfter);

      // Play sound
      if (stats.isCheckmate) {
        soundManager.play('gameEnd');
      } else if (stats.inCheck) {
        soundManager.play('check');
      } else if (moveRes.flags.includes('k') || moveRes.flags.includes('q')) {
        soundManager.play('castle');
      } else if (moveRes.captured) {
        soundManager.play('capture');
      } else if (moveRes.promotion) {
        soundManager.play('promote');
      } else {
        soundManager.play('move');
      }

      // Create new move record and branch or append
      const newMove: ParsedMove = {
        ply: currentPly + 1,
        san: moveRes.san,
        uci: `${moveRes.from}${moveRes.to}${moveRes.promotion || ''}`,
        from: moveRes.from,
        to: moveRes.to,
        piece: moveRes.piece as 'p' | 'n' | 'b' | 'r' | 'q' | 'k',
        color: moveRes.color as 'w' | 'b',
        captured: moveRes.captured as 'p' | 'n' | 'b' | 'r' | 'q' | 'k' | undefined,
        promotion: moveRes.promotion as 'q' | 'r' | 'b' | 'n' | undefined,
        fenBefore: boardFen,
        fenAfter,
        isCheck: stats.inCheck,
        isCheckmate: stats.isCheckmate,
        isCastling: moveRes.flags.includes('k') || moveRes.flags.includes('q'),
      };

      const existingMoves = game ? game.moves.slice(0, currentPly) : [];
      const updatedMoves = [...existingMoves, newMove];

      const updatedGame: ParsedGame = {
        headers: game ? game.headers : {},
        moves: updatedMoves,
        startingFen: game ? game.startingFen : DEFAULT_FEN,
        result: stats.isCheckmate ? (chess.turn() === 'w' ? '0-1' : '1-0') : '*',
      };

      set({
        game: updatedGame,
        currentPly: currentPly + 1,
        boardFen: fenAfter,
        lastMoveSquares: { from: moveRes.from, to: moveRes.to },
        selectedSquare: null,
        legalMoves: [],
        pendingPromotion: null,
        ...stats,
      });

      return true;
    } catch {
      soundManager.play('illegal');
      set({ selectedSquare: null, legalMoves: [] });
      return false;
    }
  },

  cancelPromotion: () => {
    set({ pendingPromotion: null, selectedSquare: null, legalMoves: [] });
  },

  clearError: () => {
    set({ error: null });
  },
}));
