// 第十六阶段里程碑三：静态真实案例库注册表
//
// 统一管理所有静态真实历史复盘案例。
// 提供案例查找、列表展示和默认案例功能。

import { StaticHistoricalCase } from '@/types';
import { staticCase_300750 } from './staticCase_300750';
import { staticCase_600519 } from './staticCase_600519';
import { staticCase_603986 } from './staticCase_603986';
import { staticCase_603236 } from './staticCase_603236';
import { staticCase_002594 } from './staticCase_002594';

// 案例注册表：按股票代码索引
export const CASE_REGISTRY: Record<string, StaticHistoricalCase> = {
  '300750': staticCase_300750,
  '600519': staticCase_600519,
  '603986': staticCase_603986,
  '603236': staticCase_603236,
  '002594': staticCase_002594,
};

// 案例列表（用于展示）
export const CASE_LIST: Array<{
  stockCode: string;
  stockName: string;
  market: string;
  requestStartDate: string;
  requestEndDate: string;
  klineCount: number;
  nodeCount: number;
  sourceCount: number;
  snapshotGeneratedAt: string;
  description: string;
}> = Object.values(CASE_REGISTRY).map(c => ({
  stockCode: c.stockCode,
  stockName: c.stockName,
  market: c.market,
  requestStartDate: c.requestStartDate,
  requestEndDate: c.requestEndDate,
  klineCount: c.klines.length,
  nodeCount: c.nodes.length,
  sourceCount: c.sourceList.length,
  snapshotGeneratedAt: c.snapshotGeneratedAt,
  description: c.description,
}));

// 默认案例代码
export const DEFAULT_CASE_CODE = '300750';

// 根据股票代码获取案例，不存在则返回 null
export function getCaseByStockCode(stockCode: string): StaticHistoricalCase | null {
  const code = stockCode.trim();
  if (!code || !CASE_REGISTRY[code]) {
    return null;
  }
  return CASE_REGISTRY[code];
}

// 获取默认案例
export function getDefaultCase(): StaticHistoricalCase {
  return CASE_REGISTRY[DEFAULT_CASE_CODE];
}

// 获取所有合法的案例代码
export function getValidCaseCodes(): string[] {
  return Object.keys(CASE_REGISTRY);
}
