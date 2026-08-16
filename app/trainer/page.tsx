'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Chess, type Square as ChessSquare } from 'chess.js';
import { db } from '@/lib/storage/db';
import { gradeTrainerCard, createCardsFromGameReport, type SM2Grade } from '@/lib/storage/trainer';
import { soundManager } from '@/lib/sound/soundManager';
import { Square } from '@/components/board/Square';
import { Piece } from '@/components/board/Piece';
import { PromotionDialog } from '@/components/board/PromotionDialog';
import type { PieceCode } from '@/components/board/PieceSvg';
import { SettingsModal } from '@/components/settings/SettingsModal';
import type { TrainerCard } from '@/lib/types';
import {
  RotateCcw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  Calendar,
  Layers,
  Trash2,
  Play,
  ArrowLeft,
  Search,
  Settings,
} from 'lucide-react';

export default function TrainerPage() {
  const [cards, setCards] = useState<TrainerCard[]>([]);
  const [activeSessionCards, setActiveSessionCards] = useState<TrainerCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [isSessionFinished, setIsSessionFinished] = useState<boolean>(false);
  const [sessionResults, setSessionResults] = useState<{ cardId: string; grade: SM2Grade }[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  // Board state for active flashcard
  const [boardFen, setBoardFen] = useState<string>('');
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [lastMoveSquares, setLastMoveSquares] = useState<{ from: string; to: string } | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [isShowingSolution, setIsShowingSolution] = useState<boolean>(false);

  // Deck browser filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterDueOnly, setFilterDueOnly] = useState<boolean>(false);

  const refreshDeck = useCallback(async () => {
    try {
      const allCards = await db.cards.orderBy('dueAt').toArray();
      setCards(allCards);
    } catch {
      // Fallback
    }
  }, []);

  useEffect(() => {
    refreshDeck();
  }, [refreshDeck]);

  // Deck stats
  const stats = useMemo(() => {
    const now = Date.now();
    const dueCount = cards.filter((c) => c.dueAt <= now).length;
    const learningCount = cards.filter((c) => c.reps < 2).length;
    const masteredCount = cards.filter((c) => c.interval >= 10).length;
    return {
      total: cards.length,
      due: dueCount,
      learning: learningCount,
      mastered: masteredCount,
    };
  }, [cards]);

  const currentCard = activeSessionCards[currentIndex];

  // Initialize board for current card in practice session
  const setupCardBoard = useCallback((card: TrainerCard) => {
    setBoardFen(card.fen);
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMoveSquares(null);
    setPendingPromotion(null);
    setFeedback('idle');
    setFeedbackMessage('Find the best move in this position.');
    setIsShowingSolution(false);
  }, []);

  // Start practice session
  const startSession = (cardsToPractice: TrainerCard[]) => {
    if (cardsToPractice.length === 0) return;
    setActiveSessionCards(cardsToPractice);
    setCurrentIndex(0);
    setIsSessionActive(true);
    setIsSessionFinished(false);
    setSessionResults([]);
    setupCardBoard(cardsToPractice[0]);
  };

  const handleStartDueSession = () => {
    const now = Date.now();
    const dueCards = cards.filter((c) => c.dueAt <= now);
    startSession(dueCards.length > 0 ? dueCards : cards);
  };

  const handleStartAllSession = () => {
    startSession(cards);
  };

  // Generate cards from all saved games in library
  const handleGenerateFromLibrary = async () => {
    const allGames = await db.games.toArray();
    let created = 0;
    for (const g of allGames) {
      if (g.report) {
        const count = await createCardsFromGameReport(g.id, g.report);
        created += count;
      }
    }
    alert(`Created ${created} new trainer cards from your saved games!`);
    refreshDeck();
  };

  // Handle user move on the trainer board
  const executeTrainerMove = (from: string, to: string, promo?: 'q' | 'r' | 'b' | 'n') => {
    if (!currentCard) return;

    const chess = new Chess(boardFen);
    const piece = chess.get(from as ChessSquare);

    if (
      piece &&
      piece.type === 'p' &&
      ((piece.color === 'w' && to.endsWith('8')) || (piece.color === 'b' && to.endsWith('1')))
    ) {
      if (!promo) {
        setPendingPromotion({ from, to });
        return;
      }
    }

    try {
      const moveRes = chess.move({
        from: from as ChessSquare,
        to: to as ChessSquare,
        promotion: promo || 'q',
      });

      if (!moveRes) {
        soundManager.play('illegal');
        return;
      }

      const playedUci = `${moveRes.from}${moveRes.to}${moveRes.promotion || ''}`;
      const fenAfter = chess.fen();

      setBoardFen(fenAfter);
      setLastMoveSquares({ from, to });
      setSelectedSquare(null);
      setLegalMoves([]);
      setPendingPromotion(null);

      // Check against solution
      const isSolution =
        playedUci === currentCard.solutionUci ||
        moveRes.san === currentCard.solutionUci ||
        (currentCard.pv && currentCard.pv[0] === playedUci);

      if (isSolution) {
        soundManager.play('retryCorrect');
        setFeedback('correct');
        setFeedbackMessage(`Correct! ${moveRes.san} is the winning move.`);

        // Play opponent reply from PV after 500ms
        if (currentCard.pv && currentCard.pv.length > 1) {
          setTimeout(() => {
            const replyUci = currentCard.pv[1];
            if (replyUci && replyUci.length >= 4) {
              const rFrom = replyUci.substring(0, 2) as ChessSquare;
              const rTo = replyUci.substring(2, 4) as ChessSquare;
              const rPromo = (replyUci[4] as 'q' | 'r' | 'b' | 'n' | undefined) || undefined;
              try {
                const replyChess = new Chess(fenAfter);
                const rRes = replyChess.move({ from: rFrom, to: rTo, promotion: rPromo });
                if (rRes) {
                  soundManager.play('move');
                  setBoardFen(replyChess.fen());
                  setLastMoveSquares({ from: rFrom, to: rTo });
                }
              } catch {
                // Ignore
              }
            }
          }, 500);
        }
      } else {
        soundManager.play('retryWrong');
        setFeedback('wrong');
        setFeedbackMessage('Incorrect move — try again or view the solution.');
      }
    } catch {
      soundManager.play('illegal');
    }
  };

  const handleShowSolution = () => {
    if (!currentCard) return;
    setIsShowingSolution(true);
    setFeedback('correct');
    setFeedbackMessage(`Solution: ${currentCard.pv?.slice(0, 4).join(' ') || currentCard.solutionUci}`);

    const pv = currentCard.pv || [currentCard.solutionUci];
    let stepFen = currentCard.fen;

    pv.slice(0, 2).forEach((uci, idx) => {
      setTimeout(() => {
        try {
          const stepChess = new Chess(stepFen);
          const from = uci.substring(0, 2) as ChessSquare;
          const to = uci.substring(2, 4) as ChessSquare;
          const promo = (uci[4] as 'q' | 'r' | 'b' | 'n' | undefined) || undefined;

          const res = stepChess.move({ from, to, promotion: promo });
          if (res) {
            stepFen = stepChess.fen();
            setBoardFen(stepFen);
            setLastMoveSquares({ from, to });
            soundManager.play(idx === 0 ? 'great' : 'move');
          }
        } catch {
          // Ignore
        }
      }, idx * 600);
    });
  };

  // Grade card with SM-2 and advance
  const handleGradeCard = async (grade: SM2Grade) => {
    if (!currentCard) return;

    await gradeTrainerCard(currentCard, grade);
    setSessionResults((prev) => [...prev, { cardId: currentCard.id, grade }]);

    const nextIndex = currentIndex + 1;
    if (nextIndex < activeSessionCards.length) {
      setCurrentIndex(nextIndex);
      setupCardBoard(activeSessionCards[nextIndex]);
    } else {
      setIsSessionFinished(true);
      refreshDeck();
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (confirm('Delete this card from your trainer deck?')) {
      await db.cards.delete(cardId);
      refreshDeck();
    }
  };

  // Board square selection
  const chessInstance = boardFen ? new Chess(boardFen) : null;
  const turn = chessInstance ? chessInstance.turn() : 'w';
  const orientation: 'white' | 'black' = currentCard
    ? (new Chess(currentCard.fen).turn() === 'w' ? 'white' : 'black')
    : 'white';

  const ranks = orientation === 'white' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = orientation === 'white' ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'];

  const handleSquareClick = (square: string) => {
    if (!chessInstance) return;

    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }
      if (legalMoves.includes(square)) {
        executeTrainerMove(selectedSquare, square);
        return;
      }
    }

    const piece = chessInstance.get(square as ChessSquare);
    if (piece && piece.color === turn) {
      const moves = chessInstance.moves({ square: square as ChessSquare, verbose: true });
      setSelectedSquare(square);
      setLegalMoves(moves.map((m) => m.to));
    } else {
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  };

  // Filtered deck for browser view
  const filteredDeck = useMemo(() => {
    const now = Date.now();
    return cards.filter((c) => {
      if (filterDueOnly && c.dueAt > now) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchMotif = c.motifs?.some((m) => m.toLowerCase().includes(q));
        const matchClass = c.classification.toLowerCase().includes(q);
        const matchSol = c.solutionUci.toLowerCase().includes(q);
        if (!matchMotif && !matchClass && !matchSol) return false;
      }
      return true;
    });
  }, [cards, filterDueOnly, searchQuery]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 glass-panel border-b border-slate-800/80 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>

            <div>
              <span className="text-base font-black text-white flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-emerald-400" />
                <span>Blunder Trainer (SM-2 Spaced Repetition)</span>
              </span>
              <p className="text-xs text-slate-400">
                Turn your own blunders into interactive flashcards
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-2 text-sm text-slate-300">
            <Link
              href="/review"
              className="px-3 py-1.5 rounded-lg hover:bg-slate-800/60 hover:text-white transition-colors"
            >
              Review
            </Link>
            <Link
              href="/library"
              className="px-3 py-1.5 rounded-lg hover:bg-slate-800/60 hover:text-white transition-colors"
            >
              Library
            </Link>
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-lg hover:bg-slate-800/60 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            <button
              onClick={() => setShowSettings(true)}
              className="px-2.5 py-1.5 rounded-lg hover:bg-slate-800/60 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold text-slate-400 cursor-pointer"
              aria-label="Open settings dialog"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* If Active Practice Session */}
        {isSessionActive && !isSessionFinished && currentCard && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 items-start max-w-5xl mx-auto">
            {/* Board Container */}
            <div className="flex flex-col items-center gap-3 w-full max-w-[540px] mx-auto">
              <div className="relative w-full aspect-square rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-800 bg-slate-950 select-none touch-none">
                <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
                  {ranks.map((rank, rankIdx) =>
                    files.map((file, fileIdx) => {
                      const square = `${file}${rank}` as ChessSquare;
                      const isLight = (rankIdx + fileIdx) % 2 === 0;
                      const piece = chessInstance ? chessInstance.get(square) : null;

                      const isLastMoveSource = lastMoveSquares?.from === square;
                      const isLastMoveDest = lastMoveSquares?.to === square;
                      const isSelected = selectedSquare === square;
                      const isLegalTarget = legalMoves.includes(square);
                      const isCaptureTarget =
                        isLegalTarget && Boolean(piece && piece.color !== turn);

                      const pieceCode = piece
                        ? (`${piece.color}${piece.type.toUpperCase()}` as PieceCode)
                        : null;

                      return (
                        <Square
                          key={square}
                          square={square}
                          isLight={isLight}
                          isLastMoveSource={isLastMoveSource}
                          isLastMoveDest={isLastMoveDest}
                          isSelected={isSelected}
                          isLegalTarget={isLegalTarget}
                          isCaptureTarget={isCaptureTarget}
                          isInCheck={false}
                          showRankCoord={fileIdx === 0 ? String(rank) : undefined}
                          showFileCoord={rankIdx === 7 ? file : undefined}
                          onClick={handleSquareClick}
                        >
                          {pieceCode && piece && (
                            <Piece
                              piece={pieceCode}
                              square={square}
                              isDraggable={piece.color === turn}
                              onClick={handleSquareClick}
                            />
                          )}
                        </Square>
                      );
                    }),
                  )}
                </div>

                {pendingPromotion && (
                  <PromotionDialog
                    color={turn as 'w' | 'b'}
                    onSelect={(p) =>
                      executeTrainerMove(pendingPromotion.from, pendingPromotion.to, p)
                    }
                    onCancel={() => setPendingPromotion(null)}
                  />
                )}
              </div>
            </div>

            {/* Session Practice Panel */}
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5">
              {/* Progress & Card Counter */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Card {currentIndex + 1} of {activeSessionCards.length}
                </span>
                <button
                  onClick={() => setIsSessionActive(false)}
                  className="text-xs text-slate-400 hover:text-white font-semibold"
                >
                  Exit Session
                </button>
              </div>

              {/* Card Context */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">
                    {orientation === 'white' ? 'White' : 'Black'} to move
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-[10px] font-bold text-rose-400 uppercase">
                    {currentCard.classification}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  In your game, you played a {currentCard.classification} here. Can you find the best move?
                </p>

                {currentCard.motifs && currentCard.motifs.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80">
                    {currentCard.motifs.map((m) => (
                      <span
                        key={m}
                        className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] font-mono text-emerald-400"
                      >
                        #{m.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Move Feedback Banner */}
              <div
                className={`p-3.5 rounded-2xl border text-xs font-medium flex items-start gap-2.5 transition-all ${
                  feedback === 'correct'
                    ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
                    : feedback === 'wrong'
                      ? 'bg-rose-950/70 border-rose-500/50 text-rose-200'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300'
                }`}
              >
                {feedback === 'correct' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                )}
                {feedback === 'wrong' && (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                {feedback === 'idle' && (
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <p className="font-semibold">{feedbackMessage}</p>
              </div>

              {/* Show Solution button if unsolved */}
              {feedback !== 'correct' && (
                <button
                  onClick={handleShowSolution}
                  disabled={isShowingSolution}
                  className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4 text-teal-400" />
                  <span>Show Solution</span>
                </button>
              )}

              {/* SM-2 Rating Buttons (revealed on correct solve or show solution) */}
              {feedback === 'correct' && (
                <div className="space-y-2 pt-2 border-t border-slate-800/80 animate-in fade-in">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block text-center">
                    How easy was this puzzle?
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => handleGradeCard('again')}
                      className="p-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-center text-rose-200 transition-colors"
                    >
                      <span className="block text-xs font-black">Again</span>
                      <span className="block text-[10px] text-rose-400 mt-0.5">&lt; 1 day</span>
                    </button>

                    <button
                      onClick={() => handleGradeCard('hard')}
                      className="p-2.5 rounded-xl bg-amber-950/60 hover:bg-amber-900 border border-amber-800 text-center text-amber-200 transition-colors"
                    >
                      <span className="block text-xs font-black">Hard</span>
                      <span className="block text-[10px] text-amber-400 mt-0.5">1–2 d</span>
                    </button>

                    <button
                      onClick={() => handleGradeCard('good')}
                      className="p-2.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800 text-center text-emerald-200 transition-colors"
                    >
                      <span className="block text-xs font-black">Good</span>
                      <span className="block text-[10px] text-emerald-400 mt-0.5">3–6 d</span>
                    </button>

                    <button
                      onClick={() => handleGradeCard('easy')}
                      className="p-2.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-800 text-center text-cyan-200 transition-colors"
                    >
                      <span className="block text-xs font-black">Easy</span>
                      <span className="block text-[10px] text-cyan-400 mt-0.5">7–14 d</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* If Session Finished Screen */}
        {isSessionActive && isSessionFinished && (
          <div className="p-12 rounded-3xl glass-card border border-slate-800 text-center space-y-5 max-w-lg mx-auto animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto">
              <Sparkles className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-black text-white">Practice Session Complete!</h2>
              <p className="text-xs text-slate-400">
                You reviewed {sessionResults.length} flashcard{sessionResults.length === 1 ? '' : 's'}. Due dates have been scheduled according to the SM-2 spaced repetition algorithm.
              </p>
            </div>
            <div className="pt-3 flex items-center justify-center gap-3">
              <button
                onClick={() => setIsSessionActive(false)}
                className="py-2.5 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-950/50 transition-colors"
              >
                Back to Trainer Deck
              </button>
            </div>
          </div>
        )}

        {/* Deck Overview Screen (when not practicing) */}
        {!isSessionActive && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                  <span>Due Today</span>
                  <Calendar className="w-4 h-4 text-rose-400" />
                </div>
                <p className="text-3xl font-black font-mono text-rose-400">{stats.due}</p>
                <p className="text-[11px] text-slate-500">Ready for review</p>
              </div>

              <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                  <span>Learning / New</span>
                  <RotateCcw className="w-4 h-4 text-amber-400" />
                </div>
                <p className="text-3xl font-black font-mono text-amber-400">{stats.learning}</p>
                <p className="text-[11px] text-slate-500">&lt; 2 repetitions</p>
              </div>

              <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                  <span>Mastered</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-3xl font-black font-mono text-emerald-400">{stats.mastered}</p>
                <p className="text-[11px] text-slate-500">&gt; 10 day intervals</p>
              </div>

              <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                  <span>Total Deck</span>
                  <Layers className="w-4 h-4 text-cyan-400" />
                </div>
                <p className="text-3xl font-black font-mono text-white">{stats.total}</p>
                <p className="text-[11px] text-slate-500">Blunder flashcards</p>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="p-5 rounded-3xl glass-card border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h3 className="text-sm font-black text-white">Practice Session</h3>
                <p className="text-xs text-slate-400">
                  {stats.due > 0
                    ? `You have ${stats.due} card${stats.due === 1 ? '' : 's'} due for spaced repetition practice today.`
                    : 'All caught up! You can practice all cards or generate more from your library.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={handleStartDueSession}
                  disabled={cards.length === 0}
                  className="py-2.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 text-xs font-extrabold shadow-lg shadow-emerald-950/40 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>{stats.due > 0 ? `Practice Due Cards (${stats.due})` : 'Practice Deck'}</span>
                </button>

                <button
                  onClick={handleStartAllSession}
                  disabled={cards.length === 0}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-bold border border-slate-700 transition-colors"
                >
                  Practice All ({cards.length})
                </button>

                <button
                  onClick={handleGenerateFromLibrary}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors"
                >
                  Generate from Library
                </button>
              </div>
            </div>

            {/* Deck Cards Browser */}
            <div className="p-6 rounded-3xl glass-card border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span>Deck Flashcards ({filteredDeck.length})</span>
                </h3>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filter by motif / move..."
                      className="pl-9 pr-3 py-1.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>

                  <button
                    onClick={() => setFilterDueOnly(!filterDueOnly)}
                    className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition-colors ${
                      filterDueOnly
                        ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Due Only
                  </button>
                </div>
              </div>

              {filteredDeck.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  No trainer cards found. Review games or click &quot;Generate from Library&quot; to populate your spaced repetition deck!
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredDeck.map((card) => {
                    const isDue = card.dueAt <= Date.now();
                    const dueStr = new Date(card.dueAt).toLocaleDateString();

                    return (
                      <div
                        key={card.id}
                        className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-[10px] font-bold text-rose-400 uppercase">
                              {card.classification}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400 ml-2">
                              Sol: {card.solutionUci}
                            </span>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              isDue
                                ? 'bg-rose-950 border border-rose-800 text-rose-300'
                                : 'bg-slate-900 border border-slate-800 text-slate-400'
                            }`}
                          >
                            {isDue ? 'Due Today' : `Due: ${dueStr}`}
                          </span>
                        </div>

                        {card.motifs && card.motifs.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            {card.motifs.map((m) => (
                              <span
                                key={m}
                                className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[9px] font-mono text-emerald-400"
                              >
                                #{m.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-800/80">
                          <span>
                            Reps: {card.reps} · Interval: {card.interval}d · Ease: {card.ease}
                          </span>

                          <button
                            onClick={() => handleDeleteCard(card.id)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                            title="Delete card"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
