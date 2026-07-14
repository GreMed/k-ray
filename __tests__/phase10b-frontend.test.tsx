/**
 * K-Ray 第十阶段 B 前端测试 - NodeEventDrawer 组件与页面交互
 * 覆盖测试：
 *   1. 点击关键节点列表项打开候选抽屉
 *   2. 正确显示节点信息与检索窗口
 *   3. Mock 候选显示（标题/时间/来源/链接/相关性/理由/模式徽标）
 *   4. 空候选状态
 *   5. 请求失败状态
 *   6. Fallback 降级状态
 *   7. 待人工确认内容不会被标为"已验证相关"
 *   8. 页面不存在因果归因、预测或投资建议文案
 *   9. 关闭抽屉（关闭按钮 + 遮罩层）
 *  10. 图表 marker 点击打开 NodeEventDrawer（端到端）
 *  11. 图表 marker 点击后 API 请求包含正确的 stockCode、market、nodeDate
 *  12. 原有列表项点击打开抽屉测试仍正常工作（回归保护）
 *
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import Home from '@/app/page';

// === lightweight-charts mock ===
// 捕获 subscribeClick 注册的 clickHandler 和 setMarkers 调用，供测试手动触发 marker 点击
let capturedClickHandler: ((param: { hoveredObjectId?: string }) => void) | null = null;
let capturedSetMarkersCall: Array<{ id?: string; time?: string }> = [];

jest.mock('lightweight-charts', () => {
  const originalModule = jest.requireActual('lightweight-charts');

  const mockCandlestickSeries = {
    setData: jest.fn(),
    setMarkers: jest.fn((markers: Array<{ id?: string; time?: string }>) => {
      capturedSetMarkersCall = markers;
    }),
    applyOptions: jest.fn(),
  };

  const mockChart = {
    addCandlestickSeries: jest.fn(() => mockCandlestickSeries),
    subscribeCrosshairMove: jest.fn(),
    subscribeClick: jest.fn((handler: (param: { hoveredObjectId?: string }) => void) => {
      capturedClickHandler = handler;
    }),
    unsubscribeCrosshairMove: jest.fn(),
    unsubscribeClick: jest.fn(),
    applyOptions: jest.fn(),
    timeScale: jest.fn(() => ({
      fitContent: jest.fn(),
    })),
    remove: jest.fn(),
  };

  return {
    ...originalModule,
    createChart: jest.fn(() => mockChart),
    CrosshairMode: {
      Normal: 0,
      Magnet: 1,
    },
  };
});

// === Mock global fetch ===
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch as unknown as typeof fetch;

// === Mock 数据 ===
const mockNodeEventResult = {
  candidates: [
    {
      id: 'mock-node-event-1',
      queryStockCode: '600519',
      title: '[Mock] 贵州茅台发布季度业绩报告',
      excerpt: 'Mock演示数据。贵州茅台发布季度业绩报告。',
      publishedAt: '2024-02-05 18:30:00',
      publisher: 'Mock演示来源',
      originalUrl: 'https://example.com/mock-1',
      acquisitionProvider: 'mock',
      upstreamPlatform: 'mock',
      matchedStockCodes: ['600519'],
      stockRelevanceStatus: 'verified',
      verificationReason: '[Mock] 标题明确包含目标公司完整证券简称（贵州茅台）',
      dataMode: 'mock',
      isRealEventCandidate: false,
      isMultiStockSummary: false,
      fetchedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'mock-node-event-2',
      queryStockCode: '600519',
      title: '[Mock] 板块资金流一览，贵州茅台等多股受到关注',
      excerpt: 'Mock演示数据。板块资金流汇总。',
      publishedAt: '2024-02-06 09:15:00',
      publisher: 'Mock演示来源',
      originalUrl: 'https://example.com/mock-2',
      acquisitionProvider: 'mock',
      upstreamPlatform: 'mock',
      matchedStockCodes: ['600519'],
      stockRelevanceStatus: 'unverified',
      verificationReason: '[Mock] 多股汇总候选',
      dataMode: 'mock',
      isRealEventCandidate: false,
      isMultiStockSummary: true,
      fetchedAt: '2024-01-01T00:00:00.000Z',
    },
  ],
  meta: {
    dataMode: 'mock',
    provider: 'mock',
    upstreamPlatform: 'mock',
    sourceLabel: 'Mock演示候选(开发验收)',
    isRealData: false,
    fetchedAt: '2024-01-01T00:00:00.000Z',
    nodeDate: '2024-02-06',
    windowStart: '2024-02-03',
    windowEnd: '2024-02-09',
    totalCount: 2,
    verifiedCount: 1,
    unverifiedCount: 1,
    multiStockSummaryCount: 1,
    originalTotalCount: 2,
    cacheStatus: 'miss',
  },
};

const mockEmptyResult = {
  candidates: [],
  meta: {
    dataMode: 'mock',
    provider: 'mock',
    upstreamPlatform: 'mock',
    sourceLabel: 'Mock演示候选(开发验收)',
    isRealData: false,
    fetchedAt: '2024-01-01T00:00:00.000Z',
    nodeDate: '2024-02-06',
    windowStart: '2024-02-03',
    windowEnd: '2024-02-09',
    totalCount: 0,
    verifiedCount: 0,
    unverifiedCount: 0,
    multiStockSummaryCount: 0,
    originalTotalCount: 5,
    cacheStatus: 'miss',
  },
};

const mockFallbackResult = {
  candidates: [{ ...mockNodeEventResult.candidates[0], dataMode: 'fallback' }],
  meta: {
    ...mockNodeEventResult.meta,
    dataMode: 'fallback',
    fallbackReason: 'AKShare真实新闻暂时不可用，当前已降级为本地Mock数据',
  },
};

// 辅助：设置 node-event-candidates 接口的 mock 响应
function setNodeEventResponse(response: unknown, ok: boolean = true) {
  mockFetch.mockImplementation((input?: string | URL | Request) => {
    const url = typeof input === 'string'
      ? input
      : (input instanceof URL ? input.href : (input as Request)?.url || '');
    if (url.includes('/api/node-event-candidates')) {
      return Promise.resolve({
        ok,
        status: ok ? 200 : 500,
        json: async () => response,
      } as Response);
    }
    // 兜底：其他请求返回 404
    return Promise.resolve({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not Found' }),
    } as Response);
  });
}

describe('第十阶段 B 前端测试 - NodeEventDrawer 组件与页面交互', () => {
  let originalNodeEnv: string | undefined;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    jest.clearAllMocks();
    mockFetch.mockClear();
    capturedClickHandler = null;
    capturedSetMarkersCall = [];
    // 默认返回 mockNodeEventResult
    setNodeEventResponse(mockNodeEventResult);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    consoleErrorSpy.mockRestore();
    jest.useRealTimers();
  });

  // 辅助：加载开发验收样本并点击第一个关键节点打开抽屉
  async function loadSampleAndOpenDrawer() {
    await act(async () => { render(<Home />); });

    const sampleBtn = screen.getByTestId('dev-key-node-sample-with-nodes');
    await act(async () => { fireEvent.click(sampleBtn); });

    await waitFor(() => {
      expect(screen.getByTestId('key-node-list')).toBeInTheDocument();
    });

    const items = screen.getByTestId('key-node-items');
    expect(items.children.length).toBeGreaterThan(0);
    const firstItem = items.children[0] as HTMLElement;

    await act(async () => { fireEvent.click(firstItem); });

    await waitFor(() => {
      expect(screen.getByTestId('node-event-drawer')).toBeInTheDocument();
    });
  }

  // ========== 测试1：点击关键节点打开候选抽屉 ==========

  test('测试1: 点击关键节点打开候选抽屉，抽屉与关闭按钮均可见', async () => {
    await loadSampleAndOpenDrawer();

    expect(screen.getByTestId('node-event-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('node-event-drawer-close')).toBeInTheDocument();
  });

  // ========== 测试2：正确显示节点信息与检索窗口 ==========

  test('测试2: 抽屉中正确显示节点日期、涨跌幅、检索范围与窗口起止日期', async () => {
    await loadSampleAndOpenDrawer();

    // 等待候选加载完成（窗口起止日期在 result 返回后才渲染）
    await waitFor(() => {
      expect(screen.getByTestId('node-event-window-start')).toBeInTheDocument();
    });

    // 节点信息区可见
    const infoSection = screen.getByTestId('node-event-section-info');
    expect(infoSection).toBeInTheDocument();
    // 节点日期显示（YYYY-MM-DD 格式）
    expect(infoSection.textContent).toMatch(/\d{4}-\d{2}-\d{2}/);

    // 涨跌幅可见
    const changePercent = screen.getByTestId('node-event-change-percent');
    expect(changePercent).toBeInTheDocument();
    expect(changePercent.textContent).toMatch(/-?\d+\.\d+%/);

    // 检索范围区可见
    expect(screen.getByTestId('node-event-section-window')).toBeInTheDocument();

    // 窗口起止日期
    expect(screen.getByTestId('node-event-window-start')).toHaveTextContent('2024-02-03');
    expect(screen.getByTestId('node-event-window-end')).toHaveTextContent('2024-02-09');
  });

  // ========== 测试3：Mock 候选显示 ==========

  test('测试3: Mock 候选正确显示标题、时间、来源、链接、相关性、理由与模式徽标', async () => {
    await loadSampleAndOpenDrawer();

    // 等待候选列表渲染
    await waitFor(() => {
      expect(screen.getByTestId('node-event-candidate-list')).toBeInTheDocument();
    });

    // 候选标题
    expect(screen.getByTestId('node-event-candidate-title-0')).toHaveTextContent(
      '[Mock] 贵州茅台发布季度业绩报告',
    );

    // 候选时间
    expect(screen.getByTestId('node-event-candidate-time-0')).toHaveTextContent(
      '2024-02-05 18:30:00',
    );

    // 候选来源
    expect(screen.getByTestId('node-event-candidate-source-0')).toHaveTextContent(
      'Mock演示来源',
    );

    // 候选链接（显示域名）
    const link = screen.getByTestId('node-event-candidate-link-0');
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent('example.com');
    expect(link.getAttribute('href')).toBe('https://example.com/mock-1');

    // 相关性状态
    expect(screen.getByTestId('node-event-candidate-relevance-0')).toHaveTextContent(
      '已验证相关',
    );

    // 列入理由
    expect(screen.getByTestId('node-event-candidate-reason-0')).toHaveTextContent(
      '[Mock] 标题明确包含目标公司完整证券简称（贵州茅台）',
    );

    // 模式徽标
    expect(screen.getByTestId('node-event-mode-badge')).toHaveTextContent('Mock 演示');
  });

  // ========== 测试4：空候选状态 ==========

  test('测试4: mock fetch 返回空候选列表时展示空状态与"暂无可核验的事件候选"', async () => {
    setNodeEventResponse(mockEmptyResult);

    await loadSampleAndOpenDrawer();

    await waitFor(() => {
      expect(screen.getByTestId('node-event-empty')).toBeInTheDocument();
    });

    expect(screen.getByTestId('node-event-empty')).toHaveTextContent(
      '暂无可核验的事件候选',
    );
    expect(screen.queryByTestId('node-event-candidate-list')).not.toBeInTheDocument();
  });

  // ========== 测试5：请求失败状态 ==========

  test('测试5: mock fetch 返回错误时展示错误状态与"检索失败"', async () => {
    setNodeEventResponse({ error: '上游接口异常' }, false);

    await loadSampleAndOpenDrawer();

    await waitFor(() => {
      expect(screen.getByTestId('node-event-error')).toBeInTheDocument();
    });

    expect(screen.getByTestId('node-event-error')).toHaveTextContent('检索失败');
    expect(screen.getByTestId('node-event-error')).toHaveTextContent('上游接口异常');
    expect(screen.queryByTestId('node-event-candidate-list')).not.toBeInTheDocument();
  });

  // ========== 测试6：Fallback 降级状态 ==========

  test('测试6: mock fetch 返回带 fallbackReason 的数据时展示降级说明', async () => {
    setNodeEventResponse(mockFallbackResult);

    await loadSampleAndOpenDrawer();

    await waitFor(() => {
      expect(screen.getByTestId('node-event-fallback-reason')).toBeInTheDocument();
    });

    expect(screen.getByTestId('node-event-fallback-reason')).toHaveTextContent(
      'AKShare真实新闻暂时不可用，当前已降级为本地Mock数据',
    );

    // 模式徽标应为 Fallback 降级
    expect(screen.getByTestId('node-event-mode-badge')).toHaveTextContent('Fallback 降级');
  });

  // ========== 测试7：待人工确认内容不会被标为"已验证相关" ==========

  test('测试7: unverified 候选显示"待人工确认"，verified 候选显示"已验证相关"，多股汇总显示"多股汇总"', async () => {
    await loadSampleAndOpenDrawer();

    await waitFor(() => {
      expect(screen.getByTestId('node-event-candidate-list')).toBeInTheDocument();
    });

    // 候选0: verified → "已验证相关"
    expect(screen.getByTestId('node-event-candidate-relevance-0')).toHaveTextContent(
      '已验证相关',
    );
    // 候选0 不应显示"待人工确认"
    expect(screen.getByTestId('node-event-candidate-relevance-0')).not.toHaveTextContent(
      '待人工确认',
    );

    // 候选1: unverified → "待人工确认"
    expect(screen.getByTestId('node-event-candidate-relevance-1')).toHaveTextContent(
      '待人工确认',
    );
    // 候选1 不应显示"已验证相关"
    expect(screen.getByTestId('node-event-candidate-relevance-1')).not.toHaveTextContent(
      '已验证相关',
    );

    // 候选1: isMultiStockSummary=true → "多股汇总"徽标
    expect(screen.getByTestId('node-event-candidate-multi-stock-1')).toHaveTextContent(
      '多股汇总',
    );

    // 候选0 不应显示"多股汇总"徽标
    expect(screen.queryByTestId('node-event-candidate-multi-stock-0')).not.toBeInTheDocument();
  });

  // ========== 测试8：页面不存在因果归因、预测或投资建议文案 ==========

  test('测试8: 抽屉中不包含因果结论与投资建议文案，阅读提示包含"不构成涨跌原因或投资建议"', async () => {
    await loadSampleAndOpenDrawer();

    await waitFor(() => {
      expect(screen.getByTestId('node-event-candidate-list')).toBeInTheDocument();
    });

    const drawer = screen.getByTestId('node-event-drawer');
    const readingTip = screen.getByTestId('node-event-reading-tip');

    // 阅读提示可见
    expect(readingTip).toBeInTheDocument();
    // 阅读提示包含"不构成涨跌原因或投资建议"
    expect(readingTip.textContent).toContain('不构成涨跌原因或投资建议');

    // 抽屉文本中移除阅读提示和笔记提示内容后再检查禁忌词
    // 第十二阶段 A 的笔记提示包含"价格预测"作为免责声明，不是预测性声明
    const replayNoteTip = screen.queryByTestId('replay-note-tip');
    const replayNoteTipText = replayNoteTip?.textContent || '';
    const drawerText = (drawer.textContent || '')
      .replace(readingTip.textContent || '', '')
      .replace(replayNoteTipText, '');

    const forbiddenCausalPhrases = [
      '导致上涨', '利好推动', '下跌原因', '上涨原因',
      '导致下跌', '利好', '利空',
    ];
    for (const phrase of forbiddenCausalPhrases) {
      expect(drawerText).not.toContain(phrase);
    }

    const forbiddenAdvicePhrases = [
      '买入', '卖出', '投资建议', '预测',
      '建议买入', '建议卖出', '目标价',
    ];
    for (const phrase of forbiddenAdvicePhrases) {
      expect(drawerText).not.toContain(phrase);
    }
  });

  // ========== 测试9：关闭抽屉 ==========

  test('测试9a: 点击关闭按钮关闭抽屉', async () => {
    await loadSampleAndOpenDrawer();

    expect(screen.getByTestId('node-event-drawer')).toBeInTheDocument();

    const closeBtn = screen.getByTestId('node-event-drawer-close');
    await act(async () => { fireEvent.click(closeBtn); });

    await waitFor(() => {
      expect(screen.queryByTestId('node-event-drawer')).not.toBeInTheDocument();
    });
  });

  test('测试9b: 点击遮罩层关闭抽屉', async () => {
    await loadSampleAndOpenDrawer();

    expect(screen.getByTestId('node-event-drawer')).toBeInTheDocument();

    const overlay = screen.getByTestId('node-event-drawer-overlay');
    await act(async () => { fireEvent.click(overlay); });

    await waitFor(() => {
      expect(screen.queryByTestId('node-event-drawer')).not.toBeInTheDocument();
    });
  });

  // ========== 测试10：图表 marker 点击打开 NodeEventDrawer ==========

  // 辅助：加载开发验收样本（不点击列表项），仅渲染图表
  async function loadSampleForChartClick() {
    await act(async () => { render(<Home />); });

    const sampleBtn = screen.getByTestId('dev-key-node-sample-with-nodes');
    await act(async () => { fireEvent.click(sampleBtn); });

    await waitFor(() => {
      expect(screen.getByTestId('key-node-list')).toBeInTheDocument();
    });

    // 等待图表渲染并捕获 marker
    await waitFor(() => {
      expect(capturedSetMarkersCall.length).toBeGreaterThan(0);
    });
  }

  // 辅助：触发图表 marker 点击（第一个 market-node marker）
  async function triggerChartMarkerClick(markerIndex: number = 0) {
    const marketNodeMarkers = capturedSetMarkersCall.filter(m => m.id?.startsWith('mkt-node:'));
    if (marketNodeMarkers.length === 0) {
      throw new Error('未找到 market-node marker');
    }
    const targetMarker = marketNodeMarkers[markerIndex];
    if (!targetMarker || !targetMarker.id) {
      throw new Error(`未找到第 ${markerIndex} 个 market-node marker`);
    }
    if (!capturedClickHandler) {
      throw new Error('clickHandler 未捕获');
    }
    await act(async () => {
      capturedClickHandler!({ hoveredObjectId: targetMarker.id });
    });
  }

  test('测试10: 模拟点击图表 marker 打开 NodeEventDrawer 并显示正确的节点信息', async () => {
    await loadSampleForChartClick();

    // 从列表中获取第一个节点的信息（用于后续比对）
    const listItems = screen.getByTestId('key-node-items');
    const firstListItem = listItems.children[0] as HTMLElement;
    const firstItemText = firstListItem.textContent || '';
    // 从列表项中提取日期
    const dateMatch = firstItemText.match(/\d{4}-\d{2}-\d{2}/);
    expect(dateMatch).toBeTruthy();
    const expectedDate = dateMatch![0];
    // 从列表项中提取涨跌幅
    const changeMatch = firstItemText.match(/([+-]?\d+\.\d+)%/);
    expect(changeMatch).toBeTruthy();
    const expectedChange = changeMatch![1];

    // 触发图表 marker 点击
    await triggerChartMarkerClick(0);

    // 验证抽屉打开
    await waitFor(() => {
      expect(screen.getByTestId('node-event-drawer')).toBeInTheDocument();
    });

    // 验证节点日期正确
    const infoSection = screen.getByTestId('node-event-section-info');
    expect(infoSection.textContent).toContain(expectedDate);

    // 验证股票代码正确（开发样本为 600519）
    expect(infoSection.textContent).toContain('600519');

    // 验证涨跌幅正确
    const changePercent = screen.getByTestId('node-event-change-percent');
    expect(changePercent.textContent).toContain(expectedChange);
  });

  test('测试11: 图表 marker 点击后 API 请求包含正确的 stockCode、market、nodeDate', async () => {
    await loadSampleForChartClick();

    // 清除之前的 fetch 调用记录
    mockFetch.mockClear();

    // 触发图表 marker 点击
    await triggerChartMarkerClick(0);

    // 等待抽屉打开并发起 API 请求
    await waitFor(() => {
      expect(screen.getByTestId('node-event-drawer')).toBeInTheDocument();
    });

    // 验证 fetch 被调用
    expect(mockFetch).toHaveBeenCalled();

    // 从最后一次调用中提取 URL
    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    const callUrl = typeof lastCall[0] === 'string'
      ? lastCall[0]
      : (lastCall[0] instanceof URL ? lastCall[0].href : (lastCall[0] as Request)?.url || '');

    // 验证 URL 包含正确的参数
    expect(callUrl).toContain('/api/node-event-candidates');
    expect(callUrl).toContain('stockCode=600519');
    expect(callUrl).toContain('market=SH');

    // 验证 nodeDate 参数存在且格式正确
    const urlObj = new URL(callUrl, 'http://localhost');
    const nodeDate = urlObj.searchParams.get('nodeDate');
    expect(nodeDate).toBeTruthy();
    expect(nodeDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // 验证 nodeDate 与列表中第一个节点的日期一致
    const listItems = screen.getByTestId('key-node-items');
    const firstListItem = listItems.children[0] as HTMLElement;
    const firstItemText = firstListItem.textContent || '';
    const dateMatch = firstItemText.match(/\d{4}-\d{2}-\d{2}/);
    expect(dateMatch).toBeTruthy();
    expect(nodeDate).toBe(dateMatch![0]);
  });

  test('测试12: 原有列表项点击打开抽屉测试仍正常工作', async () => {
    // 确保原有列表项点击路径不被破坏
    await loadSampleAndOpenDrawer();

    expect(screen.getByTestId('node-event-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('node-event-drawer-close')).toBeInTheDocument();
  });
});
