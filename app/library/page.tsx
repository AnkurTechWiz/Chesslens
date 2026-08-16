'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/storage/db';
import { exportBackup, importBackup } from '@/lib/storage/backup';
import { getStorageQuota, requestStoragePersistence, isIncognito, type StorageQuotaInfo } from '@/lib/storage/quota';
import { createCardsFromGameReport } from '@/lib/storage/trainer';
import { useGameStore } from '@/lib/store/gameStore';
import { useBatchStore } from '@/lib/store/batchStore';
import { BatchImportModal } from '@/components/library/BatchImportModal';
import { SettingsModal } from '@/components/settings/SettingsModal';
import type { SavedGame } from '@/lib/types';
import {
  BookOpen,
  Search,
  Download,
  Upload,
  HardDrive,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Play,
  Copy,
  Check,
  Plus,
  ArrowUpDown,
  Sparkles,
  ShieldCheck,
  CheckSquare,
  Square as SquareIcon,
  Settings,
} from 'lucide-react';

export default function LibraryPage() {
  const router = useRouter();
  const { loadPgn } = useGameStore();
  const { openModal: openImportModal } = useBatchStore();

  const [games, setGames] = useState<SavedGame[]>([]);
  const [quota, setQuota] = useState<StorageQuotaInfo | null>(null);
  const [isPrivateMode, setIsPrivateMode] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [resultFilter, setResultFilter] = useState<'all' | 'win' | 'loss' | 'draw'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'paste' | 'file' | 'chesscom' | 'lichess'>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'white_acc' | 'black_acc' | 'moves'>('date_desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [trainerNotice, setTrainerNotice] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Load saved games and quota on mount
  const refreshLibrary = useCallback(async () => {
    try {
      const allGames = await db.games.orderBy('playedAt').reverse().toArray();
      setGames(allGames);
      const q = await getStorageQuota();
      setQuota(q);
      const priv = await isIncognito();
      setIsPrivateMode(priv);
    } catch {
      // Fallback
    }
  }, []);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  const handleRequestPersistence = async () => {
    const ok = await requestStoragePersistence();
    if (ok) {
      refreshLibrary();
    }
  };

  const handleImportBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        const res = await importBackup(content);
        if (res.success) {
          alert(`Backup restored successfully! (${res.gamesImported} games, ${res.cardsImported} cards)`);
          refreshLibrary();
        } else {
          alert(`Failed to restore backup: ${res.error}`);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleDeleteGame = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (confirm('Delete this game from your local library?')) {
      await db.games.delete(id);
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      refreshLibrary();
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (confirm(`Delete ${selectedIds.length} selected games from your library?`)) {
      await db.games.bulkDelete(selectedIds);
      setSelectedIds([]);
      refreshLibrary();
    }
  };

  const handleSendAllBlundersToTrainer = async () => {
    const targetGames =
      selectedIds.length > 0
        ? games.filter((g) => selectedIds.includes(g.id))
        : games;

    let totalCardsCreated = 0;
    for (const g of targetGames) {
      if (g.report) {
        const count = await createCardsFromGameReport(g.id, g.report);
        totalCardsCreated += count;
      }
    }

    setTrainerNotice(`Added ${totalCardsCreated} new blunder cards to your Trainer deck!`);
    setTimeout(() => setTrainerNotice(null), 4000);
  };

  const handleOpenReview = (game: SavedGame) => {
    loadPgn(game.pgn);
    router.push('/review');
  };

  const handleCopyPgn = (game: SavedGame, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(game.pgn);
    setCopiedId(game.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleSelectGame = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // Filter and sort games
  const filteredGames = useMemo(() => {
    return games
      .filter((g) => {
        // Text search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchWhite = g.white?.toLowerCase().includes(q);
          const matchBlack = g.black?.toLowerCase().includes(q);
          const matchEco = g.eco?.toLowerCase().includes(q);
          const matchOpening = g.opening?.toLowerCase().includes(q);
          if (!matchWhite && !matchBlack && !matchEco && !matchOpening) {
            return false;
          }
        }

        // Result filter
        if (resultFilter === 'win' && g.result !== '1-0' && g.result !== '0-1') return false;
        if (resultFilter === 'loss' && g.result !== '0-1' && g.result !== '1-0') return false;
        if (resultFilter === 'draw' && g.result !== '1/2-1/2') return false;

        // Source filter
        if (sourceFilter !== 'all' && g.source !== sourceFilter) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date_desc') return (b.playedAt || b.createdAt) - (a.playedAt || a.createdAt);
        if (sortBy === 'date_asc') return (a.playedAt || a.createdAt) - (b.playedAt || b.createdAt);
        if (sortBy === 'white_acc') return (b.report?.accuracy?.white || 0) - (a.report?.accuracy?.white || 0);
        if (sortBy === 'black_acc') return (b.report?.accuracy?.black || 0) - (a.report?.accuracy?.black || 0);
        if (sortBy === 'moves') return (b.report?.moves?.length || 0) - (a.report?.moves?.length || 0);
        return 0;
      });
  }, [games, searchQuery, resultFilter, sourceFilter, sortBy]);

  const allFilteredSelected =
    filteredGames.length > 0 && selectedIds.length === filteredGames.length;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Header */}
      <header className="sticky top-0 z-40 glass-panel border-b border-slate-800/80 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-900/30">
                <span className="text-xl font-black text-slate-950">♞</span>
              </div>
              <div>
                <span className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                  Chess<span className="text-emerald-400">Lens</span>
                </span>
                <p className="text-xs text-slate-400">Local Game Library</p>
              </div>
            </Link>
          </div>

          <nav className="flex items-center gap-2 text-sm text-slate-300">
            <Link
              href="/review"
              className="px-3 py-1.5 rounded-lg hover:bg-slate-800/60 hover:text-white transition-colors"
            >
              Review
            </Link>
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-lg hover:bg-slate-800/60 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/trainer"
              className="px-3 py-1.5 rounded-lg hover:bg-slate-800/60 hover:text-white transition-colors"
            >
              Trainer
            </Link>
            <button
              onClick={() => setShowSettings(true)}
              className="px-2.5 py-1.5 rounded-lg hover:bg-slate-800/60 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold text-slate-400 cursor-pointer"
              aria-label="Open settings dialog"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Incognito Warning Alert */}
        {isPrivateMode && (
          <div className="p-4 rounded-2xl bg-amber-950/60 border border-amber-800/80 text-amber-200 flex items-start justify-between gap-3 shadow-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-300">Private Browsing Notice</h4>
                <p className="text-xs text-amber-200/90 mt-0.5">
                  Your browser is currently running in private/incognito mode. IndexedDB storage may be cleared when you close this window. Use &quot;Export Backup&quot; to save your games to a file.
                </p>
              </div>
            </div>
            <button
              onClick={() => exportBackup()}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shrink-0 transition-colors"
            >
              Export Now
            </button>
          </div>
        )}

        {/* Trainer Notice Banner */}
        {trainerNotice && (
          <div className="p-4 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-lg animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>{trainerNotice}</span>
            </div>
            <Link
              href="/trainer"
              className="px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400"
            >
              Go to Trainer
            </Link>
          </div>
        )}

        {/* Action & Storage Bar */}
        <div className="p-5 rounded-3xl glass-card border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-400" />
                <span>Saved Games ({games.length})</span>
              </h1>
              {quota?.isPersistent && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Durable</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <HardDrive className="w-3.5 h-3.5 text-slate-500" />
              <span>
                Storage: {quota?.formattedUsage || '0 MB'} used of {quota?.formattedQuota || 'local disk'} ({quota?.percentUsed || 0}%)
              </span>
              {!quota?.isPersistent && (
                <button
                  onClick={handleRequestPersistence}
                  className="text-emerald-400 hover:underline font-semibold ml-1 cursor-pointer"
                >
                  Enable Persistence
                </button>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <button
              onClick={() => openImportModal('chesscom')}
              className="py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold shadow-lg shadow-emerald-950/40 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Import Games</span>
            </button>

            <button
              onClick={() => exportBackup()}
              disabled={games.length === 0}
              className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Export all games, cards, and settings to JSON file"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Export JSON</span>
            </button>

            <label className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-slate-400" />
              <span>Import JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackupFile}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Search, Filter, and Sort Toolbar */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search players, ECO, opening..."
                className="w-full pl-10 pr-4 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            {/* Result Filter */}
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value as 'all' | 'win' | 'loss' | 'draw')}
              className="px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="all">All Results</option>
              <option value="win">Decisive Games (1-0 / 0-1)</option>
              <option value="draw">Drawn Games (1/2-1/2)</option>
            </select>

            {/* Source Filter */}
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as 'all' | 'paste' | 'file' | 'chesscom' | 'lichess')}
              className="px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="all">All Sources</option>
              <option value="chesscom">Chess.com</option>
              <option value="lichess">Lichess</option>
              <option value="paste">Pasted PGN</option>
              <option value="file">Uploaded File</option>
            </select>

            {/* Sort Options */}
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-slate-500 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date_desc' | 'date_asc' | 'white_acc' | 'black_acc' | 'moves')}
                className="w-full px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="date_desc">Newest First</option>
                <option value="date_asc">Oldest First</option>
                <option value="white_acc">White Accuracy (High)</option>
                <option value="black_acc">Black Accuracy (High)</option>
                <option value="moves">Most Moves</option>
              </select>
            </div>
          </div>

          {/* Bulk Selection Actions Bar */}
          {filteredGames.length > 0 && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs">
              <button
                onClick={() =>
                  allFilteredSelected
                    ? setSelectedIds([])
                    : setSelectedIds(filteredGames.map((g) => g.id))
                }
                className="flex items-center gap-2 text-slate-300 hover:text-white font-semibold cursor-pointer"
              >
                {allFilteredSelected ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                ) : (
                  <SquareIcon className="w-4 h-4 text-slate-500" />
                )}
                <span>
                  {selectedIds.length > 0
                    ? `${selectedIds.length} of ${filteredGames.length} selected`
                    : 'Select All'}
                </span>
              </button>

              {selectedIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSendAllBlundersToTrainer}
                    className="py-1 px-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Send Blunders to Trainer</span>
                  </button>

                  <button
                    onClick={handleDeleteSelected}
                    className="py-1 px-3 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Selected</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Games Grid / Cards */}
        {filteredGames.length === 0 ? (
          <div className="p-12 rounded-3xl glass-card border border-slate-800 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">No games in library</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Review any game on the workspace or import match archives from your Chess.com or Lichess account.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-3">
              <Link
                href="/review"
                className="py-2.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-950/40 transition-colors"
              >
                Review Sample Game
              </Link>
              <button
                onClick={() => openImportModal('chesscom')}
                className="py-2.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
              >
                Import from Chess.com
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGames.map((g) => {
              const isSelected = selectedIds.includes(g.id);
              const dateStr = new Date(g.playedAt || g.createdAt).toLocaleDateString();
              const whiteAcc = g.report?.accuracy?.white?.toFixed(1) || '--';
              const blackAcc = g.report?.accuracy?.black?.toFixed(1) || '--';
              const movesCount = g.report?.moves?.length || 0;

              return (
                <div
                  key={g.id}
                  onClick={() => handleOpenReview(g)}
                  className={`p-5 rounded-2xl glass-card border transition-all cursor-pointer space-y-4 relative group ${
                    isSelected
                      ? 'border-emerald-500/60 bg-emerald-950/20 shadow-lg shadow-emerald-950/30'
                      : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  {/* Card Header: Players + Result */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <button
                        onClick={(e) => toggleSelectGame(g.id, e)}
                        className="mt-0.5 p-0.5 rounded text-slate-500 hover:text-white transition-colors"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <SquareIcon className="w-4 h-4 text-slate-600" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-white truncate">
                          {g.white} {g.whiteElo && `(${g.whiteElo})`}
                        </h3>
                        <h3 className="text-xs font-bold text-slate-400 truncate mt-0.5">
                          vs {g.black} {g.blackElo && `(${g.blackElo})`}
                        </h3>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-mono font-bold text-emerald-400 shrink-0">
                      {g.result}
                    </span>
                  </div>

                  {/* Accuracies & Meta */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">White Acc</span>
                      <p className="text-xs font-black font-mono text-emerald-300">{whiteAcc}%</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Black Acc</span>
                      <p className="text-xs font-black font-mono text-cyan-300">{blackAcc}%</p>
                    </div>
                  </div>

                  {/* Opening & Date */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-mono text-emerald-400 font-bold truncate max-w-[180px]">
                      {g.eco ? `${g.eco} · ${g.opening || 'Opening'}` : 'Custom Game'}
                    </span>
                    <span>{movesCount} plies · {dateStr}</span>
                  </div>

                  {/* Quick Card Action Buttons */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => handleCopyPgn(g, e)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        title="Copy PGN text"
                      >
                        {copiedId === g.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        onClick={(e) => handleDeleteGame(g.id, e)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/60 hover:text-rose-400 text-slate-400 transition-colors"
                        title="Delete game from library"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => handleOpenReview(g)}
                      className="py-1 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold flex items-center gap-1 shadow-md transition-colors"
                    >
                      <Play className="w-3 h-3 fill-slate-950" />
                      <span>Review</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Batch Import Modal */}
      <BatchImportModal />

      {/* Settings Modal */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
