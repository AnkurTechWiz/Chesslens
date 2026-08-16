import { Chess } from 'chess.js';
import { z } from 'zod';
import { parseClockToMs, computeTimeSpentMs } from './clocks';

export const ParsedHeadersSchema = z.object({
  Event: z.string().optional(),
  Site: z.string().optional(),
  Date: z.string().optional(),
  Round: z.string().optional(),
  White: z.string().optional(),
  Black: z.string().optional(),
  Result: z.string().optional(),
  WhiteElo: z.number().optional(),
  BlackElo: z.number().optional(),
  ECO: z.string().optional(),
  Opening: z.string().optional(),
  TimeControl: z.string().optional(),
  FEN: z.string().optional(),
  SetUp: z.string().optional(),
}).catchall(z.union([z.string(), z.number()]));

export type ParsedHeaders = z.infer<typeof ParsedHeadersSchema>;

export const ParsedMoveSchema = z.object({
  ply: z.number(),
  san: z.string(),
  uci: z.string(),
  from: z.string(),
  to: z.string(),
  piece: z.enum(['p', 'n', 'b', 'r', 'q', 'k']),
  color: z.enum(['w', 'b']),
  captured: z.enum(['p', 'n', 'b', 'r', 'q', 'k']).optional(),
  promotion: z.enum(['q', 'r', 'b', 'n']).optional(),
  fenBefore: z.string(),
  fenAfter: z.string(),
  isCheck: z.boolean(),
  isCheckmate: z.boolean(),
  isCastling: z.boolean(),
  clockMs: z.number().optional(),
  timeSpentMs: z.number().optional(),
  evalCp: z.number().optional(),
  evalMate: z.number().optional(),
  comment: z.string().optional(),
  nags: z.array(z.string()).optional(),
  variations: z.array(z.string()).optional(),
});

export type ParsedMove = z.infer<typeof ParsedMoveSchema>;

export const ParsedGameSchema = z.object({
  headers: ParsedHeadersSchema,
  moves: z.array(ParsedMoveSchema),
  startingFen: z.string(),
  result: z.string(),
  error: z.string().optional(),
});

export type ParsedGame = z.infer<typeof ParsedGameSchema>;

/**
 * Splits a multi-game PGN string into individual game PGN strings.
 */
export function splitMultiGamePgn(pgnText: string): string[] {
  if (!pgnText || !pgnText.trim()) return [];

  const rawGames: string[] = [];
  const lines = pgnText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  let currentGameLines: string[] = [];
  let inHeader = false;
  let inBody = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isHeaderLine = /^\s*\[([A-Za-z0-9_]+)\s+"(.*)"\]\s*$/.test(line);

    if (isHeaderLine) {
      if (inBody) {
        // We were in a body and now encountered a header -> new game starts
        const gameStr = currentGameLines.join('\n').trim();
        if (gameStr) rawGames.push(gameStr);
        currentGameLines = [];
        inBody = false;
      }
      inHeader = true;
      currentGameLines.push(line);
    } else {
      if (inHeader && line.trim() !== '') {
        inHeader = false;
        inBody = true;
      }
      if (inBody || inHeader || line.trim() !== '') {
        currentGameLines.push(line);
      }
    }
  }

  const lastGameStr = currentGameLines.join('\n').trim();
  if (lastGameStr) {
    rawGames.push(lastGameStr);
  }

  return rawGames;
}

/**
 * Extracts headers from PGN text.
 */
export function parsePgnHeaders(pgnText: string): ParsedHeaders {
  const headers: Record<string, string | number> = {};
  const headerRegex = /^\s*\[([A-Za-z0-9_]+)\s+"(.*)"\]\s*$/gm;
  let match: RegExpExecArray | null;

  while ((match = headerRegex.exec(pgnText)) !== null) {
    const key = match[1];
    const val = match[2];
    if (key === 'WhiteElo' || key === 'BlackElo') {
      const parsedNum = Number.parseInt(val, 10);
      headers[key] = Number.isNaN(parsedNum) ? val : parsedNum;
    } else {
      headers[key] = val;
    }
  }

  return headers;
}

interface RawTokenComment {
  type: 'comment';
  text: string;
  clockMs?: number;
  evalCp?: number;
  evalMate?: number;
}

interface RawTokenNag {
  type: 'nag';
  symbol: string;
}

interface RawTokenVariation {
  type: 'variation';
  text: string;
}

interface RawTokenMove {
  type: 'move';
  san: string;
}

type RawToken = RawTokenMove | RawTokenComment | RawTokenNag | RawTokenVariation;

/**
 * Tokenizes PGN movetext into structured tokens (moves, comments, NAGs, variations).
 */
export function tokenizeMovetext(movetext: string): RawToken[] {
  const tokens: RawToken[] = [];
  let i = 0;
  const len = movetext.length;

  while (i < len) {
    const ch = movetext[i];

    // Skip whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Comments in { ... }
    if (ch === '{') {
      let end = i + 1;
      while (end < len && movetext[end] !== '}') {
        end++;
      }
      const commentRaw = movetext.slice(i + 1, end).trim();
      i = end + 1;

      // Extract %clk and %eval
      let clockMs: number | undefined;
      let evalCp: number | undefined;
      let evalMate: number | undefined;

      const clkMatch = /%clk\s+([0-9:.]+)/.exec(commentRaw);
      if (clkMatch) {
        const ms = parseClockToMs(clkMatch[1]);
        if (ms !== null) clockMs = ms;
      }

      const evalMatch = /%eval\s+([#+-]?[0-9.]+)/.exec(commentRaw);
      if (evalMatch) {
        const valStr = evalMatch[1];
        if (valStr.startsWith('#')) {
          const mate = Number.parseInt(valStr.replace('#', ''), 10);
          if (!Number.isNaN(mate)) evalMate = mate;
        } else {
          const cp = Number.parseFloat(valStr);
          if (!Number.isNaN(cp)) {
            evalCp = Math.round(cp * 100); // convert pawns to centipawns
          }
        }
      }

      tokens.push({
        type: 'comment',
        text: commentRaw,
        clockMs,
        evalCp,
        evalMate,
      });
      continue;
    }

    // Variations in ( ... )
    if (ch === '(') {
      let depth = 1;
      let end = i + 1;
      while (end < len && depth > 0) {
        if (movetext[end] === '(') depth++;
        else if (movetext[end] === ')') depth--;
        end++;
      }
      const variationText = movetext.slice(i + 1, end - 1).trim();
      i = end;
      tokens.push({
        type: 'variation',
        text: variationText,
      });
      continue;
    }

    // NAGs starting with $
    if (ch === '$') {
      let end = i + 1;
      while (end < len && /[0-9]/.test(movetext[end])) {
        end++;
      }
      const nagStr = movetext.slice(i, end);
      i = end;
      tokens.push({
        type: 'nag',
        symbol: nagStr,
      });
      continue;
    }

    // End-of-game markers (1-0, 0-1, 1/2-1/2, *)
    if (
      movetext.startsWith('1-0', i) ||
      movetext.startsWith('0-1', i) ||
      movetext.startsWith('1/2-1/2', i) ||
      movetext.startsWith('*', i)
    ) {
      const match = /^(1-0|0-1|1\/2-1\/2|\*)/.exec(movetext.slice(i));
      if (match) {
        i += match[0].length;
        continue;
      }
    }

    // Move number indicators like "1." or "12..."
    if (/[0-9]/.test(ch)) {
      let end = i;
      while (end < len && /[0-9.]/.test(movetext[end])) {
        end++;
      }
      i = end;
      continue;
    }

    // Move SAN string (e.g. e4, Nxf7+, O-O-O, a8=Q#)
    let end = i;
    while (end < len && !/[\s{}($?]/.test(movetext[end])) {
      // Check if punctuation like ! or ? is attached
      if (movetext[end] === '!' || movetext[end] === '?') {
        break;
      }
      end++;
    }

    if (end > i) {
      let sanToken = movetext.slice(i, end).trim();
      i = end;

      // Check trailing inline NAGs like !!, ??, !?, ?!, !, ?
      let nagSuffix = '';
      while (i < len && (movetext[i] === '!' || movetext[i] === '?')) {
        nagSuffix += movetext[i];
        i++;
      }

      // Strip any trailing dots or punctuation
      sanToken = sanToken.replace(/\.+$/, '');
      if (sanToken) {
        tokens.push({
          type: 'move',
          san: sanToken,
        });
      }

      if (nagSuffix) {
        tokens.push({
          type: 'nag',
          symbol: nagSuffix,
        });
      }
      continue;
    }

    // If nothing matched, advance single character
    i++;
  }

  return tokens;
}

/**
 * Pure PGN parser that parses a PGN string into a structured ParsedGame.
 */
export function parsePgn(pgnText: string): ParsedGame {
  if (!pgnText || !pgnText.trim()) {
    return {
      headers: {},
      moves: [],
      startingFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      result: '*',
      error: 'Empty PGN provided',
    };
  }

  try {
    const headers = parsePgnHeaders(pgnText);

    // Remove headers to isolate movetext
    const movetext = pgnText.replace(/^\s*\[[A-Za-z0-9_]+\s+".*"\]\s*$/gm, '').trim();

    const startingFen = (headers.FEN as string) || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const chess = new Chess(startingFen);

    const tokens = tokenizeMovetext(movetext);
    const parsedMoves: ParsedMove[] = [];

    let currentPly = 0;
    let lastWhiteClock: number | undefined;
    let lastBlackClock: number | undefined;

    for (let t = 0; t < tokens.length; t++) {
      const token = tokens[t];

      if (token.type === 'move') {
        currentPly++;
        const fenBefore = chess.fen();

        let moveResult;
        try {
          moveResult = chess.move(token.san);
        } catch {
          // If chess.js move throws, return partial game with descriptive error
          return {
            headers,
            moves: parsedMoves,
            startingFen,
            result: (headers.Result as string) || '*',
            error: `Illegal or unparseable move "${token.san}" at ply ${currentPly}`,
          };
        }

        if (!moveResult) {
          return {
            headers,
            moves: parsedMoves,
            startingFen,
            result: (headers.Result as string) || '*',
            error: `Illegal move "${token.san}" at ply ${currentPly}`,
          };
        }

        const fenAfter = chess.fen();
        const uci = `${moveResult.from}${moveResult.to}${moveResult.promotion || ''}`;
        const isCheck = chess.inCheck();
        const isCheckmate = chess.isCheckmate();
        const isCastling = moveResult.flags.includes('k') || moveResult.flags.includes('q');

        const moveData: ParsedMove = {
          ply: currentPly,
          san: moveResult.san,
          uci,
          from: moveResult.from,
          to: moveResult.to,
          piece: moveResult.piece as 'p' | 'n' | 'b' | 'r' | 'q' | 'k',
          color: moveResult.color as 'w' | 'b',
          captured: moveResult.captured as 'p' | 'n' | 'b' | 'r' | 'q' | 'k' | undefined,
          promotion: moveResult.promotion as 'q' | 'r' | 'b' | 'n' | undefined,
          fenBefore,
          fenAfter,
          isCheck,
          isCheckmate,
          isCastling,
        };

        // Attach trailing comments, NAGs, or variations belonging to this move
        let nextIdx = t + 1;
        const commentsList: string[] = [];
        const nagsList: string[] = [];
        const variationsList: string[] = [];

        while (nextIdx < tokens.length && tokens[nextIdx].type !== 'move') {
          const nextTok = tokens[nextIdx];
          if (nextTok.type === 'comment') {
            if (nextTok.clockMs !== undefined) {
              moveData.clockMs = nextTok.clockMs;
            }
            if (nextTok.evalCp !== undefined) {
              moveData.evalCp = nextTok.evalCp;
            }
            if (nextTok.evalMate !== undefined) {
              moveData.evalMate = nextTok.evalMate;
            }
            if (nextTok.text) {
              commentsList.push(nextTok.text);
            }
          } else if (nextTok.type === 'nag') {
            nagsList.push(nextTok.symbol);
          } else if (nextTok.type === 'variation') {
            variationsList.push(nextTok.text);
          }
          nextIdx++;
        }

        if (commentsList.length > 0) {
          moveData.comment = commentsList.join(' ');
        }
        if (nagsList.length > 0) {
          moveData.nags = nagsList;
        }
        if (variationsList.length > 0) {
          moveData.variations = variationsList;
        }

        // Calculate time spent from previous clock of the same color
        if (moveData.color === 'w') {
          if (moveData.clockMs !== undefined) {
            moveData.timeSpentMs = computeTimeSpentMs(lastWhiteClock, moveData.clockMs);
            lastWhiteClock = moveData.clockMs;
          }
        } else {
          if (moveData.clockMs !== undefined) {
            moveData.timeSpentMs = computeTimeSpentMs(lastBlackClock, moveData.clockMs);
            lastBlackClock = moveData.clockMs;
          }
        }

        parsedMoves.push(moveData);
      }
    }

    const result = (headers.Result as string) || (chess.isCheckmate() ? (chess.turn() === 'w' ? '0-1' : '1-0') : '*');

    return {
      headers,
      moves: parsedMoves,
      startingFen,
      result,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown PGN parse failure';
    return {
      headers: {},
      moves: [],
      startingFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      result: '*',
      error: `Failed to parse PGN: ${errorMsg}`,
    };
  }
}
