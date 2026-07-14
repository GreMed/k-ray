// K-Ray 第十阶段 A：新闻候选数据服务入口
// 独立于公告服务和行情服务，不复用已冻结的模式

import { akshareNewsProvider } from './akshareNewsProvider';
import { mockProvider } from './mockProvider';
import { buildCacheKey, getCached, setCached } from './cache';
import type { EventNewsQuery, EventNewsResult, EventNewsMode } from './types';

export type { EventNewsQuery, EventNewsResult, NewsEventCandidate, EventNewsMode, EventNewsProvider, EventNewsResultMeta, StockRelevanceStatus } from './types';
export { ValidationError, SanitizedError, DATA_SOURCE_DESCRIPTION, EXPERIMENTAL_WARNING, NEWS_NOT_CAUSE_WARNING } from './types';
export { mockProvider, akshareNewsProvider };
export { buildCacheKey, clearCache, _cacheSize } from './cache';
export { verifyStockRelevance, extractStockCodes, isValidEventNewsAShareCode } from './stockRelevance';
export { generateNewsId, deduplicateNews, normalizeUrl, normalizeTitle, isValidUrl, extractDomain } from './newsDedup';

// 获取当前数据模式
export function getEventNewsMode(): EventNewsMode {
  const mode = process.env.EVENT_NEWS_MODE || 'mock';
  if (mode === 'mock' || mode === 'real' || mode === 'fallback') {
    return mode;
  }
  return 'mock';
}

// 在结果 meta 中设置 cacheStatus
function withCacheStatus(result: EventNewsResult, cacheStatus: 'hit' | 'miss' | 'bypass'): EventNewsResult {
  return {
    ...result,
    meta: {
      ...result.meta,
      cacheStatus,
    },
  };
}

// 主入口：根据模式获取新闻候选
// bypassCache: 仅 dev/验证环境使用，绕过缓存直接调用 provider
export async function fetchEventNews(query: EventNewsQuery, options?: { bypassCache?: boolean }): Promise<EventNewsResult> {
  const mode = getEventNewsMode();
  const bypassCache = options?.bypassCache === true;

  // 缓存键加入数据模式，避免 mock/real/fallback 串缓存
  const cacheKey = buildCacheKey(query, mode);

  // bypassCache 模式：不读缓存，直接调用 provider，结果也不写缓存
  if (!bypassCache) {
    // mock 模式：先尝试缓存
    if (mode === 'mock') {
      const cached = getCached<EventNewsResult>(cacheKey);
      if (cached) return withCacheStatus(cached, 'hit');
    } else {
      // real / fallback 模式：先尝试缓存
      const cached = getCached<EventNewsResult>(cacheKey);
      if (cached) return withCacheStatus(cached, 'hit');
    }
  }

  const cacheStatus: 'miss' | 'bypass' = bypassCache ? 'bypass' : 'miss';

  // mock 模式：不调用 AKShare
  if (mode === 'mock') {
    const result = await mockProvider.fetchNews(query);
    if (!bypassCache) {
      setCached(cacheKey, result);
    }
    return withCacheStatus(result, cacheStatus);
  }

  try {
    const result = await akshareNewsProvider.fetchNews(query);
    if (!bypassCache) {
      setCached(cacheKey, result);
    }
    return withCacheStatus(result, cacheStatus);
  } catch (err) {
    // real 模式：直接返回错误，不降级
    if (mode === 'real') {
      throw err;
    }

    // fallback 模式：降级到 Mock，但必须显示明确的降级原因
    const reason = err instanceof Error ? err.message : '未知错误';
    const mockResult = await mockProvider.fetchNews(query);

    // 将 Mock 结果的 dataMode 标记为 fallback
    // acquisitionProvider 和 upstreamPlatform 保持 mock 标识，不冒充 AKShare
    const fallbackResult: EventNewsResult = {
      news: mockResult.news.map(n => ({ ...n, dataMode: 'fallback' as const })),
      meta: {
        ...mockResult.meta,
        dataMode: 'fallback',
        sourceLabel: 'Mock演示新闻(AKShare降级)',
        fallbackReason: `AKShare真实新闻暂时不可用，当前已降级为本地Mock数据。原因：${reason}`,
      },
    };
    if (!bypassCache) {
      setCached(cacheKey, fallbackResult);
    }
    return withCacheStatus(fallbackResult, cacheStatus);
  }
}
