'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RotateCcw, Home, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/storage/db';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ChessLens Error Boundary caught error]:', error);
  }, [error]);

  const handleClearCacheAndReset = async () => {
    try {
      await db.evals.clear();
      window.location.href = '/';
    } catch {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-black text-white">Something went wrong</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            {error.message || 'An unexpected error occurred in the review interface.'}
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={() => reset()}
            className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg shadow-emerald-950/40"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Try Again</span>
          </button>

          <button
            onClick={handleClearCacheAndReset}
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>Clear Eval Cache &amp; Reset</span>
          </button>

          <Link
            href="/"
            className="w-full py-3 px-4 rounded-xl bg-transparent hover:bg-slate-800/60 text-slate-400 hover:text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
