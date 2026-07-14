import { mockKLines600519 } from '@/data/mockData';
import type { MarketDataProvider, MarketKLineResult, MarketKLineQuery } from './types';

function filterKLinesByDate(
  klines: import('@/types').KLineData[], start: string, end: string,
) {
  return klines.filter(k => k.date >= start && k.date <= end);
}

export const mockProvider: MarketDataProvider = {
  id: 'mock',
  label: 'Mock演示数据',

  async fetchKLines(query: MarketKLineQuery): Promise<MarketKLineResult> {
    // Mock 数据仅覆盖 600519
    if (query.stockId !== 'stock-sh-600519') {
      return {
        klines: [],
        meta: {
          source: 'mock',
          sourceLabel: 'Mock演示数据',
          adjustment: 'none',
          isRealMarketData: false,
          fetchedAt: new Date().toISOString(),
        },
      };
    }

    const klines = filterKLinesByDate(mockKLines600519, query.startDate, query.endDate);

    return {
      klines,
      meta: {
        source: 'mock',
        sourceLabel: 'Mock演示数据',
        adjustment: 'none',
        isRealMarketData: false,
        fetchedAt: new Date().toISOString(),
      },
    };
  },
};
