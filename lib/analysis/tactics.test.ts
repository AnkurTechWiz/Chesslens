import { describe, it, expect } from 'vitest';
import { detectMotifs, generateCoachText, type MotifInput, type CoachTextInput } from './tactics';

function makeMotifInput(overrides: Partial<MotifInput>): MotifInput {
  return {
    fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    moverColor: 'w',
    classification: 'best',
    bestUci: 'e2e4',
    bestPv: ['e2e4'],
    playedUci: 'e2e4',
    bestCp: 30,
    bestMate: null,
    playedCp: 30,
    playedMate: null,
    ...overrides,
  };
}

describe('tactics', () => {
  describe('detectMotifs', () => {
    it('detects missed_mate when best has mate but played does not', () => {
      const motifs = detectMotifs(makeMotifInput({
        bestMate: 3,
        playedMate: null,
        bestCp: null,
        playedCp: -200,
        classification: 'blunder',
      }));
      expect(motifs).toContain('missed_mate');
    });

    it('detects allowed_mate when played allows mate', () => {
      const motifs = detectMotifs(makeMotifInput({
        bestMate: null,
        playedMate: -3,
        bestCp: 100,
        playedCp: null,
        classification: 'blunder',
      }));
      expect(motifs).toContain('allowed_mate');
    });

    it('detects hanging_piece when best captures a valuable piece', () => {
      // Position where best move captures a knight on e5
      const fen = 'r1bqkbnr/pppppppp/2n5/4N3/8/8/PPPPPPPP/RNBQKB1R b KQkq - 0 1';
      const motifs = detectMotifs(makeMotifInput({
        fenBefore: fen,
        moverColor: 'b',
        classification: 'miss',
        bestUci: 'c6e5', // Best is to capture the knight
        playedUci: 'a7a6', // But played a passive move
      }));
      expect(motifs).toContain('hanging_piece');
    });

    it('detects time_pressure when clock is low', () => {
      const motifs = detectMotifs(makeMotifInput({
        classification: 'mistake',
        clockMs: 15000, // 15 seconds
      }));
      expect(motifs).toContain('time_pressure');
    });

    it('does not detect time_pressure when clock is fine', () => {
      const motifs = detectMotifs(makeMotifInput({
        classification: 'mistake',
        clockMs: 120000, // 2 minutes
      }));
      expect(motifs).not.toContain('time_pressure');
    });

    it('returns empty motifs for a normal best move', () => {
      const motifs = detectMotifs(makeMotifInput({
        classification: 'best',
      }));
      // Should not have error-related motifs
      expect(motifs).not.toContain('hanging_piece');
      expect(motifs).not.toContain('missed_mate');
    });
  });

  describe('generateCoachText', () => {
    function makeCoachInput(overrides: Partial<CoachTextInput>): CoachTextInput {
      return {
        classification: 'best',
        motifs: [],
        san: 'Nf3',
        bestSan: 'Nf3',
        bestPv: ['g1f3'],
        phase: 'opening',
        epLoss: 0,
        mateBefore: null,
        mateAfter: null,
        bestMate: null,
        ...overrides,
      };
    }

    it('generates non-empty text for every classification', () => {
      const classifications = [
        'brilliant', 'great', 'best', 'excellent', 'good', 'book',
        'inaccuracy', 'mistake', 'miss', 'blunder', 'forced',
      ] as const;

      for (const classification of classifications) {
        const text = generateCoachText(makeCoachInput({ classification }));
        expect(text.length).toBeGreaterThan(0);
      }
    });

    it('includes the move SAN in the text', () => {
      const text = generateCoachText(makeCoachInput({
        classification: 'best',
        san: 'Rxd4',
      }));
      expect(text).toContain('Rxd4');
    });

    it('includes the best move for mistakes', () => {
      const text = generateCoachText(makeCoachInput({
        classification: 'mistake',
        san: 'a6',
        bestSan: 'Nxe5',
      }));
      expect(text).toContain('Nxe5');
    });

    it('uses motif-specific template when available', () => {
      const text = generateCoachText(makeCoachInput({
        classification: 'miss',
        motifs: ['hanging_piece'],
        san: 'a6',
        bestSan: 'Nxe5',
      }));
      expect(text).toContain('hanging');
    });

    it('adds mate info for missed_mate', () => {
      const text = generateCoachText(makeCoachInput({
        classification: 'blunder',
        motifs: ['missed_mate'],
        san: 'Rd1',
        bestSan: 'Qh7+',
        bestMate: 3,
      }));
      expect(text).toContain('Mate in 3');
    });

    it('handles forced moves', () => {
      const text = generateCoachText(makeCoachInput({
        classification: 'forced',
        san: 'Kf1',
      }));
      expect(text).toContain('Kf1');
      expect(text).toContain('only');
    });
  });
});
