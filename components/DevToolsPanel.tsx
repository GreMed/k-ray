'use client';

import { useSyncExternalStore } from 'react';
import { Stock, ReplayResult, HistoricalEvent, KeyNode, FutureEvent, EventSource, MarketKeyNode, KLineData } from '@/types';
import { mapEventToTradingDate, aggregateEventsUnified, type AggregatedEventGroup } from '@/utils/eventAggregation';
import { DEMO_STOCK, isDevEnvironment } from '@/utils/devHelpers';
import { detectKeyNodes } from '@/utils/keyNodes';
import { DEV_SAMPLE_WITH_NODES, DEV_SAMPLE_NO_NODES, DEV_SAMPLE_META } from '@/utils/keyNodeDevSamples';

interface DevToolsPanelProps {
  pageState: string;
  replayResult: ReplayResult | null;
  selectedStock: Stock | null;
  startDate: string;
  endDate: string;
  executeReplay: (stockId: string, start: string, end: string) => Promise<void>;
  setSelectedEvent: (event: HistoricalEvent | null) => void;
  setSelectedNode: (node: KeyNode | null) => void;
  setSelectedEventGroup: (group: AggregatedEventGroup | null) => void;
  setIsEventDrawerOpen: (open: boolean) => void;
  setIsEventListOpen: (open: boolean) => void;
  setIsNodeDrawerOpen: (open: boolean) => void;
  setIsFromGroup: (isFrom: boolean) => void;
  setSelectedFutureEvent: (event: FutureEvent | null) => void;
  setIsFutureEventDrawerOpen: (open: boolean) => void;
  setDevAutoOpenSourceId: (id: string | null) => void;
  setSelectedSource: (source: EventSource | null) => void;
  setSelectedStock: (stock: Stock | null) => void;
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;
  setPageState: (state: 'initial' | 'loading' | 'success' | 'empty' | 'error') => void;
  setReplayResult: (result: ReplayResult | null) => void;
  // 第九阶段：关键节点验收入口
  marketKeyNodes: MarketKeyNode[];
  setSelectedMarketKeyNode: (node: MarketKeyNode | null) => void;
  setIsMarketKeyNodeDrawerOpen: (open: boolean) => void;
  setDevKeyNodeSampleMode: (mode: 'none' | 'withNodes' | 'noNodes') => void;
  // 第十一阶段 A：用户未来事件开发入口
  onDevLoadSampleUserEvents: () => void;
  onDevClearUserEvents: () => void;
  onDevOpenUserEventForm: () => void;
  // 第十二阶段 A：用户复盘笔记开发入口
  onDevLoadSampleReplayNote: () => void;
  onDevClearReplayNotes: () => void;
}

// 客户端开发环境 Hook：使用 useSyncExternalStore 避免 SSR/客户端 hydration 不匹配
// - 服务器端渲染：getServerSnapshot 返回 false
// - 客户端首次渲染（hydration）：使用 getServerSnapshot（false），与服务器一致
// - hydration 完成后：切换到 getSnapshot（检查 ?dev=1），React 自动 re-render
function useIsDevEnvironment(): boolean {
  return useSyncExternalStore(
    () => () => {}, // subscribe: 开发环境值在页面生命周期内稳定，无需订阅
    () => isDevEnvironment(), // getSnapshot（客户端）
    () => false // getServerSnapshot（服务器端）
  );
}

export default function DevToolsPanel(props: DevToolsPanelProps) {
  const {
    pageState,
    replayResult,
  } = props;

  if (!useIsDevEnvironment()) return null;

  const aggregatedGroups = replayResult
    ? aggregateEventsUnified(replayResult.historicalEvents, replayResult.klines)
    : [];

  // 统一清理所有抽屉、弹窗和开发辅助状态
  const cleanupAllDrawers = () => {
    props.setSelectedEvent(null);
    props.setSelectedNode(null);
    props.setSelectedEventGroup(null);
    props.setIsEventDrawerOpen(false);
    props.setIsEventListOpen(false);
    props.setIsNodeDrawerOpen(false);
    props.setIsFromGroup(false);
    props.setSelectedFutureEvent(null);
    props.setIsFutureEventDrawerOpen(false);
    props.setDevAutoOpenSourceId(null);
    props.setSelectedSource(null);
    // 第九阶段：清理关键节点状态（marketKeyNodes 由 page.tsx useMemo 派生，无需手动清理）
    props.setSelectedMarketKeyNode(null);
    props.setIsMarketKeyNodeDrawerOpen(false);
    props.setDevKeyNodeSampleMode('none');
  };

  const loadSuccessState = async () => {
    const stock = DEMO_STOCK;
    const start = '2024-01-01';
    const end = '2024-01-31';
    cleanupAllDrawers();
    props.setSelectedStock(stock);
    props.setStartDate(start);
    props.setEndDate(end);
    // 复用 executeReplay：统一的异常处理、isLoading 防重、try/finally 保证恢复
    await props.executeReplay(stock.id, start, end);
  };

  const loadEmptyState = async () => {
    cleanupAllDrawers();
    props.setSelectedStock(DEMO_STOCK);
    props.setStartDate('2025-12-01');
    props.setEndDate('2025-12-31');
    props.setPageState('loading');
    await new Promise(r => setTimeout(r, 500));
    props.setReplayResult(null);
    props.setPageState('empty');
  };

  const loadErrorState = async () => {
    cleanupAllDrawers();
    props.setSelectedStock(DEMO_STOCK);
    props.setStartDate('2024-01-01');
    props.setEndDate('2024-01-31');
    props.setPageState('loading');
    await new Promise(r => setTimeout(r, 500));
    props.setReplayResult(null);
    props.setPageState('error');
  };

  const openEventGroup = () => {
    if (!replayResult) return;
    const multiGroup = aggregatedGroups.find(g => g.events.length > 1);
    if (multiGroup) {
      props.setSelectedEventGroup(multiGroup);
      props.setIsEventListOpen(true);
    }
  };

  const openMappedEvent = () => {
    if (!replayResult) return;
    const klineDates = replayResult.klines.map(k => k.date);
    const mappedEvent = replayResult.historicalEvents.find(e => {
      const { isMapped } = mapEventToTradingDate(e.occurTime, klineDates);
      return isMapped;
    });
    if (mappedEvent) {
      props.setSelectedEvent(mappedEvent);
      props.setIsEventDrawerOpen(true);
      props.setIsFromGroup(false);
    }
  };

  const openNode = () => {
    if (!replayResult) return;
    if (replayResult.keyNodes.length > 0) {
      props.setSelectedNode(replayResult.keyNodes[0]);
      props.setIsNodeDrawerOpen(true);
    }
  };

  const openMultiSourceEvent = () => {
    if (!replayResult) return;
    const multiSourceEvent = replayResult.historicalEvents.find(e =>
      replayResult.sources.filter(s => e.sourceIds.includes(s.id)).length > 1
    );
    if (multiSourceEvent) {
      props.setSelectedEvent(multiSourceEvent);
      props.setIsEventDrawerOpen(true);
      props.setIsFromGroup(false);
    }
  };

  const openSingleSourceEvent = () => {
    if (!replayResult) return;
    const singleSourceEvent = replayResult.historicalEvents.find(e =>
      replayResult.sources.filter(s => e.sourceIds.includes(s.id)).length === 1
    );
    if (singleSourceEvent) {
      props.setSelectedEvent(singleSourceEvent);
      props.setIsEventDrawerOpen(true);
      props.setIsFromGroup(false);
    }
  };

  const openNoSourceEvent = () => {
    if (!replayResult) return;
    const noSourceEvent = replayResult.historicalEvents.find(e => e.sourceIds.length === 0);
    if (noSourceEvent) {
      props.setSelectedEvent(noSourceEvent);
      props.setIsEventDrawerOpen(true);
      props.setIsFromGroup(false);
    }
  };

  const openSourceDetail = () => {
    if (!replayResult) return;
    const firstSource = replayResult.sources[0];
    const firstEvent = replayResult.historicalEvents.find(e => e.sourceIds.includes(firstSource.id));
    if (firstEvent) {
      props.setSelectedEvent(firstEvent);
      props.setIsEventDrawerOpen(true);
      props.setIsFromGroup(false);
      props.setDevAutoOpenSourceId(firstSource.id);
    }
  };

  const scrollToFutureCalendar = () => {
    const el = document.querySelector('[data-testid="future-calendar"]') || document.querySelector('[data-testid="future-calendar-empty"]');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const openConfirmedFutureEvent = () => {
    if (!replayResult) return;
    const event = replayResult.futureEvents.find(e => e.dateCertainty === 'confirmed');
    if (event) {
      props.setSelectedFutureEvent(event);
      props.setIsFutureEventDrawerOpen(true);
    }
  };

  const openEstimatedFutureEvent = () => {
    if (!replayResult) return;
    const event = replayResult.futureEvents.find(e => e.dateCertainty === 'estimated');
    if (event) {
      props.setSelectedFutureEvent(event);
      props.setIsFutureEventDrawerOpen(true);
    }
  };

  const openTentativeFutureEvent = () => {
    if (!replayResult) return;
    const event = replayResult.futureEvents.find(e => e.dateCertainty === 'tentative');
    if (event) {
      props.setSelectedFutureEvent(event);
      props.setIsFutureEventDrawerOpen(true);
    }
  };

  // ===== 第九阶段：关键股价节点验收入口 =====

  // 构造开发验收样本的 ReplayResult
  const buildDevSampleReplayResult = (klines: KLineData[]): ReplayResult => {
    const stock: Stock = {
      id: DEV_SAMPLE_META.withNodes.stockId,
      code: DEV_SAMPLE_META.withNodes.stockCode,
      name: DEV_SAMPLE_META.withNodes.stockName,
      market: DEV_SAMPLE_META.withNodes.market,
    };
    return {
      stock,
      klines,
      keyNodes: [],
      historicalEvents: [],
      sources: [],
      futureEvents: [],
      marketMeta: {
        source: 'mock',
        sourceLabel: '开发验收样本',
        adjustment: 'none',
        isRealMarketData: false,
        fetchedAt: new Date().toISOString(),
      },
    };
  };

  // 加载包含关键节点的固定样本
  const loadKeyNodeSampleWithNodes = async () => {
    cleanupAllDrawers();
    const stock: Stock = {
      id: DEV_SAMPLE_META.withNodes.stockId,
      code: DEV_SAMPLE_META.withNodes.stockCode,
      name: DEV_SAMPLE_META.withNodes.stockName,
      market: DEV_SAMPLE_META.withNodes.market,
    };
    props.setSelectedStock(stock);
    props.setStartDate(DEV_SAMPLE_META.withNodes.startDate);
    props.setEndDate(DEV_SAMPLE_META.withNodes.endDate);
    // 设置 sample mode 用于显示开发样本标注 banner
    props.setDevKeyNodeSampleMode('withNodes');
    // marketKeyNodes 由 page.tsx 的 useMemo 根据 replayResult 自动派生
    const result = buildDevSampleReplayResult(DEV_SAMPLE_WITH_NODES);
    props.setReplayResult(result);
    props.setPageState('success');
  };

  // 加载无关键节点的空状态样本
  const loadKeyNodeSampleNoNodes = async () => {
    cleanupAllDrawers();
    const stock: Stock = {
      id: DEV_SAMPLE_META.noNodes.stockId,
      code: DEV_SAMPLE_META.noNodes.stockCode,
      name: DEV_SAMPLE_META.noNodes.stockName,
      market: DEV_SAMPLE_META.noNodes.market,
    };
    props.setSelectedStock(stock);
    props.setStartDate(DEV_SAMPLE_META.noNodes.startDate);
    props.setEndDate(DEV_SAMPLE_META.noNodes.endDate);
    // 设置 sample mode 用于显示开发样本标注 banner
    props.setDevKeyNodeSampleMode('noNodes');
    // marketKeyNodes 由 page.tsx 的 useMemo 根据 replayResult 自动派生
    const result = buildDevSampleReplayResult(DEV_SAMPLE_NO_NODES);
    props.setReplayResult(result);
    props.setPageState('success');
  };

  // 直接打开第一个关键节点详情
  const openFirstKeyNodeDetail = () => {
    let nodes: MarketKeyNode[] = props.marketKeyNodes || [];
    // 若无已注入节点，则从当前 replayResult 计算
    if (nodes.length === 0 && replayResult && replayResult.klines.length > 0) {
      nodes = detectKeyNodes(replayResult.klines, replayResult.stock.code);
    }
    if (nodes.length > 0) {
      props.setSelectedMarketKeyNode(nodes[0]);
      props.setIsMarketKeyNodeDrawerOpen(true);
    }
  };

  return (
    <div className="mb-6 p-3 bg-gray-50 border border-gray-300 rounded-lg">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
        <span className="text-xs font-bold text-gray-600">🛠 开发模式</span>
        <span className="text-xs text-muted">
          开发辅助面板（仅开发环境可见，生产构建自动移除）
        </span>
      </div>

      {/* 状态快速切换 */}
      <div className="mb-4">
        <div className="text-xs font-semibold text-gray-500 mb-2">状态快速切换</div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            data-testid="dev-open-success"
            onClick={loadSuccessState}
            className="text-xs px-3 py-1.5 rounded bg-green text-white font-semibold hover:bg-green/80 transition-colors"
          >
            成功状态（示例数据）
          </button>
          <button
            data-testid="dev-open-empty"
            onClick={loadEmptyState}
            className="text-xs px-3 py-1.5 rounded bg-yellow text-white font-semibold hover:bg-yellow/80 transition-colors"
          >
            空结果状态
          </button>
          <button
            data-testid="dev-open-error"
            onClick={loadErrorState}
            className="text-xs px-3 py-1.5 rounded bg-red text-white font-semibold hover:bg-red/80 transition-colors"
          >
            错误状态
          </button>
        </div>
      </div>

      {pageState === 'success' && replayResult && (
        <>
          {/* 第二阶段截图辅助面板 */}
          <div className="mb-4 pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-green">截图辅助</span>
                <span className="text-xs text-muted">
                  一键打开各组件
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {aggregatedGroups.find(g => g.events.length > 1) && (
                  <button
                    data-testid="dev-open-event-group"
                    onClick={openEventGroup}
                    className="text-xs px-3 py-1.5 rounded bg-green text-white font-semibold hover:bg-green/80 transition-colors"
                  >
                    打开聚合事件列表
                  </button>
                )}
                {replayResult.historicalEvents.find(e => {
                  const klineDates = replayResult.klines.map(k => k.date);
                  const { isMapped } = mapEventToTradingDate(e.occurTime, klineDates);
                  return isMapped;
                }) && (
                  <button
                    data-testid="dev-open-mapped-event"
                    onClick={openMappedEvent}
                    className="text-xs px-3 py-1.5 rounded bg-orange text-white font-semibold hover:bg-orange/80 transition-colors"
                  >
                    打开非交易日映射事件详情
                  </button>
                )}
                {replayResult.keyNodes.length > 0 && (
                  <button
                    data-testid="dev-open-node"
                    onClick={openNode}
                    className="text-xs px-3 py-1.5 rounded bg-violet text-white font-semibold hover:bg-violet/80 transition-colors"
                  >
                    打开节点详情
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 第三阶段来源追溯截图辅助 */}
          <div className="mb-4 pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-blue">来源追溯截图辅助</span>
                <span className="text-xs text-muted">
                  第三阶段验收入口
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {replayResult.historicalEvents.find(e => {
                  return replayResult.sources.filter(s => e.sourceIds.includes(s.id)).length > 1;
                }) && (
                  <button
                    data-testid="dev-open-multi-source-event"
                    onClick={openMultiSourceEvent}
                    className="text-xs px-3 py-1.5 rounded bg-blue text-white font-semibold hover:bg-blue/80 transition-colors"
                  >
                    打开多来源事件
                  </button>
                )}
                {replayResult.historicalEvents.find(e => {
                  return replayResult.sources.filter(s => e.sourceIds.includes(s.id)).length === 1;
                }) && (
                  <button
                    data-testid="dev-open-single-source-event"
                    onClick={openSingleSourceEvent}
                    className="text-xs px-3 py-1.5 rounded bg-cyan text-white font-semibold hover:bg-cyan/80 transition-colors"
                  >
                    打开单来源事件
                  </button>
                )}
                {replayResult.historicalEvents.find(e => e.sourceIds.length === 0) && (
                  <button
                    data-testid="dev-open-no-source-event"
                    onClick={openNoSourceEvent}
                    className="text-xs px-3 py-1.5 rounded bg-orange text-white font-semibold hover:bg-orange/80 transition-colors"
                  >
                    打开无来源事件
                  </button>
                )}
                {replayResult.sources.length > 0 && (
                  <button
                    data-testid="dev-open-source-detail"
                    onClick={openSourceDetail}
                    className="text-xs px-3 py-1.5 rounded bg-violet text-white font-semibold hover:bg-violet/80 transition-colors"
                  >
                    打开来源详情
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 第四阶段未来事件日历截图辅助 */}
          <div className="pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-purple">未来事件日历截图辅助</span>
                <span className="text-xs text-muted">
                  第四阶段验收入口
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  data-testid="dev-open-future-calendar"
                  onClick={scrollToFutureCalendar}
                  className="text-xs px-3 py-1.5 rounded bg-purple text-white font-semibold hover:bg-purple/80 transition-colors"
                >
                  定位未来事件日历
                </button>
                {replayResult.futureEvents.find(e => e.dateCertainty === 'confirmed') && (
                  <button
                    data-testid="dev-open-confirmed-future-event"
                    onClick={openConfirmedFutureEvent}
                    className="text-xs px-3 py-1.5 rounded bg-green text-white font-semibold hover:bg-green/80 transition-colors"
                  >
                    打开已确认事件
                  </button>
                )}
                {replayResult.futureEvents.find(e => e.dateCertainty === 'estimated') && (
                  <button
                    data-testid="dev-open-estimated-future-event"
                    onClick={openEstimatedFutureEvent}
                    className="text-xs px-3 py-1.5 rounded bg-blue text-white font-semibold hover:bg-blue/80 transition-colors"
                  >
                    打开预计日期事件
                  </button>
                )}
                {replayResult.futureEvents.find(e => e.dateCertainty === 'tentative') && (
                  <button
                    data-testid="dev-open-tentative-future-event"
                    onClick={openTentativeFutureEvent}
                    className="text-xs px-3 py-1.5 rounded bg-orange text-white font-semibold hover:bg-orange/80 transition-colors"
                  >
                    打开日期待定事件
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* 第九阶段关键股价节点验收 - 始终可见，便于任意状态下加载样本 */}
      <div className="pt-3 border-t border-gray-200">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-cyan">关键股价节点验收</span>
            <span className="text-xs text-muted">
              第九阶段验收入口 · 固定样本（非真实行情）
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              data-testid="dev-key-node-sample-with-nodes"
              onClick={loadKeyNodeSampleWithNodes}
              className="text-xs px-3 py-1.5 rounded bg-cyan text-white font-semibold hover:bg-cyan/80 transition-colors"
            >
              加载有节点样本
            </button>
            <button
              data-testid="dev-key-node-sample-no-nodes"
              onClick={loadKeyNodeSampleNoNodes}
              className="text-xs px-3 py-1.5 rounded bg-gray-500 text-white font-semibold hover:bg-gray-500/80 transition-colors"
            >
              加载空状态样本
            </button>
            <button
              data-testid="dev-key-node-open-first-detail"
              onClick={openFirstKeyNodeDetail}
              className="text-xs px-3 py-1.5 rounded bg-violet text-white font-semibold hover:bg-violet/80 transition-colors"
            >
              打开第一个节点详情
            </button>
          </div>
        </div>
      </div>

      {/* 第十一阶段 A：用户未来事件验收入口 */}
      {pageState === 'success' && replayResult && (
        <div className="mb-4 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-green">第十一阶段 A</span>
              <span className="text-xs text-muted">用户未来事件日历验收</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              data-testid="dev-load-sample-user-events"
              onClick={props.onDevLoadSampleUserEvents}
              className="text-xs px-3 py-1.5 rounded bg-blue text-white font-semibold hover:bg-blue/80 transition-colors"
            >
              载入 600519 样本事件
            </button>
            <button
              data-testid="dev-open-user-event-form"
              onClick={props.onDevOpenUserEventForm}
              className="text-xs px-3 py-1.5 rounded bg-green text-white font-semibold hover:bg-green/80 transition-colors"
            >
              打开新增事件表单
            </button>
            <button
              data-testid="dev-clear-user-events"
              onClick={props.onDevClearUserEvents}
              className="text-xs px-3 py-1.5 rounded bg-red text-white font-semibold hover:bg-red/80 transition-colors"
            >
              清空当前股票事件
            </button>
          </div>
        </div>
      )}

      {/* 第十二阶段 A：用户复盘笔记验收入口 */}
      {pageState === 'success' && replayResult && (
        <div className="border-t border-line pt-3 mt-3">
          <div className="mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-violet">第十二阶段 A</span>
              <span className="text-xs text-muted">用户复盘笔记验收</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              data-testid="dev-load-sample-replay-note"
              onClick={props.onDevLoadSampleReplayNote}
              className="text-xs px-3 py-1.5 rounded bg-violet text-white font-semibold hover:bg-violet/80 transition-colors"
            >
              载入 600519 笔记样本
            </button>
            <button
              data-testid="dev-clear-replay-notes"
              onClick={props.onDevClearReplayNotes}
              className="text-xs px-3 py-1.5 rounded bg-red text-white font-semibold hover:bg-red/80 transition-colors"
            >
              清空当前股票笔记
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
