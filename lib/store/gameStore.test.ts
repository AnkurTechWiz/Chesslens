import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { useGameStore } from './gameStore';

describe('Game Store (lib/store/gameStore)', () => {
  const fixturesDir = path.resolve(__dirname, '../../tests/fixtures');

  beforeEach(() => {
    // Reset store state
    useGameStore.setState({
      game: null,
      currentPly: 0,
      boardFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      orientation: 'white',
      isPlaying: false,
      selectedSquare: null,
      legalMoves: [],
      pendingPromotion: null,
      lastMoveSquares: null,
      error: null,
    });
  });

  it('should load a PGN and jump to start by default', () => {
    const pgn = fs.readFileSync(path.join(fixturesDir, 'opera-game.pgn'), 'utf-8');
    const success = useGameStore.getState().loadPgn(pgn);

    expect(success).toBe(true);
    expect(useGameStore.getState().game?.moves.length).toBe(33);
    expect(useGameStore.getState().currentPly).toBe(0);
    expect(useGameStore.getState().boardFen).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    );
  });

  it('should navigate next, prev, first, last, and jump to ply', () => {
    const pgn = fs.readFileSync(path.join(fixturesDir, 'opera-game.pgn'), 'utf-8');
    useGameStore.getState().loadPgn(pgn);

    // Step forward
    useGameStore.getState().nextMove();
    expect(useGameStore.getState().currentPly).toBe(1);
    expect(useGameStore.getState().lastMoveSquares).toEqual({ from: 'e2', to: 'e4' });

    // Step to ply 10
    useGameStore.getState().jumpToPly(10);
    expect(useGameStore.getState().currentPly).toBe(10);

    // Step back
    useGameStore.getState().prevMove();
    expect(useGameStore.getState().currentPly).toBe(9);

    // Jump to last
    useGameStore.getState().lastMove();
    expect(useGameStore.getState().currentPly).toBe(33);
    expect(useGameStore.getState().isCheckmate).toBe(true);

    // Jump to first
    useGameStore.getState().firstMove();
    expect(useGameStore.getState().currentPly).toBe(0);
  });

  it('should flip orientation and toggle mute', () => {
    expect(useGameStore.getState().orientation).toBe('white');
    useGameStore.getState().toggleFlip();
    expect(useGameStore.getState().orientation).toBe('black');

    expect(useGameStore.getState().isMuted).toBe(false);
    useGameStore.getState().toggleMute();
    expect(useGameStore.getState().isMuted).toBe(true);
  });

  it('should calculate legal moves on square selection', () => {
    // Initial board, select e2 pawn
    useGameStore.getState().selectSquare('e2');
    expect(useGameStore.getState().selectedSquare).toBe('e2');
    expect(useGameStore.getState().legalMoves).toContain('e3');
    expect(useGameStore.getState().legalMoves).toContain('e4');

    // Deselect
    useGameStore.getState().selectSquare(null);
    expect(useGameStore.getState().selectedSquare).toBeNull();
    expect(useGameStore.getState().legalMoves.length).toBe(0);
  });

  it('should make legal moves and update game state', () => {
    const success = useGameStore.getState().makeMove('e2', 'e4');
    expect(success).toBe(true);
    expect(useGameStore.getState().currentPly).toBe(1);
    expect(useGameStore.getState().lastMoveSquares).toEqual({ from: 'e2', to: 'e4' });

    // Try illegal move
    const illegalSuccess = useGameStore.getState().makeMove('e7', 'e4');
    expect(illegalSuccess).toBe(false);
  });
});
