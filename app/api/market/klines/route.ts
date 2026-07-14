import { NextResponse } from 'next/server';
import { fetchKLines } from '@/services/marketData';
import { fetchStockInfo } from '@/services/marketData/stockInfo';
import { ValidationError } from '@/services/marketData/types';
import { validateMarketConsistency, validateSupportedAShareCode } from '@/utils/stockCode';
import type { Stock } from '@/types';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const CODE_REGEX = /^\d{6}$/;
const MAX_RANGE_DAYS = 365 * 10; // 10年

function buildStockId(market: string, code: string): string {
  return `stock-${market.toLowerCase()}-${code}`;
}

async function buildStock(code: string, market: 'SH' | 'SZ'): Promise<Stock> {
  // 查询真实证券简称，查询失败时 name 为空字符串，由展示层显示「名称暂未取得」
  let name = '';
  try {
    const info = await fetchStockInfo(code, market);
    name = info.name;
  } catch {
    // 名称查询失败不阻止 K 线查询，name 保持空字符串
  }
  return {
    id: buildStockId(market, code),
    code,
    name,
    market,
  };
}

/**
 * 校验股票真实存在性：通过 BaoStock 基础信息查询确认
 * - 代码确实存在（found=true）
 * - 类型为上市股票（securityType='stock'）
 * - 当前处于上市交易状态（isListed=true）
 * 返回 null 表示通过，返回 { error, status } 表示错误信息及 HTTP 状态码
 * 通过时同时返回 ipoDate 供调用方使用
 */
async function verifyStockExistence(
  code: string,
  market: 'SH' | 'SZ',
): Promise<{ error: string; status: number } | { ipoDate?: string }> {
  let info;
  try {
    info = await fetchStockInfo(code, market);
  } catch {
    // 第十四阶段 A1 封板修复：基础信息查询异常时失败关闭，不再放行
    // 返回 503 及通俗错误，不继续调用 K 线服务
    return {
      error: '股票基础信息查询暂时不可用，请稍后重试。',
      status: 503,
    };
  }

  if (!info.found) {
    return {
      error: `代码 ${code} 不存在或 BaoStock 无记录，请确认是否为有效的沪深上市A股`,
      status: 400,
    };
  }
  if (info.securityType !== 'stock') {
    const typeLabel: Record<string, string> = {
      index: '指数',
      bond: '债券',
      fund: '基金',
      other: '其他证券',
      unknown: '未知类型',
    };
    return {
      error: `代码 ${code} 为${typeLabel[info.securityType] || '非股票证券'}，仅支持沪深上市A股`,
      status: 400,
    };
  }
  if (!info.isListed) {
    // 第十四阶段 A1 封板修复：已退市/未上市证券拒绝查询
    return {
      error: '该股票当前不是上市交易状态，暂不支持查询。',
      status: 400,
    };
  }
  return { ipoDate: info.ipoDate };
}

function validateParams(stockCode: string, market: string, startDate: string, endDate: string): void {
  if (!stockCode || !CODE_REGEX.test(stockCode)) {
    throw new ValidationError('stockCode 必须为6位数字');
  }
  if (market !== 'SH' && market !== 'SZ') {
    throw new ValidationError('market 只能为 SH 或 SZ');
  }
  // 支持性校验：仅接受沪深 A 股代码
  const supportError = validateSupportedAShareCode(stockCode);
  if (supportError) {
    throw new ValidationError(supportError);
  }
  // 交叉校验：股票代码与市场必须一致
  const marketError = validateMarketConsistency(stockCode, market as 'SH' | 'SZ');
  if (marketError) {
    throw new ValidationError(marketError);
  }
  if (!startDate || !DATE_REGEX.test(startDate)) {
    throw new ValidationError('startDate 必须为 YYYY-MM-DD 格式');
  }
  if (!endDate || !DATE_REGEX.test(endDate)) {
    throw new ValidationError('endDate 必须为 YYYY-MM-DD 格式');
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ValidationError('日期格式非法');
  }
  if (start > end) {
    throw new ValidationError('开始日期不能晚于结束日期');
  }
  const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays > MAX_RANGE_DAYS) {
    throw new ValidationError('最大查询区间为10年');
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stockCode = searchParams.get('stockCode');
  const market = searchParams.get('market');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    if (!stockCode || !market || !startDate || !endDate) {
      throw new ValidationError('缺少必要参数: stockCode, market, startDate, endDate');
    }

    validateParams(stockCode, market, startDate, endDate);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '参数校验失败' },
      { status: 400 },
    );
  }

  const typedMarket = market as 'SH' | 'SZ';

  // 真实证券存在性校验：通过 BaoStock 基础信息确认代码存在且为上市股票
  const existenceResult = await verifyStockExistence(stockCode, typedMarket);
  if ('error' in existenceResult) {
    return NextResponse.json(
      { error: existenceResult.error },
      { status: existenceResult.status },
    );
  }
  const ipoDate = existenceResult.ipoDate;

  const stock = await buildStock(stockCode, typedMarket);

  try {
    const result = await fetchKLines({
      stockId: stock.id,
      stockCode,
      market: typedMarket,
      startDate,
      endDate,
    });

    // 第十四阶段 A1 封板修复：在 meta 中补充真实 IPO 日期，供前端区分
    // "晚上市" vs "周末/节假日/停牌" 造成首根 K 线晚于请求开始日
    const metaWithIpo = {
      ...result.meta,
      ipoDate,
    };

    return NextResponse.json({
      stock,
      ...result,
      meta: metaWithIpo,
    });
  } catch (err) {
    // 脱敏：只返回用户友好错误
    const message = err instanceof Error ? err.message : '行情服务暂时不可用';
    return NextResponse.json(
      { error: message },
      { status: 503 },
    );
  }
}
