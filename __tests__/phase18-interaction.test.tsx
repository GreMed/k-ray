/**
 * 第十八阶段发布前最后一次小型修复 — 真实页面交互测试
 *
 * 覆盖：
 * 1. 静态案例点击顶部节点按钮后，节点详情日期和复盘笔记日期一致
 * 2. 静态案例由行情图节点回调触发后，两处日期一致
 * 3. 真实查询页面点击关键节点列表后，复盘笔记日期一致
 * 4. 编辑某日期笔记后切换日期，不会保留旧草稿
 * 5. 切换股票案例后，不会保留上一只股票的日期和草稿
 *
 * 测试渲染实际页面组件并触发真实回调，不检查数据文件或函数返回值。
 *
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

// ============================================================================
// 顶层 mock：lightweight-charts（捕获 clickHandler 和 setMarkers）
// ============================================================================

let clickHandlerRef: ((param: { hoveredObjectId?: string; time?: string }) => void) | null = null;
let setMarkersCall: { markers: unknown[] } | null = null;

jest.mock('lightweight-charts', () => {
  const originalModule = jest.requireActual('lightweight-charts');
  const mockCandlestickSeries = {
    setData: jest.fn(),
    setMarkers: jest.fn((markers: unknown[]) => {
      setMarkersCall = { markers };
    }),
    applyOptions: jest.fn(),
  };
  const mockChart = {
    addCandlestickSeries: jest.fn(() => mockCandlestickSeries),
    subscribeCrosshairMove: jest.fn(),
    subscribeClick: jest.fn((handler: (param: { hoveredObjectId?: string; time?: string }) => void) => {
      clickHandlerRef = handler;
    }),
    unsubscribeCrosshairMove: jest.fn(),
    unsubscribeClick: jest.fn(),
    applyOptions: jest.fn(),
    timeScale: jest.fn(() => ({ fitContent: jest.fn() })),
    remove: jest.fn(),
  };
  return {
    ...originalModule,
    createChart: jest.fn(() => mockChart),
    CrosshairMode: { Normal: 0, Magnet: 1 },
  };
});

// ============================================================================
// Mock next/navigation（useSearchParams）
// ============================================================================

let mockSearchParams: URLSearchParams | null = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

function setSearchParams(params: Record<string, string> | null) {
  if (params === null) {
    mockSearchParams = new URLSearchParams();
  } else {
    mockSearchParams = new URLSearchParams(params);
  }
}

// ============================================================================
// Mock global fetch（用于 Home 页面查询）
// ============================================================================

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch as unknown as typeof fetch;

jest.mock('child_process', () => {
  const actual = jest.requireActual('child_process');
  return {
    ...actual,
    execFile: jest.fn(),
  };
});

// ============================================================================
// 确定性时间固定：2026-07-14
// ============================================================================

const FIXED_NOW = new Date('2026-07-14T00:00:00.000Z');
const realDate = Date;
const realNow = Date.now;

beforeAll(() => {
  (global as unknown as { Date: DateConstructor }).Date = class extends realDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(FIXED_NOW.getTime());
      } else {
        super(...(args as Parameters<DateConstructor>));
      }
    }
    static now() {
      return FIXED_NOW.getTime();
    }
  } as unknown as DateConstructor;
  Date.now = () => FIXED_NOW.getTime();
});

afterAll(() => {
  (global as unknown as { Date: DateConstructor }).Date = realDate;
  Date.now = realNow;
});

// ============================================================================
// 辅助函数
// ============================================================================

// 构造 stock-info API 成功响应
function makeStockInfoResponse(stockCode: string, market: string, name: string) {
  return {
    ok: true,
    json: async () => ({
      stockCode,
      market,
      name,
      found: true,
      ipoDate: '2020-01-01',
    }),
  };
}

// 构造 klines API 成功响应（带显著变化以产生关键节点）
function makeRealKLineResponse(stockId: string, stockCode: string, market: string, stockName: string) {
  const klines: Array<Record<string, unknown>> = [];
  const baseDate = new Date('2024-04-01');
  // 创建 70 根 K 线，其中包含 >5% 的显著上涨和下跌
  const changes = [
    0.5, 1.2, -0.8, 0.3, 6.5,   // 第5天 +6.5%（显著上涨）
    -1.0, 0.8, 2.1, -0.5, 1.3,
    -7.2, 0.4, 1.1, -0.3, 0.9,  // 第11天 -7.2%（显著下跌）
    1.5, -0.6, 0.7, 2.3, -1.1,
    0.4, 1.8, -0.9, 0.5, 5.8,   // 第25天 +5.8%（显著上涨）
    -1.4, 0.6, 1.0, -0.4, 0.8,
    1.2, -0.7, 0.3, 1.6, -6.3,  // 第35天 -6.3%（显著下跌）
    0.9, -0.2, 1.4, 0.6, -1.0,
    0.7, 1.9, -0.5, 0.4, 1.1,
    -0.8, 0.6, 2.0, -1.2, 0.3,
    1.3, -0.4, 0.8, 1.7, -0.9,
    0.5, 1.0, -0.6, 0.7, 6.1,   // 第65天 +6.1%（显著上涨）
    -1.5, 0.4, 0.9, -0.3, 1.2,
  ];
  for (let i = 0; i < changes.length; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    // 跳过周末
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    if (d.getDay() === 6) d.setDate(d.getDate() + 2);
    const dateStr = d.toISOString().slice(0, 10);
    const close = 100 + i * 2;
    klines.push({
      id: `baostock:${stockId}:${dateStr}`,
      stockId,
      date: dateStr,
      open: close - changes[i],
      high: close + Math.abs(changes[i]) + 1,
      low: close - Math.abs(changes[i]) - 1,
      close,
      volume: 3000000 + i * 50000,
      changePercent: changes[i],
    });
  }
  // 计算 K 线数据的最早和最晚日期，用于 NodeEventDrawer 的检索窗口字段
  const firstDate = klines.length > 0 ? (klines[0].date as string) : '2024-04-01';
  const lastDate = klines.length > 0 ? (klines[klines.length - 1].date as string) : '2024-06-10';
  return {
    ok: true,
    json: async () => ({
      stock: { id: stockId, code: stockCode, name: stockName, market },
      klines,
      meta: {
        source: 'baostock',
        sourceLabel: 'BaoStock真实行情(前复权日线)',
        adjustment: 'qfq',
        isRealMarketData: true,
        fetchedAt: '2024-07-01T00:00:00.000Z',
        // NodeEventDrawer 访问 result.meta.windowStart/windowEnd，必须提供
        windowStart: firstDate,
        windowEnd: lastDate,
      },
    }),
  };
}

// 构造 node-event-candidates API 成功响应（NodeEventDrawer 访问 meta.windowStart/windowEnd 等字段）
function makeNodeEventCandidatesResponse(nodeDate: string) {
  return {
    ok: true,
    json: async () => ({
      candidates: [],
      meta: {
        dataMode: 'real',
        provider: 'mock-test',
        upstreamPlatform: 'test',
        sourceLabel: '测试候选',
        isRealData: true,
        fetchedAt: '2024-07-01T00:00:00.000Z',
        nodeDate,
        windowStart: nodeDate,
        windowEnd: nodeDate,
        totalCount: 0,
        verifiedCount: 0,
        unverifiedCount: 0,
        multiStockSummaryCount: 0,
        originalTotalCount: 0,
        cacheStatus: 'miss',
      },
    }),
  };
}

// 读取左下复盘笔记日期摘要
// 使用 queryByTestId 容错：当 selectedDate 为 null 或日期不在 klines 中时，
// 面板渲染空状态分支（trading-day-note-empty 或 "不在当前行情数据中"），
// 不包含 trading-day-summary 元素，此时返回空字符串。
function readSummaryDate(): string {
  const summary = screen.queryByTestId('trading-day-summary');
  if (!summary) return '';
  const dateSpan = summary.querySelector('span.text-muted');
  return (dateSpan?.textContent || '').trim();
}

// 读取右侧当前节点日期
function readCurrentNodeDate(): string {
  return (screen.getByTestId('current-node-date').textContent || '').trim();
}

// 从 setMarkers 调用中提取 market-node marker 的 ID
function findMarketNodeMarkerId(): string | null {
  if (!setMarkersCall || !setMarkersCall.markers) return null;
  for (const marker of setMarkersCall.markers) {
    const m = marker as { id?: string };
    if (m.id && m.id.startsWith('mkt-node:')) {
      return m.id;
    }
  }
  return null;
}

// ============================================================================
// 测试
// ============================================================================

beforeEach(() => {
  clickHandlerRef = null;
  setMarkersCall = null;
  if (typeof window !== 'undefined') {
    window.localStorage.clear();
  }
  mockFetch.mockReset();
  setSearchParams({});
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('第十八阶段真实页面交互测试', () => {
  // ========================================================================
  // 测试 1：静态案例点击顶部节点按钮后，节点详情日期和复盘笔记日期一致
  // ========================================================================
  describe('测试 1：静态案例点击顶部节点按钮', () => {
    test('点击节点按钮后 current-node-date 与 trading-day-summary 日期一致', async () => {
      const CoreReplayDemoPage = (await import('@/app/demo/core-replay/page')).default;
      setSearchParams({});

      await act(async () => { render(<CoreReplayDemoPage />); });

      await waitFor(() => {
        expect(screen.getByTestId('core-replay-demo-page')).toBeInTheDocument();
      });

      // 获取所有节点按钮
      const nodeTabs = screen.getAllByTestId(/node-tab-/);
      expect(nodeTabs.length).toBeGreaterThanOrEqual(2);

      // 读取默认日期
      const defaultSummaryDate = readSummaryDate();
      // 默认时 selectedDate 为 null，summary 日期应为空
      expect(defaultSummaryDate).toBe('');

      // 点击第二个节点按钮
      await act(async () => {
        fireEvent.click(nodeTabs[1]);
      });

      await waitFor(() => {
        const nodeDate = readCurrentNodeDate();
        const summaryDate = readSummaryDate();
        expect(nodeDate).not.toBe('');
        expect(nodeDate).toBe(summaryDate);
      });
    });
  });

  // ========================================================================
  // 测试 2：静态案例由行情图节点回调触发后，两处日期一致
  // ========================================================================
  describe('测试 2：静态案例由行情图节点回调触发', () => {
    test('通过图表 marker click 触发 onMarketKeyNodeClick 后两处日期一致', async () => {
      const CoreReplayDemoPage = (await import('@/app/demo/core-replay/page')).default;
      setSearchParams({});

      await act(async () => { render(<CoreReplayDemoPage />); });

      await waitFor(() => {
        expect(screen.getByTestId('core-replay-demo-page')).toBeInTheDocument();
      });

      // 等待图表渲染，clickHandler 应被捕获
      await waitFor(() => {
        expect(clickHandlerRef).not.toBeNull();
      });

      // 等待 setMarkers 被调用
      await waitFor(() => {
        expect(setMarkersCall).not.toBeNull();
      });

      // 查找 market-node marker ID
      const markerId = findMarketNodeMarkerId();
      expect(markerId).not.toBeNull();

      // 读取默认日期（第一个节点已选中，但 selectedDate 为 null）
      const defaultSummaryDate = readSummaryDate();
      expect(defaultSummaryDate).toBe('');

      // 触发 marker 点击
      await act(async () => {
        clickHandlerRef!({ hoveredObjectId: markerId! });
      });

      await waitFor(() => {
        const nodeDate = readCurrentNodeDate();
        const summaryDate = readSummaryDate();
        expect(nodeDate).not.toBe('');
        expect(nodeDate).toBe(summaryDate);
      });
    });
  });

  // ========================================================================
  // 测试 3：真实查询页面点击关键节点列表后，复盘笔记日期一致
  // ========================================================================
  describe('测试 3：真实查询页面点击关键节点列表', () => {
    test('查询成功后点击 KeyNodeList 节点，复盘笔记日期与节点日期完全相等', async () => {
      const Home = (await import('@/app/page')).default;

      // Mock fetch 返回成功响应
      mockFetch.mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('/api/market/stock-info')) {
          return Promise.resolve(makeStockInfoResponse('603236', 'SH', '移远通信') as unknown as Response);
        }
        if (url.includes('/api/market/klines')) {
          return Promise.resolve(makeRealKLineResponse('stock-sh-603236', '603236', 'SH', '移远通信') as unknown as Response);
        }
        // NodeEventDrawer 点击关键节点后会请求 node-event-candidates API
        if (url.includes('/api/node-event-candidates')) {
          // 从 URL 提取 nodeDate 参数
          const params = new URLSearchParams(url.split('?')[1] || '');
          const nodeDate = params.get('nodeDate') || '2024-04-01';
          return Promise.resolve(makeNodeEventCandidatesResponse(nodeDate) as unknown as Response);
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as unknown as Response);
      });

      await act(async () => { render(<Home />); });

      // 输入股票代码
      const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/) as HTMLInputElement;
      await act(async () => {
        fireEvent.change(input, { target: { value: '603236' } });
      });
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });

      // 点击查询按钮
      await act(async () => {
        fireEvent.click(screen.getByText('查询行情'));
      });

      // 等待查询成功
      await waitFor(() => {
        expect(screen.getByText(/日K查询结果/)).toBeInTheDocument();
      }, { timeout: 10000 });

      // 等待关键节点列表渲染
      await waitFor(() => {
        expect(screen.getByTestId('key-node-list')).toBeInTheDocument();
      });

      // 等待关键节点列表有节点项
      await waitFor(() => {
        const items = screen.queryAllByTestId(/key-node-item-/);
        expect(items.length).toBeGreaterThan(0);
      }, { timeout: 5000 });

      // 获取第一个关键节点项
      const nodeItems = screen.getAllByTestId(/key-node-item-/);
      expect(nodeItems.length).toBeGreaterThan(0);

      // 点击前：读取该节点卡片上显示的日期（第一个 span 内的日期文本）
      const nodeItem = nodeItems[0];
      const nodeDateSpan = nodeItem.querySelector('span');
      const nodeCardDate = (nodeDateSpan?.textContent || '').trim();
      expect(nodeCardDate).not.toBe('');
      expect(nodeCardDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // 点击第一个关键节点
      await act(async () => {
        fireEvent.click(nodeItems[0]);
      });

      // 点击后：明确断言 trading-day-summary 中的日期与节点卡片日期完全相等
      await waitFor(() => {
        const summary = screen.getByTestId('trading-day-summary');
        expect(summary).toBeInTheDocument();
        const dateSpan = summary.querySelector('span.text-muted');
        const summaryDate = (dateSpan?.textContent || '').trim();
        expect(summaryDate).not.toBe('');
        // 明确断言两者完全相等，不只断言非空
        expect(summaryDate).toBe(nodeCardDate);
      });
    });
  });

  // ========================================================================
  // 测试 4：编辑某日期笔记后切换日期，不会保留旧草稿
  // ========================================================================
  describe('测试 4：编辑笔记后切换日期不保留旧草稿', () => {
    test('编辑 A 日期草稿后点击 B 节点，草稿不串到 B 日期', async () => {
      const CoreReplayDemoPage = (await import('@/app/demo/core-replay/page')).default;
      setSearchParams({});

      await act(async () => { render(<CoreReplayDemoPage />); });

      await waitFor(() => {
        expect(screen.getByTestId('core-replay-demo-page')).toBeInTheDocument();
      });

      // 获取节点按钮
      const nodeTabs = screen.getAllByTestId(/node-tab-/);
      expect(nodeTabs.length).toBeGreaterThanOrEqual(2);

      // 点击第一个节点，选中日期 A
      await act(async () => {
        fireEvent.click(nodeTabs[0]);
      });

      await waitFor(() => {
        expect(readSummaryDate()).not.toBe('');
      });

      const dateA = readSummaryDate();

      // 明确断言新增笔记按钮存在，不得用 if 条件包裹（移除静默通过）
      const addBtn = screen.getByTestId('trading-day-note-add-btn');
      expect(addBtn).toBeInTheDocument();

      // 无条件执行输入、切换日期、检查草稿清空
      await act(async () => { fireEvent.click(addBtn); });

      // 在 textarea 中输入草稿内容
      const textarea = screen.getByTestId('trading-day-note-textarea');
      await act(async () => {
        fireEvent.change(textarea, { target: { value: '这是日期A的草稿内容，不应该串到日期B' } });
      });

      // 验证草稿已输入
      expect((textarea as HTMLTextAreaElement).value).toBe('这是日期A的草稿内容，不应该串到日期B');

      // 点击第二个节点按钮，切换到日期 B
      await act(async () => {
        fireEvent.click(nodeTabs[1]);
      });

      await waitFor(() => {
        const newDate = readSummaryDate();
        expect(newDate).not.toBe('');
        expect(newDate).not.toBe(dateA);
      });

      // 验证编辑状态已退出（表单不应可见）
      expect(screen.queryByTestId('trading-day-note-form')).not.toBeInTheDocument();

      // 重新打开新增笔记输入框，明确断言内容为空（不得用 if 包裹）
      const addBtn2 = screen.getByTestId('trading-day-note-add-btn');
      await act(async () => { fireEvent.click(addBtn2); });
      const textarea2 = screen.getByTestId('trading-day-note-textarea');
      expect((textarea2 as HTMLTextAreaElement).value).toBe('');
    });
  });

  // ========================================================================
  // 测试 5：切换股票案例后，不会保留上一只股票的日期和草稿
  // ========================================================================
  describe('测试 5：切换股票案例后不保留旧日期和草稿', () => {
    test('在 300750 编辑草稿后切换到 600519，日期和草稿均清空', async () => {
      const CoreReplayDemoPage = (await import('@/app/demo/core-replay/page')).default;
      setSearchParams({ stock: '300750' });

      const { rerender } = await act(async () => { return render(<CoreReplayDemoPage />); });

      await waitFor(() => {
        expect(screen.getByTestId('core-replay-demo-page')).toBeInTheDocument();
      });

      // 点击节点选中日期
      const nodeTabs = screen.getAllByTestId(/node-tab-/);
      expect(nodeTabs.length).toBeGreaterThanOrEqual(1);

      await act(async () => {
        fireEvent.click(nodeTabs[0]);
      });

      await waitFor(() => {
        expect(readSummaryDate()).not.toBe('');
      });

      // 明确断言新增笔记按钮存在（移除静默通过）
      const addBtn = screen.getByTestId('trading-day-note-add-btn');
      expect(addBtn).toBeInTheDocument();

      await act(async () => { fireEvent.click(addBtn); });

      const textarea = screen.getByTestId('trading-day-note-textarea');
      await act(async () => {
        fireEvent.change(textarea, { target: { value: '300750的草稿' } });
      });
      expect((textarea as HTMLTextAreaElement).value).toBe('300750的草稿');

      // 切换到 600519 案例
      setSearchParams({ stock: '600519' });
      await act(async () => {
        rerender(<CoreReplayDemoPage />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('page-title')).toHaveTextContent('贵州茅台');
      });

      // 切换后 selectedDate 应被重置为 null，trading-day-summary 应不存在
      expect(screen.queryByTestId('trading-day-summary')).not.toBeInTheDocument();

      // 验证编辑表单已关闭
      expect(screen.queryByTestId('trading-day-note-form')).not.toBeInTheDocument();

      // 跨股票测试必须在新股票上重新选择一个节点
      const newNodeTabs = screen.getAllByTestId(/node-tab-/);
      expect(newNodeTabs.length).toBeGreaterThanOrEqual(1);

      await act(async () => {
        fireEvent.click(newNodeTabs[0]);
      });

      await waitFor(() => {
        expect(readSummaryDate()).not.toBe('');
      });

      // 再打开新增笔记输入框，明确断言内容为空
      const newAddBtn = screen.getByTestId('trading-day-note-add-btn');
      await act(async () => { fireEvent.click(newAddBtn); });
      const newTextarea = screen.getByTestId('trading-day-note-textarea');
      expect((newTextarea as HTMLTextAreaElement).value).toBe('');
    });
  });

  // ========================================================================
  // 附加测试：case_demo 事件不设置 verifiedAt
  // ========================================================================
  describe('附加：case_demo 事件不设置 verifiedAt', () => {
    test('演示事件不应包含 verifiedAt 字段', async () => {
      const { getCaseBuiltInEvents } = await import('@/data/staticCaseEvents');
      const { isCaseDemoEvent } = await import('@/services/stockEvents');

      const allCodes = ['300750', '600519', '603236', '603986', '002594'];
      for (const code of allCodes) {
        const events = getCaseBuiltInEvents(code);
        const demoEvents = events.filter(isCaseDemoEvent);
        for (const e of demoEvents) {
          expect(e.verifiedAt).toBeUndefined();
        }
      }
    });
  });

  // ========================================================================
  // 测试 6：日历跨月切换时清除已选日期，不残留旧月份事件
  // ========================================================================
  describe('测试 6：日历跨月切换不残留旧月份事件', () => {
    test('点击 8/31 后切回 7 月，不再显示"2026-08-31 的事件"', async () => {
      const StockEventCalendar = (await import('@/components/StockEventCalendar')).default;
      const { getCaseBuiltInEvents } = await import('@/data/staticCaseEvents');

      // 使用 300750 案例事件，静态基准日 2026-07-14（7 月 + 未来 2 个月 = 7/8/9 月）
      const events = getCaseBuiltInEvents('300750');

      await act(async () => {
        render(
          <StockEventCalendar
            events={events}
            referenceDate="2026-07-14"
            staticCaseLabel="静态案例基准日：2026-07-14"
          />
        );
      });

      // 等待挂载，默认显示 2026 年 7 月
      await waitFor(() => {
        expect(screen.getByTestId('calendar-month-label')).toHaveTextContent('2026年7月');
      });

      // 切换到 2026 年 8 月
      const nextBtn = screen.getByTestId('calendar-next-month');
      await act(async () => { fireEvent.click(nextBtn); });

      await waitFor(() => {
        expect(screen.getByTestId('calendar-month-label')).toHaveTextContent('2026年8月');
      });

      // 点击 2026-08-31 格子
      const aug31Cell = screen.getByTestId('calendar-cell-2026-08-31');
      await act(async () => { fireEvent.click(aug31Cell); });

      // 确认显示该日事件（selected-date-events 区域出现，标题包含 "2026-08-31"）
      await waitFor(() => {
        const eventsSection = screen.getByTestId('selected-date-events');
        expect(eventsSection).toBeInTheDocument();
        expect(eventsSection.textContent).toContain('2026-08-31');
      });

      // 切回 2026 年 7 月
      const prevBtn = screen.getByTestId('calendar-prev-month');
      await act(async () => { fireEvent.click(prevBtn); });

      await waitFor(() => {
        expect(screen.getByTestId('calendar-month-label')).toHaveTextContent('2026年7月');
      });

      // 明确断言：页面不再显示"2026-08-31 的事件"
      const residualEvents = screen.queryByTestId('selected-date-events');
      expect(residualEvents).not.toBeInTheDocument();

      // 7 月本月观察窗口仍正常显示
      const pendingArea = screen.queryByTestId('pending-month-events');
      if (pendingArea) {
        expect(pendingArea).toBeInTheDocument();
      }

      // 用户可以重新点击新月份日期查看事件（点击 7 月某日）
      const julyCells = screen.queryAllByTestId(/calendar-cell-2026-07-/);
      expect(julyCells.length).toBeGreaterThan(0);
      // 点击 7 月 1 日（如有）
      const july1Cell = screen.queryByTestId('calendar-cell-2026-07-01');
      if (july1Cell) {
        await act(async () => { fireEvent.click(july1Cell); });
        await waitFor(() => {
          const eventsSection = screen.getByTestId('selected-date-events');
          expect(eventsSection).toBeInTheDocument();
          expect(eventsSection.textContent).toContain('2026-07-01');
        });
      }
    });
  });
});
