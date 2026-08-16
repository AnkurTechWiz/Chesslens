import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { Board } from './Board';
import { useGameStore } from '@/lib/store/gameStore';

describe('Board Component (components/board/Board)', () => {
  beforeEach(() => {
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

  it('should render all 64 board squares', () => {
    const { container } = render(<Board />);
    const squares = container.querySelectorAll('[data-square]');
    expect(squares.length).toBe(64);
  });

  it('should highlight selected square and legal moves on click', () => {
    const { container } = render(<Board />);
    const e2Square = container.querySelector('[data-square="e2"]');
    expect(e2Square).toBeTruthy();

    if (e2Square) {
      fireEvent.click(e2Square);
      expect(useGameStore.getState().selectedSquare).toBe('e2');
      expect(useGameStore.getState().legalMoves).toContain('e4');
    }
  });

  it('should execute move when clicking a legal destination square', () => {
    const { container } = render(<Board />);
    const e2Square = container.querySelector('[data-square="e2"]');
    const e4Square = container.querySelector('[data-square="e4"]');

    if (e2Square && e4Square) {
      fireEvent.click(e2Square);
      fireEvent.click(e4Square);

      expect(useGameStore.getState().currentPly).toBe(1);
      expect(useGameStore.getState().boardFen).toContain('4p3');
    }
  });
});
