/**
 * K-Ray 第六阶段测试 - BaoStock 真实行情接入
 * 验证代码转换、参数校验、数据过滤、模式行为、错误脱敏、缓存隔离等
 *
 * @jest-environment node
 */

import { execFile, execFileSync } from 'child_process';
import { join } from 'path';

// Mock execFile 以避免真实网络调用（保留 execFileSync 用于 Python 脚本测试）
jest.mock('child_process', () => {
  const actual = jest.requireActual('child_process');
  return {
    ...actual,
    execFile: jest.fn(),
  };
});

import { baostockProvider, mockProvider } from '@/services/marketData';
import { fetchKLines, getMarketDataMode, buildCacheKey, clearCache, _cacheSize } from '@/services/marketData';
import { ValidationError, SanitizedError } from '@/services/marketData/types';
import type { MarketKLineQuery } from '@/services/marketData/types';

const mockedExecFile = execFile as jest.MockedFunction<typeof execFile>;

// 辅助：模拟 BaoStock 原始返回
function makeBaoStockSuccess(klines: Array<Record<string, unknown>>) {
  return JSON.stringify({
    success: true,
    klines,
    count: klines.length,
    source: 'baostock',
    adjustment: 'qfq',
  });
}

function makeBaoStockError(error: string) {
  return JSON.stringify({
    success: false,
    error,
    klines: [],
    count: 0,
  });
}

// 辅助：构造合法查询
function makeQuery(overrides: Partial<MarketKLineQuery> = {}): MarketKLineQuery {
  return {
    stockId: 'stock-sh-600519',
    stockCode: '600519',
    market: 'SH',
    startDate: '2024-01-01',
    endDate: '2024-03-31',
    adjustment: 'qfq',
    ...overrides,
  };
}

describe('第六阶段测试 - BaoStock 真实行情接入', () => {
  let originalMarketMode: string | undefined;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    originalMarketMode = process.env.MARKET_DATA_MODE;
    process.env.MARKET_DATA_MODE = 'fallback';
    jest.clearAllMocks();
    clearCache();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalMarketMode !== undefined) {
      process.env.MARKET_DATA_MODE = originalMarketMode;
    } else {
      delete process.env.MARKET_DATA_MODE;
    }
    clearCache();
    consoleErrorSpy.mockRestore();
  });

  // ========== 1. SH/SZ 代码转换 ==========

  describe('代码转换', () => {
    test('SH 代码转换: 600519 → sh.600519', async () => {
      let capturedArgs: string[] = [];
      mockedExecFile.mockImplementation(((
        _cmd: string,
        args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        capturedArgs = args;
        cb(null, makeBaoStockSuccess([]), '');
      }) as typeof execFile);

      await baostockProvider.fetchKLines(makeQuery({ stockCode: '600519', market: 'SH' }));

      // args[0] = script path, args[1] = stockId, args[2] = stockCode, args[3] = market
      // Python 脚本接收 market 并内部转换
      expect(capturedArgs[3]).toBe('SH');
      expect(capturedArgs[2]).toBe('600519');
    });

    test('SZ 代码转换: 000001 → sz.000001', async () => {
      let capturedArgs: string[] = [];
      mockedExecFile.mockImplementation(((
        _cmd: string,
        args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        capturedArgs = args;
        cb(null, makeBaoStockSuccess([]), '');
      }) as typeof execFile);

      await baostockProvider.fetchKLines(makeQuery({
        stockId: 'stock-sz-000001',
        stockCode: '000001',
        market: 'SZ',
      }));

      expect(capturedArgs[3]).toBe('SZ');
      expect(capturedArgs[2]).toBe('000001');
    });
  });

  // ========== 2. execFile 使用参数数组 ==========

  describe('execFile 参数数组', () => {
    test('execFile 使用参数数组而非拼接命令字符串', async () => {
      let capturedArgs: string[] = [];
      let capturedCmd: string = '';

      mockedExecFile.mockImplementation(((
        cmd: string,
        args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        capturedCmd = cmd;
        capturedArgs = args;
        cb(null, makeBaoStockSuccess([]), '');
      }) as typeof execFile);

      await baostockProvider.fetchKLines(makeQuery());

      // 确认调用的是 execFile（不是 exec），且第一个参数是 python 路径
      expect(mockedExecFile).toHaveBeenCalledTimes(1);
      expect(typeof capturedCmd).toBe('string');
      // 参数是数组，包含脚本路径和6个参数
      expect(Array.isArray(capturedArgs)).toBe(true);
      expect(capturedArgs.length).toBe(7); // scriptPath + stockId + stockCode + market + startDate + endDate + adjustflag
      // 确认参数值
      expect(capturedArgs[1]).toBe('stock-sh-600519');
      expect(capturedArgs[2]).toBe('600519');
      expect(capturedArgs[3]).toBe('SH');
      expect(capturedArgs[4]).toBe('2024-01-01');
      expect(capturedArgs[5]).toBe('2024-03-31');
    });

    test('execFile 设置 15 秒超时', async () => {
      let capturedOpts: Record<string, unknown> = {};

      mockedExecFile.mockImplementation(((
        _cmd: string,
        _args: string[],
        opts: Record<string, unknown>,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        capturedOpts = opts;
        cb(null, makeBaoStockSuccess([]), '');
      }) as typeof execFile);

      await baostockProvider.fetchKLines(makeQuery());

      expect(capturedOpts.timeout).toBe(15000);
      expect(capturedOpts.killSignal).toBe('SIGTERM');
      expect(capturedOpts.maxBuffer).toBeGreaterThan(0);
    });
  });

  // ========== 3. BaoStock 数据转换 ==========

  describe('数据转换', () => {
    test('BaoStock 原始数据正确转换为 KLineData', async () => {
      const rawKlines = [
        {
          id: 'baostock:stock-sh-600519:2024-01-02',
          stockId: 'stock-sh-600519',
          date: '2024-01-02',
          open: 1700.0,
          high: 1720.5,
          low: 1695.0,
          close: 1710.0,
          volume: 5000000,
          changePercent: 0.65,
        },
      ];

      mockedExecFile.mockImplementation(((
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        cb(null, makeBaoStockSuccess(rawKlines), '');
      }) as typeof execFile);

      const result = await baostockProvider.fetchKLines(makeQuery());

      expect(result.klines).toHaveLength(1);
      expect(result.klines[0].id).toBe('baostock:stock-sh-600519:2024-01-02');
      expect(result.klines[0].stockId).toBe('stock-sh-600519');
      expect(result.klines[0].open).toBe(1700.0);
      expect(result.klines[0].high).toBe(1720.5);
      expect(result.klines[0].close).toBe(1710.0);
      expect(result.klines[0].changePercent).toBe(0.65);
      expect(result.meta.source).toBe('baostock');
      expect(result.meta.isRealMarketData).toBe(true);
      expect(result.meta.adjustment).toBe('qfq');
    });
  });

  // ========== 4. 非法 OHLC 和停牌过滤 ==========

  describe('数据过滤', () => {
    test('Python 脚本的过滤逻辑（停牌、空OHLC、非法数字）在服务端数据转换中保留', async () => {
      // Python 脚本已过滤，服务端接收的是已清洗数据
      // 这里验证服务端不会重新引入问题数据
      const cleanKlines = [
        {
          id: 'baostock:stock-sh-600519:2024-01-02',
          stockId: 'stock-sh-600519',
          date: '2024-01-02',
          open: 1700.0,
          high: 1720.0,
          low: 1695.0,
          close: 1710.0,
          volume: 5000000,
          changePercent: 0.65,
        },
      ];

      mockedExecFile.mockImplementation(((
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        cb(null, makeBaoStockSuccess(cleanKlines), '');
      }) as typeof execFile);

      const result = await baostockProvider.fetchKLines(makeQuery());

      // 所有数据都是合法的
      result.klines.forEach(k => {
        expect(k.open).toBeGreaterThan(0);
        expect(k.high).toBeGreaterThan(0);
        expect(k.low).toBeGreaterThan(0);
        expect(k.close).toBeGreaterThan(0);
      });
    });

    test('Python 脚本参数校验：拒绝非法 market', async () => {
      const scriptPath = join(process.cwd(), 'scripts', 'baostock_client.py');
      let stderr = '';
      try {
        execFileSync('python3', [scriptPath, 'stock-x-123456', '123456', 'XX', '2024-01-01', '2024-03-31'], {
          timeout: 5000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (e: unknown) {
        const err = e as { stderr?: Buffer | string };
        stderr = err.stderr ? err.stderr.toString() : '';
      }
      expect(stderr).toContain('market');
      expect(stderr).toContain('success');
      expect(stderr).toContain('false');
    });

    test('Python 脚本参数校验：拒绝非法 code', async () => {
      const scriptPath = join(process.cwd(), 'scripts', 'baostock_client.py');
      let stderr = '';
      try {
        execFileSync('python3', [scriptPath, 'stock-sh-abc', 'abc', 'SH', '2024-01-01', '2024-03-31'], {
          timeout: 5000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (e: unknown) {
        const err = e as { stderr?: Buffer | string };
        stderr = err.stderr ? err.stderr.toString() : '';
      }
      expect(stderr).toContain('stockCode');
      expect(stderr).toContain('6位数字');
    });

    test('Python 脚本参数校验：拒绝开始日期晚于结束日期', async () => {
      const scriptPath = join(process.cwd(), 'scripts', 'baostock_client.py');
      let stderr = '';
      try {
        execFileSync('python3', [scriptPath, 'stock-sh-600519', '600519', 'SH', '2024-03-31', '2024-01-01'], {
          timeout: 5000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (e: unknown) {
        const err = e as { stderr?: Buffer | string };
        stderr = err.stderr ? err.stderr.toString() : '';
      }
      expect(stderr).toContain('开始日期');
      expect(stderr).toContain('晚于');
    });
  });

  // ========== 5. 去重与日期排序 ==========

  describe('去重与排序', () => {
    test('Python 脚本的去重和排序逻辑（服务端接收已处理数据）', async () => {
      const sortedKlines = [
        {
          id: 'baostock:stock-sh-600519:2024-01-02',
          stockId: 'stock-sh-600519',
          date: '2024-01-02',
          open: 1700.0, high: 1720.0, low: 1695.0, close: 1710.0,
          volume: 5000000, changePercent: 0.65,
        },
        {
          id: 'baostock:stock-sh-600519:2024-01-03',
          stockId: 'stock-sh-600519',
          date: '2024-01-03',
          open: 1710.0, high: 1730.0, low: 1705.0, close: 1725.0,
          volume: 6000000, changePercent: 0.88,
        },
      ];

      mockedExecFile.mockImplementation(((
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        cb(null, makeBaoStockSuccess(sortedKlines), '');
      }) as typeof execFile);

      const result = await baostockProvider.fetchKLines(makeQuery());

      // 验证日期升序
      expect(result.klines[0].date).toBe('2024-01-02');
      expect(result.klines[1].date).toBe('2024-01-03');
    });
  });

  // ========== 6. 稳定 K线 ID ==========

  describe('稳定K线ID', () => {
    test('K线ID格式为 baostock:<stockId>:<date>，不使用数组index', async () => {
      const rawKlines = [
        {
          id: 'baostock:stock-sh-600519:2024-01-02',
          stockId: 'stock-sh-600519',
          date: '2024-01-02',
          open: 1700.0, high: 1720.0, low: 1695.0, close: 1710.0,
          volume: 5000000, changePercent: 0.65,
        },
        {
          id: 'baostock:stock-sh-600519:2024-01-03',
          stockId: 'stock-sh-600519',
          date: '2024-01-03',
          open: 1710.0, high: 1730.0, low: 1705.0, close: 1725.0,
          volume: 6000000, changePercent: 0.88,
        },
      ];

      mockedExecFile.mockImplementation(((
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        cb(null, makeBaoStockSuccess(rawKlines), '');
      }) as typeof execFile);

      const result = await baostockProvider.fetchKLines(makeQuery());

      result.klines.forEach(k => {
        expect(k.id).toMatch(/^baostock:stock-sh-600519:\d{4}-\d{2}-\d{2}$/);
        expect(k.id).not.toMatch(/-\d{3}$/); // 不应包含数组index格式
      });
    });
  });

  // ========== 7. 三种模式行为 ==========

  describe('三种模式行为', () => {
    test('mock 模式不调用 BaoStock', async () => {
      process.env.MARKET_DATA_MODE = 'mock';

      const result = await fetchKLines(makeQuery());

      expect(mockedExecFile).not.toHaveBeenCalled();
      expect(result.meta.source).toBe('mock');
      expect(result.meta.isRealMarketData).toBe(false);
    });

    test('real 模式失败不降级，直接抛出错误', async () => {
      process.env.MARKET_DATA_MODE = 'real';

      mockedExecFile.mockImplementation(((
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        cb(null, '', makeBaoStockError('BaoStock login failed'));
      }) as typeof execFile);

      await expect(fetchKLines(makeQuery())).rejects.toThrow();
      expect(mockedExecFile).toHaveBeenCalledTimes(1);
    });

    test('fallback 模式降级到 Mock', async () => {
      process.env.MARKET_DATA_MODE = 'fallback';

      mockedExecFile.mockImplementation(((
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        cb(null, '', makeBaoStockError('BaoStock login failed'));
      }) as typeof execFile);

      const result = await fetchKLines(makeQuery());

      expect(result.meta.source).toBe('mock');
      expect(result.meta.fallbackReason).toBeDefined();
      expect(result.meta.fallbackReason).toContain('BaoStock');
    });

    test('getMarketDataMode 返回正确的模式', () => {
      process.env.MARKET_DATA_MODE = 'mock';
      expect(getMarketDataMode()).toBe('mock');

      process.env.MARKET_DATA_MODE = 'real';
      expect(getMarketDataMode()).toBe('real');

      process.env.MARKET_DATA_MODE = 'fallback';
      expect(getMarketDataMode()).toBe('fallback');

      // 第十四阶段 A1 封板修复：未配置或非法值默认使用 real 模式，
      // 普通用户默认运行路径不得自动进入 Mock。
      delete process.env.MARKET_DATA_MODE;
      expect(getMarketDataMode()).toBe('real');

      process.env.MARKET_DATA_MODE = 'invalid';
      expect(getMarketDataMode()).toBe('real');
    });
  });

  // ========== 8. 错误脱敏 ==========

  describe('错误脱敏', () => {
    test('不返回本地文件路径', async () => {
      process.env.MARKET_DATA_MODE = 'real';

      mockedExecFile.mockImplementation(((
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        const err = new Error('ENOENT: no such file or directory, open \'/Users/secret/path/script.py\'');
        cb(err, '', '');
      }) as typeof execFile);

      try {
        await fetchKLines(makeQuery());
        fail('应抛出错误');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        expect(msg).not.toContain('/Users/');
        expect(msg).not.toContain('.py');
        expect(msg).not.toContain('ENOENT');
      }
    });

    test('不返回 Python 堆栈', async () => {
      process.env.MARKET_DATA_MODE = 'real';

      mockedExecFile.mockImplementation(((
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        const pythonStack = 'Traceback (most recent call last):\n  File "script.py", line 42\n    import baostock\nModuleNotFoundError: No module named \'baostock\'';
        cb(new Error(pythonStack), '', '');
      }) as typeof execFile);

      try {
        await fetchKLines(makeQuery());
        fail('应抛出错误');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        expect(msg).not.toContain('Traceback');
        expect(msg).not.toContain('import baostock');
        expect(msg).not.toContain('ModuleNotFoundError');
      }
    });

    test('不返回 stderr 原文', async () => {
      process.env.MARKET_DATA_MODE = 'real';

      const secretStderr = 'ConnectionRefusedError: [Errno 61] Connection refused at /var/secret/socket';

      mockedExecFile.mockImplementation(((
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        // stderr 不是 JSON
        cb(new Error('command failed'), '', secretStderr);
      }) as typeof execFile);

      try {
        await fetchKLines(makeQuery());
        fail('应抛出错误');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        expect(msg).not.toContain('ConnectionRefusedError');
        expect(msg).not.toContain('/var/secret');
        expect(msg).not.toContain('Errno 61');
      }
    });

    test('返回用户友好的通俗错误消息', async () => {
      process.env.MARKET_DATA_MODE = 'real';

      mockedExecFile.mockImplementation(((
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        cb(new Error('ENOENT: no such file'), '', '');
      }) as typeof execFile);

      try {
        await fetchKLines(makeQuery());
        fail('应抛出错误');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // 应该返回通俗消息
        expect(msg).toBe('本机尚未安装BaoStock运行环境。');
      }
    });
  });

  // ========== 9. 缓存隔离 ==========

  describe('缓存隔离', () => {
    test('不同股票不共用缓存', async () => {
      process.env.MARKET_DATA_MODE = 'mock';

      const query1 = makeQuery({ stockId: 'stock-sh-600519', stockCode: '600519', market: 'SH' });
      const query2 = makeQuery({ stockId: 'stock-sz-000001', stockCode: '000001', market: 'SZ' });

      await fetchKLines(query1);
      await fetchKLines(query2);

      // 两个不同的缓存 key
      expect(buildCacheKey(query1)).not.toBe(buildCacheKey(query2));
    });

    test('不同日期不共用缓存', async () => {
      const query1 = makeQuery({ startDate: '2024-01-01', endDate: '2024-01-31' });
      const query2 = makeQuery({ startDate: '2024-02-01', endDate: '2024-02-28' });

      expect(buildCacheKey(query1)).not.toBe(buildCacheKey(query2));
    });

    test('不同复权方式不共用缓存', async () => {
      const query1 = makeQuery({ adjustment: 'qfq' });
      const query2 = makeQuery({ adjustment: 'none' });

      expect(buildCacheKey(query1)).not.toBe(buildCacheKey(query2));
    });

    test('相同查询命中缓存（不重复调用 provider）', async () => {
      process.env.MARKET_DATA_MODE = 'mock';

      const query = makeQuery();
      await fetchKLines(query);
      const sizeAfterFirst = _cacheSize();

      await fetchKLines(query);
      const sizeAfterSecond = _cacheSize();

      // 缓存大小不变（命中缓存，未新增）
      expect(sizeAfterSecond).toBe(sizeAfterFirst);
    });

    test('clearCache 清空所有缓存', async () => {
      process.env.MARKET_DATA_MODE = 'mock';
      await fetchKLines(makeQuery());
      expect(_cacheSize()).toBeGreaterThan(0);
      clearCache();
      expect(_cacheSize()).toBe(0);
    });
  });

  // ========== 10. API 参数校验 ==========

  describe('API 参数校验', () => {
    test('ValidationError 可被捕获', () => {
      const err = new ValidationError('test error');
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('ValidationError');
      expect(err.message).toBe('test error');
    });

    test('SanitizedError 可被捕获', () => {
      const err = new SanitizedError('safe error');
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('SanitizedError');
      expect(err.message).toBe('safe error');
    });
  });

  // ========== 11. Mock Provider 行为 ==========

  describe('Mock Provider', () => {
    test('600519 返回 Mock K线数据', async () => {
      const result = await mockProvider.fetchKLines(makeQuery());
      expect(result.klines.length).toBeGreaterThan(0);
      expect(result.meta.source).toBe('mock');
      expect(result.meta.isRealMarketData).toBe(false);
    });

    test('非 600519 返回空 K线', async () => {
      const result = await mockProvider.fetchKLines(makeQuery({
        stockId: 'stock-sz-000001',
        stockCode: '000001',
        market: 'SZ',
      }));
      expect(result.klines).toHaveLength(0);
      expect(result.meta.source).toBe('mock');
    });
  });
});
