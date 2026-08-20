'use client';

import React, { useState } from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { useReviewStore } from '@/lib/store/reviewStore';
import { CLASSIFICATION_META } from '@/lib/constants/classification';
import type { Classification, SavedGame } from '@/lib/types';
import { db } from '@/lib/storage/db';
import { createCardsFromGameReport } from '@/lib/storage/trainer';
import { Sparkles, Trophy, BookOpen, Layers, BookmarkPlus, Check, RotateCcw } from 'lucide-react';

import { ClassificationIcon } from './ClassificationIcon';

export interface SummaryPanelProps {
  className?: string;
}

const CLASSIFICATION_ORDER: Classification[] = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'book',
  'inaccuracy',
  'mistake',
  'miss',
  'blunder',
  'forced',
];

export const SummaryPanel: React.FC<SummaryPanelProps> = ({ className = '' }) => {
  const { game } = useGameStore();
  const { gameReport } = useReviewStore();
  const [savedToLibrary, setSavedToLibrary] = useState(false);
  const [sentToTrainer, setSentToTrainer] = useState(false);

  if (!gameReport) {
    return (
      <div className={`p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-3 ${className}`}>
        <Sparkles className="w-8 h-8 text-slate-600 mx-auto animate-pulse" />
        <h3 className="text-sm font-bold text-white">Full Game Report</h3>
        <p className="text-xs text-slate-400 max-w-xs mx-auto">
          Analysis is running in the background. Full accuracy and classification summary will appear once complete.
        </p>
      </div>
    );
  }

  const whitePlayer = game?.headers?.White || 'White';
  const blackPlayer = game?.headers?.Black || 'Black';
  const whiteAcc = gameReport.accuracy.white.toFixed(1);
  const blackAcc = gameReport.accuracy.black.toFixed(1);

  const handleSaveToLibrary = async () => {
    if (!game) return;
    try {
      // Reconstruct PGN
      let rawPgn = '';
      if (game.headers) {
        for (const [k, v] of Object.entries(game.headers)) {
          rawPgn += `[${k} "${v}"]\n`;
        }
        rawPgn += '\n';
      }
      rawPgn += game.moves
        .map(
          (m, idx) =>
            `${idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}. ` : ''}${m.san}`,
        )
        .join(' ');
      if (game.result) rawPgn += ` ${game.result}`;

      const gameId = `game-${Date.now()}`;
      const saved: SavedGame = {
        id: gameId,
        pgn: rawPgn.trim(),
        white: whitePlayer,
        black: blackPlayer,
        whiteElo: game.headers?.WhiteElo ? Number(game.headers.WhiteElo) : undefined,
        blackElo: game.headers?.BlackElo ? Number(game.headers.BlackElo) : undefined,
        result: game.result || '*',
        eco: gameReport.opening.eco,
        opening: gameReport.opening.name,
        timeControl: game.headers?.TimeControl as string | undefined,
        playedAt: Date.now(),
        source: 'paste',
        report: gameReport,
        engineVersion: 'sf18',
        depth: 12,
        createdAt: Date.now(),
      };

      await db.games.put(saved);
      setSavedToLibrary(true);
      setTimeout(() => setSavedToLibrary(false), 3000);
    } catch {
      // Fallback
    }
  };

  const handleSendToTrainer = async () => {
    if (!gameReport) return;
    try {
      const count = await createCardsFromGameReport(`review-${Date.now()}`, gameReport);
      setSentToTrainer(true);
      setTimeout(() => setSentToTrainer(false), 3000);
      alert(`Created ${count} blunder cards in your Trainer deck!`);
    } catch {
      // Fallback
    }
  };

  return (
    <div className={`space-y-3.5 sm:space-y-4 ${className}`}>
      {/* Accuracy & Estimated Elo Hero Card */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950/90 border border-slate-800 shadow-xl space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 sm:pb-2.5">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 shrink-0" />
            Accuracy (Lichess model)
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            ACPL: {gameReport.acpl.white.toFixed(0)} vs {gameReport.acpl.black.toFixed(0)}
          </span>
        </div>

        {/* Player Accuracy Comparison */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 items-center">
          {/* White Player */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 text-center space-y-0.5 sm:space-y-1">
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-300 truncate block">
              {whitePlayer}
            </span>
            <div className="text-xl sm:text-3xl font-black font-mono text-slate-100">
              {whiteAcc}%
            </div>
            <div className="text-[9px] sm:text-[10px] font-mono text-emerald-400/90">
              Est. ~{gameReport.estElo.white} Elo
            </div>
          </div>

          {/* Black Player */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 text-center space-y-0.5 sm:space-y-1">
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-300 truncate block">
              {blackPlayer}
            </span>
            <div className="text-xl sm:text-3xl font-black font-mono text-slate-100">
              {blackAcc}%
            </div>
            <div className="text-[9px] sm:text-[10px] font-mono text-emerald-400/90">
              Est. ~{gameReport.estElo.black} Elo
            </div>
          </div>
        </div>
      </div>

      {/* Move Breakdown Table (chess.com style) */}
      <div className="p-3 sm:p-4 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl space-y-2.5 sm:space-y-3">
        <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
          <span>White</span>
          <span>Move Classification</span>
          <span>Black</span>
        </div>

        <div className="space-y-1 font-mono text-[11px] sm:text-xs">
          {CLASSIFICATION_ORDER.map((type) => {
            const meta = CLASSIFICATION_META[type];
            const count = gameReport.counts[type] || { white: 0, black: 0 };
            const hasMoves = count.white > 0 || count.black > 0;

            return (
              <div
                key={type}
                className={`grid grid-cols-[2rem_1fr_2rem] sm:grid-cols-[2.5rem_1fr_2.5rem] items-center px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-xl transition-all ${
                  hasMoves ? 'bg-slate-950/50 hover:bg-slate-800/40' : 'opacity-40'
                }`}
              >
                {/* White Count */}
                <span className="font-bold text-center text-slate-200">
                  {count.white > 0 ? count.white : '-'}
                </span>

                {/* Badge Middle */}
                <div className="flex items-center justify-center gap-1 sm:gap-1.5 mx-auto">
                  <ClassificationIcon classification={type} size="sm" className="shrink-0" />
                  <span className="text-[11px] sm:text-xs font-semibold text-slate-300">
                    {meta.name}
                  </span>
                </div>

                {/* Black Count */}
                <span className="font-bold text-center text-slate-200">
                  {count.black > 0 ? count.black : '-'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Opening & Phase Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
        {/* Opening Info */}
        <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <BookOpen className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Opening</span>
          </div>
          <p className="text-xs font-bold text-white truncate">
            {gameReport.opening.name || 'Custom / Unnamed'}
          </p>
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 font-bold">
              {gameReport.opening.eco}
            </span>
            <span>{gameReport.opening.bookPlies} book plies</span>
          </div>
        </div>

        {/* Phase Accuracy Bars */}
        <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Phase Accuracies</span>
          </div>

          <div className="space-y-1 text-[10px] sm:text-[11px] font-mono">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-500">Open:</span>
              <span>{gameReport.phases.opening.white.toFixed(0)}% / {gameReport.phases.opening.black.toFixed(0)}%</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-500">Mid:</span>
              <span>{gameReport.phases.middlegame.white.toFixed(0)}% / {gameReport.phases.middlegame.black.toFixed(0)}%</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-500">End:</span>
              <span>{gameReport.phases.endgame.white.toFixed(0)}% / {gameReport.phases.endgame.black.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Save & Trainer Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        <button
          onClick={handleSaveToLibrary}
          disabled={savedToLibrary}
          className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          {savedToLibrary ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-emerald-400">Saved to Library!</span>
            </>
          ) : (
            <>
              <BookmarkPlus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Save to Library</span>
            </>
          )}
        </button>

        <button
          onClick={handleSendToTrainer}
          disabled={sentToTrainer}
          className="py-2.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          {sentToTrainer ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Blunders Added!</span>
            </>
          ) : (
            <>
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span>Add to Trainer</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
