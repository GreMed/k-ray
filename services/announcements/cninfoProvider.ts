import type {
  AnnouncementProvider,
  AnnouncementResult,
  AnnouncementQuery,
  AnnouncementItem,
  AnnouncementCategory,
} from './types';
import { SanitizedError } from './types';
import { classifyAnnouncement } from './mockProvider';

const TIMEOUT_MS = 10000;

// 全部使用 HTTPS
const CNINFO_QUERY_URL = 'https://www.cninfo.com.cn/new/hisAnnouncement/query';

// 诚实标识，不含虚构联系方式
// 如需配置真实联系方式，通过环境变量 ANNOUNCEMENT_CONTACT_EMAIL 设置
const USER_AGENT = (() => {
  const contact = process.env.ANNOUNCEMENT_CONTACT_EMAIL;
  if (contact && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
    return `K-Ray-Feasibility-Probe/1.0 (contact: ${contact})`;
  }
  return 'K-Ray-Feasibility-Probe/1.0';
})();

interface CnInfoAnnouncement {
  announcementId?: string;
  announcementTitle?: string;
  announcementTime?: string;
  adjunctUrl?: string;
  adjunctType?: string;
  pageUrl?: string;
  secCode?: string;
  secName?: string;
  column?: string;
}

interface CnInfoResponse {
  totalAnnouncement?: number;
  totalRecordNum?: number;
  hasMore?: boolean;
  announcements?: CnInfoAnnouncement[];
  classifiedAnnouncements?: unknown;
}

function getCnInfoStockCode(stockCode: string, market: 'SH' | 'SZ'): string {
  const suffix = market === 'SH' ? 'sh' : 'sz';
  return `${stockCode},${suffix}`;
}

function sanitizeError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err);

  if (/timeout|timed out|ETIMEDOUT|ECONNRESET|AbortError/i.test(raw)) {
    return new SanitizedError('公告查询超时，请稍后重试。');
  }
  if (/ENOENT|not found|no such file/i.test(raw)) {
    return new SanitizedError('公告查询服务暂时不可用。');
  }
  if (/forbidden|403|unauthorized|401/i.test(raw)) {
    return new SanitizedError('公告来源访问受限，请稍后重试。');
  }
  if (/captcha|验证码|login|登录/i.test(raw)) {
    return new SanitizedError('公告来源要求验证，暂时无法查询。');
  }
  if (/rate limit|too many|429|限频|频率/i.test(raw)) {
    return new SanitizedError('公告查询过于频繁，请稍后再试。');
  }

  console.error('[CnInfoProvider] 内部错误(仅日志):', raw);
  return new SanitizedError('公告查询失败，请稍后重试。');
}

async function fetchCnInfoAnnouncements(
  stockCode: string,
  market: 'SH' | 'SZ',
  startDate: string,
  endDate: string,
): Promise<CnInfoResponse> {
  const stock = getCnInfoStockCode(stockCode, market);
  const seDate = `${startDate}~${endDate}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const params = new URLSearchParams({
    pageNum: '1',
    pageSize: '30',
    column: market === 'SH' ? 'sse' : 'szse',
    tabName: 'fulltext',
    plate: market === 'SH' ? 'sh' : 'sz',
    stock,
    searchkey: '',
    secid: '',
    category: '',
    trade: '',
    seDate,
  });

  try {
    const response = await fetch(CNINFO_QUERY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': USER_AGENT,
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        Origin: 'https://www.cninfo.com.cn',
        Referer: 'https://www.cninfo.com.cn/new/commonUrl?url=disclosure/list/notice',
      },
      body: params.toString(),
      signal: controller.signal,
    });

    if (response.status === 403 || response.status === 401) {
      throw new Error(`Access forbidden: ${response.status}`);
    }
    if (response.status === 429) {
      throw new Error(`Rate limited: ${response.status}`);
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();

    if (/验证码|captcha|login|登录/.test(text)) {
      throw new Error('Captcha or login required');
    }

    try {
      return JSON.parse(text) as CnInfoResponse;
    } catch {
      throw new Error('Invalid JSON response');
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new SanitizedError('公告查询超时，请稍后重试。');
    }
    throw sanitizeError(err);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 简单的确定性哈希函数，用于生成稳定ID
 * 使用 FNV-1a 变体，Math.imul 保证 32 位整数乘法正确性
 */
function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * 生成稳定的公告ID，绝不使用数组index。
 *
 * 优先级：
 * 1. 来源提供的 announcementId
 * 2. 原始PDF路径中的稳定标识
 * 3. 基于 sourcePlatform、stockCode、publishedAt、title、originalPdfUrl 生成的稳定哈希
 *
 * 如果稳定字段不足（publishedAt 和 originalPdfUrl 均为空），返回空字符串，调用方应丢弃该条。
 */
function buildStableAnnouncementId(
  stockCode: string,
  market: 'SH' | 'SZ',
  rawAnnouncement: CnInfoAnnouncement,
): string {
  const prefix = `cninfo:${market.toLowerCase()}:${stockCode}:`;

  // 优先级1：来源提供的 announcementId
  if (rawAnnouncement.announcementId && rawAnnouncement.announcementId.length > 0) {
    return `${prefix}${rawAnnouncement.announcementId}`;
  }

  // 优先级2：PDF路径中的稳定标识
  if (rawAnnouncement.adjunctUrl && rawAnnouncement.adjunctUrl.length > 0) {
    const pdfId = rawAnnouncement.adjunctUrl
      .replace(/\.PDF$/i, '')
      .split('/')
      .pop();
    if (pdfId && pdfId.length > 0) {
      return `${prefix}pdf:${pdfId}`;
    }
  }

  // 优先级3：基于稳定字段生成哈希
  const publishedAt = rawAnnouncement.announcementTime || '';
  const title = rawAnnouncement.announcementTitle || '';
  const adjunctUrl = rawAnnouncement.adjunctUrl || '';

  // 稳定字段不足，无法生成可靠ID
  if (!publishedAt && !adjunctUrl) {
    return '';
  }

  const hashInput = [title, publishedAt, adjunctUrl].join('|');
  return `${prefix}hash:${stableHash(hashInput)}`;
}

function isCnInfoDomain(hostname: string): boolean {
  if (hostname === 'cninfo.com.cn') return true;
  if (hostname.endsWith('.cninfo.com.cn')) return true;
  return false;
}

/**
 * 验证并返回安全的 HTTPS pageUrl。
 * 只有接口真实返回 pageUrl 时才能使用，不推测构造。
 * - pageUrl 必须转换为 HTTPS
 * - 域名必须严格等于 cninfo.com.cn 或其子域名 *.cninfo.com.cn
 * - 不符合条件返回空字符串
 */
function validatePageUrl(pageUrl: string | undefined): string {
  if (!pageUrl || pageUrl.trim().length === 0) return '';

  let url = pageUrl.trim();

  // 转换为 HTTPS
  if (url.startsWith('http://')) {
    url = url.replace(/^http:\/\//, 'https://');
  }

  // 必须是 HTTPS
  if (!url.startsWith('https://')) {
    return '';
  }

  // 严格域名校验
  try {
    const parsed = new URL(url);
    if (!isCnInfoDomain(parsed.hostname)) {
      return '';
    }
  } catch {
    return '';
  }

  return url;
}

function buildPdfUrl(adjunctUrl: string | undefined): string | undefined {
  if (!adjunctUrl) return undefined;
  // 完整 HTTPS URL：校验域名必须属于 cninfo.com.cn
  if (adjunctUrl.startsWith('https://')) {
    try {
      const parsed = new URL(adjunctUrl);
      if (!isCnInfoDomain(parsed.hostname)) {
        return undefined;
      }
      return adjunctUrl;
    } catch {
      return undefined;
    }
  }
  // 完整 HTTP URL：转 HTTPS 后校验域名
  if (adjunctUrl.startsWith('http://')) {
    try {
      const httpsUrl = adjunctUrl.replace(/^http:\/\//, 'https://');
      const parsed = new URL(httpsUrl);
      if (!isCnInfoDomain(parsed.hostname)) {
        return undefined;
      }
      return httpsUrl;
    } catch {
      return undefined;
    }
  }
  // 相对路径：拼接 static.cninfo.com.cn
  return `https://static.cninfo.com.cn/${adjunctUrl.replace(/^\//, '')}`;
}

function normalizePublishedAt(rawTime: string | undefined): string {
  if (!rawTime) return '';
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(rawTime)) {
    return rawTime;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(rawTime)) {
    return rawTime.replace('T', ' ').replace(/\.\d+Z$/, '').replace(/Z$/, '');
  }
  try {
    const d = new Date(rawTime);
    if (!isNaN(d.getTime())) {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
  } catch {
    // ignore
  }
  return rawTime;
}

function deduplicate(items: AnnouncementItem[]): AnnouncementItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.announcementId || item.title + item.publishedAt;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortByPublishedAtDesc(items: AnnouncementItem[]): AnnouncementItem[] {
  return [...items].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/**
 * 严格验证响应中的公告是否全部属于目标股票。
 * 规则：每一条公告的 secCode 都必须等于查询的 stockCode。
 * 只要存在任何其他股票的公告，整次响应标记为 unverified。
 */
function verifyStockFilterStrict(
  rawList: CnInfoAnnouncement[],
  stockCode: string,
): boolean {
  if (rawList.length === 0) return false;
  // 每一条都必须匹配
  return rawList.every(item => item.secCode === stockCode);
}

/**
 * 检查单条公告是否具有最低有效字段。
 * - secCode 必须匹配
 * - title 非空
 * - publishedAt 必须可解析
 * - announcementId 或真实PDF路径至少存在一个
 */
function hasMinimumValidFields(
  rawItem: CnInfoAnnouncement,
  stockCode: string,
): boolean {
  if (rawItem.secCode !== stockCode) return false;
  if (!rawItem.announcementTitle || rawItem.announcementTitle.trim().length === 0) return false;
  if (!rawItem.announcementTime || !isParsableTime(rawItem.announcementTime)) return false;
  if (!rawItem.announcementId && !rawItem.adjunctUrl) return false;
  return true;
}

function isParsableTime(time: string): boolean {
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(time)) return true;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(time)) return true;
  const d = new Date(time);
  return !isNaN(d.getTime());
}

export const cninfoProvider: AnnouncementProvider = {
  id: 'cninfo',
  label: '巨潮资讯网公告(可行性验证)',

  async fetchAnnouncements(query: AnnouncementQuery): Promise<AnnouncementResult> {
    if (query.market !== 'SH' && query.market !== 'SZ') {
      throw new SanitizedError('仅支持上交所(SH)和深交所(SZ)市场。');
    }

    const response = await fetchCnInfoAnnouncements(
      query.stockCode,
      query.market,
      query.startDate,
      query.endDate,
    );

    const rawList = response.announcements || [];
    const now = new Date().toISOString();

    // 空响应处理：无法验证查询确实针对目标股票
    if (rawList.length === 0) {
      return {
        announcements: [],
        meta: {
          source: 'cninfo',
          sourceLabel: '巨潮资讯网公告(可行性验证)',
          isRealAnnouncement: false,
          fetchedAt: now,
          total: 0,
          verificationStatus: 'unverified',
        },
      };
    }

    // 严格验证：每一条公告的 secCode 都必须等于查询的 stockCode
    const isStockVerified = verifyStockFilterStrict(rawList, query.stockCode);

    if (!isStockVerified) {
      // 响应中存在其他股票公告，整次响应标记为 unverified
      const mismatched = rawList.filter(item => item.secCode !== query.stockCode);
      console.warn(
        `[CnInfoProvider] 严格股票归属验证失败: 查询 ${query.stockCode} 但响应中包含 ${mismatched.length} 条其他股票公告`,
      );
      return {
        announcements: [],
        meta: {
          source: 'cninfo',
          sourceLabel: '巨潮资讯网公告(可行性验证)',
          isRealAnnouncement: false,
          fetchedAt: now,
          total: 0,
          verificationStatus: 'unverified',
        },
      };
    }

    // 所有公告 secCode 匹配，构建结果
    const items: AnnouncementItem[] = [];
    const discarded: string[] = [];

    for (const rawItem of rawList) {
      // 最低有效字段校验
      if (!hasMinimumValidFields(rawItem, query.stockCode)) {
        discarded.push(rawItem.announcementTitle || '(无标题)');
        continue;
      }

      const title = rawItem.announcementTitle || '公告';
      const category: AnnouncementCategory = classifyAnnouncement(title);
      const publishedAt = normalizePublishedAt(rawItem.announcementTime);

      const announcementId = buildStableAnnouncementId(
        query.stockCode,
        query.market,
        rawItem,
      );

      // 稳定字段不足，丢弃该条
      if (!announcementId) {
        discarded.push(title);
        continue;
      }

      // 只使用接口真实返回的 pageUrl，不推测构造
      const sourcePageUrl = validatePageUrl(rawItem.pageUrl);
      const originalPdfUrl = buildPdfUrl(rawItem.adjunctUrl);

      // 要被标记为 verified，至少必须存在有效 sourcePageUrl 或有效 originalPdfUrl
      if (!sourcePageUrl && !originalPdfUrl) {
        discarded.push(title);
        continue;
      }

      items.push({
        announcementId,
        stockCode: query.stockCode,
        market: query.market,
        title,
        publishedAt,
        sourcePlatform: '巨潮资讯网',
        sourcePageUrl,
        originalPdfUrl,
        category,
        fetchedAt: now,
        isRealAnnouncement: true,
        rawPublishedAt: rawItem.announcementTime || '',
        alignedTradingDate: null,
      });
    }

    if (discarded.length > 0) {
      console.warn(
        `[CnInfoProvider] 丢弃 ${discarded.length} 条无效公告:`,
        discarded,
      );
    }

    // 原始响应非空，但最终有效公告为0条
    if (items.length === 0) {
      return {
        announcements: [],
        meta: {
          source: 'cninfo',
          sourceLabel: '巨潮资讯网公告(可行性验证)',
          isRealAnnouncement: false,
          fetchedAt: now,
          total: 0,
          verificationStatus: 'unverified',
        },
      };
    }

    const deduped = deduplicate(items);
    const sorted = sortByPublishedAtDesc(deduped);

    return {
      announcements: sorted,
      meta: {
        source: 'cninfo',
        sourceLabel: '巨潮资讯网公告(可行性验证)',
        isRealAnnouncement: true,
        fetchedAt: now,
        total: sorted.length,
        verificationStatus: 'verified',
      },
    };
  },
};
