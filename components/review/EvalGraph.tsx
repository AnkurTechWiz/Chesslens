'use client';

import React, { useState, useRef, useMemo } from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { useReviewStore } from '@/lib/store/reviewStore';
import { winPercent } from '@/lib/analysis/winProb';
import { CLASSIFICATION_COLORS, CLASSIFICATION_META } from '@/lib/constants/classification';

export interface EvalGraphProps {
  height?: number;
  className?: string;
}

export const EvalGraph: React.FC<EvalGraphProps> = ({
  height = 96,
  className = '',
}) => {
  const { game, currentPly, jumpToPly } = useGameStore();
  const { gameReport, partialReports } = useReviewStore();
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [hoverPly, setHoverPly] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const reports = gameReport?.moves || partialReports;
  const totalPlies = game?.moves.length || reports.length || 1;

  // Compute graph coordinates for each ply [0..totalPlies]
  const points = useMemo(() => {
    const width = 1000;
    const padding = 10;
    const usableWidth = width - padding * 2;
    const usableHeight = height - padding * 2;
    const midY = height / 2;

    const res: Array<{
      ply: number;
      x: number;
      y: number;
      winProb: number;
      classification?: string;
      san?: string;
      evalStr: string;
    }> = [];

    // Starting position at ply 0
    res.push({
      ply: 0,
      x: padding,
      y: midY,
      winProb: 50,
      evalStr: '0.0',
    });

    for (let i = 1; i <= totalPlies; i++) {
      const rep = reports[i - 1];
      let winProb = 50;
      let evalStr = '0.0';

      if (rep) {
        if (rep.mateAfter !== null && rep.mateAfter !== undefined) {
          winProb = rep.mateAfter > 0 ? 100 : 0;
          evalStr = rep.mateAfter > 0 ? `M${rep.mateAfter}` : `-M${Math.abs(rep.mateAfter)}`;
        } else if (rep.cpAfter !== null && rep.cpAfter !== undefined) {
          winProb = winPercent(rep.cpAfter);
          const cp = rep.cpAfter / 100;
          evalStr = Math.abs(cp) < 0.05 ? '0.0' : cp > 0 ? `+${cp.toFixed(1)}` : cp.toFixed(1);
        }
      }

      // Map winProb (0..100) to Y (0 is Top = 100% White win, height is Bottom = 0% White win)
      const x = padding + (i / totalPlies) * usableWidth;
      const y = padding + ((100 - winProb) / 100) * usableHeight;

      res.push({
        ply: i,
        x,
        y,
        winProb,
        classification: rep?.classification,
        san: rep?.san,
        evalStr,
      });
    }

    return res;
  }, [reports, totalPlies, height]);

  // Construct SVG Area and Line Paths
  const { linePath, areaWhitePath, areaBlackPath } = useMemo(() => {
    if (points.length === 0) return { linePath: '', areaWhitePath: '', areaBlackPath: '' };

    const midY = height / 2;
    const width = 1000;
    const padding = 10;
    const usableWidth = width - padding * 2;
    const lastX = padding + usableWidth;

    let line = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      line += ` L ${points[i].x} ${points[i].y}`;
    }

    // White Area (above center line y <= midY)
    let whiteArea = `M ${points[0].x} ${midY}`;
    for (let i = 0; i < points.length; i++) {
      const ptY = Math.min(midY, points[i].y);
      whiteArea += ` L ${points[i].x} ${ptY}`;
    }
    whiteArea += ` L ${lastX} ${midY} Z`;

    // Black Area (below center line y >= midY)
    let blackArea = `M ${points[0].x} ${midY}`;
    for (let i = 0; i < points.length; i++) {
      const ptY = Math.max(midY, points[i].y);
      blackArea += ` L ${points[i].x} ${ptY}`;
    }
    blackArea += ` L ${lastX} ${midY} Z`;

    return { linePath: line, areaWhitePath: whiteArea, areaBlackPath: blackArea };
  }, [points, height]);

  // Active point
  const activePoint = points.find((p) => p.ply === currentPly) || points[0];
  const hoveredPoint = hoverPly !== null ? points.find((p) => p.ply === hoverPly) : null;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetPly = Math.round(relX * totalPlies);
    setHoverPly(targetPly);
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseLeave = () => {
    setHoverPly(null);
    setTooltipPos(null);
  };

  const handleClick = () => {
    if (hoverPly !== null) {
      jumpToPly(hoverPly);
    }
  };

  const handleTouch = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!svgRef.current || !e.touches[0]) return;
    const touch = e.touches[0];
    const rect = svgRef.current.getBoundingClientRect();
    const relX = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    const targetPly = Math.round(relX * totalPlies);
    setHoverPly(targetPly);
    setTooltipPos({ x: touch.clientX - rect.left, y: touch.clientY - rect.top });
    jumpToPly(targetPly);
  };

  return (
    <div className={`relative w-full rounded-2xl bg-slate-950/80 border border-slate-800 p-2.5 sm:p-3 select-none ${className}`}>
      {/* Title & Stats */}
      <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-semibold text-slate-400 mb-1.5 px-1">
        <span>Advantage Chart</span>
        <span className="font-mono text-emerald-400">
          Move {Math.ceil(currentPly / 2) || 1} · {activePoint?.evalStr || '0.0'}
        </span>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-hidden rounded-xl bg-slate-900/60 border border-slate-800/80 touch-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 1000 ${height}`}
          className="w-full h-full cursor-crosshair block"
          style={{ height: `${height}px` }}
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          onTouchStart={handleTouch}
          onTouchMove={handleTouch}
          onTouchEnd={handleMouseLeave}
        >
          <defs>
            {/* White advantage gradient */}
            <linearGradient id="whiteAdvGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
            </linearGradient>
            {/* Black advantage gradient */}
            <linearGradient id="blackAdvGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f172a" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#020617" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {/* Center line (Even evaluation) */}
          <line
            x1="0"
            y1={height / 2}
            x2="1000"
            y2={height / 2}
            stroke="#334155"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* White Advantage Area */}
          <path d={areaWhitePath} fill="url(#whiteAdvGrad)" />

          {/* Black Advantage Area */}
          <path d={areaBlackPath} fill="url(#blackAdvGrad)" />

          {/* Main Continuous Eval Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Classification Dots for Analyzed Moves */}
          {points.map((pt) => {
            if (pt.ply === 0 || !pt.classification) return null;
            const meta = CLASSIFICATION_META[pt.classification as keyof typeof CLASSIFICATION_META];
            const color = meta ? meta.color : CLASSIFICATION_COLORS.good;
            const isImportant =
              pt.classification === 'brilliant' ||
              pt.classification === 'great' ||
              pt.classification === 'blunder' ||
              pt.classification === 'miss';

            return (
              <circle
                key={pt.ply}
                cx={pt.x}
                cy={pt.y}
                r={isImportant ? 4.5 : 2.5}
                fill={color}
                stroke="#0f172a"
                strokeWidth={isImportant ? 1.5 : 1}
                className="transition-transform"
              />
            );
          })}

          {/* Active Ply Vertical Marker */}
          {activePoint && (
            <g>
              <line
                x1={activePoint.x}
                y1="0"
                x2={activePoint.x}
                y2={height}
                stroke="#10b981"
                strokeWidth="2"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="6"
                fill="#10b981"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>
          )}

          {/* Hover Cursor Vertical Line */}
          {hoveredPoint && hoveredPoint.ply !== currentPly && (
            <g>
              <line
                x1={hoveredPoint.x}
                y1="0"
                x2={hoveredPoint.x}
                y2={height}
                stroke="#38bdf8"
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="4"
                fill="#38bdf8"
              />
            </g>
          )}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && tooltipPos && (
          <div
            className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2 px-2.5 py-1.5 rounded-lg bg-slate-900/95 border border-slate-700 shadow-xl backdrop-blur-md text-xs font-mono text-white flex items-center gap-2 whitespace-nowrap"
            style={{
              left: `${(hoveredPoint.ply / totalPlies) * 100}%`,
              top: '40%',
            }}
          >
            <span className="font-bold text-slate-300">
              {hoveredPoint.ply > 0
                ? `${Math.floor((hoveredPoint.ply - 1) / 2) + 1}${
                    hoveredPoint.ply % 2 === 1 ? '.' : '...'
                  } ${hoveredPoint.san || ''}`
                : 'Start'}
            </span>

            {hoveredPoint.classification && (
              <span
                className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase text-slate-950"
                style={{
                  backgroundColor:
                    CLASSIFICATION_COLORS[
                      hoveredPoint.classification as keyof typeof CLASSIFICATION_COLORS
                    ] || '#94a3b8',
                }}
              >
                {hoveredPoint.classification}
              </span>
            )}

            <span className="font-bold text-emerald-400">{hoveredPoint.evalStr}</span>
          </div>
        )}
      </div>
    </div>
  );
};
