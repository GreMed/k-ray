/**
 * 普通用户查询体验修复测试（V2）
 * 覆盖三项修复：
 *   1. 真实股票名称查询（基于 BaoStock，不再静态写死）
 *   2. 区分「无交易数据」与「行情服务不可用」（含 fallback 空结果）
 *   3. 普通用户界面隐藏开发工具（仅 ?dev=1 显示）
 *
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import fs from 'fs';

import Home from '@/app/page';
import {
  buildStockFromCode,
  formatStockDisplayName,
  formatStockLabel,
  validateMarketConsistency,
} from '@/utils/stockCode';
import { isDevEnvironment } from '@/utils/devHelpers';
import { resolvePythonPath, fetchStockInfo, clearStockInfoCache } from '@/services/marketData/stockInfo';
import Header from '@/components/Header';

// === Mock global fetch ===
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch as unknown as typeof fetch;

// Mock execFile 以避免真实调用 Python 脚本
jest.mock('child_process', () => {
  const actual = jest.requireActual('child_process');
  return {
    ...actual,
    execFile: jest.fn(),
  };
});

import { execFile } from 'child_process';
const mockedExecFile = execFile as jest.MockedFunction<typeof execFile>;

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

// 构造 stock-info API 失败响应
function makeStockInfoErrorResponse() {
  return {
    ok: false,
    status: 503,
    json: async () => ({ error: 'BaoStock服务暂时不可用' }),
  };
}

// 构造 klines API 成功响应（有K线数据）
function makeRealKLineResponse(stockId: string, stockCode: string, market: string, stockName: string, count: number = 10) {
  const klines = [];
  const baseDate = new Date('2024-04-01');
  for (let i = 0; i < count; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i * 3);
    const dateStr = d.toISOString().slice(0, 10);
    klines.push({
      id: `baostock:${stockId}:${dateStr}`,
      stockId,
      date: dateStr,
      open: 100 + i * 5,
      high: 105 + i * 5,
      low: 95 + i * 5,
      close: 102 + i * 5,
      volume: 3000000 + i * 100000,
      changePercent: 0.3 + i * 0.1,
    });
  }
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
      },
    }),
  };
}

// 构造 klines API 成功响应但 0 根K线（真实成功，无交易数据）
function makeEmptyKLineResponse(stockId: string, stockCode: string, market: string, stockName: string) {
  return {
    ok: true,
    json: async () => ({
      stock: { id: stockId, code: stockCode, name: stockName, market },
      klines: [],
      meta: {
        source: 'baostock',
        sourceLabel: 'BaoStock真实行情(前复权日线)',
        adjustment: 'qfq',
        isRealMarketData: true,
        fetchedAt: '2024-07-01T00:00:00.000Z',
      },
    }),
  };
}

// 构造 klines API 成功响应但 fallback 降级 + 空 K 线
function makeFallbackEmptyKLineResponse(stockId: string, stockCode: string, market: string, stockName: string, reason: string) {
  return {
    ok: true,
    json: async () => ({
      stock: { id: stockId, code: stockCode, name: stockName, market },
      klines: [],
      meta: {
        source: 'mock',
        sourceLabel: 'Mock演示数据(BaoStock降级)',
        adjustment: 'none',
        isRealMarketData: false,
        fetchedAt: '2024-07-01T00:00:00.000Z',
        fallbackReason: `BaoStock真实行情暂时不可用，当前已降级为本地Mock行情。原因：${reason}`,
      },
    }),
  };
}

// 根据 URL 路由 fetch 请求
function routeFetch(urlMatcher: (url: string) => boolean, response: unknown) {
  return (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (urlMatcher(url)) {
      return Promise.resolve(response as Response);
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({}),
    } as unknown as Response);
  };
}

describe('普通用户查询体验修复测试（V2）', () => {
  let originalNodeEnv: string | undefined;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    jest.clearAllMocks();
    mockFetch.mockClear();
    mockedExecFile.mockClear();
    clearStockInfoCache();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    consoleErrorSpy.mockRestore();
    clearStockInfoCache();
  });

  // ========== 修复一：真实股票名称查询 ==========

  describe('修复一：真实股票名称查询', () => {
    test('buildStockFromCode 初始名称为空（名称由 API 填充）', () => {
      const stock600519 = buildStockFromCode('600519');
      expect(stock600519).not.toBeNull();
      expect(stock600519?.name).toBe(''); // 初始为空，由 API 填充
      expect(stock600519?.code).toBe('600519');
      expect(stock600519?.market).toBe('SH');

      const stock603236 = buildStockFromCode('603236');
      expect(stock603236?.name).toBe('');
      expect(stock603236?.market).toBe('SH');
    });

    test('formatStockDisplayName 有名称时显示「名称（代码）」', () => {
      const stock = { id: 'stock-sh-600519', code: '600519', name: '贵州茅台', market: 'SH' as const };
      expect(formatStockDisplayName(stock)).toBe('贵州茅台（600519）');
    });

    test('formatStockDisplayName 无名称时显示「代码（名称暂未取得）」', () => {
      const stock = { id: 'stock-sh-603236', code: '603236', name: '', market: 'SH' as const };
      expect(formatStockDisplayName(stock)).toBe('603236（名称暂未取得）');
    });

    test('formatStockLabel 有名称时显示「代码 / 名称」', () => {
      const stock = { id: 'stock-sh-600519', code: '600519', name: '贵州茅台', market: 'SH' as const };
      expect(formatStockLabel(stock)).toBe('600519 / 贵州茅台');
    });

    test('formatStockLabel 无名称时显示「代码 / 名称暂未取得」', () => {
      const stock = { id: 'stock-sh-603236', code: '603236', name: '', market: 'SH' as const };
      expect(formatStockLabel(stock)).toBe('603236 / 名称暂未取得');
    });

    test('fetchStockInfo 603236 返回「移远通信」（真实联调 mock）', async () => {
      // Mock execFile 返回 BaoStock 股票基础资料
      mockedExecFile.mockImplementation(((
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        cb(null, JSON.stringify({
          success: true,
          code: 'sh.603236',
          code_name: '移远通信',
          ipoDate: '2019-07-16',
          outDate: '',
          type: '1',
          status: '1',
          found: true,
        }), '');
      }) as typeof execFile);

      const info = await fetchStockInfo('603236', 'SH');
      expect(info.name).toBe('移远通信');
      expect(info.found).toBe(true);
    });

    test('fetchStockInfo 600519 返回「贵州茅台」', async () => {
      mockedExecFile.mockImplementation(((
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        cb(null, JSON.stringify({
          success: true,
          code: 'sh.600519',
          code_name: '贵州茅台',
          ipoDate: '2001-08-27',
          outDate: '',
          type: '1',
          status: '1',
          found: true,
        }), '');
      }) as typeof execFile);

      const info = await fetchStockInfo('600519', 'SH');
      expect(info.name).toBe('贵州茅台');
    });

    test('fetchStockInfo 查询结果会被缓存（第二次不调用 execFile）', async () => {
      mockedExecFile.mockImplementation(((
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        cb(null, JSON.stringify({
          success: true,
          code: 'sh.603236',
          code_name: '移远通信',
          ipoDate: '2019-07-16',
          outDate: '',
          type: '1',
          status: '1',
          found: true,
        }), '');
      }) as typeof execFile);

      await fetchStockInfo('603236', 'SH');
      await fetchStockInfo('603236', 'SH');

      // execFile 应只被调用一次（第二次命中缓存）
      expect(mockedExecFile).toHaveBeenCalledTimes(1);
    });

    test('fetchStockInfo 查询失败时抛出错误（不返回伪名称）', async () => {
      mockedExecFile.mockImplementation(((
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        cb(new Error('BaoStock服务暂时不可用'), '', '');
      }) as typeof execFile);

      await expect(fetchStockInfo('603236', 'SH')).rejects.toThrow();
    });

    test('输入603236后自定义选项显示「移远通信」（前端集成）', async () => {
      // Mock stock-info API 返回「移远通信」
      mockFetch.mockImplementation(routeFetch(
        (url) => url.includes('/api/market/stock-info'),
        makeStockInfoResponse('603236', 'SH', '移远通信'),
      ));

      await act(async () => { render(<Home />); });

      const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/) as HTMLInputElement;
      await act(async () => {
        fireEvent.change(input, { target: { value: '603236' } });
      });

      await waitFor(() => {
        expect(screen.getByTestId('custom-code-option')).toBeInTheDocument();
      });

      // 自定义代码选项中应显示「移远通信」
      await waitFor(() => {
        expect(screen.getByText('移远通信', { selector: 'button span' })).toBeInTheDocument();
      }, { timeout: 5000 });
      // 不应出现「股票603236」伪名称
      expect(screen.queryByText('股票603236')).not.toBeInTheDocument();
    });

    test('查询603236成功后结果标题显示「移远通信（603236）」', async () => {
      // Mock stock-info API 和 klines API
      mockFetch.mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('/api/market/stock-info')) {
          return Promise.resolve(makeStockInfoResponse('603236', 'SH', '移远通信') as unknown as Response);
        }
        if (url.includes('/api/market/klines')) {
          return Promise.resolve(makeRealKLineResponse('stock-sh-603236', '603236', 'SH', '移远通信') as unknown as Response);
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as unknown as Response);
      });

      await act(async () => { render(<Home />); });

      const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/) as HTMLInputElement;
      await act(async () => {
        fireEvent.change(input, { target: { value: '603236' } });
      });
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });

      await act(async () => {
        fireEvent.click(screen.getByText('查询行情'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('result-title')).toBeInTheDocument();
      }, { timeout: 5000 });

      // 结果标题应显示「移远通信（603236）」
      expect(screen.getByTestId('result-title').textContent).toContain('移远通信（603236）');
      expect(screen.getByTestId('result-title').textContent).not.toContain('股票603236');
      expect(screen.getByTestId('result-title').textContent).not.toContain('名称暂未取得');
    });

    test('名称查询失败不阻止继续查询日K', async () => {
      // stock-info API 失败，但 klines API 成功
      mockFetch.mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('/api/market/stock-info')) {
          return Promise.resolve(makeStockInfoErrorResponse() as unknown as Response);
        }
        if (url.includes('/api/market/klines')) {
          return Promise.resolve(makeRealKLineResponse('stock-sh-603236', '603236', 'SH', '') as unknown as Response);
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as unknown as Response);
      });

      await act(async () => { render(<Home />); });

      const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/) as HTMLInputElement;
      await act(async () => {
        fireEvent.change(input, { target: { value: '603236' } });
      });
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });

      // 应成功选择股票
      expect(screen.getByText(/已选择.*603236/)).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByText('查询行情'));
      });

      // 查询应成功（不因名称不可得而阻止）
      await waitFor(() => {
        expect(screen.getByText(/日K查询结果/)).toBeInTheDocument();
      }, { timeout: 5000 });

      // 名称查询失败时显示「603236（名称暂未取得）」
      expect(screen.getByTestId('result-title').textContent).toContain('603236（名称暂未取得）');
    });
  });

  // ========== 修复二：区分「无交易数据」与「行情服务不可用」 ==========

  describe('修复二：区分「无交易数据」与「行情服务不可用」', () => {
    test('真实成功但0根K线显示「所选区间暂无交易数据」', async () => {
      mockFetch.mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('/api/market/stock-info')) {
          return Promise.resolve(makeStockInfoResponse('600519', 'SH', '贵州茅台') as unknown as Response);
        }
        if (url.includes('/api/market/klines')) {
          return Promise.resolve(makeEmptyKLineResponse('stock-sh-600519', '600519', 'SH', '贵州茅台') as unknown as Response);
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as unknown as Response);
      });

      await act(async () => { render(<Home />); });

      const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/) as HTMLInputElement;
      await act(async () => {
        fireEvent.change(input, { target: { value: '600519' } });
      });
      const suggestion = await screen.findByText('贵州茅台', { selector: 'button span' });
      await act(async () => { fireEvent.click(suggestion); });

      await act(async () => {
        fireEvent.click(screen.getByText('查询行情'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      }, { timeout: 5000 });

      // 空状态标题应为「所选区间暂无交易数据」
      expect(screen.getByText('所选区间暂无交易数据')).toBeInTheDocument();
      // 不应显示「真实行情服务暂时不可用」
      expect(screen.queryByText('真实行情服务暂时不可用')).not.toBeInTheDocument();
    });

    test('BaoStock不可用（API返回503）显示「真实行情服务暂时不可用」', async () => {
      mockFetch.mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('/api/market/stock-info')) {
          return Promise.resolve(makeStockInfoResponse('600519', 'SH', '贵州茅台') as unknown as Response);
        }
        if (url.includes('/api/market/klines')) {
          return Promise.resolve({
            ok: false,
            status: 503,
            json: async () => ({ error: 'BaoStock服务暂时不可用，请稍后重试' }),
          } as unknown as Response);
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as unknown as Response);
      });

      await act(async () => { render(<Home />); });

      const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/) as HTMLInputElement;
      await act(async () => {
        fireEvent.change(input, { target: { value: '600519' } });
      });
      const suggestion = await screen.findByText('贵州茅台', { selector: 'button span' });
      await act(async () => { fireEvent.click(suggestion); });

      await act(async () => {
        fireEvent.click(screen.getByText('查询行情'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      }, { timeout: 5000 });

      // 错误状态标题应为「真实行情服务暂时不可用」
      expect(screen.getByText('真实行情服务暂时不可用')).toBeInTheDocument();
      // 描述应包含「当前无法查询这只股票」
      expect(screen.getByText(/当前无法查询这只股票/)).toBeInTheDocument();
      // 不应显示「所选区间暂无交易数据」
      expect(screen.queryByText('所选区间暂无交易数据')).not.toBeInTheDocument();
    });

    test('fallback降级 + 空 K 线 → 显示「真实行情服务暂时不可用」', async () => {
      // BaoStock 失败，降级到 Mock，但 Mock 也没有该股票数据
      // API 返回 200，klines=[]，存在 fallbackReason
      mockFetch.mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('/api/market/stock-info')) {
          return Promise.resolve(makeStockInfoResponse('603236', 'SH', '移远通信') as unknown as Response);
        }
        if (url.includes('/api/market/klines')) {
          return Promise.resolve(makeFallbackEmptyKLineResponse(
            'stock-sh-603236', '603236', 'SH', '移远通信', 'BaoStock连接超时'
          ) as unknown as Response);
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as unknown as Response);
      });

      await act(async () => { render(<Home />); });

      const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/) as HTMLInputElement;
      await act(async () => {
        fireEvent.change(input, { target: { value: '603236' } });
      });
      // 等待 stock-info API 返回名称
      await waitFor(() => {
        expect(screen.getByText('移远通信', { selector: 'button span' })).toBeInTheDocument();
      }, { timeout: 5000 });
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });

      await act(async () => {
        fireEvent.click(screen.getByText('查询行情'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      }, { timeout: 5000 });

      // 错误状态标题应为「真实行情服务暂时不可用」
      expect(screen.getByText('真实行情服务暂时不可用')).toBeInTheDocument();
      // 描述应包含「当前无法查询这只股票」
      expect(screen.getByText(/当前无法查询这只股票/)).toBeInTheDocument();
      // 描述应包含 fallback 降级原因
      expect(screen.getByText(/BaoStock连接超时/)).toBeInTheDocument();
      // 不应显示「所选区间暂无交易数据」
      expect(screen.queryByText('所选区间暂无交易数据')).not.toBeInTheDocument();
      // 不应显示「可能未上市」
      expect(screen.queryByText(/可能未上市/)).not.toBeInTheDocument();
      // 不应显示「日期范围不正确」
      expect(screen.queryByText(/日期范围不正确/)).not.toBeInTheDocument();
    });

    test('行情服务不可用时提供重试和返回修改按钮', async () => {
      mockFetch.mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('/api/market/stock-info')) {
          return Promise.resolve(makeStockInfoResponse('600519', 'SH', '贵州茅台') as unknown as Response);
        }
        if (url.includes('/api/market/klines')) {
          return Promise.resolve({
            ok: false,
            status: 503,
            json: async () => ({ error: 'BaoStock服务暂时不可用' }),
          } as unknown as Response);
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as unknown as Response);
      });

      await act(async () => { render(<Home />); });

      const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/) as HTMLInputElement;
      await act(async () => {
        fireEvent.change(input, { target: { value: '600519' } });
      });
      const suggestion = await screen.findByText('贵州茅台', { selector: 'button span' });
      await act(async () => { fireEvent.click(suggestion); });

      await act(async () => {
        fireEvent.click(screen.getByText('查询行情'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      }, { timeout: 5000 });

      expect(screen.getByTestId('error-retry-btn')).toBeInTheDocument();
      expect(screen.getByTestId('error-return-btn')).toBeInTheDocument();
    });

    test('网络错误也显示「真实行情服务暂时不可用」', async () => {
      mockFetch.mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('/api/market/stock-info')) {
          return Promise.resolve(makeStockInfoResponse('600519', 'SH', '贵州茅台') as unknown as Response);
        }
        if (url.includes('/api/market/klines')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as unknown as Response);
      });

      await act(async () => { render(<Home />); });

      const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/) as HTMLInputElement;
      await act(async () => {
        fireEvent.change(input, { target: { value: '600519' } });
      });
      const suggestion = await screen.findByText('贵州茅台', { selector: 'button span' });
      await act(async () => { fireEvent.click(suggestion); });

      await act(async () => {
        fireEvent.click(screen.getByText('查询行情'));
      });

      await waitFor(() => {
        expect(screen.getByText('真实行情服务暂时不可用')).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  // ========== 修复三：普通用户界面隐藏开发工具 ==========

  describe('修复三：普通用户界面隐藏开发工具', () => {
    test('isDevEnvironment 在生产环境始终返回 false', () => {
      process.env.NODE_ENV = 'production';
      expect(isDevEnvironment()).toBe(false);
    });

    test('isDevEnvironment 在 Jest 测试环境始终返回 true', () => {
      process.env.NODE_ENV = 'development';
      expect(process.env.JEST_WORKER_ID).toBeDefined();
      expect(isDevEnvironment()).toBe(true);
    });

    test('isDevEnvironment 在开发环境无 ?dev=1 参数时返回 false', () => {
      const originalJestWorkerId = process.env.JEST_WORKER_ID;
      delete process.env.JEST_WORKER_ID;
      process.env.NODE_ENV = 'development';
      window.history.pushState({}, '', '/');
      try {
        expect(isDevEnvironment()).toBe(false);
      } finally {
        if (originalJestWorkerId) process.env.JEST_WORKER_ID = originalJestWorkerId;
      }
    });

    test('isDevEnvironment 在开发环境有 ?dev=1 参数时返回 true', () => {
      const originalJestWorkerId = process.env.JEST_WORKER_ID;
      delete process.env.JEST_WORKER_ID;
      process.env.NODE_ENV = 'development';
      window.history.pushState({}, '', '/?dev=1');
      try {
        expect(isDevEnvironment()).toBe(true);
      } finally {
        window.history.pushState({}, '', '/');
        if (originalJestWorkerId) process.env.JEST_WORKER_ID = originalJestWorkerId;
      }
    });

    test('Jest 测试环境下 DevToolsPanel 可见（保证既有测试覆盖）', async () => {
      process.env.NODE_ENV = 'development';
      await act(async () => { render(<Home />); });

      expect(screen.getByText('🛠 开发模式')).toBeInTheDocument();
    });
  });

  // ========== 修复二补充：BaoStock Python 环境解析 ==========

  describe('修复二补充：BaoStock Python 环境解析', () => {
    test('resolvePythonPath 优先使用环境变量 BAOSTOCK_PYTHON_PATH', () => {
      const original = process.env.BAOSTOCK_PYTHON_PATH;
      const originalCwd = process.cwd;
      // Mock process.cwd 返回不存在的目录，确保 .venv 检测不干扰
      process.cwd = () => '/nonexistent/path/for/test';
      process.env.BAOSTOCK_PYTHON_PATH = '/usr/local/bin/python3';
      try {
        // 需要文件存在
        const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        expect(resolvePythonPath()).toBe('/usr/local/bin/python3');
        existsSpy.mockRestore();
      } finally {
        if (original) process.env.BAOSTOCK_PYTHON_PATH = original;
        else delete process.env.BAOSTOCK_PYTHON_PATH;
        process.cwd = originalCwd;
      }
    });

    test('resolvePythonPath 无环境变量时回退到 python3', () => {
      const original = process.env.BAOSTOCK_PYTHON_PATH;
      const originalCwd = process.cwd;
      delete process.env.BAOSTOCK_PYTHON_PATH;
      process.cwd = () => '/nonexistent/path/for/test';
      try {
        const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
        expect(resolvePythonPath()).toBe('python3');
        existsSpy.mockRestore();
      } finally {
        if (original) process.env.BAOSTOCK_PYTHON_PATH = original;
        else delete process.env.BAOSTOCK_PYTHON_PATH;
        process.cwd = originalCwd;
      }
    });
  });

  // ========== 回归保护 ==========

  describe('回归保护', () => {
    test('查询600519成功后结果标题显示「贵州茅台（600519）」', async () => {
      mockFetch.mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('/api/market/stock-info')) {
          return Promise.resolve(makeStockInfoResponse('600519', 'SH', '贵州茅台') as unknown as Response);
        }
        if (url.includes('/api/market/klines')) {
          return Promise.resolve(makeRealKLineResponse('stock-sh-600519', '600519', 'SH', '贵州茅台') as unknown as Response);
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as unknown as Response);
      });

      await act(async () => { render(<Home />); });

      const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/) as HTMLInputElement;
      await act(async () => {
        fireEvent.change(input, { target: { value: '600519' } });
      });
      const suggestion = await screen.findByText('贵州茅台', { selector: 'button span' });
      await act(async () => { fireEvent.click(suggestion); });

      await act(async () => {
        fireEvent.click(screen.getByText('查询行情'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('result-title')).toBeInTheDocument();
      }, { timeout: 5000 });

      expect(screen.getByTestId('result-title').textContent).toContain('贵州茅台（600519）');
    });
  });

  // ========== 修复四：API 市场交叉校验 ==========

  describe('修复四：API 市场交叉校验', () => {
    test('validateMarketConsistency 000001 + SH 不一致', () => {
      const error = validateMarketConsistency('000001', 'SH');
      expect(error).not.toBeNull();
      expect(error).toContain('000001');
      expect(error).toContain('SH');
      expect(error).toContain('不属于');
    });

    test('validateMarketConsistency 603236 + SZ 不一致', () => {
      const error = validateMarketConsistency('603236', 'SZ');
      expect(error).not.toBeNull();
      expect(error).toContain('603236');
      expect(error).toContain('SZ');
      expect(error).toContain('不属于');
    });

    test('validateMarketConsistency 正确组合返回 null', () => {
      expect(validateMarketConsistency('000001', 'SZ')).toBeNull();
      expect(validateMarketConsistency('603236', 'SH')).toBeNull();
      expect(validateMarketConsistency('600519', 'SH')).toBeNull();
      expect(validateMarketConsistency('300750', 'SZ')).toBeNull();
      expect(validateMarketConsistency('688981', 'SH')).toBeNull();
    });

    test('validateMarketConsistency 无法识别代码返回 null（由其他校验处理）', () => {
      expect(validateMarketConsistency('200000', 'SH')).toBeNull();
      expect(validateMarketConsistency('200000', 'SZ')).toBeNull();
    });

    test('前端不会发送市场不匹配的请求（detectMarket 自动匹配）', async () => {
      // 前端通过 detectMarket 自动识别市场，不会出现 000001+SH 的组合
      // 此测试验证 detectMarket 正确识别市场，确保前端不会发送错误组合
      const { detectMarket } = await import('@/utils/stockCode');
      expect(detectMarket('000001')).toBe('SZ'); // 000xxx → SZ
      expect(detectMarket('603236')).toBe('SH'); // 603xxx → SH
      expect(detectMarket('600519')).toBe('SH'); // 600xxx → SH
      expect(detectMarket('300750')).toBe('SZ'); // 300xxx → SZ
    });

    test('API 返回 400 时前端正确显示市场不匹配错误', async () => {
      // 模拟 API 返回 400 市场不匹配错误
      mockFetch.mockImplementation(routeFetch(
        (url) => url.includes('/api/market/klines'),
        {
          ok: false,
          status: 400,
          json: async () => ({ error: '股票代码 000001 不属于 SH 市场' }),
        },
      ));

      await act(async () => { render(<Home />); });

      const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/) as HTMLInputElement;
      await act(async () => {
        fireEvent.change(input, { target: { value: '000001' } });
      });
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });

      await act(async () => {
        fireEvent.click(screen.getByText('查询行情'));
      });

      // 应显示错误状态
      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      }, { timeout: 5000 });

      const errorText = screen.getByTestId('error-state').textContent;
      expect(errorText).toContain('000001');
      expect(errorText).toContain('SH');
    });
  });

  // ========== 修复五：界面文案一致性 ==========

  describe('修复五：界面文案一致性', () => {
    test('搜索框标签为「股票代码」（不暗示名称搜索）', async () => {
      await act(async () => { render(<Home />); });
      const label = screen.getByText('股票代码');
      expect(label).toBeInTheDocument();
      // 不应出现旧标签「股票代码或名称」
      expect(screen.queryByText('股票代码或名称')).not.toBeInTheDocument();
    });

    test('搜索框占位提示不包含「或名称」', async () => {
      await act(async () => { render(<Home />); });
      const input = screen.getByTestId('stock-search-input') as HTMLInputElement;
      expect(input.placeholder).toContain('6');
      expect(input.placeholder).toContain('代码');
      expect(input.placeholder).not.toContain('或名称');
    });

    test('Header 产品定位不包含「AI」', () => {
      render(<Header />);
      // 应显示「股票走势复盘与事件候选工具」
      expect(screen.getByText('股票走势复盘与事件候选工具')).toBeInTheDocument();
      // 不应出现「AI 股票走势复盘与事件透视工具」
      expect(screen.queryByText(/AI 股票走势复盘/)).not.toBeInTheDocument();
    });

    test('Header 不再显示「演示模式」，改为「本地体验版」', () => {
      render(<Header />);
      expect(screen.getByText('本地体验版')).toBeInTheDocument();
      expect(screen.queryByText('演示模式')).not.toBeInTheDocument();
    });
  });

  // ========== 修复六：名称晚到自动同步 ==========

  describe('修复六：名称晚到自动同步', () => {
    test('名称延迟返回后，已选股票与结果展示自动更新名称', async () => {
      // 模拟 stock-info 延迟返回：使用可控 Promise
      let resolveStockInfo!: (value: unknown) => void;
      const stockInfoPromise = new Promise((resolve) => {
        resolveStockInfo = resolve;
      });

      mockFetch.mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('/api/market/stock-info')) {
          return stockInfoPromise;
        }
        if (url.includes('/api/market/klines')) {
          // klines 返回时名称为空（模拟名称尚未返回）
          return Promise.resolve(makeRealKLineResponse('stock-sh-603236', '603236', 'SH', '', 5) as unknown as Response);
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as unknown as Response);
      });

      await act(async () => { render(<Home />); });

      const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/) as HTMLInputElement;
      // 输入代码（触发名称查询，但尚未返回）
      await act(async () => {
        fireEvent.change(input, { target: { value: '603236' } });
      });
      // 立即回车（名称查询还在进行中）
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });

      // 已选股票标签应显示「名称暂未取得」（initial 状态下 StockSearch 可见）
      expect(screen.getByText(/已选择.*603236.*名称暂未取得/)).toBeInTheDocument();

      // 点击查询日K
      await act(async () => {
        fireEvent.click(screen.getByText('查询行情'));
      });

      // K线查询应成功（不被名称查询阻塞）
      await waitFor(() => {
        expect(screen.getByTestId('result-title')).toBeInTheDocument();
      }, { timeout: 5000 });

      // 结果标题应显示「名称暂未取得」（名称尚未返回）
      expect(screen.getByTestId('result-title').textContent).toContain('603236');
      expect(screen.getByTestId('result-title').textContent).toContain('名称暂未取得');

      // 名称查询完成，返回「移远通信」
      // 在 act 中等待 fetch Promise 链和 queryStockName 后续代码完成
      await act(async () => {
        resolveStockInfo(makeStockInfoResponse('603236', 'SH', '移远通信'));
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // 结果标题应自动更新为「移远通信（603236）」
      await waitFor(() => {
        expect(screen.getByTestId('result-title').textContent).toContain('移远通信（603236）');
      });
    });

    test('名称查询失败时，日K查询仍可完成并显示名称暂未取得', async () => {
      mockFetch.mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('/api/market/stock-info')) {
          // 名称查询失败
          return Promise.resolve(makeStockInfoErrorResponse() as unknown as Response);
        }
        if (url.includes('/api/market/klines')) {
          // K线查询成功，但名称为空
          return Promise.resolve(makeRealKLineResponse('stock-sh-603236', '603236', 'SH', '', 5) as unknown as Response);
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as unknown as Response);
      });

      await act(async () => { render(<Home />); });

      const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/) as HTMLInputElement;
      await act(async () => {
        fireEvent.change(input, { target: { value: '603236' } });
      });
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });

      // 已选股票标签应显示「名称暂未取得」
      expect(screen.getByText(/已选择.*603236.*名称暂未取得/)).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByText('查询行情'));
      });

      // K线查询应成功（不被名称查询失败阻塞）
      await waitFor(() => {
        expect(screen.getByTestId('result-title')).toBeInTheDocument();
      }, { timeout: 5000 });

      // 结果标题应显示「名称暂未取得」
      expect(screen.getByTestId('result-title').textContent).toContain('603236');
      expect(screen.getByTestId('result-title').textContent).toContain('名称暂未取得');
      // 不应显示「移远通信」
      expect(screen.getByTestId('result-title').textContent).not.toContain('移远通信');
    });
  });
});
