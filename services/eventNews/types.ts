// K-Ray 第十阶段 A：新闻候选数据服务类型定义
// 独立于公告服务和行情服务，不复用已冻结的类型

// 数据获取模式
export type EventNewsMode = 'mock' | 'real' | 'fallback';

// 数据获取工具
export type EventNewsProvider = 'akshare' | 'mock';

// 股票相关性验证状态
export type StockRelevanceStatus = 'verified' | 'unverified';

// 新闻事件候选
// 仅采集接口返回的原始字段，不自行生成内容
export interface NewsEventCandidate {
  // 稳定 ID：优先使用规范化后的真实原文 URL，否则使用标题+时间+来源的稳定哈希
  id: string;
  // 用户查询的标准股票代码
  queryStockCode: string;
  // 新闻标题
  title: string;
  // 接口直接返回的短内容，禁止自行生成
  excerpt: string;
  // 发布时间
  publishedAt: string;
  // 文章来源或发布方
  publisher: string;
  // 接口真实返回的原文地址
  originalUrl: string;
  // 数据获取工具标识：real 模式为 akshare，mock/fallback 模式为 mock
  acquisitionProvider: EventNewsProvider;
  // 上游平台标识：real 模式为 eastmoney，mock/fallback 模式为 mock
  upstreamPlatform: string;
  // 从标题或内容中实际识别到的股票代码
  matchedStockCodes: string[];
  // 股票相关性验证状态
  stockRelevanceStatus: StockRelevanceStatus;
  // 为什么确认或无法确认与目标股票有关
  verificationReason: string;
  // 数据模式
  dataMode: EventNewsMode;
  // 是否为真实事件候选（mock/fallback 必须为 false）
  isRealEventCandidate: boolean;
  // 是否为多股汇总候选（不能确认目标股票是新闻主体）
  isMultiStockSummary?: boolean;
  // 获取时间
  fetchedAt: string;
}

// 查询参数
export interface EventNewsQuery {
  stockCode: string;
  market: 'SH' | 'SZ';
}

// 结果元信息
export interface EventNewsResultMeta {
  // 数据获取工具
  provider: EventNewsProvider;
  // 上游平台
  upstreamPlatform: string;
  // 来源标签
  sourceLabel: string;
  // 数据模式
  dataMode: EventNewsMode;
  // 是否为真实数据
  isRealData: boolean;
  // 获取时间
  fetchedAt: string;
  // 原始返回数量
  totalCount: number;
  // 去重后数量
  deduplicatedCount: number;
  // verified 数量
  verifiedCount: number;
  // unverified 数量
  unverifiedCount: number;
  // 有效原文链接数量
  validUrlCount: number;
  // 无效或缺失链接数量
  invalidUrlCount: number;
  // 多股汇总候选数量（不能确认目标股票是新闻主体）
  multiStockSummaryCount: number;
  // 最早新闻时间
  earliestPublishedAt: string | null;
  // 最晚新闻时间
  latestPublishedAt: string | null;
  // 降级原因（fallback 模式）
  fallbackReason?: string;
  // 缓存状态：hit=命中缓存、miss=未命中缓存、bypass=绕过缓存（仅 dev/验证环境）
  cacheStatus: 'hit' | 'miss' | 'bypass';
}

// 查询结果
export interface EventNewsResult {
  news: NewsEventCandidate[];
  meta: EventNewsResultMeta;
}

// Provider 接口
export interface EventNewsDataProvider {
  id: EventNewsProvider;
  label: string;
  fetchNews(query: EventNewsQuery): Promise<EventNewsResult>;
}

// 校验错误（返回给客户端 400）
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// 脱敏后的用户友好错误
export class SanitizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SanitizedError';
  }
}

// 数据来源说明文案
export const DATA_SOURCE_DESCRIPTION = {
  acquisitionProvider: 'AKShare',
  upstreamPlatform: '东方财富',
  note: 'AKShare 是开源数据获取工具，东方财富是上游数据平台。本数据源为实验性候选来源，不代表东方财富官方开放 API，不代表已获得上游内容商业转载授权。',
};

// 实验性数据源提示
export const EXPERIMENTAL_WARNING = '实验性数据源，不代表正式商业数据源';

// 新闻不代表股价波动原因提示
export const NEWS_NOT_CAUSE_WARNING = '新闻候选不代表股价波动原因';
