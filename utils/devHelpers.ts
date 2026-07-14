// 开发环境演示用工具函数

import { Stock, ReplayResult, PageState } from '@/types';
import { getMockReplayResult } from '@/data/mockData';

// 演示用默认股票
export const DEMO_STOCK: Stock = {
  id: 'stock-sh-600519',
  code: '600519',
  name: '贵州茅台',
  market: 'SH',
  sector: '白酒'
};

// 演示用默认日期范围
export const DEMO_START_DATE = '2024-01-01';
export const DEMO_END_DATE = '2024-01-31';

// 模拟加载并获取复盘结果的共用函数
export async function simulateReplay(
  stockId: string,
  startDate: string,
  endDate: string,
  delayMs: number = 1500
): Promise<{ state: PageState; result: ReplayResult | null }> {
  // 模拟API调用延迟
  await new Promise(resolve => setTimeout(resolve, delayMs));

  const result = getMockReplayResult(stockId, startDate, endDate);

  if (result && result.klines.length > 0) {
    return { state: 'success', result };
  }
  return { state: 'empty', result: null };
}

// 判断当前是否为开发环境（需显式开启）
// - 生产环境（NODE_ENV === 'production'）：始终返回 false，即使在测试中也模拟生产行为
// - Jest 测试环境（通过 JEST_WORKER_ID 判断）：始终返回 true，保证既有测试覆盖 DevToolsPanel
// - 开发环境（NODE_ENV === 'development'）：仅当 URL 包含 ?dev=1 时返回 true
// - 其他环境：始终返回 false
export function isDevEnvironment(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.JEST_WORKER_ID) return true;
  if (process.env.NODE_ENV !== 'development') return false;
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('dev') === '1';
}
