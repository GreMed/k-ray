// 里程碑三：生成 4 家新公司的静态快照和关键节点
// 读取 /tmp/k-ray-snapshots/*.json，调用 detectKeyNodes，输出快照 TS 文件

import * as fs from 'fs';
import * as path from 'path';
import { detectKeyNodes } from '../utils/keyNodes';
import type { KLineData } from '../types';

interface ApiResponse {
  stock: { id: string; code: string; name: string; market: string };
  klines: KLineData[];
  meta: {
    source: string;
    sourceLabel: string;
    adjustment: string;
    isRealMarketData: boolean;
    fetchedAt: string;
    ipoDate?: string;
  };
}

const STOCKS = [
  { code: '600519', name: '贵州茅台', market: 'SH' as const },
  { code: '603986', name: '兆易创新', market: 'SH' as const },
  { code: '603236', name: '移远通信', market: 'SH' as const },
  { code: '002594', name: '比亚迪', market: 'SZ' as const },
];

const SNAPSHOT_DIR = path.join(__dirname, '..', 'data');
const TMP_DIR = '/tmp/k-ray-snapshots';

function generateSnapshot(stock: typeof STOCKS[0]): void {
  const jsonPath = path.join(TMP_DIR, `${stock.code}.json`);
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const data: ApiResponse = JSON.parse(raw);

  if (!data.klines || data.klines.length === 0) {
    console.error(`${stock.code}: 无 K 线数据`);
    return;
  }

  // 识别关键节点
  const nodes = detectKeyNodes(data.klines, data.stock.code);

  console.log(`\n=== ${stock.name} (${stock.code}.${stock.market}) ===`);
  console.log(`K 线数量: ${data.klines.length}`);
  console.log(`首根日期: ${data.klines[0].date}`);
  console.log(`末根日期: ${data.klines[data.klines.length - 1].date}`);
  console.log(`关键节点数量: ${nodes.length}`);
  nodes.forEach((n, i) => {
    console.log(`  [${i + 1}] ${n.date} ${n.title} close=${n.close} change=${n.changePercent?.toFixed(2)}% vol=${n.volume}`);
  });

  // 生成快照 TS 文件
  const fileName = `staticCase_${stock.code}_snapshot.ts`;
  const filePath = path.join(SNAPSHOT_DIR, fileName);

  const klinesStr = JSON.stringify(data.klines, null, 2);
  const metaStr = JSON.stringify({
    stockCode: data.stock.code,
    stockName: data.stock.name,
    market: data.stock.market,
    requestStartDate: '2024-06-01',
    requestEndDate: '2024-12-31',
    actualFirstDate: data.klines[0].date,
    actualLastDate: data.klines[data.klines.length - 1].date,
    snapshotGeneratedAt: '2026-07-14',
    adjustment: data.meta.adjustment,
    source: data.meta.source,
    ipoDate: data.meta.ipoDate || '',
  }, null, 2);

  const tsContent = `// 第十六阶段里程碑三：${stock.name}（${stock.code}.${stock.market}）静态快照
// 由 BaoStock 真实前复权日线数据生成，页面运行时不请求行情接口
// 快照生成时间：2026-07-14

import { KLineData } from '@/types';

export const snapshot_${stock.code}_meta = ${metaStr};

export const snapshot_${stock.code}_klines: KLineData[] = ${klinesStr};
`;

  fs.writeFileSync(filePath, tsContent, 'utf-8');
  console.log(`快照已写入: ${filePath}`);

  // 输出关键节点信息（供创建案例文件使用）
  const nodesInfoPath = path.join(TMP_DIR, `${stock.code}_nodes.json`);
  fs.writeFileSync(nodesInfoPath, JSON.stringify(nodes.map(n => ({
    id: n.id,
    date: n.date,
    close: n.close,
    changePercent: n.changePercent,
    volume: n.volume,
    type: n.type,
    title: n.title,
    previousClose: n.previousClose,
    previousVolume: n.previousVolume,
    volumeChangePercent: n.volumeChangePercent,
  })), null, 2), 'utf-8');
  console.log(`节点信息已写入: ${nodesInfoPath}`);
}

// 处理所有股票
STOCKS.forEach(generateSnapshot);

console.log('\n全部完成。');
