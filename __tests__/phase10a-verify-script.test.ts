/**
 * K-Ray 第十阶段 A 验证脚本自动化测试
 *
 * 证明以下失败场景退出码为 1：
 *   1. 模式不符退出 1（meta.dataMode 与预期不符）
 *   2. 必填字段缺失退出 1
 *   3. cacheStatus 不是 bypass 时退出 1
 *   4. ID 重合率不足时退出 1
 *
 * 直接测试 scripts/verifyCore.cjs 中的共享实现，
 * verify_event_news.mjs 和本测试使用同一份代码，不存在重复实现。
 *
 * @jest-environment node
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { checkRequiredFields, checkCacheStatus, calculateIdOverlap, isOverlapPass } = require('../scripts/verifyCore.cjs');

// 构造合法的 real 模式结果（用于作为基准修改）
function makeValidRealResult() {
  return {
    news: [
      {
        id: 'news:url:https://example.com/1',
        queryStockCode: '600519',
        title: '贵州茅台发布季度报告',
        excerpt: '内容...',
        publishedAt: '2026-06-15 18:30:00',
        publisher: '证券时报',
        originalUrl: 'https://example.com/1',
        acquisitionProvider: 'akshare',
        upstreamPlatform: 'eastmoney',
        matchedStockCodes: ['600519'],
        stockRelevanceStatus: 'verified',
        verificationReason: '标题中明确包含目标股票完整证券简称',
        dataMode: 'real',
        isRealEventCandidate: true,
        isMultiStockSummary: false,
        fetchedAt: '2026-07-10T10:00:00.000Z',
      },
    ],
    meta: {
      provider: 'akshare',
      upstreamPlatform: 'eastmoney',
      sourceLabel: 'AKShare新闻候选(东方财富上游)',
      dataMode: 'real',
      isRealData: true,
      fetchedAt: '2026-07-10T10:00:00.000Z',
      totalCount: 1,
      deduplicatedCount: 1,
      verifiedCount: 1,
      unverifiedCount: 0,
      validUrlCount: 1,
      invalidUrlCount: 0,
      multiStockSummaryCount: 0,
      earliestPublishedAt: '2026-06-15 18:30:00',
      latestPublishedAt: '2026-06-15 18:30:00',
      cacheStatus: 'bypass' as const,
    },
  };
}

// 构造合法的 mock 模式结果
function makeValidMockResult() {
  return {
    news: [
      {
        id: 'news:url:https://example.com/mock-1',
        queryStockCode: '600519',
        title: '[Mock演示] 贵州茅台发布季度业绩报告',
        excerpt: 'Mock 内容...',
        publishedAt: '2026-06-15 18:30:00',
        publisher: 'Mock演示来源',
        originalUrl: 'https://example.com/mock-1',
        acquisitionProvider: 'mock',
        upstreamPlatform: 'mock',
        matchedStockCodes: ['600519'],
        stockRelevanceStatus: 'verified',
        verificationReason: '[Mock] 标题中明确包含目标股票完整证券简称',
        dataMode: 'mock',
        isRealEventCandidate: false,
        isMultiStockSummary: false,
        fetchedAt: '2026-07-10T10:00:00.000Z',
      },
    ],
    meta: {
      provider: 'mock',
      upstreamPlatform: 'mock',
      sourceLabel: 'Mock演示新闻(开发验收)',
      dataMode: 'mock',
      isRealData: false,
      fetchedAt: '2026-07-10T10:00:00.000Z',
      totalCount: 1,
      deduplicatedCount: 1,
      verifiedCount: 1,
      unverifiedCount: 0,
      validUrlCount: 1,
      invalidUrlCount: 0,
      multiStockSummaryCount: 0,
      earliestPublishedAt: '2026-06-15 18:30:00',
      latestPublishedAt: '2026-06-15 18:30:00',
      cacheStatus: 'bypass' as const,
    },
  };
}

describe('第十阶段 A 验证脚本自动化测试（封板修复版）', () => {
  // ========== 1. 模式不符退出 1 ==========
  describe('1. 模式不符必须报告错误', () => {
    test('期望 real 模式但实际为 mock 时，checkRequiredFields 必须返回错误', () => {
      const result = makeValidMockResult(); // 实际是 mock
      const errors = checkRequiredFields(result, 'real'); // 期望 real

      expect(errors.length).toBeGreaterThan(0);
      // 应包含模式不符的错误
      expect(errors.some(e => e.includes('dataMode') && e.includes('real'))).toBe(true);
    });

    test('期望 mock 模式但实际为 real 时，checkRequiredFields 必须返回错误', () => {
      const result = makeValidRealResult(); // 实际是 real
      const errors = checkRequiredFields(result, 'mock'); // 期望 mock

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('dataMode') && e.includes('mock'))).toBe(true);
    });

    test('期望 real 但 isRealData=false 时，必须返回错误', () => {
      const result = makeValidRealResult();
      result.meta.isRealData = false;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('isRealData'))).toBe(true);
    });

    test('期望 real 但 provider 不是 akshare 时，必须返回错误', () => {
      const result = makeValidRealResult();
      result.meta.provider = 'mock';
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('provider') && e.includes('akshare'))).toBe(true);
    });

    test('期望 real 但 upstreamPlatform 不是 eastmoney 时，必须返回错误', () => {
      const result = makeValidRealResult();
      result.meta.upstreamPlatform = 'mock';
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('upstreamPlatform') && e.includes('eastmoney'))).toBe(true);
    });

    test('real 模式出现 Mock 标题时，必须返回错误', () => {
      const result = makeValidRealResult();
      result.news[0].title = '[Mock] 测试标题';
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('Mock 标题'))).toBe(true);
    });

    test('real 模式出现 Mock 来源时，必须返回错误', () => {
      const result = makeValidRealResult();
      result.news[0].publisher = 'Mock演示来源';
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('Mock 来源'))).toBe(true);
    });

    test('期望 fallback 但缺少 fallbackReason 时，必须返回错误', () => {
      const result = makeValidMockResult();
      result.meta.dataMode = 'fallback';
      const errors = checkRequiredFields(result, 'fallback');

      expect(errors.some(e => e.includes('fallbackReason'))).toBe(true);
    });

    test('mock 模式 isRealEventCandidate=true 时，必须返回错误', () => {
      const result = makeValidMockResult();
      result.news[0].isRealEventCandidate = true;
      const errors = checkRequiredFields(result, 'mock');

      expect(errors.some(e => e.includes('isRealEventCandidate') && e.includes('false'))).toBe(true);
    });
  });

  // ========== 2. 必填字段缺失退出 1 ==========
  describe('2. 必填字段缺失必须报告错误', () => {
    test('news 不是数组时，必须返回错误', () => {
      const result = makeValidRealResult();
      (result as { news: unknown }).news = 'not-an-array';
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('news 必须是数组'))).toBe(true);
    });

    test('meta 不存在时，必须返回错误', () => {
      const result = makeValidRealResult();
      (result as { meta: unknown }).meta = null;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('meta 必须存在'))).toBe(true);
    });

    test('meta.totalCount 不是数字时，必须返回错误', () => {
      const result = makeValidRealResult();
      (result.meta as { totalCount: unknown }).totalCount = 'abc';
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('totalCount') && e.includes('有效数字'))).toBe(true);
    });

    test('meta.deduplicatedCount 是 NaN 时，必须返回错误', () => {
      const result = makeValidRealResult();
      result.meta.deduplicatedCount = NaN;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('deduplicatedCount') && e.includes('有效数字'))).toBe(true);
    });

    test('meta.verifiedCount 缺失时，必须返回错误', () => {
      const result = makeValidRealResult();
      delete (result.meta as { verifiedCount?: number }).verifiedCount;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('verifiedCount') && e.includes('有效数字'))).toBe(true);
    });

    test('meta.unverifiedCount 缺失时，必须返回错误', () => {
      const result = makeValidRealResult();
      delete (result.meta as { unverifiedCount?: number }).unverifiedCount;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('unverifiedCount') && e.includes('有效数字'))).toBe(true);
    });

    test('meta.multiStockSummaryCount 缺失时，必须返回错误', () => {
      const result = makeValidRealResult();
      delete (result.meta as { multiStockSummaryCount?: number }).multiStockSummaryCount;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('multiStockSummaryCount') && e.includes('有效数字'))).toBe(true);
    });

    test('meta.validUrlCount 缺失时，必须返回错误', () => {
      const result = makeValidRealResult();
      delete (result.meta as { validUrlCount?: number }).validUrlCount;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('validUrlCount') && e.includes('有效数字'))).toBe(true);
    });

    test('meta.invalidUrlCount 缺失时，必须返回错误', () => {
      const result = makeValidRealResult();
      delete (result.meta as { invalidUrlCount?: number }).invalidUrlCount;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('invalidUrlCount') && e.includes('有效数字'))).toBe(true);
    });

    test('meta.sourceLabel 缺失时，必须返回错误', () => {
      const result = makeValidRealResult();
      delete (result.meta as { sourceLabel?: string }).sourceLabel;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('sourceLabel') && e.includes('字符串'))).toBe(true);
    });

    test('meta.earliestPublishedAt 缺失时，必须返回错误', () => {
      const result = makeValidRealResult();
      delete (result.meta as { earliestPublishedAt?: string | null }).earliestPublishedAt;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('earliestPublishedAt') && e.includes('必须存在'))).toBe(true);
    });

    test('meta.latestPublishedAt 缺失时，必须返回错误', () => {
      const result = makeValidRealResult();
      delete (result.meta as { latestPublishedAt?: string | null }).latestPublishedAt;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('latestPublishedAt') && e.includes('必须存在'))).toBe(true);
    });

    test('meta.earliestPublishedAt 为 null 时，不应返回错误', () => {
      const result = makeValidRealResult();
      result.meta.earliestPublishedAt = null;
      result.meta.latestPublishedAt = null;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('earliestPublishedAt'))).toBe(false);
      expect(errors.some(e => e.includes('latestPublishedAt'))).toBe(false);
    });

    test('meta.dataMode 缺失时，必须返回错误', () => {
      const result = makeValidRealResult();
      delete (result.meta as { dataMode?: string }).dataMode;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('dataMode') && e.includes('字符串'))).toBe(true);
    });

    test('meta.provider 缺失时，必须返回错误', () => {
      const result = makeValidRealResult();
      delete (result.meta as { provider?: string }).provider;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('provider') && e.includes('字符串'))).toBe(true);
    });

    test('meta.upstreamPlatform 缺失时，必须返回错误', () => {
      const result = makeValidRealResult();
      delete (result.meta as { upstreamPlatform?: string }).upstreamPlatform;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('upstreamPlatform') && e.includes('字符串'))).toBe(true);
    });

    test('meta.fetchedAt 缺失时，必须返回错误', () => {
      const result = makeValidRealResult();
      delete (result.meta as { fetchedAt?: string }).fetchedAt;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('fetchedAt') && e.includes('字符串'))).toBe(true);
    });

    test('meta.isRealData 不是布尔值时，必须返回错误', () => {
      const result = makeValidRealResult();
      (result.meta as { isRealData: unknown }).isRealData = 'true';
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('isRealData') && e.includes('布尔值'))).toBe(true);
    });

    test('单条新闻缺少 id 时，必须返回错误', () => {
      const result = makeValidRealResult();
      delete (result.news[0] as { id?: string }).id;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('news[0].id') && e.includes('必填字段缺失'))).toBe(true);
    });

    test('单条新闻缺少 title 时，必须返回错误', () => {
      const result = makeValidRealResult();
      delete (result.news[0] as { title?: string }).title;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('news[0].title') && e.includes('必填字段缺失'))).toBe(true);
    });

    test('单条新闻缺少 publishedAt 时，必须返回错误', () => {
      const result = makeValidRealResult();
      delete (result.news[0] as { publishedAt?: string }).publishedAt;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('news[0].publishedAt') && e.includes('必填字段缺失'))).toBe(true);
    });

    test('单条新闻缺少 publisher 时，必须返回错误', () => {
      const result = makeValidRealResult();
      delete (result.news[0] as { publisher?: string }).publisher;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('news[0].publisher') && e.includes('必填字段缺失'))).toBe(true);
    });

    test('单条新闻缺少 originalUrl 时，必须返回错误', () => {
      const result = makeValidRealResult();
      delete (result.news[0] as { originalUrl?: string }).originalUrl;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('news[0].originalUrl') && e.includes('必填字段缺失'))).toBe(true);
    });

    test('单条新闻缺少 acquisitionProvider 时，必须返回错误', () => {
      const result = makeValidRealResult();
      delete (result.news[0] as { acquisitionProvider?: string }).acquisitionProvider;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('news[0].acquisitionProvider') && e.includes('必填字段缺失'))).toBe(true);
    });

    test('单条新闻缺少 upstreamPlatform 时，必须返回错误', () => {
      const result = makeValidRealResult();
      delete (result.news[0] as { upstreamPlatform?: string }).upstreamPlatform;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('news[0].upstreamPlatform') && e.includes('必填字段缺失'))).toBe(true);
    });

    test('单条新闻缺少 stockRelevanceStatus 时，必须返回错误', () => {
      const result = makeValidRealResult();
      delete (result.news[0] as { stockRelevanceStatus?: string }).stockRelevanceStatus;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('news[0].stockRelevanceStatus') && e.includes('必填字段缺失'))).toBe(true);
    });

    test('单条新闻缺少 verificationReason 时，必须返回错误', () => {
      const result = makeValidRealResult();
      delete (result.news[0] as { verificationReason?: string }).verificationReason;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('news[0].verificationReason') && e.includes('必填字段缺失'))).toBe(true);
    });

    test('单条新闻缺少 dataMode 时，必须返回错误', () => {
      const result = makeValidRealResult();
      delete (result.news[0] as { dataMode?: string }).dataMode;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('news[0].dataMode') && e.includes('必填字段缺失'))).toBe(true);
    });

    test('单条新闻缺少 isRealEventCandidate 时，必须返回错误', () => {
      const result = makeValidRealResult();
      delete (result.news[0] as { isRealEventCandidate?: boolean }).isRealEventCandidate;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('news[0].isRealEventCandidate') && e.includes('必填字段缺失'))).toBe(true);
    });

    test('单条新闻缺少 fetchedAt 时，必须返回错误', () => {
      const result = makeValidRealResult();
      delete (result.news[0] as { fetchedAt?: string }).fetchedAt;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('news[0].fetchedAt') && e.includes('必填字段缺失'))).toBe(true);
    });

    test('单条新闻缺少 queryStockCode 时，必须返回错误', () => {
      const result = makeValidRealResult();
      delete (result.news[0] as { queryStockCode?: string }).queryStockCode;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('news[0].queryStockCode') && e.includes('必填字段缺失'))).toBe(true);
    });

    test('单条新闻缺少 excerpt 时，必须返回错误', () => {
      const result = makeValidRealResult();
      delete (result.news[0] as { excerpt?: string }).excerpt;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('news[0].excerpt') && e.includes('必填字段缺失'))).toBe(true);
    });

    test('单条新闻缺少 matchedStockCodes 时，必须返回错误', () => {
      const result = makeValidRealResult();
      delete (result.news[0] as { matchedStockCodes?: string[] }).matchedStockCodes;
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('news[0].matchedStockCodes') && e.includes('必填字段缺失'))).toBe(true);
    });

    test('单条新闻 matchedStockCodes 不是数组时，必须返回错误', () => {
      const result = makeValidRealResult();
      (result.news[0] as { matchedStockCodes: unknown }).matchedStockCodes = 'not-array';
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('news[0].matchedStockCodes') && e.includes('数组'))).toBe(true);
    });

    test('单条新闻 isRealEventCandidate 不是布尔值时，必须返回错误', () => {
      const result = makeValidRealResult();
      (result.news[0] as { isRealEventCandidate: unknown }).isRealEventCandidate = 'true';
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('news[0].isRealEventCandidate') && e.includes('布尔值'))).toBe(true);
    });

    test('单条新闻 stockRelevanceStatus 非法时，必须返回错误', () => {
      const result = makeValidRealResult();
      (result.news[0] as { stockRelevanceStatus: string }).stockRelevanceStatus = 'invalid';
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('news[0].stockRelevanceStatus') && e.includes('verified/unverified'))).toBe(true);
    });

    test('单条新闻 dataMode 与结果模式不一致时，必须返回错误', () => {
      const result = makeValidRealResult();
      (result.news[0] as { dataMode: string }).dataMode = 'mock';
      const errors = checkRequiredFields(result, 'real');

      expect(errors.some(e => e.includes('news[0].dataMode') && e.includes('不一致'))).toBe(true);
    });

    test('合法 real 结果通过检查时，不应返回任何错误', () => {
      const result = makeValidRealResult();
      const errors = checkRequiredFields(result, 'real');
      expect(errors).toHaveLength(0);
    });

    test('合法 mock 结果通过检查时，不应返回任何错误', () => {
      const result = makeValidMockResult();
      const errors = checkRequiredFields(result, 'mock');
      expect(errors).toHaveLength(0);
    });
  });

  // ========== 3. cacheStatus 不是 bypass 时退出 1 ==========
  describe('3. cacheStatus 不是 bypass 时必须报告错误', () => {
    test('cacheStatus 为 hit 时，必须返回错误', () => {
      const result = makeValidRealResult();
      result.meta.cacheStatus = 'hit';
      const errors = checkCacheStatus(result);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('bypass');
      expect(errors[0]).toContain('hit');
    });

    test('cacheStatus 为 miss 时，必须返回错误', () => {
      const result = makeValidRealResult();
      result.meta.cacheStatus = 'miss';
      const errors = checkCacheStatus(result);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('bypass');
      expect(errors[0]).toContain('miss');
    });

    test('cacheStatus 缺失时，必须返回错误', () => {
      const result = makeValidRealResult();
      delete (result.meta as { cacheStatus?: string }).cacheStatus;
      const errors = checkCacheStatus(result);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('bypass');
    });

    test('cacheStatus 为 bypass 时，不应返回错误', () => {
      const result = makeValidRealResult();
      result.meta.cacheStatus = 'bypass';
      const errors = checkCacheStatus(result);
      expect(errors).toHaveLength(0);
    });

    test('cacheStatus 为非法值时，必须返回错误', () => {
      const result = makeValidRealResult();
      (result.meta as { cacheStatus: string }).cacheStatus = 'invalid';
      const errors = checkCacheStatus(result);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('bypass');
      expect(errors[0]).toContain('invalid');
    });
  });

  // ========== 4. ID 重合率不足时退出 1 ==========
  describe('4. ID 重合率不足时必须报告失败', () => {
    test('两轮完全相同（100% 重合率）时，overlapRate 应为 1.0', () => {
      const round1 = makeValidRealResult();
      const round2 = makeValidRealResult();
      const { overlap, overlapRate } = calculateIdOverlap(round1, round2);

      expect(overlap).toBe(1);
      expect(overlapRate).toBe(1.0);
    });

    test('两轮完全不同（0% 重合率）时，overlapRate 应为 0', () => {
      const round1 = makeValidRealResult();
      const round2 = makeValidRealResult();
      round2.news[0].id = 'news:url:https://example.com/different';
      const { overlap, overlapRate } = calculateIdOverlap(round1, round2);

      expect(overlap).toBe(0);
      expect(overlapRate).toBe(0);
    });

    test('两轮 50% 重合率时，overlapRate 应为 0.5（低于 80% 阈值）', () => {
      const round1 = {
        news: [
          { id: 'id-1' },
          { id: 'id-2' },
        ],
      };
      const round2 = {
        news: [
          { id: 'id-1' },
          { id: 'id-3' },
        ],
      };
      const { overlap, overlapRate } = calculateIdOverlap(round1, round2);

      expect(overlap).toBe(1);
      expect(overlapRate).toBe(0.5);
      expect(overlapRate).toBeLessThan(0.8);
    });

    test('两轮 80% 重合率时，overlapRate 应为 0.8（达到阈值）', () => {
      const round1 = {
        news: [
          { id: 'id-1' },
          { id: 'id-2' },
          { id: 'id-3' },
          { id: 'id-4' },
          { id: 'id-5' },
        ],
      };
      const round2 = {
        news: [
          { id: 'id-1' },
          { id: 'id-2' },
          { id: 'id-3' },
          { id: 'id-4' },
          { id: 'id-6' },
        ],
      };
      const { overlap, overlapRate } = calculateIdOverlap(round1, round2);

      expect(overlap).toBe(4);
      expect(overlapRate).toBe(0.8);
      expect(overlapRate).toBeGreaterThanOrEqual(0.8);
    });

    test('两轮 90% 重合率时，overlapRate 应为 0.9（超过阈值）', () => {
      const round1 = {
        news: [
          { id: 'id-1' },
          { id: 'id-2' },
          { id: 'id-3' },
          { id: 'id-4' },
          { id: 'id-5' },
          { id: 'id-6' },
          { id: 'id-7' },
          { id: 'id-8' },
          { id: 'id-9' },
          { id: 'id-10' },
        ],
      };
      const round2 = {
        news: [
          { id: 'id-1' },
          { id: 'id-2' },
          { id: 'id-3' },
          { id: 'id-4' },
          { id: 'id-5' },
          { id: 'id-6' },
          { id: 'id-7' },
          { id: 'id-8' },
          { id: 'id-9' },
          { id: 'id-11' },
        ],
      };
      const { overlap, overlapRate } = calculateIdOverlap(round1, round2);

      expect(overlap).toBe(9);
      expect(overlapRate).toBe(0.9);
      expect(overlapRate).toBeGreaterThanOrEqual(0.8);
    });

    test('两轮数量不同时，以最大数量为分母', () => {
      const round1 = {
        news: [
          { id: 'id-1' },
          { id: 'id-2' },
          { id: 'id-3' },
        ],
      };
      const round2 = {
        news: [
          { id: 'id-1' },
          { id: 'id-2' },
          { id: 'id-3' },
          { id: 'id-4' },
          { id: 'id-5' },
        ],
      };
      const { overlap, overlapRate } = calculateIdOverlap(round1, round2);

      // 3 个重合，最大数量 5，重合率 3/5 = 0.6
      expect(overlap).toBe(3);
      expect(overlapRate).toBe(0.6);
      expect(overlapRate).toBeLessThan(0.8);
    });

    test('两轮都为空时，overlapRate 应为 0（不触发失败）', () => {
      const round1 = { news: [] };
      const round2 = { news: [] };
      const { overlap, overlapRate } = calculateIdOverlap(round1, round2);

      expect(overlap).toBe(0);
      expect(overlapRate).toBe(0);
    });
  });

  // ========== 5. 模拟验证脚本整体失败场景 ==========
  describe('5. 验证脚本失败场景综合判断', () => {
    test('模式不符 + 必填字段缺失 + cacheStatus 非 bypass 同时存在时，所有错误都应被收集', () => {
      const result = makeValidMockResult(); // 实际是 mock
      // 期望 real
      // 同时删除必填字段
      delete (result.meta as { fetchedAt?: string }).fetchedAt;
      result.meta.cacheStatus = 'hit';

      const fieldErrors = checkRequiredFields(result, 'real');
      const cacheErrors = checkCacheStatus(result);

      expect(fieldErrors.length).toBeGreaterThan(0);
      expect(cacheErrors.length).toBeGreaterThan(0);
      // 模式不符错误
      expect(fieldErrors.some(e => e.includes('dataMode'))).toBe(true);
      // 必填字段缺失错误
      expect(fieldErrors.some(e => e.includes('fetchedAt'))).toBe(true);
      // cacheStatus 错误
      expect(cacheErrors[0]).toContain('bypass');
    });

    test('ID 重合率低于 80% 时，isOverlapPass 必须返回 false', () => {
      const round1 = {
        news: Array.from({ length: 10 }, (_, i) => ({ id: `id-${i}` })),
      };
      const round2 = {
        news: Array.from({ length: 10 }, (_, i) => ({ id: `id-${i + 5}` })),
      };
      const overlapResult = calculateIdOverlap(round1, round2);

      // id-5 到 id-9 重合，5 个重合
      expect(overlapResult.overlap).toBe(5);
      expect(overlapResult.overlapRate).toBe(0.5);
      expect(overlapResult.overlapRate).toBeLessThan(0.8);
      // isOverlapPass 必须返回 false
      expect(isOverlapPass(overlapResult, round1.news.length, round2.news.length)).toBe(false);
    });

    test('ID 重合率等于 80% 时，isOverlapPass 必须返回 true', () => {
      const round1 = {
        news: Array.from({ length: 5 }, (_, i) => ({ id: `id-${i}` })),
      };
      const round2 = {
        news: [
          { id: 'id-0' }, { id: 'id-1' }, { id: 'id-2' }, { id: 'id-3' },
          { id: 'id-different' },
        ],
      };
      const overlapResult = calculateIdOverlap(round1, round2);

      expect(overlapResult.overlapRate).toBe(0.8);
      expect(isOverlapPass(overlapResult, round1.news.length, round2.news.length)).toBe(true);
    });

    test('两轮都为空时，isOverlapPass 必须返回 true（不触发失败）', () => {
      const round1 = { news: [] };
      const round2 = { news: [] };
      const overlapResult = calculateIdOverlap(round1, round2);

      expect(overlapResult.overlapRate).toBe(0);
      expect(isOverlapPass(overlapResult, 0, 0)).toBe(true);
    });
  });
});
