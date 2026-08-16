'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PieceSvg, type PieceCode } from './PieceSvg';
import { useSettingsStore } from '@/lib/store/settingsStore';

export interface PieceProps {
  piece: PieceCode;
  square: string;
  isDraggable?: boolean;
  onDragStart?: (square: string) => void;
  onDragEnd?: (square: string, event: MouseEvent | TouchEvent | PointerEvent, info: { point: { x: number; y: number } }) => void;
  onClick?: (square: string) => void;
}

export const Piece: React.FC<PieceProps> = ({
  piece,
  square,
  isDraggable = true,
  onDragStart,
  onDragEnd,
  onClick,
}) => {
  const prefersReduced = useReducedMotion();
  const settingsReduced = useSettingsStore((s) => s.reducedMotion);
  const shouldReduceMotion = prefersReduced || settingsReduced;

  return (
    <motion.div
      layoutId={`piece-square-${square}`}
      className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing select-none relative z-10"
      initial={shouldReduceMotion ? false : { scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={shouldReduceMotion ? undefined : { scale: 0.6, opacity: 0 }}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : {
              type: 'spring',
              stiffness: 700,
              damping: 40,
              mass: 0.8,
            }
      }
      drag={isDraggable}
      dragSnapToOrigin
      whileDrag={{ scale: 1.18, zIndex: 60 }}
      onDragStart={() => {
        if (onDragStart) onDragStart(square);
      }}
      onDragEnd={(e, info) => {
        if (onDragEnd) onDragEnd(square, e, info);
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) onClick(square);
      }}
    >
      <div className="w-[88%] h-[88%] flex items-center justify-center drop-shadow-md pointer-events-none">
        <PieceSvg piece={piece} />
      </div>
    </motion.div>
  );
};
