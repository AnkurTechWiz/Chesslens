'use client';

import React from 'react';
import { useBatchStore } from '@/lib/store/batchStore';
import {
  X,
  Download,
  Loader2,
  CheckSquare,
  Square as SquareIcon,
  Play,
  AlertCircle,
} from 'lucide-react';

export const BatchImportModal: React.FC = () => {
  const {
    isModalOpen,
    platform,
    username,
    count,
    isLoading,
    error,
    candidates,
    selectedIds,
    isProcessing,
    processingGameIndex,
    totalGamesToProcess,
    currentPly,
    totalPlies,
    closeModal,
    setPlatform,
    setUsername,
    setCount,
    fetchGames,
    toggleSelect,
    selectAll,
    deselectAll,
    startBatchAnalysis,
    cancelBatchAnalysis,
  } = useBatchStore();

  if (!isModalOpen) return null;

  const allSelected =
    candidates.length > 0 && selectedIds.length === candidates.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Download className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-white truncate">Import Games</h2>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                Fetch games from public APIs and review locally
              </p>
            </div>
          </div>

          <button
            onClick={closeModal}
            disabled={isProcessing}
            aria-label="Close import dialog"
            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          {/* Platform Tabs */}
          {!isProcessing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-950/60 border border-slate-800">
                <button
                  onClick={() => setPlatform('chesscom')}
                  className={`py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    platform === 'chesscom'
                      ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  Chess.com
                </button>
                <button
                  onClick={() => setPlatform('lichess')}
                  className={`py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    platform === 'lichess'
                      ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  Lichess
                </button>
              </div>

              {/* Username and Count Inputs */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    {platform === 'chesscom' ? 'Chess.com' : 'Lichess'} Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={
                      platform === 'chesscom' ? 'e.g. magnuscarlsen, hikaru' : 'e.g. DrNykterstein'
                    }
                    onKeyDown={(e) => e.key === 'Enter' && fetchGames()}
                    className="w-full px-3.5 sm:px-4 py-2 sm:py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>

                <div className="w-full sm:w-28 space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Count</label>
                  <select
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                    className="w-full px-3 py-2 sm:py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value={5}>5 games</option>
                    <option value={10}>10 games</option>
                    <option value={20}>20 games</option>
                    <option value={30}>30 games</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={fetchGames}
                    disabled={isLoading || !username.trim()}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer h-[38px] sm:h-[42px]"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>Fetch</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-2.5 shadow-md">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          {/* Processing / Progress State */}
          {isProcessing && (
            <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto animate-pulse">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>

              <div>
                <h3 className="text-sm font-black text-white">
                  Reviewing Games in Background
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Game {processingGameIndex} of {totalGamesToProcess} · Move {currentPly}/{totalPlies || 0}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      totalGamesToProcess > 0
                        ? Math.round(
                            ((processingGameIndex - 1 + (totalPlies > 0 ? currentPly / totalPlies : 0)) /
                              totalGamesToProcess) *
                              100,
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>

              <div className="pt-2">
                <button
                  onClick={cancelBatchAnalysis}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
                >
                  Cancel Batch Analysis
                </button>
              </div>
            </div>
          )}

          {/* Candidates List */}
          {!isProcessing && candidates.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold text-white">
                  Found {candidates.length} games ({selectedIds.length} selected)
                </span>
                <button
                  onClick={allSelected ? deselectAll : selectAll}
                  className="text-emerald-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  {allSelected ? <SquareIcon className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
                  <span>{allSelected ? 'Deselect All' : 'Select All'}</span>
                </button>
              </div>

              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {candidates.map((g) => {
                  const isSelected = selectedIds.includes(g.id);
                  const dateStr = new Date(g.playedAt).toLocaleDateString();

                  return (
                    <div
                      key={g.id}
                      onClick={() => toggleSelect(g.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-emerald-950/30 border-emerald-500/40 shadow-sm'
                          : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                            isSelected
                              ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                              : 'border-slate-700 bg-slate-900'
                          }`}
                        >
                          {isSelected && <span className="text-[10px] font-black">✓</span>}
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">
                            {g.white} {g.whiteElo && `(${g.whiteElo})`} vs {g.black}{' '}
                            {g.blackElo && `(${g.blackElo})`}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {dateStr} {g.timeControl && `· ${g.timeControl}`}
                          </p>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-mono font-bold text-emerald-400 shrink-0">
                        {g.result}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {!isProcessing && candidates.length > 0 && (
          <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400">
              {selectedIds.length} games queued for review
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
              >
                Close
              </button>

              <button
                onClick={startBatchAnalysis}
                disabled={selectedIds.length === 0}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 text-xs font-extrabold shadow-lg shadow-emerald-950/50 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Start Review Queue ({selectedIds.length})</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
