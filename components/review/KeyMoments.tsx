'use client';

import React from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { useReviewStore } from '@/lib/store/reviewStore';
import { ClassificationIcon } from './ClassificationIcon';
import { Sparkles, ArrowRight } from 'lucide-react';

export interface KeyMomentsProps {
  className?: string;
}

export const KeyMoments: React.FC<KeyMomentsProps> = ({ className = '' }) => {
  const { currentPly, jumpToPly } = useGameStore();
  const { gameReport, partialReports } = useReviewStore();

  const reports = gameReport?.moves || partialReports;

  // Filter key moments
  const keyMoves = reports.filter((m) => {
    return (
      m.classification === 'brilliant' ||
      m.classification === 'great' ||
      m.classification === 'blunder' ||
      m.classification === 'miss' ||
      m.classification === 'mistake'
    );
  });

  if (keyMoves.length === 0) {
    return (
      <div className={`p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-2 ${className}`}>
        <Sparkles className="w-6 h-6 text-slate-500 mx-auto" />
        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Key Moments</h4>
        <p className="text-xs text-slate-400">
          No decisive mistakes, blunders, or brilliant moves detected yet.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          Critical Game Moments ({keyMoves.length})
        </span>
        <span className="text-[10px] text-slate-400">Click to jump & review</span>
      </div>

      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700">
        {keyMoves.map((moment) => {
          const isSelected = currentPly === moment.ply;
          const moveNumber = Math.floor((moment.ply - 1) / 2) + 1;
          const isWhite = moment.ply % 2 === 1;
          const movePrefix = isWhite ? `${moveNumber}.` : `${moveNumber}...`;

          return (
            <button
              key={moment.ply}
              onClick={() => jumpToPly(moment.ply)}
              className={`w-full p-3 rounded-xl text-left border transition-all flex items-center justify-between gap-3 group ${
                isSelected
                  ? 'bg-emerald-500/15 border-emerald-500/50 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/40'
                  : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
              }`}
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono text-white">
                    {movePrefix} {moment.san}
                  </span>
                  <span className="text-[10px] text-slate-400">({isWhite ? 'White' : 'Black'})</span>

                  <ClassificationIcon classification={moment.classification} size="sm" />
                </div>

                <p className="text-[11px] text-slate-300 truncate max-w-xs">
                  {moment.comment || `${moment.san} played.`}
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-1 text-xs font-semibold text-slate-400 group-hover:text-emerald-400 transition-colors">
                <span className="text-[10px] font-mono">Ply {moment.ply}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
