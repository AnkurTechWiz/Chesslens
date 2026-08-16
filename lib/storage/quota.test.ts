// lib/storage/quota.test.ts — Tests for storage quota estimation, formatting, and cache pruning

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEvalsStore = new Map<string, { key: string; lastUsed: number }>();

vi.mock('./db', () => ({
  db: {
    evals: {
      count: vi.fn(async () => mockEvalsStore.size),
      orderBy: vi.fn(() => ({
        limit: vi.fn((n: number) => ({
          keys: vi.fn(async () => {
            const sorted = Array.from(mockEvalsStore.values()).sort(
              (a, b) => a.lastUsed - b.lastUsed,
            );
            return sorted.slice(0, n).map((x) => x.key);
          }),
        })),
      })),
      bulkDelete: vi.fn(async (keys: string[]) => {
        for (const k of keys) mockEvalsStore.delete(k);
      }),
    },
  },
}));

import { formatBytes, pruneEvalCacheIfNeeded, getStorageQuota } from './quota';

beforeEach(() => {
  mockEvalsStore.clear();
});

describe('Quota Subsystem', () => {
  describe('formatBytes', () => {
    it('formats 0 B correctly', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('formats KB, MB, GB properly', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
      expect(formatBytes(2.5 * 1024 * 1024 * 1024, 1)).toBe('2.5 GB');
    });
  });

  describe('getStorageQuota', () => {
    it('returns formatted object without crashing in test environment', async () => {
      const quota = await getStorageQuota();
      expect(quota).toBeDefined();
      expect(typeof quota.usageBytes).toBe('number');
      expect(typeof quota.percentUsed).toBe('number');
      expect(typeof quota.formattedUsage).toBe('string');
    });
  });

  describe('pruneEvalCacheIfNeeded', () => {
    it('does not prune when count is within limit', async () => {
      mockEvalsStore.set('key1', { key: 'key1', lastUsed: 100 });
      mockEvalsStore.set('key2', { key: 'key2', lastUsed: 200 });

      const pruned = await pruneEvalCacheIfNeeded(10);
      expect(pruned).toBe(0);
      expect(mockEvalsStore.size).toBe(2);
    });

    it('prunes the oldest 25% when exceeding max entries', async () => {
      for (let i = 1; i <= 20; i++) {
        mockEvalsStore.set(`key${i}`, { key: `key${i}`, lastUsed: i * 1000 });
      }

      // Max is 10, count is 20 -> 25% of 20 = 5 oldest keys pruned
      const pruned = await pruneEvalCacheIfNeeded(10);
      expect(pruned).toBe(5);
      expect(mockEvalsStore.size).toBe(15);
      expect(mockEvalsStore.has('key1')).toBe(false);
      expect(mockEvalsStore.has('key5')).toBe(false);
      expect(mockEvalsStore.has('key6')).toBe(true);
    });
  });
});
