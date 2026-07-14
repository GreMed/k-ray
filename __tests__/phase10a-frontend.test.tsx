/**
 * K-Ray 第十阶段 A 前端测试 - 开发事件源页面 UI 行为（封板修复版）
 * 覆盖测试：
 *   1. 页面初始渲染
 *   2. 预设按钮切换股票
 *   3. 查询成功显示新闻列表
 *   4. 显示元信息
 *   5. verified/unverified 徽标显示
 *   6. 原文链接展示
 *   7. 空状态
 *   8. 错误状态
 *   9. fallback 降级状态
 *   10. 实验性数据源提示
 *   11. 请求参数断言（stockCode、market）
 *   12. Real 徽标和近期覆盖限制提示
 *
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import DevEventSourcesPage from '@/app/dev-event-sources/page';

// 测试用 Mock 新闻结果数据（Real 模式）
const mockRealNewsResult = {
  news: [
    {
      id: 'test-real-1',
      queryStockCode: '600519',
      title: '贵州茅台发布季度报告',
      excerpt: '贵州茅台季度业绩...',
      publishedAt: '2026-06-15 18:30:00',
      publisher: '证券时报',
      originalUrl: 'https://finance.eastmoney.com/a/20260615test.html',
      acquisitionProvider: 'akshare',
      upstreamPlatform: 'eastmoney',
      matchedStockCodes: ['600519'],
      stockRelevanceStatus: 'verified',
      verificationReason: '标题中明确包含目标股票代码 600519',
      dataMode: 'real',
      isRealEventCandidate: true,
      isMultiStockSummary: false,
      fetchedAt: '2026-07-10T10:00:00.000Z',
    },
    {
      id: 'test-real-2',
      queryStockCode: '600519',
      title: '板块资金流一览，多只个股受到关注',
      excerpt: '今日资金流入：600519、000001多只个股',
      publishedAt: '2026-06-16 10:00:00',
      publisher: '证券时报',
      originalUrl: 'https://finance.eastmoney.com/a/20260616test.html',
      acquisitionProvider: 'akshare',
      upstreamPlatform: 'eastmoney',
      matchedStockCodes: ['600519', '000001'],
      stockRelevanceStatus: 'unverified',
      verificationReason: '多股汇总候选，不能确认目标股票是新闻主体',
      dataMode: 'real',
      isRealEventCandidate: false,
      isMultiStockSummary: true,
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
    totalCount: 2,
    deduplicatedCount: 2,
    verifiedCount: 1,
    unverifiedCount: 1,
    validUrlCount: 2,
    invalidUrlCount: 0,
    multiStockSummaryCount: 1,
    earliestPublishedAt: '2026-06-15 18:30:00',
    latestPublishedAt: '2026-06-16 10:00:00',
    cacheStatus: 'miss' as const,
  },
};

// 测试用 Mock 新闻结果数据（Mock 模式）
const mockNewsResult = {
  news: [
    {
      id: 'test-mock-1',
      queryStockCode: '600519',
      title: '[Mock演示] 贵州茅台发布季度业绩报告',
      excerpt: '这是本地开发验收样本中的Mock演示新闻...',
      publishedAt: '2026-06-15 18:30:00',
      publisher: 'Mock演示来源',
      originalUrl: 'https://example.com/mock-news-1',
      acquisitionProvider: 'mock',
      upstreamPlatform: 'mock',
      matchedStockCodes: ['600519'],
      stockRelevanceStatus: 'verified',
      verificationReason: '[Mock] 标题中明确包含目标股票代码 600519（演示数据）',
      dataMode: 'mock',
      isRealEventCandidate: false,
      isMultiStockSummary: false,
      fetchedAt: '2026-07-10T10:00:00.000Z',
    },
    {
      id: 'test-mock-2',
      queryStockCode: '600519',
      title: '[Mock演示] 某其他公司新闻',
      excerpt: '300999 发布公告...',
      publishedAt: '2026-06-16 10:00:00',
      publisher: 'Mock演示来源',
      originalUrl: '',
      acquisitionProvider: 'mock',
      upstreamPlatform: 'mock',
      matchedStockCodes: ['300999'],
      stockRelevanceStatus: 'unverified',
      verificationReason: '[Mock] 缺少有效原文链接（演示数据）',
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
    totalCount: 2,
    deduplicatedCount: 2,
    verifiedCount: 1,
    unverifiedCount: 1,
    validUrlCount: 1,
    invalidUrlCount: 1,
    multiStockSummaryCount: 0,
    earliestPublishedAt: '2026-06-15 18:30:00',
    latestPublishedAt: '2026-06-16 10:00:00',
    cacheStatus: 'miss' as const,
  },
};

// 测试用空结果数据
const mockEmptyResult = {
  news: [],
  meta: {
    provider: 'mock',
    upstreamPlatform: 'mock',
    sourceLabel: 'Mock演示新闻(开发验收)',
    dataMode: 'mock',
    isRealData: false,
    fetchedAt: '2026-07-10T10:00:00.000Z',
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

// 测试用 fallback 降级结果数据
const mockFallbackResult = {
  ...mockNewsResult,
  meta: {
    ...mockNewsResult.meta,
    dataMode: 'fallback',
    fallbackReason: 'AKShare真实新闻暂时不可用，当前已降级为本地Mock数据。原因：AKShare接口超时',
  },
};

describe('第十阶段 A 前端测试 - 开发事件源页面（封板修复版）', () => {
  let fetchSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    if (typeof (global as { fetch?: unknown }).fetch !== 'function') {
      (global as { fetch: typeof fetch }).fetch = jest.fn() as unknown as typeof fetch;
    }
    fetchSpy = jest.spyOn(global, 'fetch');
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  // ========== 测试1：页面初始渲染 ==========
  test('测试1: 页面初始渲染包含标题、股票代码输入框、预设按钮和查询按钮', async () => {
    await act(async () => { render(<DevEventSourcesPage />); });

    expect(screen.getByText('K-Ray 新闻候选数据源 · 开发体验')).toBeInTheDocument();
    expect(screen.getByTestId('query-form')).toBeInTheDocument();
    expect(screen.getByTestId('stock-code-input')).toBeInTheDocument();
    expect(screen.getByTestId('market-select')).toBeInTheDocument();
    expect(screen.getByTestId('preset-600519')).toBeInTheDocument();
    expect(screen.getByTestId('preset-000001')).toBeInTheDocument();
    expect(screen.getByTestId('preset-300750')).toBeInTheDocument();
    expect(screen.getByTestId('preset-688981')).toBeInTheDocument();
    expect(screen.getByTestId('query-button')).toBeInTheDocument();
  });

  // ========== 测试2：预设按钮切换股票 ==========
  test('测试2: 点击预设按钮更新股票代码输入框和市场选择的值', async () => {
    await act(async () => { render(<DevEventSourcesPage />); });

    expect(screen.getByTestId('stock-code-input')).toHaveValue('600519');
    expect(screen.getByTestId('market-select')).toHaveValue('SH');

    await act(async () => { fireEvent.click(screen.getByTestId('preset-000001')); });
    expect(screen.getByTestId('stock-code-input')).toHaveValue('000001');
    expect(screen.getByTestId('market-select')).toHaveValue('SZ');

    await act(async () => { fireEvent.click(screen.getByTestId('preset-300750')); });
    expect(screen.getByTestId('stock-code-input')).toHaveValue('300750');
    expect(screen.getByTestId('market-select')).toHaveValue('SZ');

    await act(async () => { fireEvent.click(screen.getByTestId('preset-688981')); });
    expect(screen.getByTestId('stock-code-input')).toHaveValue('688981');
    expect(screen.getByTestId('market-select')).toHaveValue('SH');

    await act(async () => { fireEvent.click(screen.getByTestId('preset-600519')); });
    expect(screen.getByTestId('stock-code-input')).toHaveValue('600519');
    expect(screen.getByTestId('market-select')).toHaveValue('SH');
  });

  // ========== 测试3：查询成功显示新闻列表 ==========
  test('测试3: 查询成功后展示新闻列表，包含标题、时间、来源和摘要', async () => {
    fetchSpy.mockReturnValue(
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => mockRealNewsResult,
      }) as unknown as Promise<Response>
    );

    await act(async () => { render(<DevEventSourcesPage />); });

    await act(async () => { fireEvent.click(screen.getByTestId('query-button')); });

    await waitFor(() => {
      expect(screen.getByTestId('news-list')).toBeInTheDocument();
    });

    expect(screen.getByTestId('news-item-0')).toBeInTheDocument();
    expect(screen.getByTestId('news-title-0')).toHaveTextContent('贵州茅台发布季度报告');
    expect(screen.getByTestId('news-time-0')).toHaveTextContent('2026-06-15 18:30:00');
    expect(screen.getByTestId('news-source-0')).toHaveTextContent('证券时报');
    expect(screen.getByTestId('news-excerpt-0')).toHaveTextContent('贵州茅台季度业绩...');

    expect(screen.getByTestId('news-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('news-title-1')).toHaveTextContent('板块资金流一览');
  });

  // ========== 测试4：显示元信息 ==========
  test('测试4: 查询后展示模式徽标、总数、去重数、verified 数和 unverified 数', async () => {
    fetchSpy.mockReturnValue(
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => mockRealNewsResult,
      }) as unknown as Promise<Response>
    );

    await act(async () => { render(<DevEventSourcesPage />); });

    await act(async () => { fireEvent.click(screen.getByTestId('query-button')); });

    await waitFor(() => {
      expect(screen.getByTestId('result-meta')).toBeInTheDocument();
    });

    // Real 真实 徽标
    expect(screen.getByTestId('mode-badge')).toHaveTextContent('Real 真实');
    expect(screen.getByTestId('total-count')).toHaveTextContent('2');
    expect(screen.getByTestId('dedup-count')).toHaveTextContent('2');
    expect(screen.getByTestId('verified-count')).toHaveTextContent('1');
    expect(screen.getByTestId('unverified-count')).toHaveTextContent('1');
    expect(screen.getByTestId('multi-stock-count')).toHaveTextContent('1');
  });

  // ========== 测试5：verified/unverified 徽标显示 ==========
  test('测试5: 每条新闻显示对应的相关性验证状态徽标', async () => {
    fetchSpy.mockReturnValue(
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => mockRealNewsResult,
      }) as unknown as Promise<Response>
    );

    await act(async () => { render(<DevEventSourcesPage />); });

    await act(async () => { fireEvent.click(screen.getByTestId('query-button')); });

    await waitFor(() => {
      expect(screen.getByTestId('news-list')).toBeInTheDocument();
    });

    expect(screen.getByTestId('relevance-badge-0')).toHaveTextContent('verified');
    expect(screen.getByTestId('relevance-badge-1')).toHaveTextContent('unverified');

    // 第二条新闻有多股汇总徽标
    expect(screen.getByTestId('multi-stock-badge-1')).toHaveTextContent('多股汇总');
  });

  // ========== 测试6：原文链接展示 ==========
  test('测试6: 有 URL 的新闻显示原文链接及域名，无 URL 的新闻显示"无有效原文链接"', async () => {
    fetchSpy.mockReturnValue(
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => mockNewsResult,
      }) as unknown as Promise<Response>
    );

    await act(async () => { render(<DevEventSourcesPage />); });

    await act(async () => { fireEvent.click(screen.getByTestId('query-button')); });

    await waitFor(() => {
      expect(screen.getByTestId('news-list')).toBeInTheDocument();
    });

    const urlLink = screen.getByTestId('news-url-0');
    expect(urlLink).toBeInTheDocument();
    expect(urlLink).toHaveTextContent('example.com');
    expect(urlLink.getAttribute('href')).toBe('https://example.com/mock-news-1');

    expect(screen.getByTestId('news-no-url-1')).toBeInTheDocument();
    expect(screen.getByTestId('news-no-url-1')).toHaveTextContent('无有效原文链接');
  });

  // ========== 测试7：空状态 ==========
  test('测试7: 查询返回空新闻数组时展示空状态', async () => {
    fetchSpy.mockReturnValue(
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => mockEmptyResult,
      }) as unknown as Promise<Response>
    );

    await act(async () => { render(<DevEventSourcesPage />); });

    await act(async () => { fireEvent.click(screen.getByTestId('query-button')); });

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    expect(screen.getByTestId('empty-state')).toHaveTextContent('未找到新闻数据');
    expect(screen.queryByTestId('news-list')).not.toBeInTheDocument();
  });

  // ========== 测试8：错误状态 ==========
  test('测试8: 查询返回错误时展示错误状态', async () => {
    fetchSpy.mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 500,
        json: async () => ({ error: '上游接口异常' }),
      }) as unknown as Promise<Response>
    );

    await act(async () => { render(<DevEventSourcesPage />); });

    await act(async () => { fireEvent.click(screen.getByTestId('query-button')); });

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
    });

    expect(screen.getByTestId('error-state')).toHaveTextContent('查询失败');
    expect(screen.getByTestId('error-state')).toHaveTextContent('上游接口异常');

    expect(screen.queryByTestId('news-list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('result-meta')).not.toBeInTheDocument();
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
  });

  // ========== 测试9：fallback 降级状态 ==========
  test('测试9: 查询返回 fallbackReason 时展示降级原因和 Fallback 徽标', async () => {
    fetchSpy.mockReturnValue(
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => mockFallbackResult,
      }) as unknown as Promise<Response>
    );

    await act(async () => { render(<DevEventSourcesPage />); });

    await act(async () => { fireEvent.click(screen.getByTestId('query-button')); });

    await waitFor(() => {
      expect(screen.getByTestId('result-meta')).toBeInTheDocument();
    });

    expect(screen.getByTestId('mode-badge')).toHaveTextContent('Fallback 降级');
    expect(screen.getByTestId('fallback-reason')).toBeInTheDocument();
    expect(screen.getByTestId('fallback-reason')).toHaveTextContent('降级原因');
  });

  // ========== 测试10：实验性数据源提示 ==========
  test('测试10: 页面展示"实验性数据源"和"新闻候选不代表股价波动原因"提示', async () => {
    await act(async () => { render(<DevEventSourcesPage />); });

    const experimentalWarnings = screen.getAllByText(/实验性数据源/);
    expect(experimentalWarnings.length).toBeGreaterThan(0);

    expect(screen.getByText(/新闻候选不代表股价波动原因/)).toBeInTheDocument();
  });

  // ========== 测试11：请求参数断言（stockCode、market）新增 ==========
  test('测试11: 查询时实际发出的请求包含正确的 stockCode 和 market 参数', async () => {
    fetchSpy.mockReturnValue(
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => mockNewsResult,
      }) as unknown as Promise<Response>
    );

    await act(async () => { render(<DevEventSourcesPage />); });

    // 默认 600519 / SH
    await act(async () => { fireEvent.click(screen.getByTestId('query-button')); });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    // 断言第一次请求包含正确的 stockCode 和 market
    const firstCall = fetchSpy.mock.calls[0][0] as string;
    expect(firstCall).toContain('stockCode=600519');
    expect(firstCall).toContain('market=SH');

    // 切换到 000001 / SZ
    fetchSpy.mockClear();
    await act(async () => { fireEvent.click(screen.getByTestId('preset-000001')); });
    await act(async () => { fireEvent.click(screen.getByTestId('query-button')); });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    const secondCall = fetchSpy.mock.calls[0][0] as string;
    expect(secondCall).toContain('stockCode=000001');
    expect(secondCall).toContain('market=SZ');
  });

  // ========== 测试12：Real 徽标和近期覆盖限制提示 新增 ==========
  test('测试12: Real 模式结果显示 Real 徽标和"只提供有限近期新闻"提示', async () => {
    fetchSpy.mockReturnValue(
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => mockRealNewsResult,
      }) as unknown as Promise<Response>
    );

    await act(async () => { render(<DevEventSourcesPage />); });

    await act(async () => { fireEvent.click(screen.getByTestId('query-button')); });

    await waitFor(() => {
      expect(screen.getByTestId('result-meta')).toBeInTheDocument();
    });

    // Real 真实 徽标
    expect(screen.getByTestId('mode-badge')).toHaveTextContent('Real 真实');

    // 近期覆盖限制提示
    expect(screen.getByTestId('coverage-limit-hint')).toBeInTheDocument();
    expect(screen.getByTestId('coverage-limit-hint')).toHaveTextContent('当前候选来源只提供有限的近期新闻，不能用于完整历史复盘');
  });

  // ========== 测试13：Mock 模式不显示近期覆盖限制提示 新增 ==========
  test('测试13: Mock 模式结果不显示 coverage-limit-hint', async () => {
    fetchSpy.mockReturnValue(
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => mockNewsResult,
      }) as unknown as Promise<Response>
    );

    await act(async () => { render(<DevEventSourcesPage />); });

    await act(async () => { fireEvent.click(screen.getByTestId('query-button')); });

    await waitFor(() => {
      expect(screen.getByTestId('result-meta')).toBeInTheDocument();
    });

    // Mock 模式不显示近期覆盖限制提示
    expect(screen.queryByTestId('coverage-limit-hint')).not.toBeInTheDocument();
    // Mock 徽标
    expect(screen.getByTestId('mode-badge')).toHaveTextContent('Mock 演示');
  });

  // ========== 测试14：格式合格链接文案（非"有效链接"）新增 ==========
  test('测试14: 链接统计文案显示"格式合格链接"而非"有效链接"', async () => {
    fetchSpy.mockReturnValue(
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => mockRealNewsResult,
      }) as unknown as Promise<Response>
    );

    await act(async () => { render(<DevEventSourcesPage />); });

    await act(async () => { fireEvent.click(screen.getByTestId('query-button')); });

    await waitFor(() => {
      expect(screen.getByTestId('result-meta')).toBeInTheDocument();
    });

    // 文案应为"格式合格链接"
    expect(screen.getByTestId('valid-url-count')).toHaveTextContent('格式合格链接');
    expect(screen.getByTestId('valid-url-count')).not.toHaveTextContent('有效链接');
  });
});
