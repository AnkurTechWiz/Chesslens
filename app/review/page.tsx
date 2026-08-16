'use client';

import React, { useEffect, useState, useRef, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGameStore } from '@/lib/store/gameStore';
import { useReviewStore } from '@/lib/store/reviewStore';
import { Board } from '@/components/board/Board';
import { MoveList } from '@/components/board/MoveList';
import { EvalBar } from '@/components/review/EvalBar';
import { EvalGraph } from '@/components/review/EvalGraph';
import { CoachPanel } from '@/components/review/CoachPanel';
import { SummaryPanel } from '@/components/review/SummaryPanel';
import { KeyMoments } from '@/components/review/KeyMoments';
import { AnalysisProgress } from '@/components/review/AnalysisProgress';
import { DebugOverlay } from '@/components/review/DebugOverlay';
import { EngineLines } from '@/components/review/EngineLines';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { GuessTheMoveModal } from '@/components/review/GuessTheMoveModal';
import { OpeningReportModal } from '@/components/review/OpeningReportModal';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { SAMPLE_GAMES } from '@/lib/constants/sampleGames';
import LZString from 'lz-string';
import {
  Sparkles,
  Share2,
  Bug,
  Cpu,
  Layers,
  ArrowLeft,
  FileText,
  Check,
  X,
  AlertCircle,
  Settings,
  Trophy,
  BookOpen,
} from 'lucide-react';
import Link from 'next/link';

function ReviewContent() {
  const searchParams = useSearchParams();
  const { game, error: gameError, boardFen, loadPgn, clearError } = useGameStore();
  const {
    status: reviewStatus,
    gameReport,
    activeTab,
    setActiveTab,
    showEngineLines,
    toggleEngineLines,
    debugMode,
    setDebugMode,
    startAnalysis,
  } = useReviewStore();

  const [copied, setCopied] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showGuessModal, setShowGuessModal] = useState(false);
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [pastedPgn, setPastedPgn] = useState('');
  const lastAnalyzedGameKeyRef = useRef<string | null>(null);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  // Read URL query params on mount & run review
  useEffect(() => {
    const gParam = searchParams.get('g');
    const debugParam = searchParams.get('debug');

    if (debugParam === '1') {
      setDebugMode(true);
    }

    let pgnToLoad: string | null = null;

    if (gParam) {
      try {
        const decompressed = LZString.decompressFromEncodedURIComponent(gParam);
        if (decompressed) {
          pgnToLoad = decompressed;
        }
      } catch (e) {
        console.error('Failed to decompress shared PGN:', e);
      }
    }

    if (!pgnToLoad && !game && SAMPLE_GAMES[0]) {
      pgnToLoad = SAMPLE_GAMES[0].pgn;
    }

    if (pgnToLoad) {
      const ok = loadPgn(pgnToLoad);
      if (ok) {
        const parsed = useGameStore.getState().game;
        if (parsed && parsed.moves.length > 0) {
          lastAnalyzedGameKeyRef.current = `${parsed.startingFen}-${parsed.moves.length}-${parsed.headers?.White || ''}`;
          startAnalysis(parsed);
        }
      }
    } else if (game && game.moves.length > 0) {
      const gameKey = `${game.startingFen}-${game.moves.length}-${game.headers?.White || ''}`;
      if (lastAnalyzedGameKeyRef.current !== gameKey || (!gameReport && reviewStatus === 'idle')) {
        lastAnalyzedGameKeyRef.current = gameKey;
        startAnalysis(game);
      }
    }
  }, [searchParams, game, loadPgn, setDebugMode, startAnalysis, gameReport, reviewStatus]);

  const handleCustomPgnSubmit = () => {
    if (!pastedPgn.trim()) return;
    const ok = loadPgn(pastedPgn);
    if (ok) {
      const parsed = useGameStore.getState().game;
      if (parsed && parsed.moves.length > 0) {
        lastAnalyzedGameKeyRef.current = `${parsed.startingFen}-${parsed.moves.length}-${parsed.headers?.White || ''}`;
        startAnalysis(parsed);
        setShowPasteModal(false);
        setPastedPgn('');
      }
    }
  };

  // Share review link handler
  const handleShare = useCallback(() => {
    if (!game) return;
    try {
      // Reconstruct PGN string
      let rawPgn = '';
      if (game.headers) {
        for (const [k, v] of Object.entries(game.headers)) {
          rawPgn += `[${k} "${v}"]\n`;
        }
        rawPgn += '\n';
      }
      rawPgn += game.moves.map((m, idx) => `${idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}. ` : ''}${m.san}`).join(' ');
      if (game.result) rawPgn += ` ${game.result}`;

      const compressed = LZString.compressToEncodedURIComponent(rawPgn.trim());
      const shareUrl = `${window.location.origin}/review?g=${compressed}`;

      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  }, [game]);

  const whitePlayer = game?.headers?.White || 'White';
  const blackPlayer = game?.headers?.Black || 'Black';
  const whiteElo = game?.headers?.WhiteElo;
  const blackElo = game?.headers?.BlackElo;
  const eventName = game?.headers?.Event || 'Game Review';

  return (
    <div className="flex flex-col min-h-screen">
      {/* Workspace Header */}
      <header className="sticky top-0 z-40 glass-panel border-b border-slate-800/80 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 text-xs font-semibold shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </Link>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-white truncate">
                  {whitePlayer} {whiteElo && `(${whiteElo})`} vs {blackPlayer}{' '}
                  {blackElo && `(${blackElo})`}
                </h1>
                {game?.result && (
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-mono font-bold text-emerald-400 shrink-0">
                    {game.result}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate">{eventName}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => setShowGuessModal(true)}
              className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Guess the Move Quiz Mode"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Quiz</span>
            </button>

            <button
              onClick={() => setShowOpeningModal(true)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Opening Theory Report"
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Opening</span>
            </button>

            <button
              onClick={() => setShowPasteModal(true)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Paste New PGN"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Paste PGN</span>
            </button>

            <button
              onClick={() => setDebugMode(!debugMode)}
              className={`p-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 ${
                debugMode
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Toggle ?debug=1 HUD"
            >
              <Bug className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Debug</span>
            </button>

            <button
              onClick={toggleEngineLines}
              className={`p-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 ${
                showEngineLines
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Toggle Live Stockfish Lines"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Engine</span>
            </button>

            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Settings"
              aria-label="Open Settings"
            >
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden lg:inline">Settings</span>
            </button>

            <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-400 border-l border-slate-800 pl-3">
              <Link
                href="/library"
                className="px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
              >
                Library
              </Link>
              <Link
                href="/dashboard"
                className="px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/trainer"
                className="px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
              >
                Trainer
              </Link>
            </div>

            <button
              onClick={handleShare}
              className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copied ? 'Link Copied!' : 'Share'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Parse Error Notice (if any) */}
      {gameError && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 w-full">
          <div className="p-4 rounded-2xl bg-red-950/60 border border-red-800/80 text-red-200 flex items-start justify-between gap-3 shadow-lg animate-in fade-in duration-200">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-red-300">PGN Parsing Notice</h4>
                <p className="text-xs text-red-200/90 mt-0.5">{gameError}</p>
              </div>
            </div>
            <button
              onClick={clearError}
              className="text-xs text-red-400 hover:text-red-200 underline shrink-0 font-medium"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Review Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 items-start">
          {/* Left Column: Board + EvalBar + Advantage Graph + Progress */}
          <div className="flex flex-col items-center gap-5 w-full">
            <ErrorBoundary fallbackTitle="Board Error">
              {/* Board Container with Side Eval Bar */}
              <div className="flex items-center justify-center gap-3 w-full max-w-[620px]">
                {/* Vertical Eval Bar (Desktop) */}
                <div className="hidden sm:block h-[560px] max-h-[560px]">
                  <EvalBar orientation="vertical" />
                </div>

                {/* Responsive Board with Arrow & Badge Layers */}
                <div className="flex-1 min-w-0">
                  {/* Horizontal Eval Bar (Mobile only) */}
                  <div className="block sm:hidden mb-2">
                    <EvalBar orientation="horizontal" />
                  </div>

                  <Board showControls={true} showCapturedStrips={true} />
                </div>
              </div>
            </ErrorBoundary>

            {/* Eval Graph (Advantage Timeline with classification dots) */}
            <ErrorBoundary fallbackTitle="Evaluation Graph Error">
              <div className="w-full max-w-[620px]">
                <EvalGraph height={100} />
              </div>
            </ErrorBoundary>

            {/* Analysis Progress & Control Bar */}
            <div className="w-full max-w-[620px]">
              <AnalysisProgress />
            </div>
          </div>

          {/* Right Column: Tabs (Summary, Moves, Key Moments) + Coach Card + Engine */}
          <div className="space-y-4 w-full">
            {/* Tab Navigation */}
            <div className="p-1 rounded-2xl bg-slate-900/80 border border-slate-800 grid grid-cols-3 gap-1 text-xs font-bold">
              <button
                onClick={() => setActiveTab('summary')}
                className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'summary'
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Report</span>
              </button>

              <button
                onClick={() => setActiveTab('moves')}
                className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'moves'
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Moves</span>
              </button>

              <button
                onClick={() => setActiveTab('moments')}
                className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'moments'
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Moments</span>
              </button>
            </div>

            {/* Active Tab Panel */}
            <ErrorBoundary fallbackTitle="Review Panel Error">
              <div className="min-h-[360px]">
                {activeTab === 'summary' && <SummaryPanel />}
                {activeTab === 'moves' && <MoveList />}
                {activeTab === 'moments' && <KeyMoments />}
              </div>
            </ErrorBoundary>

            {/* Pinned Coach Commentary Card */}
            <ErrorBoundary fallbackTitle="Coach Card Error">
              <CoachPanel />
            </ErrorBoundary>

            {/* Optional Live Engine PV Lines Panel */}
            {showEngineLines && (
              <ErrorBoundary fallbackTitle="Engine Lines Error">
                <EngineLines fen={boardFen} />
              </ErrorBoundary>
            )}
          </div>
        </div>
      </main>

      {/* Debug HUD Overlay */}
      <DebugOverlay />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      {/* Guess the Move Quiz Modal */}
      <GuessTheMoveModal
        isOpen={showGuessModal}
        onClose={() => setShowGuessModal(false)}
      />

      {/* Opening Report Modal */}
      <OpeningReportModal
        isOpen={showOpeningModal}
        onClose={() => setShowOpeningModal(false)}
      />

      {/* Paste PGN Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Paste PGN to Review</h3>
                  <p className="text-[11px] text-slate-400">Paste standard PGN or movetext to immediately analyze</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPasteModal(false);
                  setPastedPgn('');
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              value={pastedPgn}
              onChange={(e) => setPastedPgn(e.target.value)}
              placeholder="1. e4 e5 2. Nf3 Nc6 3. Bb5 a6..."
              className="w-full h-36 bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowPasteModal(false);
                  setPastedPgn('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCustomPgnSubmit}
                disabled={!pastedPgn.trim()}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Start Review</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen text-slate-400">
          Loading Review Workspace...
        </div>
      }
    >
      <ReviewContent />
    </Suspense>
  );
}
