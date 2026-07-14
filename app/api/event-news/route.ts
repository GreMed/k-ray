// K-Ray 第十阶段 A：新闻候选数据 API
// 独立于公告和行情 API

import { NextResponse } from 'next/server';
import { fetchEventNews } from '@/services/eventNews';
import { ValidationError, SanitizedError } from '@/services/eventNews/types';
import { detectMarket } from '@/utils/stockCode';

const CODE_REGEX = /^\d{6}$/;

function validateParams(stockCode: string, market: string): void {
  if (!stockCode || !CODE_REGEX.test(stockCode)) {
    throw new ValidationError('stockCode 必须为6位数字');
  }
  if (market !== 'SH' && market !== 'SZ') {
    throw new ValidationError('market 只能为 SH 或 SZ');
  }
  // 交叉校验：代码与市场是否匹配
  const detectedMarket = detectMarket(stockCode);
  if (detectedMarket !== market) {
    throw new ValidationError(`股票代码 ${stockCode} 不属于 ${market} 市场`);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stockCode = searchParams.get('stockCode');
  const market = searchParams.get('market');
  // dev-only 绕过缓存参数：仅 dev/验证环境使用，生产环境不开放
  const refresh = searchParams.get('refresh');

  try {
    if (!stockCode || !market) {
      throw new ValidationError('缺少必要参数: stockCode, market');
    }
    validateParams(stockCode, market);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '参数校验失败' },
      { status: 400 },
    );
  }

  const typedMarket = market as 'SH' | 'SZ';
  // bypassCache 仅在 refresh=1 且 NODE_ENV=development 时生效
  const bypassCache = refresh === '1' && process.env.NODE_ENV === 'development';

  try {
    const result = await fetchEventNews(
      { stockCode, market: typedMarket },
      { bypassCache },
    );

    return NextResponse.json(result);
  } catch (err) {
    // 错误脱敏
    const message = err instanceof SanitizedError
      ? err.message
      : '新闻数据查询失败，请稍后重试。';
    return NextResponse.json(
      { error: message },
      { status: 503 },
    );
  }
}
