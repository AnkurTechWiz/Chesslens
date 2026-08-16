'use client';

import React from 'react';
import { PieceSvg, type PieceCode } from './PieceSvg';

export interface CapturedStripProps {
  playerName?: string;
  playerElo?: number;
  playerColor: 'white' | 'black';
  capturedPieces: string[]; // Pieces captured by this player (e.g. ['bP', 'bP', 'bN'])
  materialAdvantage?: number; // Point differential if this player is ahead
  isTurn?: boolean;
}

export const CapturedStrip: React.FC<CapturedStripProps> = ({
  playerName,
  playerElo,
  playerColor,
  capturedPieces,
  materialAdvantage = 0,
  isTurn = false,
}) => {
  // Sort pieces by standard value Q > R > B > N > P
  const order: Record<string, number> = { Q: 5, R: 4, B: 3, N: 2, P: 1 };
  const sortedPieces = [...capturedPieces].sort((a, b) => {
    const typeA = a.charAt(1);
    const typeB = b.charAt(1);
    return (order[typeB] || 0) - (order[typeA] || 0);
  });

  const isWhite = playerColor === 'white';

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-slate-900/60 rounded-xl border border-slate-800/80 w-full select-none">
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`w-3 h-3 rounded-full border ${
            isWhite
              ? 'bg-slate-100 border-slate-300'
              : 'bg-slate-900 border-slate-700'
          } ${isTurn ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-slate-950 animate-pulse' : ''}`}
        />
        <div className="flex items-center gap-1.5 truncate">
          <span className="text-xs font-bold text-slate-200 truncate">
            {playerName || (isWhite ? 'White' : 'Black')}
          </span>
          {playerElo !== undefined && (
            <span className="text-[11px] font-medium text-slate-400">
              ({playerElo})
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Captured piece icons */}
        <div className="flex items-center -space-x-1.5 overflow-hidden">
          {sortedPieces.map((p, idx) => (
            <div
              key={`${p}-${idx}`}
              className="w-5 h-5 flex items-center justify-center drop-shadow transition-transform hover:scale-125 hover:z-20"
              title={p}
            >
              <PieceSvg piece={p as PieceCode} />
            </div>
          ))}
        </div>

        {/* Material Advantage Badge */}
        {materialAdvantage > 0 && (
          <span className="text-[11px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            +{materialAdvantage}
          </span>
        )}
      </div>
    </div>
  );
};
