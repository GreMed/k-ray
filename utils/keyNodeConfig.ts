// 第九阶段：关键股价节点识别配置
// 节点阈值与窗口大小集中配置，不散落在组件中

export interface KeyNodeThresholds {
  // 显著波动阈值（涨跌幅百分比，正负绝对值）
  significantUpThreshold: number; // +5%
  significantDownThreshold: number; // -5%
  // 阶段高低点窗口（前后各 N 个有效交易日）
  localExtremumWindow: number; // 5
  // 数量限制：任意连续 maxNodesPerWindow 个交易日最多展示 maxNodes 个节点
  maxNodesPerWindow: number; // 60
  maxNodes: number; // 8
}

export const DEFAULT_KEY_NODE_THRESHOLDS: KeyNodeThresholds = {
  significantUpThreshold: 5,
  significantDownThreshold: -5,
  localExtremumWindow: 5,
  maxNodesPerWindow: 60,
  maxNodes: 8,
};

// A 股统一涨跌颜色：红涨绿跌
// 所有组件（图表、列表、详情、图例）统一引用此配置
export const MARKET_COLOR = {
  up: '#e65353',   // 上涨：红色
  down: '#20a464', // 下跌：绿色
  upBadgeClass: 'bg-red/10 text-red',
  downBadgeClass: 'bg-green/10 text-green',
} as const;

// 节点类型元信息：标题、颜色、图表标记形状（供图表与列表统一引用）
export interface KeyNodeTypeMeta {
  title: string;
  // 图表标记颜色
  color: string;
  // 图表标记位置
  position: 'aboveBar' | 'belowBar';
  // 图表标记形状（lightweight-charts SeriesMarker shape）
  shape: 'arrowUp' | 'arrowDown' | 'circle';
  // 列表徽标背景色（tailwind class 片段）
  badgeClass: string;
}

export const KEY_NODE_TYPE_META: Record<string, KeyNodeTypeMeta> = {
  significant_up: {
    title: '单日显著上涨',
    color: MARKET_COLOR.up,   // 红色
    position: 'belowBar',
    shape: 'arrowUp',
    badgeClass: MARKET_COLOR.upBadgeClass,
  },
  significant_down: {
    title: '单日显著下跌',
    color: MARKET_COLOR.down, // 绿色
    position: 'aboveBar',
    shape: 'arrowDown',
    badgeClass: MARKET_COLOR.downBadgeClass,
  },
  local_high: {
    title: '阶段高点',
    color: '#2864e6',
    position: 'aboveBar',
    shape: 'circle',
    badgeClass: 'bg-blue/10 text-blue',
  },
  local_low: {
    title: '阶段低点',
    color: '#7657d9',
    position: 'belowBar',
    shape: 'circle',
    badgeClass: 'bg-violet/10 text-violet',
  },
};

// 节点优先级：数值越小优先级越高
// 规则：显著上涨/下跌 > 阶段高点/低点
export const KEY_NODE_PRIORITY: Record<string, number> = {
  significant_up: 1,
  significant_down: 1,
  local_high: 2,
  local_low: 2,
};

// 成交量格式化：BaoStock volume 单位为"股"，A 股 1 手 = 100 股
// 统一展示"万手"：volume / 1000000
export function formatVolume(volume: number): string {
  return `${(volume / 1000000).toFixed(2)} 万手`;
}

// 根据涨跌幅获取颜色类（A 股惯例：红涨绿跌）
export function getChangeColorClass(changePercent: number): string {
  return changePercent >= 0 ? MARKET_COLOR.upBadgeClass : MARKET_COLOR.downBadgeClass;
}
