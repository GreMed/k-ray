/**
 * API 路由校验收口测试
 *
 * 直接调用 /api/market/stock-info 和 /api/market/klines 两个路由的 GET 函数，
 * 验证参数校验阶段对「不支持前缀」与「代码市场不匹配」均返回 HTTP 400，
 * 且不会继续调用服务层（不真实调用 BaoStock）。
 *
 * @jest-environment node
 */

import { GET as stockInfoGET } from '@/app/api/market/stock-info/route';
import { GET as klinesGET } from '@/app/api/market/klines/route';
import { SanitizedError } from '@/services/marketData/types';
import type { MarketKLineResult } from '@/services/marketData/types';
import type { StockInfoResult } from '@/services/marketData/stockInfo';

// mock 服务层（不真实调用 BaoStock）
jest.mock('@/services/marketData/stockInfo', () => ({
  fetchStockInfo: jest.fn(),
}));
jest.mock('@/services/marketData', () => ({
  fetchKLines: jest.fn(),
}));

import { fetchStockInfo } from '@/services/marketData/stockInfo';
import { fetchKLines } from '@/services/marketData';

const mockedFetchStockInfo = fetchStockInfo as jest.MockedFunction<typeof fetchStockInfo>;
const mockedFetchKLines = fetchKLines as jest.MockedFunction<typeof fetchKLines>;

function makeRequest(path: string): Request {
  return new Request(`http://localhost${path}`);
}

const VALID_START = '2024-01-02';
const VALID_END = '2024-03-29';

describe('API 路由校验收口', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========== 不支持的前缀返回 400 ==========

  describe('不支持的前缀返回 400', () => {
    test('stock-info: 200000 + SH 返回 400 且不调用服务层', async () => {
      const req = makeRequest('/api/market/stock-info?stockCode=200000&market=SH');
      const res = await stockInfoGET(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('暂不支持');
      expect(body.error).toContain('沪深上市A股');
      expect(mockedFetchStockInfo).not.toHaveBeenCalled();
    });

    test('stock-info: 400000 + SZ 返回 400', async () => {
      const req = makeRequest('/api/market/stock-info?stockCode=400000&market=SZ');
      const res = await stockInfoGET(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('暂不支持');
      expect(mockedFetchStockInfo).not.toHaveBeenCalled();
    });

    test('klines: 200000 + SH 返回 400 且不调用服务层', async () => {
      const req = makeRequest(
        `/api/market/klines?stockCode=200000&market=SH&startDate=${VALID_START}&endDate=${VALID_END}`,
      );
      const res = await klinesGET(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('暂不支持');
      expect(mockedFetchKLines).not.toHaveBeenCalled();
      expect(mockedFetchStockInfo).not.toHaveBeenCalled();
    });

    test('klines: 123456 + SZ 返回 400', async () => {
      const req = makeRequest(
        `/api/market/klines?stockCode=123456&market=SZ&startDate=${VALID_START}&endDate=${VALID_END}`,
      );
      const res = await klinesGET(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('暂不支持');
      expect(mockedFetchKLines).not.toHaveBeenCalled();
    });
  });

  // ========== 代码与市场不匹配返回 400 ==========

  describe('代码与市场不匹配返回 400', () => {
    test('stock-info: 000001 + SH 返回 400', async () => {
      const req = makeRequest('/api/market/stock-info?stockCode=000001&market=SH');
      const res = await stockInfoGET(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('000001');
      expect(body.error).toContain('SH');
      expect(body.error).toContain('不属于');
      expect(mockedFetchStockInfo).not.toHaveBeenCalled();
    });

    test('klines: 603236 + SZ 返回 400', async () => {
      const req = makeRequest(
        `/api/market/klines?stockCode=603236&market=SZ&startDate=${VALID_START}&endDate=${VALID_END}`,
      );
      const res = await klinesGET(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('603236');
      expect(body.error).toContain('SZ');
      expect(body.error).toContain('不属于');
      expect(mockedFetchKLines).not.toHaveBeenCalled();
      expect(mockedFetchStockInfo).not.toHaveBeenCalled();
    });
  });

  // ========== 正确组合通过参数校验 ==========

  describe('正确组合通过参数校验', () => {
    test('stock-info: 000001 + SZ 通过校验并调用服务层', async () => {
      const info: StockInfoResult = {
        stockCode: '000001',
        market: 'SZ',
        name: '平安银行',
        found: true,
        ipoDate: '1991-04-03',
        securityType: 'stock',
        isListed: true,
      };
      mockedFetchStockInfo.mockResolvedValue(info);

      const req = makeRequest('/api/market/stock-info?stockCode=000001&market=SZ');
      const res = await stockInfoGET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe('平安银行');
      expect(body.found).toBe(true);
      expect(mockedFetchStockInfo).toHaveBeenCalledWith('000001', 'SZ');
    });

    test('klines: 603236 + SH 通过校验并调用服务层', async () => {
      const info: StockInfoResult = {
        stockCode: '603236',
        market: 'SH',
        name: '移远通信',
        found: true,
        ipoDate: '2019-07-16',
        securityType: 'stock',
        isListed: true,
      };
      mockedFetchStockInfo.mockResolvedValue(info);

      const klineResult: MarketKLineResult = {
        klines: [],
        meta: {
          source: 'baostock',
          sourceLabel: 'BaoStock真实行情(前复权日线)',
          adjustment: 'qfq',
          isRealMarketData: true,
          fetchedAt: '2024-07-01T00:00:00.000Z',
        },
      };
      mockedFetchKLines.mockResolvedValue(klineResult);

      const req = makeRequest(
        `/api/market/klines?stockCode=603236&market=SH&startDate=${VALID_START}&endDate=${VALID_END}`,
      );
      const res = await klinesGET(req);
      expect(res.status).toBe(200);
      expect(mockedFetchKLines).toHaveBeenCalledTimes(1);
      // buildStock 会调用 fetchStockInfo 获取名称
      expect(mockedFetchStockInfo).toHaveBeenCalledWith('603236', 'SH');
    });
  });

  // ========== 第十四阶段 A1：301xxx 创业板代码通过校验 ==========

  describe('第十四阶段 A1：301xxx 创业板代码通过校验', () => {
    test('stock-info: 301165 + SZ 通过校验并调用服务层', async () => {
      const info: StockInfoResult = {
        stockCode: '301165',
        market: 'SZ',
        name: '锐捷网络',
        found: true,
        ipoDate: '2022-11-21',
        securityType: 'stock',
        isListed: true,
      };
      mockedFetchStockInfo.mockResolvedValue(info);

      const req = makeRequest('/api/market/stock-info?stockCode=301165&market=SZ');
      const res = await stockInfoGET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe('锐捷网络');
      expect(mockedFetchStockInfo).toHaveBeenCalledWith('301165', 'SZ');
    });

    test('klines: 301165 + SZ 通过校验并调用服务层', async () => {
      const info: StockInfoResult = {
        stockCode: '301165',
        market: 'SZ',
        name: '锐捷网络',
        found: true,
        ipoDate: '2022-11-21',
        securityType: 'stock',
        isListed: true,
      };
      mockedFetchStockInfo.mockResolvedValue(info);

      const klineResult: MarketKLineResult = {
        klines: [],
        meta: {
          source: 'baostock',
          sourceLabel: 'BaoStock真实行情(前复权日线)',
          adjustment: 'qfq',
          isRealMarketData: true,
          fetchedAt: '2024-07-01T00:00:00.000Z',
        },
      };
      mockedFetchKLines.mockResolvedValue(klineResult);

      const req = makeRequest(
        `/api/market/klines?stockCode=301165&market=SZ&startDate=${VALID_START}&endDate=${VALID_END}`,
      );
      const res = await klinesGET(req);
      expect(res.status).toBe(200);
      expect(mockedFetchKLines).toHaveBeenCalledTimes(1);
    });
  });

  // ========== 第十四阶段 A1：非股票证券类型被拒绝 ==========
  // 注意：测试代码必须通过前缀检查（6→SH, 0/3→SZ）和市场一致性检查，
  // 才能到达 fetchStockInfo 的证券类型校验阶段。
  // 因此使用合法格式的代码，但 mock fetchStockInfo 返回非股票类型。

  describe('第十四阶段 A1：非股票证券类型被拒绝', () => {
    test('stock-info: 指数（type=2）返回 400', async () => {
      const info: StockInfoResult = {
        stockCode: '600519',
        market: 'SH',
        name: '沪深300指数',
        found: true,
        ipoDate: '2005-04-08',
        securityType: 'index',
        isListed: true,
      };
      mockedFetchStockInfo.mockResolvedValue(info);

      const req = makeRequest('/api/market/stock-info?stockCode=600519&market=SH');
      const res = await stockInfoGET(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('指数');
      expect(body.error).toContain('仅支持沪深上市A股');
    });

    test('stock-info: 基金（type=5）返回 400', async () => {
      const info: StockInfoResult = {
        stockCode: '000001',
        market: 'SZ',
        name: '易方达保证金货币A',
        found: true,
        ipoDate: '2014-10-20',
        securityType: 'fund',
        isListed: true,
      };
      mockedFetchStockInfo.mockResolvedValue(info);

      const req = makeRequest('/api/market/stock-info?stockCode=000001&market=SZ');
      const res = await stockInfoGET(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('基金');
      expect(body.error).toContain('仅支持沪深上市A股');
    });

    test('stock-info: 不存在代码（found=false）返回 400', async () => {
      const info: StockInfoResult = {
        stockCode: '600519',
        market: 'SH',
        name: '',
        found: false,
        securityType: 'unknown',
        isListed: false,
      };
      mockedFetchStockInfo.mockResolvedValue(info);

      const req = makeRequest('/api/market/stock-info?stockCode=600519&market=SH');
      const res = await stockInfoGET(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('不存在');
      expect(body.error).toContain('沪深上市A股');
    });

    test('klines: 指数返回 400 且不调用 fetchKLines', async () => {
      const info: StockInfoResult = {
        stockCode: '600519',
        market: 'SH',
        name: '沪深300指数',
        found: true,
        ipoDate: '2005-04-08',
        securityType: 'index',
        isListed: true,
      };
      mockedFetchStockInfo.mockResolvedValue(info);

      const req = makeRequest(
        `/api/market/klines?stockCode=600519&market=SH&startDate=${VALID_START}&endDate=${VALID_END}`,
      );
      const res = await klinesGET(req);
      expect(res.status).toBe(400);
      expect(mockedFetchKLines).not.toHaveBeenCalled();
    });

    test('klines: 不存在代码返回 400 且不调用 fetchKLines', async () => {
      const info: StockInfoResult = {
        stockCode: '600519',
        market: 'SH',
        name: '',
        found: false,
        securityType: 'unknown',
        isListed: false,
      };
      mockedFetchStockInfo.mockResolvedValue(info);

      const req = makeRequest(
        `/api/market/klines?stockCode=600519&market=SH&startDate=${VALID_START}&endDate=${VALID_END}`,
      );
      const res = await klinesGET(req);
      expect(res.status).toBe(400);
      expect(mockedFetchKLines).not.toHaveBeenCalled();
    });
  });

  // ========== 第十四阶段 A1 封板修复：isListed=false 拒绝 + 基础信息查询异常失败关闭 ==========

  describe('第十四阶段 A1 封板：isListed=false 时两个 API 均拒绝', () => {
    test('stock-info: isListed=false 返回 400 且提示非上市状态', async () => {
      const info: StockInfoResult = {
        stockCode: '600519',
        market: 'SH',
        name: '某已退市股票',
        found: true,
        ipoDate: '2010-01-01',
        securityType: 'stock',
        isListed: false,
      };
      mockedFetchStockInfo.mockResolvedValue(info);

      const req = makeRequest('/api/market/stock-info?stockCode=600519&market=SH');
      const res = await stockInfoGET(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('不是上市交易状态');
      expect(body.error).toContain('暂不支持查询');
    });

    test('klines: isListed=false 返回 400 且不调用 fetchKLines', async () => {
      const info: StockInfoResult = {
        stockCode: '600519',
        market: 'SH',
        name: '某已退市股票',
        found: true,
        ipoDate: '2010-01-01',
        securityType: 'stock',
        isListed: false,
      };
      mockedFetchStockInfo.mockResolvedValue(info);

      const req = makeRequest(
        `/api/market/klines?stockCode=600519&market=SH&startDate=${VALID_START}&endDate=${VALID_END}`,
      );
      const res = await klinesGET(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('不是上市交易状态');
      expect(mockedFetchKLines).not.toHaveBeenCalled();
    });
  });

  describe('第十四阶段 A1 封板：基础信息查询 reject 时失败关闭', () => {
    test('klines: fetchStockInfo reject 时返回 503 且 fetchKLines 调用次数为 0', async () => {
      // fetchStockInfo 抛出异常（模拟 BaoStock 服务不可用）
      mockedFetchStockInfo.mockRejectedValue(new Error('BaoStock服务暂时不可用'));

      const req = makeRequest(
        `/api/market/klines?stockCode=600519&market=SH&startDate=${VALID_START}&endDate=${VALID_END}`,
      );
      const res = await klinesGET(req);
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error).toContain('股票基础信息查询暂时不可用');
      // 关键断言：K线 provider 调用次数必须为 0
      expect(mockedFetchKLines).not.toHaveBeenCalled();
    });

    test('stock-info: fetchStockInfo reject（SanitizedError）时返回 503 且保留脱敏文案', async () => {
      // fetchStockInfo 抛出 SanitizedError（真实场景中 BaoStock 不可用时抛此类型）
      mockedFetchStockInfo.mockRejectedValue(new SanitizedError('BaoStock服务暂时不可用'));

      const req = makeRequest('/api/market/stock-info?stockCode=600519&market=SH');
      const res = await stockInfoGET(req);
      expect(res.status).toBe(503);
      const body = await res.json();
      // SanitizedError 的 message 是经过脱敏的通俗文案，可以返回给用户
      expect(body.error).toBe('BaoStock服务暂时不可用');
    });

    test('stock-info: fetchStockInfo reject（普通 Error）时也返回 503 且不暴露内部原文', async () => {
      // fetchStockInfo 抛出普通 Error，包含内部异常原文
      const internalMsg = 'Connection refused to baostock.python.internal.host:5005';
      mockedFetchStockInfo.mockRejectedValue(new Error(internalMsg));

      const req = makeRequest('/api/market/stock-info?stockCode=600519&market=SH');
      const res = await stockInfoGET(req);
      // 断言6: 普通 Error 返回 503（不是 500）
      expect(res.status).toBe(503);
      const body = await res.json();
      // 断言7: 内部原文不出现在响应中
      expect(body.error).not.toContain(internalMsg);
      expect(body.error).not.toContain('Connection refused');
      expect(body.error).not.toContain('baostock.python');
      // 统一返回脱敏文案
      expect(body.error).toBe('股票基础信息查询暂时不可用，请稍后重试。');
    });

    test('stock-info: fetchStockInfo reject（未知异常）时也返回 503 且统一脱敏文案', async () => {
      // fetchStockInfo 抛出非 Error 类型异常
      mockedFetchStockInfo.mockRejectedValue('some unknown error string');

      const req = makeRequest('/api/market/stock-info?stockCode=600519&market=SH');
      const res = await stockInfoGET(req);
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error).toBe('股票基础信息查询暂时不可用，请稍后重试。');
    });
  });
});
