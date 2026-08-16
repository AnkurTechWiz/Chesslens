'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/lib/store/gameStore';
import { SAMPLE_GAMES, type SampleGame } from '@/lib/constants/sampleGames';
import { CLASSIFICATION_META } from '@/lib/constants/classification';
import { ClassificationIcon } from '@/components/review/ClassificationIcon';
import { SettingsModal } from '@/components/settings/SettingsModal';
import type { Classification } from '@/lib/types';
import {
  Sparkles,
  Zap,
  ShieldCheck,
  Cpu,
  Upload,
  BookOpen,
  FileText,
  RotateCcw,
  AlertCircle,
  PlayCircle,
  BarChart3,
  ArrowRight,
  Settings,
} from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  const router = useRouter();
  const [isIsolated, setIsIsolated] = useState<boolean | null>(null);
  const [threads, setThreads] = useState<number>(4);
  const [pgnInput, setPgnInput] = useState('');
  const [selectedGameId, setSelectedGameId] = useState<string>('kasparov-topalov');
  const [showSettings, setShowSettings] = useState(false);

  const { error, loadPgn, clearError } = useGameStore();

  useEffect(() => {
    const isolated = typeof window !== 'undefined' ? window.crossOriginIsolated : false;
    setIsIsolated(isolated);

    if (typeof navigator !== 'undefined') {
      setThreads(navigator.hardwareConcurrency || 4);
    }
  }, []);

  const handleSelectSample = (sample: SampleGame) => {
    setSelectedGameId(sample.id);
    const ok = loadPgn(sample.pgn);
    if (ok) {
      setPgnInput('');
      router.push('/review');
    }
  };

  const handleLoadCustomPgn = () => {
    if (!pgnInput.trim()) return;
    const ok = loadPgn(pgnInput);
    if (ok) {
      setPgnInput('');
      router.push('/review');
    }
    // If ok is false, pgnInput remains in the textarea and gameStore error is displayed
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        const ok = loadPgn(content);
        if (ok) {
          setPgnInput('');
          router.push('/review');
        } else {
          setPgnInput(content);
        }
      }
    };
    reader.readAsText(file);
  };

  const badgeOrder: Classification[] = [
    'brilliant',
    'great',
    'best',
    'excellent',
    'good',
    'book',
    'inaccuracy',
    'mistake',
    'miss',
    'blunder',
    'forced',
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 glass-panel border-b border-slate-800/80 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-900/30">
              <span className="text-xl font-black text-slate-950">♞</span>
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                Chess<span className="text-emerald-400">Lens</span>
              </span>
              <p className="text-xs text-slate-400">Free, Account-Free Game Review</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  isIsolated ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="text-slate-300 font-medium">
                {isIsolated ? 'COOP/COEP Active' : 'Single-Thread Fallback'}
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400">{threads} cores</span>
            </div>

            <nav className="flex items-center gap-1.5 text-sm text-slate-300">
              <Link
                href="/review"
                className="px-3 py-1.5 rounded-lg hover:bg-slate-800/60 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Review</span>
              </Link>
              <Link
                href="/library"
                className="px-3 py-1.5 rounded-lg hover:bg-slate-800/60 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold"
              >
                <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                <span>Library</span>
              </Link>
              <Link
                href="/dashboard"
                className="px-3 py-1.5 rounded-lg hover:bg-slate-800/60 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold"
              >
                <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
                <span>Dashboard</span>
              </Link>
              <Link
                href="/trainer"
                className="px-3 py-1.5 rounded-lg hover:bg-slate-800/60 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Trainer</span>
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
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-10 flex flex-col items-center">
        {/* Hero Header */}
        <div className="w-full max-w-3xl text-center space-y-4 mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-semibold uppercase tracking-wider shadow-inner">
            <Sparkles className="w-3.5 h-3.5" />
            <span>ChessLens Free &amp; Offline PWA Game Review Active</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Review Any Game, <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Fluid, Instant, Account-Free.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
            Experience grandmaster-grade annotated game reviews with client-side Stockfish 18 WASM,
            eval bar, advantage graphs, coach commentary, accuracy metrics, and tactical insights.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => handleSelectSample(SAMPLE_GAMES[0])}
              className="px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm shadow-xl shadow-emerald-950/50 flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sparkles className="w-4 h-4" />
              <span>One-Click Demo: Kasparov vs Topalov 1999</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <Link
              href="/review"
              className="px-5 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-bold text-sm flex items-center gap-2 transition-all"
            >
              <Upload className="w-4 h-4 text-slate-400" />
              <span>Review Workspace</span>
            </Link>
          </div>
        </div>

        {/* Sample Game Cards */}
        <div className="w-full max-w-4xl mb-8">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <PlayCircle className="w-4 h-4 text-emerald-400" />
              Select a Sample Game to Review
            </span>
            <span className="text-xs text-slate-500">Auto-loads &amp; redirects to workspace</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {SAMPLE_GAMES.map((sample) => {
              const isSelected = selectedGameId === sample.id;
              return (
                <button
                  key={sample.id}
                  onClick={() => handleSelectSample(sample)}
                  className={`p-4 rounded-2xl text-left border transition-all cursor-pointer group ${
                    isSelected
                      ? 'bg-emerald-500/15 border-emerald-500/50 shadow-md shadow-emerald-950/40'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p
                      className={`text-xs font-bold truncate ${
                        isSelected ? 'text-emerald-300' : 'text-slate-200 group-hover:text-emerald-400'
                      }`}
                    >
                      {sample.title}
                    </p>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2">{sample.subtitle}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Error Alert (if parse error) */}
        {error && (
          <div className="w-full max-w-3xl mb-6 p-4 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 flex items-start justify-between gap-3 shadow-lg animate-in fade-in duration-200">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-red-300">PGN Parsing Notice</h4>
                <p className="text-xs text-red-200/90 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              onClick={clearError}
              className="text-xs text-red-400 hover:text-red-200 underline shrink-0 font-medium cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* PGN Paste / Import Section */}
        <div className="w-full max-w-3xl glass-card rounded-2xl p-6 sm:p-8 space-y-6 glow-emerald mb-12">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-400" />
                Paste Custom PGN or FEN
              </span>
              <span>Validated with pure Zod schema</span>
            </div>
            <textarea
              id="pgn-input"
              value={pgnInput}
              onChange={(e) => setPgnInput(e.target.value)}
              placeholder="[Event &quot;Casual Game&quot;]&#10;1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7..."
              className="w-full h-36 bg-slate-950/70 border border-slate-800 rounded-xl p-4 text-sm font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 resize-none transition-all"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleLoadCustomPgn}
              disabled={!pgnInput.trim()}
              className="flex-1 py-3 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-slate-950 font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer text-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>Review Game (Analyze PGN)</span>
            </button>

            <label className="py-3 px-6 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer text-sm">
              <Upload className="w-4 h-4 text-slate-400" />
              <span>Upload .pgn</span>
              <input type="file" accept=".pgn" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        {/* Move Classifications Preview */}
        <div className="w-full max-w-4xl space-y-4 mb-12">
          <div className="text-center">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Move Classification Engine
            </h2>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {badgeOrder.map((key) => {
              const meta = CLASSIFICATION_META[key];
              return (
                <div
                  key={key}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all"
                >
                  <ClassificationIcon classification={key} size="sm" />
                  <span className="text-xs font-semibold text-slate-300">{meta.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Settings Modal */}
        <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
          <div className="glass-panel p-6 rounded-2xl space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Client-Side Stockfish</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Stockfish 18 runs directly in your browser with multi-threaded Web Workers. Zero
              server lag and zero API bills.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-2xl space-y-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">100% Private &amp; Local</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              No login, no database, no tracking cookies. All your games, reviews, and blunder
              decks persist locally via IndexedDB.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-2xl space-y-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Spaced Repetition Practice</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every blunder you make becomes an interactive retry card with SM-2 spaced repetition
              to lock in tactics forever.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 px-6 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} ChessLens · Free &amp; Open Source under GPL-3.0</p>
          <div className="flex items-center gap-4">
            <Link href="/library" className="hover:text-slate-300 transition-colors">
              Saved Games
            </Link>
            <Link href="/trainer" className="hover:text-slate-300 transition-colors">
              Blunder Trainer
            </Link>
            <a
              href="https://github.com/niklasf/stockfish.js"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-300 transition-colors"
            >
              Stockfish WASM
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
