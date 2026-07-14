import type { AnnouncementProvider, AnnouncementResult, AnnouncementQuery, AnnouncementItem, AnnouncementCategory } from './types';

// Mock数据不使用 cninfo 域名，不构造看起来真实的公告ID或PDF链接
// sourcePlatform 显示 "Mock演示来源"
// sourcePageUrl 和 originalPdfUrl 留空
const MOCK_ANNOUNCEMENTS_600519: Omit<AnnouncementItem, 'fetchedAt' | 'isRealAnnouncement'>[] = [
  {
    announcementId: 'mock:600519:2024-01-08:earnings-001',
    stockCode: '600519',
    market: 'SH',
    title: '贵州茅台2023年度业绩预告',
    publishedAt: '2024-01-08 16:30:00',
    sourcePlatform: 'Mock演示来源',
    sourcePageUrl: '',
    originalPdfUrl: '',
    category: 'earnings',
    rawPublishedAt: '2024-01-08 16:30:00',
    alignedTradingDate: null,
  },
  {
    announcementId: 'mock:600519:2024-01-15:dividend-001',
    stockCode: '600519',
    market: 'SH',
    title: '贵州茅台关于2023年度利润分配预案的公告',
    publishedAt: '2024-01-15 18:00:00',
    sourcePlatform: 'Mock演示来源',
    sourcePageUrl: '',
    originalPdfUrl: '',
    category: 'dividend',
    rawPublishedAt: '2024-01-15 18:00:00',
    alignedTradingDate: null,
  },
  {
    announcementId: 'mock:600519:2024-02-02:earnings-002',
    stockCode: '600519',
    market: 'SH',
    title: '贵州茅台2023年年度报告',
    publishedAt: '2024-02-02 20:00:00',
    sourcePlatform: 'Mock演示来源',
    sourcePageUrl: '',
    originalPdfUrl: '',
    category: 'earnings',
    rawPublishedAt: '2024-02-02 20:00:00',
    alignedTradingDate: null,
  },
  {
    announcementId: 'mock:600519:2024-02-18:capital-001',
    stockCode: '600519',
    market: 'SH',
    title: '贵州茅台关于回购股份的进展公告',
    publishedAt: '2024-02-18 16:00:00',
    sourcePlatform: 'Mock演示来源',
    sourcePageUrl: '',
    originalPdfUrl: '',
    category: 'capital',
    rawPublishedAt: '2024-02-18 16:00:00',
    alignedTradingDate: null,
  },
  {
    announcementId: 'mock:600519:2024-03-01:operation-001',
    stockCode: '600519',
    market: 'SH',
    title: '贵州茅台关于公司主要经营数据的公告',
    publishedAt: '2024-03-01 17:30:00',
    sourcePlatform: 'Mock演示来源',
    sourcePageUrl: '',
    originalPdfUrl: '',
    category: 'operation',
    rawPublishedAt: '2024-03-01 17:30:00',
    alignedTradingDate: null,
  },
  {
    announcementId: 'mock:600519:2024-03-15:regulatory-001',
    stockCode: '600519',
    market: 'SH',
    title: '贵州茅台关于收到上海证券交易所监管工作函的公告',
    publishedAt: '2024-03-15 19:00:00',
    sourcePlatform: 'Mock演示来源',
    sourcePageUrl: '',
    originalPdfUrl: '',
    category: 'regulatory',
    rawPublishedAt: '2024-03-15 19:00:00',
    alignedTradingDate: null,
  },
];

const MOCK_ANNOUNCEMENTS_000001: Omit<AnnouncementItem, 'fetchedAt' | 'isRealAnnouncement'>[] = [
  {
    announcementId: 'mock:000001:2024-01-10:earnings-001',
    stockCode: '000001',
    market: 'SZ',
    title: '平安银行2023年度业绩快报',
    publishedAt: '2024-01-10 17:00:00',
    sourcePlatform: 'Mock演示来源',
    sourcePageUrl: '',
    originalPdfUrl: '',
    category: 'earnings',
    rawPublishedAt: '2024-01-10 17:00:00',
    alignedTradingDate: null,
  },
  {
    announcementId: 'mock:000001:2024-01-20:dividend-001',
    stockCode: '000001',
    market: 'SZ',
    title: '平安银行关于2023年度利润分配预案的公告',
    publishedAt: '2024-01-20 18:30:00',
    sourcePlatform: 'Mock演示来源',
    sourcePageUrl: '',
    originalPdfUrl: '',
    category: 'dividend',
    rawPublishedAt: '2024-01-20 18:30:00',
    alignedTradingDate: null,
  },
  {
    announcementId: 'mock:000001:2024-02-28:earnings-002',
    stockCode: '000001',
    market: 'SZ',
    title: '平安银行2023年年度报告摘要',
    publishedAt: '2024-02-28 20:30:00',
    sourcePlatform: 'Mock演示来源',
    sourcePageUrl: '',
    originalPdfUrl: '',
    category: 'earnings',
    rawPublishedAt: '2024-02-28 20:30:00',
    alignedTradingDate: null,
  },
  {
    announcementId: 'mock:000001:2024-03-10:capital-001',
    stockCode: '000001',
    market: 'SZ',
    title: '平安银行关于股东增减持股份的提示性公告',
    publishedAt: '2024-03-10 16:30:00',
    sourcePlatform: 'Mock演示来源',
    sourcePageUrl: '',
    originalPdfUrl: '',
    category: 'capital',
    rawPublishedAt: '2024-03-10 16:30:00',
    alignedTradingDate: null,
  },
];

function getMockData(stockCode: string, market: 'SH' | 'SZ'): Omit<AnnouncementItem, 'fetchedAt' | 'isRealAnnouncement'>[] {
  if (stockCode === '600519' && market === 'SH') {
    return MOCK_ANNOUNCEMENTS_600519;
  }
  if (stockCode === '000001' && market === 'SZ') {
    return MOCK_ANNOUNCEMENTS_000001;
  }
  return [];
}

function filterByDate(
  items: Omit<AnnouncementItem, 'fetchedAt' | 'isRealAnnouncement'>[],
  startDate: string,
  endDate: string,
): Omit<AnnouncementItem, 'fetchedAt' | 'isRealAnnouncement'>[] {
  return items.filter(item => {
    const dateStr = item.publishedAt.slice(0, 10);
    return dateStr >= startDate && dateStr <= endDate;
  });
}

function sortByPublishedAtDesc(
  items: Omit<AnnouncementItem, 'fetchedAt' | 'isRealAnnouncement'>[],
): Omit<AnnouncementItem, 'fetchedAt' | 'isRealAnnouncement'>[] {
  return [...items].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

function deduplicate(
  items: Omit<AnnouncementItem, 'fetchedAt' | 'isRealAnnouncement'>[],
): Omit<AnnouncementItem, 'fetchedAt' | 'isRealAnnouncement'>[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.announcementId)) return false;
    seen.add(item.announcementId);
    return true;
  });
}

export function classifyAnnouncement(title: string): AnnouncementCategory {
  const t = title.toLowerCase();

  if (/(业绩|年报|季报|半年报|三季报|一季报|业绩预告|业绩快报|年度报告|半年度报告|季度报告)/.test(t)) {
    return 'earnings';
  }
  if (/(分红|派息|利润分配|送股|转增)/.test(t)) {
    return 'dividend';
  }
  if (/(回购|增持|减持|增减持|重组|定增|增发|配股|可转债|股权激励|非公开发行)/.test(t)) {
    return 'capital';
  }
  if (/(合同|项目|中标|经营数据|投产|竣工|战略合作|订单)/.test(t)) {
    return 'operation';
  }
  if (/(问询|处罚|监管|警示|风险警示|风险提示|诉讼|仲裁|立案|整改|监管工作函)/.test(t)) {
    return 'regulatory';
  }
  if (/(停牌|复牌|暂停上市|恢复上市)/.test(t)) {
    return 'suspension';
  }
  return 'other';
}

export const mockProvider: AnnouncementProvider = {
  id: 'mock',
  label: 'Mock演示来源',

  async fetchAnnouncements(query: AnnouncementQuery): Promise<AnnouncementResult> {
    const rawItems = getMockData(query.stockCode, query.market);
    const filtered = filterByDate(rawItems, query.startDate, query.endDate);
    const deduped = deduplicate(filtered);
    const sorted = sortByPublishedAtDesc(deduped);

    const now = new Date().toISOString();
    const announcements: AnnouncementItem[] = sorted.map(item => ({
      ...item,
      isRealAnnouncement: false,
      fetchedAt: now,
    }));

    return {
      announcements,
      meta: {
        source: 'mock',
        sourceLabel: 'Mock演示来源',
        isRealAnnouncement: false,
        fetchedAt: now,
        total: announcements.length,
        verificationStatus: 'unverified',
      },
    };
  },
};
