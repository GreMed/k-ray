/**
 * K-Ray 第十阶段 A 测试 - 新闻候选数据服务（封板修复版）
 * 覆盖：股票代码转换、参数校验（直测路由）、稳定 ID、去重、数据过滤、
 *       URL 验证（含 0.0.0.0/127.x/::1/IPv6私网/169.254.x）、
 *       股票相关性验证（含多股汇总、金额数字、过宽简称）、
 *       Provider 完整映射断言、模式行为、降级标注等
 *
 * @jest-environment node
 */

import { execFile } from 'child_process';
import { GET } from '@/app/api/event-news/route';
import { fetchEventNews, getEventNewsMode, akshareNewsProvider, clearCache } from '@/services/eventNews';
import { SanitizedError, type EventNewsQuery, type EventNewsDataProvider } from '@/services/eventNews/types';
import { verifyStockRelevance, extractStockCodes, isValidEventNewsAShareCode } from '@/services/eventNews/stockRelevance';
import { generateNewsId, deduplicateNews, isValidUrl, normalizeUrl, normalizeTitle } from '@/services/eventNews/newsDedup';
import { detectMarket } from '@/utils/stockCode';

// Mock execFile 以避免真实调用 Python 脚本
jest.mock('child_process', () => {
  const actual = jest.requireActual('child_process');
  return {
    ...actual,
    execFile: jest.fn(),
  };
});

const mockedExecFile = execFile as jest.MockedFunction<typeof execFile>;

// ========== 辅助函数 ==========

// 构造合法查询参数
function makeQuery(overrides: Partial<EventNewsQuery> = {}): EventNewsQuery {
  return {
    stockCode: '600519',
    market: 'SH',
    ...overrides,
  };
}

// 构造 AKShare Python 客户端成功返回的 JSON
function makeAkshareSuccess(news: Array<Record<string, unknown>>): string {
  return JSON.stringify({
    success: true,
    news,
    count: news.length,
    stockCode: '600519',
    source: 'akshare',
    upstreamPlatform: 'eastmoney',
  });
}

// 模拟 execFile 成功返回
function mockExecFileSuccess(stdout: string): void {
  mockedExecFile.mockImplementation(((
    _cmd: string,
    _args: string[],
    _opts: unknown,
    cb: (err: Error | null, stdout: string, stderr: string) => void,
  ) => {
    cb(null, stdout, '');
  }) as typeof execFile);
}

// 模拟 execFile 错误返回
function mockExecFileError(error: Error, stderr: string = ''): void {
  mockedExecFile.mockImplementation(((
    _cmd: string,
    _args: string[],
    _opts: unknown,
    cb: (err: Error | null, stdout: string, stderr: string) => void,
  ) => {
    cb(error, '', stderr);
  }) as typeof execFile);
}

// 构造 Next.js Request 对象
function makeRequest(params: Record<string, string>): Request {
  const url = `http://localhost:3000/api/event-news?${new URLSearchParams(params).toString()}`;
  return new Request(url);
}

describe('第十阶段 A 测试 - 新闻候选数据服务（封板修复版）', () => {
  let originalMode: string | undefined;
  let originalAksharePythonPath: string | undefined;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    originalMode = process.env.EVENT_NEWS_MODE;
    process.env.EVENT_NEWS_MODE = 'mock';
    // 测试隔离：在干净环境（无项目 .venv）中，akshareNewsProvider.getPythonPath()
    // 会因 python3 不是绝对路径而返回"Python 运行环境未安装"，导致 execFile mock
    // 之前就被预检查拦截。设置 AKSHARE_PYTHON_PATH 为 Node 自身可执行路径
    // （process.execPath 一定存在），让预检查通过，execFile mock 正常接管。
    originalAksharePythonPath = process.env.AKSHARE_PYTHON_PATH;
    process.env.AKSHARE_PYTHON_PATH = process.execPath;
    jest.clearAllMocks();
    clearCache();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalMode !== undefined) {
      process.env.EVENT_NEWS_MODE = originalMode;
    } else {
      delete process.env.EVENT_NEWS_MODE;
    }
    if (originalAksharePythonPath !== undefined) {
      process.env.AKSHARE_PYTHON_PATH = originalAksharePythonPath;
    } else {
      delete process.env.AKSHARE_PYTHON_PATH;
    }
    clearCache();
    consoleErrorSpy.mockRestore();
  });

  // ========== 1. 股票代码转换 ==========
  describe('1. 股票代码转换', () => {
    test('600519 → SH（沪市主板）', () => {
      expect(detectMarket('600519')).toBe('SH');
    });

    test('000001 → SZ（深市主板）', () => {
      expect(detectMarket('000001')).toBe('SZ');
    });

    test('300750 → SZ（创业板）', () => {
      expect(detectMarket('300750')).toBe('SZ');
    });

    test('688981 → SH（科创板）', () => {
      expect(detectMarket('688981')).toBe('SH');
    });

    test('四只验收股票均可正确识别市场', () => {
      expect(detectMarket('600519')).toBe('SH');
      expect(detectMarket('000001')).toBe('SZ');
      expect(detectMarket('300750')).toBe('SZ');
      expect(detectMarket('688981')).toBe('SH');
    });
  });

  // ========== 2. API 参数校验（直测真实路由） ==========
  describe('2. API 参数校验（直测真实路由 GET）', () => {
    test('缺少参数返回 400', async () => {
      const response = await GET(makeRequest({}));
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('缺少必要参数');
    });

    test('缺少 market 返回 400', async () => {
      const response = await GET(makeRequest({ stockCode: '600519' }));
      expect(response.status).toBe(400);
    });

    test('非法代码（非6位数字）返回 400', async () => {
      const response = await GET(makeRequest({ stockCode: 'abc123', market: 'SH' }));
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('6位数字');
    });

    test('非法代码（5位）返回 400', async () => {
      const response = await GET(makeRequest({ stockCode: '60051', market: 'SH' }));
      expect(response.status).toBe(400);
    });

    test('市场不匹配（SH 代码标为 SZ）返回 400', async () => {
      const response = await GET(makeRequest({ stockCode: '600519', market: 'SZ' }));
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('不属于');
    });

    test('市场不匹配（SZ 代码标为 SH）返回 400', async () => {
      const response = await GET(makeRequest({ stockCode: '000001', market: 'SH' }));
      expect(response.status).toBe(400);
    });

    test('非法市场（BJ）返回 400', async () => {
      const response = await GET(makeRequest({ stockCode: '600519', market: 'BJ' }));
      expect(response.status).toBe(400);
    });

    test('合法请求调用真实服务入口返回 200', async () => {
      process.env.EVENT_NEWS_MODE = 'mock';
      const response = await GET(makeRequest({ stockCode: '600519', market: 'SH' }));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.meta).toBeDefined();
      expect(data.news).toBeDefined();
    });

    test('服务异常返回脱敏后的 503', async () => {
      process.env.EVENT_NEWS_MODE = 'real';
      mockExecFileError(new Error('connection failed'));

      const response = await GET(makeRequest({ stockCode: '600519', market: 'SH' }));
      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.error).toBeDefined();
      // 不应泄露内部错误细节
      expect(data.error).not.toContain('connection failed');
    });
  });

  // ========== 3. 稳定 ID ==========
  describe('3. 稳定 ID', () => {
    test('相同 URL 产生相同 ID（即使标题/时间/来源不同）', () => {
      const id1 = generateNewsId(
        'https://example.com/news/123',
        '标题A',
        '2024-01-01 10:00:00',
        '来源A',
      );
      const id2 = generateNewsId(
        'https://example.com/news/123',
        '标题B',
        '2024-02-02 12:00:00',
        '来源B',
      );
      expect(id1).toBe(id2);
    });

    test('URL 优先于哈希生成 ID', () => {
      const id = generateNewsId(
        'https://example.com/news/123',
        '标题',
        '2024-01-01 10:00:00',
        '来源',
      );
      expect(id.startsWith('news:url:')).toBe(true);
      expect(id).toContain('https://example.com/news/123');
    });

    test('URL 缺失时使用标题+时间+来源的哈希生成 ID', () => {
      const id = generateNewsId('', '标题', '2024-01-01 10:00:00', '来源');
      expect(id.startsWith('news:hash:')).toBe(true);

      const id2 = generateNewsId('', '标题', '2024-01-01 10:00:00', '来源');
      expect(id).toBe(id2);

      const id3 = generateNewsId('', '不同标题', '2024-01-01 10:00:00', '来源');
      expect(id).not.toBe(id3);
    });

    test('无效 URL 也降级为哈希 ID', () => {
      const id = generateNewsId('http://localhost/news', '标题', '2024-01-01 10:00:00', '来源');
      expect(id.startsWith('news:hash:')).toBe(true);
    });
  });

  // ========== 4. 重复新闻去重 ==========
  describe('4. 重复新闻去重', () => {
    test('相同 URL（相同 ID）被去重', () => {
      const news = [
        { id: 'news:url:https://example.com/1', title: '标题A', publishedAt: '2024-01-01 10:00:00' },
        { id: 'news:url:https://example.com/1', title: '标题B', publishedAt: '2024-02-01 10:00:00' },
      ];
      const result = deduplicateNews(news);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('标题A');
    });

    test('相同标题+时间被去重（即使 ID 不同）', () => {
      const news = [
        { id: 'news:hash:aaa', title: '相同标题', publishedAt: '2024-01-01 10:00:00' },
        { id: 'news:hash:bbb', title: '相同标题', publishedAt: '2024-01-01 10:00:00' },
      ];
      const result = deduplicateNews(news);
      expect(result).toHaveLength(1);
    });

    test('标题仅空格差异被去重', () => {
      const news = [
        { id: 'news:hash:aaa', title: '贵州茅台 发布财报', publishedAt: '2024-01-01 10:00:00' },
        { id: 'news:hash:bbb', title: '贵州茅台  发布财报', publishedAt: '2024-01-01 10:00:00' },
      ];
      expect(normalizeTitle('贵州茅台 发布财报')).toBe(normalizeTitle('贵州茅台  发布财报'));
      const result = deduplicateNews(news);
      expect(result).toHaveLength(1);
    });

    test('标题含全角空格差异也被去重', () => {
      const news = [
        { id: 'news:hash:aaa', title: '贵州茅台\u3000发布财报', publishedAt: '2024-01-01 10:00:00' },
        { id: 'news:hash:bbb', title: '贵州茅台 发布财报', publishedAt: '2024-01-01 10:00:00' },
      ];
      expect(normalizeTitle('贵州茅台\u3000发布财报')).toBe(normalizeTitle('贵州茅台 发布财报'));
      const result = deduplicateNews(news);
      expect(result).toHaveLength(1);
    });

    test('不同标题+时间不去重', () => {
      const news = [
        { id: 'news:url:https://example.com/1', title: '标题A', publishedAt: '2024-01-01 10:00:00' },
        { id: 'news:url:https://example.com/2', title: '标题B', publishedAt: '2024-02-01 10:00:00' },
      ];
      const result = deduplicateNews(news);
      expect(result).toHaveLength(2);
    });
  });

  // ========== 5. 缺少标题 ==========
  describe('5. 缺少标题的新闻在转换中被过滤', () => {
    test('空标题和纯空格标题被过滤', async () => {
      const rawNews = [
        { title: '', content: '内容', publishTime: '2024-01-01 10:00:00', source: '来源', url: 'https://example.com/1' },
        { title: '   ', content: '内容', publishTime: '2024-01-01 10:00:00', source: '来源', url: 'https://example.com/2' },
        { title: '有效标题', content: '内容', publishTime: '2024-01-01 10:00:00', source: '来源', url: 'https://example.com/3' },
      ];
      mockExecFileSuccess(makeAkshareSuccess(rawNews));

      const result = await akshareNewsProvider.fetchNews(makeQuery());
      expect(result.news).toHaveLength(1);
      expect(result.news[0].title).toBe('有效标题');
    });
  });

  // ========== 6. 非法发布时间（真实可解析校验） ==========
  describe('6. 非法发布时间的新闻在转换中被过滤', () => {
    test('非法时间格式被过滤，合法时间保留', async () => {
      const rawNews = [
        { title: '合法新闻', content: '内容', publishTime: '2024-01-01 10:00:00', source: '来源', url: 'https://example.com/1' },
        { title: '非法时间1', content: '内容', publishTime: 'invalid-date', source: '来源', url: 'https://example.com/2' },
        { title: '非法时间2', content: '内容', publishTime: '2024/01/01', source: '来源', url: 'https://example.com/3' },
        { title: '非法时间3', content: '内容', publishTime: '', source: '来源', url: 'https://example.com/4' },
      ];
      mockExecFileSuccess(makeAkshareSuccess(rawNews));

      const result = await akshareNewsProvider.fetchNews(makeQuery());
      expect(result.news).toHaveLength(1);
      expect(result.news[0].title).toBe('合法新闻');
    });

    test('仅日期格式（YYYY-MM-DD）的发布时间被保留', async () => {
      const rawNews = [
        { title: '仅日期', content: '内容', publishTime: '2024-01-01', source: '来源', url: 'https://example.com/1' },
        { title: '日期时分', content: '内容', publishTime: '2024-01-01 10:00', source: '来源', url: 'https://example.com/2' },
        { title: '完整时间', content: '内容', publishTime: '2024-01-01 10:00:00', source: '来源', url: 'https://example.com/3' },
      ];
      mockExecFileSuccess(makeAkshareSuccess(rawNews));

      const result = await akshareNewsProvider.fetchNews(makeQuery());
      expect(result.news).toHaveLength(3);
    });

    test('拒绝 2026-99-99（非法日期）', async () => {
      const rawNews = [
        { title: '非法日期', content: '内容', publishTime: '2026-99-99 10:00:00', source: '来源', url: 'https://example.com/1' },
        { title: '合法新闻', content: '内容', publishTime: '2026-01-01 10:00:00', source: '来源', url: 'https://example.com/2' },
      ];
      mockExecFileSuccess(makeAkshareSuccess(rawNews));

      const result = await akshareNewsProvider.fetchNews(makeQuery());
      expect(result.news).toHaveLength(1);
      expect(result.news[0].title).toBe('合法新闻');
    });

    test('拒绝 25:61:61（非法时间）', async () => {
      const rawNews = [
        { title: '非法时间', content: '内容', publishTime: '2026-01-01 25:61:61', source: '来源', url: 'https://example.com/1' },
        { title: '合法新闻', content: '内容', publishTime: '2026-01-01 10:00:00', source: '来源', url: 'https://example.com/2' },
      ];
      mockExecFileSuccess(makeAkshareSuccess(rawNews));

      const result = await akshareNewsProvider.fetchNews(makeQuery());
      expect(result.news).toHaveLength(1);
      expect(result.news[0].title).toBe('合法新闻');
    });

    test('拒绝 2026-02-30（不存在的日期）', async () => {
      const rawNews = [
        { title: '非法日期', content: '内容', publishTime: '2026-02-30 10:00:00', source: '来源', url: 'https://example.com/1' },
        { title: '合法新闻', content: '内容', publishTime: '2026-02-28 10:00:00', source: '来源', url: 'https://example.com/2' },
      ];
      mockExecFileSuccess(makeAkshareSuccess(rawNews));

      const result = await akshareNewsProvider.fetchNews(makeQuery());
      expect(result.news).toHaveLength(1);
      expect(result.news[0].title).toBe('合法新闻');
    });
  });

  // ========== 7. 缺少原文链接 ==========
  describe('7. 缺少原文链接的新闻标记为 unverified', () => {
    test('空 URL 的新闻标记为 unverified', async () => {
      const rawNews = [
        { title: '无链接新闻贵州茅台', content: '内容包含600519', publishTime: '2024-01-01 10:00:00', source: '来源', url: '' },
        { title: '有链接新闻贵州茅台', content: '内容包含600519', publishTime: '2024-01-01 10:00:00', source: '来源', url: 'https://example.com/1' },
      ];
      mockExecFileSuccess(makeAkshareSuccess(rawNews));

      const result = await akshareNewsProvider.fetchNews(makeQuery());
      const noUrlNews = result.news.find(n => n.title === '无链接新闻贵州茅台');
      const hasUrlNews = result.news.find(n => n.title === '有链接新闻贵州茅台');

      expect(noUrlNews).toBeDefined();
      expect(hasUrlNews).toBeDefined();
      expect(noUrlNews!.stockRelevanceStatus).toBe('unverified');
      expect(noUrlNews!.verificationReason).toContain('缺少格式合格来源链接');
      expect(hasUrlNews!.stockRelevanceStatus).toBe('verified');
    });
  });

  // ========== 8. 非法链接验证（含新增拒绝项） ==========
  describe('8. 非法链接验证 isValidUrl', () => {
    test('拒绝 localhost', () => {
      expect(isValidUrl('http://localhost:3000/news')).toBe(false);
      expect(isValidUrl('http://127.0.0.1/news')).toBe(false);
    });

    test('拒绝内网 IP（10.x / 192.168.x / 172.16-31.x）', () => {
      expect(isValidUrl('http://10.0.0.1/news')).toBe(false);
      expect(isValidUrl('http://10.255.255.255/news')).toBe(false);
      expect(isValidUrl('http://192.168.1.1/news')).toBe(false);
      expect(isValidUrl('http://192.168.0.100/news')).toBe(false);
      expect(isValidUrl('http://172.16.0.1/news')).toBe(false);
      expect(isValidUrl('http://172.31.255.255/news')).toBe(false);
    });

    test('拒绝 0.0.0.0', () => {
      expect(isValidUrl('http://0.0.0.0/news')).toBe(false);
    });

    test('拒绝 127.0.0.0/8（整个 127 段）', () => {
      expect(isValidUrl('http://127.0.0.1/news')).toBe(false);
      expect(isValidUrl('http://127.0.0.2/news')).toBe(false);
      expect(isValidUrl('http://127.255.255.254/news')).toBe(false);
    });

    test('拒绝 169.254.0.0/16（链路本地地址）', () => {
      expect(isValidUrl('http://169.254.0.1/news')).toBe(false);
      expect(isValidUrl('http://169.254.169.254/latest/meta-data')).toBe(false);
    });

    test('拒绝 ::1（IPv6 回环）', () => {
      expect(isValidUrl('http://[::1]/news')).toBe(false);
    });

    test('拒绝 IPv6 链路本地地址（fe80::/10）', () => {
      expect(isValidUrl('http://[fe80::1]/news')).toBe(false);
    });

    test('拒绝 IPv6 唯一本地地址（fc00::/7）', () => {
      expect(isValidUrl('http://[fc00::1]/news')).toBe(false);
      expect(isValidUrl('http://[fd00::1]/news')).toBe(false);
    });

    test('拒绝非 HTTP 协议', () => {
      expect(isValidUrl('ftp://example.com/file')).toBe(false);
      expect(isValidUrl('mailto:test@example.com')).toBe(false);
      expect(isValidUrl('javascript:alert(1)')).toBe(false);
      expect(isValidUrl('file:///etc/passwd')).toBe(false);
    });

    test('拒绝带凭据的 URL', () => {
      expect(isValidUrl('http://user:pass@example.com/news')).toBe(false);
      expect(isValidUrl('https://admin:secret@site.com/article')).toBe(false);
      expect(isValidUrl('http://user@example.com/news')).toBe(false);
    });

    test('接受合法的 HTTP/HTTPS URL', () => {
      expect(isValidUrl('https://example.com/news/123')).toBe(true);
      expect(isValidUrl('http://finance.eastmoney.com/news/20240101123456.html')).toBe(true);
      expect(isValidUrl('https://news.sina.com.cn/article/123.html')).toBe(true);
    });

    test('空字符串和非字符串返回 false', () => {
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl(null as unknown as string)).toBe(false);
      expect(isValidUrl(undefined as unknown as string)).toBe(false);
    });
  });

  // ========== 9. 股票主体明确匹配 ==========
  describe('9. 股票主体明确匹配', () => {
    test('标题中包含目标股票代码时返回 verified', () => {
      const result = verifyStockRelevance(
        '贵州茅台600519发布2024年财报',
        '会议讨论了年度分红方案',
        '600519',
        true,
      );
      expect(result.status).toBe('verified');
      expect(result.matchedStockCodes).toContain('600519');
    });

    test('仅正文包含目标股票代码时返回 unverified（正文提及不能确认主体）', () => {
      const result = verifyStockRelevance(
        '今日市场行情综述',
        '股票代码600519今日表现强劲，值得关注',
        '600519',
        true,
      );
      expect(result.status).toBe('unverified');
      expect(result.matchedStockCodes).toContain('600519');
      expect(result.reason).toContain('仅正文提及');
    });

    test('缺少有效链接时即使包含代码也返回 unverified', () => {
      const result = verifyStockRelevance(
        '贵州茅台600519发布财报',
        '年度分红方案',
        '600519',
        false,
      );
      expect(result.status).toBe('unverified');
    });
  });

  // ========== 10. 查询词存在但主体无法确认 ==========
  describe('10. 查询词存在但主体无法确认', () => {
    test('标题和内容中无股票代码和证券简称时返回 unverified', () => {
      const result = verifyStockRelevance(
        '今日市场行情综述',
        '大盘整体走势平稳，无具体个股信息',
        '600519',
        true,
      );
      expect(result.status).toBe('unverified');
      expect(result.matchedStockCodes).toHaveLength(0);
      expect(result.reason).toContain('未识别到目标股票代码');
    });
  });

  // ========== 11. 混入其他股票新闻 ==========
  describe('11. 混入其他股票新闻', () => {
    test('仅包含其他股票代码时返回 unverified', () => {
      const result = verifyStockRelevance(
        '宁德时代发布新品',
        '股票代码300750受到市场关注',
        '600519',
        true,
      );
      expect(result.status).toBe('unverified');
      expect(result.matchedStockCodes).toContain('300750');
      expect(result.matchedStockCodes).not.toContain('600519');
      expect(result.reason).toContain('其他股票代码');
    });

    test('包含多个其他股票代码时返回 unverified', () => {
      const result = verifyStockRelevance(
        '板块行情：300750和000001双双上涨',
        '多只个股跟涨',
        '600519',
        true,
      );
      expect(result.status).toBe('unverified');
      expect(result.matchedStockCodes).toContain('300750');
      expect(result.matchedStockCodes).toContain('000001');
      expect(result.matchedStockCodes).not.toContain('600519');
    });
  });

  // ========== 12. 真实空结果 ==========
  describe('12. 真实空结果', () => {
    test('自定义空 Mock provider 返回空结果且不报错', async () => {
      const emptyMockProvider: EventNewsDataProvider = {
        id: 'mock',
        label: '空结果Mock',
        async fetchNews() {
          return {
            news: [],
            meta: {
              provider: 'mock',
              upstreamPlatform: 'mock',
              sourceLabel: '空结果Mock',
              dataMode: 'mock',
              isRealData: false,
              fetchedAt: new Date().toISOString(),
              totalCount: 0,
              deduplicatedCount: 0,
              verifiedCount: 0,
              unverifiedCount: 0,
              validUrlCount: 0,
              invalidUrlCount: 0,
              multiStockSummaryCount: 0,
              earliestPublishedAt: null,
              latestPublishedAt: null,
              cacheStatus: 'miss' as const,
            },
          };
        },
      };

      const result = await emptyMockProvider.fetchNews(makeQuery());
      expect(result.news).toHaveLength(0);
      expect(result.meta.totalCount).toBe(0);
      expect(result.meta.deduplicatedCount).toBe(0);
      expect(result.meta.verifiedCount).toBe(0);
      expect(result.meta.unverifiedCount).toBe(0);
      expect(result.meta.multiStockSummaryCount).toBe(0);
      expect(result.meta.earliestPublishedAt).toBeNull();
      expect(result.meta.latestPublishedAt).toBeNull();
    });

    test('akshareNewsProvider 处理空原始结果不报错', async () => {
      mockExecFileSuccess(makeAkshareSuccess([]));

      const result = await akshareNewsProvider.fetchNews(makeQuery());
      expect(result.news).toHaveLength(0);
      expect(result.meta.totalCount).toBe(0);
      expect(result.meta.deduplicatedCount).toBe(0);
      expect(result.meta.verifiedCount).toBe(0);
      expect(result.meta.unverifiedCount).toBe(0);
      expect(result.meta.multiStockSummaryCount).toBe(0);
      expect(result.meta.earliestPublishedAt).toBeNull();
      expect(result.meta.latestPublishedAt).toBeNull();
    });
  });

  // ========== 13. 接口超时 ==========
  describe('13. 接口超时', () => {
    test('akshareNewsProvider 处理超时错误并返回脱敏消息', async () => {
      const timeoutError = new Error('Command timed out after 30000ms (ETIMEDOUT)');
      mockExecFileError(timeoutError);

      try {
        await akshareNewsProvider.fetchNews(makeQuery());
        fail('应抛出错误');
      } catch (e) {
        expect(e).toBeInstanceOf(SanitizedError);
        const msg = e instanceof Error ? e.message : String(e);
        expect(msg).toContain('超时');
        expect(msg).not.toContain('30000ms');
        expect(msg).not.toContain('ETIMEDOUT');
        expect(msg).not.toContain('Command');
      }
    });
  });

  // ========== 14. 接口异常 ==========
  describe('14. 接口异常', () => {
    test('akshareNewsProvider 处理通用错误并返回脱敏消息', async () => {
      const generalError = new Error('Some unexpected internal error with stack trace details');
      mockExecFileError(generalError);

      try {
        await akshareNewsProvider.fetchNews(makeQuery());
        fail('应抛出错误');
      } catch (e) {
        expect(e).toBeInstanceOf(SanitizedError);
        const msg = e instanceof Error ? e.message : String(e);
        expect(msg).not.toContain('stack trace');
        expect(msg).not.toContain('unexpected internal');
        expect(msg).not.toContain('Some unexpected');
      }
    });

    test('脚本路径不存在时返回配置错误提示（不描述为未安装 AKShare）', async () => {
      // 新逻辑：预检查在 execFile 之前拦截，区分"脚本路径不存在"与"AKShare 模块未安装"
      // 设置明确不存在的脚本路径，让预检查直接 reject
      const originalScriptPath = process.env.AKSHARE_SCRIPT_PATH;
      process.env.AKSHARE_SCRIPT_PATH = '/nonexistent/akshare_news_client.py';

      try {
        await akshareNewsProvider.fetchNews(makeQuery());
        fail('应抛出错误');
      } catch (e) {
        expect(e).toBeInstanceOf(SanitizedError);
        const msg = e instanceof Error ? e.message : String(e);
        // 必须描述为脚本配置错误
        expect(msg).toContain('脚本路径');
        expect(msg).toContain('配置错误');
        // 不能把"脚本路径不存在"描述成"未安装 AKShare"
        expect(msg).not.toContain('AKShare 模块未安装');
        expect(msg).not.toContain('未安装 AKShare');
        // 不泄露真实用户路径
        expect(msg).not.toContain('/Users/');
        expect(msg).not.toContain('ENOENT');
      } finally {
        if (originalScriptPath !== undefined) {
          process.env.AKSHARE_SCRIPT_PATH = originalScriptPath;
        } else {
          delete process.env.AKSHARE_SCRIPT_PATH;
        }
      }
    });
  });

  // ========== 15. mock 模式 ==========
  describe('15. mock 模式', () => {
    test('EVENT_NEWS_MODE=mock 时 getEventNewsMode 返回 mock', () => {
      process.env.EVENT_NEWS_MODE = 'mock';
      expect(getEventNewsMode()).toBe('mock');
    });

    test('EVENT_NEWS_MODE 未设置时默认返回 mock', () => {
      delete process.env.EVENT_NEWS_MODE;
      expect(getEventNewsMode()).toBe('mock');
    });

    test('EVENT_NEWS_MODE 为非法值时默认返回 mock', () => {
      process.env.EVENT_NEWS_MODE = 'invalid';
      expect(getEventNewsMode()).toBe('mock');
    });

    test('mock 模式不调用 AKShare（execFile）', async () => {
      process.env.EVENT_NEWS_MODE = 'mock';

      const result = await fetchEventNews(makeQuery());

      expect(mockedExecFile).not.toHaveBeenCalled();
      expect(result.meta.dataMode).toBe('mock');
      expect(result.meta.isRealData).toBe(false);
    });
  });

  // ========== 16. real 模式失败不偷偷降级 ==========
  describe('16. real 模式失败不偷偷降级', () => {
    test('real 模式下 AKShare 失败直接抛出错误，不降级到 Mock', async () => {
      process.env.EVENT_NEWS_MODE = 'real';

      mockExecFileError(new Error('AKShare connection failed'));

      await expect(fetchEventNews(makeQuery())).rejects.toThrow();
      expect(mockedExecFile).toHaveBeenCalledTimes(1);
    });

    test('real 模式抛出的是 SanitizedError', async () => {
      process.env.EVENT_NEWS_MODE = 'real';

      mockExecFileError(new Error('connection refused'));

      try {
        await fetchEventNews(makeQuery());
        fail('应抛出错误');
      } catch (e) {
        expect(e).toBeInstanceOf(SanitizedError);
      }
    });
  });

  // ========== 17. fallback 明确标注 ==========
  describe('17. fallback 明确标注', () => {
    test('fallback 模式降级到 Mock 并标注 fallbackReason', async () => {
      process.env.EVENT_NEWS_MODE = 'fallback';

      mockExecFileError(new Error('AKShare service unavailable'));

      const result = await fetchEventNews(makeQuery());

      expect(result.meta.dataMode).toBe('fallback');
      expect(result.meta.fallbackReason).toBeDefined();
      expect(typeof result.meta.fallbackReason).toBe('string');
      expect(result.meta.fallbackReason!.length).toBeGreaterThan(0);
      expect(result.meta.fallbackReason).toContain('AKShare');
    });

    test('fallback 模式下每条新闻都标注 dataMode=fallback', async () => {
      process.env.EVENT_NEWS_MODE = 'fallback';

      mockExecFileError(new Error('network error'));

      const result = await fetchEventNews(makeQuery());

      expect(result.news.length).toBeGreaterThan(0);
      result.news.forEach(n => {
        expect(n.dataMode).toBe('fallback');
        expect(n.isRealEventCandidate).toBe(false);
      });
    });

    test('fallback 模式 sourceLabel 标注为降级', async () => {
      process.env.EVENT_NEWS_MODE = 'fallback';

      mockExecFileError(new Error('timeout'));

      const result = await fetchEventNews(makeQuery());

      expect(result.meta.sourceLabel).toContain('降级');
    });

    test('fallback 模式下 acquisitionProvider 和 upstreamPlatform 不冒充 AKShare', async () => {
      process.env.EVENT_NEWS_MODE = 'fallback';

      mockExecFileError(new Error('timeout'));

      const result = await fetchEventNews(makeQuery());

      result.news.forEach(n => {
        expect(n.acquisitionProvider).toBe('mock');
        expect(n.upstreamPlatform).toBe('mock');
      });
      expect(result.meta.provider).toBe('mock');
    });
  });

  // ========== 18. URL 规范化 ==========
  describe('18. URL 规范化 normalizeUrl', () => {
    test('去除 fragment（#...）', () => {
      const normalized = normalizeUrl('https://example.com/news/123#section-1');
      expect(normalized).not.toContain('#');
      expect(normalized).toBe('https://example.com/news/123');
    });

    test('去除 utm 跟踪参数', () => {
      const normalized = normalizeUrl(
        'https://example.com/news/123?utm_source=google&utm_medium=cpc&utm_campaign=spring&id=456',
      );
      expect(normalized).not.toContain('utm_source');
      expect(normalized).not.toContain('utm_medium');
      expect(normalized).not.toContain('utm_campaign');
      expect(normalized).toContain('id=456');
    });

    test('去除 from 和 share 跟踪参数', () => {
      const normalized = normalizeUrl(
        'https://example.com/news/123?from=timeline&share=wechat&article=1',
      );
      expect(normalized).not.toContain('from=timeline');
      expect(normalized).not.toContain('share=wechat');
      expect(normalized).toContain('article=1');
    });

    test('去除尾部斜杠', () => {
      const normalized = normalizeUrl('https://example.com/news/123/');
      expect(normalized).toBe('https://example.com/news/123');
      expect(normalized).not.toMatch(/\/$/);
    });

    test('scheme 和 host 转小写', () => {
      const normalized = normalizeUrl('HTTPS://Example.COM/News/123');
      expect(normalized.startsWith('https://example.com')).toBe(true);
    });

    test('非法 URL 返回原始值', () => {
      const invalidUrl = 'not-a-valid-url';
      expect(normalizeUrl(invalidUrl)).toBe(invalidUrl);
    });
  });

  // ========== 19. 股票代码提取（含金额数字过滤） ==========
  describe('19. 股票代码提取 extractStockCodes', () => {
    test('从文本中提取 6 位股票代码', () => {
      const codes = extractStockCodes('贵州茅台(600519)和平安银行(000001)今日上涨');
      expect(codes).toContain('600519');
      expect(codes).toContain('000001');
      expect(codes).toHaveLength(2);
    });

    test('去重相同的股票代码', () => {
      const codes = extractStockCodes('600519和600519是同一个代码，600519再次出现');
      expect(codes).toHaveLength(1);
      expect(codes[0]).toBe('600519');
    });

    test('不提取非 6 位数字', () => {
      const codes = extractStockCodes('代码123和12345678都不是有效股票代码');
      expect(codes).toHaveLength(0);
    });

    test('空字符串返回空数组', () => {
      expect(extractStockCodes('')).toHaveLength(0);
    });

    test('提取多个不同代码', () => {
      const codes = extractStockCodes('600519、000001、300750、688981四只股票');
      expect(codes).toHaveLength(4);
      expect(codes).toContain('600519');
      expect(codes).toContain('000001');
      expect(codes).toContain('300750');
      expect(codes).toContain('688981');
    });

    test('金额中的六位数字不被识别成股票代码（如 142472）', () => {
      // 142472 不符合沪深 A 股代码前缀（142 不是有效前缀）
      const codes = extractStockCodes('成交金额142472万元，换手率1.5%');
      expect(codes).not.toContain('142472');
      expect(codes).toHaveLength(0);
    });

    test('金额中的六位数字不被识别成股票代码（如 335366）', () => {
      // 335366 不符合沪深 A 股代码前缀（335 不是有效前缀，只有 300 是）
      const codes = extractStockCodes('主力净流入335366元');
      expect(codes).not.toContain('335366');
      expect(codes).toHaveLength(0);
    });

    test('符合前缀的六位数字仍被正确识别', () => {
      const codes = extractStockCodes('600519和300750都是有效代码');
      expect(codes).toContain('600519');
      expect(codes).toContain('300750');
    });
  });

  // ========== 20. 证券简称匹配（严格完整名称） ==========
  describe('20. 证券简称匹配（仅完整名称）', () => {
    test('标题中包含完整证券简称"贵州茅台"但不含代码时返回 verified', () => {
      const result = verifyStockRelevance(
        '贵州茅台召开股东大会',
        '会议讨论了年度分红方案',
        '600519',
        true,
      );
      expect(result.status).toBe('verified');
      expect(result.reason).toContain('证券简称');
    });

    test('标题中包含完整证券简称"平安银行"时返回 verified', () => {
      const result = verifyStockRelevance(
        '平安银行发布年报',
        '业绩稳健增长',
        '000001',
        true,
      );
      expect(result.status).toBe('verified');
    });

    test('标题中包含完整证券简称"宁德时代"时返回 verified', () => {
      const result = verifyStockRelevance(
        '宁德时代新能源布局',
        '电池产能扩张',
        '300750',
        true,
      );
      expect(result.status).toBe('verified');
    });

    test('标题中包含完整证券简称"中芯国际"时返回 verified', () => {
      const result = verifyStockRelevance(
        '中芯国际技术突破',
        '芯片制程升级',
        '688981',
        true,
      );
      expect(result.status).toBe('verified');
    });

    test('"中国平安"不能因为包含"平安"而匹配平安银行', () => {
      // "平安"已从简称列表中删除，只有完整"平安银行"才匹配
      const result = verifyStockRelevance(
        '中国平安发布年报',
        '保险业务增长',
        '000001', // 目标是平安银行
        true,
      );
      expect(result.status).toBe('unverified');
    });

    test('"宁德市"不能匹配宁德时代', () => {
      // "宁德"已从简称列表中删除，只有完整"宁德时代"才匹配
      const result = verifyStockRelevance(
        '宁德市发布城市规划',
        '城市建设进展',
        '300750',
        true,
      );
      expect(result.status).toBe('unverified');
    });

    test('"茅台镇"不能匹配贵州茅台', () => {
      // "茅台"已从简称列表中删除，只有完整"贵州茅台"才匹配
      const result = verifyStockRelevance(
        '茅台镇旅游产业发展',
        '地方经济',
        '600519',
        true,
      );
      expect(result.status).toBe('unverified');
    });

    test('包含其他股票的证券简称但不包含目标股票时返回 unverified', () => {
      const result = verifyStockRelevance(
        '宁德时代发布新品',
        '新能源板块受到关注',
        '600519',
        true,
      );
      expect(result.status).toBe('unverified');
    });

    test('缺少有效链接时即使包含证券简称也返回 unverified', () => {
      const result = verifyStockRelevance(
        '贵州茅台召开股东大会',
        '会议讨论了年度分红方案',
        '600519',
        false,
      );
      expect(result.status).toBe('unverified');
      expect(result.reason).toContain('缺少格式合格来源链接');
    });
  });

  // ========== 21. 多股汇总候选规则（新增） ==========
  describe('21. 多股汇总候选规则', () => {
    test('多股榜单包含目标代码时仍为 unverified', () => {
      const result = verifyStockRelevance(
        '板块资金流一览，多只个股受到关注',
        '今日资金流入：600519、000001、300750多只个股',
        '600519',
        true,
      );
      expect(result.status).toBe('unverified');
      expect(result.isMultiStockSummary).toBe(true);
      expect(result.reason).toContain('多股汇总候选');
    });

    test('标题直接出现完整公司名称时可以 verified', () => {
      const result = verifyStockRelevance(
        '贵州茅台三季度业绩超预期',
        '公司财报显示营收增长',
        '600519',
        true,
      );
      expect(result.status).toBe('verified');
      expect(result.isMultiStockSummary).toBe(false);
    });

    test('标题只包含目标股票代码且无其他股票时可以 verified', () => {
      const result = verifyStockRelevance(
        '600519今日表现强劲',
        '值得关注',
        '600519',
        true,
      );
      expect(result.status).toBe('verified');
      expect(result.isMultiStockSummary).toBe(false);
    });

    test('仅正文包含目标股票代码时为 unverified（正文提及不能确认主体）', () => {
      const result = verifyStockRelevance(
        '今日市场行情',
        '股票600519表现强劲，值得关注',
        '600519',
        true,
      );
      expect(result.status).toBe('unverified');
      expect(result.isMultiStockSummary).toBe(false);
      expect(result.reason).toContain('仅正文提及');
    });

    test('标题是龙虎榜汇总，正文包含目标和其他代码时为 unverified', () => {
      const result = verifyStockRelevance(
        '今日龙虎榜一览',
        '600519和000001均上榜',
        '600519',
        true,
      );
      expect(result.status).toBe('unverified');
      expect(result.isMultiStockSummary).toBe(true);
    });

    test('多股汇总候选的 isRealEventCandidate 必须为 false', async () => {
      const rawNews = [
        {
          title: '板块资金流一览，多只个股受到关注',
          content: '今日资金流入：600519、000001多只个股',
          publishTime: '2024-01-01 10:00:00',
          source: '来源',
          url: 'https://example.com/1',
        },
      ];
      mockExecFileSuccess(makeAkshareSuccess(rawNews));

      const result = await akshareNewsProvider.fetchNews(makeQuery());
      expect(result.news).toHaveLength(1);
      expect(result.news[0].isMultiStockSummary).toBe(true);
      expect(result.news[0].isRealEventCandidate).toBe(false);
      expect(result.news[0].stockRelevanceStatus).toBe('unverified');
    });

    // ========== 多主体标题识别回归测试 ==========
    test('多主体标题：贵州茅台等6股获机构关注 → unverified、多股汇总', () => {
      const result = verifyStockRelevance(
        '贵州茅台等6股获机构关注',
        '多家机构调研',
        '600519',
        true,
      );
      expect(result.status).toBe('unverified');
      expect(result.isMultiStockSummary).toBe(true);
    });

    test('多主体标题：600519等12股发布最新公告 → unverified、多股汇总', () => {
      const result = verifyStockRelevance(
        '600519等12股发布最新公告',
        '今日公告汇总',
        '600519',
        true,
      );
      expect(result.status).toBe('unverified');
      expect(result.isMultiStockSummary).toBe(true);
    });

    test('多主体标题：600519、000001、300750最新动态 → unverified、多股汇总', () => {
      const result = verifyStockRelevance(
        '600519、000001、300750最新动态',
        '多只个股最新动态',
        '600519',
        true,
      );
      expect(result.status).toBe('unverified');
      expect(result.isMultiStockSummary).toBe(true);
    });

    test('单主体标题：贵州茅台发布年度分红方案 → verified', () => {
      const result = verifyStockRelevance(
        '贵州茅台发布年度分红方案',
        '公司公告',
        '600519',
        true,
      );
      expect(result.status).toBe('verified');
      expect(result.isMultiStockSummary).toBe(false);
    });

    test('单主体标题：600519发布年度报告且标题无其他代码 → verified', () => {
      const result = verifyStockRelevance(
        '600519发布年度报告',
        '公司公告',
        '600519',
        true,
      );
      expect(result.status).toBe('verified');
      expect(result.isMultiStockSummary).toBe(false);
    });

    test('金额数字：160051900元资金流入不能因包含600519而 verified', () => {
      const result = verifyStockRelevance(
        '160051900元资金流入市场',
        '今日资金动态',
        '600519',
        true,
      );
      // 160051900 中的 600519 不应被识别为目标股票代码
      expect(result.status).toBe('unverified');
    });

    test('多主体标题：等多股 → unverified、多股汇总', () => {
      const result = verifyStockRelevance(
        '贵州茅台等多股获机构关注',
        '多家机构调研',
        '600519',
        true,
      );
      expect(result.status).toBe('unverified');
      expect(result.isMultiStockSummary).toBe(true);
    });

    test('多主体标题：多家公司发布年报 → unverified、多股汇总', () => {
      const result = verifyStockRelevance(
        '多家公司发布年报',
        '600519也在其中',
        '600519',
        true,
      );
      expect(result.status).toBe('unverified');
      expect(result.isMultiStockSummary).toBe(true);
    });

    test('多主体标题：多只股票涨停 → unverified、多股汇总', () => {
      const result = verifyStockRelevance(
        '多只股票涨停',
        '600519涨停',
        '600519',
        true,
      );
      expect(result.status).toBe('unverified');
      expect(result.isMultiStockSummary).toBe(true);
    });

    test('多主体标题：多只个股受到关注 → unverified、多股汇总', () => {
      const result = verifyStockRelevance(
        '多只个股受到关注',
        '600519受到关注',
        '600519',
        true,
      );
      expect(result.status).toBe('unverified');
      expect(result.isMultiStockSummary).toBe(true);
    });
  });

  // ========== 22. Provider 完整映射断言（新增） ==========
  describe('22. Provider 完整映射断言', () => {
    test('akshareNewsProvider 返回的每条新闻包含完整字段映射', async () => {
      const rawNews = [
        {
          title: '贵州茅台发布财报',
          content: '600519三季度营收增长',
          publishTime: '2024-01-01 10:00:00',
          source: '证券时报',
          url: 'https://finance.eastmoney.com/a/202401011234.html',
        },
      ];
      mockExecFileSuccess(makeAkshareSuccess(rawNews));

      const result = await akshareNewsProvider.fetchNews(makeQuery());

      expect(result.news).toHaveLength(1);
      const news = result.news[0];

      // 完整字段映射断言
      expect(news.queryStockCode).toBe('600519');
      expect(news.title).toBe('贵州茅台发布财报');
      expect(news.excerpt).toBe('600519三季度营收增长');
      expect(news.publisher).toBe('证券时报');
      expect(news.originalUrl).toBe('https://finance.eastmoney.com/a/202401011234.html');
      expect(news.acquisitionProvider).toBe('akshare');
      expect(news.upstreamPlatform).toBe('eastmoney');
      expect(news.dataMode).toBe('real');
      expect(news.isRealEventCandidate).toBe(true);
      expect(news.fetchedAt).toBeDefined();
      expect(news.id).toBeDefined();
      expect(news.publishedAt).toBe('2024-01-01 10:00:00');
      expect(news.matchedStockCodes).toContain('600519');
      expect(news.stockRelevanceStatus).toBe('verified');
      expect(news.verificationReason).toBeDefined();
    });

    test('akshareNewsProvider meta 包含完整计数', async () => {
      const rawNews = [
        {
          title: '贵州茅台发布财报',
          content: '600519三季度营收增长',
          publishTime: '2024-01-01 10:00:00',
          source: '证券时报',
          url: 'https://finance.eastmoney.com/a/202401011234.html',
        },
        {
          title: '板块资金流一览',
          content: '600519和000001资金流入',
          publishTime: '2024-01-02 10:00:00',
          source: '证券时报',
          url: 'https://finance.eastmoney.com/a/202401011235.html',
        },
      ];
      mockExecFileSuccess(makeAkshareSuccess(rawNews));

      const result = await akshareNewsProvider.fetchNews(makeQuery());

      expect(result.meta.provider).toBe('akshare');
      expect(result.meta.upstreamPlatform).toBe('eastmoney');
      expect(result.meta.dataMode).toBe('real');
      expect(result.meta.isRealData).toBe(true);
      expect(result.meta.totalCount).toBe(2);
      expect(result.meta.deduplicatedCount).toBe(2);
      expect(result.meta.verifiedCount).toBe(1);
      expect(result.meta.unverifiedCount).toBe(1);
      expect(result.meta.validUrlCount).toBe(2);
      expect(result.meta.invalidUrlCount).toBe(0);
      expect(result.meta.multiStockSummaryCount).toBe(1);
      expect(result.meta.earliestPublishedAt).toBe('2024-01-01 10:00:00');
      expect(result.meta.latestPublishedAt).toBe('2024-01-02 10:00:00');
      expect(result.meta.fetchedAt).toBeDefined();
      expect(result.meta.cacheStatus).toBeDefined();
    });

    test('mockProvider 返回的每条新闻不冒充 AKShare', async () => {
      process.env.EVENT_NEWS_MODE = 'mock';

      const result = await fetchEventNews(makeQuery());

      expect(result.news.length).toBeGreaterThan(0);
      result.news.forEach(n => {
        expect(n.acquisitionProvider).toBe('mock');
        expect(n.upstreamPlatform).toBe('mock');
        expect(n.isRealEventCandidate).toBe(false);
      });
      expect(result.meta.provider).toBe('mock');
      expect(result.meta.upstreamPlatform).toBe('mock');
    });
  });

  // ========== 23. 缓存键包含模式（新增） ==========
  describe('23. 缓存键包含模式避免串缓存', () => {
    test('mock 和 real 模式不串缓存', async () => {
      // 先在 mock 模式下查询并缓存
      process.env.EVENT_NEWS_MODE = 'mock';
      const mockResult = await fetchEventNews(makeQuery());
      expect(mockResult.meta.dataMode).toBe('mock');

      // 切换到 real 模式，配置真实返回
      process.env.EVENT_NEWS_MODE = 'real';
      mockExecFileSuccess(makeAkshareSuccess([
        {
          title: '真实新闻',
          content: '600519真实内容',
          publishTime: '2024-01-01 10:00:00',
          source: '真实来源',
          url: 'https://finance.eastmoney.com/a/real.html',
        },
      ]));

      // real 模式查询应得到真实数据，不是 mock 缓存
      const realResult = await fetchEventNews(makeQuery());
      expect(realResult.meta.dataMode).toBe('real');
      expect(realResult.meta.isRealData).toBe(true);
      expect(realResult.news[0].title).toBe('真实新闻');
    });
  });

  // ========== 24. 真实误判回归测试（封板修复版新增） ==========
  describe('24. 真实误判回归测试', () => {
    // 000001.SZ 查询的真实误判场景
    test('000001: "ETF市场日报｜创新药ETF涨逾8%……" → unverified', () => {
      const result = verifyStockRelevance(
        'ETF市场日报｜创新药ETF涨逾8%，多只相关个股大涨',
        '今日ETF市场表现活跃，上证综合指数（000001）微涨0.3%',
        '000001',
        true,
        'SZ',
      );
      expect(result.status).toBe('unverified');
      expect(result.isMultiStockSummary).toBe(true);
    });

    test('000001: 正文中的"上证综合指数（000001）"不能识别为平安银行', () => {
      const result = verifyStockRelevance(
        '今日A股市场行情回顾',
        '上证综合指数（000001）收盘上涨，市场情绪回暖',
        '000001',
        true,
        'SZ',
      );
      expect(result.status).toBe('unverified');
      expect(result.reason).toContain('仅正文提及');
    });

    test('000001: "中国金茂：非执行董事……" → unverified', () => {
      const result = verifyStockRelevance(
        '中国金茂：非执行董事辞任',
        '公司公告非执行董事辞任事宜',
        '000001',
        true,
        'SZ',
      );
      expect(result.status).toBe('unverified');
    });

    test('000001: "重庆银行董事薪酬……" → unverified', () => {
      const result = verifyStockRelevance(
        '重庆银行董事薪酬调整',
        '重庆银行公告董事薪酬调整方案',
        '000001',
        true,
        'SZ',
      );
      expect(result.status).toBe('unverified');
    });

    test('000001: 标题出现"平安银行"可以 verified', () => {
      const result = verifyStockRelevance(
        '平安银行发布年度业绩报告',
        '业绩稳健增长',
        '000001',
        true,
        'SZ',
      );
      expect(result.status).toBe('verified');
    });

    test('000001: 标题只有"000001"但无明确身份标记 → unverified', () => {
      const result = verifyStockRelevance(
        '000001今日行情',
        '市场走势平稳',
        '000001',
        true,
        'SZ',
      );
      expect(result.status).toBe('unverified');
      expect(result.reason).toContain('无法确认');
    });

    test('000001: "上证指数（000001）"必须 unverified（即使标题有000001）', () => {
      const result = verifyStockRelevance(
        '上证指数（000001）今日走势分析',
        '大盘行情',
        '000001',
        true,
        'SZ',
      );
      expect(result.status).toBe('unverified');
    });

    // 600519.SH 查询的真实误判场景
    test('600519: "食品饮料行业资金流出榜：贵州茅台等6股……" → unverified、多股汇总', () => {
      const result = verifyStockRelevance(
        '食品饮料行业资金流出榜：贵州茅台等6股净流出超亿元',
        '今日食品饮料板块资金流出，贵州茅台、五粮液等个股资金净流出',
        '600519',
        true,
        'SH',
      );
      expect(result.status).toBe('unverified');
      expect(result.isMultiStockSummary).toBe(true);
    });

    test('600519: "净流入创历史新高！北向资金……"正文提及贵州茅台 → unverified', () => {
      const result = verifyStockRelevance(
        '净流入创历史新高！北向资金今日大幅买入',
        '北向资金今日净流入创历史新高，贵州茅台等蓝筹股受到青睐',
        '600519',
        true,
        'SH',
      );
      expect(result.status).toBe('unverified');
      expect(result.isMultiStockSummary).toBe(true);
    });

    test('600519: "近650亿真金白银入场，A股回购潮……"正文提及贵州茅台 → unverified', () => {
      const result = verifyStockRelevance(
        '近650亿真金白银入场，A股回购潮持续升温',
        '多家公司发布回购计划，贵州茅台等公司也在回购名单中',
        '600519',
        true,
        'SH',
      );
      expect(result.status).toBe('unverified');
      expect(result.isMultiStockSummary).toBe(true);
    });

    test('600519: "贵州茅台：拟实施年度权益分派……" → verified', () => {
      const result = verifyStockRelevance(
        '贵州茅台：拟实施年度权益分派方案',
        '公司公告年度权益分派',
        '600519',
        true,
        'SH',
      );
      expect(result.status).toBe('verified');
      expect(result.isMultiStockSummary).toBe(false);
    });

    // 300750.SZ 查询的真实误判场景
    test('300750: "74.75亿元主力资金今日撤离电力设备板块" → unverified', () => {
      const result = verifyStockRelevance(
        '74.75亿元主力资金今日撤离电力设备板块',
        '电力设备板块资金大幅流出，宁德时代等个股受影响',
        '300750',
        true,
        'SZ',
      );
      expect(result.status).toBe('unverified');
      expect(result.isMultiStockSummary).toBe(true);
    });

    test('300750: "宁德时代在厦门成立新公司" → verified', () => {
      const result = verifyStockRelevance(
        '宁德时代在厦门成立新公司',
        '注册资本1亿元',
        '300750',
        true,
        'SZ',
      );
      expect(result.status).toBe('verified');
      expect(result.isMultiStockSummary).toBe(false);
    });

    // 所有 unverified 和多股汇总项目的 isRealEventCandidate 必须为 false
    test('所有 unverified 新闻的 isRealEventCandidate 必须为 false', async () => {
      const rawNews = [
        {
          title: 'ETF市场日报｜创新药ETF涨逾8%',
          content: '上证综合指数（000001）微涨',
          publishTime: '2024-01-01 10:00:00',
          source: '来源',
          url: 'https://example.com/1',
        },
        {
          title: '食品饮料行业资金流出榜：贵州茅台等6股',
          content: '板块资金流出',
          publishTime: '2024-01-02 10:00:00',
          source: '来源',
          url: 'https://example.com/2',
        },
      ];
      mockExecFileSuccess(makeAkshareSuccess(rawNews));

      const result = await akshareNewsProvider.fetchNews({ stockCode: '000001', market: 'SZ' });
      result.news.forEach(n => {
        expect(n.stockRelevanceStatus).toBe('unverified');
        expect(n.isRealEventCandidate).toBe(false);
      });
    });
  });

  // ========== 25. 301xxx 创业板代码支持（封板修复版新增） ==========
  describe('25. 301xxx 创业板代码支持', () => {
    test('extractStockCodes 支持 301xxx 创业板代码', () => {
      const codes = extractStockCodes('301001和301002都是创业板代码');
      expect(codes).toContain('301001');
      expect(codes).toContain('301002');
    });

    test('isValidEventNewsAShareCode 支持 301xxx', () => {
      expect(isValidEventNewsAShareCode('301001')).toBe(true);
      expect(isValidEventNewsAShareCode('301999')).toBe(true);
    });
  });

  // ========== 26. cacheStatus 和绕过缓存（封板修复版新增） ==========
  describe('26. cacheStatus 和绕过缓存', () => {
    test('普通查询返回 cacheStatus=miss 或 hit', async () => {
      process.env.EVENT_NEWS_MODE = 'mock';
      clearCache();
      const result = await fetchEventNews(makeQuery());
      expect(result.meta.cacheStatus).toBe('miss');
    });

    test('第二次查询返回 cacheStatus=hit', async () => {
      process.env.EVENT_NEWS_MODE = 'mock';
      clearCache();
      await fetchEventNews(makeQuery());
      const result = await fetchEventNews(makeQuery());
      expect(result.meta.cacheStatus).toBe('hit');
    });

    test('bypassCache=true 时返回 cacheStatus=bypass', async () => {
      process.env.EVENT_NEWS_MODE = 'mock';
      clearCache();
      await fetchEventNews(makeQuery()); // 先填充缓存
      const result = await fetchEventNews(makeQuery(), { bypassCache: true });
      expect(result.meta.cacheStatus).toBe('bypass');
    });

    test('两轮 bypassCache 查询会调用真实 provider 两次', async () => {
      process.env.EVENT_NEWS_MODE = 'real';
      clearCache();
      mockExecFileSuccess(makeAkshareSuccess([
        {
          title: '贵州茅台发布财报',
          content: '600519营收增长',
          publishTime: '2024-01-01 10:00:00',
          source: '来源',
          url: 'https://example.com/1',
        },
      ]));

      // 第一轮绕过缓存
      const result1 = await fetchEventNews(makeQuery(), { bypassCache: true });
      expect(result1.meta.cacheStatus).toBe('bypass');
      expect(mockedExecFile).toHaveBeenCalledTimes(1);

      // 第二轮绕过缓存
      const result2 = await fetchEventNews(makeQuery(), { bypassCache: true });
      expect(result2.meta.cacheStatus).toBe('bypass');
      expect(mockedExecFile).toHaveBeenCalledTimes(2);
    });

    test('bypassCache 不写入缓存', async () => {
      process.env.EVENT_NEWS_MODE = 'mock';
      clearCache();
      // bypassCache 查询
      await fetchEventNews(makeQuery(), { bypassCache: true });
      // 普通查询应该是 miss（说明 bypass 没写入缓存）
      const result = await fetchEventNews(makeQuery());
      expect(result.meta.cacheStatus).toBe('miss');
    });
  });

  // ========== 27. Mock 数据根据查询股票生成主体（封板修复版新增） ==========
  describe('27. Mock 数据根据查询股票生成主体', () => {
    test('查询 600519 时 Mock 数据包含贵州茅台', async () => {
      process.env.EVENT_NEWS_MODE = 'mock';
      clearCache();
      const result = await fetchEventNews({ stockCode: '600519', market: 'SH' });
      const hasMoutai = result.news.some(n => n.title.includes('贵州茅台'));
      expect(hasMoutai).toBe(true);
    });

    test('查询 000001 时 Mock 数据包含平安银行', async () => {
      process.env.EVENT_NEWS_MODE = 'mock';
      clearCache();
      const result = await fetchEventNews({ stockCode: '000001', market: 'SZ' });
      const hasPingAn = result.news.some(n => n.title.includes('平安银行'));
      expect(hasPingAn).toBe(true);
    });

    test('查询 300750 时 Mock 数据包含宁德时代', async () => {
      process.env.EVENT_NEWS_MODE = 'mock';
      clearCache();
      const result = await fetchEventNews({ stockCode: '300750', market: 'SZ' });
      const hasCATL = result.news.some(n => n.title.includes('宁德时代'));
      expect(hasCATL).toBe(true);
    });

    test('查询 688981 时 Mock 数据包含中芯国际', async () => {
      process.env.EVENT_NEWS_MODE = 'mock';
      clearCache();
      const result = await fetchEventNews({ stockCode: '688981', market: 'SH' });
      const hasSMIC = result.news.some(n => n.title.includes('中芯国际'));
      expect(hasSMIC).toBe(true);
    });
  });
});
