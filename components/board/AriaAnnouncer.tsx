'use client';

import React, { useEffect, useState } from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { useReviewStore } from '@/lib/store/reviewStore';
import { CLASSIFICATION_META } from '@/lib/constants/classification';

export const AriaAnnouncer: React.FC = () => {
  const { game, currentPly } = useGameStore();
  const { gameReport, partialReports } = useReviewStore();
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (!game) {
      setAnnouncement('');
      return;
    }

    if (currentPly === 0) {
      setAnnouncement('Starting board position. No moves played.');
      return;
    }

    const move = game.moves[currentPly - 1];
    if (!move) return;

    const moveNumber = Math.floor((currentPly - 1) / 2) + 1;
    const side = currentPly % 2 === 1 ? 'White' : 'Black';
    const reports = gameReport?.moves || partialReports;
    const report = reports[currentPly - 1];

    let message = `Move ${moveNumber}. ${side} played ${move.san}.`;
    if (report) {
      const meta = CLASSIFICATION_META[report.classification];
      if (meta) {
        message += ` ${meta.name}: ${meta.description}`;
      }
    }

    setAnnouncement(message);
  }, [currentPly, game, gameReport, partialReports]);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      id="chesslens-aria-announcer"
    >
      {announcement}
    </div>
  );
};
