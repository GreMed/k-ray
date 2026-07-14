import { NextResponse } from 'next/server';
import { fetchStockInfo } from '@/services/marketData/stockInfo';
import { ValidationError, SanitizedError } from '@/services/marketData/types';
import { validateMarketConsistency, validateSupportedAShareCode } from '@/utils/stockCode';

const CODE_REGEX = /^\d{6}$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stockCode = searchParams.get('stockCode');
  const market = searchParams.get('market');

  try {
    if (!stockCode || !market) {
      throw new ValidationError('缺少必要参数: stockCode, market');
    }
    if (!CODE_REGEX.test(stockCode)) {
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
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '参数校验失败' },
      { status: 400 },
    );
  }

  const typedMarket = market as 'SH' | 'SZ';

  try {
    const info = await fetchStockInfo(stockCode, typedMarket);

    // 真实证券存在性校验
    if (!info.found) {
      return NextResponse.json(
        { error: `代码 ${stockCode} 不存在或 BaoStock 无记录，请确认是否为有效的沪深上市A股` },
        { status: 400 },
      );
    }

    // 证券类型校验：仅接受上市股票
    if (info.securityType !== 'stock') {
      const typeLabel: Record<string, string> = {
        index: '指数',
        bond: '债券',
        fund: '基金',
        other: '其他证券',
        unknown: '未知类型',
      };
      return NextResponse.json(
        { error: `代码 ${stockCode} 为${typeLabel[info.securityType] || '非股票证券'}，仅支持沪深上市A股` },
        { status: 400 },
      );
    }

    // 第十四阶段 A1 封板修复：已退市/未上市证券拒绝查询
    if (!info.isListed) {
      return NextResponse.json(
        { error: '该股票当前不是上市交易状态，暂不支持查询。' },
        { status: 400 },
      );
    }

    return NextResponse.json({
      stockCode: info.stockCode,
      market: info.market,
      name: info.name,
      found: info.found,
      ipoDate: info.ipoDate,
      isListed: info.isListed,
      securityType: info.securityType,
    });
  } catch (err) {
    // 第十四阶段 A1 收口：基础信息查询异常统一失败关闭
    // SanitizedError 使用经过脱敏的通俗错误文案；其他异常统一返回脱敏文案，不暴露内部细节
    if (err instanceof SanitizedError) {
      return NextResponse.json(
        { error: err.message },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: '股票基础信息查询暂时不可用，请稍后重试。' },
      { status: 503 },
    );
  }
}
