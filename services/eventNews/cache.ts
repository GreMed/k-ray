// K-Ray 第十阶段 A：新闻数据缓存
// 独立于公告服务和行情服务的缓存
// 缓存键加入数据模式，避免 mock/real/fallback 串缓存

import type { EventNewsMode } from './types';

interface CacheEntry<T> {
  value: T;
  expireAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟
const cache = new Map<string, CacheEntry<unknown>>();

// 缓存键加入数据模式，避免 mock/real/fallback 串缓存
export function buildCacheKey(query: { stockCode: string; market: string }, mode: EventNewsMode): string {
  return `event-news:${mode}:${query.stockCode}:${query.market}`;
}

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expireAt) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCached<T>(key: string, value: T): void {
  cache.set(key, { value, expireAt: Date.now() + CACHE_TTL_MS });
}

export function clearCache(): void {
  cache.clear();
}

export function _cacheSize(): number {
  return cache.size;
}
