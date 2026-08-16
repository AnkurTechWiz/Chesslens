'use client';

import React from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { useReviewStore } from '@/lib/store/reviewStore';
import { Bug, X } from 'lucide-react';

export const DebugOverlay: React.FC = () => {
  const { currentPly } = useGameStore();
  const { gameReport, partialReports, debugMode, setDebugMode } = useReviewStore();

  if (!debugMode) return null;

  const reports = gameReport?.moves || partialReports;
  const currentReport = currentPly > 0 ? reports[currentPly - 1] : undefined;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)] p-4 rounded-2xl bg-slate-950/95 border-2 border-emerald-500/50 shadow-2xl backdrop-blur-xl text-xs font-mono text-slate-300 space-y-3 select-text">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2 text-emerald-400 font-bold">
          <Bug className="w-4 h-4" />
          <span>Evaluation HUD (?debug=1)</span>
        </div>
        <button
          onClick={() => setDebugMode(false)}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {!currentReport ? (
        <p className="text-slate-500">No move selected or analysis pending...</p>
      ) : (
        <div className="space-y-1.5 text-[11px]">
          <div className="grid grid-cols-2 gap-1 bg-slate-900/60 p-2 rounded-lg">
            <div>
              <span className="text-slate-500">Ply:</span> {currentReport.ply} (
              {currentReport.ply % 2 === 1 ? 'White' : 'Black'})
            </div>
            <div>
              <span className="text-slate-500">Move:</span> {currentReport.san} (
              {currentReport.uci})
            </div>
            <div>
              <span className="text-slate-500">Classification:</span>{' '}
              <span className="text-emerald-400 font-bold uppercase">
                {currentReport.classification}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Accuracy:</span>{' '}
              {currentReport.accuracy.toFixed(1)}%
            </div>
          </div>

          <div className="bg-slate-900/60 p-2 rounded-lg space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">EP Loss:</span>
              <span className="text-amber-400 font-bold">
                {(currentReport.epLoss * 100).toFixed(2)}% ({currentReport.epLoss.toFixed(4)})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Win% (Before → After):</span>
              <span>
                {currentReport.winBefore.toFixed(1)}% → {currentReport.winAfter.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">CP (White View):</span>
              <span>
                {currentReport.cpBefore !== null
                  ? `${currentReport.cpBefore > 0 ? '+' : ''}${(currentReport.cpBefore / 100).toFixed(2)}`
                  : currentReport.mateBefore !== null
                    ? (currentReport.mateBefore > 0 ? `+M${currentReport.mateBefore}` : `-M${Math.abs(currentReport.mateBefore)}`)
                    : '–'}{' '}
                →{' '}
                {currentReport.cpAfter !== null
                  ? `${currentReport.cpAfter > 0 ? '+' : ''}${(currentReport.cpAfter / 100).toFixed(2)}`
                  : currentReport.mateAfter !== null
                    ? (currentReport.mateAfter > 0 ? `+M${currentReport.mateAfter}` : `-M${Math.abs(currentReport.mateAfter)}`)
                    : '–'}
              </span>
            </div>
          </div>

          <div className="bg-slate-900/60 p-2 rounded-lg space-y-1">
            <div className="text-slate-500 font-bold">Best Engine Move:</div>
            <div>
              <span className="text-emerald-300 font-bold">{currentReport.best.san}</span> (
              {currentReport.best.uci}) · CP:{' '}
              {currentReport.best.cp !== null
                ? `${currentReport.best.cp > 0 ? '+' : ''}${(currentReport.best.cp / 100).toFixed(2)}`
                : currentReport.best.mate !== null
                  ? `M${currentReport.best.mate}`
                  : '–'}
            </div>
            {currentReport.best.pv && (
              <div className="text-[10px] text-slate-400 truncate">
                PV: {currentReport.best.pv.join(' ')}
              </div>
            )}
            {currentReport.alt && (
              <div className="text-[10px] text-slate-400">
                Alt (PV2): {currentReport.alt.san} ({currentReport.alt.uci})
              </div>
            )}
          </div>

          {currentReport.motifs && currentReport.motifs.length > 0 && (
            <div className="bg-slate-900/60 p-2 rounded-lg">
              <span className="text-slate-500">Motifs:</span>{' '}
              <span className="text-cyan-300">{currentReport.motifs.join(', ')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
