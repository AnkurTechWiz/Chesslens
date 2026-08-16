import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parsePgn, splitMultiGamePgn, ParsedGameSchema } from './parse';
import { parseClockToMs, formatMsToClock, computeTimeSpentMs } from './clocks';
import { serializePgn } from './serialize';

describe('PGN Parsing Subsystem (lib/pgn)', () => {
  const fixturesDir = path.resolve(__dirname, '../../tests/fixtures');

  it('should parse Kasparov vs Topalov 1999 (44 moves / 87 plies)', () => {
    const pgn = fs.readFileSync(path.join(fixturesDir, 'kasparov-topalov.pgn'), 'utf-8');
    const parsed = parsePgn(pgn);

    expect(parsed.error).toBeUndefined();
    expect(parsed.headers.White).toBe('Garry Kasparov');
    expect(parsed.headers.Black).toBe('Veselin Topalov');
    expect(parsed.headers.WhiteElo).toBe(2812);
    expect(parsed.headers.BlackElo).toBe(2700);
    expect(parsed.headers.Result).toBe('1-0');
    expect(parsed.moves.length).toBe(87);

    // 24. Rxd4 is ply 47 (White move 24)
    const ply47 = parsed.moves[46];
    expect(ply47.ply).toBe(47);
    expect(ply47.san).toBe('Rxd4');
    expect(ply47.uci).toBe('d1d4');
    expect(ply47.piece).toBe('r');
    expect(ply47.captured).toBe('p'); // captured pawn on d4

    // Validates against Zod schema
    expect(ParsedGameSchema.safeParse(parsed).success).toBe(true);
  });

  it('should parse Morphy Opera Game fixture', () => {
    const pgn = fs.readFileSync(path.join(fixturesDir, 'opera-game.pgn'), 'utf-8');
    const parsed = parsePgn(pgn);

    expect(parsed.error).toBeUndefined();
    expect(parsed.headers.White).toBe('Paul Morphy');
    expect(parsed.moves.length).toBe(33);

    // Final move is 17. Rd8# (ply 33)
    const lastMove = parsed.moves[parsed.moves.length - 1];
    expect(lastMove.san).toBe('Rd8#');
    expect(lastMove.isCheckmate).toBe(true);
  });

  it('should parse clock and eval comments accurately', () => {
    const pgn = fs.readFileSync(path.join(fixturesDir, 'clock-comments.pgn'), 'utf-8');
    const parsed = parsePgn(pgn);

    expect(parsed.error).toBeUndefined();
    expect(parsed.moves.length).toBe(37);

    // Move 1: 1. e4 { [%clk 0:03:00] [%eval 0.25] }
    const m1 = parsed.moves[0];
    expect(m1.san).toBe('e4');
    expect(m1.clockMs).toBe(180000); // 3 minutes
    expect(m1.evalCp).toBe(25); // +0.25 -> 25 cp

    // Move 2: 1... c5 { [%clk 0:02:59] [%eval 0.28] }
    const m2 = parsed.moves[1];
    expect(m2.san).toBe('c5');
    expect(m2.clockMs).toBe(179000); // 2:59

    // Check time spent calculation
    // White's move 3 (ply 3): 2. Nf3 { [%clk 0:02:58] } -> White started at 3:00, now 2:58 -> 2s spent
    const m3 = parsed.moves[2];
    expect(m3.san).toBe('Nf3');
    expect(m3.clockMs).toBe(178000);
    expect(m3.timeSpentMs).toBe(2000);

    // Mate eval: move 32 (ply 32: 16... Rc5 { [%eval #3] })
    const m32 = parsed.moves[31];
    expect(m32.san).toBe('Rc5');
    expect(m32.evalMate).toBe(3);
  });

  it('should parse 60-moves endgame struggle with promotion', () => {
    const pgn = fs.readFileSync(path.join(fixturesDir, '60-moves.pgn'), 'utf-8');
    const parsed = parsePgn(pgn);

    expect(parsed.error).toBeUndefined();
    expect(parsed.moves.length).toBe(106);

    // Find promotion move 51... a1=Q+ (ply 102)
    const promoMove = parsed.moves[101];
    expect(promoMove.san).toBe('a1=Q+');
    expect(promoMove.promotion).toBe('q');
    expect(promoMove.isCheck).toBe(true);

    // Final move is 53... Qa3# (ply 106)
    const finalMove = parsed.moves[105];
    expect(finalMove.san).toBe('Qa3#');
    expect(finalMove.isCheckmate).toBe(true);
  });

  it('should split and parse multi-game PGNs', () => {
    const pgn = fs.readFileSync(path.join(fixturesDir, 'multi-game.pgn'), 'utf-8');
    const games = splitMultiGamePgn(pgn);

    expect(games.length).toBe(2);

    const game1 = parsePgn(games[0]);
    expect(game1.headers.Event).toBe("Game 1: Scholar's Mate");
    expect(game1.moves.length).toBe(7);
    expect(game1.moves[6].san).toBe('Qxf7#');

    const game2 = parsePgn(games[1]);
    expect(game2.headers.Event).toBe("Game 2: Fool's Mate");
    expect(game2.moves.length).toBe(4);
    expect(game2.moves[3].san).toBe('Qh4#');
  });

  it('should handle malformed PGN gracefully without crashing', () => {
    const pgn = fs.readFileSync(path.join(fixturesDir, 'malformed.pgn'), 'utf-8');
    const parsed = parsePgn(pgn);

    expect(parsed.error).toBeDefined();
    expect(parsed.error).toContain('Illegal or unparseable move');
    expect(parsed.moves.length).toBe(3); // e4, e5, Nf3 parsed before error
  });

  it('should parse headerless movetext-only PGN successfully', () => {
    const rawMovetext = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O';
    const parsed = parsePgn(rawMovetext);

    expect(parsed.error).toBeUndefined();
    expect(parsed.moves.length).toBe(16);
    expect(parsed.moves[0].san).toBe('e4');
    expect(parsed.moves[15].san).toBe('O-O');
    expect(parsed.startingFen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(ParsedGameSchema.safeParse(parsed).success).toBe(true);
  });

  it('should handle completely invalid PGN gracefully with descriptive error', () => {
    const parsed = parsePgn('completely invalid text not chess');
    expect(parsed.error).toBeDefined();
    expect(parsed.error).toContain('Illegal or unparseable move');
    expect(parsed.moves.length).toBe(0);
  });

  it('should handle empty or whitespace PGN gracefully', () => {
    const emptyParsed = parsePgn('');
    expect(emptyParsed.error).toBe('Empty PGN provided');
    expect(emptyParsed.moves.length).toBe(0);
  });

  it('should test clocks utility functions', () => {
    expect(parseClockToMs('0:03:00')).toBe(180000);
    expect(parseClockToMs('1:23:45')).toBe(5025000);
    expect(parseClockToMs('0:05.2')).toBe(5200);
    expect(parseClockToMs('45')).toBe(45000);
    expect(parseClockToMs('')).toBeNull();

    expect(formatMsToClock(180000)).toBe('3:00');
    expect(formatMsToClock(5025000)).toBe('1:23:45');
    expect(formatMsToClock(5200, true)).toBe('0:05.2');

    expect(computeTimeSpentMs(180000, 175000)).toBe(5000);
    expect(computeTimeSpentMs(180000, 175000, 2000)).toBe(7000); // with 2s increment
  });

  it('should round-trip serialize parsed PGN', () => {
    const pgn = fs.readFileSync(path.join(fixturesDir, 'opera-game.pgn'), 'utf-8');
    const parsed = parsePgn(pgn);
    const serialized = serializePgn(parsed);
    const reparsed = parsePgn(serialized);

    expect(reparsed.moves.length).toBe(parsed.moves.length);
    expect(reparsed.headers.White).toBe(parsed.headers.White);
    expect(reparsed.moves[32].san).toBe('Rd8#');
  });
});
