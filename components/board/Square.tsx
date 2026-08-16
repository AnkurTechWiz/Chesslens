'use client';

import React from 'react';
import { LegalMoveDot } from './LegalMoveDot';
import { useSettingsStore, type BoardTheme } from '@/lib/store/settingsStore';

export interface SquareProps {
  square: string;
  isLight: boolean;
  isLastMoveSource?: boolean;
  isLastMoveDest?: boolean;
  isSelected?: boolean;
  isLegalTarget?: boolean;
  isCaptureTarget?: boolean;
  isInCheck?: boolean;
  showRankCoord?: string;
  showFileCoord?: string;
  children?: React.ReactNode;
  onClick?: (square: string) => void;
}

const THEME_COLORS: Record<
  BoardTheme,
  { lightBg: string; darkBg: string; lightCoord: string; darkCoord: string }
> = {
  green: {
    lightBg: 'bg-[#ebecd0]',
    darkBg: 'bg-[#739552]',
    lightCoord: 'text-[#739552]',
    darkCoord: 'text-[#ebecd0]',
  },
  slate: {
    lightBg: 'bg-[#cbd5e1]',
    darkBg: 'bg-[#475569]',
    lightCoord: 'text-[#475569]',
    darkCoord: 'text-[#cbd5e1]',
  },
  wood: {
    lightBg: 'bg-[#f0d9b5]',
    darkBg: 'bg-[#b58863]',
    lightCoord: 'text-[#b58863]',
    darkCoord: 'text-[#f0d9b5]',
  },
  ocean: {
    lightBg: 'bg-[#dee3e6]',
    darkBg: 'bg-[#8ca2ad]',
    lightCoord: 'text-[#8ca2ad]',
    darkCoord: 'text-[#dee3e6]',
  },
  amber: {
    lightBg: 'bg-[#fae5c3]',
    darkBg: 'bg-[#c48a47]',
    lightCoord: 'text-[#c48a47]',
    darkCoord: 'text-[#fae5c3]',
  },
};

export const Square: React.FC<SquareProps> = ({
  square,
  isLight,
  isLastMoveSource = false,
  isLastMoveDest = false,
  isSelected = false,
  isLegalTarget = false,
  isCaptureTarget = false,
  isInCheck = false,
  showRankCoord,
  showFileCoord,
  children,
  onClick,
}) => {
  const { boardTheme } = useSettingsStore();
  const theme = THEME_COLORS[boardTheme] || THEME_COLORS.green;
  const baseBg = isLight ? theme.lightBg : theme.darkBg;

  return (
    <div
      data-square={square}
      className={`relative w-full h-full aspect-square flex items-center justify-center select-none overflow-hidden transition-colors duration-150 ${baseBg}`}
      onClick={() => {
        if (onClick) onClick(square);
      }}
    >
      {/* Last move highlight */}
      {(isLastMoveSource || isLastMoveDest) && (
        <div className="absolute inset-0 bg-amber-400/40 z-[1] pointer-events-none" />
      )}

      {/* Selected square highlight */}
      {isSelected && (
        <div className="absolute inset-0 bg-emerald-400/50 z-[2] pointer-events-none ring-2 ring-emerald-400 inset-ring" />
      )}

      {/* Check alert radial highlight */}
      {isInCheck && (
        <div className="absolute inset-0 z-[3] pointer-events-none bg-[radial-gradient(circle_at_center,_rgba(239,68,68,0.85)_0%,_rgba(239,68,68,0.4)_50%,_transparent_75%)] animate-pulse" />
      )}

      {/* Legal move indicators */}
      {isLegalTarget && <LegalMoveDot isCapture={isCaptureTarget} />}

      {/* Coordinate labels */}
      {showRankCoord && (
        <span
          className={`absolute top-0.5 left-1 text-[11px] font-bold pointer-events-none z-20 ${
            isLight ? theme.lightCoord : theme.darkCoord
          }`}
        >
          {showRankCoord}
        </span>
      )}
      {showFileCoord && (
        <span
          className={`absolute bottom-0.5 right-1 text-[11px] font-bold pointer-events-none z-20 ${
            isLight ? theme.lightCoord : theme.darkCoord
          }`}
        >
          {showFileCoord}
        </span>
      )}

      {/* Piece content */}
      {children}
    </div>
  );
};
