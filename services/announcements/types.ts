export type AnnouncementSource = 'cninfo' | 'mock';

export type AnnouncementMode = 'mock' | 'real' | 'fallback';

export type AnnouncementCategory =
  | 'earnings'
  | 'dividend'
  | 'capital'
  | 'operation'
  | 'regulatory'
  | 'suspension'
  | 'other';

/**
 * 验证状态：
 * - verified: 真实结果已验证（来源返回了公告且每条 secCode 匹配目标股票）
 * - empty_verified: 预留状态，当前未启用（需来源提供可区分"确实无公告"与"查询无效"的机制）
 * - unavailable: 预留状态，当前未启用（当前网络错误等统一归入 unverified 降级路径）
 * - unverified: 响应成功但无法验证股票过滤（空响应、secCode 不匹配、有效公告为0等）
 */
export type AnnouncementVerificationStatus =
  | 'verified'
  | 'empty_verified'
  | 'unavailable'
  | 'unverified';

export interface AnnouncementItem {
  announcementId: string;
  stockCode: string;
  market: 'SH' | 'SZ';
  title: string;
  publishedAt: string;
  sourcePlatform: string;
  sourcePageUrl?: string;
  originalPdfUrl?: string;
  category: AnnouncementCategory;
  fetchedAt: string;
  isRealAnnouncement: boolean;
  rawPublishedAt: string;
  alignedTradingDate: string | null;
}

export interface AnnouncementQuery {
  stockCode: string;
  market: 'SH' | 'SZ';
  startDate: string;
  endDate: string;
}

export interface AnnouncementResultMeta {
  source: AnnouncementSource;
  sourceLabel: string;
  isRealAnnouncement: boolean;
  fetchedAt: string;
  total: number;
  fallbackReason?: string;
  verificationStatus: AnnouncementVerificationStatus;
}

export interface AnnouncementResult {
  announcements: AnnouncementItem[];
  meta: AnnouncementResultMeta;
}

export interface AnnouncementProvider {
  id: AnnouncementSource;
  label: string;
  fetchAnnouncements(query: AnnouncementQuery): Promise<AnnouncementResult>;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class SanitizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SanitizedError';
  }
}

export const CATEGORY_LABELS: Record<AnnouncementCategory, string> = {
  earnings: '业绩报告',
  dividend: '分红派息',
  capital: '资本运作',
  operation: '经营动态',
  regulatory: '监管合规',
  suspension: '停复牌',
  other: '其他',
};

/**
 * 巨潮资讯网官方表述：
 * "巨潮资讯网是深圳证券交易所法定信息披露平台。"
 */
export const CNINFO_OFFICIAL_DESCRIPTION = '巨潮资讯网是深圳证券交易所法定信息披露平台。';
