'use client';
// components/review/EngineLines.tsx — Live engine analysis panel (Phase 2)
//
// This is a debug/analysis panel that shows the top-3 PV lines for the current
// board position. It is NOT the full review UI (that's Phase 4).
//
// Rules (AGENTS.md):
//   • Components NEVER call the engine directly — they use EnginePool via getEnginePool().
//   • No `useEffect` for derived state.
//   • Respects `prefers-reduced-motion` via the `motion` components.

import { useState, useEffect, useRef, useCallback } from 'react';
import type { SearchInfo, EngineCapabilities } from '@/lib/types';
import { fetchTablebaseVerdict, type TablebaseVerdict, countPieces } from '@/lib/engine/tablebase';

interface EngineLineProps {
  /** Current board FEN to analyze. */
  fen: string;
  /** Depth for on-demand analysis (default 16). */
  depth?: number;
}

interface LineState {
  multipv: number;
  depth: number;
  cp: number | null;
  mate: number | null;
  pv: string[];
  nps?: number;
}

/** Format a centipawn or mate score from White's perspective for display. */
function formatScore(cp: number | null, mate: number | null): string {
  if (mate !== null) {
    return mate > 0 ? `+M${mate}` : `-M${Math.abs(mate)}`;
  }
  if (cp !== null) {
    const pawns = cp / 100;
    if (Math.abs(pawns) < 0.005) return '0.00';
    return (pawns > 0 ? '+' : '') + pawns.toFixed(2);
  }
  return '–';
}

/** Format NPS as a human-readable string. */
function formatNps(nps: number | undefined): string {
  if (!nps) return '';
  if (nps >= 1_000_000) return `${(nps / 1_000_000).toFixed(1)}M nps`;
  if (nps >= 1_000) return `${(nps / 1_000).toFixed(0)}k nps`;
  return `${nps} nps`;
}

export function EngineLines({ fen, depth = 16 }: EngineLineProps) {
  const [lines, setLines] = useState<LineState[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentDepth, setCurrentDepth] = useState(0);
  const [caps, setCaps] = useState<EngineCapabilities | null>(null);
  const [tablebase, setTablebase] = useState<TablebaseVerdict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Check tablebase when piece count <= 7
  useEffect(() => {
    let active = true;
    if (countPieces(fen) <= 7) {
      fetchTablebaseVerdict(fen).then((v) => {
        if (active) setTablebase(v);
      });
    } else {
      setTablebase(null);
    }
    return () => {
      active = false;
    };
  }, [fen]);

  // Load capabilities once
  useEffect(() => {
    let cancelled = false;
    import('@/lib/engine/enginePool')
      .then(({ getEnginePool }) => {
        const pool = getEnginePool();
        return pool.ready().then(() => {
          if (!cancelled) {
            setCaps(pool.capabilities);
          }
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Engine failed to load');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const analyze = useCallback(async () => {
    // Cancel any previous analysis
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setIsAnalyzing(true);
    setCurrentDepth(0);
    setLines([]);
    setError(null);

    try {
      const { getEnginePool } = await import('@/lib/engine/enginePool');
      const pool = getEnginePool();

      await pool.analyze(fen, {
        depth,
        multiPv: 3,
        signal: ac.signal,
        onInfo: (info: SearchInfo) => {
          if (ac.signal.aborted) return;
          setCurrentDepth(info.depth);
          setLines((prev) => {
            const next = [...prev];
            const idx = next.findIndex((l) => l.multipv === info.multipv);
            const entry: LineState = {
              multipv: info.multipv,
              depth: info.depth,
              cp: info.cp,
              mate: info.mate,
              pv: info.pv,
              nps: info.nps,
            };
            if (idx === -1) {
              next.push(entry);
            } else {
              next[idx] = entry;
            }
            return next.sort((a, b) => a.multipv - b.multipv);
          });
        },
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return; // User cancelled
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  }, [fen, depth]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsAnalyzing(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/60">
            Engine Lines
          </span>
          {caps && (
            <span className="mt-0.5 font-mono text-[10px] text-white/40">{caps.label}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {isAnalyzing && currentDepth > 0 && (
            <span className="font-mono text-[10px] tabular-nums text-emerald-400/80">
              depth {currentDepth}
            </span>
          )}
          {isAnalyzing ? (
            <button
              id="engine-lines-stop"
              onClick={stop}
              className="rounded-md bg-red-500/20 px-2.5 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/30"
            >
              Stop
            </button>
          ) : (
            <button
              id="engine-lines-analyze"
              onClick={analyze}
              className="rounded-md bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30"
            >
              Analyze
            </button>
          )}
        </div>
      </div>

      {/* Tablebase Verdict Banner (<=7 pieces) */}
      {tablebase && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-teal-950/40 border border-teal-500/30 text-xs font-mono">
          <span className="text-teal-300 font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            Tablebase: {tablebase.category.toUpperCase()}
          </span>
          <span className="text-teal-200/80 text-[11px]">
            {tablebase.dtm !== null
              ? `DTM ${tablebase.dtm}`
              : tablebase.dtz !== null
              ? `DTZ ${tablebase.dtz}`
              : tablebase.category}
            {tablebase.bestSan ? ` (${tablebase.bestSan})` : ''}
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-500/10 px-2 py-1.5 text-xs text-red-400">{error}</div>
      )}

      {/* Lines */}
      {lines.length === 0 && !isAnalyzing && !error && !tablebase && (
        <p className="py-2 text-center text-xs text-white/30">
          Click Analyze to evaluate this position
        </p>
      )}

      {lines.map((line) => (
        <div
          key={line.multipv}
          className="flex flex-col gap-1 rounded-lg bg-white/5 px-2.5 py-2"
        >
          <div className="flex items-center justify-between gap-2">
            {/* Score */}
            <span
              className={`font-mono text-sm font-bold tabular-nums ${
                (() => {
                  const score = formatScore(line.cp, line.mate);
                  return score.startsWith('+') || score.startsWith('+M')
                    ? 'text-emerald-400'
                    : score.startsWith('-')
                      ? 'text-red-400'
                      : 'text-white/60';
                })()
              }`}
            >
              {formatScore(line.cp, line.mate)}
            </span>

            <div className="flex items-center gap-2 text-[10px] text-white/40">
              {line.nps && <span className="font-mono">{formatNps(line.nps)}</span>}
              <span className="font-mono">d{line.depth}</span>
              <span className="text-white/20">#{line.multipv}</span>
            </div>
          </div>

          {/* PV */}
          <p className="font-mono text-[11px] leading-relaxed tracking-wide text-white/60 break-all">
            {line.pv.slice(0, 10).join(' ')}
            {line.pv.length > 10 && '…'}
          </p>
        </div>
      ))}

      {/* Loading skeleton */}
      {isAnalyzing && lines.length === 0 && (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-lg bg-white/5"
              style={{ opacity: 1 - i * 0.2 }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
