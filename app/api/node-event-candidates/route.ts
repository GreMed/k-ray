// K-Ray 第十阶段 B：关键节点—事件候选关联 API
// 连接第九阶段关键股价节点与第十阶段 A 新闻候选来源
// 独立于公告和行情 API

import { NextResponse } from 'next/server';
import { fetchNodeEventCandidates } from '@/services/nodeEvents';
import { ValidationError, SanitizedError } from '@/services/eventNews/types';
import { detectMarket } from '@/utils/stockCode';

const CODE_REGEX = /^\d{6}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function validateParams(
  stockCode: string,
  market: string,
  nodeDate: string,
  windowDays: number,
): void {
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
  if (!nodeDate || !DATE_REGEX.test(nodeDate)) {
    throw new ValidationError('nodeDate 必须为 YYYY-MM-DD 格式');
  }
  // 校验日期有效性
  const d = new Date(nodeDate + 'T00:00:00');
  if (isNaN(d.getTime())) {
    throw new ValidationError('nodeDate 不是有效日期');
  }
  if (windowDays < 0 || windowDays > 30) {
    throw new ValidationError('windowDays 必须在 0-30 之间');
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stockCode = searchParams.get('stockCode');
  const market = searchParams.get('market');
  const nodeDate = searchParams.get('nodeDate');
  const windowDaysParam = searchParams.get('windowDays');
  // dev-only 绕过缓存参数
  const refresh = searchParams.get('refresh');

  const windowDays = windowDaysParam ? parseInt(windowDaysParam, 10) : 3;

  try {
    if (!stockCode || !market || !nodeDate) {
      throw new ValidationError('缺少必要参数: stockCode, market, nodeDate');
    }
    if (isNaN(windowDays)) {
      throw new ValidationError('windowDays 必须为数字');
    }
    validateParams(stockCode, market, nodeDate, windowDays);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '参数校验失败' },
      { status: 400 },
    );
  }

  const typedMarket = market as 'SH' | 'SZ';
  const bypassCache = refresh === '1' && process.env.NODE_ENV === 'development';

  try {
    const result = await fetchNodeEventCandidates(
      { stockCode, market: typedMarket, nodeDate, windowDays },
      { bypassCache },
    );

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof SanitizedError
      ? err.message
      : '事件候选查询失败，请稍后重试。';
    return NextResponse.json(
      { error: message },
      { status: 503 },
    );
  }
}
