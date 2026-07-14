// 第九阶段：开发验收用的固定 K 线样本
// 仅用于开发环境验收节点算法与界面，明确标注为"开发验收样本"
// 不伪装成真实行情结果

import { KLineData } from '@/types';

// 构造一条 K 线
function makeKLine(
  stockId: string,
  date: string,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number,
  changePercent?: number,
): KLineData {
  return {
    id: `dev-sample:${stockId}:${date}`,
    stockId,
    date,
    open,
    high,
    low,
    close,
    volume,
    changePercent,
  };
}

// 样本1：包含显著上涨、显著下跌、阶段高点和低点的稳定样本
// 共 25 个交易日，前后各 5 个交易日窗口满足阶段高低点识别条件
export const DEV_SAMPLE_WITH_NODES: KLineData[] = (() => {
  const stockId = 'stock-sh-600519';
  // 基础收盘价序列：先平稳 → 显著上涨 → 阶段高点 → 显著下跌 → 阶段低点 → 平稳
  // index 0-4: 平稳期（前5个交易日，不参与阶段高低点）
  // index 5: 显著上涨 +6% (第6日，开始进入窗口范围 index>=5)
  // index 7: 阶段高点（前后5日最高收盘价）
  // index 10: 显著下跌 -7% (阶段高点后回落)
  // index 13: 阶段低点（前后5日最低收盘价）
  // index 14-24: 平稳恢复期
  const closes = [
    1700, 1705, 1710, 1708, 1706, // 0-4 平稳
    1812, // 5: +6.2% 显著上涨
    1810, 1815, 1818, // 6-8 小幅波动
    1812, // 9: 仍是高点附近
    1820, // 10: 阶段高点（前后5日最高）
    1690, // 11: -7.1% 显著下跌
    1685, 1688, // 12-13 小幅波动
    1680, // 14: 阶段低点（前后5日最低）
    1685, 1690, 1695, 1700, 1705, 1710, 1715, 1720, 1725, 1730, // 15-24 平稳恢复
  ];
  const volumes = [
    5000000, 5100000, 5200000, 5050000, 5000000, // 0-4
    12000000, // 5: 放量上涨
    8000000, 7500000, 7800000, // 6-8
    7600000, // 9
    9000000, // 10: 高点
    13000000, // 11: 放量下跌
    8500000, 8200000, // 12-13
    7800000, // 14: 低点缩量
    6000000, 6100000, 6200000, 6300000, 6400000, 6500000, 6600000, 6700000, 6800000, 6900000, // 15-24
  ];
  const dates: string[] = [];
  const baseDate = new Date('2024-02-01');
  for (let i = 0; i < closes.length; i++) {
    const d = new Date(baseDate);
    // 跳过周末，生成交易日日期
    d.setDate(d.getDate() + i);
    // 简单处理：直接用 i 天偏移，测试中不依赖真实交易日历
    dates.push(d.toISOString().slice(0, 10));
  }

  return closes.map((close, i) => {
    const prevClose = i > 0 ? closes[i - 1] : close;
    const changePercent = i > 0 ? ((close - prevClose) / prevClose) * 100 : 0;
    const open = prevClose;
    const high = Math.max(open, close) + Math.abs(changePercent) * 2;
    const low = Math.min(open, close) - Math.abs(changePercent) * 2;
    return makeKLine(stockId, dates[i], open, high, low, close, volumes[i], Number(changePercent.toFixed(2)));
  });
})();

// 样本2：无关键节点的平稳样本（涨跌幅均小于 5%，无明显高低点）
export const DEV_SAMPLE_NO_NODES: KLineData[] = (() => {
  const stockId = 'stock-sh-600519';
  const closes: number[] = [];
  let price = 1000;
  // 20 个交易日，每日涨跌幅在 ±0.3% 之间小幅波动
  for (let i = 0; i < 20; i++) {
    const change = (i % 2 === 0 ? 0.2 : -0.2) + (i % 3 === 0 ? 0.1 : 0);
    price = Number((price * (1 + change / 100)).toFixed(2));
    closes.push(price);
  }

  const dates: string[] = [];
  const baseDate = new Date('2024-03-01');
  for (let i = 0; i < closes.length; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }

  return closes.map((close, i) => {
    const prevClose = i > 0 ? closes[i - 1] : close;
    const changePercent = i > 0 ? Number((((close - prevClose) / prevClose) * 100).toFixed(2)) : 0;
    const open = prevClose;
    const high = Math.max(open, close) + 1;
    const low = Math.min(open, close) - 1;
    return makeKLine(stockId, dates[i], open, high, low, close, 5000000 + i * 10000, changePercent);
  });
})();

// 开发验收样本的元信息（用于页面标注）
export const DEV_SAMPLE_META = {
  withNodes: {
    stockCode: '600519',
    stockName: '贵州茅台（开发验收样本）',
    stockId: 'stock-sh-600519',
    market: 'SH' as const,
    startDate: DEV_SAMPLE_WITH_NODES[0].date,
    endDate: DEV_SAMPLE_WITH_NODES[DEV_SAMPLE_WITH_NODES.length - 1].date,
    note: '开发验收样本 · 固定 K 线数据，非真实行情结果',
  },
  noNodes: {
    stockCode: '600519',
    stockName: '贵州茅台（开发验收样本）',
    stockId: 'stock-sh-600519',
    market: 'SH' as const,
    startDate: DEV_SAMPLE_NO_NODES[0].date,
    endDate: DEV_SAMPLE_NO_NODES[DEV_SAMPLE_NO_NODES.length - 1].date,
    note: '开发验收样本 · 固定 K 线数据，非真实行情结果',
  },
};
