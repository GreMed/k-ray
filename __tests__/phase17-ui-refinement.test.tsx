/**
 * 第十七阶段 UI 收口：行情图单层卡片 + 笔记/日历布局测试
 *
 * 覆盖：
 * 1. 案例页行情图只有一层视觉卡片（chart-card 无卡片样式）
 * 2. 案例页 dual-card-area 位于 left-analysis-column 内
 * 3. 首页真实行情结果同样满足 left-analysis-column → dual-card-area 父子关系
 * 4. 笔记卡不再渲染 OHLCV 行情摘要（开/高/低/收/量/涨跌幅）
 * 5. 移动端布局使用单列网格（不横向溢出）
 *
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import '@testing-library/jest-dom';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';

// 在 import 页面之前 mock lightweight-charts
jest.mock('lightweight-charts', () => {
  const originalModule = jest.requireActual('lightweight-charts');
  const mockCandlestickSeries = {
    setData: jest.fn(),
    setMarkers: jest.fn(),
    applyOptions: jest.fn(),
  };
  const mockChart = {
    addCandlestickSeries: jest.fn(() => mockCandlestickSeries),
    subscribeCrosshairMove: jest.fn(),
    subscribeClick: jest.fn(),
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

// Mock global fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch as unknown as typeof fetch;

import CoreReplayDemoPage from '@/app/demo/core-replay/page';
import Home from '@/app/page';

describe('第十七阶段 UI 收口：行情图单层卡片 + 笔记/日历布局', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  // ========== 1. 案例页：行情图单层卡片 ==========

  describe('案例页行情图单层卡片', () => {
    test('chart-card 容器不包含卡片可视化样式（无 bg-white/border/rounded-lg/p-2）', async () => {
      await act(async () => {
        render(<CoreReplayDemoPage />);
      });

      const chartCard = screen.getByTestId('chart-card');
      expect(chartCard).toBeInTheDocument();

      // chart-card 不应有卡片样式类名
      const className = chartCard.className;
      expect(className).not.toContain('bg-white');
      expect(className).not.toContain('border');
      expect(className).not.toContain('rounded-lg');
      expect(className).not.toContain('p-2');
      expect(className).not.toContain('p-3');
    });

    test('行情区域只有一组图表标题（来自 ProfessionalKLineChart 自身）', async () => {
      await act(async () => {
        render(<CoreReplayDemoPage />);
      });

      // ProfessionalKLineChart 内部的 chart-wrapper 应该存在
      const chartWrapper = screen.getByTestId('chart-wrapper');
      expect(chartWrapper).toBeInTheDocument();

      // chart-wrapper 应该有卡片样式（由 ProfessionalKLineChart 自身渲染）
      expect(chartWrapper.className).toContain('border');
      expect(chartWrapper.className).toContain('rounded');
      expect(chartWrapper.className).toContain('bg-white');
    });

    test('案例页不存在重复的"前复权日线·静态快照"外层标签', async () => {
      await act(async () => {
        render(<CoreReplayDemoPage />);
      });

      // 页面不应有 chart-static-label 这个 testid（已删除的外层标签）
      expect(screen.queryByTestId('chart-static-label')).not.toBeInTheDocument();
    });
  });

  // ========== 2. 案例页：dual-card-area 位于 left-analysis-column 内 ==========

  describe('案例页布局父子关系', () => {
    test('dual-card-area 是 left-analysis-column 的子元素', async () => {
      await act(async () => {
        render(<CoreReplayDemoPage />);
      });

      const leftColumn = screen.getByTestId('left-analysis-column');
      const dualCardArea = screen.getByTestId('dual-card-area');

      expect(leftColumn).toBeInTheDocument();
      expect(dualCardArea).toBeInTheDocument();

      // dual-card-area 应该是 left-analysis-column 的后代
      expect(leftColumn).toContainElement(dualCardArea);
    });

    test('note-card-wrapper 和 calendar-card-wrapper 在 dual-card-area 内', async () => {
      await act(async () => {
        render(<CoreReplayDemoPage />);
      });

      const dualCardArea = screen.getByTestId('dual-card-area');
      const noteWrapper = screen.getByTestId('note-card-wrapper');
      const calendarWrapper = screen.getByTestId('calendar-card-wrapper');

      expect(dualCardArea).toContainElement(noteWrapper);
      expect(dualCardArea).toContainElement(calendarWrapper);
    });

    test('行情图在 dual-card-area 之前（左侧栏从上到下：图表→笔记/日历）', async () => {
      await act(async () => {
        render(<CoreReplayDemoPage />);
      });

      const leftColumn = screen.getByTestId('left-analysis-column');
      const chartCard = screen.getByTestId('chart-card');
      const dualCardArea = screen.getByTestId('dual-card-area');

      // 两者都是 left-analysis-column 的子元素
      expect(leftColumn).toContainElement(chartCard);
      expect(leftColumn).toContainElement(dualCardArea);

      // chart-card 在 dual-card-area 之前（DOM 顺序）
      const allChildren = Array.from(leftColumn.querySelectorAll('*'));
      const chartCardIndex = allChildren.indexOf(chartCard);
      const dualCardAreaIndex = allChildren.indexOf(dualCardArea);
      expect(chartCardIndex).toBeLessThan(dualCardAreaIndex);
    });
  });

  // ========== 3. 首页：真实行情结果同样满足父子关系 ==========

  describe('首页真实行情结果布局', () => {
    test('成功状态下 dual-card-area 是 left-analysis-column 的子元素', async () => {
      // 构造真实行情响应（使用连续日历日，避免周末跳过导致重复日期）
      const klines = [];
      const baseDate = new Date('2024-06-01T00:00:00Z');
      for (let i = 0; i < 10; i++) {
        const d = new Date(baseDate);
        d.setUTCDate(d.getUTCDate() + i);
        const dateStr = d.toISOString().slice(0, 10);
        klines.push({
          id: `baostock:stock-sh-600519:${dateStr}`,
          stockId: 'stock-sh-600519',
          date: dateStr,
          open: 100 + i,
          high: 105 + i,
          low: 95 + i,
          close: 102 + i,
          volume: 2000000 + i * 100000,
          changePercent: 1.5,
        });
      }

      const realMarketResponse = {
        stock: { code: '600519', name: '贵州茅台', market: 'SH' },
        klines,
        meta: {
          source: 'baostock',
          sourceLabel: 'BaoStock真实行情(前复权日线)',
          adjustment: 'qfq',
          isRealMarketData: true,
          fetchedAt: '2024-07-01T00:00:00.000Z',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => realMarketResponse,
      } as Response);

      await act(async () => { render(<Home />); });

      // 输入股票代码并查询
      const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/);
      await act(async () => {
        fireEvent.change(input, { target: { value: '600519' } });
      });

      await waitFor(() => {
        const suggestionBtn = screen.getByText('600519').closest('button');
        expect(suggestionBtn).toBeInTheDocument();
      });

      const suggestionBtn = screen.getByText('600519').closest('button')!;
      await act(async () => { fireEvent.click(suggestionBtn); });

      const queryBtn = screen.getByText('查询行情');
      await act(async () => { fireEvent.click(queryBtn); });

      // 等待查询结果展示
      await waitFor(() => {
        expect(screen.getByTestId('chart-wrapper')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByTestId('dual-card-area')).toBeInTheDocument();
      });

      // 验证父子关系
      const leftColumn = screen.getByTestId('left-analysis-column');
      const dualCardArea = screen.getByTestId('dual-card-area');
      expect(leftColumn).toContainElement(dualCardArea);

      // 验证 note-card-wrapper 和 calendar-card-wrapper 在 dual-card-area 内
      const noteWrapper = screen.getByTestId('note-card-wrapper');
      const calendarWrapper = screen.getByTestId('calendar-card-wrapper');
      expect(dualCardArea).toContainElement(noteWrapper);
      expect(dualCardArea).toContainElement(calendarWrapper);
    });
  });

  // ========== 4. 笔记卡不再渲染 OHLCV ==========

  describe('笔记卡不重复展示 OHLCV', () => {
    test('案例页笔记卡 trading-day-summary 不包含开/高/低/收/量/涨跌幅', async () => {
      await act(async () => {
        render(<CoreReplayDemoPage />);
      });

      // 默认未选择日期，应显示空状态
      const emptyState = screen.getByTestId('trading-day-note-empty');
      expect(emptyState).toHaveTextContent('点击行情图中的交易日开始记录');

      // 空状态文案不应包含 OHLCV 相关文字
      const notePanel = screen.getByTestId('trading-day-note-panel');
      const panelText = notePanel.textContent || '';
      expect(panelText).not.toContain('开:');
      expect(panelText).not.toContain('高:');
      expect(panelText).not.toContain('低:');
      expect(panelText).not.toContain('收:');
      expect(panelText).not.toContain('量:');
      expect(panelText).not.toContain('涨跌幅');
    });
  });

  // ========== 5. 移动端布局不横向溢出 ==========

  describe('移动端布局', () => {
    test('案例页主布局使用响应式网格（移动端单列）', async () => {
      await act(async () => {
        render(<CoreReplayDemoPage />);
      });

      // 主布局 grid 应该有 grid-cols-1（移动端单列）
      const leftColumn = screen.getByTestId('left-analysis-column');
      const parentGrid = leftColumn.parentElement;

      // 父级 grid 应包含 grid-cols-1 和 lg:grid-cols-5
      expect(parentGrid?.className).toContain('grid-cols-1');
      expect(parentGrid?.className).toContain('lg:grid-cols-5');
    });

    test('案例页 dual-card-area 使用响应式网格（移动端单列）', async () => {
      await act(async () => {
        render(<CoreReplayDemoPage />);
      });

      const dualCardArea = screen.getByTestId('dual-card-area');

      // dual-card-area 应该有 grid-cols-1（移动端单列）和 md:grid-cols-2（桌面端双列）
      expect(dualCardArea.className).toContain('grid-cols-1');
      expect(dualCardArea.className).toContain('md:grid-cols-2');
    });

    test('案例页左侧栏包含 min-w-0 防溢出', async () => {
      await act(async () => {
        render(<CoreReplayDemoPage />);
      });

      const leftColumn = screen.getByTestId('left-analysis-column');
      expect(leftColumn.className).toContain('min-w-0');
    });
  });
});
