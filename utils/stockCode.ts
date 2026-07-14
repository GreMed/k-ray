import type { Stock } from '@/types';

/**
 * 根据股票代码自动识别市场（候选）。
 * 初步识别规则（不依赖三级前缀白名单，避免遗漏如 301xxx）：
 * - 6 开头 → SH 候选
 * - 0 或 3 开头 → SZ 候选
 * - 其他返回 null
 *
 * 注意：市场识别仅为候选，最终是否为有效上市 A 股
 * 必须通过真实股票基础信息查询（BaoStock query_stock_basic）确认。
 */
export function detectMarket(stockCode: string): 'SH' | 'SZ' | null {
  if (!/^\d{6}$/.test(stockCode)) return null;
  const first = stockCode.charAt(0);
  if (first === '6') return 'SH';
  if (first === '0' || first === '3') return 'SZ';
  return null;
}

/**
 * 校验股票代码是否为可识别的沪深 A 股代码格式。
 * 6 开头识别为 SH，0 或 3 开头识别为 SZ。
 */
export function isValidAShareCode(stockCode: string): boolean {
  return detectMarket(stockCode) !== null;
}

/**
 * 校验股票代码是否为当前支持的沪深 A 股代码。
 * 规则：6 开头 → SH，0 或 3 开头 → SZ。
 * 支持返回 null，不支持返回通俗错误信息。
 */
export function validateSupportedAShareCode(stockCode: string): string | null {
  if (!isValidAShareCode(stockCode)) {
    return '暂不支持该股票代码，仅支持沪深上市A股';
  }
  return null;
}

/**
 * 校验股票代码与市场是否一致。
 * 一致返回 null，不一致返回通俗错误信息。
 * 代码本身无法识别市场时返回 null（由其他校验处理）。
 */
export function validateMarketConsistency(stockCode: string, market: 'SH' | 'SZ'): string | null {
  const detected = detectMarket(stockCode);
  if (detected === null) return null;
  if (detected !== market) {
    return `股票代码 ${stockCode} 不属于 ${market} 市场`;
  }
  return null;
}

/**
 * 根据股票代码构建 Stock 对象。
 * 如果代码非法或市场无法识别，返回 null。
 * name 初始为空字符串，真实名称由前端调用 /api/market/stock-info 获取后填充。
 */
export function buildStockFromCode(code: string): Stock | null {
  const market = detectMarket(code);
  if (!market) return null;
  return {
    id: `stock-${market.toLowerCase()}-${code}`,
    code,
    name: '',
    market,
  };
}

/**
 * 格式化股票展示名称：有名称时显示「名称（代码）」，无名称时显示「代码（名称暂未取得）」。
 */
export function formatStockDisplayName(stock: Stock): string {
  if (stock.name && stock.name.trim()) {
    return `${stock.name}（${stock.code}）`;
  }
  return `${stock.code}（名称暂未取得）`;
}

/**
 * 格式化股票标签文本：有名称时显示「代码 / 名称」，无名称时显示「代码 / 名称暂未取得」。
 */
export function formatStockLabel(stock: Stock): string {
  if (stock.name && stock.name.trim()) {
    return `${stock.code} / ${stock.name}`;
  }
  return `${stock.code} / 名称暂未取得`;
}
