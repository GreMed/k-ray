/**
 * K-Ray 第九阶段前端测试 - 关键股价节点 UI 行为
 * 覆盖测试要求 9-17：
 *   9. 真实行情查询页能展示关键节点区域
 *   10. 点击节点列表可打开正确详情
 *   11. 详情中明确出现新闻候选说明文案
 *   12. 不出现"涨跌原因""投资建议""买入""卖出"等误导性结论
 *   13. 真实模式不渲染旧功能区域（EventLegend/事件列表/关键节点概览/未来日历）
 *   14. 页面标题统计与关键节点列表数量一致
 *   15. Mock 模式事件数大于 0，并可打开事件、来源和未来事件
 *   16. 成交量单位换算正确（万手）
 *   17. 首日节点不显示虚假前收
 *   18. 图表 marker 真实测试（marker 生成/ID/点击回调）
 *
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import Home from '@/app/page';
import MarketKeyNodeDrawer from '@/components/MarketKeyNodeDrawer';
import ProfessionalKLineChart from '@/components/ProfessionalKLineChart';
import { MarketKeyNode, KLineData } from '@/types';

// === lightweight-charts mock ===
// 捕获 subscribeClick 注册的 clickHandler 和 setMarkers 调用，供测试手动触发
interface MockMouseEventParam {
  hoveredObjectId?: string;
  time?: string;
  point?: { x: number; y: number };
}

interface MockChartMarker {
  id?: string;
  time?: string;
  color?: string;
  [key: string]: unknown;
}

let capturedClickHandler: ((param: MockMouseEventParam) => void) | null = null;
let capturedSetMarkersCall: MockChartMarker[] = [];

jest.mock('lightweight-charts', () => {
  const originalModule = jest.requireActual('lightweight-charts');

  const mockCandlestickSeries = {
    setData: jest.fn(),
    setMarkers: jest.fn((markers: MockChartMarker[]) => {
      capturedSetMarkersCall = markers;
    }),
    applyOptions: jest.fn(),
  };

  const mockChart = {
    addCandlestickSeries: jest.fn(() => mockCandlestickSeries),
    subscribeCrosshairMove: jest.fn(),
    subscribeClick: jest.fn((handler: (param: MockMouseEventParam) => void) => {
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

// Mock global fetch（真实行情查询备用）
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch as unknown as typeof fetch;

// 第十阶段 B：NodeEventDrawer 打开时 fetch /api/node-event-candidates 的 mock 响应
const mockNodeEventCandidates = {
  candidates: [
    {
      id: 'mock-node-event-1',
      queryStockCode: '600519',
      title: '[Mock] 贵州茅台发布季度业绩报告',
      excerpt: 'Mock演示数据',
      publishedAt: '2024-02-05 18:30:00',
      publisher: 'Mock演示来源',
      originalUrl: 'https://example.com/mock-1',
      acquisitionProvider: 'mock',
      upstreamPlatform: 'mock',
      matchedStockCodes: ['600519'],
      stockRelevanceStatus: 'verified',
      verificationReason: '[Mock] 标题明确包含目标公司完整证券简称',
      dataMode: 'mock',
      isRealEventCandidate: false,
      isMultiStockSummary: false,
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
    totalCount: 1,
    verifiedCount: 1,
    unverifiedCount: 0,
    multiStockSummaryCount: 0,
    originalTotalCount: 1,
    cacheStatus: 'miss',
  },
};

// 辅助：构造真实行情响应
function makeRealMarketResponse(stockCode: string = '600519', klineCount: number = 15) {
  const stockId = stockCode === '600519' ? 'stock-sh-600519' : 'stock-sz-000001';
  const market = stockCode === '600519' ? 'SH' : 'SZ';
  const klines = [];
  const baseDate = new Date('2024-04-01');
  for (let i = 0; i < klineCount; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const changePercent = i === 5 ? 6.0 : 0.3;
    const prevClose = i > 0 ? klines[i - 1].close : 100;
    const close = i === 0 ? 100 : prevClose * (1 + changePercent / 100);
    klines.push({
      id: `baostock:${stockId}:${dateStr}`,
      stockId,
      date: dateStr,
      open: prevClose,
      high: close + 3,
      low: close - 3,
      close: Number(close.toFixed(2)),
      volume: 3000000 + i * 100000,
      changePercent: Number(changePercent.toFixed(2)),
    });
  }
  return {
    stock: { id: stockId, code: stockCode, name: '贵州茅台', market },
    klines,
    meta: {
      source: 'baostock',
      sourceLabel: 'BaoStock真实行情(前复权日线)',
      adjustment: 'qfq',
      isRealMarketData: true,
      fetchedAt: '2024-07-01T00:00:00.000Z',
    },
  };
}

describe('第九阶段前端测试 - 关键股价节点', () => {
  let originalNodeEnv: string | undefined;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    jest.clearAllMocks();
    mockFetch.mockClear();
    // 第十阶段 B：为 NodeEventDrawer 的 /api/node-event-candidates 请求提供默认 mock 响应
    // mockResolvedValueOnce 的响应优先消费，因此不会影响 queryRealMarket 中的 klines mock
    mockFetch.mockImplementation((input?: string | URL | Request) => {
      const url = typeof input === 'string'
        ? input
        : (input instanceof URL ? input.href : (input as Request)?.url || '');
      if (url.includes('/api/node-event-candidates')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockNodeEventCandidates,
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not Found' }),
      } as Response);
    });
    capturedClickHandler = null;
    capturedSetMarkersCall = [];
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    consoleErrorSpy.mockRestore();
    // 统一恢复真实 timers，避免测试失败后污染其他用例
    jest.useRealTimers();
  });

  // 辅助：执行真实行情查询
  async function queryRealMarket(stockCode: string = '600519') {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeRealMarketResponse(stockCode),
    } as Response);

    const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/);
    await act(async () => {
      fireEvent.change(input, { target: { value: stockCode } });
    });

    await waitFor(() => {
      const suggestionBtn = screen.getByText(stockCode).closest('button');
      expect(suggestionBtn).toBeInTheDocument();
    });

    const suggestionBtn = screen.getByText(stockCode).closest('button')!;
    await act(async () => { fireEvent.click(suggestionBtn); });

    const queryBtn = screen.getByText('查询行情');
    await act(async () => { fireEvent.click(queryBtn); });

    await waitFor(() => {
      expect(screen.getByTestId('chart-wrapper')).toBeInTheDocument();
    });
  }

  // ========== 测试9：关键节点区域展示 ==========

  test('测试9: 加载有节点样本后展示关键节点区域', async () => {
    await act(async () => { render(<Home />); });

    const sampleBtn = screen.getByTestId('dev-key-node-sample-with-nodes');
    await act(async () => { fireEvent.click(sampleBtn); });

    await waitFor(() => {
      expect(screen.getByTestId('key-node-list')).toBeInTheDocument();
    });

    // 明确断言节点数量大于 0
    const items = screen.getByTestId('key-node-items');
    expect(items.children.length).toBeGreaterThan(0);

    expect(screen.getByTestId('dev-sample-banner')).toBeInTheDocument();
    expect(screen.getAllByText(/开发验收样本/).length).toBeGreaterThan(0);
  });

  test('测试9b: 关键节点列表展示日期、类型和涨跌幅', async () => {
    await act(async () => { render(<Home />); });

    const sampleBtn = screen.getByTestId('dev-key-node-sample-with-nodes');
    await act(async () => { fireEvent.click(sampleBtn); });

    await waitFor(() => {
      expect(screen.getByTestId('key-node-list')).toBeInTheDocument();
    });

    expect(screen.getByText(/点击节点可查看时间邻近的新闻候选/)).toBeInTheDocument();

    const typeTexts = ['单日显著上涨', '单日显著下跌', '阶段高点', '阶段低点'];
    const foundTypes = typeTexts.filter(t => screen.queryAllByText(t).length > 0);
    expect(foundTypes.length).toBeGreaterThan(0);
  });

  // ========== 测试10：点击节点列表打开详情 ==========

  test('测试10: 点击节点列表项打开正确详情', async () => {
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

    const drawer = screen.getByTestId('node-event-drawer');
    expect(drawer.textContent).toContain('600519');
  });

  test('测试10b: 通过开发入口直接打开第一个节点详情', async () => {
    await act(async () => { render(<Home />); });

    const sampleBtn = screen.getByTestId('dev-key-node-sample-with-nodes');
    await act(async () => { fireEvent.click(sampleBtn); });

    await waitFor(() => {
      expect(screen.getByTestId('key-node-list')).toBeInTheDocument();
    });

    const openDetailBtn = screen.getByTestId('dev-key-node-open-first-detail');
    await act(async () => { fireEvent.click(openDetailBtn); });

    await waitFor(() => {
      expect(screen.getByTestId('market-node-drawer')).toBeInTheDocument();
    });
  });

  test('测试10c: 关闭节点详情抽屉', async () => {
    await act(async () => { render(<Home />); });

    const sampleBtn = screen.getByTestId('dev-key-node-sample-with-nodes');
    await act(async () => { fireEvent.click(sampleBtn); });

    await waitFor(() => {
      expect(screen.getByTestId('key-node-list')).toBeInTheDocument();
    });

    const items = screen.getByTestId('key-node-items');
    const firstItem = items.children[0] as HTMLElement;
    await act(async () => { fireEvent.click(firstItem); });

    await waitFor(() => {
      expect(screen.getByTestId('node-event-drawer')).toBeInTheDocument();
    });

    const closeBtn = screen.getByTestId('node-event-drawer-close');
    await act(async () => { fireEvent.click(closeBtn); });

    await waitFor(() => {
      expect(screen.queryByTestId('node-event-drawer')).not.toBeInTheDocument();
    });
  });

  // ========== 测试11：详情中出现新闻候选说明 ==========

  test('测试11: 节点详情中明确出现新闻候选说明文案', async () => {
    await act(async () => { render(<Home />); });

    const sampleBtn = screen.getByTestId('dev-key-node-sample-with-nodes');
    await act(async () => { fireEvent.click(sampleBtn); });

    await waitFor(() => {
      expect(screen.getByTestId('key-node-list')).toBeInTheDocument();
    });

    // 通过 DevToolsPanel 直接打开 MarketKeyNodeDrawer
    const openDetailBtn = screen.getByTestId('dev-key-node-open-first-detail');
    await act(async () => { fireEvent.click(openDetailBtn); });

    await waitFor(() => {
      expect(screen.getByTestId('market-node-drawer')).toBeInTheDocument();
    });

    const evidenceLabel = screen.getByTestId('market-node-evidence-label');
    expect(evidenceLabel.textContent).toContain('可查看时间邻近的新闻候选');

    const riskWarning = screen.getByTestId('market-node-risk-warning');
    expect(riskWarning.textContent).toContain('不代表已确认的涨跌原因');
    expect(riskWarning.textContent).toContain('可查看与该节点时间邻近的新闻候选');
  });

  test('测试11b: 节点详情展示行情事实说明（detailSummary）', async () => {
    await act(async () => { render(<Home />); });

    const sampleBtn = screen.getByTestId('dev-key-node-sample-with-nodes');
    await act(async () => { fireEvent.click(sampleBtn); });

    await waitFor(() => {
      expect(screen.getByTestId('key-node-list')).toBeInTheDocument();
    });

    // 通过 DevToolsPanel 直接打开 MarketKeyNodeDrawer（检查 detailSummary）
    const openDetailBtn = screen.getByTestId('dev-key-node-open-first-detail');
    await act(async () => { fireEvent.click(openDetailBtn); });

    await waitFor(() => {
      expect(screen.getByTestId('market-node-drawer')).toBeInTheDocument();
    });

    const summary = screen.getByTestId('market-node-detail-summary');
    expect(summary.textContent).toContain('收盘价');
    expect(summary.textContent).toContain('成交量');
  });

  // ========== 测试12：不出现误导性结论 ==========

  test('测试12: 节点详情中不出现"涨跌原因""投资建议""买入""卖出"等误导性结论', async () => {
    await act(async () => { render(<Home />); });

    const sampleBtn = screen.getByTestId('dev-key-node-sample-with-nodes');
    await act(async () => { fireEvent.click(sampleBtn); });

    await waitFor(() => {
      expect(screen.getByTestId('key-node-list')).toBeInTheDocument();
    });

    // 通过 DevToolsPanel 直接打开 MarketKeyNodeDrawer（检查误导性结论）
    const openDetailBtn = screen.getByTestId('dev-key-node-open-first-detail');
    await act(async () => { fireEvent.click(openDetailBtn); });

    await waitFor(() => {
      expect(screen.getByTestId('market-node-drawer')).toBeInTheDocument();
    });

    const drawer = screen.getByTestId('market-node-drawer');
    const riskWarning = screen.getByTestId('market-node-risk-warning');
    const evidenceLabel = screen.getByTestId('market-node-evidence-label');
    const drawerText = (drawer.textContent || '')
      .replace(riskWarning.textContent || '', '')
      .replace(evidenceLabel.textContent || '', '');

    const forbiddenPhrases = [
      '涨跌原因', '上涨原因', '下跌原因', '投资建议',
      '建议买入', '建议卖出', '买入', '卖出',
      '利好', '利空', '目标价', '预测涨', '预测跌',
    ];
    for (const phrase of forbiddenPhrases) {
      expect(drawerText).not.toContain(phrase);
    }
  });

  test('测试12b: 关键节点列表中不出现误导性结论', async () => {
    await act(async () => { render(<Home />); });

    const sampleBtn = screen.getByTestId('dev-key-node-sample-with-nodes');
    await act(async () => { fireEvent.click(sampleBtn); });

    await waitFor(() => {
      expect(screen.getByTestId('key-node-list')).toBeInTheDocument();
    });

    const list = screen.getByTestId('key-node-list');
    const listText = list.textContent || '';

    const forbiddenPhrases = [
      '涨跌原因', '上涨原因', '下跌原因', '投资建议',
      '建议买入', '建议卖出', '利好', '利空', '目标价',
    ];
    for (const phrase of forbiddenPhrases) {
      expect(listText).not.toContain(phrase);
    }
  });

  // ========== 空状态测试 ==========

  test('空状态: 加载无节点样本后展示真实空状态', async () => {
    await act(async () => { render(<Home />); });

    const sampleBtn = screen.getByTestId('dev-key-node-sample-no-nodes');
    await act(async () => { fireEvent.click(sampleBtn); });

    await waitFor(() => {
      expect(screen.getByTestId('key-node-list')).toBeInTheDocument();
    });

    expect(screen.getByTestId('key-node-empty')).toBeInTheDocument();
    expect(screen.getByText(/当前区间未识别到符合规则的关键波动节点/)).toBeInTheDocument();
    expect(screen.queryByTestId('key-node-items')).not.toBeInTheDocument();
  });

  // ========== 真实行情查询后关键节点区域展示 ==========

  test('测试9c: 真实行情查询成功后展示关键节点区域', async () => {
    await act(async () => { render(<Home />); });
    await queryRealMarket('600519');

    await waitFor(() => {
      expect(screen.getByTestId('key-node-list')).toBeInTheDocument();
    });

    // 真实行情查询后应自动识别关键节点（第5日 +6% 应为显著上涨）
    const items = screen.queryByTestId('key-node-items');
    expect(items).toBeTruthy();
    expect(items!.children.length).toBeGreaterThan(0);

    // 不应显示开发验收样本标注
    expect(screen.queryByTestId('dev-sample-banner')).not.toBeInTheDocument();
  });

  // ========== 13. 真实模式不渲染旧功能区域 ==========

  test('真实模式不渲染事件列表区域（legacy-event-list）', async () => {
    await act(async () => { render(<Home />); });
    await queryRealMarket('600519');

    expect(screen.queryByTestId('legacy-event-list')).not.toBeInTheDocument();
  });

  test('真实模式不渲染 EventLegend（event-legend）', async () => {
    await act(async () => { render(<Home />); });
    await queryRealMarket('600519');

    expect(screen.queryByTestId('event-legend')).not.toBeInTheDocument();
  });

  test('真实模式不渲染旧关键节点概览（legacy-key-node-overview）', async () => {
    await act(async () => { render(<Home />); });
    await queryRealMarket('600519');

    expect(screen.queryByTestId('legacy-key-node-overview')).not.toBeInTheDocument();
  });

  test('真实模式不渲染未来事件日历（future-event-calendar-wrapper）', async () => {
    await act(async () => { render(<Home />); });
    await queryRealMarket('600519');

    expect(screen.queryByTestId('future-event-calendar-wrapper')).not.toBeInTheDocument();
  });

  test('真实模式不存在旧 Mock 文案', async () => {
    await act(async () => { render(<Home />); });
    await queryRealMarket('600519');

    // 真实模式下不应出现 Mock 演示相关文案
    const pageText = document.body.textContent || '';
    expect(pageText).not.toContain('事件、来源均为模拟生成');
    expect(pageText).not.toContain('事件、来源与未来日历仍为Mock演示数据');
    // 真实模式下应显示新闻候选说明文案
    expect(pageText).toContain('当前可查看与关键节点时间邻近的新闻候选');
  });

  // ========== 14. 页面标题统计与关键节点列表数量一致 ==========

  test('页面标题统计中的关键节点数与列表数量一致', async () => {
    await act(async () => { render(<Home />); });
    await queryRealMarket('600519');

    // 从 result-stats 中解析关键节点数
    const stats = screen.getByTestId('result-stats');
    const statsText = stats.textContent || '';
    const match = statsText.match(/关键节点\s*(\d+)\s*个/);
    expect(match).toBeTruthy();
    const statsCount = parseInt(match![1], 10);
    expect(statsCount).toBeGreaterThan(0);

    // 列表中的节点数应与统计一致
    const items = screen.getByTestId('key-node-items');
    expect(items.children.length).toBe(statsCount);
  });

  // ========== 15. Mock 模式事件数大于 0，并可打开事件、来源和未来事件 ==========

  test('Mock 模式事件数大于 0，并可打开事件、来源和未来事件', async () => {
    await act(async () => { render(<Home />); });

    // 第十四阶段 A1：Mock 模式仅通过开发面板访问（real-market-toggle 已移除）
    jest.useFakeTimers();
    const successBtn = screen.getByTestId('dev-open-success');
    await act(async () => { fireEvent.click(successBtn); });

    await act(async () => { jest.runAllTimers(); });

    await waitFor(() => {
      expect(screen.getByTestId('chart-wrapper')).toBeInTheDocument();
    });

    jest.useRealTimers();

    // 解析事件数并断言大于 0
    const stats = screen.getByTestId('chart-stats');
    const statsText = stats.textContent || '';
    const eventMatch = statsText.match(/事件\s*(\d+)\s*条/);
    expect(eventMatch).toBeTruthy();
    const eventCount = parseInt(eventMatch![1], 10);
    expect(eventCount).toBeGreaterThan(0);

    // Mock 模式下应渲染旧功能区域
    expect(screen.getByTestId('legacy-event-list')).toBeInTheDocument();
    expect(screen.getByTestId('event-legend')).toBeInTheDocument();
    // 第十一阶段 A 方案 A：普通用户界面不再渲染旧 Mock FutureEventCalendar
    expect(screen.queryByTestId('future-event-calendar-wrapper')).not.toBeInTheDocument();

    // 1. 点击一条事件并打开事件详情
    const eventList = screen.getByTestId('legacy-event-list');
    const eventButtons = eventList.querySelectorAll('button');
    expect(eventButtons.length).toBeGreaterThan(0);
    const firstEventBtn = eventButtons[0];
    await act(async () => { fireEvent.click(firstEventBtn); });

    // 断言 event-detail-drawer 打开
    await waitFor(() => {
      expect(screen.getByTestId('event-detail-drawer')).toBeInTheDocument();
    });

    // 2. 从事件详情打开一条来源
    const sourceCards = screen.queryAllByTestId(/^source-card-/);
    expect(sourceCards.length).toBeGreaterThan(0);
    const firstSourceId = sourceCards[0].getAttribute('data-testid')?.replace('source-card-', '');
    expect(firstSourceId).toBeTruthy();
    const viewSourceBtn = screen.getByTestId(`view-source-${firstSourceId}`);
    await act(async () => { fireEvent.click(viewSourceBtn); });

    // 断言 source-detail-modal 打开
    await waitFor(() => {
      expect(screen.getByTestId('source-detail-modal')).toBeInTheDocument();
    });

    // 3. 关闭来源弹窗
    const sourceCloseBtn = screen.getByTestId('source-detail-close');
    await act(async () => { fireEvent.click(sourceCloseBtn); });
    await waitFor(() => {
      expect(screen.queryByTestId('source-detail-modal')).not.toBeInTheDocument();
    });

    // 4. 关闭事件详情后再继续
    const eventDrawer = screen.getByTestId('event-detail-drawer');
    const eventCloseBtn = eventDrawer.querySelector('button');
    expect(eventCloseBtn).toBeTruthy();
    await act(async () => { fireEvent.click(eventCloseBtn!); });
    await waitFor(() => {
      expect(screen.queryByTestId('event-detail-drawer')).not.toBeInTheDocument();
    });

    // 5. 旧 Mock 未来事件日历已移除（第十一阶段 A 方案 A）
    // 跳过未来事件卡片点击步骤，直接测试旧 Mock 节点

    // 7. 点击旧 Mock 节点并打开详情
    const keyNodeOverview = screen.getByTestId('legacy-key-node-overview');
    const nodeButtons = keyNodeOverview.querySelectorAll('button');
    expect(nodeButtons.length).toBeGreaterThan(0);
    await act(async () => { fireEvent.click(nodeButtons[0]); });

    // 断言 node-detail-drawer 打开
    await waitFor(() => {
      expect(screen.getByTestId('node-detail-drawer')).toBeInTheDocument();
    });
  });

  // ========== 16. 成交量单位换算正确（万手） ==========

  test('节点详情成交量显示为万手单位', async () => {
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

    const drawer = screen.getByTestId('node-event-drawer');
    // 成交量应显示"万手"
    expect(drawer.textContent).toContain('万手');
  });

  test('节点列表成交量显示为万手单位', async () => {
    await act(async () => { render(<Home />); });

    const sampleBtn = screen.getByTestId('dev-key-node-sample-with-nodes');
    await act(async () => { fireEvent.click(sampleBtn); });

    await waitFor(() => {
      expect(screen.getByTestId('key-node-list')).toBeInTheDocument();
    });

    const list = screen.getByTestId('key-node-list');
    expect(list.textContent).toContain('万手');
  });

  // ========== 17. 首日节点不显示虚假前收 ==========

  test('首日节点不显示虚假前收数据', () => {
    // 直接渲染 MarketKeyNodeDrawer，传入 previousClose=null 的节点
    const nodeWithNullPrevClose: MarketKeyNode = {
      id: 'significant_up:600519:2024-01-01',
      stockCode: '600519',
      date: '2024-01-01',
      type: 'significant_up',
      title: '单日显著上涨',
      close: 1060,
      changePercent: 6.0,
      volume: 12000000,
      previousClose: null,
      previousVolume: null,
      volumeChangePercent: null,
      detailSummary: '2024-01-01 为查询区间首日，区间内无前收数据，无法计算涨跌幅与成交量变化。',
      evidenceLevel: 'market_data_only',
    };

    render(
      <MarketKeyNodeDrawer
        node={nodeWithNullPrevClose}
        isOpen={true}
        onClose={() => {}}
      />
    );

    // 应显示"区间内无前收数据"
    expect(screen.getByTestId('market-node-no-prev-close')).toBeInTheDocument();
    expect(screen.getByTestId('market-node-no-prev-close').textContent).toContain('区间内无前收数据');

    // 成交量变化应显示"区间内无前一交易日成交量数据"
    const volumeChange = screen.getByTestId('market-node-volume-change');
    expect(volumeChange.textContent).toContain('区间内无前一交易日成交量数据');
  });

  test('有前收数据的节点正常显示前收价', async () => {
    await act(async () => { render(<Home />); });

    const sampleBtn = screen.getByTestId('dev-key-node-sample-with-nodes');
    await act(async () => { fireEvent.click(sampleBtn); });

    await waitFor(() => {
      expect(screen.getByTestId('key-node-list')).toBeInTheDocument();
    });

    // 通过 DevToolsPanel 直接打开 MarketKeyNodeDrawer（检查前收数据）
    const openDetailBtn = screen.getByTestId('dev-key-node-open-first-detail');
    await act(async () => { fireEvent.click(openDetailBtn); });

    await waitFor(() => {
      expect(screen.getByTestId('market-node-drawer')).toBeInTheDocument();
    });

    // 开发样本的第一个节点不在首日，应有前收数据
    expect(screen.queryByTestId('market-node-no-prev-close')).not.toBeInTheDocument();
    // 应显示前收价格
    const drawer = screen.getByTestId('market-node-drawer');
    expect(drawer.textContent).toContain('前收');
  });

  // ========== 图表统计与真实模式文案 ==========

  test('真实行情查询后，图表统计中事件数为 0', async () => {
    await act(async () => { render(<Home />); });
    await queryRealMarket('600519');

    const stats = screen.getByTestId('chart-stats');
    const statsText = stats.textContent || '';
    const eventMatch = statsText.match(/事件\s*(\d+)\s*条/);
    expect(eventMatch).toBeTruthy();
    const eventCount = parseInt(eventMatch![1], 10);
    expect(eventCount).toBe(0);
  });

  test('真实行情查询后，图例显示第九阶段四类节点', async () => {
    await act(async () => { render(<Home />); });
    await queryRealMarket('600519');

    const legend = screen.getByTestId('chart-legend');
    expect(legend.textContent).toContain('单日显著上涨');
    expect(legend.textContent).toContain('单日显著下跌');
    expect(legend.textContent).toContain('阶段高点');
    expect(legend.textContent).toContain('阶段低点');
  });

  test('节点详情显示成交量较前一交易日的变化', async () => {
    await act(async () => { render(<Home />); });

    const sampleBtn = screen.getByTestId('dev-key-node-sample-with-nodes');
    await act(async () => { fireEvent.click(sampleBtn); });

    await waitFor(() => {
      expect(screen.getByTestId('key-node-list')).toBeInTheDocument();
    });

    // 通过 DevToolsPanel 直接打开 MarketKeyNodeDrawer（检查成交量变化）
    const openDetailBtn = screen.getByTestId('dev-key-node-open-first-detail');
    await act(async () => { fireEvent.click(openDetailBtn); });

    await waitFor(() => {
      expect(screen.getByTestId('market-node-drawer')).toBeInTheDocument();
    });

    const volumeChange = screen.getByTestId('market-node-volume-change');
    expect(volumeChange.textContent).toContain('较前一交易日');

    const drawer = screen.getByTestId('market-node-drawer');
    expect(drawer.textContent).toContain('当日成交量');
    expect(drawer.textContent).toContain('万手');
  });

  // ========== 18. 图表 marker 真实测试 ==========

  describe('图表 marker 生成与点击回调', () => {
    // 辅助：构造测试用 K 线和关键节点
    function makeTestKLines(): KLineData[] {
      const klines: KLineData[] = [];
      const baseDate = new Date('2024-04-01');
      for (let i = 0; i < 15; i++) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().slice(0, 10);
        const close = 100 + i;
        klines.push({
          id: `test:${dateStr}`,
          stockId: 'stock-sh-600519',
          date: dateStr,
          open: close,
          high: close + 3,
          low: close - 3,
          close,
          volume: 5000000 + i * 100000,
          changePercent: 0.1,
        });
      }
      return klines;
    }

    function makeTestMarketKeyNodes(klines: KLineData[]): MarketKeyNode[] {
      return [
        {
          id: 'significant_up:600519:2024-04-06',
          stockCode: '600519',
          date: klines[5].date,
          type: 'significant_up',
          title: '单日显著上涨',
          close: 106,
          changePercent: 6.0,
          volume: 8000000,
          previousClose: 100,
          previousVolume: 5000000,
          volumeChangePercent: 60,
          detailSummary: '收盘价较前一交易日上涨 6.0%',
          evidenceLevel: 'market_data_only',
        },
        {
          id: 'significant_down:600519:2024-04-11',
          stockCode: '600519',
          date: klines[10].date,
          type: 'significant_down',
          title: '单日显著下跌',
          close: 94,
          changePercent: -6.0,
          volume: 9000000,
          previousClose: 100,
          previousVolume: 5000000,
          volumeChangePercent: 80,
          detailSummary: '收盘价较前一交易日下跌 6.0%',
          evidenceLevel: 'market_data_only',
        },
      ];
    }

    test('marketKeyNodes 全部生成图表 marker，marker ID 为 mkt-node:${node.id}', () => {
      const klines = makeTestKLines();
      const nodes = makeTestMarketKeyNodes(klines);

      render(
        <ProfessionalKLineChart
          klines={klines}
          marketKeyNodes={nodes}
          stockName="测试股票"
        />
      );

      // 验证 setMarkers 被调用
      expect(capturedSetMarkersCall.length).toBeGreaterThan(0);

      // 过滤出 market-node 类型的 marker
      const mktMarkers = capturedSetMarkersCall.filter(m =>
        m.id && m.id.startsWith('mkt-node:'),
      );

      // marker 数量与节点数量一致
      expect(mktMarkers.length).toBe(nodes.length);

      // 验证每个 marker 的 ID 格式和日期
      nodes.forEach((node) => {
        const marker = mktMarkers.find(m => m.id === `mkt-node:${node.id}`);
        expect(marker).toBeDefined();
        expect(marker!.time).toBe(node.date);
      });
    });

    test('手动触发 marker 点击，onMarketKeyNodeClick 恰好调用一次并收到正确节点', () => {
      const klines = makeTestKLines();
      const nodes = makeTestMarketKeyNodes(klines);
      const mockOnMarketKeyNodeClick = jest.fn();

      render(
        <ProfessionalKLineChart
          klines={klines}
          marketKeyNodes={nodes}
          stockName="测试股票"
          onMarketKeyNodeClick={mockOnMarketKeyNodeClick}
        />
      );

      // 验证 subscribeClick 被调用
      expect(capturedClickHandler).not.toBeNull();

      // 找到第一个节点的 marker ID
      const targetNode = nodes[0];
      const targetMarkerId = `mkt-node:${targetNode.id}`;

      // 手动触发点击
      act(() => {
        capturedClickHandler!({
          hoveredObjectId: targetMarkerId,
          time: targetNode.date,
          point: { x: 100, y: 100 },
        });
      });

      // 验证 onMarketKeyNodeClick 被调用一次
      expect(mockOnMarketKeyNodeClick).toHaveBeenCalledTimes(1);
      // 验证收到的节点正确
      expect(mockOnMarketKeyNodeClick).toHaveBeenCalledWith(
        expect.objectContaining({
          id: targetNode.id,
          stockCode: targetNode.stockCode,
          date: targetNode.date,
          type: targetNode.type,
        }),
      );
    });

    test('页面层点击图表 marker 后打开正确的 MarketKeyNodeDrawer', async () => {
      await act(async () => { render(<Home />); });

      // 加载开发样本
      const sampleBtn = screen.getByTestId('dev-key-node-sample-with-nodes');
      await act(async () => { fireEvent.click(sampleBtn); });

      await waitFor(() => {
        expect(screen.getByTestId('key-node-list')).toBeInTheDocument();
      });

      // 验证 marker 已生成
      expect(capturedSetMarkersCall.length).toBeGreaterThan(0);
      const mktMarkers = capturedSetMarkersCall.filter(m =>
        m.id && m.id.startsWith('mkt-node:'),
      );
      expect(mktMarkers.length).toBeGreaterThan(0);

      // 验证 subscribeClick 已注册
      expect(capturedClickHandler).not.toBeNull();

      // 手动触发第一个 marker 的点击
      const firstMarker = mktMarkers[0];
      await act(async () => {
        capturedClickHandler!({
          hoveredObjectId: firstMarker.id,
          time: firstMarker.time,
          point: { x: 100, y: 100 },
        });
      });

      // 验证 NodeEventDrawer 打开
      await waitFor(() => {
        expect(screen.getByTestId('node-event-drawer')).toBeInTheDocument();
      });
    });
  });
});
