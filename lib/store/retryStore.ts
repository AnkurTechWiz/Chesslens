// lib/store/retryStore.ts — State management for Retry / Practice Mode on mistakes and blunders
// Abides strictly by AGENTS.md: pure client-side zustand store.

import { create } from 'zustand';
import { Chess, type Square } from 'chess.js';
import type { MoveReport, MoveBestLine, MoveAlternative, Classification } from '../types';
import { soundManager } from '../sound/soundManager';
import { useGameStore } from './gameStore';

export type RetryVerdict = 'idle' | 'correct' | 'better_not_best' | 'losing';

export interface RetryState {
  isActive: boolean;
  ply: number;
  fenBefore: string;
  currentFen: string;
  moverColor: 'w' | 'b';
  originalMove: {
    san: string;
    uci: string;
    classification: Classification;
    epLoss: number;
  } | null;
  bestMove: MoveBestLine | null;
  altMove: MoveAlternative | null;
  motifs: string[];
  attempts: number;
  userMoves: string[]; // SAN list for breadcrumbs
  verdict: RetryVerdict;
  verdictMessage: string;
  isShowingSolution: boolean;
  isCompleted: boolean;

  // Actions
  startRetry: (moveReport: MoveReport) => void;
  playUserMove: (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => boolean;
  showSolution: () => void;
  resetRetry: () => void;
  exitRetry: () => void;
}

export const useRetryStore = create<RetryState>((set, get) => ({
  isActive: false,
  ply: 0,
  fenBefore: '',
  currentFen: '',
  moverColor: 'w',
  originalMove: null,
  bestMove: null,
  altMove: null,
  motifs: [],
  attempts: 0,
  userMoves: [],
  verdict: 'idle',
  verdictMessage: '',
  isShowingSolution: false,
  isCompleted: false,

  startRetry: (moveReport: MoveReport) => {
    const isWhiteMover = moveReport.ply % 2 === 1;
    const moverColor: 'w' | 'b' = isWhiteMover ? 'w' : 'b';

    set({
      isActive: true,
      ply: moveReport.ply,
      fenBefore: moveReport.fenBefore,
      currentFen: moveReport.fenBefore,
      moverColor,
      originalMove: {
        san: moveReport.san,
        uci: moveReport.uci,
        classification: moveReport.classification,
        epLoss: moveReport.epLoss,
      },
      bestMove: moveReport.best,
      altMove: moveReport.alt || null,
      motifs: moveReport.motifs || [],
      attempts: 0,
      userMoves: [],
      verdict: 'idle',
      verdictMessage: 'Find a better move than played in the game.',
      isShowingSolution: false,
      isCompleted: false,
    });

    // Update gameStore board to the before-FEN and orient to the player
    const gameStore = useGameStore.getState();
    gameStore.setOrientation(moverColor === 'w' ? 'white' : 'black');
  },

  playUserMove: (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
    const { currentFen, bestMove, altMove, originalMove, attempts, userMoves, isCompleted } = get();
    if (!bestMove || isCompleted) return false;

    const chess = new Chess(currentFen);
    const piece = chess.get(from as Square);

    if (
      piece &&
      piece.type === 'p' &&
      ((piece.color === 'w' && to.endsWith('8')) || (piece.color === 'b' && to.endsWith('1')))
    ) {
      if (!promotion) {
        useGameStore.setState({ pendingPromotion: { from, to } });
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
        return false;
      }

      const playedUci = `${moveRes.from}${moveRes.to}${moveRes.promotion || ''}`;
      const updatedFen = chess.fen();
      const updatedMoves = [...userMoves, moveRes.san];
      const newAttempts = attempts + 1;

      // Check if move matches engine recommendation
      const isBest =
        playedUci === bestMove.uci ||
        moveRes.san === bestMove.san ||
        (bestMove.pv && bestMove.pv[0] === playedUci);

      const isAlternative =
        altMove &&
        (playedUci === altMove.uci || moveRes.san === altMove.san);

      const isOriginalBlunder =
        originalMove &&
        (playedUci === originalMove.uci || moveRes.san === originalMove.san);

      if (isBest) {
        soundManager.play('retryCorrect');
        set({
          currentFen: updatedFen,
          userMoves: updatedMoves,
          attempts: newAttempts,
          verdict: 'correct',
          verdictMessage: `Correct! ${moveRes.san} is the best move.`,
          isCompleted: true,
        });

        // If there's an engine reply in the PV line, play it after a slight delay
        if (bestMove.pv && bestMove.pv.length > 1) {
          setTimeout(() => {
            const replyUci = bestMove.pv[1];
            if (!replyUci || replyUci.length < 4) return;
            const replyFrom = replyUci.substring(0, 2) as Square;
            const replyTo = replyUci.substring(2, 4) as Square;
            const replyPromo = (replyUci[4] as 'q' | 'r' | 'b' | 'n' | undefined) || undefined;

            try {
              const replyChess = new Chess(updatedFen);
              const replyRes = replyChess.move({
                from: replyFrom,
                to: replyTo,
                promotion: replyPromo,
              });

              if (replyRes) {
                soundManager.play('move');
                set({
                  currentFen: replyChess.fen(),
                  userMoves: [...updatedMoves, replyRes.san],
                });
              }
            } catch {
              // Ignore reply errors
            }
          }, 600);
        }

        return true;
      }

      if (isAlternative) {
        soundManager.play('retryWrong');
        set({
          currentFen: updatedFen,
          userMoves: updatedMoves,
          attempts: newAttempts,
          verdict: 'better_not_best',
          verdictMessage: `${moveRes.san} is better than the game, but still not the best move.`,
        });
        return true;
      }

      if (isOriginalBlunder) {
        soundManager.play('retryWrong');
        set({
          currentFen: updatedFen,
          userMoves: updatedMoves,
          attempts: newAttempts,
          verdict: 'losing',
          verdictMessage: `That's the same ${originalMove.classification} played in the game! Try something else.`,
        });
        return true;
      }

      // Any other legal move
      soundManager.play('retryWrong');
      set({
        currentFen: updatedFen,
        userMoves: updatedMoves,
        attempts: newAttempts,
        verdict: 'losing',
        verdictMessage: 'Still losing — that does not solve the position. Try again!',
      });

      return true;
    } catch {
      soundManager.play('illegal');
      return false;
    }
  },

  showSolution: () => {
    const { fenBefore, bestMove } = get();
    if (!bestMove || !bestMove.uci) return;

    set({
      isShowingSolution: true,
      verdict: 'correct',
      verdictMessage: `Best line: ${bestMove.san} (${bestMove.pv?.slice(0, 4).join(' ') || bestMove.uci})`,
      isCompleted: true,
    });

    const pvMoves: string[] = [];

    // Step through the PV line
    const pvList = bestMove.pv || [bestMove.uci];
    let currentStepFen = fenBefore;

    pvList.slice(0, 3).forEach((uci, index) => {
      setTimeout(() => {
        try {
          const stepChess = new Chess(currentStepFen);
          const from = uci.substring(0, 2) as Square;
          const to = uci.substring(2, 4) as Square;
          const promo = (uci[4] as 'q' | 'r' | 'b' | 'n' | undefined) || undefined;

          const res = stepChess.move({ from, to, promotion: promo });
          if (res) {
            currentStepFen = stepChess.fen();
            pvMoves.push(res.san);
            soundManager.play(index === 0 ? 'great' : 'move');
            set({
              currentFen: currentStepFen,
              userMoves: [...pvMoves],
            });
          }
        } catch {
          // Ignore step errors
        }
      }, index * 600);
    });
  },

  resetRetry: () => {
    const { fenBefore } = get();
    set({
      currentFen: fenBefore,
      userMoves: [],
      verdict: 'idle',
      verdictMessage: 'Find a better move than played in the game.',
      isShowingSolution: false,
      isCompleted: false,
    });
  },

  exitRetry: () => {
    set({
      isActive: false,
      ply: 0,
      fenBefore: '',
      currentFen: '',
      originalMove: null,
      bestMove: null,
      altMove: null,
      userMoves: [],
      verdict: 'idle',
      verdictMessage: '',
      isShowingSolution: false,
      isCompleted: false,
    });

    // Reset gameStore navigation position
    const gameStore = useGameStore.getState();
    gameStore.jumpToPly(gameStore.currentPly, false);
  },
}));
