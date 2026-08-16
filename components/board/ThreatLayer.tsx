'use client';

import React from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { useRetryStore } from '@/lib/store/retryStore';
import { detectThreats } from '@/lib/analysis/threatDetector';

export interface ThreatLayerProps {
  showThreats?: boolean;
}

export const ThreatLayer: React.FC<ThreatLayerProps> = ({ showThreats = false }) => {
  const { boardFen, orientation } = useGameStore();
  const { isActive: isRetryActive, currentFen: retryFen } = useRetryStore();

  if (!showThreats) return null;

  const activeFen = isRetryActive && retryFen ? retryFen : boardFen;
  const threats = detectThreats(activeFen).slice(0, 3); // top 3 threats

  if (threats.length === 0) return null;

  const squareToCoords = (square: string): { x: number; y: number } => {
    const file = square[0].toLowerCase();
    const rank = parseInt(square[1], 10);

    let col = file.charCodeAt(0) - 'a'.charCodeAt(0);
    let row = 8 - rank;

    if (orientation === 'black') {
      col = 7 - col;
      row = 7 - row;
    }

    // Grid centers in percentage (0..100)
    return {
      x: col * 12.5 + 6.25,
      y: row * 12.5 + 6.25,
    };
  };

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-15 overflow-hidden"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        <marker
          id="threat-arrowhead"
          markerWidth="4"
          markerHeight="4"
          refX="2"
          refY="2"
          orient="auto"
        >
          <polygon points="0 0, 4 2, 0 4" fill="#f97316" />
        </marker>
        <marker
          id="check-threat-arrowhead"
          markerWidth="4"
          markerHeight="4"
          refX="2"
          refY="2"
          orient="auto"
        >
          <polygon points="0 0, 4 2, 0 4" fill="#ef4444" />
        </marker>
      </defs>

      {threats.map((threat, idx) => {
        const from = squareToCoords(threat.from);
        const to = squareToCoords(threat.to);
        const isCheck = threat.isCheck;
        const color = isCheck ? '#ef4444' : '#f97316';
        const marker = isCheck ? 'url(#check-threat-arrowhead)' : 'url(#threat-arrowhead)';

        // Shorten end slightly so marker doesn't overlap piece center
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const shorten = Math.min(3.5, dist * 0.25);
        const toX = to.x - (dx / dist) * shorten;
        const toY = to.y - (dy / dist) * shorten;

        return (
          <g key={`${threat.from}-${threat.to}-${idx}`}>
            {/* Pulsing target square highlight */}
            <circle
              cx={to.x}
              cy={to.y}
              r="4.5"
              fill={color}
              fillOpacity="0.3"
              stroke={color}
              strokeWidth="0.8"
              strokeDasharray="2 1"
              className="animate-pulse"
            />

            {/* Threat vector line */}
            <line
              x1={from.x}
              y1={from.y}
              x2={toX}
              y2={toY}
              stroke={color}
              strokeWidth="1.8"
              strokeOpacity="0.85"
              strokeLinecap="round"
              markerEnd={marker}
            />
          </g>
        );
      })}
    </svg>
  );
};
