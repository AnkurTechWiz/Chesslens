// lib/storage/quota.ts — Storage estimation, persistence requests, LRU pruning, and incognito warning
// Respects AGENTS.md rules: zero server database, all persistence in IndexedDB.

import { db } from './db';

export interface StorageQuotaInfo {
  usageBytes: number;
  quotaBytes: number;
  percentUsed: number;
  isPersistent: boolean;
  formattedUsage: string;
  formattedQuota: string;
}

/** Format byte counts to human-readable string (e.g. 4.2 MB) */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Inspect browser storage estimate and persistence status.
 */
export async function getStorageQuota(): Promise<StorageQuotaInfo> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return {
      usageBytes: 0,
      quotaBytes: 0,
      percentUsed: 0,
      isPersistent: false,
      formattedUsage: '0 MB',
      formattedQuota: 'Unlimited',
    };
  }

  try {
    const [estimate, isPersisted] = await Promise.all([
      navigator.storage.estimate(),
      navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(false),
    ]);

    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const percent = quota > 0 ? (usage / quota) * 100 : 0;

    return {
      usageBytes: usage,
      quotaBytes: quota,
      percentUsed: Math.min(100, Math.round(percent * 10) / 10),
      isPersistent: isPersisted,
      formattedUsage: formatBytes(usage),
      formattedQuota: quota > 0 ? formatBytes(quota) : 'Unknown',
    };
  } catch {
    return {
      usageBytes: 0,
      quotaBytes: 0,
      percentUsed: 0,
      isPersistent: false,
      formattedUsage: 'Unknown',
      formattedQuota: 'Unknown',
    };
  }
}

/**
 * Request persistent (non-evictable) storage from browser.
 */
export async function requestStoragePersistence(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return false;
  }
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/**
 * Detect if running in private / incognito browsing or temporary storage.
 */
export async function isIncognito(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return false;
  }

  try {
    // Safari / WebKit private mode detection or quota constraint check
    const estimate = await navigator.storage.estimate();
    const quota = estimate.quota || 0;

    // Many browsers in private mode restrict quota to under 120MB
    if (quota > 0 && quota < 120 * 1024 * 1024) {
      return true;
    }

    if ('webkitTemporaryStorage' in navigator) {
      return false;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Prune oldest cached evaluations if the evals table exceeds the threshold.
 * Removes the oldest 25% entries by `lastUsed`.
 */
export async function pruneEvalCacheIfNeeded(maxEntries = 10000): Promise<number> {
  try {
    const totalCount = await db.evals.count();
    if (totalCount <= maxEntries) {
      return 0;
    }

    const deleteCount = Math.ceil(totalCount * 0.25);
    const oldest = await db.evals.orderBy('lastUsed').limit(deleteCount).keys();

    if (oldest.length > 0) {
      await db.evals.bulkDelete(oldest as string[]);
      return oldest.length;
    }
    return 0;
  } catch {
    return 0;
  }
}
