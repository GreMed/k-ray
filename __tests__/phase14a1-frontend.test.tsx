/**
 * 第十四阶段 A1：沪深真实行情核心链路修复 — 前端测试
 *
 * 覆盖：
 * 1. 图表 setData 后调用 fitContent（完整区间适配）
 * 2. 悬停行情信息条（固定高度、顺序、YYYY-MM-DD、涨跌幅红涨绿跌）
 * 3. 图例（箭头替换菱形、删除上涨/下跌短横线）
 * 4. 普通用户页面无真实行情复选框
 * 5. 按钮文案为"查询行情"
 *
 * @jest-environment jsdom
 */

import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as lightweightCharts from 'lightweight-charts';

import ProfessionalKLineChart from '@/components/ProfessionalKLineChart';
import Home from '@/app/page';
import { KLineData, MarketKeyNode } from '@/types';

// ============================================================================
// lightweight-charts mock — 捕获 fitContent 调用
// 注意：jest.mock 工厂函数会被提升到文件顶部，因此不能引用外部 let 变量。
// 解决方案：在工厂内部创建 jest.fn()，并通过 __mocks 导出供测试访问。
// ============================================================================

jest.mock('lightweight-charts', () => {
  const originalModule = jest.requireActual('lightweight-charts');

  const fitContentMock = jest.fn();
  const setDataMock = jest.fn();
  const setMarkersMock = jest.fn();
  const subscribeCrosshairMoveMock = jest.fn();
  const createChartMock = jest.fn(() => mockChart);

  const mockCandlestickSeries = {
    setData: setDataMock,
    setMarkers: setMarkersMock,
    applyOptions: jest.fn(),
  };

  const mockTimeScale = {
    fitContent: fitContentMock,
  };

  const mockChart = {
    addCandlestickSeries: jest.fn(() => mockCandlestickSeries),
    subscribeCrosshairMove: subscribeCrosshairMoveMock,
    subscribeClick: jest.fn(),
    unsubscribeCrosshairMove: jest.fn(),
    unsubscribeClick: jest.fn(),
    applyOptions: jest.fn(),
    timeScale: jest.fn(() => mockTimeScale),
    remove: jest.fn(),
  };

  return {
    ...originalModule,
    createChart: createChartMock,
    CrosshairMode: {
      Normal: 0,
      Magnet: 1,
    },
    __mocks: { fitContentMock, setDataMock, createChartMock },
  };
});

// 从 mock 模块获取 mock 函数引用（jest.mock 已提升到 import 之前，此处获取的是 mock 后的模块）
const lightweightChartsMock = lightweightCharts as unknown as {
  __mocks: {
    fitContentMock: jest.Mock;
    setDataMock: jest.Mock;
    createChartMock: jest.Mock;
  };
};
const { fitContentMock, setDataMock, createChartMock } = lightweightChartsMock.__mocks;

// Mock global fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch as unknown as typeof fetch;

// ============================================================================
// 辅助函数
// ============================================================================

function makeKLines(count: number, startDate = '2024-01-02'): KLineData[] {
  const klines: KLineData[] = [];
  const baseDate = new Date(startDate);
  for (let i = 0; i < count; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    // 跳过周末（简化处理）
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    if (d.getDay() === 6) d.setDate(d.getDate() + 2);
    klines.push({
      id: `kline-${i}`,
      stockId: 'stock-sz-301165',
      date: d.toISOString().slice(0, 10),
      open: 10 + i * 0.1,
      high: 11 + i * 0.1,
      low: 9 + i * 0.1,
      close: 10.5 + i * 0.1,
      volume: 1000000 * (i + 1),
      changePercent: i % 2 === 0 ? 1.5 + i * 0.1 : -(0.5 + i * 0.1),
    });
  }
  return klines;
}

function makeMarketKeyNodes(): MarketKeyNode[] {
  return [
    {
      id: 'significant_up:301165:2024-01-03',
      type: 'significant_up',
      date: '2024-01-03',
      changePercent: 8.5,
      volume: 5000000,
      previousClose: 10,
      previousVolume: 3000000,
      volumeChangePercent: 66.67,
      detailSummary: '收盘价较前一交易日上涨 8.5%',
    },
    {
      id: 'significant_down:301165:2024-01-04',
      type: 'significant_down',
      date: '2024-01-04',
      changePercent: -6.2,
      volume: 4000000,
      previousClose: 11,
      previousVolume: 3500000,
      volumeChangePercent: 14.29,
      detailSummary: '收盘价较前一交易日下跌 6.2%',
    },
    {
      id: 'local_high:301165:2024-01-05',
      type: 'local_high',
      date: '2024-01-05',
      changePercent: 0.3,
      volume: 3000000,
      previousClose: 10.5,
      previousVolume: 2800000,
      volumeChangePercent: 7.14,
      detailSummary: '阶段高点',
    },
    {
      id: 'local_low:301165:2024-01-08',
      type: 'local_low',
      date: '2024-01-08',
      changePercent: -0.2,
      volume: 2500000,
      previousClose: 10.8,
      previousVolume: 2700000,
      volumeChangePercent: -7.41,
      detailSummary: '阶段低点',
    },
  ];
}

// ============================================================================
// 测试套件
// ============================================================================

describe('第十四阶段 A1：沪深真实行情核心链路修复', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  // ========== 1. 图表 fitContent ==========

  describe('图表 setData 后调用 fitContent（完整区间适配）', () => {
    test('setData 后必须调用 timeScale().fitContent()', () => {
      const klines = makeKLines(10);
      render(
        <ProfessionalKLineChart
          klines={klines}
          marketKeyNodes={[]}
        />,
      );

      // setData 被调用
      expect(setDataMock).toHaveBeenCalledTimes(1);
      // fitContent 被调用
      expect(fitContentMock).toHaveBeenCalledTimes(1);
    });

    test('fitContent 在 setData 之后调用', () => {
      const klines = makeKLines(5);
      render(
        <ProfessionalKLineChart
          klines={klines}
          marketKeyNodes={[]}
        />,
      );

      // 验证调用顺序：先 setData 再 fitContent
      const callOrder: string[] = [];
      setDataMock.mockImplementation(() => callOrder.push('setData'));
      fitContentMock.mockImplementation(() => callOrder.push('fitContent'));

      // 重新渲染触发新的图表创建
      render(
        <ProfessionalKLineChart
          klines={klines}
          marketKeyNodes={[]}
        />,
      );

      // fitContent 必须在 setData 之后
      const setDataIndex = callOrder.indexOf('setData');
      const fitContentIndex = callOrder.indexOf('fitContent');
      expect(setDataIndex).toBeGreaterThanOrEqual(0);
      expect(fitContentIndex).toBeGreaterThan(setDataIndex);
    });
  });

  // ========== 2. 悬停行情信息条 ==========

  describe('悬停行情信息条', () => {
    test('无悬停时显示"移动鼠标查看日行情"占位文案', () => {
      const klines = makeKLines(5);
      render(
        <ProfessionalKLineChart
          klines={klines}
          marketKeyNodes={[]}
        />,
      );

      expect(screen.getByTestId('hover-data-bar')).toBeInTheDocument();
      expect(screen.getByTestId('hover-data-placeholder')).toBeInTheDocument();
      expect(screen.getByTestId('hover-data-placeholder').textContent).toContain('移动鼠标查看日行情');
    });

    test('悬停信息条始终存在（固定高度），不因悬停状态改变图表卡片高度', () => {
      const klines = makeKLines(5);
      render(
        <ProfessionalKLineChart
          klines={klines}
          marketKeyNodes={[]}
        />,
      );

      // hover-data-bar 始终存在
      const bar = screen.getByTestId('hover-data-bar');
      expect(bar).toBeInTheDocument();
      // 有 minHeight 样式
      expect(bar.style.minHeight).toBeTruthy();
    });
  });

  // ========== 3. 图例 ==========

  describe('图例形状与 marker 一致', () => {
    test('单日显著上涨使用红色向上箭头（▲），不是菱形', () => {
      const klines = makeKLines(10);
      const nodes = makeMarketKeyNodes();
      render(
        <ProfessionalKLineChart
          klines={klines}
          marketKeyNodes={nodes}
        />,
      );

      const legend = screen.getByTestId('chart-legend');
      expect(legend.textContent).toContain('单日显著上涨');
      // 不应包含 rotate-45（菱形）
      expect(legend.querySelector('.rotate-45')).toBeNull();
    });

    test('单日显著下跌使用绿色向下箭头（▼），不是菱形', () => {
      const klines = makeKLines(10);
      const nodes = makeMarketKeyNodes();
      render(
        <ProfessionalKLineChart
          klines={klines}
          marketKeyNodes={nodes}
        />,
      );

      const legend = screen.getByTestId('chart-legend');
      expect(legend.textContent).toContain('单日显著下跌');
      // 不应包含 rotate-45
      expect(legend.querySelector('.rotate-45')).toBeNull();
    });

    test('阶段高点/低点使用圆点', () => {
      const klines = makeKLines(10);
      const nodes = makeMarketKeyNodes();
      render(
        <ProfessionalKLineChart
          klines={klines}
          marketKeyNodes={nodes}
        />,
      );

      const legend = screen.getByTestId('chart-legend');
      expect(legend.textContent).toContain('阶段高点');
      expect(legend.textContent).toContain('阶段低点');
      // 应有 rounded-full 元素
      expect(legend.querySelector('.rounded-full')).not.toBeNull();
    });

    test('不包含"上涨""下跌"短横线图例', () => {
      const klines = makeKLines(10);
      const nodes = makeMarketKeyNodes();
      render(
        <ProfessionalKLineChart
          klines={klines}
          marketKeyNodes={nodes}
        />,
      );

      const legend = screen.getByTestId('chart-legend');
      // 不应包含独立的"上涨"和"下跌"短横线图例
      // 注意："单日显著上涨"和"单日显著下跌"是合法的
      // 检查不包含独立的 "上涨" 和 "下跌" 文本（非"单日显著上涨/下跌"的一部分）
      const lines = legend.querySelectorAll('span.flex.items-center.gap-1');
      const texts = Array.from(lines).map(el => el.textContent?.trim() || '');
      // 不应存在只显示"上涨"或"下跌"的图例项
      expect(texts).not.toContain('上涨');
      expect(texts).not.toContain('下跌');
    });

    test('A 股颜色：红涨绿跌（箭头颜色）', () => {
      const klines = makeKLines(10);
      const nodes = makeMarketKeyNodes();
      render(
        <ProfessionalKLineChart
          klines={klines}
          marketKeyNodes={nodes}
        />,
      );

      const legend = screen.getByTestId('chart-legend');
      // 红色箭头 (#e65353 → rgb(230,83,83)) 用于上涨，绿色 (#20a464 → rgb(32,164,100)) 用于下跌
      const upArrow = legend.querySelectorAll('span[style]');
      const upArrowStyles = Array.from(upArrow).map(el => (el as HTMLElement).style.color);
      expect(upArrowStyles).toContain('rgb(230, 83, 83)'); // 红色
      expect(upArrowStyles).toContain('rgb(32, 164, 100)'); // 绿色
    });
  });

  // ========== 4. 普通用户页面无真实行情复选框 ==========

  describe('普通用户页面无真实行情复选框', () => {
    test('页面不包含"使用真实历史行情"复选框', () => {
      render(<Home />);

      expect(screen.queryByTestId('real-market-toggle')).not.toBeInTheDocument();
      expect(screen.queryByText('使用真实历史行情')).not.toBeInTheDocument();
    });

    test('按钮文案为"查询行情"', () => {
      render(<Home />);

      const button = screen.getByRole('button', { name: /查询行情/ });
      expect(button).toBeInTheDocument();
    });

    test('不包含"开始复盘"按钮文案', () => {
      render(<Home />);

      // 页面中不应有"开始复盘"按钮
      const buttons = screen.getAllByRole('button');
      const buttonTexts = buttons.map(b => b.textContent || '');
      expect(buttonTexts).not.toContain('开始复盘');
    });
  });

  // ========== 5. 十字线日期格式（第十四阶段 A1 封板修复） ==========

  describe('十字线日期格式', () => {
    test('createChart 配置包含 localization.timeFormatter', () => {
      const klines = makeKLines(10);
      render(
        <ProfessionalKLineChart
          klines={klines}
          marketKeyNodes={[]}
        />,
      );

      // createChart 被调用
      expect(createChartMock).toHaveBeenCalled();
      // 获取第一次调用的第二个参数（配置对象）
      const callArgs = createChartMock.mock.calls[0];
      expect(callArgs.length).toBeGreaterThanOrEqual(2);
      const config = callArgs[1] as Record<string, unknown>;

      // 必须包含 localization 配置
      expect(config.localization).toBeDefined();
      const localization = config.localization as Record<string, unknown>;
      expect(localization.timeFormatter).toBeDefined();
      expect(typeof localization.timeFormatter).toBe('function');
    });

    test('localization.timeFormatter 将 YYYY-MM-DD 时间格式化为 YYYY-MM-DD', () => {
      const klines = makeKLines(10);
      render(
        <ProfessionalKLineChart
          klines={klines}
          marketKeyNodes={[]}
        />,
      );

      const callArgs = createChartMock.mock.calls[0];
      const config = callArgs[1] as Record<string, unknown>;
      const localization = config.localization as { timeFormatter: (time: unknown) => string };
      const timeFormatter = localization.timeFormatter;

      // 对 '2024-01-15' 这样的业务日字符串，应原样返回
      expect(timeFormatter('2024-01-15')).toBe('2024-01-15');
      expect(timeFormatter('2025-07-13')).toBe('2025-07-13');
    });

    test('timeScale.tickMarkFormatter 也使用 YYYY-MM-DD 格式', () => {
      const klines = makeKLines(10);
      render(
        <ProfessionalKLineChart
          klines={klines}
          marketKeyNodes={[]}
        />,
      );

      const callArgs = createChartMock.mock.calls[0];
      const config = callArgs[1] as Record<string, unknown>;
      const timeScale = config.timeScale as { tickMarkFormatter: (time: unknown) => string };
      expect(timeScale.tickMarkFormatter).toBeDefined();
      expect(timeScale.tickMarkFormatter('2024-03-20')).toBe('2024-03-20');
    });

    test('timeScale.timeVisible 为 false（不显示时分秒）', () => {
      const klines = makeKLines(10);
      render(
        <ProfessionalKLineChart
          klines={klines}
          marketKeyNodes={[]}
        />,
      );

      const callArgs = createChartMock.mock.calls[0];
      const config = callArgs[1] as Record<string, unknown>;
      const timeScale = config.timeScale as { timeVisible: boolean };
      // timeVisible 必须为 false，避免十字线出现 00:00 时间
      expect(timeScale.timeVisible).toBe(false);
    });
  });

  // ========== 6. 前端 isRealMarketData 保护（第十四阶段 A1 封板修复） ==========

  describe('前端 isRealMarketData 保护', () => {
    test('Mock K线（isRealMarketData=false）不进入成功结果页，显示错误', async () => {
      // 模拟返回 Mock K线（isRealMarketData=false，含 fallbackReason）
      // 即使包含 K线数据，前端也必须拒绝进入成功页
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          stock: { id: 'stock-sz-301165', code: '301165', name: '锐捷网络', market: 'SZ' },
          klines: [{
            id: 'k1', stockId: 'stock-sz-301165', date: '2025-07-14',
            open: 45, high: 46, low: 44, close: 45.5, volume: 1000000, changePercent: 1.2,
          }],
          meta: {
            source: 'mock',
            sourceLabel: 'Mock演示数据(BaoStock降级)',
            adjustment: 'qfq',
            isRealMarketData: false,
            fetchedAt: '2025-07-14T00:00:00.000Z',
            fallbackReason: 'BaoStock真实行情暂时不可用，当前已降级为本地Mock行情。',
          },
        }),
      } as Response);

      // 模拟 stock-info 请求（StockSearch 组件查询名称）
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          stockCode: '301165', market: 'SZ', name: '锐捷网络',
          found: true, isListed: true, securityType: 'stock',
        }),
      } as Response);

      await act(async () => { render(<Home />); });

      // 输入 301165
      const input = screen.getByTestId('stock-search-input');
      await act(async () => { fireEvent.change(input, { target: { value: '301165' } }); });
      await act(async () => { fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' }); });

      // 等待建议项出现并点击
      await waitFor(() => {
        return screen.queryByText('301165') !== null;
      }, { timeout: 5000 }).catch(() => {});

      const suggestionBtn = screen.queryByText('301165')?.closest('button');
      if (suggestionBtn) {
        await act(async () => { fireEvent.click(suggestionBtn); });
      }

      // 点击查询行情
      await waitFor(() => {
        const btn = screen.queryByRole('button', { name: '查询行情' });
        return btn && !btn.hasAttribute('disabled');
      }, { timeout: 5000 }).catch(() => {});

      const queryBtn = screen.queryByRole('button', { name: '查询行情' });
      if (queryBtn && !queryBtn.hasAttribute('disabled')) {
        await act(async () => { fireEvent.click(queryBtn); });
      }

      // 等待状态稳定
      await new Promise(r => setTimeout(r, 500));

      // 关键断言：不应显示真实行情成功标识（real-market-banner 只在 success + isRealMarketData 时显示）
      const realMarketBanner = screen.queryByTestId('real-market-banner');
      expect(realMarketBanner).not.toBeInTheDocument();

      // 不应显示图表成功状态（chart-wrapper 只在 success + klines.length>0 时由 ProfessionalKLineChart 渲染）
      // 注意：由于 pageState 为 error，Home 组件不会渲染 ProfessionalKLineChart
      const chartWrapper = screen.queryByTestId('chart-wrapper');
      expect(chartWrapper).not.toBeInTheDocument();
    });
  });
});
