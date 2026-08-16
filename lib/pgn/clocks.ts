/**
 * Clock comment utilities for parsing and formatting PGN %clk tags.
 */

/**
 * Parses a PGN %clk string (e.g., "0:03:00", "1:23:45.5", "0:05.2", "12:34") to milliseconds.
 */
export function parseClockToMs(clkStr: string): number | null {
  if (!clkStr) return null;
  const cleaned = clkStr.trim();
  if (!cleaned) return null;

  // Split hours/minutes/seconds
  const parts = cleaned.split(':');
  if (parts.length === 2) {
    // minutes:seconds[.tenths]
    const minutes = Number.parseFloat(parts[0]);
    const seconds = Number.parseFloat(parts[1]);
    if (Number.isNaN(minutes) || Number.isNaN(seconds)) return null;
    return Math.round((minutes * 60 + seconds) * 1000);
  }

  if (parts.length === 3) {
    // hours:minutes:seconds[.tenths]
    const hours = Number.parseFloat(parts[0]);
    const minutes = Number.parseFloat(parts[1]);
    const seconds = Number.parseFloat(parts[2]);
    if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)) return null;
    return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
  }

  // Single number representing seconds
  const totalSeconds = Number.parseFloat(cleaned);
  if (!Number.isNaN(totalSeconds)) {
    return Math.round(totalSeconds * 1000);
  }

  return null;
}

/**
 * Formats a millisecond duration to a human-readable clock string.
 * Examples: 180000 -> "3:00", 3723000 -> "1:02:03", 5200 -> "0:05.2"
 */
export function formatMsToClock(ms: number, includeTenths = false): string {
  if (ms < 0) ms = 0;
  const totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const tenths = Math.floor((totalSeconds % 1) * 10);

  if (hours > 0) {
    const mm = minutes.toString().padStart(2, '0');
    const ss = seconds.toString().padStart(2, '0');
    return `${hours}:${mm}:${ss}`;
  }

  if (includeTenths && totalSeconds < 10) {
    return `0:0${seconds}.${tenths}`;
  }

  const ss = seconds.toString().padStart(2, '0');
  return `${minutes}:${ss}`;
}

/**
 * Computes the time spent (in milliseconds) on a move from consecutive clocks of the same player.
 */
export function computeTimeSpentMs(
  prevClockMs: number | undefined,
  currClockMs: number | undefined,
  incrementMs = 0
): number | undefined {
  if (prevClockMs === undefined || currClockMs === undefined) {
    return undefined;
  }
  const diff = prevClockMs + incrementMs - currClockMs;
  return diff >= 0 ? diff : 0;
}
