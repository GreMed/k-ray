import { cninfoProvider } from './cninfoProvider';
import { mockProvider } from './mockProvider';
import { buildCacheKey, getCached, setCached } from './cache';
import type { AnnouncementQuery, AnnouncementResult, AnnouncementMode } from './types';
import { SanitizedError } from './types';

export type { AnnouncementQuery, AnnouncementResult, AnnouncementItem, AnnouncementCategory, AnnouncementSource, AnnouncementMode, AnnouncementVerificationStatus, AnnouncementResultMeta } from './types';
export { ValidationError, SanitizedError, CATEGORY_LABELS, CNINFO_OFFICIAL_DESCRIPTION } from './types';
export { mockProvider, cninfoProvider };
export { buildCacheKey, clearCache, _cacheSize } from './cache';
export { classifyAnnouncement } from './mockProvider';

export function getAnnouncementMode(): AnnouncementMode {
  const mode = process.env.ANNOUNCEMENT_DATA_MODE || 'mock';
  if (mode === 'mock' || mode === 'real' || mode === 'fallback') {
    return mode;
  }
  return 'mock';
}

export async function fetchAnnouncements(query: AnnouncementQuery): Promise<AnnouncementResult> {
  const mode = getAnnouncementMode();
  const cacheKey = buildCacheKey(query);

  if (mode === 'mock') {
    const cached = getCached(cacheKey);
    if (cached) return cached;
    const result = await mockProvider.fetchAnnouncements(query);
    setCached(cacheKey, result);
    return result;
  }

  // real / fallback 模式
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const result = await cninfoProvider.fetchAnnouncements(query);

    // unverified 结果不写入成功缓存
    if (result.meta.verificationStatus === 'unverified') {
      // real 模式：unverified 视为查询失败，返回错误
      if (mode === 'real') {
        throw new SanitizedError(
          '公告来源返回了无法验证的响应（无法确认查询确实针对目标股票），请稍后重试。',
        );
      }
      // fallback 模式：降级到 Mock
      const mockResult = await mockProvider.fetchAnnouncements(query);
      return {
        ...mockResult,
        meta: {
          ...mockResult.meta,
          sourceLabel: 'Mock演示来源(巨潮资讯降级)',
          fallbackReason:
            '巨潮资讯网返回了无法验证的响应（无法确认查询参数有效），当前已降级为本地Mock数据。',
        },
      };
    }

    // verified 结果才写入缓存
    setCached(cacheKey, result);
    return result;
  } catch (err) {
    if (mode === 'real') {
      throw err;
    }
    // fallback 模式：降级到 Mock
    const reason = err instanceof Error ? err.message : '未知错误';
    const mockResult = await mockProvider.fetchAnnouncements(query);
    const fallbackResult: AnnouncementResult = {
      ...mockResult,
      meta: {
        ...mockResult.meta,
        sourceLabel: 'Mock演示来源(巨潮资讯降级)',
        fallbackReason: `巨潮资讯网公告暂时不可用，当前已降级为本地Mock数据。原因：${reason}`,
      },
    };
    return fallbackResult;
  }
}
