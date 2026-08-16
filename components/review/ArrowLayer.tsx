'use client';

import React from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { useReviewStore } from '@/lib/store/reviewStore';
import { CLASSIFICATION_COLORS } from '@/lib/constants/classification';

function squareToCoords(square: string, orientation: 'white' | 'black'): { x: number; y: number } | null {
  if (!square || square.length < 2) return null;
  const file = square[0].toLowerCase();
  const rank = parseInt(square[1], 10);

  if (file < 'a' || file > 'h' || rank < 1 || rank > 8) return null;

  let colIdx: number;
  let rowIdx: number;

  if (orientation === 'white') {
    colIdx = file.charCodeAt(0) - 'a'.charCodeAt(0);
    rowIdx = 8 - rank;
  } else {
    colIdx = 'h'.charCodeAt(0) - file.charCodeAt(0);
    rowIdx = rank - 1;
  }

  // 800x800 coordinate space (100 per square)
  return {
    x: colIdx * 100 + 50,
    y: rowIdx * 100 + 50,
  };
}

interface ArrowSpec {
  from: string;
  to: string;
  color: string;
  opacity?: number;
  isPlayed?: boolean;
}

export const ArrowLayer: React.FC = () => {
  const { currentPly, orientation } = useGameStore();
  const { gameReport, partialReports, showArrows } = useReviewStore();

  if (!showArrows || currentPly === 0) return null;

  const reports = gameReport?.moves || partialReports;
  const currentReport = reports[currentPly - 1];

  if (!currentReport) return null;

  const arrows: ArrowSpec[] = [];

  // Best Move Arrow
  if (currentReport.best && currentReport.best.uci && currentReport.best.uci.length >= 4) {
    const bestFrom = currentReport.best.uci.slice(0, 2);
    const bestTo = currentReport.best.uci.slice(2, 4);

    arrows.push({
      from: bestFrom,
      to: bestTo,
      color: CLASSIFICATION_COLORS.best, // #95bb4a
      opacity: 0.9,
      isPlayed: false,
    });
  }

  // Played Move Arrow (if not best move)
  const isPlayedDifferent =
    currentReport.best && currentReport.best.uci
      ? currentReport.uci !== currentReport.best.uci
      : false;

  if (isPlayedDifferent && currentReport.uci && currentReport.uci.length >= 4) {
    const playedFrom = currentReport.uci.slice(0, 2);
    const playedTo = currentReport.uci.slice(2, 4);
    const color =
      CLASSIFICATION_COLORS[currentReport.classification] || '#fa412d';

    arrows.push({
      from: playedFrom,
      to: playedTo,
      color,
      opacity: 0.75,
      isPlayed: true,
    });
  }

  return (
    <svg
      viewBox="0 0 800 800"
      className="absolute inset-0 pointer-events-none w-full h-full z-10 select-none"
    >
      <defs>
        {arrows.map((arrow, idx) => {
          const markerId = `arrowhead-${idx}-${arrow.color.replace('#', '')}`;
          return (
            <marker
              key={markerId}
              id={markerId}
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={arrow.color} />
            </marker>
          );
        })}
      </defs>

      {arrows.map((arrow, idx) => {
        const p1 = squareToCoords(arrow.from, orientation);
        const p2 = squareToCoords(arrow.to, orientation);

        if (!p1 || !p2) return null;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);

        if (len === 0) return null;

        const ux = dx / len;
        const uy = dy / len;

        // Offset start and end so markers sit cleanly inside squares
        const startX = p1.x + ux * 20;
        const startY = p1.y + uy * 20;
        const endX = p2.x - ux * 22;
        const endY = p2.y - uy * 22;

        const markerId = `arrowhead-${idx}-${arrow.color.replace('#', '')}`;

        return (
          <line
            key={`${arrow.from}-${arrow.to}-${idx}`}
            x1={startX}
            y1={startY}
            x2={endX}
            y2={endY}
            stroke={arrow.color}
            strokeWidth={arrow.isPlayed ? 10 : 12}
            strokeOpacity={arrow.opacity ?? 0.85}
            strokeLinecap="round"
            markerEnd={`url(#${markerId})`}
          />
        );
      })}
    </svg>
  );
};
