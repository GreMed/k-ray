/**
 * K-Ray 第八阶段测试 - 全A股日K查询 MVP
 * 验证股票代码识别、市场自动判断、错误处理、数据来源信息等
 *
 * @jest-environment jsdom
 */

import { detectMarket, isValidAShareCode, buildStockFromCode } from '@/utils/stockCode';

describe('第八阶段测试 - 全A股日K查询', () => {
  describe('股票代码自动识别市场', () => {
    test('600xxx → SH', () => {
      expect(detectMarket('600519')).toBe('SH');
      expect(detectMarket('600000')).toBe('SH');
    });

    test('601xxx → SH', () => {
      expect(detectMarket('601318')).toBe('SH');
    });

    test('603xxx → SH', () => {
      expect(detectMarket('603259')).toBe('SH');
    });

    test('605xxx → SH', () => {
      expect(detectMarket('605333')).toBe('SH');
    });

    test('688xxx → SH', () => {
      expect(detectMarket('688981')).toBe('SH');
    });

    test('000xxx → SZ', () => {
      expect(detectMarket('000001')).toBe('SZ');
    });

    test('001xxx → SZ', () => {
      expect(detectMarket('001872')).toBe('SZ');
    });

    test('002xxx → SZ', () => {
      expect(detectMarket('002415')).toBe('SZ');
    });

    test('003xxx → SZ', () => {
      expect(detectMarket('003816')).toBe('SZ');
    });

    test('300xxx → SZ', () => {
      expect(detectMarket('300750')).toBe('SZ');
    });

    test('非6位数字 → null', () => {
      expect(detectMarket('60051')).toBeNull();
      expect(detectMarket('6005199')).toBeNull();
      expect(detectMarket('abc123')).toBeNull();
      expect(detectMarket('')).toBeNull();
    });

    test('无法识别的市场前缀 → null', () => {
      expect(detectMarket('200000')).toBeNull(); // B股
      expect(detectMarket('400000')).toBeNull(); // 三板
      expect(detectMarket('500000')).toBeNull();
      expect(detectMarket('700000')).toBeNull();
      expect(detectMarket('900000')).toBeNull(); // B股
    });
  });

  describe('isValidAShareCode', () => {
    test('合法A股代码返回 true', () => {
      expect(isValidAShareCode('600519')).toBe(true);
      expect(isValidAShareCode('000001')).toBe(true);
      expect(isValidAShareCode('300750')).toBe(true);
      expect(isValidAShareCode('688981')).toBe(true);
    });

    test('非法代码返回 false', () => {
      expect(isValidAShareCode('200000')).toBe(false);
      expect(isValidAShareCode('123456')).toBe(false);
      expect(isValidAShareCode('abc')).toBe(false);
      expect(isValidAShareCode('')).toBe(false);
    });
  });

  describe('buildStockFromCode', () => {
    test('构建已知股票对象（名称初始为空，由 API 填充）', () => {
      const stock = buildStockFromCode('600519');
      expect(stock).toEqual({
        id: 'stock-sh-600519',
        code: '600519',
        name: '', // 名称初始为空，由 /api/market/stock-info 填充
        market: 'SH',
      });
    });

    test('构建未知股票对象（名称为空，展示层显示「名称暂未取得」）', () => {
      const stock = buildStockFromCode('601318');
      expect(stock).toEqual({
        id: 'stock-sh-601318',
        code: '601318',
        name: '',
        market: 'SH',
      });
    });

    test('非法代码返回 null', () => {
      expect(buildStockFromCode('200000')).toBeNull();
      expect(buildStockFromCode('abc')).toBeNull();
      expect(buildStockFromCode('')).toBeNull();
    });

    test('四只验收股票均可构建', () => {
      expect(buildStockFromCode('600519')?.market).toBe('SH');
      expect(buildStockFromCode('000001')?.market).toBe('SZ');
      expect(buildStockFromCode('300750')?.market).toBe('SZ');
      expect(buildStockFromCode('688981')?.market).toBe('SH');
    });
  });
});
