'use client';

import React, { useEffect, useRef } from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { useReviewStore } from '@/lib/store/reviewStore';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

import { ClassificationIcon } from './ClassificationIcon';

export const BadgeLayer: React.FC = () => {
  const { currentPly, orientation } = useGameStore();
  const { gameReport, partialReports } = useReviewStore();
  const lastFiredPlyRef = useRef<number | null>(null);

  const reports = gameReport?.moves || partialReports;
  const currentReport = currentPly > 0 ? reports[currentPly - 1] : undefined;

  // Trigger confetti on brilliant move
  useEffect(() => {
    if (
      currentReport &&
      currentReport.classification === 'brilliant' &&
      lastFiredPlyRef.current !== currentPly
    ) {
      lastFiredPlyRef.current = currentPly;

      // Small confetti blast
      try {
        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#26c2a3', '#10b981', '#38bdf8', '#fbbf24', '#f43f5e'],
          disableForReducedMotion: true,
        });
      } catch {
        // Safe fallback
      }
    }
  }, [currentReport, currentPly]);

  if (!currentReport || !currentReport.uci || currentReport.uci.length < 4) {
    return null;
  }

  const toSquare = currentReport.uci.slice(2, 4);
  const file = toSquare[0].toLowerCase();
  const rank = parseInt(toSquare[1], 10);

  if (file < 'a' || file > 'h' || rank < 1 || rank > 8) {
    return null;
  }

  let colIdx: number;
  let rowIdx: number;

  if (orientation === 'white') {
    colIdx = file.charCodeAt(0) - 'a'.charCodeAt(0);
    rowIdx = 8 - rank;
  } else {
    colIdx = 'h'.charCodeAt(0) - file.charCodeAt(0);
    rowIdx = rank - 1;
  }

  return (
    <div className="absolute inset-0 pointer-events-none w-full h-full z-20 overflow-hidden">
      <div
        className="absolute"
        style={{
          left: `${colIdx * 12.5}%`,
          top: `${rowIdx * 12.5}%`,
          width: '12.5%',
          height: '12.5%',
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentPly}-${currentReport.classification}`}
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            transition={{
              type: 'spring',
              stiffness: 700,
              damping: 30,
            }}
            className="absolute top-1 right-1 select-none"
          >
            <ClassificationIcon classification={currentReport.classification} size="md" />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
