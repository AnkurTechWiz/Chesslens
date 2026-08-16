'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  useSettingsStore,
  type BoardTheme,
  type PieceSet,
  type CoachVerbosity,
} from '@/lib/store/settingsStore';
import { soundManager } from '@/lib/sound/soundManager';
import {
  Settings,
  X,
  Volume2,
  VolumeX,
  Trash2,
  Check,
  Palette,
  Cpu,
  AlertTriangle,
} from 'lucide-react';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    boardTheme,
    pieceSet,
    soundVolume,
    soundMuted,
    analysisDepth,
    showArrows,
    coachVerbosity,
    reducedMotion,
    setBoardTheme,
    setPieceSet,
    setSoundVolume,
    setSoundMuted,
    setAnalysisDepth,
    setShowArrows,
    setCoachVerbosity,
    setReducedMotion,
    clearEvalCache,
    loadSettings,
  } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<'board' | 'audio' | 'engine' | 'storage'>('board');
  const [clearing, setClearing] = useState(false);
  const [clearedCount, setClearedCount] = useState<number | null>(null);

  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Accessibility: focus management & Escape key
  useEffect(() => {
    if (!isOpen) return;

    closeBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleClearCache = async () => {
    setClearing(true);
    const count = await clearEvalCache();
    setClearing(false);
    setClearedCount(count);
    setTimeout(() => setClearedCount(null), 3500);
  };

  const handleTestSound = () => {
    soundManager.play('move');
  };

  const themes: Array<{ id: BoardTheme; name: string; light: string; dark: string }> = [
    { id: 'green', name: 'Classic Green', light: '#ebecd0', dark: '#739552' },
    { id: 'slate', name: 'Dark Slate', light: '#cbd5e1', dark: '#475569' },
    { id: 'wood', name: 'Lichess Wood', light: '#f0d9b5', dark: '#b58863' },
    { id: 'ocean', name: 'Ocean Blue', light: '#dee3e6', dark: '#8ca2ad' },
    { id: 'amber', name: 'Warm Amber', light: '#fae5c3', dark: '#c48a47' },
  ];

  const pieceSets: Array<{ id: PieceSet; name: string; desc: string }> = [
    { id: 'cburnett', name: 'Cburnett (Vector)', desc: 'Standard grandmaster SVG piece set' },
    { id: 'classic', name: 'Classic Wood', desc: 'Warm traditional tournament shapes' },
    { id: 'modern', name: 'Modern Minimal', desc: 'Clean geometric vector contours' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Settings className="w-4 h-4" />
            </div>
            <h2 id="settings-dialog-title" className="text-base font-bold text-white">
              ChessLens Settings
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Close settings dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 pt-3 pb-2 border-b border-slate-800/80 bg-slate-950/40 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('board')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'board'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Board &amp; Theme</span>
          </button>

          <button
            onClick={() => setActiveTab('audio')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'audio'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Sound</span>
          </button>

          <button
            onClick={() => setActiveTab('engine')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'engine'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Engine &amp; Review</span>
          </button>

          <button
            onClick={() => setActiveTab('storage')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'storage'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Cache &amp; Data</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Board & Theme Tab */}
          {activeTab === 'board' && (
            <div className="space-y-5">
              {/* Board Theme Selection */}
              <div className="space-y-2">
                <label className="block text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                  Board Palette Theme
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {themes.map((t) => {
                    const isSelected = boardTheme === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setBoardTheme(t.id)}
                        className={`p-3 rounded-2xl border flex flex-col gap-2 transition-all cursor-pointer text-left ${
                          isSelected
                            ? 'bg-emerald-500/10 border-emerald-500/60 ring-1 ring-emerald-500'
                            : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200">{t.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                        {/* Mini 2x2 board preview */}
                        <div className="grid grid-cols-2 grid-rows-2 w-10 h-10 rounded-lg overflow-hidden border border-slate-700/60 shadow-inner">
                          <div style={{ backgroundColor: t.light }} />
                          <div style={{ backgroundColor: t.dark }} />
                          <div style={{ backgroundColor: t.dark }} />
                          <div style={{ backgroundColor: t.light }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Piece Sets */}
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <label className="block text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                  Piece Set Style
                </label>
                <div className="space-y-2">
                  {pieceSets.map((p) => {
                    const isSelected = pieceSet === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setPieceSet(p.id)}
                        className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer text-left ${
                          isSelected
                            ? 'bg-emerald-500/10 border-emerald-500/60 ring-1 ring-emerald-500'
                            : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/60'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-slate-200">{p.name}</div>
                          <div className="text-slate-400 text-[11px]">{p.desc}</div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reduced Motion */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-200">Reduced Motion</div>
                  <div className="text-slate-400 text-[11px]">
                    Disable spring physics and animations for faster render
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={reducedMotion}
                  onChange={(e) => setReducedMotion(e.target.checked)}
                  aria-label="Toggle reduced motion"
                  className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Audio Tab */}
          {activeTab === 'audio' && (
            <div className="space-y-5">
              {/* Mute Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-3">
                  {soundMuted ? (
                    <VolumeX className="w-5 h-5 text-amber-400" />
                  ) : (
                    <Volume2 className="w-5 h-5 text-emerald-400" />
                  )}
                  <div>
                    <div className="font-bold text-slate-200">Sound Effects</div>
                    <div className="text-slate-400 text-[11px]">
                      Web Audio synthesized piece clacks and review chimes
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={!soundMuted}
                  onChange={(e) => setSoundMuted(!e.target.checked)}
                  aria-label="Toggle sound effects"
                  className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              {/* Volume Slider */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">Master Volume</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {Math.round(soundVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={soundVolume}
                  disabled={soundMuted}
                  onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                  aria-label="Master volume level"
                  className="w-full accent-emerald-500 cursor-pointer disabled:opacity-40"
                />
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleTestSound}
                    disabled={soundMuted || soundVolume === 0}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Test Clack</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Engine & Review Tab */}
          {activeTab === 'engine' && (
            <div className="space-y-5">
              {/* Analysis Depth */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200">Default Scan Depth</span>
                    <p className="text-slate-400 text-[11px]">
                      Pass A search depth for move classification (10–22)
                    </p>
                  </div>
                  <span className="font-mono text-emerald-400 font-black text-sm px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
                    Depth {analysisDepth}
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="22"
                  step="2"
                  value={analysisDepth}
                  onChange={(e) => setAnalysisDepth(parseInt(e.target.value, 10))}
                  aria-label="Analysis scan depth"
                  className="w-full accent-emerald-500 cursor-pointer mt-2"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono pt-1">
                  <span>Fast (Depth 10)</span>
                  <span>Recommended (Depth 12)</span>
                  <span>Deep (Depth 20)</span>
                </div>
              </div>

              {/* Show Arrows */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div>
                  <div className="font-bold text-slate-200">Review Tactical Arrows</div>
                  <div className="text-slate-400 text-[11px]">
                    Draw green best-move and red blunder arrows on board
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={showArrows}
                  onChange={(e) => setShowArrows(e.target.checked)}
                  aria-label="Toggle tactical arrows"
                  className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              {/* Coach Verbosity */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                <label className="block font-bold text-slate-200">Coach Commentary Detail</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['concise', 'detailed', 'bullet'] as CoachVerbosity[]).map((mode) => {
                    const isSelected = coachVerbosity === mode;
                    return (
                      <button
                        key={mode}
                        onClick={() => setCoachVerbosity(mode)}
                        className={`py-2 px-2.5 rounded-xl border text-center font-semibold capitalize transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {mode}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Cache & Storage Tab */}
          {activeTab === 'storage' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-slate-200 font-bold">
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <span>Clear Local Analysis Eval Cache</span>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">
                  ChessLens stores engine evaluations locally in IndexedDB (Dexie) so past games
                  load instantly. If you suspect cached evaluations are stale or you want to free up
                  space, wipe the eval table here.
                </p>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={handleClearCache}
                    disabled={clearing}
                    className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-950/50 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{clearing ? 'Clearing...' : 'Clear Analysis Cache'}</span>
                  </button>

                  {clearedCount !== null && (
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 animate-in fade-in">
                      <Check className="w-3.5 h-3.5" />
                      Wiped {clearedCount} cached position evals!
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 flex items-start gap-2.5 text-amber-200/90 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p>
                  Saved games in your Library and Blunder Trainer cards are <strong>not</strong>{' '}
                  deleted by clearing the eval cache.
                </p>
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
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
