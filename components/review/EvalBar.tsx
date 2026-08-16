'use client';

import React from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { useReviewStore } from '@/lib/store/reviewStore';
import { winPercent } from '@/lib/analysis/winProb';

export interface EvalBarProps {
  orientation?: 'vertical' | 'horizontal';
  className?: string;
}

function formatEvalScore(cp: number | null | undefined, mate: number | null | undefined): {
  whiteWinPercent: number;
  scoreLabel: string;
  isWhiteLeading: boolean;
} {
  if (mate !== null && mate !== undefined) {
    if (mate > 0) {
      return { whiteWinPercent: 100, scoreLabel: `M${mate}`, isWhiteLeading: true };
    }
    if (mate < 0) {
      return { whiteWinPercent: 0, scoreLabel: `-M${Math.abs(mate)}`, isWhiteLeading: false };
    }
    return { whiteWinPercent: 50, scoreLabel: '0.0', isWhiteLeading: true };
  }

  if (cp !== null && cp !== undefined) {
    const whiteWinPercent = winPercent(cp);
    const score = cp / 100;
    const formatted = Math.abs(score) < 0.05 ? '0.0' : score > 0 ? `+${score.toFixed(1)}` : score.toFixed(1);
    return {
      whiteWinPercent,
      scoreLabel: formatted,
      isWhiteLeading: score >= 0,
    };
  }

  return { whiteWinPercent: 50, scoreLabel: '0.0', isWhiteLeading: true };
}

export const EvalBar: React.FC<EvalBarProps> = ({
  orientation = 'vertical',
  className = '',
}) => {
  const { currentPly, orientation: boardOrientation } = useGameStore();
  const { gameReport, partialReports } = useReviewStore();

  const reports = gameReport?.moves || partialReports;
  const currentReport = currentPly > 0 ? reports[currentPly - 1] : undefined;

  let evalScore = { whiteWinPercent: 50, scoreLabel: '0.0', isWhiteLeading: true };

  if (currentPly === 0 && reports[0]) {
    evalScore = formatEvalScore(reports[0].cpBefore, reports[0].mateBefore);
  } else if (currentReport) {
    evalScore = formatEvalScore(currentReport.cpAfter, currentReport.mateAfter);
  }

  const { whiteWinPercent, scoreLabel, isWhiteLeading } = evalScore;

  // Bound win percent to avoid fully disappearing bar edges
  const clampedWhitePercent = Math.max(3, Math.min(97, whiteWinPercent));
  const isFlipped = boardOrientation === 'black';

  // Bottom percentage on vertical bar
  const bottomPercent = isFlipped ? 100 - clampedWhitePercent : clampedWhitePercent;
  const isBottomDominant = isFlipped ? !isWhiteLeading : isWhiteLeading;

  if (orientation === 'horizontal') {
    return (
      <div
        className={`relative w-full h-6 rounded-lg overflow-hidden bg-slate-900 border border-slate-700/80 shadow-inner flex select-none ${className}`}
        role="progressbar"
        aria-label="Evaluation bar"
        aria-valuenow={Math.round(whiteWinPercent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {/* White Bar */}
        <div
          className="h-full bg-slate-100 transition-all duration-300 ease-out flex items-center justify-start px-2"
          style={{ width: `${clampedWhitePercent}%` }}
        >
          {whiteWinPercent >= 50 && (
            <span className="text-[10px] font-bold font-mono text-slate-950 truncate">
              {scoreLabel}
            </span>
          )}
        </div>

        {/* Black Bar */}
        <div
          className="h-full bg-slate-950 transition-all duration-300 ease-out flex items-center justify-end px-2"
          style={{ width: `${100 - clampedWhitePercent}%` }}
        >
          {whiteWinPercent < 50 && (
            <span className="text-[10px] font-bold font-mono text-slate-100 truncate">
              {scoreLabel}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Vertical Bar
  return (
    <div
      className={`relative w-7 h-full min-h-[300px] max-h-[560px] rounded-xl overflow-hidden bg-slate-950 border-2 border-slate-800 shadow-xl flex flex-col justify-end select-none ${className}`}
      role="progressbar"
      aria-label="Evaluation bar"
      aria-valuenow={Math.round(whiteWinPercent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* Top portion (Black if standard orientation, White if flipped) */}
      <div
        className={`w-full transition-all duration-300 ease-out flex flex-col justify-start items-center pt-2 ${
          isFlipped ? 'bg-slate-100' : 'bg-slate-950'
        }`}
        style={{ height: `${100 - bottomPercent}%` }}
      >
        {!isBottomDominant && (
          <span
            className={`text-[10px] font-extrabold font-mono tracking-tight px-1 py-0.5 rounded shadow-sm ${
              isFlipped ? 'text-slate-950 bg-slate-200/80' : 'text-slate-100 bg-slate-900/90 border border-slate-800'
            }`}
          >
            {scoreLabel}
          </span>
        )}
      </div>

      {/* Bottom portion (White if standard orientation, Black if flipped) */}
      <div
        className={`w-full transition-all duration-300 ease-out flex flex-col justify-end items-center pb-2 ${
          isFlipped ? 'bg-slate-950' : 'bg-slate-100'
        }`}
        style={{ height: `${bottomPercent}%` }}
      >
        {isBottomDominant && (
          <span
            className={`text-[10px] font-extrabold font-mono tracking-tight px-1 py-0.5 rounded shadow-sm ${
              isFlipped ? 'text-slate-100 bg-slate-900/90 border border-slate-800' : 'text-slate-950 bg-slate-200/80'
            }`}
          >
            {scoreLabel}
          </span>
        )}
      </div>
    </div>
  );
};
