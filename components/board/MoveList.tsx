'use client';

import React, { useEffect, useRef } from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { useReviewStore } from '@/lib/store/reviewStore';
import { ClassificationIcon } from '@/components/review/ClassificationIcon';
import { formatMsToClock } from '@/lib/pgn/clocks';
import { Clock } from 'lucide-react';

export const MoveList: React.FC = () => {
  const { game, currentPly, jumpToPly } = useGameStore();
  const { gameReport, partialReports } = useReviewStore();
  const activeMoveRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const reports = gameReport?.moves || partialReports;

  // Auto-scroll to active move
  useEffect(() => {
    if (activeMoveRef.current && containerRef.current) {
      const container = containerRef.current;
      const el = activeMoveRef.current;
      const elTop = el.offsetTop;
      const elHeight = el.offsetHeight;
      const containerTop = container.scrollTop;
      const containerHeight = container.clientHeight;

      if (elTop < containerTop || elTop + elHeight > containerTop + containerHeight) {
        container.scrollTo({
          top: elTop - containerHeight / 2 + elHeight / 2,
          behavior: 'smooth',
        });
      }
    }
  }, [currentPly]);

  if (!game || game.moves.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800/80 h-full min-h-[300px]">
        <p className="text-sm font-medium">No moves to display</p>
        <p className="text-xs text-slate-600 mt-1">Load or paste a PGN to step through moves</p>
      </div>
    );
  }

  // Group into move pairs (White and Black)
  const movePairs: Array<{
    moveNumber: number;
    white?: { ply: number; san: string; clockMs?: number; evalCp?: number; evalMate?: number };
    black?: { ply: number; san: string; clockMs?: number; evalCp?: number; evalMate?: number };
  }> = [];

  for (let i = 0; i < game.moves.length; i += 2) {
    const moveNumber = Math.floor(i / 2) + 1;
    const whiteMove = game.moves[i];
    const blackMove = game.moves[i + 1];

    movePairs.push({
      moveNumber,
      white: whiteMove
        ? {
            ply: whiteMove.ply,
            san: whiteMove.san,
            clockMs: whiteMove.clockMs,
            evalCp: whiteMove.evalCp,
            evalMate: whiteMove.evalMate,
          }
        : undefined,
      black: blackMove
        ? {
            ply: blackMove.ply,
            san: blackMove.san,
            clockMs: blackMove.clockMs,
            evalCp: blackMove.evalCp,
            evalMate: blackMove.evalMate,
          }
        : undefined,
    });
  }

  return (
    <div
      ref={containerRef}
      className="overflow-y-auto max-h-[500px] pr-1 space-y-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent rounded-xl"
    >
      <div className="grid grid-cols-[3rem_1fr_1fr] gap-1 px-2 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 bg-slate-900/60 sticky top-0 z-10 backdrop-blur-md">
        <span>#</span>
        <span>White</span>
        <span>Black</span>
      </div>

      {movePairs.map((pair) => {
        const isWhiteActive = pair.white && currentPly === pair.white.ply;
        const isBlackActive = pair.black && currentPly === pair.black.ply;

        const whiteReport = pair.white ? reports[pair.white.ply - 1] : undefined;
        const blackReport = pair.black ? reports[pair.black.ply - 1] : undefined;

        return (
          <div
            key={pair.moveNumber}
            className="grid grid-cols-[3rem_1fr_1fr] gap-1 items-center px-2 py-1 rounded-lg hover:bg-slate-800/40 text-xs font-mono transition-colors"
          >
            <span className="text-slate-500 font-semibold">{pair.moveNumber}.</span>

            {/* White Move */}
            {pair.white ? (
              <button
                ref={isWhiteActive ? activeMoveRef : null}
                onClick={() => pair.white && jumpToPly(pair.white.ply)}
                className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-all ${
                  isWhiteActive
                    ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm'
                    : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="truncate">{pair.white.san}</span>
                  {whiteReport && (
                    <ClassificationIcon
                      classification={whiteReport.classification}
                      size="sm"
                      className="shrink-0"
                    />
                  )}
                </div>

                {pair.white.clockMs !== undefined && (
                  <span className="text-[10px] text-slate-400 flex items-center gap-0.5 ml-1 opacity-80 shrink-0">
                    <Clock className="w-2.5 h-2.5" />
                    {formatMsToClock(pair.white.clockMs)}
                  </span>
                )}
              </button>
            ) : (
              <span />
            )}

            {/* Black Move */}
            {pair.black ? (
              <button
                ref={isBlackActive ? activeMoveRef : null}
                onClick={() => pair.black && jumpToPly(pair.black.ply)}
                className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-all ${
                  isBlackActive
                    ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm'
                    : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="truncate">{pair.black.san}</span>
                  {blackReport && (
                    <ClassificationIcon
                      classification={blackReport.classification}
                      size="sm"
                      className="shrink-0"
                    />
                  )}
                </div>

                {pair.black.clockMs !== undefined && (
                  <span className="text-[10px] text-slate-400 flex items-center gap-0.5 ml-1 opacity-80 shrink-0">
                    <Clock className="w-2.5 h-2.5" />
                    {formatMsToClock(pair.black.clockMs)}
                  </span>
                )}
              </button>
            ) : (
              <span />
            )}
          </div>
        );
      })}
    </div>
  );
};
