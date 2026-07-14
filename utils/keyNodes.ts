// 第九阶段：关键股价节点识别服务
// 输入：按日期升序排列的日 K 数据
// 输出：稳定的关键节点列表（去重、按日期升序、数量受限）
//
// 严格边界：仅基于可计算的行情事实，不解释涨跌原因

import { KLineData, MarketKeyNode, MarketKeyNodeType } from '@/types';
import {
  DEFAULT_KEY_NODE_THRESHOLDS,
  KEY_NODE_PRIORITY,
  KEY_NODE_TYPE_META,
  type KeyNodeThresholds,
} from './keyNodeConfig';

// 生成稳定节点 ID：节点类型:股票代码:日期
export function generateMarketKeyNodeId(
  type: MarketKeyNodeType,
  stockCode: string,
  date: string,
): string {
  return `${type}:${stockCode}:${date}`;
}

// 安全数字格式化（避免浮点精度问题）
function formatPercent(value: number): string {
  return value.toFixed(1);
}

// 构造仅基于行情数据的事实说明
// 首日无前收/前成交量时，不输出无法验证的比较事实
function buildDetailSummary(
  date: string,
  changePercent: number,
  prevVolume: number | null,
  currentVolume: number,
  hasPrevClose: boolean,
): string {
  // 首日无前收数据：不输出涨跌幅比较和成交量比较
  if (!hasPrevClose) {
    return `${date} 为查询区间首日，区间内无前收数据，无法计算涨跌幅与成交量变化。`;
  }

  const direction = changePercent >= 0 ? '上涨' : '下跌';
  const changeAbs = Math.abs(changePercent);

  let volumeDesc: string;
  if (prevVolume === null || prevVolume <= 0) {
    volumeDesc = '区间内无前一交易日成交量数据';
  } else {
    const volumeChangeRatio = (currentVolume - prevVolume) / prevVolume;
    const volumeChangePercent = volumeChangeRatio * 100;
    if (volumeChangeRatio >= 0) {
      volumeDesc = `成交量较前一交易日增加 ${formatPercent(volumeChangePercent)}%`;
    } else {
      volumeDesc = `成交量较前一交易日减少 ${formatPercent(Math.abs(volumeChangePercent))}%`;
    }
  }

  return `${date} 收盘价较前一交易日${direction} ${formatPercent(changeAbs)}%，${volumeDesc}。`;
}

// 计算成交量变化百分比：prevVolume 为 null 或 <= 0 时返回 null
function computeVolumeChangePercent(
  currentVolume: number,
  prevVolume: number | null,
): number | null {
  if (prevVolume === null || prevVolume <= 0) return null;
  return ((currentVolume - prevVolume) / prevVolume) * 100;
}

// 计算涨跌幅百分比：无前收数据时返回 null（首日无法验证涨跌幅）
// 有前收数据时优先使用 K 线自带的 changePercent，否则基于前收计算
function computeChangePercent(
  current: KLineData,
  previousClose: number | null,
): number | null {
  // 首日无前收数据，即使 K 线自带 changePercent 也不应使用（无法在区间内验证）
  if (previousClose === null || previousClose <= 0) {
    return null;
  }
  if (typeof current.changePercent === 'number' && !Number.isNaN(current.changePercent)) {
    return current.changePercent;
  }
  return ((current.close - previousClose) / previousClose) * 100;
}

interface RawCandidate {
  type: MarketKeyNodeType;
  index: number;
  changePercent: number | null;
}

// 识别四类节点候选（未去重、未限流）
function detectCandidates(
  klines: KLineData[],
  thresholds: KeyNodeThresholds,
): RawCandidate[] {
  const candidates: RawCandidate[] = [];
  const window = thresholds.localExtremumWindow;

  for (let i = 0; i < klines.length; i++) {
    const current = klines[i];
    const previousClose = i > 0 ? klines[i - 1].close : null;
    const changePercent = computeChangePercent(current, previousClose);

    // 1. 显著上涨 / 显著下跌（无前收数据时不识别）
    if (changePercent !== null && changePercent >= thresholds.significantUpThreshold) {
      candidates.push({ type: 'significant_up', index: i, changePercent });
    } else if (changePercent !== null && changePercent <= thresholds.significantDownThreshold) {
      candidates.push({ type: 'significant_down', index: i, changePercent });
    }

    // 2. 阶段高点 / 阶段低点（前后不足 window 个交易日不参与）
    if (i >= window && i < klines.length - window) {
      const currentClose = current.close;
      let isHigh = true;
      let isLow = true;
      for (let j = i - window; j <= i + window; j++) {
        if (j === i) continue;
        if (klines[j].close >= currentClose) {
          isHigh = false;
        }
        if (klines[j].close <= currentClose) {
          isLow = false;
        }
        if (!isHigh && !isLow) break;
      }
      if (isHigh) {
        candidates.push({ type: 'local_high', index: i, changePercent });
      }
      if (isLow) {
        candidates.push({ type: 'local_low', index: i, changePercent });
      }
    }
  }

  return candidates;
}

// 同一交易日多规则命中时按优先级去重：保留优先级最高（数值最小）的节点
function dedupeByPriority(candidates: RawCandidate[]): RawCandidate[] {
  const byIndex = new Map<number, RawCandidate>();
  for (const candidate of candidates) {
    const existing = byIndex.get(candidate.index);
    if (!existing) {
      byIndex.set(candidate.index, candidate);
      continue;
    }
    const existingPriority = KEY_NODE_PRIORITY[existing.type] ?? Number.MAX_SAFE_INTEGER;
    const newPriority = KEY_NODE_PRIORITY[candidate.type] ?? Number.MAX_SAFE_INTEGER;
    if (newPriority < existingPriority) {
      byIndex.set(candidate.index, candidate);
    }
  }
  return Array.from(byIndex.values());
}

// 候选节点的稳定排序比较器（用于限流时的优先级排序）
// 分类型处理：
//   1. 显著上涨/下跌：优先级 → 绝对涨跌幅从大到小 → 完整稳定 ID 字符串排序
//   2. 阶段高点/低点：优先级 → 日期/index 从早到晚 → 完整稳定 ID 字符串排序
//
// 不使用 32 位 hash，直接比较完整稳定 ID 字符串，保证确定性。
function compareCandidates(
  a: RawCandidate,
  b: RawCandidate,
  stockCode: string,
  klines: KLineData[],
): number {
  const priorityA = KEY_NODE_PRIORITY[a.type] ?? Number.MAX_SAFE_INTEGER;
  const priorityB = KEY_NODE_PRIORITY[b.type] ?? Number.MAX_SAFE_INTEGER;
  if (priorityA !== priorityB) return priorityA - priorityB;

  const aIsSignificant = a.type === 'significant_up' || a.type === 'significant_down';
  const bIsSignificant = b.type === 'significant_up' || b.type === 'significant_down';

  if (aIsSignificant && bIsSignificant) {
    // 显著节点：按绝对涨跌幅从大到小
    const absA = Math.abs(a.changePercent ?? 0);
    const absB = Math.abs(b.changePercent ?? 0);
    if (absA !== absB) return absB - absA; // 降序：大的在前
  } else if (!aIsSignificant && !bIsSignificant) {
    // 阶段高低点：按日期/index 从早到晚
    if (a.index !== b.index) return a.index - b.index; // 升序：早的在前
  }

  // 最终 tiebreaker：完整稳定 ID 字符串排序
  const idA = generateMarketKeyNodeId(a.type, stockCode, klines[a.index].date);
  const idB = generateMarketKeyNodeId(b.type, stockCode, klines[b.index].date);
  return idA < idB ? -1 : idA > idB ? 1 : 0;
}

// 任意连续 60 个交易日窗口最多 8 个节点（滑动窗口算法）
//
// 算法：
//   1. 对全部候选节点建立稳定优先级排序
//   2. 按优先级逐个尝试加入结果
//   3. 每加入一个候选后，检查所有包含该节点的连续 60 日窗口
//   4. 只有当任意连续 60 日窗口中的节点数都不超过 8 时，才保留该节点
//   5. 最终结果按日期升序输出
//
// 这种算法不会因为查询起始日移动一天而导致节点数量突变，
// 因为它是基于滑动窗口而非固定分桶。
function applyNodeLimit(
  candidates: RawCandidate[],
  thresholds: KeyNodeThresholds,
  stockCode: string,
  klines: KLineData[],
): RawCandidate[] {
  if (candidates.length <= thresholds.maxNodes) {
    return candidates;
  }

  // 按稳定优先级排序（分类型处理）
  const sorted = [...candidates].sort((a, b) => compareCandidates(a, b, stockCode, klines));

  const selected: RawCandidate[] = [];
  const selectedIndices: number[] = []; // 已选节点的 index 列表（保持有序）

  for (const candidate of sorted) {
    // 模拟加入该节点后，检查所有包含它的连续 60 日窗口
    const wouldBeSelected = [...selectedIndices, candidate.index].sort((a, b) => a - b);

    let canAdd = true;
    // 检查所有包含 candidate.index 的连续窗口
    // 窗口 [start, start + windowSize - 1] 需要包含 candidate.index
    const windowSize = thresholds.maxNodesPerWindow;
    const maxNodes = thresholds.maxNodes;

    // 窗口起始范围：candidate.index - windowSize + 1 到 candidate.index
    const minStart = Math.max(0, candidate.index - windowSize + 1);
    const maxStart = candidate.index;

    for (let start = minStart; start <= maxStart; start++) {
      const windowEnd = start + windowSize - 1;
      // 统计该窗口内已选节点数（含候选）
      let count = 0;
      for (const idx of wouldBeSelected) {
        if (idx >= start && idx <= windowEnd) {
          count++;
        }
      }
      if (count > maxNodes) {
        canAdd = false;
        break;
      }
    }

    if (canAdd) {
      selected.push(candidate);
      selectedIndices.push(candidate.index);
      selectedIndices.sort((a, b) => a - b);
    }
  }

  // 恢复按日期升序
  selected.sort((a, b) => a.index - b.index);
  return selected;
}

// 将候选转换为 MarketKeyNode
function toMarketKeyNode(
  candidate: RawCandidate,
  klines: KLineData[],
  stockCode: string,
): MarketKeyNode {
  const current = klines[candidate.index];
  const hasPrev = candidate.index > 0;
  const previousClose = hasPrev ? klines[candidate.index - 1].close : null;
  const previousVolume = hasPrev ? klines[candidate.index - 1].volume : null;
  const changePercent = candidate.changePercent ?? 0;
  const volumeChangePercent = computeVolumeChangePercent(current.volume, previousVolume);

  const meta = KEY_NODE_TYPE_META[candidate.type];
  return {
    id: generateMarketKeyNodeId(candidate.type, stockCode, current.date),
    stockCode,
    date: current.date,
    type: candidate.type,
    title: meta.title,
    close: current.close,
    changePercent,
    volume: current.volume,
    previousClose,
    previousVolume,
    volumeChangePercent,
    detailSummary: buildDetailSummary(
      current.date,
      changePercent,
      previousVolume,
      current.volume,
      hasPrev,
    ),
    evidenceLevel: 'market_data_only',
  };
}

/**
 * 识别一段日 K 走势中的关键股价节点
 *
 * @param klines 按日期升序排列的日 K 数据
 * @param stockCode 股票代码（用于生成稳定 ID）
 * @param thresholds 阈值配置，默认使用 DEFAULT_KEY_NODE_THRESHOLDS
 * @returns 关键节点列表（去重、按日期升序、数量受限）
 */
export function detectKeyNodes(
  klines: KLineData[],
  stockCode: string,
  thresholds: KeyNodeThresholds = DEFAULT_KEY_NODE_THRESHOLDS,
): MarketKeyNode[] {
  // 空数据或数据不足
  if (!klines || klines.length === 0) {
    return [];
  }

  // 识别候选
  const candidates = detectCandidates(klines, thresholds);
  if (candidates.length === 0) {
    return [];
  }

  // 同日去重（按优先级）
  const deduped = dedupeByPriority(candidates);

  // 数量限制（滑动窗口算法）
  const limited = applyNodeLimit(deduped, thresholds, stockCode, klines);

  // 转换为 MarketKeyNode，按日期升序输出
  return limited
    .map(c => toMarketKeyNode(c, klines, stockCode))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// 导出供测试使用的辅助函数
export { applyNodeLimit as _applyNodeLimitForTest };
