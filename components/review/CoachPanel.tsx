'use client';

import React from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { useReviewStore } from '@/lib/store/reviewStore';
import { CLASSIFICATION_META } from '@/lib/constants/classification';
import { Bot, Lightbulb, Target, Sparkles, RotateCcw } from 'lucide-react';
import { useRetryStore } from '@/lib/store/retryStore';
import { RetryPanel } from './RetryPanel';

export interface CoachPanelProps {
  className?: string;
}

export const CoachPanel: React.FC<CoachPanelProps> = ({ className = '' }) => {
  const { currentPly, game } = useGameStore();
  const { gameReport, partialReports, status } = useReviewStore();
  const { isActive: isRetryActive, startRetry } = useRetryStore();

  const reports = gameReport?.moves || partialReports;
  const currentReport = currentPly > 0 ? reports[currentPly - 1] : undefined;

  // If in active Retry Mode, render RetryPanel
  if (isRetryActive) {
    return <RetryPanel />;
  }

  if (status === 'analyzing' && !currentReport) {
    return (
      <div className={`p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400 space-y-3 ${className}`}>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
          <Bot className="w-4 h-4 animate-spin" />
          <span>Coach is analyzing this position...</span>
        </div>
        <div className="h-12 rounded-xl bg-slate-800/40 animate-pulse" />
      </div>
    );
  }

  if (currentPly === 0 || !currentReport) {
    const openingName = gameReport?.opening.name || game?.headers?.Opening || 'Starting Position';
    const eco = gameReport?.opening.eco || game?.headers?.ECO || 'ECO';

    return (
      <div className={`p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Coach Insights</h3>
              <p className="text-[10px] text-slate-400">Review commentary & tactical analysis</p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-mono text-emerald-400 font-bold border border-slate-700">
            {eco}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 space-y-1">
          <p className="font-semibold text-white">{openingName}</p>
          <p className="text-[11px] text-slate-400">
            Step through moves using the keyboard (← / →) or click any move in the history to view coach feedback.
          </p>
        </div>
      </div>
    );
  }

  const meta = CLASSIFICATION_META[currentReport.classification];
  const isBestOrBrilliant =
    currentReport.classification === 'brilliant' ||
    currentReport.classification === 'great' ||
    currentReport.classification === 'best';

  const isMistakeOrBlunder =
    currentReport.classification === 'mistake' ||
    currentReport.classification === 'miss' ||
    currentReport.classification === 'blunder';

  const moveNumber = Math.floor((currentReport.ply - 1) / 2) + 1;
  const isWhite = currentReport.ply % 2 === 1;
  const movePrefix = isWhite ? `${moveNumber}.` : `${moveNumber}...`;

  return (
    <div className={`p-3.5 sm:p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 sm:space-y-3.5 ${className}`}>
      {/* Header: Coach + Badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-emerald-600/30 to-teal-500/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-[11px] sm:text-xs font-bold text-white font-mono truncate">
                {movePrefix} {currentReport.san}
              </span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 shrink-0">({isWhite ? 'White' : 'Black'})</span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-400">Move {currentReport.ply} of {reports.length}</p>
          </div>
        </div>

        {/* Classification Badge */}
        {meta && (
          <div
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-xl text-slate-950 font-black text-[11px] sm:text-xs shadow-md shrink-0"
            style={{ backgroundColor: meta.color }}
          >
            <span>{meta.symbol}</span>
            <span>{meta.name}</span>
          </div>
        )}
      </div>

      {/* Coach Commentary Bubble */}
      <div className="p-3 sm:p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] sm:text-xs text-slate-200 leading-relaxed shadow-inner">
        <div className="flex items-start gap-2">
          {isBestOrBrilliant ? (
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <Lightbulb className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0 mt-0.5" />
          )}
          <p className="font-medium text-slate-100">
            {currentReport.comment || `${currentReport.san} was played.`}
          </p>
        </div>

        {/* Motifs Tags */}
        {currentReport.motifs && currentReport.motifs.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mt-2 pt-2 border-t border-slate-800/80">
            {currentReport.motifs.map((motif) => (
              <span
                key={motif}
                className="px-1.5 sm:px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[9px] sm:text-[10px] font-mono text-slate-300"
              >
                #{motif.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Try Again CTA for mistakes/misses/blunders */}
      {isMistakeOrBlunder && (
        <button
          onClick={() => startRetry(currentReport)}
          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600/80 to-orange-600/80 hover:from-amber-500 hover:to-orange-500 text-white font-extrabold text-xs shadow-lg shadow-orange-950/40 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <RotateCcw className="w-4 h-4 shrink-0" />
          <span>Try Again — Find the Best Move</span>
        </button>
      )}

      {/* Best Move Comparison & Alternatives */}
      {!isBestOrBrilliant && currentReport.best && currentReport.best.san && (
        <div className="p-2.5 sm:p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-1.5 sm:space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-400 flex items-center gap-1">
              <Target className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              Engine Recommendation:
            </span>
            <span className="font-mono font-bold text-emerald-300">
              {currentReport.best.san}
            </span>
          </div>

          {currentReport.best.pv && currentReport.best.pv.length > 1 && (
            <div className="text-[10px] sm:text-[11px] text-slate-400 font-mono bg-slate-900/60 p-2 rounded-lg break-words">
              <span className="text-slate-500 mr-1">Line:</span>
              {currentReport.best.pv.slice(0, 4).join(' ')}
            </div>
          )}
        </div>
      )}

      {/* Accuracy & Loss Metrics */}
      <div className="grid grid-cols-2 gap-2 pt-0.5">
        <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800 text-center">
          <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-semibold">Move Accuracy</span>
          <p className="text-[11px] sm:text-xs font-bold font-mono text-slate-200">
            {currentReport.accuracy.toFixed(1)}%
          </p>
        </div>
        <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800 text-center">
          <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-semibold">Advantage Loss</span>
          <p className="text-[11px] sm:text-xs font-bold font-mono text-slate-200">
            {(currentReport.epLoss * 100).toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
};
