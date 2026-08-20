'use client';

import React from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';

export const BoardControls: React.FC = () => {
  const {
    currentPly,
    game,
    isPlaying,
    autoplaySpeed,
    isMuted,
    firstMove,
    prevMove,
    togglePlay,
    nextMove,
    lastMove,
    toggleFlip,
    toggleMute,
    setAutoplaySpeed,
  } = useGameStore();

  const totalPlies = game?.moves.length || 0;
  const speeds = [
    { label: '0.5s', value: 500 },
    { label: '1.0s', value: 1000 },
    { label: '1.5s', value: 1500 },
    { label: '2.0s', value: 2000 },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 p-2.5 sm:p-3 bg-slate-900/80 rounded-2xl border border-slate-800 shadow-lg w-full">
      {/* Playback navigation buttons */}
      <div className="flex items-center justify-center gap-1 sm:gap-1.5 w-full sm:w-auto">
        <button
          onClick={firstMove}
          disabled={currentPly === 0}
          className="p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
          title="First move (Home / ↑)"
          aria-label="First move"
        >
          <ChevronFirst className="w-4 h-4" />
        </button>

        <button
          onClick={prevMove}
          disabled={currentPly === 0}
          className="p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
          title="Previous move (←)"
          aria-label="Previous move"
        >
          <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        <button
          onClick={togglePlay}
          disabled={totalPlies === 0}
          className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
            isPlaying
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
          } disabled:opacity-40 disabled:hover:bg-emerald-500`}
          title="Autoplay (Space)"
          aria-label={isPlaying ? 'Pause autoplay' : 'Start autoplay'}
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
              <span>Play</span>
            </>
          )}
        </button>

        <button
          onClick={nextMove}
          disabled={totalPlies === 0 || currentPly >= totalPlies}
          className="p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
          title="Next move (→)"
          aria-label="Next move"
        >
          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        <button
          onClick={lastMove}
          disabled={totalPlies === 0 || currentPly >= totalPlies}
          className="p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
          title="Last move (End / ↓)"
          aria-label="Last move"
        >
          <ChevronLast className="w-4 h-4" />
        </button>
      </div>

      {/* Speed & utilities buttons */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-2 w-full sm:w-auto">
        {/* Speed pills */}
        <div className="flex items-center bg-slate-950/60 p-0.5 sm:p-1 rounded-xl border border-slate-800/80">
          {speeds.map((s) => (
            <button
              key={s.value}
              onClick={() => setAutoplaySpeed(s.value)}
              className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-semibold transition-all cursor-pointer ${
                autoplaySpeed === s.value
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Flip button */}
        <button
          onClick={toggleFlip}
          className="p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-all border border-slate-800/60 cursor-pointer"
          title="Flip board (f)"
          aria-label="Flip board orientation"
        >
          <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Mute button */}
        <button
          onClick={toggleMute}
          className={`p-1.5 sm:p-2 rounded-xl transition-all border border-slate-800/60 cursor-pointer ${
            isMuted
              ? 'text-red-400 hover:text-red-300 hover:bg-red-950/40'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title={isMuted ? 'Unmute audio' : 'Mute audio'}
          aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
        </button>
      </div>
    </div>
  );
};
