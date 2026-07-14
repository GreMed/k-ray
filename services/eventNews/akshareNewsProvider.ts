// K-Ray 第十阶段 A：AKShare 新闻数据 Provider
// 通过调用 Python 客户端获取 AKShare stock_news_em 数据
// 独立于行情和公告服务

import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import type { EventNewsDataProvider, EventNewsQuery, EventNewsResult, NewsEventCandidate } from './types';
import { SanitizedError } from './types';
import { verifyStockRelevance } from './stockRelevance';
import { generateNewsId, deduplicateNews, isValidUrl } from './newsDedup';

// Python 客户端返回的原始新闻结构
interface AkshareRawNewsItem {
  title: string;
  content: string;
  publishTime: string;
  source: string;
  url: string;
}

interface AkshareRawResult {
  success: boolean;
  news: AkshareRawNewsItem[];
  count: number;
  stockCode: string;
  source: string;
  upstreamPlatform: string;
  error?: string;
}

const TIMEOUT_MS = 30000; // AKShare 可能需要更长时间
const MAX_BUFFER = 10 * 1024 * 1024;

// 统一 Python 路径选择规则：
// 1. 优先使用 AKSHARE_PYTHON_PATH
// 2. 其次使用项目 .venv/bin/python
// 3. 最后才尝试系统 python3
function getPythonPath(): string {
  // 1. 优先使用 AKSHARE_PYTHON_PATH
  if (process.env.AKSHARE_PYTHON_PATH && fs.existsSync(process.env.AKSHARE_PYTHON_PATH)) {
    return process.env.AKSHARE_PYTHON_PATH;
  }

  // 2. 其次使用项目 .venv/bin/python
  const venvPython = path.join(process.cwd(), '.venv', 'bin', 'python');
  if (fs.existsSync(venvPython)) {
    return venvPython;
  }

  // 3. 最后才尝试系统 python3
  return 'python3';
}

function getScriptPath(): string {
  return process.env.AKSHARE_SCRIPT_PATH || 'scripts/akshare_news_client.py';
}

// 错误脱敏
// 区分四种错误原因：Python 未安装、脚本路径不存在、网络失败、超时
function sanitizeError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err);
  if (/ModuleNotFoundError|No module named/i.test(raw)) {
    return new SanitizedError('AKShare 模块未安装，请执行: pip install akshare==1.18.64');
  }
  if (/timeout|timed out|ETIMEDOUT/i.test(raw)) {
    return new SanitizedError('AKShare数据获取超时，请稍后重试。');
  }
  if (/connection|connect|network|ECONNREFUSED|ECONNRESET/i.test(raw)) {
    return new SanitizedError('网络连接失败，无法获取新闻数据。');
  }
  console.error('[AkshareNewsProvider] 内部错误(仅日志):', raw);
  return new SanitizedError('新闻数据服务暂时不可用，请稍后重试。');
}

function runAkshareClient(stockCode: string): Promise<AkshareRawResult> {
  return new Promise((resolve, reject) => {
    const pythonPath = getPythonPath();
    const scriptPath = getScriptPath();

    // 预检查：区分 Python 未安装和脚本路径不存在
    // 1. 检查 Python 可执行文件是否存在
    if (!fs.existsSync(pythonPath)) {
      return reject(new SanitizedError(
        'Python 运行环境未安装或路径不存在，请参考 requirements.txt 安装 Python 及 akshare==1.18.64。',
      ));
    }
    // 2. 检查脚本文件是否存在（不能把"脚本路径不存在"描述成"未安装 AKShare"）
    if (!fs.existsSync(scriptPath)) {
      return reject(new SanitizedError(
        `数据服务脚本配置错误：脚本路径 ${scriptPath} 不存在。请检查 AKSHARE_SCRIPT_PATH 环境变量配置。`,
      ));
    }

    const args = [scriptPath, stockCode];

    execFile(
      pythonPath,
      args,
      {
        timeout: TIMEOUT_MS,
        killSignal: 'SIGTERM',
        maxBuffer: MAX_BUFFER,
      },
      (error, stdout, stderr) => {
        if (error) {
          // 脚本路径不存在的错误（Python 进程已启动但找不到脚本文件）
          if (/can't open file|No such file or directory|\[Errno 2\]/i.test(stderr) ||
              /can't open file|No such file or directory/i.test(error.message)) {
            return reject(new SanitizedError(
              `数据服务脚本配置错误：脚本路径 ${scriptPath} 不存在。请检查 AKSHARE_SCRIPT_PATH 环境变量配置。`,
            ));
          }
          try {
            const parsed = JSON.parse(stderr);
            if (parsed && parsed.error) {
              return reject(sanitizeError(parsed.error));
            }
          } catch {
            // stderr 不是 JSON
          }
          return reject(sanitizeError(error));
        }

        try {
          const result = JSON.parse(stdout) as AkshareRawResult;
          if (!result.success) {
            return reject(sanitizeError(result.error || 'unknown'));
          }
          resolve(result);
        } catch (parseError) {
          return reject(sanitizeError(parseError));
        }
      },
    );
  });
}

// 验证发布时间格式
// 必须是真实可解析的日期和时间，拒绝 2026-99-99、25:61:61 等无效日期
function isValidPublishTime(time: string): boolean {
  if (!time) return false;
  // 接受 YYYY-MM-DD HH:mm:ss 或 YYYY-MM-DD HH:mm 或 YYYY-MM-DD
  const patterns = [
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/,
    /^(\d{4})-(\d{2})-(\d{2})$/,
  ];

  for (const pattern of patterns) {
    const match = time.match(pattern);
    if (!match) continue;

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const hour = match[4] ? parseInt(match[4], 10) : 0;
    const minute = match[5] ? parseInt(match[5], 10) : 0;
    const second = match[6] ? parseInt(match[6], 10) : 0;

    // 月份 1-12
    if (month < 1 || month > 12) return false;
    // 日期 1-31（按月份校验）
    if (day < 1 || day > 31) return false;
    // 小时 0-23
    if (hour < 0 || hour > 23) return false;
    // 分钟 0-59
    if (minute < 0 || minute > 59) return false;
    // 秒 0-59
    if (second < 0 || second > 59) return false;

    // 使用 Date 对象校验真实日期（会自动处理闰年、月份天数）
    const date = new Date(year, month - 1, day, hour, minute, second);
    // 检查 Date 是否与输入一致（Date 会自动溢出，如 2026-02-30 会变成 2026-03-02）
    if (date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day ||
        date.getHours() !== hour ||
        date.getMinutes() !== minute ||
        date.getSeconds() !== second) {
      return false;
    }

    return true;
  }

  return false;
}

// 将原始新闻转换为 NewsEventCandidate
function transformNews(
  rawNews: AkshareRawNewsItem[],
  query: EventNewsQuery,
  dataMode: 'real' | 'fallback',
): NewsEventCandidate[] {
  const fetchedAt = new Date().toISOString();

  const candidates: NewsEventCandidate[] = rawNews
    .filter(item => {
      // 过滤缺少标题的
      if (!item.title || !item.title.trim()) return false;
      // 过滤非法发布时间的（必须是真实可解析的日期和时间）
      if (!isValidPublishTime(item.publishTime)) return false;
      return true;
    })
    .map(item => {
      const hasValidUrl = isValidUrl(item.url);
      const id = generateNewsId(item.url, item.title, item.publishTime, item.source);
      const relevance = verifyStockRelevance(
        item.title,
        item.content,
        query.stockCode,
        hasValidUrl,
        query.market,
      );

      return {
        id,
        queryStockCode: query.stockCode,
        title: item.title,
        excerpt: item.content,
        publishedAt: item.publishTime,
        publisher: item.source,
        originalUrl: item.url,
        acquisitionProvider: 'akshare' as const,
        upstreamPlatform: 'eastmoney' as const,
        matchedStockCodes: relevance.matchedStockCodes,
        stockRelevanceStatus: relevance.status,
        verificationReason: relevance.reason,
        dataMode,
        // 多股汇总候选不能标记为真实事件候选
        isRealEventCandidate: relevance.status === 'verified' && !relevance.isMultiStockSummary,
        isMultiStockSummary: relevance.isMultiStockSummary,
        fetchedAt,
      };
    });

  // 去重
  return deduplicateNews(candidates);
}

export const akshareNewsProvider: EventNewsDataProvider = {
  id: 'akshare',
  label: 'AKShare新闻候选(东方财富上游)',

  async fetchNews(query: EventNewsQuery): Promise<EventNewsResult> {
    const rawResult = await runAkshareClient(query.stockCode);
    const fetchedAt = new Date().toISOString();

    const news = transformNews(rawResult.news, query, 'real');

    // 计算元信息
    const verifiedCount = news.filter(n => n.stockRelevanceStatus === 'verified').length;
    const unverifiedCount = news.filter(n => n.stockRelevanceStatus === 'unverified').length;
    const validUrlCount = news.filter(n => isValidUrl(n.originalUrl)).length;
    const invalidUrlCount = news.length - validUrlCount;
    const multiStockSummaryCount = news.filter(n => n.isMultiStockSummary).length;

    // 按发布时间排序后取最早和最晚
    const sortedByTime = [...news].sort((a, b) =>
      a.publishedAt < b.publishedAt ? -1 : a.publishedAt > b.publishedAt ? 1 : 0,
    );
    const earliestPublishedAt = sortedByTime.length > 0 ? sortedByTime[0].publishedAt : null;
    const latestPublishedAt = sortedByTime.length > 0 ? sortedByTime[sortedByTime.length - 1].publishedAt : null;

    return {
      news,
      meta: {
        provider: 'akshare',
        upstreamPlatform: 'eastmoney',
        sourceLabel: 'AKShare新闻候选(东方财富上游)',
        dataMode: 'real',
        isRealData: true,
        fetchedAt,
        totalCount: rawResult.count,
        deduplicatedCount: news.length,
        verifiedCount,
        unverifiedCount,
        validUrlCount,
        invalidUrlCount,
        multiStockSummaryCount,
        earliestPublishedAt,
        latestPublishedAt,
        // cacheStatus 由 index.ts 的 withCacheStatus 覆盖，此处默认 miss
        cacheStatus: 'miss',
      },
    };
  },
};
