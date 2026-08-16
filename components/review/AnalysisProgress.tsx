'use client';

import React from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { useReviewStore } from '@/lib/store/reviewStore';
import { Cpu, RefreshCw, XCircle, Sparkles, CheckCircle2, AlertCircle, Eye, Radio } from 'lucide-react';

export interface AnalysisProgressProps {
  className?: string;
}

export const AnalysisProgress: React.FC<AnalysisProgressProps> = ({ className = '' }) => {
  const { game } = useGameStore();
  const {
    status,
    progress,
    error,
    isFollowingAnalysis,
    resumeFollow,
    pauseFollow,
    startAnalysis,
    cancelAnalysis,
  } = useReviewStore();

  const handleStart = () => {
    if (game) {
      startAnalysis(game);
    }
  };

  if (status === 'analyzing' && progress) {
    return (
      <div className={`p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-3 ${className}`}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-bold text-white tracking-tight">
              Analyzing Move {progress.ply} of {progress.total}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Follow analysis / Live playback control */}
            {isFollowingAnalysis ? (
              <button
                onClick={pauseFollow}
                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-semibold transition-all cursor-pointer"
                title="Pause live analysis playback (stay on current move)"
              >
                <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                <span>Live Playback</span>
              </button>
            ) : (
              <button
                onClick={resumeFollow}
                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold transition-all cursor-pointer animate-pulse shadow-sm"
                title="Resume following live analysis moves on board"
              >
                <Eye className="w-3 h-3 text-amber-400" />
                <span>Follow analysis</span>
              </button>
            )}

            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-slate-700 font-semibold uppercase">
              {progress.currentPass === 'scan' ? 'Pass A · Scan' : 'Pass B · Verify'}
            </span>

            <button
              onClick={cancelAnalysis}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
              title="Cancel Analysis"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-300 ease-out"
            style={{ width: `${progress.percent}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <span>Deterministic depth 12 / 20</span>
          <span>{progress.percent}%</span>
        </div>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className={`flex items-center justify-between p-3 rounded-2xl bg-slate-900/60 border border-slate-800 ${className}`}>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Analysis Complete</span>
          <span className="text-slate-600">·</span>
          <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
            <Cpu className="w-3 h-3 text-slate-400" />
            SF18-lite WASM
          </span>
        </div>

        <button
          onClick={handleStart}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Re-analyze</span>
        </button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={`p-4 rounded-2xl bg-red-950/40 border border-red-800/80 text-red-200 space-y-2 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-xs font-bold text-red-300">Analysis Stopped</span>
          </div>
          <button
            onClick={handleStart}
            className="px-3 py-1 rounded-lg bg-red-900/80 hover:bg-red-800 text-xs font-bold text-white transition-all cursor-pointer"
          >
            Retry
          </button>
        </div>
        <p className="text-[11px] text-red-300/90">{error}</p>
      </div>
    );
  }

  // Idle state
  return (
    <div className={`p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-4 ${className}`}>
      <div className="space-y-0.5">
        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          Stockfish Game Review
        </h4>
        <p className="text-[11px] text-slate-400">
          Run complete 2-pass deterministic analysis on this game
        </p>
      </div>

      <button
        onClick={handleStart}
        disabled={!game || game.moves.length === 0}
        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer shrink-0"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>Start Review</span>
      </button>
    </div>
  );
};
