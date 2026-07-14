import { baostockProvider } from './baostockProvider';
import { mockProvider } from './mockProvider';
import { buildCacheKey, getCached, setCached } from './cache';
import type { MarketKLineQuery, MarketKLineResult, MarketDataMode } from './types';

export type { MarketKLineQuery, MarketKLineResult, AdjustmentType, MarketDataSource, MarketDataMode } from './types';
export { ValidationError, SanitizedError } from './types';
export { mockProvider, baostockProvider };
export { buildCacheKey, clearCache, _cacheSize } from './cache';

export function getMarketDataMode(): MarketDataMode {
  // 第十四阶段 A1 封板修复：未配置或非法值默认使用 real 模式
  // 普通用户运行路径不得自动进入 Mock 或 fallback
  const mode = process.env.MARKET_DATA_MODE;
  if (mode === 'mock' || mode === 'real' || mode === 'fallback') {
    return mode;
  }
  return 'real';
}

// 主入口：根据服务端模式获取K线
export async function fetchKLines(query: MarketKLineQuery): Promise<MarketKLineResult> {
  const mode = getMarketDataMode();
  const cacheKey = buildCacheKey(query);

  // mock 模式：不调用 BaoStock
  if (mode === 'mock') {
    const cached = getCached(cacheKey);
    if (cached) return cached;
    const result = await mockProvider.fetchKLines(query);
    setCached(cacheKey, result);
    return result;
  }

  // real / fallback 模式：先尝试缓存
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const result = await baostockProvider.fetchKLines(query);
    setCached(cacheKey, result);
    return result;
  } catch (err) {
    // real 模式：直接返回错误，不降级
    if (mode === 'real') {
      throw err;
    }
    // fallback 模式：降级到 Mock
    const reason = err instanceof Error ? err.message : '未知错误';
    const mockResult = await mockProvider.fetchKLines(query);
    const fallbackResult: MarketKLineResult = {
      ...mockResult,
      meta: {
        ...mockResult.meta,
        sourceLabel: 'Mock演示数据(BaoStock降级)',
        fallbackReason: `BaoStock真实行情暂时不可用，当前已降级为本地Mock行情。原因：${reason}`,
      },
    };
    return fallbackResult;
  }
}
