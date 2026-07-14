import type { KLineData, MarketDataMeta } from '@/types';

export type MarketDataSource = 'baostock' | 'mock';

export type AdjustmentType = 'qfq' | 'none';

export type MarketDataMode = 'mock' | 'real' | 'fallback';

export interface MarketKLineResult {
  klines: KLineData[];
  meta: MarketDataMeta;
}

export interface MarketKLineQuery {
  stockId: string;
  stockCode: string;
  market: 'SH' | 'SZ';
  startDate: string;
  endDate: string;
  adjustment?: AdjustmentType;
}

export interface MarketDataProvider {
  id: MarketDataSource;
  label: string;
  fetchKLines(query: MarketKLineQuery): Promise<MarketKLineResult>;
}

// 校验错误（返回给客户端400）
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// 脱敏后的用户友好错误
export class SanitizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SanitizedError';
  }
}
