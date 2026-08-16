import React from 'react';

export interface LegalMoveDotProps {
  isCapture?: boolean;
}

export const LegalMoveDot: React.FC<LegalMoveDotProps> = ({ isCapture = false }) => {
  if (isCapture) {
    return (
      <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center p-1">
        <div className="w-full h-full rounded-full border-4 border-emerald-500/60 transition-all duration-150 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
      <div className="w-4 h-4 rounded-full bg-emerald-500/50 ring-4 ring-emerald-500/20 transition-transform duration-150" />
    </div>
  );
};
