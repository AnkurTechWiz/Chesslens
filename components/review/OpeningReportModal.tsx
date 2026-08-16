'use client';

import React from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { useReviewStore } from '@/lib/store/reviewStore';
import { BookOpen, X, Sparkles, ArrowRight } from 'lucide-react';

export interface OpeningReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OpeningReportModal: React.FC<OpeningReportModalProps> = ({ isOpen, onClose }) => {
  const { game, jumpToPly } = useGameStore();
  const { gameReport } = useReviewStore();

  if (!isOpen || !game || !gameReport) return null;

  const opening = gameReport.opening;
  const bookPlies = opening.bookPlies || 0;
  const leftTheoryMove = bookPlies < game.moves.length ? game.moves[bookPlies] : null;
  const leftTheoryNumber = leftTheoryMove ? Math.floor(leftTheoryMove.ply / 2) + 1 : null;
  const leftTheorySide = leftTheoryMove ? (leftTheoryMove.ply % 2 === 1 ? 'White' : 'Black') : null;

  const whiteOpenAcc = gameReport.phases.opening.white.toFixed(0);
  const blackOpenAcc = gameReport.phases.opening.black.toFixed(0);

  const bookMoves = game.moves.slice(0, bookPlies);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="opening-report-title"
    >
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 id="opening-report-title" className="text-base font-bold text-white flex items-center gap-2">
                <span>Opening Theory Report</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 font-mono">
                  {opening.eco || 'Custom'}
                </span>
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Opening Report"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Opening Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950/90 to-slate-900 border border-slate-800 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              ECO {opening.eco}
            </span>
            <h3 className="text-lg font-black text-white leading-snug">
              {opening.name || 'Custom / Unnamed Opening'}
            </h3>
            <p className="text-slate-400 text-xs">
              Both players followed standard theoretical book lines for{' '}
              <strong className="text-slate-200">{bookPlies} half-moves</strong> (
              {Math.ceil(bookPlies / 2)} full moves).
            </p>
          </div>

          {/* Left Theory Point */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Departure from Opening Theory
            </span>
            {leftTheoryMove ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="space-y-0.5">
                  <div className="font-bold text-white font-mono text-sm">
                    Move {leftTheoryNumber}
                    {leftTheorySide === 'White' ? '. ' : '... '}
                    {leftTheoryMove.san}
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    {leftTheorySide} was the first to deviate from master book lines.
                  </div>
                </div>
                <button
                  onClick={() => {
                    jumpToPly(leftTheoryMove.ply);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Jump</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <p className="text-slate-400 text-xs">
                Entire game followed registered opening theory.
              </p>
            )}
          </div>

          {/* Opening Phase Accuracy */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-center space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                White Opening Accuracy
              </span>
              <div className="text-2xl font-black font-mono text-emerald-400">
                {whiteOpenAcc}%
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-center space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                Black Opening Accuracy
              </span>
              <div className="text-2xl font-black font-mono text-emerald-400">
                {blackOpenAcc}%
              </div>
            </div>
          </div>

          {/* Book Moves Sequence */}
          {bookMoves.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Mainline Book Moves Played
              </span>
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-wrap gap-1.5 font-mono text-xs">
                {bookMoves.map((m, idx) => (
                  <span
                    key={m.ply}
                    className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-200"
                  >
                    {idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}. ` : ''}
                    {m.san}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-950/40 transition-colors cursor-pointer"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};
