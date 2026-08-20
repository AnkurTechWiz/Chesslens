'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { db } from '@/lib/storage/db';
import { SettingsModal } from '@/components/settings/SettingsModal';
import type { SavedGame } from '@/lib/types';
import {
  BarChart3,
  TrendingUp,
  AlertOctagon,
  Clock,
  BookOpen,
  ArrowLeft,
  Sparkles,
  Zap,
  Target,
  Settings,
} from 'lucide-react';

export default function DashboardPage() {
  const [games, setGames] = useState<SavedGame[]>([]);
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    async function loadGames() {
      try {
        const allGames = await db.games.orderBy('playedAt').toArray();
        setGames(allGames);
      } catch {
        // Fallback
      }
    }
    loadGames();
  }, []);

  // Aggregated analytics derived purely from local library
  const analytics = useMemo(() => {
    if (games.length === 0) return null;

    let totalWhiteAcc = 0;
    let totalBlackAcc = 0;
    let gamesWithAcc = 0;

    let totalWhiteAcpl = 0;
    let totalBlackAcpl = 0;

    let wins = 0;
    let losses = 0;
    let draws = 0;

    const classificationCounts: Record<string, number> = {
      blunder: 0,
      miss: 0,
      mistake: 0,
      inaccuracy: 0,
      brilliant: 0,
      great: 0,
    };

    const motifCounts: Record<string, number> = {};

    // Time-pressure correlation buckets
    let fastMoves = 0; // < 10s
    let fastBlunders = 0;
    let midMoves = 0; // 10s - 30s
    let midBlunders = 0;
    let slowMoves = 0; // > 30s
    let slowBlunders = 0;

    // ECO opening performance
    const ecoStats: Record<
      string,
      { eco: string; name: string; count: number; totalAcc: number; wins: number }
    > = {};

    for (const g of games) {
      if (g.result === '1-0') wins++;
      else if (g.result === '0-1') losses++;
      else if (g.result === '1/2-1/2') draws++;

      if (g.report) {
        if (g.report.accuracy) {
          totalWhiteAcc += g.report.accuracy.white || 0;
          totalBlackAcc += g.report.accuracy.black || 0;
          gamesWithAcc++;
        }

        if (g.report.acpl) {
          totalWhiteAcpl += g.report.acpl.white || 0;
          totalBlackAcpl += g.report.acpl.black || 0;
        }

        if (g.report.counts) {
          for (const [key, counts] of Object.entries(g.report.counts)) {
            if (classificationCounts[key] !== undefined) {
              classificationCounts[key] += (counts.white || 0) + (counts.black || 0);
            }
          }
        }

        // Moves iteration for motifs and clock correlations
        if (g.report.moves) {
          for (const m of g.report.moves) {
            // Motifs
            if (m.motifs) {
              for (const motif of m.motifs) {
                motifCounts[motif] = (motifCounts[motif] || 0) + 1;
              }
            }

            // Time pressure analysis
            if (m.clockMs !== undefined) {
              const isBad = ['blunder', 'miss', 'mistake'].includes(m.classification);
              if (m.clockMs < 10000) {
                fastMoves++;
                if (isBad) fastBlunders++;
              } else if (m.clockMs < 30000) {
                midMoves++;
                if (isBad) midBlunders++;
              } else {
                slowMoves++;
                if (isBad) slowBlunders++;
              }
            }
          }
        }

        // Opening stats
        const eco = g.eco || g.report.opening?.eco || 'A00';
        const openingName = g.opening || g.report.opening?.name || 'Custom';
        const avgGameAcc =
          ((g.report.accuracy?.white || 0) + (g.report.accuracy?.black || 0)) / 2;
        const isWin = g.result === '1-0';

        if (!ecoStats[eco]) {
          ecoStats[eco] = {
            eco,
            name: openingName,
            count: 0,
            totalAcc: 0,
            wins: 0,
          };
        }
        ecoStats[eco].count++;
        ecoStats[eco].totalAcc += avgGameAcc;
        if (isWin) ecoStats[eco].wins++;
      }
    }

    const avgWhiteAcc = gamesWithAcc > 0 ? totalWhiteAcc / gamesWithAcc : 0;
    const avgBlackAcc = gamesWithAcc > 0 ? totalBlackAcc / gamesWithAcc : 0;
    const avgWhiteAcpl = gamesWithAcc > 0 ? totalWhiteAcpl / gamesWithAcc : 0;
    const avgBlackAcpl = gamesWithAcc > 0 ? totalBlackAcpl / gamesWithAcc : 0;

    const topMotifs = Object.entries(motifCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const topOpenings = Object.values(ecoStats)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      totalGames: games.length,
      avgWhiteAcc,
      avgBlackAcc,
      avgWhiteAcpl,
      avgBlackAcpl,
      wins,
      losses,
      draws,
      winRate: games.length > 0 ? Math.round((wins / games.length) * 100) : 0,
      classificationCounts,
      topMotifs,
      topOpenings,
      timePressure: {
        fastBlunderRate: fastMoves > 0 ? Math.round((fastBlunders / fastMoves) * 100) : 0,
        midBlunderRate: midMoves > 0 ? Math.round((midBlunders / midMoves) * 100) : 0,
        slowBlunderRate: slowMoves > 0 ? Math.round((slowBlunders / slowMoves) * 100) : 0,
        hasClockData: fastMoves + midMoves + slowMoves > 0,
      },
    };
  }, [games]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 glass-panel border-b border-slate-800/80 px-3.5 sm:px-6 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href="/library"
              className="p-1.5 sm:p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 text-xs font-semibold shrink-0"
              title="Back to Library"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden md:inline">Library</span>
            </Link>

            <div className="min-w-0">
              <span className="text-sm sm:text-base font-black text-white flex items-center gap-1.5 sm:gap-2 truncate">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
                <span className="truncate">Dashboard</span>
              </span>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                Calculated on-device from your local library
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-slate-300">
            <Link
              href="/review"
              className="px-2 sm:px-3 py-1.5 rounded-lg hover:bg-slate-800/60 hover:text-white transition-colors flex items-center gap-1"
            >
              Review
            </Link>
            <Link
              href="/library"
              className="px-2 sm:px-3 py-1.5 rounded-lg hover:bg-slate-800/60 hover:text-white transition-colors flex items-center gap-1"
            >
              Library
            </Link>
            <Link
              href="/trainer"
              className="px-2 sm:px-3 py-1.5 rounded-lg hover:bg-slate-800/60 hover:text-white transition-colors flex items-center gap-1"
            >
              Trainer
            </Link>
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg hover:bg-slate-800/60 hover:text-white transition-colors flex items-center gap-1 text-xs font-semibold text-slate-400 cursor-pointer"
              aria-label="Open settings dialog"
              title="Settings"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Settings</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3.5 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {!analytics || games.length === 0 ? (
          <div className="p-8 sm:p-12 rounded-2xl sm:rounded-3xl glass-card border border-slate-800 text-center space-y-4 max-w-lg mx-auto">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-bold text-white">No Game Data Yet</h3>
              <p className="text-xs text-slate-400">
                Review or import games to see your accuracy progression, blunder patterns, and opening win rates.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/library"
                className="py-2.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-950/40 inline-flex items-center gap-1.5 transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                <span>Go to Library to Import Games</span>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Top Stat KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4 sm:p-5 rounded-2xl glass-card border border-slate-800 space-y-1.5 sm:space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                  <span>Reviewed Games</span>
                  <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                    {analytics.totalGames}
                  </span>
                  <span className="text-xs text-emerald-400 font-bold">
                    {analytics.winRate}% win rate
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-500">
                  {analytics.wins}W · {analytics.losses}L · {analytics.draws}D
                </p>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl glass-card border border-slate-800 space-y-1.5 sm:space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                  <span className="truncate">Average Accuracy</span>
                  <TrendingUp className="w-4 h-4 text-cyan-400 shrink-0" />
                </div>
                <div className="flex items-baseline gap-1.5 sm:gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                    {analytics.avgWhiteAcc.toFixed(1)}%
                  </span>
                  <span className="text-xs text-slate-400 truncate">
                    / {analytics.avgBlackAcc.toFixed(1)}% (B)
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-500">
                  Avg ACPL: {analytics.avgWhiteAcpl.toFixed(0)}cp
                </p>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl glass-card border border-slate-800 space-y-1.5 sm:space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                  <span>Blunders &amp; Mistakes</span>
                  <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-rose-300 font-mono">
                    {analytics.classificationCounts.blunder +
                      analytics.classificationCounts.miss +
                      analytics.classificationCounts.mistake}
                  </span>
                  <span className="text-xs text-rose-400 font-bold">
                    ({analytics.classificationCounts.blunder} Blunders)
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-500 truncate">
                  {analytics.classificationCounts.miss} Misses · {analytics.classificationCounts.mistake} Mistakes
                </p>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl glass-card border border-slate-800 space-y-1.5 sm:space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                  <span>Brilliant &amp; Great Moves</span>
                  <Sparkles className="w-4 h-4 text-teal-400 shrink-0" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-teal-300 font-mono">
                    {analytics.classificationCounts.brilliant +
                      analytics.classificationCounts.great}
                  </span>
                  <span className="text-xs text-teal-400 font-bold">
                    ({analytics.classificationCounts.brilliant} Brilliant !!)
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-500">
                  {analytics.classificationCounts.great} Great moves found
                </p>
              </div>
            </div>

            {/* Accuracy Progression Timeline Chart */}
            <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl glass-card border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-black text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span>Accuracy Progression</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Accuracy trajectory across your last {games.length} reviewed games
                  </p>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 text-xs font-semibold flex-wrap">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span>White Accuracy</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-cyan-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                    <span>Black Accuracy</span>
                  </span>
                </div>
              </div>

              {/* Hand-rolled responsive SVG chart */}
              <div className="relative w-full h-[180px] bg-slate-950/60 rounded-2xl border border-slate-800/80 p-2 overflow-hidden select-none">
                {games.length < 2 ? (
                  <div className="flex items-center justify-center h-full text-xs text-slate-500">
                    Review at least 2 games to plot progression curve.
                  </div>
                ) : (
                  <svg className="w-full h-full" viewBox="0 0 1000 150" preserveAspectRatio="none">
                    {/* Grid Lines */}
                    <line x1="0" y1="37.5" x2="1000" y2="37.5" stroke="#334155" strokeDasharray="4 4" strokeWidth="0.5" />
                    <line x1="0" y1="75" x2="1000" y2="75" stroke="#334155" strokeDasharray="4 4" strokeWidth="0.5" />
                    <line x1="0" y1="112.5" x2="1000" y2="112.5" stroke="#334155" strokeDasharray="4 4" strokeWidth="0.5" />

                    {/* White Accuracy Line */}
                    <polyline
                      fill="none"
                      stroke="#34d399"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={games
                        .map((g, idx) => {
                          const x = (idx / (games.length - 1)) * 1000;
                          const acc = g.report?.accuracy?.white || 50;
                          const y = 150 - (acc / 100) * 150;
                          return `${x},${y}`;
                        })
                        .join(' ')}
                    />

                    {/* Black Accuracy Line */}
                    <polyline
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={games
                        .map((g, idx) => {
                          const x = (idx / (games.length - 1)) * 1000;
                          const acc = g.report?.accuracy?.black || 50;
                          const y = 150 - (acc / 100) * 150;
                          return `${x},${y}`;
                        })
                        .join(' ')}
                    />

                    {/* Interactive dots */}
                    {games.map((g, idx) => {
                      const x = (idx / (games.length - 1)) * 1000;
                      const whiteAcc = g.report?.accuracy?.white || 50;
                      const y = 150 - (whiteAcc / 100) * 150;
                      const isHovered = hoveredTrendIndex === idx;

                      return (
                        <circle
                          key={idx}
                          cx={x}
                          cy={y}
                          r={isHovered ? 6 : 3.5}
                          className="fill-emerald-400 stroke-slate-950 stroke-2 transition-all cursor-pointer"
                          onMouseEnter={() => setHoveredTrendIndex(idx)}
                          onMouseLeave={() => setHoveredTrendIndex(null)}
                        />
                      );
                    })}
                  </svg>
                )}

                {/* Hover Tooltip */}
                {hoveredTrendIndex !== null && games[hoveredTrendIndex] && (
                  <div className="absolute bottom-3 left-4 p-2 rounded-lg bg-slate-900/90 border border-slate-700 text-[11px] text-white space-y-0.5 shadow-xl pointer-events-none">
                    <p className="font-bold">
                      Game {hoveredTrendIndex + 1}: {games[hoveredTrendIndex].white} vs{' '}
                      {games[hoveredTrendIndex].black}
                    </p>
                    <p className="text-slate-400">
                      White: {games[hoveredTrendIndex].report?.accuracy?.white?.toFixed(1)}% · Black:{' '}
                      {games[hoveredTrendIndex].report?.accuracy?.black?.toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Split Row: Tactical Motifs & Time Pressure Correlation */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tactical Motifs / Blindspots */}
              <div className="p-6 rounded-3xl glass-card border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black text-white flex items-center gap-2">
                    <Target className="w-4 h-4 text-orange-400" />
                    <span>Top Tactical Blindspots</span>
                  </h2>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">
                    Motifs Tagged
                  </span>
                </div>

                {analytics.topMotifs.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    No tactical motifs detected yet.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {analytics.topMotifs.map(([motif, count]) => {
                      const maxCount = analytics.topMotifs[0][1] || 1;
                      const pct = Math.round((count / maxCount) * 100);

                      return (
                        <div key={motif} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-300 capitalize">
                              {motif.replace(/_/g, ' ')}
                            </span>
                            <span className="font-mono text-slate-400 font-bold">{count}x</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Time Pressure Correlation (%clk) */}
              <div className="p-6 rounded-3xl glass-card border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <span>Time Pressure Correlation</span>
                  </h2>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">
                    %clk Analysis
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-rose-400" />
                        Under 10s Time Trouble
                      </span>
                      <span className="font-mono font-bold text-rose-400">
                        {analytics.timePressure.fastBlunderRate}% blunder rate
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-rose-500"
                        style={{ width: `${analytics.timePressure.fastBlunderRate}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        Moderate Clock (10s – 30s)
                      </span>
                      <span className="font-mono font-bold text-amber-400">
                        {analytics.timePressure.midBlunderRate}% blunder rate
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500"
                        style={{ width: `${analytics.timePressure.midBlunderRate}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        Comfortable Clock (&gt; 30s)
                      </span>
                      <span className="font-mono font-bold text-emerald-400">
                        {analytics.timePressure.slowBlunderRate}% blunder rate
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${analytics.timePressure.slowBlunderRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Opening (ECO) Performance Table */}
            <div className="p-6 rounded-3xl glass-card border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black text-white flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-400" />
                    <span>Opening Repertoire Accuracy</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Your average accuracy and win rate grouped by ECO opening code
                  </p>
                </div>
              </div>

              {analytics.topOpenings.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No opening stats available.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {analytics.topOpenings.map((op) => {
                    const avgAcc = Math.round(op.totalAcc / op.count);
                    const winPct = Math.round((op.wins / op.count) * 100);

                    return (
                      <div
                        key={op.eco}
                        className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] font-mono font-black text-emerald-400">
                            {op.eco}
                          </span>
                          <span className="text-[10px] text-slate-400">{op.count} games</span>
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-white truncate">{op.name}</h4>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
                          <div>
                            <span className="text-slate-500 text-[10px]">Avg Accuracy</span>
                            <p className="font-mono font-bold text-emerald-300">{avgAcc}%</p>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px]">Win Rate</span>
                            <p className="font-mono font-bold text-cyan-300">{winPct}%</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
