/**
 * K-Ray 第十阶段 A 验证脚本核心逻辑（单一共享实现）
 *
 * 本文件是验证器和测试共同使用的唯一来源。
 * verify_event_news.mjs 和 Jest 测试都必须从此文件导入：
 *   - checkRequiredFields
 *   - checkCacheStatus
 *   - calculateIdOverlap
 *   - isOverlapPass
 *
 * 使用 CommonJS 格式，确保 Node（.mjs 可导入 .cjs）和 Jest（默认 CommonJS）都能导入。
 */

'use strict';

/**
 * 检查必填字段
 * @param {object} result - 验证结果 { news: [], meta: {} }
 * @param {string} expectedMode - 预期模式 'mock' | 'real' | 'fallback'
 * @returns {string[]} 错误信息数组（空数组表示通过）
 */
function checkRequiredFields(result, expectedMode) {
  const errors = [];

  // ========== 结果级检查 ==========
  if (!Array.isArray(result.news)) {
    errors.push('news 必须是数组');
  }
  if (!result.meta || typeof result.meta !== 'object') {
    errors.push('meta 必须存在');
    return errors;
  }

  const meta = result.meta;

  // meta 数量字段必须是有限数字，不能为 NaN
  const requiredMetaNumbers = [
    'totalCount', 'deduplicatedCount', 'verifiedCount', 'unverifiedCount',
    'validUrlCount', 'invalidUrlCount', 'multiStockSummaryCount',
  ];
  for (const field of requiredMetaNumbers) {
    if (typeof meta[field] !== 'number' || !Number.isFinite(meta[field])) {
      errors.push(`meta.${field} 必须是有效数字`);
    }
  }

  // meta 字符串字段必须是非空字符串
  const requiredMetaStrings = [
    'provider', 'upstreamPlatform', 'sourceLabel', 'dataMode', 'fetchedAt',
  ];
  for (const field of requiredMetaStrings) {
    if (!meta[field] || typeof meta[field] !== 'string') {
      errors.push(`meta.${field} 必须存在且为非空字符串`);
    }
  }

  // isRealData 必须是布尔值
  if (typeof meta.isRealData !== 'boolean') {
    errors.push('meta.isRealData 必须是布尔值');
  }

  // cacheStatus 必须存在且为合法值
  if (!meta.cacheStatus || !['hit', 'miss', 'bypass'].includes(meta.cacheStatus)) {
    errors.push(`meta.cacheStatus 必须是 hit/miss/bypass，实际为 ${meta.cacheStatus}`);
  }

  // earliestPublishedAt/latestPublishedAt 可以是字符串或 null，但字段必须存在
  if (meta.earliestPublishedAt === undefined) {
    errors.push('meta.earliestPublishedAt 字段必须存在（可为字符串或 null）');
  } else if (meta.earliestPublishedAt !== null && typeof meta.earliestPublishedAt !== 'string') {
    errors.push('meta.earliestPublishedAt 必须是字符串或 null');
  }
  if (meta.latestPublishedAt === undefined) {
    errors.push('meta.latestPublishedAt 字段必须存在（可为字符串或 null）');
  } else if (meta.latestPublishedAt !== null && typeof meta.latestPublishedAt !== 'string') {
    errors.push('meta.latestPublishedAt 必须是字符串或 null');
  }

  // ========== 模式身份检查 ==========
  if (meta.dataMode !== expectedMode) {
    errors.push(`meta.dataMode=${meta.dataMode} 与预期 ${expectedMode} 不符`);
  }

  if (expectedMode === 'real') {
    if (!meta.isRealData) {
      errors.push('real 模式必须 isRealData=true');
    }
    if (meta.provider !== 'akshare') {
      errors.push(`real 模式 provider 必须为 akshare，实际为 ${meta.provider}`);
    }
    if (meta.upstreamPlatform !== 'eastmoney') {
      errors.push(`real 模式 upstreamPlatform 必须为 eastmoney，实际为 ${meta.upstreamPlatform}`);
    }
  }

  if (expectedMode === 'mock') {
    if (meta.provider !== 'mock') {
      errors.push(`mock 模式 provider 必须为 mock，实际为 ${meta.provider}`);
    }
    if (meta.isRealData) {
      errors.push('mock 模式 isRealData 必须为 false');
    }
  }

  if (expectedMode === 'fallback') {
    if (!meta.fallbackReason) {
      errors.push('fallback 模式必须有 fallbackReason');
    }
    if (meta.dataMode !== 'fallback') {
      errors.push(`fallback 模式 dataMode 必须为 fallback，实际为 ${meta.dataMode}`);
    }
  }

  // ========== 单条新闻必填字段检查 ==========
  const requiredNewsFields = [
    'id', 'queryStockCode', 'title', 'excerpt', 'publishedAt', 'publisher',
    'originalUrl', 'acquisitionProvider', 'upstreamPlatform',
    'matchedStockCodes', 'stockRelevanceStatus', 'verificationReason',
    'dataMode', 'isRealEventCandidate', 'fetchedAt',
  ];

  if (Array.isArray(result.news)) {
    for (let i = 0; i < result.news.length; i++) {
      const news = result.news[i];

      // 必填字段存在性检查
      for (const field of requiredNewsFields) {
        if (news[field] === undefined || news[field] === null) {
          errors.push(`news[${i}].${field} 必填字段缺失`);
        }
      }

      // matchedStockCodes 必须是数组
      if (news.matchedStockCodes !== undefined && news.matchedStockCodes !== null) {
        if (!Array.isArray(news.matchedStockCodes)) {
          errors.push(`news[${i}].matchedStockCodes 必须是数组`);
        }
      }

      // isRealEventCandidate 必须是布尔值
      if (news.isRealEventCandidate !== undefined && news.isRealEventCandidate !== null) {
        if (typeof news.isRealEventCandidate !== 'boolean') {
          errors.push(`news[${i}].isRealEventCandidate 必须是布尔值`);
        }
      }

      // stockRelevanceStatus 只能是 verified/unverified
      if (news.stockRelevanceStatus !== undefined && news.stockRelevanceStatus !== null) {
        if (!['verified', 'unverified'].includes(news.stockRelevanceStatus)) {
          errors.push(`news[${i}].stockRelevanceStatus 只能是 verified/unverified，实际为 ${news.stockRelevanceStatus}`);
        }
      }

      // dataMode 必须和当前结果模式一致
      if (news.dataMode !== undefined && news.dataMode !== null) {
        if (news.dataMode !== expectedMode) {
          errors.push(`news[${i}].dataMode=${news.dataMode} 与结果模式 ${expectedMode} 不一致`);
        }
      }

      // 模式身份检查
      if (expectedMode === 'real') {
        if (news.acquisitionProvider !== 'akshare') {
          errors.push(`real 模式 news[${i}].acquisitionProvider 必须为 akshare`);
        }
        if (news.upstreamPlatform !== 'eastmoney') {
          errors.push(`real 模式 news[${i}].upstreamPlatform 必须为 eastmoney`);
        }
        if (news.title && news.title.includes('[Mock')) {
          errors.push(`real 模式不得出现 Mock 标题: ${news.title}`);
        }
        if (news.publisher && news.publisher.includes('Mock')) {
          errors.push(`real 模式不得出现 Mock 来源: ${news.publisher}`);
        }
      }

      if (expectedMode === 'mock' || expectedMode === 'fallback') {
        if (news.isRealEventCandidate) {
          errors.push(`${expectedMode} 模式 news[${i}].isRealEventCandidate 必须为 false`);
        }
        if (news.acquisitionProvider === 'akshare') {
          errors.push(`${expectedMode} 模式 news[${i}].acquisitionProvider 不得为 akshare`);
        }
      }
    }
  }

  return errors;
}

/**
 * 检查 cacheStatus 必须为 bypass
 * @param {object} result - 验证结果
 * @returns {string[]} 错误信息数组
 */
function checkCacheStatus(result) {
  if (!result.meta || result.meta.cacheStatus !== 'bypass') {
    return [`cacheStatus 必须为 bypass（绕过缓存），实际为 ${result.meta?.cacheStatus}`];
  }
  return [];
}

/**
 * 计算两轮稳定 ID 重合数量和重合率
 * @param {object} round1 - 第一轮结果 { news: [{ id: string }] }
 * @param {object} round2 - 第二轮结果 { news: [{ id: string }] }
 * @returns {{ overlap: number, overlapRate: number }}
 */
function calculateIdOverlap(round1, round2) {
  const ids1 = new Set(round1.news.map(n => n.id));
  const ids2 = new Set(round2.news.map(n => n.id));
  let overlap = 0;
  for (const id of ids1) {
    if (ids2.has(id)) overlap++;
  }
  const maxCount = Math.max(ids1.size, ids2.size);
  const overlapRate = maxCount > 0 ? overlap / maxCount : 0;
  return { overlap, overlapRate };
}

/**
 * 判断 ID 重合率是否通过 80% 阈值
 * 两轮都为空时不触发失败（返回 true）
 * @param {{ overlap: number, overlapRate: number }} overlapResult
 * @param {number} round1Count - 第一轮新闻数量
 * @param {number} round2Count - 第二轮新闻数量
 * @returns {boolean} true 表示通过，false 表示失败
 */
function isOverlapPass(overlapResult, round1Count, round2Count) {
  // 两轮都为空时不触发失败
  if (round1Count === 0 && round2Count === 0) {
    return true;
  }
  return overlapResult.overlapRate >= 0.8;
}

module.exports = {
  checkRequiredFields,
  checkCacheStatus,
  calculateIdOverlap,
  isOverlapPass,
};
