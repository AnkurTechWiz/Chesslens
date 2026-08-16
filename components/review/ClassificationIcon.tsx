'use client';

import React from 'react';
import type { Classification } from '@/lib/types';
import { CLASSIFICATION_META } from '@/lib/constants/classification';

export interface ClassificationIconProps {
  classification: Classification;
  size?: 'sm' | 'md' | 'lg';
  showSymbol?: boolean;
  className?: string;
}

export const ClassificationIcon: React.FC<ClassificationIconProps> = ({
  classification,
  size = 'md',
  showSymbol = true,
  className = '',
}) => {
  const meta = CLASSIFICATION_META[classification] || CLASSIFICATION_META.good;

  const sizeMap = {
    sm: 'w-4 h-4 text-[9px]',
    md: 'w-6 h-6 sm:w-7 sm:h-7 text-[11px] sm:text-xs',
    lg: 'w-8 h-8 text-sm',
  };

  // Distinct geometric silhouette path per classification for colorblind differentiation
  const renderShape = () => {
    switch (classification) {
      case 'brilliant':
        // Diamond / Rhombus
        return (
          <svg viewBox="0 0 32 32" className="w-full h-full drop-shadow-md">
            <polygon points="16,2 30,16 16,30 2,16" fill={meta.color} stroke="#070b13" strokeWidth="2" />
          </svg>
        );
      case 'great':
        // Hexagonal Shield
        return (
          <svg viewBox="0 0 32 32" className="w-full h-full drop-shadow-md">
            <polygon
              points="16,2 29,8 29,22 16,30 3,22 3,8"
              fill={meta.color}
              stroke="#070b13"
              strokeWidth="2"
            />
          </svg>
        );
      case 'best':
        // 5-Point Star
        return (
          <svg viewBox="0 0 32 32" className="w-full h-full drop-shadow-md">
            <polygon
              points="16,2 19.8,11.5 29.8,12.2 22.2,18.7 24.5,28.5 16,23.2 7.5,28.5 9.8,18.7 2.2,12.2 12.2,11.5"
              fill={meta.color}
              stroke="#070b13"
              strokeWidth="2"
            />
          </svg>
        );
      case 'excellent':
        // Double-Circle / Target
        return (
          <svg viewBox="0 0 32 32" className="w-full h-full drop-shadow-md">
            <circle cx="16" cy="16" r="14" fill={meta.color} stroke="#070b13" strokeWidth="2" />
            <circle cx="16" cy="16" r="10" fill="none" stroke="#070b13" strokeWidth="1.5" strokeDasharray="3 2" />
          </svg>
        );
      case 'good':
        // Smooth Rounded Square
        return (
          <svg viewBox="0 0 32 32" className="w-full h-full drop-shadow-md">
            <rect x="3" y="3" width="26" height="26" rx="8" fill={meta.color} stroke="#070b13" strokeWidth="2" />
          </svg>
        );
      case 'book':
        // Book Outline Polygon
        return (
          <svg viewBox="0 0 32 32" className="w-full h-full drop-shadow-md">
            <path
              d="M4,7 C10,5 16,7 16,7 C16,7 22,5 28,7 L28,26 C22,24 16,26 16,26 C16,26 10,24 4,26 Z"
              fill={meta.color}
              stroke="#070b13"
              strokeWidth="2"
            />
          </svg>
        );
      case 'inaccuracy':
        // Upward Triangle (Caution)
        return (
          <svg viewBox="0 0 32 32" className="w-full h-full drop-shadow-md">
            <polygon points="16,3 30,28 2,28" fill={meta.color} stroke="#070b13" strokeWidth="2" />
          </svg>
        );
      case 'mistake':
        // Downward Triangle / Inverted Trapezoid
        return (
          <svg viewBox="0 0 32 32" className="w-full h-full drop-shadow-md">
            <polygon points="2,4 30,4 16,29" fill={meta.color} stroke="#070b13" strokeWidth="2" />
          </svg>
        );
      case 'miss':
        // Octagon (Stop)
        return (
          <svg viewBox="0 0 32 32" className="w-full h-full drop-shadow-md">
            <polygon
              points="10,2 22,2 30,10 30,22 22,30 10,30 2,22 2,10"
              fill={meta.color}
              stroke="#070b13"
              strokeWidth="2"
            />
          </svg>
        );
      case 'blunder':
        // 8-Spike Cross Shield / Danger Star
        return (
          <svg viewBox="0 0 32 32" className="w-full h-full drop-shadow-md">
            <polygon
              points="16,2 20,8 27,5 25,12 31,16 25,20 27,27 20,24 16,30 12,24 5,27 7,20 1,16 7,12 5,5 12,8"
              fill={meta.color}
              stroke="#070b13"
              strokeWidth="2"
            />
          </svg>
        );
      case 'forced':
      default:
        // Horizontal Oval Pill
        return (
          <svg viewBox="0 0 32 32" className="w-full h-full drop-shadow-md">
            <rect x="2" y="8" width="28" height="16" rx="8" fill={meta.color} stroke="#070b13" strokeWidth="2" />
          </svg>
        );
    }
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none font-black text-slate-950 ${sizeMap[size]} ${className}`}
      title={`${meta.name} (${meta.symbol}): ${meta.description}`}
      aria-label={`${meta.name}: ${meta.description}`}
    >
      {renderShape()}
      {showSymbol && (
        <span className="absolute inset-0 flex items-center justify-center font-black leading-none drop-shadow-sm pointer-events-none">
          {meta.symbol}
        </span>
      )}
    </div>
  );
};
