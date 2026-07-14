import type { MarketKLineResult, MarketKLineQuery } from './types';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24小时

interface CacheEntry {
  result: MarketKLineResult;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export function buildCacheKey(query: MarketKLineQuery): string {
  return [
    query.market,
    query.stockCode,
    query.startDate,
    query.endDate,
    query.adjustment || 'qfq',
  ].join('|');
}

export function getCached(key: string): MarketKLineResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  // 返回深拷贝避免外部修改污染缓存
  return {
    klines: entry.result.klines.map(k => ({ ...k })),
    meta: { ...entry.result.meta },
  };
}

export function setCached(key: string, result: MarketKLineResult): void {
  cache.set(key, {
    result: {
      klines: result.klines.map(k => ({ ...k })),
      meta: { ...result.meta },
    },
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function clearCache(): void {
  cache.clear();
}

// 仅供测试使用
export function _cacheSize(): number {
  return cache.size;
}
