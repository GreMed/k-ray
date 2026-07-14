import type { AnnouncementResult, AnnouncementQuery } from './types';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6小时

interface CacheEntry {
  result: AnnouncementResult;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export function buildCacheKey(query: AnnouncementQuery): string {
  return [
    query.market,
    query.stockCode,
    query.startDate,
    query.endDate,
  ].join('|');
}

export function getCached(key: string): AnnouncementResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return {
    announcements: entry.result.announcements.map(a => ({ ...a })),
    meta: { ...entry.result.meta },
  };
}

export function setCached(key: string, result: AnnouncementResult): void {
  cache.set(key, {
    result: {
      announcements: result.announcements.map(a => ({ ...a })),
      meta: { ...result.meta },
    },
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function clearCache(): void {
  cache.clear();
}

export function _cacheSize(): number {
  return cache.size;
}
