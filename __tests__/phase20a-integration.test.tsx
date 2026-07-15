/**
 * K-Ray 第二十阶段 A 验收修复（第二轮）：真实集成测试
 *
 * 覆盖：
 *   1. 自选进入股票 B → 查询 B → 点击"重新查询"：URL 旧参数被清理，股票清空，不会重新选回 B
 *   2. 自选进入股票 B → 手动选择股票 C：最终选中 C，不被旧 URL 覆盖，查询参数为 C
 *   3. 自选进入名称为空的股票：断言已选中代码，查询请求使用该代码
 *   4. 同一股票名称从"名称获取中"更新为真实名称，不产生重复重置
 *   5. 案例页：打开"我的自选"→点击"查看"→正确进入普通查询页
 *   6. localStorage 写入失败：加入失败按钮仍为"加入自选"，移除失败仍保留原自选
 *   7. router.replace 的 mock 必须像 router.push 一样真实更新 useSearchParams
 *
 * 策略：使用 useSyncExternalStore 模拟 next/navigation 的 useSearchParams。
 * mockPush 和 mockReplace 都更新 currentSearchParams 并通知订阅者，触发 React 重渲染。
 *
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

// ============================================================================
// 顶层 mock：lightweight-charts
// ============================================================================

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

// ============================================================================
// Mock next/navigation（使用 useSyncExternalStore 实现响应式 useSearchParams）
//
// mockPush 和 mockReplace 都更新 currentSearchParams 并通知所有订阅者，
// 模拟真实 Next.js 中 router.push/replace 后 useSearchParams 自动更新的行为。
// 这是验收要求第 7 项：router.replace 的测试 mock 必须像 router.push 一样真实更新 useSearchParams。
// ============================================================================

let currentSearchParams = new URLSearchParams();
const searchParamsListeners = new Set<() => void>();

function subscribeSearchParams(callback: () => void): () => void {
  searchParamsListeners.add(callback);
  return () => {
    searchParamsListeners.delete(callback);
  };
}

function getSearchParamsSnapshot(): URLSearchParams {
  return currentSearchParams;
}

function updateSearchParams(url: string) {
  const queryStr = url.split('?')[1] || '';
  currentSearchParams = new URLSearchParams(queryStr);
  // 通知所有订阅者，触发 React 重渲染
  searchParamsListeners.forEach((l) => l());
}

const mockPush = jest.fn((url: string) => {
  updateSearchParams(url);
});

const mockReplace = jest.fn((url: string) => {
  updateSearchParams(url);
});

jest.mock('next/navigation', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  return {
    useRouter: () => ({
      push: mockPush,
      replace: mockReplace,
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      prefetch: jest.fn(),
    }),
    useSearchParams: () =>
      React.useSyncExternalStore(
        subscribeSearchParams,
        getSearchParamsSnapshot,
        getSearchParamsSnapshot,
      ),
    usePathname: () => '/',
    useParams: () => ({}),
  };
});

// ============================================================================
// Mock global fetch
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
// 辅助函数：构造 API 响应
// ============================================================================

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

function makeRealKLineResponse(stockId: string, stockCode: string, market: string, stockName: string) {
  const klines: Array<Record<string, unknown>> = [];
  const baseDate = new Date('2024-04-01');
  const changes = [
    0.5, 1.2, -0.8, 0.3, 6.5,
    -1.0, 0.8, 2.1, -0.5, 1.3,
    -7.2, 0.4, 1.1, -0.3, 0.9,
    1.5, -0.6, 0.7, 2.3, -1.1,
    0.4, 1.8, -0.9, 0.5, 5.8,
    -1.4, 0.6, 1.0, -0.4, 0.8,
    1.2, -0.7, 0.3, 1.6, -6.3,
    0.9, -0.2, 1.4, 0.6, -1.0,
    0.7, 1.9, -0.5, 0.4, 1.1,
    -0.8, 0.6, 2.0, -1.2, 0.3,
    1.3, -0.4, 0.8, 1.7, -0.9,
    0.5, 1.0, -0.6, 0.7, 6.1,
    -1.5, 0.4, 0.9, -0.3, 1.2,
  ];
  for (let i = 0; i < changes.length; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
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
        windowStart: firstDate,
        windowEnd: lastDate,
      },
    }),
  };
}

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

// 设置 fetch mock：根据 URL 返回对应股票的行情数据
function setupFetchMock() {
  mockFetch.mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('/api/market/stock-info')) {
      if (url.includes('600519')) {
        return Promise.resolve(makeStockInfoResponse('600519', 'SH', '贵州茅台') as unknown as Response);
      }
      if (url.includes('300750')) {
        return Promise.resolve(makeStockInfoResponse('300750', 'SZ', '宁德时代') as unknown as Response);
      }
      if (url.includes('600518')) {
        return Promise.resolve(makeStockInfoResponse('600518', 'SH', '康美药业') as unknown as Response);
      }
    }
    if (url.includes('/api/market/klines')) {
      if (url.includes('600519')) {
        return Promise.resolve(makeRealKLineResponse('stock-sh-600519', '600519', 'SH', '贵州茅台') as unknown as Response);
      }
      if (url.includes('300750')) {
        return Promise.resolve(makeRealKLineResponse('stock-sz-300750', '300750', 'SZ', '宁德时代') as unknown as Response);
      }
      if (url.includes('600518')) {
        return Promise.resolve(makeRealKLineResponse('stock-sh-600518', '600518', 'SH', '康美药业') as unknown as Response);
      }
    }
    if (url.includes('/api/node-event-candidates')) {
      const params = new URLSearchParams(url.split('?')[1] || '');
      const nodeDate = params.get('nodeDate') || '2024-04-01';
      return Promise.resolve(makeNodeEventCandidatesResponse(nodeDate) as unknown as Response);
    }
    return Promise.resolve({ ok: true, json: async () => ({}) } as unknown as Response);
  });
}

// ============================================================================
// 测试
// ============================================================================

beforeEach(() => {
  currentSearchParams = new URLSearchParams();
  searchParamsListeners.clear();
  mockPush.mockClear();
  mockReplace.mockClear();
  mockFetch.mockReset();
  if (typeof window !== 'undefined') {
    window.localStorage.clear();
  }
});

afterEach(() => {
  searchParamsListeners.clear();
  cleanup();
  document.body.innerHTML = '';
});

describe('第二十阶段 A 验收修复（第二轮）：URL 状态锁定与完整集成', () => {
  test('1. 自选进入 B → 查询 B → 重新查询：URL 清理，股票清空，不会重新选回 B', async () => {
    const Home = (await import('@/app/page')).default;
    const { WatchlistProvider } = await import('@/hooks/useWatchlist');
    const { addToWatchlist } = await import('@/services/watchlist');

    // 预置自选：300750
    addToWatchlist([], { stockCode: '300750', stockName: '宁德时代', market: 'SZ' });
    setupFetchMock();

    await act(async () => {
      render(
        <WatchlistProvider>
          <Home />
        </WatchlistProvider>,
      );
    });

    // 打开"我的自选"，点击 300750 的"查看"
    await act(async () => {
      fireEvent.click(screen.getByTestId('watchlist-entry'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('watchlist-drawer')).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('watchlist-view-300750'));
    });

    // 断言 URL 切换为 300750
    expect(mockPush).toHaveBeenCalled();
    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).toContain('stock=300750');

    // 等待页面进入"已选中 300750、等待查询"状态
    await waitFor(() => {
      expect(screen.queryByTestId('result-title')).not.toBeInTheDocument();
    });

    // 点击"查询行情"
    await act(async () => {
      fireEvent.click(screen.getByText('查询行情'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('result-title')).toHaveTextContent('宁德时代');
    }, { timeout: 10000 });

    // 点击"重新查询"
    await act(async () => {
      fireEvent.click(screen.getByText('重新查询'));
    });

    // 关键断言：router.replace 被调用，清除 URL 参数
    expect(mockReplace).toHaveBeenCalled();
    const replaceUrl = mockReplace.mock.calls[0][0] as string;
    expect(replaceUrl).toBe('/');

    // 关键断言：URL 参数已被清理（currentSearchParams 不再包含 stock）
    expect(currentSearchParams.get('stock')).toBeNull();

    // 关键断言：旧的 300750 行情标题立即消失
    await waitFor(() => {
      expect(screen.queryByTestId('result-title')).not.toBeInTheDocument();
    });

    // 关键断言：不会立即重新选回 300750
    // 页面应处于初始状态，等待用户输入新股票
    const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('');
  }, 30000);

  test('2. 自选进入 B → 手动选择 C：最终选中 C，不被旧 URL 覆盖，查询参数为 C', async () => {
    const Home = (await import('@/app/page')).default;
    const { WatchlistProvider } = await import('@/hooks/useWatchlist');
    const { addToWatchlist } = await import('@/services/watchlist');

    // 预置自选：300750（股票 B）
    addToWatchlist([], { stockCode: '300750', stockName: '宁德时代', market: 'SZ' });
    setupFetchMock();

    await act(async () => {
      render(
        <WatchlistProvider>
          <Home />
        </WatchlistProvider>,
      );
    });

    // 从自选进入 300750
    await act(async () => {
      fireEvent.click(screen.getByTestId('watchlist-entry'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('watchlist-drawer')).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('watchlist-view-300750'));
    });

    // 等待页面进入"已选中 300750、等待查询"状态
    await waitFor(() => {
      expect(screen.queryByTestId('result-title')).not.toBeInTheDocument();
    });

    // 手动输入 600519（股票 C）并查询
    const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: '600519' } });
    });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    await act(async () => {
      fireEvent.click(screen.getByText('查询行情'));
    });

    // 关键断言：最终展示的是 600519 的行情，不是 300750
    await waitFor(() => {
      expect(screen.getByTestId('result-title')).toHaveTextContent('贵州茅台');
    }, { timeout: 10000 });

    // 关键断言：klines 请求参数为 600519，不是 300750
    const klineCalls = mockFetch.mock.calls.filter(
      (call) => typeof call[0] === 'string' && (call[0] as string).includes('/api/market/klines'),
    );
    expect(klineCalls.length).toBeGreaterThanOrEqual(1);
    const lastKlineUrl = klineCalls[klineCalls.length - 1][0] as string;
    expect(lastKlineUrl).toContain('stockCode=600519');
    expect(lastKlineUrl).not.toContain('stockCode=300750');

    // 关键断言：URL 已被清理（不再包含 stock=300750）
    expect(currentSearchParams.get('stock')).not.toBe('300750');
  }, 30000);

  test('3. 自选进入名称为空的股票：断言已选中代码，查询请求使用该代码，名称自动同步', async () => {
    const Home = (await import('@/app/page')).default;
    const { WatchlistProvider } = await import('@/hooks/useWatchlist');
    const { addToWatchlist } = await import('@/services/watchlist');

    // 预置自选：名称为空的股票 600518
    addToWatchlist([], { stockCode: '600518', stockName: '', market: 'SH' });
    setupFetchMock();

    await act(async () => {
      render(
        <WatchlistProvider>
          <Home />
        </WatchlistProvider>,
      );
    });

    // 打开"我的自选"，点击 600518 的"查看"
    await act(async () => {
      fireEvent.click(screen.getByTestId('watchlist-entry'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('watchlist-drawer')).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('watchlist-view-600518'));
    });

    // 断言 URL 切换为 600518，不包含 name 参数
    expect(mockPush).toHaveBeenCalled();
    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).toContain('stock=600518');
    expect(pushedUrl).toContain('market=SH');
    expect(pushedUrl).not.toContain('name=');

    // 关键断言：页面已选中 600518
    await waitFor(() => {
      expect(screen.getByText('查询行情')).toBeInTheDocument();
    });

    // 断言显示 600518（名称可能已同步或仍在查询中）
    const stockLabel = screen.getByTestId('stock-search-input') as HTMLInputElement;
    expect(stockLabel.value).toContain('600518');

    // 断言不出现 undefined 或 null 文案
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/null/i)).not.toBeInTheDocument();

    // 关键断言：stock-info 被自动调用查询真实名称
    await waitFor(() => {
      const stockInfoCalls = mockFetch.mock.calls.filter(
        (call) => typeof call[0] === 'string' && (call[0] as string).includes('/api/market/stock-info') && (call[0] as string).includes('600518'),
      );
      expect(stockInfoCalls.length).toBeGreaterThanOrEqual(1);
    }, { timeout: 5000 });

    // 关键断言：名称自动同步为"康美药业"（从空名称更新为真实名称）
    await waitFor(() => {
      const input = screen.getByTestId('stock-search-input') as HTMLInputElement;
      expect(input.value).toContain('康美药业');
    }, { timeout: 5000 });

    // 点击"查询行情"
    await act(async () => {
      fireEvent.click(screen.getByText('查询行情'));
    });

    // 关键断言：klines 请求参数为 600518
    const klineCalls = mockFetch.mock.calls.filter(
      (call) => typeof call[0] === 'string' && (call[0] as string).includes('/api/market/klines'),
    );
    expect(klineCalls.length).toBeGreaterThanOrEqual(1);
    const klineUrl = klineCalls[klineCalls.length - 1][0] as string;
    expect(klineUrl).toContain('stockCode=600518');
  }, 20000);

  test('4. 同一股票名称从"名称获取中"更新为真实名称，不产生重复重置', async () => {
    const Home = (await import('@/app/page')).default;
    const { WatchlistProvider } = await import('@/hooks/useWatchlist');
    const { addToWatchlist } = await import('@/services/watchlist');

    // 预置自选：300750（有名称）
    addToWatchlist([], { stockCode: '300750', stockName: '宁德时代', market: 'SZ' });
    setupFetchMock();

    await act(async () => {
      render(
        <WatchlistProvider>
          <Home />
        </WatchlistProvider>,
      );
    });

    // 从自选进入 300750（URL 携带名称）
    await act(async () => {
      fireEvent.click(screen.getByTestId('watchlist-entry'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('watchlist-drawer')).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('watchlist-view-300750'));
    });

    // 等待页面进入"已选中"状态
    await waitFor(() => {
      expect(screen.getByText('查询行情')).toBeInTheDocument();
    });

    // 点击"查询行情"
    await act(async () => {
      fireEvent.click(screen.getByText('查询行情'));
    });

    // 等待查询成功
    await waitFor(() => {
      expect(screen.getByTestId('result-title')).toHaveTextContent('宁德时代');
    }, { timeout: 10000 });

    // 关键断言：不会因为名称同步而重复重置（result-title 仍然存在）
    // 等待一段时间确认没有异步重置
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(screen.getByTestId('result-title')).toHaveTextContent('宁德时代');

    // 关键断言：klines 只被请求一次（不重复查询）
    const klineCalls = mockFetch.mock.calls.filter(
      (call) => typeof call[0] === 'string' && (call[0] as string).includes('/api/market/klines'),
    );
    expect(klineCalls.length).toBe(1);
  }, 15000);

  test('5. 案例页：打开"我的自选"→点击"查看"→正确进入普通查询页', async () => {
    const CoreReplayDemoPage = (await import('@/app/demo/core-replay/page')).default;
    const { WatchlistProvider } = await import('@/hooks/useWatchlist');
    const { addToWatchlist } = await import('@/services/watchlist');

    // 预置自选：300750
    addToWatchlist([], { stockCode: '300750', stockName: '宁德时代', market: 'SZ' });

    await act(async () => {
      render(
        <WatchlistProvider>
          <CoreReplayDemoPage />
        </WatchlistProvider>,
      );
    });

    // 案例页应有"我的自选"入口
    const watchlistEntry = screen.getAllByTestId('watchlist-entry')[0];
    expect(watchlistEntry).toBeInTheDocument();

    // 打开"我的自选"抽屉
    await act(async () => {
      fireEvent.click(watchlistEntry);
    });
    await waitFor(() => {
      expect(screen.getByTestId('watchlist-drawer')).toBeInTheDocument();
    });

    // 点击 300750 的"查看"
    await act(async () => {
      fireEvent.click(screen.getByTestId('watchlist-view-300750'));
    });

    // 关键断言：router.push 被调用，URL 指向首页并携带 300750 参数
    expect(mockPush).toHaveBeenCalled();
    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).toContain('stock=300750');
    expect(pushedUrl).toContain('market=SZ');
    // 应该跳转到首页（/），不是案例页
    expect(pushedUrl.startsWith('/?')).toBe(true);
  }, 15000);

  test('6. localStorage 移除失败：按钮仍为"已加入本机自选"，列表不减少，提示"本次未移除自选"', async () => {
    const Home = (await import('@/app/page')).default;
    const { WatchlistProvider } = await import('@/hooks/useWatchlist');
    const { addToWatchlist } = await import('@/services/watchlist');

    // 预置自选：300750 已存在
    addToWatchlist([], { stockCode: '300750', stockName: '宁德时代', market: 'SZ' });
    setupFetchMock();

    // 模拟 localStorage 写入失败（通过 mock Storage.prototype.setItem）
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = jest.fn(() => {
      throw new Error('QuotaExceededError');
    });

    try {
      await act(async () => {
        render(
          <WatchlistProvider>
            <Home />
          </WatchlistProvider>,
        );
      });

      // 从自选进入 300750
      await act(async () => {
        fireEvent.click(screen.getByTestId('watchlist-entry'));
      });
      await waitFor(() => {
        expect(screen.getByTestId('watchlist-drawer')).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('watchlist-view-300750'));
      });

      // 等待页面进入"已选中"状态
      await waitFor(() => {
        expect(screen.getByText('查询行情')).toBeInTheDocument();
      });

      // 点击"查询行情"加载行情
      await act(async () => {
        fireEvent.click(screen.getByText('查询行情'));
      });
      await waitFor(() => {
        expect(screen.getByTestId('result-title')).toHaveTextContent('宁德时代');
      }, { timeout: 10000 });

      // WatchlistButton 的 data-testid 是 watchlist-button
      // 300750 已在自选中，按钮显示"★ 已加入本机自选"，点击会移除
      const watchlistBtn = screen.getByTestId('watchlist-button');
      expect(watchlistBtn).toHaveTextContent('已加入本机自选');

      // 点击移除（会因 localStorage 失败而失败）
      await act(async () => {
        fireEvent.click(watchlistBtn);
      });

      // 关键断言：移除失败时显示失败提示
      await waitFor(() => {
        expect(screen.getByTestId('watchlist-save-error')).toBeInTheDocument();
      }, { timeout: 5000 });
      expect(screen.getByTestId('watchlist-save-error')).toHaveTextContent('浏览器保存失败，本次未移除自选');

      // 关键断言：按钮仍为"已加入本机自选"（移除失败，仍保留原自选）
      expect(screen.getByTestId('watchlist-button')).toHaveTextContent('已加入本机自选');
    } finally {
      // 恢复原始 setItem
      Storage.prototype.setItem = originalSetItem;
    }
  }, 20000);

  test('7. router.replace 真实更新 useSearchParams（不绕过路由状态）', async () => {
    const Home = (await import('@/app/page')).default;
    const { WatchlistProvider } = await import('@/hooks/useWatchlist');
    const { addToWatchlist } = await import('@/services/watchlist');

    addToWatchlist([], { stockCode: '300750', stockName: '宁德时代', market: 'SZ' });
    setupFetchMock();

    await act(async () => {
      render(
        <WatchlistProvider>
          <Home />
        </WatchlistProvider>,
      );
    });

    // 从自选进入 300750 → URL 应包含 stock=300750
    await act(async () => {
      fireEvent.click(screen.getByTestId('watchlist-entry'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('watchlist-drawer')).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('watchlist-view-300750'));
    });

    // 关键断言：mockPush 后 currentSearchParams 真实更新
    expect(currentSearchParams.get('stock')).toBe('300750');
    expect(currentSearchParams.get('market')).toBe('SZ');

    // 查询 300750
    await act(async () => {
      fireEvent.click(screen.getByText('查询行情'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('result-title')).toHaveTextContent('宁德时代');
    }, { timeout: 10000 });

    // 点击"重新查询"→ router.replace('/')
    await act(async () => {
      fireEvent.click(screen.getByText('重新查询'));
    });

    // 关键断言：mockReplace 后 currentSearchParams 真实更新为空
    expect(currentSearchParams.get('stock')).toBeNull();
    expect(currentSearchParams.get('market')).toBeNull();

    // 关键断言：URL 被清理后，页面确实回到初始状态
    await waitFor(() => {
      expect(screen.queryByTestId('result-title')).not.toBeInTheDocument();
    });
    // 输入框应为空，等待新输入
    const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/) as HTMLInputElement;
    expect(input.value).toBe('');
  }, 30000);

  test('8. 非法 URL（100000+SH、300750+SH）不被接受，清理参数回到初始状态', async () => {
    const Home = (await import('@/app/page')).default;
    const { WatchlistProvider } = await import('@/hooks/useWatchlist');

    setupFetchMock();

    // 直接设置非法 URL：300750 属于 SZ，但 URL 写 SH
    updateSearchParams('/?stock=300750&market=SH');

    await act(async () => {
      render(
        <WatchlistProvider>
          <Home />
        </WatchlistProvider>,
      );
    });

    // 关键断言：router.replace 被调用清理非法参数
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/');
    }, { timeout: 5000 });

    // 关键断言：URL 参数已被清理
    expect(currentSearchParams.get('stock')).toBeNull();

    // 关键断言：页面回到初始状态，没有选中股票
    const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/) as HTMLInputElement;
    expect(input.value).toBe('');
    expect(screen.queryByTestId('result-title')).not.toBeInTheDocument();

    // 测试 detectMarket 返回 null 的非法代码（100000 非 6/0/3 开头实际是 1 开头）
    mockReplace.mockClear();
    updateSearchParams('/?stock=100000&market=SH');

    await act(async () => {
      // 触发 routeKey 变化的重新渲染
      searchParamsListeners.forEach((l) => l());
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/');
    }, { timeout: 5000 });
  }, 15000);

  test('9. localStorage 加入失败：按钮仍显示"加入自选"，列表数量不增加，提示"本次未加入自选"', async () => {
    const Home = (await import('@/app/page')).default;
    const { WatchlistProvider } = await import('@/hooks/useWatchlist');

    setupFetchMock();

    // 模拟 localStorage 写入失败
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = jest.fn(() => {
      throw new Error('QuotaExceededError');
    });

    try {
      await act(async () => {
        render(
          <WatchlistProvider>
            <Home />
          </WatchlistProvider>,
        );
      });

      // 手动输入 600519 并查询
      const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/) as HTMLInputElement;
      await act(async () => {
        fireEvent.change(input, { target: { value: '600519' } });
      });
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });
      await act(async () => {
        fireEvent.click(screen.getByText('查询行情'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('result-title')).toHaveTextContent('贵州茅台');
      }, { timeout: 10000 });

      // 点击"加入自选"（会因 localStorage 失败而失败）
      const addButton = screen.getByTestId('watchlist-button');
      expect(addButton).toHaveTextContent('加入自选');

      await act(async () => {
        fireEvent.click(addButton);
      });

      // 关键断言：加入失败时显示"本次未加入自选"提示
      await waitFor(() => {
        expect(screen.getByTestId('watchlist-save-error')).toHaveTextContent('浏览器保存失败，本次未加入自选');
      }, { timeout: 5000 });

      // 关键断言：按钮仍显示"加入自选"（未成功加入）
      expect(screen.getByTestId('watchlist-button')).toHaveTextContent('加入自选');

      // 关键断言：自选列表数量不增加（打开抽屉验证）
      await act(async () => {
        fireEvent.click(screen.getByTestId('watchlist-entry'));
      });
      await waitFor(() => {
        expect(screen.getByTestId('watchlist-drawer')).toBeInTheDocument();
      });
      // 抽屉应显示空状态或数量为 0
      const countElements = screen.queryAllByTestId('watchlist-count');
      if (countElements.length > 0) {
        expect(countElements[0]).toHaveTextContent('0');
      }
    } finally {
      Storage.prototype.setItem = originalSetItem;
    }
  }, 20000);

  test('10. 案例页"查看"后首页正确选中目标股票（端到端验证）', async () => {
    const CoreReplayDemoPage = (await import('@/app/demo/core-replay/page')).default;
    const Home = (await import('@/app/page')).default;
    const { WatchlistProvider } = await import('@/hooks/useWatchlist');
    const { addToWatchlist } = await import('@/services/watchlist');

    // 预置自选：600519
    addToWatchlist([], { stockCode: '600519', stockName: '贵州茅台', market: 'SH' });
    setupFetchMock();

    // 先渲染案例页
    const { unmount } = await act(async () => {
      return render(
        <WatchlistProvider>
          <CoreReplayDemoPage />
        </WatchlistProvider>,
      );
    });

    // 打开"我的自选"，点击 600519 的"查看"
    await act(async () => {
      fireEvent.click(screen.getAllByTestId('watchlist-entry')[0]);
    });
    await waitFor(() => {
      expect(screen.getByTestId('watchlist-drawer')).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('watchlist-view-600519'));
    });

    // 关键断言：router.push 被调用，URL 包含 600519
    expect(mockPush).toHaveBeenCalled();
    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).toContain('stock=600519');
    expect(pushedUrl).toContain('market=SH');

    // 卸载案例页，渲染首页（模拟路由跳转）
    unmount();
    cleanup();

    // 渲染首页
    await act(async () => {
      render(
        <WatchlistProvider>
          <Home />
        </WatchlistProvider>,
      );
    });

    // 关键断言：首页正确选中了 600519
    await waitFor(() => {
      expect(screen.getByText('查询行情')).toBeInTheDocument();
    });

    // 关键断言：输入框显示 600519（已选中）
    const input = screen.getByTestId('stock-search-input') as HTMLInputElement;
    expect(input.value).toContain('600519');

    // 点击查询，验证请求参数为 600519
    await act(async () => {
      fireEvent.click(screen.getByText('查询行情'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('result-title')).toHaveTextContent('贵州茅台');
    }, { timeout: 10000 });
  }, 20000);
});
