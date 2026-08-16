import type { ParsedGame } from './parse';
import { formatMsToClock } from './clocks';

/**
 * Serializes a ParsedGame back into a standard PGN string.
 */
export function serializePgn(game: ParsedGame): string {
  const headerLines: string[] = [];

  const standardOrder = [
    'Event',
    'Site',
    'Date',
    'Round',
    'White',
    'Black',
    'Result',
    'WhiteElo',
    'BlackElo',
    'ECO',
    'Opening',
    'TimeControl',
    'FEN',
    'SetUp',
  ];

  const written = new Set<string>();

  for (const key of standardOrder) {
    if (game.headers[key] !== undefined && game.headers[key] !== '') {
      headerLines.push(`[${key} "${game.headers[key]}"]`);
      written.add(key);
    }
  }

  for (const [key, value] of Object.entries(game.headers)) {
    if (!written.has(key) && value !== undefined && value !== '') {
      headerLines.push(`[${key} "${value}"]`);
    }
  }

  // Generate movetext
  const moveParts: string[] = [];

  for (let i = 0; i < game.moves.length; i++) {
    const m = game.moves[i];
    const isWhite = m.color === 'w';
    const moveNumber = Math.floor(i / 2) + 1;

    if (isWhite) {
      moveParts.push(`${moveNumber}. ${m.san}`);
    } else {
      if (i === 0) {
        moveParts.push(`${moveNumber}... ${m.san}`);
      } else {
        moveParts.push(m.san);
      }
    }

    if (m.nags && m.nags.length > 0) {
      moveParts.push(m.nags.join(' '));
    }

    const commentParts: string[] = [];
    if (m.clockMs !== undefined) {
      commentParts.push(`[%clk ${formatMsToClock(m.clockMs)}]`);
    }
    if (m.evalCp !== undefined) {
      const evalVal = (m.evalCp / 100).toFixed(2);
      commentParts.push(`[%eval ${evalVal}]`);
    } else if (m.evalMate !== undefined) {
      commentParts.push(`[%eval #${m.evalMate}]`);
    }
    if (m.comment) {
      commentParts.push(m.comment);
    }

    if (commentParts.length > 0) {
      moveParts.push(`{ ${commentParts.join(' ')} }`);
    }
  }

  if (game.result) {
    moveParts.push(game.result);
  }

  const headerStr = headerLines.join('\n');
  const bodyStr = moveParts.join(' ');

  return headerStr ? `${headerStr}\n\n${bodyStr}` : bodyStr;
}
