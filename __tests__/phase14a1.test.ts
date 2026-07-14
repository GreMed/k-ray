/**
 * 第十四阶段 A1：沪深真实行情核心链路修复 — 单元测试
 *
 * 覆盖：
 * 1. 股票代码识别（6→SH、0/3→SZ 候选规则，301xxx 通过）
 * 2. 不支持代码拒绝（B 股、非 6/0/3 开头）
 * 3. 文案校验（"沪深上市A股"）
 *
 * @jest-environment node
 */

import {
  detectMarket,
  isValidAShareCode,
  validateSupportedAShareCode,
  validateMarketConsistency,
  buildStockFromCode,
} from '@/utils/stockCode';
import { getMarketDataMode } from '@/services/marketData';

describe('第十四阶段 A1：股票代码识别', () => {
  // ========== 1. detectMarket 候选规则 ==========

  describe('detectMarket：6→SH、0/3→SZ 候选规则', () => {
    test('301165 → SZ（创业板，之前被遗漏）', () => {
      expect(detectMarket('301165')).toBe('SZ');
    });

    test('301xxx 前缀全部识别为 SZ', () => {
      expect(detectMarket('301000')).toBe('SZ');
      expect(detectMarket('301999')).toBe('SZ');
    });

    test('600519 → SH', () => {
      expect(detectMarket('600519')).toBe('SH');
    });

    test('688981 → SH（科创板）', () => {
      expect(detectMarket('688981')).toBe('SH');
    });

    test('000001 → SZ', () => {
      expect(detectMarket('000001')).toBe('SZ');
    });

    test('300750 → SZ', () => {
      expect(detectMarket('300750')).toBe('SZ');
    });

    test('605xxx → SH', () => {
      expect(detectMarket('605500')).toBe('SH');
    });

    test('6 开头全部识别为 SH', () => {
      expect(detectMarket('600000')).toBe('SH');
      expect(detectMarket('601318')).toBe('SH');
      expect(detectMarket('603236')).toBe('SH');
      expect(detectMarket('688001')).toBe('SH');
    });

    test('0 开头全部识别为 SZ', () => {
      expect(detectMarket('000002')).toBe('SZ');
      expect(detectMarket('002415')).toBe('SZ');
      expect(detectMarket('003816')).toBe('SZ');
    });

    test('3 开头全部识别为 SZ', () => {
      expect(detectMarket('300001')).toBe('SZ');
      expect(detectMarket('301165')).toBe('SZ');
    });
  });

  // ========== 2. 不支持代码拒绝 ==========

  describe('不支持代码拒绝', () => {
    test('200000 → null（非 6/0/3 开头）', () => {
      expect(detectMarket('200000')).toBeNull();
    });

    test('900901 → null（B 股）', () => {
      expect(detectMarket('900901')).toBeNull();
    });

    test('123456 → null', () => {
      expect(detectMarket('123456')).toBeNull();
    });

    test('400001 → null（三板）', () => {
      expect(detectMarket('400001')).toBeNull();
    });

    test('非 6 位数字 → null', () => {
      expect(detectMarket('12345')).toBeNull();
      expect(detectMarket('1234567')).toBeNull();
      expect(detectMarket('abcdef')).toBeNull();
      expect(detectMarket('')).toBeNull();
    });
  });

  // ========== 3. validateSupportedAShareCode ==========

  describe('validateSupportedAShareCode', () => {
    test('301165 返回 null（支持）', () => {
      expect(validateSupportedAShareCode('301165')).toBeNull();
    });

    test('600519 返回 null（支持）', () => {
      expect(validateSupportedAShareCode('600519')).toBeNull();
    });

    test('200000 返回错误信息包含"沪深上市A股"', () => {
      const error = validateSupportedAShareCode('200000');
      expect(error).not.toBeNull();
      expect(error).toContain('沪深上市A股');
    });

    test('900901 返回错误信息', () => {
      const error = validateSupportedAShareCode('900901');
      expect(error).not.toBeNull();
      expect(error).toContain('沪深上市A股');
    });
  });

  // ========== 4. validateMarketConsistency ==========

  describe('validateMarketConsistency', () => {
    test('301165 + SZ → null（一致）', () => {
      expect(validateMarketConsistency('301165', 'SZ')).toBeNull();
    });

    test('301165 + SH → 错误（不一致）', () => {
      const error = validateMarketConsistency('301165', 'SH');
      expect(error).not.toBeNull();
      expect(error).toContain('301165');
      expect(error).toContain('SH');
    });

    test('600519 + SZ → 错误（不一致）', () => {
      const error = validateMarketConsistency('600519', 'SZ');
      expect(error).not.toBeNull();
      expect(error).toContain('600519');
      expect(error).toContain('SZ');
    });
  });

  // ========== 5. isValidAShareCode ==========

  describe('isValidAShareCode', () => {
    test('301165 → true', () => {
      expect(isValidAShareCode('301165')).toBe(true);
    });

    test('200000 → false', () => {
      expect(isValidAShareCode('200000')).toBe(false);
    });
  });

  // ========== 6. buildStockFromCode ==========

  describe('buildStockFromCode', () => {
    test('301165 → Stock 对象 with market SZ', () => {
      const stock = buildStockFromCode('301165');
      expect(stock).not.toBeNull();
      expect(stock!.code).toBe('301165');
      expect(stock!.market).toBe('SZ');
      expect(stock!.name).toBe('');
    });

    test('200000 → null', () => {
      expect(buildStockFromCode('200000')).toBeNull();
    });
  });
});

// ========== 第十四阶段 A1 封板修复：getMarketDataMode 默认 real 模式 ==========

describe('第十四阶段 A1 封板：getMarketDataMode 默认 real', () => {
  const originalMode = process.env.MARKET_DATA_MODE;

  afterEach(() => {
    if (originalMode !== undefined) {
      process.env.MARKET_DATA_MODE = originalMode;
    } else {
      delete process.env.MARKET_DATA_MODE;
    }
  });

  test('未配置 MARKET_DATA_MODE 时默认 real', () => {
    delete process.env.MARKET_DATA_MODE;
    expect(getMarketDataMode()).toBe('real');
  });

  test('非法值时回到 real', () => {
    process.env.MARKET_DATA_MODE = 'invalid_value';
    expect(getMarketDataMode()).toBe('real');
  });

  test('空字符串时回到 real', () => {
    process.env.MARKET_DATA_MODE = '';
    expect(getMarketDataMode()).toBe('real');
  });

  test('显式配置 mock 时仍为 mock（保留开发测试能力）', () => {
    process.env.MARKET_DATA_MODE = 'mock';
    expect(getMarketDataMode()).toBe('mock');
  });

  test('显式配置 real 时为 real', () => {
    process.env.MARKET_DATA_MODE = 'real';
    expect(getMarketDataMode()).toBe('real');
  });

  test('显式配置 fallback 时仍为 fallback（保留开发测试能力）', () => {
    process.env.MARKET_DATA_MODE = 'fallback';
    expect(getMarketDataMode()).toBe('fallback');
  });
});
