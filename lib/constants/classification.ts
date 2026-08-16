import type { Classification } from '../types';

export interface ClassificationMeta {
  id: Classification;
  name: string;
  symbol: string;
  color: string;
  description: string;
}

export const CLASSIFICATION_META: Record<Classification, ClassificationMeta> = {
  brilliant: {
    id: 'brilliant',
    name: 'Brilliant',
    symbol: '!!',
    color: '#26c2a3',
    description: 'A stellar sacrifice finding the only winning line',
  },
  great: {
    id: 'great',
    name: 'Great Move',
    symbol: '!',
    color: '#5c8bb0',
    description: 'A crucial or only move that swung or held the evaluation',
  },
  best: {
    id: 'best',
    name: 'Best',
    symbol: '★',
    color: '#95bb4a',
    description: 'The top engine move',
  },
  excellent: {
    id: 'excellent',
    name: 'Excellent',
    symbol: '✓',
    color: '#96bc4b',
    description: 'Nearly as strong as the best move',
  },
  good: {
    id: 'good',
    name: 'Good',
    symbol: '✓',
    color: '#96af8b',
    description: 'A solid, playable move keeping the advantage',
  },
  book: {
    id: 'book',
    name: 'Book',
    symbol: '📖',
    color: '#a88865',
    description: 'Standard opening theory move',
  },
  inaccuracy: {
    id: 'inaccuracy',
    name: 'Inaccuracy',
    symbol: '?!',
    color: '#f7c631',
    description: 'A slight slip that gives up some advantage',
  },
  mistake: {
    id: 'mistake',
    name: 'Mistake',
    symbol: '?',
    color: '#ffa459',
    description: 'A noticeable mistake deteriorating the position',
  },
  miss: {
    id: 'miss',
    name: 'Miss',
    symbol: '✕',
    color: '#ee6b55',
    description: 'Missed a decisive tactical chance or punished blunder',
  },
  blunder: {
    id: 'blunder',
    name: 'Blunder',
    symbol: '??',
    color: '#fa412d',
    description: 'A critical blunder that loses material or game state',
  },
  forced: {
    id: 'forced',
    name: 'Forced',
    symbol: '—',
    color: '#9e9e9e',
    description: 'The only legal move available',
  },
};

export const CLASSIFICATION_COLORS: Record<Classification, string> = {
  brilliant: '#26c2a3',
  great: '#5c8bb0',
  best: '#95bb4a',
  excellent: '#96bc4b',
  good: '#96af8b',
  book: '#a88865',
  inaccuracy: '#f7c631',
  mistake: '#ffa459',
  miss: '#ee6b55',
  blunder: '#fa412d',
  forced: '#9e9e9e',
};
