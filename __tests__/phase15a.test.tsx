/**
 * 第十五阶段 A：核心复盘 Mock 数据文件字段测试
 *
 * B1 阶段将 /demo/core-replay 页面从 Mock 改造为静态真实历史案例后，
 * 本测试文件保留对 mockCoreReplayCase 数据文件本身的字段校验，
 * 不再渲染 CoreReplayDemoPage（页面已由 phase15b1.test.tsx 覆盖）。
 *
 * 首页入口文案已更新为"查看静态历史复盘案例"。
 *
 * @jest-environment jsdom
 */

import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// 在 import 页面之前 mock lightweight-charts，避免 jsdom 下 canvas 报错
jest.mock('lightweight-charts', () => {
  const originalModule = jest.requireActual('lightweight-charts');
  const mockCandlestickSeries = {
    setData: jest.fn(),
    setMarkers: jest.fn(),
    applyOptions: jest.fn(),
  };
  const mockTimeScale = {
    fitContent: jest.fn(),
  };
  const mockChart = {
    addCandlestickSeries: jest.fn(() => mockCandlestickSeries),
    subscribeCrosshairMove: jest.fn(),
    subscribeClick: jest.fn(),
    unsubscribeCrosshairMove: jest.fn(),
    unsubscribeClick: jest.fn(),
    applyOptions: jest.fn(),
    timeScale: jest.fn(() => mockTimeScale),
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

import Home from '@/app/page';
import { mockCoreReplayCase } from '@/data/mockCoreReplayCase';

describe('第十五阶段 A：首页入口与 Mock 数据文件字段', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  // ========== 1. 首页入口（B1 阶段更新文案） ==========

  describe('首页体验入口', () => {
    test('首页初始状态存在"静态真实案例库"入口', async () => {
      await act(async () => { render(<Home />); });

      const entry = screen.getByTestId('core-replay-entry');
      expect(entry).toBeInTheDocument();
      expect(entry.textContent).toContain('静态真实案例库');
    });

    test('入口链接指向 /demo/core-replay', async () => {
      await act(async () => { render(<Home />); });

      // 第十六阶段里程碑三：案例库首页有多个案例链接，默认指向宁德时代案例
      const link = screen.getByTestId('home-case-card-300750');
      expect(link).not.toBeNull();
      expect(link?.getAttribute('href')).toContain('/demo/core-replay');
    });

    test('入口带有静态案例标识说明', async () => {
      await act(async () => { render(<Home />); });

      const entry = screen.getByTestId('core-replay-entry');
      expect(entry.textContent).toContain('基于真实历史行情和可复核公开资料');
      expect(entry.textContent).toContain('非实时更新');
    });
  });

  // ========== 2. Mock 数据文件字段标记 ==========

  describe('数据隔离标记', () => {
    test('案例对象 dataMode 为 mock', () => {
      expect(mockCoreReplayCase.dataMode).toBe('mock');
    });

    test('所有节点 dataMode 为 mock', () => {
      mockCoreReplayCase.nodes.forEach((node) => {
        expect(node.dataMode).toBe('mock');
      });
    });

    test('所有候选项 dataMode 为 mock', () => {
      mockCoreReplayCase.nodes.forEach((node) => {
        node.candidates.forEach((candidate) => {
          expect(candidate.dataMode).toBe('mock');
        });
      });
    });

    test('案例使用稳定 ID', () => {
      expect(mockCoreReplayCase.id).toBe('mock-core-replay-300750-001');
      mockCoreReplayCase.nodes.forEach((node) => {
        expect(node.id).toBeTruthy();
        expect(node.id).toContain('mock-node-');
      });
    });

    test('至少 3 个关键节点', () => {
      expect(mockCoreReplayCase.nodes.length).toBeGreaterThanOrEqual(3);
    });

    test('每个节点有 2~4 条事件候选', () => {
      mockCoreReplayCase.nodes.forEach((node) => {
        expect(node.candidates.length).toBeGreaterThanOrEqual(2);
        expect(node.candidates.length).toBeLessThanOrEqual(4);
      });
    });
  });

  // ========== 3. Mock 节点算法一致性 ==========

  describe('Mock 节点与真实算法一致', () => {
    test('每根 K 线的 changePercent 与前日收盘价计算误差不超过 0.01', () => {
      const klines = mockCoreReplayCase.klines;
      for (let i = 1; i < klines.length; i++) {
        const prevClose = klines[i - 1].close;
        const currClose = klines[i].close;
        const expected = ((currClose - prevClose) / prevClose) * 100;
        const actual = klines[i].changePercent;
        expect(Math.abs(actual - expected)).toBeLessThan(0.01);
      }
    });

    test('open/high/low/close 内部一致', () => {
      mockCoreReplayCase.klines.forEach((k) => {
        expect(k.low).toBeLessThanOrEqual(k.open);
        expect(k.low).toBeLessThanOrEqual(k.close);
        expect(k.high).toBeGreaterThanOrEqual(k.open);
        expect(k.high).toBeGreaterThanOrEqual(k.close);
      });
    });

    test('节点1 涨跌幅 ≥ 5%', () => {
      const node = mockCoreReplayCase.nodes[0];
      expect(node.nodeType).toBe('significant_up');
      expect(node.changePercent).toBeGreaterThanOrEqual(5);
    });

    test('节点2 为阶段高点', () => {
      const node = mockCoreReplayCase.nodes[1];
      expect(node.nodeType).toBe('local_high');
      expect(Math.abs(node.changePercent)).toBeLessThan(5);
      const nodeKline = mockCoreReplayCase.klines.find((k) => k.date === node.date);
      expect(nodeKline).toBeDefined();
      const maxHigh = Math.max(...mockCoreReplayCase.klines.map((k) => k.high));
      expect(nodeKline!.high).toBeCloseTo(maxHigh, 2);
    });

    test('节点3 涨跌幅 ≤ -5%', () => {
      const node = mockCoreReplayCase.nodes[2];
      expect(node.nodeType).toBe('significant_down');
      expect(node.changePercent).toBeLessThanOrEqual(-5);
    });

    test('节点 close 与对应 K 线 close 一致', () => {
      mockCoreReplayCase.nodes.forEach((node) => {
        const kline = mockCoreReplayCase.klines.find((k) => k.date === node.date);
        expect(kline).toBeDefined();
        expect(kline!.close).toBe(node.close);
      });
    });

    test('节点 changePercent 与对应 K 线 changePercent 一致', () => {
      mockCoreReplayCase.nodes.forEach((node) => {
        const kline = mockCoreReplayCase.klines.find((k) => k.date === node.date);
        expect(kline).toBeDefined();
        expect(kline!.changePercent).toBe(node.changePercent);
      });
    });

    test('节点 volume 与对应 K 线 volume 一致', () => {
      mockCoreReplayCase.nodes.forEach((node) => {
        const kline = mockCoreReplayCase.klines.find((k) => k.date === node.date);
        expect(kline).toBeDefined();
        expect(kline!.volume).toBe(node.volume);
      });
    });
  });
});
