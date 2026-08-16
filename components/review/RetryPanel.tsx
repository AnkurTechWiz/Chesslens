'use client';

import React, { useState } from 'react';
import { useRetryStore } from '@/lib/store/retryStore';
import { createCardFromMove } from '@/lib/storage/trainer';
import {
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  X,
  BookmarkPlus,
  Check,
  Sparkles,
} from 'lucide-react';

export const RetryPanel: React.FC = () => {
  const {
    isActive,
    ply,
    fenBefore,
    moverColor,
    originalMove,
    bestMove,
    motifs,
    verdict,
    verdictMessage,
    userMoves,
    isShowingSolution,
    showSolution,
    resetRetry,
    exitRetry,
  } = useRetryStore();

  const [savedToTrainer, setSavedToTrainer] = useState(false);

  if (!isActive) return null;

  const moveNumber = Math.floor((ply - 1) / 2) + 1;
  const isWhite = moverColor === 'w';
  const movePrefix = isWhite ? `${moveNumber}.` : `${moveNumber}...`;

  const handleAddToTrainer = async () => {
    if (!bestMove) return;
    try {
      await createCardFromMove(
        fenBefore,
        bestMove.uci,
        bestMove.pv || [bestMove.uci],
        motifs,
        originalMove?.classification || 'blunder',
      );
      setSavedToTrainer(true);
      setTimeout(() => setSavedToTrainer(false), 2500);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="p-4 rounded-2xl bg-slate-900/90 border-2 border-emerald-500/50 shadow-2xl space-y-3.5 animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black text-white uppercase tracking-wider">
                Retry Mode
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-mono text-emerald-400 font-bold border border-slate-700">
                {movePrefix} ({isWhite ? 'White' : 'Black'} to move)
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              Find a better move on the board
            </p>
          </div>
        </div>

        <button
          onClick={exitRetry}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          title="Exit Retry Mode"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Game context note */}
      {originalMove && (
        <div className="text-xs text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 flex items-center justify-between">
          <span>Game move:</span>
          <span className="font-mono font-bold text-rose-400 flex items-center gap-1">
            {originalMove.san} ({originalMove.classification})
          </span>
        </div>
      )}

      {/* Verdict Alert Box */}
      <div
        className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs font-medium transition-all ${
          verdict === 'correct'
            ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-200'
            : verdict === 'better_not_best'
              ? 'bg-amber-950/70 border-amber-500/60 text-amber-200'
              : verdict === 'losing'
                ? 'bg-rose-950/70 border-rose-500/60 text-rose-200'
                : 'bg-slate-950/70 border-slate-800 text-slate-300'
        }`}
      >
        {verdict === 'correct' && (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        )}
        {verdict === 'better_not_best' && (
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        )}
        {verdict === 'losing' && (
          <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
        )}
        {verdict === 'idle' && (
          <HelpCircle className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
        )}
        <div className="flex-1">
          <p className="font-semibold">{verdictMessage}</p>
        </div>
      </div>

      {/* Move Breadcrumbs */}
      {userMoves.length > 0 && (
        <div className="p-2 rounded-lg bg-slate-950/40 border border-slate-800/80 text-[11px] font-mono text-slate-300 flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-500">Attempt:</span>
          {userMoves.map((m, idx) => (
            <span
              key={idx}
              className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-400 font-bold"
            >
              {m}
            </span>
          ))}
        </div>
      )}

      {/* Action Controls */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          onClick={resetRetry}
          className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>

        <button
          onClick={showSolution}
          disabled={isShowingSolution}
          className="py-2 px-3 rounded-xl bg-teal-600/80 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-teal-950/40"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Show Solution</span>
        </button>
      </div>

      {/* Secondary Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
        <button
          onClick={handleAddToTrainer}
          disabled={savedToTrainer}
          className="flex-1 py-1.5 px-3 rounded-lg bg-slate-950 hover:bg-slate-800 text-[11px] font-semibold text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5 border border-slate-800"
        >
          {savedToTrainer ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Added to Trainer!</span>
            </>
          ) : (
            <>
              <BookmarkPlus className="w-3.5 h-3.5 text-slate-400" />
              <span>Add to Trainer Deck</span>
            </>
          )}
        </button>

        <button
          onClick={exitRetry}
          className="py-1.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-bold transition-all flex items-center justify-center gap-1"
        >
          <span>Back to Game</span>
        </button>
      </div>
    </div>
  );
};
