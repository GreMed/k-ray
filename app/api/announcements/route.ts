import { NextResponse } from 'next/server';
import { fetchAnnouncements } from '@/services/announcements';
import { ValidationError, SanitizedError } from '@/services/announcements/types';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const CODE_REGEX = /^\d{6}$/;
const MAX_RANGE_DAYS = 365; // 1年

function validateParams(stockCode: string, market: string, startDate: string, endDate: string): void {
  if (!stockCode || !CODE_REGEX.test(stockCode)) {
    throw new ValidationError('stockCode 必须为6位数字');
  }
  if (market !== 'SH' && market !== 'SZ') {
    throw new ValidationError('market 只能为 SH 或 SZ');
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
    throw new ValidationError('最大查询区间为1年');
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

  try {
    const result = await fetchAnnouncements({
      stockCode,
      market: typedMarket,
      startDate,
      endDate,
    });

    return NextResponse.json(result);
  } catch (err) {
    // 错误脱敏：不暴露内部路径、堆栈、Cookie或第三方原始响应
    const message = err instanceof SanitizedError
      ? err.message
      : '公告查询失败，请稍后重试。';
    return NextResponse.json(
      { error: message },
      { status: 503 },
    );
  }
}
