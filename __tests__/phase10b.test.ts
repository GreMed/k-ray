/**
 * K-Ray 第十阶段 B 测试 - 关键节点—事件候选关联服务
 * 覆盖：日期窗口过滤、shiftDate、排序、统计、Mock 模式、Real/Fallback 模式、无候选场景
 *
 * @jest-environment node
 */

import { fetchNodeEventCandidates, _testHelpers } from '@/services/nodeEvents';
import { fetchEventNews, getEventNewsMode } from '@/services/eventNews';
import type { NewsEventCandidate, EventNewsResult, EventNewsResultMeta } from '@/services/eventNews/types';
import type { NodeEventQuery } from '@/services/nodeEvents/types';

// Mock 第十阶段 A 的 eventNews 入口，仅控制模式与 fetchEventNews 返回
// verifyStockRelevance / generateNewsId / isValidUrl 仍使用真实实现
jest.mock('@/services/eventNews', () => ({
  fetchEventNews: jest.fn(),
  getEventNewsMode: jest.fn(),
}));

const mockedFetchEventNews = fetchEventNews as jest.MockedFunction<typeof fetchEventNews>;
const mockedGetEventNewsMode = getEventNewsMode as jest.MockedFunction<typeof getEventNewsMode>;

const { shiftDate, filterByDateWindow, sortByPublishTime, computeStats, DEFAULT_WINDOW_DAYS } = _testHelpers;

// ========== 辅助函数 ==========

function makeNodeQuery(overrides: Partial<NodeEventQuery> = {}): NodeEventQuery {
  return {
    stockCode: '600519',
    market: 'SH',
    nodeDate: '2024-01-15',
    ...overrides,
  };
}

function makeCandidate(overrides: Partial<NewsEventCandidate> = {}): NewsEventCandidate {
  return {
    id: `test-id-${Math.random().toString(36).slice(2)}`,
    queryStockCode: '600519',
    title: '测试标题',
    excerpt: '测试内容',
    publishedAt: '2024-01-15 10:00:00',
    publisher: '测试来源',
    originalUrl: 'https://example.com/test',
    acquisitionProvider: 'akshare',
    upstreamPlatform: 'eastmoney',
    matchedStockCodes: ['600519'],
    stockRelevanceStatus: 'verified',
    verificationReason: '测试原因',
    dataMode: 'real',
    isRealEventCandidate: true,
    fetchedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeEventNewsResult(
  news: NewsEventCandidate[],
  overrides: Partial<EventNewsResultMeta> = {},
): EventNewsResult {
  return {
    news,
    meta: {
      provider: 'akshare',
      upstreamPlatform: 'eastmoney',
      sourceLabel: 'AKShare',
      dataMode: 'real',
      isRealData: true,
      fetchedAt: new Date().toISOString(),
      totalCount: news.length,
      deduplicatedCount: news.length,
      verifiedCount: news.filter(n => n.stockRelevanceStatus === 'verified').length,
      unverifiedCount: news.filter(n => n.stockRelevanceStatus === 'unverified').length,
      validUrlCount: news.length,
      invalidUrlCount: 0,
      multiStockSummaryCount: news.filter(n => n.isMultiStockSummary).length,
      earliestPublishedAt: news.length > 0 ? news[0].publishedAt : null,
      latestPublishedAt: news.length > 0 ? news[news.length - 1].publishedAt : null,
      cacheStatus: 'miss',
      ...overrides,
    },
  };
}

describe('第十阶段 B 测试 - 关键节点—事件候选关联服务', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetEventNewsMode.mockReturnValue('mock');
  });

  // ========== 1. 日期窗口过滤 ==========
  describe('1. 日期窗口过滤 filterByDateWindow', () => {
    test('正确过滤窗口内的新闻', () => {
      const news = [
        makeCandidate({ id: 'a', publishedAt: '2024-01-13 10:00:00' }),
        makeCandidate({ id: 'b', publishedAt: '2024-01-15 10:00:00' }),
        makeCandidate({ id: 'c', publishedAt: '2024-01-18 10:00:00' }),
      ];
      // nodeDate=2024-01-15, windowDays=3 → [2024-01-12, 2024-01-18]
      const result = filterByDateWindow(news, '2024-01-15', 3);
      expect(result).toHaveLength(3);
      expect(result.map(n => n.id)).toEqual(['a', 'b', 'c']);
    });

    test('窗口外的新闻被排除', () => {
      const news = [
        makeCandidate({ id: 'before', publishedAt: '2024-01-11 10:00:00' }),
        makeCandidate({ id: 'in', publishedAt: '2024-01-13 10:00:00' }),
        makeCandidate({ id: 'after', publishedAt: '2024-01-19 10:00:00' }),
      ];
      const result = filterByDateWindow(news, '2024-01-15', 3);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('in');
    });

    test('默认窗口为 3 天', () => {
      expect(DEFAULT_WINDOW_DAYS).toBe(3);
    });

    test('自定义窗口（windowDays=5）正确过滤', () => {
      const news = [
        makeCandidate({ id: 'edge-start', publishedAt: '2024-01-10 10:00:00' }), // windowDays=5 → start=01-10
        makeCandidate({ id: 'before', publishedAt: '2024-01-09 10:00:00' }),
        makeCandidate({ id: 'edge-end', publishedAt: '2024-01-20 10:00:00' }), // end=01-20
        makeCandidate({ id: 'after', publishedAt: '2024-01-21 10:00:00' }),
      ];
      const result = filterByDateWindow(news, '2024-01-15', 5);
      expect(result).toHaveLength(2);
      expect(result.map(n => n.id)).toEqual(['edge-start', 'edge-end']);
    });

    test('窗口边界（含端点）被保留', () => {
      const news = [
        makeCandidate({ id: 'start', publishedAt: '2024-01-12 00:00:00' }), // windowStart
        makeCandidate({ id: 'end', publishedAt: '2024-01-18 23:59:59' }), // windowEnd
      ];
      const result = filterByDateWindow(news, '2024-01-15', 3);
      expect(result).toHaveLength(2);
    });

    test('仅日期格式（YYYY-MM-DD）的发布时间也能正确过滤', () => {
      const news = [
        makeCandidate({ id: 'in', publishedAt: '2024-01-14' }),
        makeCandidate({ id: 'out', publishedAt: '2024-01-20' }),
      ];
      const result = filterByDateWindow(news, '2024-01-15', 3);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('in');
    });
  });

  // ========== 2. shiftDate 函数 ==========
  describe('2. shiftDate 函数', () => {
    test('正确计算日期偏移', () => {
      expect(shiftDate('2024-01-15', 3)).toBe('2024-01-18');
      expect(shiftDate('2024-01-15', -3)).toBe('2024-01-12');
      expect(shiftDate('2024-01-15', 0)).toBe('2024-01-15');
      expect(shiftDate('2024-01-15', 1)).toBe('2024-01-16');
      expect(shiftDate('2024-01-15', -1)).toBe('2024-01-14');
    });

    test('处理跨月', () => {
      expect(shiftDate('2024-01-31', 1)).toBe('2024-02-01');
      expect(shiftDate('2024-03-01', -1)).toBe('2024-02-29'); // 2024 闰年
      expect(shiftDate('2024-05-01', -1)).toBe('2024-04-30');
      expect(shiftDate('2023-03-01', -1)).toBe('2023-02-28'); // 2023 平年
    });

    test('处理跨年', () => {
      expect(shiftDate('2024-12-31', 1)).toBe('2025-01-01');
      expect(shiftDate('2025-01-01', -1)).toBe('2024-12-31');
      expect(shiftDate('2024-12-30', 3)).toBe('2025-01-02');
    });
  });

  // ========== 3. sortByPublishTime ==========
  describe('3. sortByPublishTime', () => {
    test('按发布时间升序排列', () => {
      const news = [
        makeCandidate({ id: 'mid', publishedAt: '2024-01-15 10:00:00' }),
        makeCandidate({ id: 'early', publishedAt: '2024-01-13 10:00:00' }),
        makeCandidate({ id: 'late', publishedAt: '2024-01-17 10:00:00' }),
      ];
      const result = sortByPublishTime(news);
      expect(result.map(n => n.id)).toEqual(['early', 'mid', 'late']);
    });

    test('相同发布时间保持稳定顺序', () => {
      const news = [
        makeCandidate({ id: 'a', publishedAt: '2024-01-15 10:00:00' }),
        makeCandidate({ id: 'b', publishedAt: '2024-01-15 10:00:00' }),
      ];
      const result = sortByPublishTime(news);
      expect(result).toHaveLength(2);
    });

    test('不修改原数组', () => {
      const news = [
        makeCandidate({ id: 'a', publishedAt: '2024-01-15 10:00:00' }),
        makeCandidate({ id: 'b', publishedAt: '2024-01-13 10:00:00' }),
      ];
      const originalOrder = news.map(n => n.id);
      sortByPublishTime(news);
      expect(news.map(n => n.id)).toEqual(originalOrder);
    });
  });

  // ========== 4. computeStats ==========
  describe('4. computeStats', () => {
    test('正确计算 verifiedCount/unverifiedCount/multiStockSummaryCount', () => {
      const candidates = [
        makeCandidate({ stockRelevanceStatus: 'verified', isMultiStockSummary: false }),
        makeCandidate({ stockRelevanceStatus: 'unverified', isMultiStockSummary: true }),
        makeCandidate({ stockRelevanceStatus: 'unverified', isMultiStockSummary: false }),
      ];
      const stats = computeStats(candidates);
      expect(stats.verifiedCount).toBe(1);
      expect(stats.unverifiedCount).toBe(2);
      expect(stats.multiStockSummaryCount).toBe(1);
    });

    test('空数组返回全 0', () => {
      const stats = computeStats([]);
      expect(stats.verifiedCount).toBe(0);
      expect(stats.unverifiedCount).toBe(0);
      expect(stats.multiStockSummaryCount).toBe(0);
    });

    test('全部 verified 时 unverifiedCount 为 0', () => {
      const candidates = [
        makeCandidate({ stockRelevanceStatus: 'verified', isMultiStockSummary: false }),
        makeCandidate({ stockRelevanceStatus: 'verified', isMultiStockSummary: false }),
      ];
      const stats = computeStats(candidates);
      expect(stats.verifiedCount).toBe(2);
      expect(stats.unverifiedCount).toBe(0);
      expect(stats.multiStockSummaryCount).toBe(0);
    });
  });

  // ========== 5. Mock 模式 ==========
  describe('5. Mock 模式 generateMockNodeCandidates', () => {
    beforeEach(() => {
      mockedGetEventNewsMode.mockReturnValue('mock');
    });

    test('fetchNodeEventCandidates 在 mock 模式下生成节点日期附近的候选', async () => {
      const result = await fetchNodeEventCandidates(makeNodeQuery());
      expect(result.candidates).toHaveLength(3);
      // mock 模式不调用 fetchEventNews
      expect(mockedFetchEventNews).not.toHaveBeenCalled();
    });

    test('候选新闻的 publishedAt 在窗口范围内', async () => {
      const nodeDate = '2024-01-15';
      const result = await fetchNodeEventCandidates(makeNodeQuery({ nodeDate }));
      const windowStart = shiftDate(nodeDate, -3);
      const windowEnd = shiftDate(nodeDate, 3);
      result.candidates.forEach(c => {
        const publishDate = c.publishedAt.slice(0, 10);
        expect(publishDate >= windowStart).toBe(true);
        expect(publishDate <= windowEnd).toBe(true);
      });
    });

    test('verified 候选的标题包含完整证券简称', async () => {
      const result = await fetchNodeEventCandidates(makeNodeQuery({ stockCode: '600519' }));
      const verified = result.candidates.find(c => c.stockRelevanceStatus === 'verified');
      expect(verified).toBeDefined();
      expect(verified!.title).toContain('贵州茅台');
    });

    test('unverified 候选包括多股汇总和仅正文提及', async () => {
      const result = await fetchNodeEventCandidates(makeNodeQuery({ stockCode: '600519' }));
      const unverified = result.candidates.filter(c => c.stockRelevanceStatus === 'unverified');
      expect(unverified.length).toBeGreaterThanOrEqual(2);

      // 多股汇总候选
      const multiStock = unverified.find(c => c.isMultiStockSummary === true);
      expect(multiStock).toBeDefined();

      // 仅正文提及候选
      const bodyOnly = unverified.find(c => c.verificationReason.includes('仅正文提及'));
      expect(bodyOnly).toBeDefined();
    });

    test('所有候选的 isRealEventCandidate 为 false', async () => {
      const result = await fetchNodeEventCandidates(makeNodeQuery());
      result.candidates.forEach(c => {
        expect(c.isRealEventCandidate).toBe(false);
      });
    });

    test('所有候选的 dataMode 为 mock', async () => {
      const result = await fetchNodeEventCandidates(makeNodeQuery());
      result.candidates.forEach(c => {
        expect(c.dataMode).toBe('mock');
      });
    });

    test('meta 中的 windowStart/windowEnd 正确计算', async () => {
      const nodeDate = '2024-01-15';
      const result = await fetchNodeEventCandidates(makeNodeQuery({ nodeDate }));
      expect(result.meta.windowStart).toBe(shiftDate(nodeDate, -3));
      expect(result.meta.windowEnd).toBe(shiftDate(nodeDate, 3));
      expect(result.meta.nodeDate).toBe(nodeDate);
    });

    test('自定义 windowDays 时 meta 窗口正确计算', async () => {
      const nodeDate = '2024-01-15';
      const result = await fetchNodeEventCandidates(makeNodeQuery({ nodeDate, windowDays: 5 }));
      expect(result.meta.windowStart).toBe(shiftDate(nodeDate, -5));
      expect(result.meta.windowEnd).toBe(shiftDate(nodeDate, 5));
    });

    test('不同股票代码生成对应公司名称', async () => {
      const cases: Array<{ code: string; market: 'SH' | 'SZ'; name: string }> = [
        { code: '600519', market: 'SH', name: '贵州茅台' },
        { code: '000001', market: 'SZ', name: '平安银行' },
        { code: '300750', market: 'SZ', name: '宁德时代' },
        { code: '688981', market: 'SH', name: '中芯国际' },
      ];
      for (const { code, market, name } of cases) {
        const result = await fetchNodeEventCandidates(makeNodeQuery({ stockCode: code, market }));
        const verified = result.candidates.find(c => c.stockRelevanceStatus === 'verified');
        expect(verified).toBeDefined();
        expect(verified!.title).toContain(name);
      }
    });

    test('meta 中 dataMode/provider/isRealData 为 mock 标识', async () => {
      const result = await fetchNodeEventCandidates(makeNodeQuery());
      expect(result.meta.dataMode).toBe('mock');
      expect(result.meta.provider).toBe('mock');
      expect(result.meta.isRealData).toBe(false);
      expect(result.meta.upstreamPlatform).toBe('mock');
    });

    test('meta 统计计数正确', async () => {
      const result = await fetchNodeEventCandidates(makeNodeQuery({ stockCode: '600519' }));
      expect(result.meta.totalCount).toBe(3);
      expect(result.meta.verifiedCount).toBe(1);
      expect(result.meta.unverifiedCount).toBe(2);
      expect(result.meta.multiStockSummaryCount).toBe(1);
      expect(result.meta.originalTotalCount).toBe(3);
    });
  });

  // ========== 6. Real/Fallback 模式 ==========
  describe('6. Real/Fallback 模式', () => {
    beforeEach(() => {
      mockedGetEventNewsMode.mockReturnValue('real');
    });

    test('通过 mock fetchEventNews 测试日期窗口过滤', async () => {
      const news = [
        makeCandidate({ id: 'out-before', publishedAt: '2024-01-10 10:00:00' }),
        makeCandidate({ id: 'in-1', publishedAt: '2024-01-13 10:00:00' }),
        makeCandidate({ id: 'in-2', publishedAt: '2024-01-15 10:00:00' }),
        makeCandidate({ id: 'in-3', publishedAt: '2024-01-17 10:00:00' }),
        makeCandidate({ id: 'out-after', publishedAt: '2024-01-20 10:00:00' }),
      ];
      mockedFetchEventNews.mockResolvedValue(makeEventNewsResult(news));

      const result = await fetchNodeEventCandidates(makeNodeQuery({ nodeDate: '2024-01-15' }));
      expect(result.candidates).toHaveLength(3);
      expect(result.candidates.map(c => c.id)).toEqual(['in-1', 'in-2', 'in-3']);
    });

    test('候选按发布时间排序', async () => {
      const news = [
        makeCandidate({ id: 'c', publishedAt: '2024-01-17 10:00:00' }),
        makeCandidate({ id: 'a', publishedAt: '2024-01-13 10:00:00' }),
        makeCandidate({ id: 'b', publishedAt: '2024-01-15 10:00:00' }),
      ];
      mockedFetchEventNews.mockResolvedValue(makeEventNewsResult(news));

      const result = await fetchNodeEventCandidates(makeNodeQuery({ nodeDate: '2024-01-15' }));
      expect(result.candidates.map(c => c.id)).toEqual(['a', 'b', 'c']);
    });

    test('originalTotalCount 反映窗口外+窗口内的总数', async () => {
      const news = [
        makeCandidate({ publishedAt: '2024-01-10 10:00:00' }),
        makeCandidate({ publishedAt: '2024-01-13 10:00:00' }),
        makeCandidate({ publishedAt: '2024-01-15 10:00:00' }),
        makeCandidate({ publishedAt: '2024-01-20 10:00:00' }),
      ];
      mockedFetchEventNews.mockResolvedValue(makeEventNewsResult(news));

      const result = await fetchNodeEventCandidates(makeNodeQuery({ nodeDate: '2024-01-15' }));
      expect(result.meta.originalTotalCount).toBe(4);
      expect(result.meta.totalCount).toBe(2);
    });

    test('meta 正确传递 dataMode/provider/isRealData', async () => {
      const news = [makeCandidate({ publishedAt: '2024-01-15 10:00:00' })];
      mockedFetchEventNews.mockResolvedValue(
        makeEventNewsResult(news, {
          dataMode: 'real',
          provider: 'akshare',
          isRealData: true,
          upstreamPlatform: 'eastmoney',
          sourceLabel: 'AKShare',
        }),
      );

      const result = await fetchNodeEventCandidates(makeNodeQuery());
      expect(result.meta.dataMode).toBe('real');
      expect(result.meta.provider).toBe('akshare');
      expect(result.meta.isRealData).toBe(true);
      expect(result.meta.upstreamPlatform).toBe('eastmoney');
      expect(result.meta.sourceLabel).toBe('AKShare');
    });

    test('fetchEventNews 被调用时传入正确的查询参数', async () => {
      mockedFetchEventNews.mockResolvedValue(makeEventNewsResult([]));
      const query = makeNodeQuery({ stockCode: '000001', market: 'SZ', nodeDate: '2024-03-10' });
      await fetchNodeEventCandidates(query);
      expect(mockedFetchEventNews).toHaveBeenCalledWith(
        { stockCode: '000001', market: 'SZ' },
        expect.any(Object),
      );
    });

    test('自定义 windowDays 正确过滤 real 模式数据', async () => {
      const news = [
        makeCandidate({ id: 'edge-start', publishedAt: '2024-01-10 10:00:00' }),
        makeCandidate({ id: 'before', publishedAt: '2024-01-09 10:00:00' }),
        makeCandidate({ id: 'edge-end', publishedAt: '2024-01-20 10:00:00' }),
        makeCandidate({ id: 'after', publishedAt: '2024-01-21 10:00:00' }),
      ];
      mockedFetchEventNews.mockResolvedValue(makeEventNewsResult(news));

      const result = await fetchNodeEventCandidates(
        makeNodeQuery({ nodeDate: '2024-01-15', windowDays: 5 }),
      );
      expect(result.candidates).toHaveLength(2);
      expect(result.meta.windowStart).toBe('2024-01-10');
      expect(result.meta.windowEnd).toBe('2024-01-20');
    });

    test('fallback 模式正确传递 fallbackReason 和 dataMode', async () => {
      mockedGetEventNewsMode.mockReturnValue('fallback');
      const news = [makeCandidate({ publishedAt: '2024-01-15 10:00:00', dataMode: 'fallback' })];
      mockedFetchEventNews.mockResolvedValue(
        makeEventNewsResult(news, {
          dataMode: 'fallback',
          provider: 'mock',
          isRealData: false,
          sourceLabel: 'Mock演示新闻(AKShare降级)',
          fallbackReason: 'AKShare真实新闻暂时不可用',
        }),
      );

      const result = await fetchNodeEventCandidates(makeNodeQuery());
      expect(result.meta.dataMode).toBe('fallback');
      expect(result.meta.isRealData).toBe(false);
      expect(result.meta.fallbackReason).toBe('AKShare真实新闻暂时不可用');
    });
  });

  // ========== 7. 无候选场景 ==========
  describe('7. 无候选场景', () => {
    beforeEach(() => {
      mockedGetEventNewsMode.mockReturnValue('real');
    });

    test('窗口内没有新闻时返回空数组', async () => {
      const news = [
        makeCandidate({ publishedAt: '2024-01-01 10:00:00' }),
        makeCandidate({ publishedAt: '2024-02-01 10:00:00' }),
      ];
      mockedFetchEventNews.mockResolvedValue(makeEventNewsResult(news));

      const result = await fetchNodeEventCandidates(makeNodeQuery({ nodeDate: '2024-01-15' }));
      expect(result.candidates).toHaveLength(0);
    });

    test('meta.totalCount 为 0', async () => {
      const news = [
        makeCandidate({ publishedAt: '2024-01-01 10:00:00' }),
        makeCandidate({ publishedAt: '2024-02-01 10:00:00' }),
      ];
      mockedFetchEventNews.mockResolvedValue(makeEventNewsResult(news));

      const result = await fetchNodeEventCandidates(makeNodeQuery({ nodeDate: '2024-01-15' }));
      expect(result.meta.totalCount).toBe(0);
      expect(result.meta.verifiedCount).toBe(0);
      expect(result.meta.unverifiedCount).toBe(0);
      expect(result.meta.multiStockSummaryCount).toBe(0);
    });

    test('originalTotalCount 仍反映原始新闻总数', async () => {
      const news = [
        makeCandidate({ publishedAt: '2024-01-01 10:00:00' }),
        makeCandidate({ publishedAt: '2024-02-01 10:00:00' }),
      ];
      mockedFetchEventNews.mockResolvedValue(makeEventNewsResult(news));

      const result = await fetchNodeEventCandidates(makeNodeQuery({ nodeDate: '2024-01-15' }));
      expect(result.meta.originalTotalCount).toBe(2);
    });

    test('fetchEventNews 返回空数组时也无候选', async () => {
      mockedFetchEventNews.mockResolvedValue(makeEventNewsResult([]));
      const result = await fetchNodeEventCandidates(makeNodeQuery());
      expect(result.candidates).toHaveLength(0);
      expect(result.meta.totalCount).toBe(0);
      expect(result.meta.originalTotalCount).toBe(0);
    });

    test('无候选时 meta 窗口边界仍正确', async () => {
      mockedFetchEventNews.mockResolvedValue(makeEventNewsResult([]));
      const result = await fetchNodeEventCandidates(makeNodeQuery({ nodeDate: '2024-01-15' }));
      expect(result.meta.windowStart).toBe('2024-01-12');
      expect(result.meta.windowEnd).toBe('2024-01-18');
      expect(result.meta.nodeDate).toBe('2024-01-15');
    });
  });
});
