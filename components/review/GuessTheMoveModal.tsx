'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Chess, type Square as ChessSquare } from 'chess.js';
import { useGameStore } from '@/lib/store/gameStore';
import { useReviewStore } from '@/lib/store/reviewStore';
import { Square } from '@/components/board/Square';
import { Piece } from '@/components/board/Piece';
import { PromotionDialog } from '@/components/board/PromotionDialog';
import type { PieceCode } from '@/components/board/PieceSvg';
import { soundManager } from '@/lib/sound/soundManager';
import {
  Trophy,
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Flame,
} from 'lucide-react';

export interface GuessTheMoveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuessTheMoveModal: React.FC<GuessTheMoveModalProps> = ({ isOpen, onClose }) => {
  const { game } = useGameStore();
  const { gameReport, partialReports } = useReviewStore();

  const [side, setSide] = useState<'w' | 'b'>('w');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [maxScore, setMaxScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lastFeedback, setLastFeedback] = useState<{
    status: 'best' | 'game' | 'ok' | 'wrong';
    message: string;
    san: string;
  } | null>(null);

  const [boardFen, setBoardFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);

  const modalRef = useRef<HTMLDivElement | null>(null);

  const reports = gameReport?.moves || partialReports;

  // Filter moves belonging to the chosen side
  const candidatePlies = (game?.moves || [])
    .map((m, idx) => ({ ...m, plyIndex: idx }))
    .filter((m) => (side === 'w' ? m.ply % 2 === 1 : m.ply % 2 === 0));

  const activeTargetMove = candidatePlies[currentStepIndex];
  const isFinished = currentStepIndex >= candidatePlies.length && candidatePlies.length > 0;

  // Initialize board for current target move
  useEffect(() => {
    if (!isOpen || !game) return;

    if (activeTargetMove) {
      // Find FEN right before this move
      const chess = new Chess(game.startingFen || undefined);
      for (let i = 0; i < activeTargetMove.plyIndex; i++) {
        chess.move(game.moves[i].san);
      }
      setBoardFen(chess.fen());
      setSelectedSquare(null);
      setLegalMoves([]);
      setPendingPromotion(null);
    }
  }, [isOpen, game, activeTargetMove, currentStepIndex]);

  // Reset quiz
  const handleReset = (newSide?: 'w' | 'b') => {
    const s = newSide || side;
    setSide(s);
    setCurrentStepIndex(0);
    setScore(0);
    setMaxScore(0);
    setStreak(0);
    setLastFeedback(null);
    setSelectedSquare(null);
    setLegalMoves([]);
    setPendingPromotion(null);
  };

  const handleMakeMove = (from: string, to: string, promo?: 'q' | 'r' | 'b' | 'n') => {
    if (!activeTargetMove) return;

    try {
      const chess = new Chess(boardFen);
      const moveObj = chess.move({
        from: from as ChessSquare,
        to: to as ChessSquare,
        promotion: promo,
      });

      if (!moveObj) return;

      const userSan = moveObj.san;
      const userUci = `${from}${to}${promo || ''}`;
      const actualGameSan = activeTargetMove.san;
      const report = reports[activeTargetMove.plyIndex];
      const bestUci = report?.best?.uci;
      const bestSan = report?.best?.san;

      setMaxScore((prev) => prev + 15);

      if (bestUci && userUci === bestUci) {
        // Found the top engine move!
        setScore((prev) => prev + 15);
        setStreak((prev) => prev + 1);
        soundManager.play('great');
        setLastFeedback({
          status: 'best',
          message: `⭐ Outstanding! You played the #1 engine move (${userSan})!`,
          san: userSan,
        });
      } else if (userSan === actualGameSan) {
        // Played the exact game move
        setScore((prev) => prev + 10);
        setStreak((prev) => prev + 1);
        soundManager.play('move');
        setLastFeedback({
          status: 'game',
          message: `✓ Match! You played the grandmaster game move (${userSan}).`,
          san: userSan,
        });
      } else if (report && report.epLoss <= 0.05) {
        // Solid alternative
        setScore((prev) => prev + 5);
        setStreak(0);
        soundManager.play('move');
        setLastFeedback({
          status: 'ok',
          message: `Playable choice (${userSan}). Game move was ${actualGameSan}.`,
          san: userSan,
        });
      } else {
        // Inaccuracy / Blunder
        setStreak(0);
        soundManager.play('illegal');
        setLastFeedback({
          status: 'wrong',
          message: `Suboptimal move (${userSan}). Game played ${actualGameSan}${
            bestSan ? ` (best: ${bestSan})` : ''
          }.`,
          san: userSan,
        });
      }

      // Advance after a short delay
      setTimeout(() => {
        setCurrentStepIndex((prev) => prev + 1);
      }, 1400);
    } catch {
      // Invalid
    }
  };

  const handleSquareClick = (square: string) => {
    const chess = new Chess(boardFen);
    const turn = chess.turn();

    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      if (legalMoves.includes(square)) {
        // Check promotion
        const piece = chess.get(selectedSquare as ChessSquare);
        if (
          piece &&
          piece.type === 'p' &&
          ((piece.color === 'w' && square[1] === '8') || (piece.color === 'b' && square[1] === '1'))
        ) {
          setPendingPromotion({ from: selectedSquare, to: square });
          return;
        }

        handleMakeMove(selectedSquare, square);
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }
    }

    const piece = chess.get(square as ChessSquare);
    if (piece && piece.color === turn) {
      const moves = chess.moves({ square: square as ChessSquare, verbose: true });
      setSelectedSquare(square);
      setLegalMoves(moves.map((m) => m.to));
    } else {
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  };

  if (!isOpen) return null;

  const chess = new Chess(boardFen);
  const turn = chess.turn();
  const ranks = side === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = side === 'w' ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'];

  const accuracyPct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guess-move-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h2 id="guess-move-title" className="text-base font-bold text-white flex items-center gap-2">
                <span>Guess the Move Quiz</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  {side === 'w' ? 'Playing White' : 'Playing Black'}
                </span>
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Guess the Move quiz"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6 items-center">
          {/* Chessboard Area */}
          <div className="flex flex-col items-center">
            <div className="relative w-full max-w-[380px] aspect-square rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-800 bg-slate-950 select-none">
              <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
                {ranks.map((rank, rankIdx) =>
                  files.map((file, fileIdx) => {
                    const square = `${file}${rank}` as ChessSquare;
                    const isLight = (rankIdx + fileIdx) % 2 === 0;
                    const piece = chess.get(square);
                    const isSelected = selectedSquare === square;
                    const isLegalTarget = legalMoves.includes(square);
                    const isCaptureTarget = isLegalTarget && Boolean(piece && piece.color !== turn);

                    const pieceCode = piece
                      ? (`${piece.color}${piece.type.toUpperCase()}` as PieceCode)
                      : null;

                    return (
                      <Square
                        key={square}
                        square={square}
                        isLight={isLight}
                        isSelected={isSelected}
                        isLegalTarget={isLegalTarget}
                        isCaptureTarget={isCaptureTarget}
                        showRankCoord={fileIdx === 0 ? String(rank) : undefined}
                        showFileCoord={rankIdx === 7 ? file : undefined}
                        onClick={handleSquareClick}
                      >
                        {pieceCode && piece && (
                          <Piece
                            piece={pieceCode}
                            square={square}
                            isDraggable={false}
                            onClick={handleSquareClick}
                          />
                        )}
                      </Square>
                    );
                  })
                )}
              </div>

              {pendingPromotion && (
                <PromotionDialog
                  color={side}
                  onSelect={(p) => {
                    handleMakeMove(pendingPromotion.from, pendingPromotion.to, p);
                    setPendingPromotion(null);
                    setSelectedSquare(null);
                    setLegalMoves([]);
                  }}
                  onCancel={() => setPendingPromotion(null)}
                />
              )}
            </div>
          </div>

          {/* Quiz Sidebar Info */}
          <div className="space-y-4 flex flex-col justify-between h-full text-xs">
            {/* Score & Streak */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400">Score</span>
                <div className="text-xl font-black font-mono text-emerald-400">
                  {score} <span className="text-xs text-slate-500 font-normal">/ {maxScore}</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400">Accuracy</span>
                <div className="text-xl font-black font-mono text-amber-400">
                  {accuracyPct}%
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-center gap-1">
                  <Flame className="w-3 h-3 text-orange-400" />
                  Streak
                </span>
                <div className="text-xl font-black font-mono text-orange-400">
                  {streak}
                </div>
              </div>
            </div>

            {/* Turn & Status Card */}
            {!isFinished ? (
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Turn {currentStepIndex + 1} of {candidatePlies.length}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Move #{activeTargetMove ? Math.floor(activeTargetMove.ply / 2) + 1 : 1}
                  </span>
                </div>

                <p className="text-slate-300 leading-relaxed">
                  Find the best move for <strong>{side === 'w' ? 'White' : 'Black'}</strong> in this position.
                  Click or drag pieces on the board to guess!
                </p>

                {lastFeedback && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-medium animate-in fade-in flex items-start gap-2 ${
                      lastFeedback.status === 'best' || lastFeedback.status === 'game'
                        ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                        : lastFeedback.status === 'ok'
                        ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                        : 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                    }`}
                  >
                    {lastFeedback.status === 'best' || lastFeedback.status === 'game' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    )}
                    <span>{lastFeedback.message}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-500/40 text-center space-y-3">
                <Trophy className="w-8 h-8 text-amber-400 mx-auto" />
                <h3 className="text-base font-bold text-white">Quiz Completed!</h3>
                <p className="text-xs text-slate-300">
                  You scored <strong>{score}</strong> out of {maxScore} points ({accuracyPct}% accuracy)!
                </p>
              </div>
            )}

            {/* Side Picker & Controls */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleReset('w')}
                  className={`py-2 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
                    side === 'w'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Play White
                </button>
                <button
                  onClick={() => handleReset('b')}
                  className={`py-2 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
                    side === 'b'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Play Black
                </button>
              </div>

              <button
                onClick={() => handleReset()}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restart Quiz</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
