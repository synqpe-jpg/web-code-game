/**
 * Data Merge Utilities for Web Code Game
 * Implements Non-Destructive Monotonic Set Union and Self-Healing Data Synchronization.
 * Prevents blind overwrites and data regressions across Admin, Client, and Backend.
 */

export interface MergeResult<T> {
  merged: T[];
  hasNewItems: boolean;
  totalMerged: number;
}

/**
 * Normalizes URL string for unique key comparison (strips trailing slashes, protocol, www)
 */
export function normalizeUrlKey(rawUrl: string): string {
  if (!rawUrl) return '';
  return rawUrl
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');
}

/**
 * Performs a Non-Destructive Monotonic Set Union:
 * Merges server list with bundled defaults and local state without discarding any valid item.
 * 
 * @param serverList Incoming dataset from server API
 * @param bundledList Bundled master dataset from code/static build
 * @param uniqueKeyFn Function returning the unique string identifier for an item
 * @param deletedIds Optional set of tombstoned/deleted IDs that must be excluded
 */
export function smartMergeEntities<T>(
  serverList: T[] | null | undefined,
  bundledList: T[] | null | undefined,
  uniqueKeySelector: ((item: T) => string) | keyof T | string,
  deletedIds?: Set<string>
): MergeResult<T> {
  const getKey: (item: T) => string = typeof uniqueKeySelector === 'function'
    ? uniqueKeySelector
    : (item: any) => (item && item[uniqueKeySelector as string] !== undefined ? String(item[uniqueKeySelector as string]) : '');

  const map = new Map<string, T>();
  const validDeleted = deletedIds || new Set<string>();

  // 1. Ingest server items first (so any server modifications take precedence on matched keys)
  if (Array.isArray(serverList)) {
    for (const item of serverList) {
      if (!item) continue;
      const key = getKey(item);
      if (key && !validDeleted.has(key)) {
        map.set(key, item);
      }
    }
  }

  let hasNewItems = false;

  // 2. Safely merge bundled/local defaults without wiping any existing item
  if (Array.isArray(bundledList)) {
    for (const item of bundledList) {
      if (!item) continue;
      const key = getKey(item);
      if (key && !validDeleted.has(key) && !map.has(key)) {
        map.set(key, item);
        hasNewItems = true; // Local/bundled build has a newer entity that server was missing!
      }
    }
  }

  const merged = Array.from(map.values());
  return {
    merged,
    hasNewItems,
    totalMerged: merged.length,
  };
}
