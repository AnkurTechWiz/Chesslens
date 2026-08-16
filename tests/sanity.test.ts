import { describe, it, expect } from 'vitest';
import { CLASSIFICATION_META, CLASSIFICATION_COLORS } from '../lib/constants/classification';
import type { Classification } from '../lib/types';

describe('Phase 0 Sanity Suite', () => {
  it('should have metadata for all 11 chess classifications', () => {
    const requiredClassifications: Classification[] = [
      'brilliant',
      'great',
      'best',
      'excellent',
      'good',
      'book',
      'inaccuracy',
      'mistake',
      'miss',
      'blunder',
      'forced',
    ];

    expect(Object.keys(CLASSIFICATION_META).length).toBe(11);
    expect(Object.keys(CLASSIFICATION_COLORS).length).toBe(11);

    for (const key of requiredClassifications) {
      expect(CLASSIFICATION_META[key]).toBeDefined();
      expect(CLASSIFICATION_META[key].id).toBe(key);
      expect(CLASSIFICATION_META[key].color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(CLASSIFICATION_COLORS[key]).toBe(CLASSIFICATION_META[key].color);
    }
  });

  it('should verify exact classification colors from spec §5.2', () => {
    expect(CLASSIFICATION_COLORS.brilliant).toBe('#26c2a3');
    expect(CLASSIFICATION_COLORS.great).toBe('#5c8bb0');
    expect(CLASSIFICATION_COLORS.best).toBe('#95bb4a');
    expect(CLASSIFICATION_COLORS.excellent).toBe('#96bc4b');
    expect(CLASSIFICATION_COLORS.good).toBe('#96af8b');
    expect(CLASSIFICATION_COLORS.book).toBe('#a88865');
    expect(CLASSIFICATION_COLORS.inaccuracy).toBe('#f7c631');
    expect(CLASSIFICATION_COLORS.mistake).toBe('#ffa459');
    expect(CLASSIFICATION_COLORS.miss).toBe('#ee6b55');
    expect(CLASSIFICATION_COLORS.blunder).toBe('#fa412d');
    expect(CLASSIFICATION_COLORS.forced).toBe('#9e9e9e');
  });
});
