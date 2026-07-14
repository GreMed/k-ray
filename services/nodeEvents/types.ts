// K-Ray 第十阶段 B：关键节点—事件候选关联类型定义
// 连接第九阶段关键股价节点与第十阶段 A 新闻候选来源
// 独立于公告、资金流、市场传闻和 AI 归因

import type { NewsEventCandidate, EventNewsMode, EventNewsProvider, StockRelevanceStatus } from '../eventNews/types';

// 节点事件候选查询参数
export interface NodeEventQuery {
  stockCode: string;
  market: 'SH' | 'SZ';
  // 关键节点日期，格式 YYYY-MM-DD
  nodeDate: string;
  // 检索窗口（自然日），默认 3，表示节点日前后各 3 天
  windowDays?: number;
}

// 节点事件候选结果元信息
export interface NodeEventCandidateMeta {
  // 数据获取模式（与第十阶段 A 一致）
  dataMode: EventNewsMode;
  // 数据获取工具
  provider: EventNewsProvider;
  // 上游平台
  upstreamPlatform: string;
  // 来源标签
  sourceLabel: string;
  // 是否为真实数据
  isRealData: boolean;
  // 获取时间
  fetchedAt: string;
  // 关键节点日期
  nodeDate: string;
  // 检索窗口开始日期（含）
  windowStart: string;
  // 检索窗口结束日期（含）
  windowEnd: string;
  // 窗口内候选总数
  totalCount: number;
  // 已验证相关数量
  verifiedCount: number;
  // 待人工确认数量
  unverifiedCount: number;
  // 多股汇总候选数量
  multiStockSummaryCount: number;
  // 原始新闻总数（窗口外+窗口内）
  originalTotalCount: number;
  // 降级原因（fallback 模式）
  fallbackReason?: string;
  // 缓存状态
  cacheStatus: 'hit' | 'miss' | 'bypass';
}

// 节点事件候选结果
export interface NodeEventCandidateResult {
  // 窗口内的候选新闻列表（按发布时间排序）
  candidates: NewsEventCandidate[];
  meta: NodeEventCandidateMeta;
}

// 重新导出常用类型，方便引用
export type { NewsEventCandidate, EventNewsMode, EventNewsProvider, StockRelevanceStatus };
