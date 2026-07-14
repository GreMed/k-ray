// K-Ray 第十阶段 B：关键节点—事件候选关联服务
// 连接第九阶段关键股价节点与第十阶段 A 新闻候选来源
// 不修改第十阶段 A 已封板的新闻抓取和筛选逻辑

import { fetchEventNews, getEventNewsMode } from '../eventNews';
import type { EventNewsResult, NewsEventCandidate } from '../eventNews/types';
import type { NodeEventQuery, NodeEventCandidateResult, NodeEventCandidateMeta } from './types';
import { verifyStockRelevance } from '../eventNews/stockRelevance';
import { generateNewsId, isValidUrl } from '../eventNews/newsDedup';

// 默认检索窗口：节点日前后各 3 个自然日
const DEFAULT_WINDOW_DAYS = 3;

// 日期计算：返回 dateStr ± days 的 YYYY-MM-DD 字符串
function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// 将发布时间（YYYY-MM-DD HH:mm:ss 或 YYYY-MM-DD）转换为日期比较用的 YYYY-MM-DD
function parseDate(timeStr: string): string {
  return timeStr.slice(0, 10);
}

// 按节点日期窗口过滤新闻候选
function filterByDateWindow(
  news: NewsEventCandidate[],
  nodeDate: string,
  windowDays: number,
): NewsEventCandidate[] {
  const windowStart = shiftDate(nodeDate, -windowDays);
  const windowEnd = shiftDate(nodeDate, windowDays);

  return news.filter(item => {
    const publishDate = parseDate(item.publishedAt);
    return publishDate >= windowStart && publishDate <= windowEnd;
  });
}

// 按发布时间排序（升序）
function sortByPublishTime(news: NewsEventCandidate[]): NewsEventCandidate[] {
  return [...news].sort((a, b) =>
    a.publishedAt < b.publishedAt ? -1 : a.publishedAt > b.publishedAt ? 1 : 0,
  );
}

// 计算窗口内候选的统计信息
function computeStats(candidates: NewsEventCandidate[]) {
  const verifiedCount = candidates.filter(n => n.stockRelevanceStatus === 'verified').length;
  const unverifiedCount = candidates.filter(n => n.stockRelevanceStatus === 'unverified').length;
  const multiStockSummaryCount = candidates.filter(n => n.isMultiStockSummary).length;
  return { verifiedCount, unverifiedCount, multiStockSummaryCount };
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

// Mock 模式：生成节点日期附近的模拟候选新闻
// 不修改第十阶段 A 的 mockProvider，在此服务层独立生成
function generateMockNodeCandidates(query: NodeEventQuery): NodeEventCandidateResult {
  const fetchedAt = new Date().toISOString();
  const stockCode = query.stockCode;
  const stockName = getStockName(stockCode);
  const windowDays = query.windowDays ?? DEFAULT_WINDOW_DAYS;
  const nodeDate = query.nodeDate;

  // 生成节点日期附近的 Mock 候选
  const mockItems: Array<{
    title: string;
    excerpt: string;
    publishedAt: string;
    publisher: string;
    originalUrl: string;
  }> = [
    {
      // verified 候选：标题包含完整证券简称
      title: `[Mock] ${stockName}发布季度业绩报告`,
      excerpt: `这是节点事件候选的Mock演示数据。${stockName}（${stockCode}）发布季度业绩报告。不代表真实新闻，不构成涨跌原因或投资建议。`,
      publishedAt: `${shiftDate(nodeDate, -1)} 18:30:00`,
      publisher: 'Mock演示来源',
      originalUrl: 'https://example.com/mock-node-event-1',
    },
    {
      // unverified 候选：多股汇总
      title: `[Mock] 板块资金流一览，${stockName}等多股受到关注`,
      excerpt: `这是节点事件候选的Mock演示数据。板块资金流汇总，包含${stockCode}等多个股票代码。为多股汇总内容，需人工确认。`,
      publishedAt: `${nodeDate} 09:15:00`,
      publisher: 'Mock演示来源',
      originalUrl: 'https://example.com/mock-node-event-2',
    },
    {
      // unverified 候选：仅正文提及
      title: '[Mock] 某行业研究报告发布',
      excerpt: `这是节点事件候选的Mock演示数据。正文中提及${stockCode}，但标题不属于目标公司，需人工确认。`,
      publishedAt: `${shiftDate(nodeDate, 2)} 14:00:00`,
      publisher: 'Mock演示来源',
      originalUrl: 'https://example.com/mock-node-event-3',
    },
  ];

  const candidates: NewsEventCandidate[] = mockItems.map((item, index) => {
    const hasValidUrl = isValidUrl(item.originalUrl);
    const id = generateNewsId(item.originalUrl, item.title, item.publishedAt, item.publisher) || `mock:node-event:${stockCode}:${index}`;
    const relevance = verifyStockRelevance(
      item.title,
      item.excerpt,
      stockCode,
      hasValidUrl,
      query.market,
    );

    return {
      id,
      queryStockCode: stockCode,
      title: item.title,
      excerpt: item.excerpt,
      publishedAt: item.publishedAt,
      publisher: item.publisher,
      originalUrl: item.originalUrl,
      acquisitionProvider: 'mock' as const,
      upstreamPlatform: 'mock',
      matchedStockCodes: relevance.matchedStockCodes,
      stockRelevanceStatus: relevance.status,
      verificationReason: `[Mock] ${relevance.reason}`,
      dataMode: 'mock' as const,
      isRealEventCandidate: false,
      isMultiStockSummary: relevance.isMultiStockSummary,
      fetchedAt,
    };
  });

  const sorted = sortByPublishTime(candidates);
  const stats = computeStats(sorted);

  const meta: NodeEventCandidateMeta = {
    dataMode: 'mock',
    provider: 'mock',
    upstreamPlatform: 'mock',
    sourceLabel: 'Mock演示候选(开发验收)',
    isRealData: false,
    fetchedAt,
    nodeDate,
    windowStart: shiftDate(nodeDate, -windowDays),
    windowEnd: shiftDate(nodeDate, windowDays),
    totalCount: sorted.length,
    verifiedCount: stats.verifiedCount,
    unverifiedCount: stats.unverifiedCount,
    multiStockSummaryCount: stats.multiStockSummaryCount,
    originalTotalCount: sorted.length,
    cacheStatus: 'miss',
  };

  return { candidates: sorted, meta };
}

// 将 EventNewsResult 转换为 NodeEventCandidateResult
function transformToNodeCandidates(
  newsResult: EventNewsResult,
  query: NodeEventQuery,
): NodeEventCandidateResult {
  const windowDays = query.windowDays ?? DEFAULT_WINDOW_DAYS;
  const nodeDate = query.nodeDate;

  const filtered = filterByDateWindow(newsResult.news, nodeDate, windowDays);
  const sorted = sortByPublishTime(filtered);
  const stats = computeStats(sorted);

  const meta: NodeEventCandidateMeta = {
    dataMode: newsResult.meta.dataMode,
    provider: newsResult.meta.provider,
    upstreamPlatform: newsResult.meta.upstreamPlatform,
    sourceLabel: newsResult.meta.sourceLabel,
    isRealData: newsResult.meta.isRealData,
    fetchedAt: newsResult.meta.fetchedAt,
    nodeDate,
    windowStart: shiftDate(nodeDate, -windowDays),
    windowEnd: shiftDate(nodeDate, windowDays),
    totalCount: sorted.length,
    verifiedCount: stats.verifiedCount,
    unverifiedCount: stats.unverifiedCount,
    multiStockSummaryCount: stats.multiStockSummaryCount,
    originalTotalCount: newsResult.news.length,
    fallbackReason: newsResult.meta.fallbackReason,
    cacheStatus: newsResult.meta.cacheStatus,
  };

  return { candidates: sorted, meta };
}

// 获取关键节点的事件候选
// 不修改第十阶段 A 的新闻抓取和筛选逻辑，仅在其上层做日期窗口过滤
export async function fetchNodeEventCandidates(
  query: NodeEventQuery,
  options?: { bypassCache?: boolean },
): Promise<NodeEventCandidateResult> {
  const mode = getEventNewsMode();

  // Mock 模式：在 nodeEvents 服务层生成节点日期附近的候选
  // 不调用第十阶段 A 的 mockProvider，避免日期不匹配问题
  if (mode === 'mock') {
    return generateMockNodeCandidates(query);
  }

  // Real / Fallback 模式：调用第十阶段 A 的 fetchEventNews，然后按日期窗口过滤
  const newsResult = await fetchEventNews(
    { stockCode: query.stockCode, market: query.market },
    { bypassCache: options?.bypassCache },
  );

  return transformToNodeCandidates(newsResult, query);
}

// 导出辅助函数供测试使用
export const _testHelpers = {
  shiftDate,
  parseDate,
  filterByDateWindow,
  sortByPublishTime,
  computeStats,
  DEFAULT_WINDOW_DAYS,
};
