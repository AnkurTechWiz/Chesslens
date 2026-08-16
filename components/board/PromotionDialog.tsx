'use client';

import React from 'react';
import { PieceSvg } from './PieceSvg';

export interface PromotionDialogProps {
  color: 'w' | 'b';
  onSelect: (piece: 'q' | 'r' | 'b' | 'n') => void;
  onCancel: () => void;
}

export const PromotionDialog: React.FC<PromotionDialogProps> = ({
  color,
  onSelect,
  onCancel,
}) => {
  const pieces: Array<{ type: 'q' | 'r' | 'b' | 'n'; label: string }> = [
    { type: 'q', label: 'Queen' },
    { type: 'n', label: 'Knight' },
    { type: 'r', label: 'Rook' },
    { type: 'b', label: 'Bishop' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onCancel}
    >
      <div
        className="glass-panel p-5 rounded-2xl shadow-2xl border border-slate-700/80 bg-slate-900/90 max-w-xs w-full text-center space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-white tracking-tight">
          Pawn Promotion
        </h3>
        <p className="text-xs text-slate-400">Choose a piece to promote to:</p>

        <div className="grid grid-cols-4 gap-2 pt-2">
          {pieces.map(({ type, label }) => {
            const pieceCode = `${color}${type.toUpperCase()}` as 'wQ' | 'wR' | 'wB' | 'wN' | 'bQ' | 'bR' | 'bB' | 'bN';
            return (
              <button
                key={type}
                onClick={() => onSelect(type)}
                className="group flex flex-col items-center justify-center p-2 rounded-xl bg-slate-800/80 hover:bg-emerald-500/20 hover:border-emerald-500 border border-slate-700 transition-all duration-150 transform hover:scale-105 active:scale-95 focus:outline-none"
                title={label}
              >
                <div className="w-12 h-12 flex items-center justify-center drop-shadow-md">
                  <PieceSvg piece={pieceCode} />
                </div>
                <span className="text-[10px] font-semibold text-slate-300 group-hover:text-emerald-300 mt-1">
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={onCancel}
          className="w-full py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
