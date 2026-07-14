// K-Ray 第十阶段 A：Mock 新闻数据 Provider
// 仅返回明确标注的本地演示新闻，不冒充真实新闻
// Mock 数据不得把自己标记为真实 AKShare 数据
// acquisitionProvider 必须为 mock，upstreamPlatform 必须为 mock
// isRealEventCandidate 必须为 false
// Mock 数据必须根据当前查询股票生成主体，不能无论查询哪只股票都固定显示贵州茅台

import type { EventNewsDataProvider, EventNewsQuery, EventNewsResult, NewsEventCandidate } from './types';
import { verifyStockRelevance } from './stockRelevance';
import { generateNewsId, deduplicateNews, isValidUrl } from './newsDedup';

// 根据查询股票生成对应的 Mock 数据主体
function createMockNews(query: EventNewsQuery): NewsEventCandidate[] {
  const fetchedAt = new Date().toISOString();
  const { stockCode } = query;

  // 根据股票代码生成对应的 Mock 数据
  const mockData: Array<{
    title: string;
    excerpt: string;
    publishedAt: string;
    publisher: string;
    originalUrl: string;
  }> = [
    {
      // 主体明确的 verified 新闻
      title: `[Mock演示] ${getStockName(stockCode)}发布季度业绩报告`,
      excerpt: `这是本地开发验收样本中的Mock演示新闻，不代表真实新闻内容。仅用于验证页面渲染和数据流转。内容中提及${stockCode}。`,
      publishedAt: '2026-06-15 18:30:00',
      publisher: 'Mock演示来源',
      originalUrl: 'https://example.com/mock-news-1',
    },
    {
      // 多股汇总类 unverified 新闻
      title: '[Mock演示] 板块资金流一览，多只个股受到关注',
      excerpt: `这是本地开发验收样本中的Mock演示新闻，包含多个股票代码${stockCode}和000001，用于验证多股汇总类新闻的识别。标题为泛化汇总类，正文同时包含目标和其他股票代码。`,
      publishedAt: '2026-06-20 09:15:00',
      publisher: 'Mock演示来源',
      originalUrl: 'https://example.com/mock-news-2',
    },
    {
      // 其他公司新闻 unverified
      title: '[Mock演示] 某其他公司发布重大公告',
      excerpt: `这是本地开发验收样本中的Mock演示新闻，内容中包含其他股票代码300999，不包含目标股票代码，用于验证混入其他公司新闻的识别。`,
      publishedAt: '2026-06-22 14:00:00',
      publisher: 'Mock演示来源',
      originalUrl: 'https://example.com/mock-news-3',
    },
    {
      // 缺少链接的 unverified 新闻
      title: `[Mock演示] ${getStockName(stockCode)}相关行业动态`,
      excerpt: `这是本地开发验收样本中的Mock演示新闻，没有提供有效的原文链接，用于验证缺少链接时标记为unverified。内容中提及${stockCode}。`,
      publishedAt: '2026-06-25 10:30:00',
      publisher: 'Mock演示来源',
      originalUrl: '',
    },
    {
      // 仅正文提及的 unverified 新闻
      title: '[Mock演示] 某行业研究报告发布',
      excerpt: `这是本地开发验收样本中的Mock演示新闻，正文中提及${stockCode}，但标题不属于目标公司，用于验证仅正文提及时的处理。`,
      publishedAt: '2026-06-28 16:45:00',
      publisher: 'Mock演示来源',
      originalUrl: 'https://example.com/mock-news-5',
    },
  ];

  const candidates: NewsEventCandidate[] = mockData.map((item, index) => {
    const hasValidUrl = isValidUrl(item.originalUrl);
    const id = generateNewsId(item.originalUrl, item.title, item.publishedAt, item.publisher) || `mock:news:${query.stockCode}:${index}`;
    const relevance = verifyStockRelevance(
      item.title,
      item.excerpt,
      query.stockCode,
      hasValidUrl,
      query.market,
    );

    return {
      id,
      queryStockCode: query.stockCode,
      title: item.title,
      excerpt: item.excerpt,
      publishedAt: item.publishedAt,
      publisher: item.publisher,
      originalUrl: item.originalUrl,
      // Mock 数据必须明确标记为 mock，不得冒充 AKShare 或东方财富
      acquisitionProvider: 'mock' as const,
      upstreamPlatform: 'mock',
      matchedStockCodes: relevance.matchedStockCodes,
      stockRelevanceStatus: relevance.status,
      verificationReason: `[Mock] ${relevance.reason}（演示数据）`,
      dataMode: 'mock' as const,
      // Mock 数据 isRealEventCandidate 必须为 false
      isRealEventCandidate: false,
      isMultiStockSummary: relevance.isMultiStockSummary,
      fetchedAt,
    };
  });

  return deduplicateNews(candidates);
}

// 根据股票代码获取证券简称
function getStockName(stockCode: string): string {
  const names: Record<string, string> = {
    '600519': '贵州茅台',
    '000001': '平安银行',
    '300750': '宁德时代',
    '688981': '中芯国际',
  };
  return names[stockCode] || `股票${stockCode}`;
}

export const mockProvider: EventNewsDataProvider = {
  id: 'mock',
  label: 'Mock演示新闻(开发验收)',

  async fetchNews(query: EventNewsQuery): Promise<EventNewsResult> {
    const news = createMockNews(query);
    const fetchedAt = new Date().toISOString();

    const verifiedCount = news.filter(n => n.stockRelevanceStatus === 'verified').length;
    const unverifiedCount = news.filter(n => n.stockRelevanceStatus === 'unverified').length;
    const validUrlCount = news.filter(n => isValidUrl(n.originalUrl)).length;
    const invalidUrlCount = news.length - validUrlCount;
    const multiStockSummaryCount = news.filter(n => n.isMultiStockSummary).length;

    const sortedByTime = [...news].sort((a, b) =>
      a.publishedAt < b.publishedAt ? -1 : a.publishedAt > b.publishedAt ? 1 : 0,
    );

    return {
      news,
      meta: {
        provider: 'mock',
        upstreamPlatform: 'mock',
        sourceLabel: 'Mock演示新闻(开发验收)',
        dataMode: 'mock',
        isRealData: false,
        fetchedAt,
        totalCount: news.length,
        deduplicatedCount: news.length,
        verifiedCount,
        unverifiedCount,
        validUrlCount,
        invalidUrlCount,
        multiStockSummaryCount,
        earliestPublishedAt: sortedByTime.length > 0 ? sortedByTime[0].publishedAt : null,
        latestPublishedAt: sortedByTime.length > 0 ? sortedByTime[sortedByTime.length - 1].publishedAt : null,
        // cacheStatus 由 index.ts 的 withCacheStatus 覆盖，此处默认 miss
        cacheStatus: 'miss',
      },
    };
  },
};
