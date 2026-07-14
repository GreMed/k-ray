'use client';

// 第十五阶段 B1：静态真实历史复盘案例页面
//
// 基于真实历史行情和真实公开资料制作的静态案例页面。
// - 行情数据来自 BaoStock 一次获取的静态快照，页面运行时不请求行情接口
// - 事件资料均为可复核的真实公开资料，带原文链接
// - 复盘摘要为预生成，非实时 AI
// - 不请求任何实时行情、新闻或 AI 接口

import { useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import ProfessionalKLineChart from '@/components/ProfessionalKLineChart';
import TradingDayNotePanel from '@/components/TradingDayNotePanel';
import StockEventCalendar from '@/components/StockEventCalendar';
import StockEventForm from '@/components/StockEventForm';
import { CASE_LIST, getCaseByStockCode, getDefaultCase, DEFAULT_CASE_CODE } from '@/data/caseRegistry';
import { MarketKeyNode, StaticCaseNode, StaticHistoricalCase, StockEvent, StockEventCategory } from '@/types';
import { KEY_NODE_TYPE_META, formatVolume, getChangeColorClass } from '@/utils/keyNodeConfig';
import { loadNotes } from '@/services/replayNotes';
import { addUserStockEvent, updateUserStockEvent, deleteUserStockEvent, userEventToStockEvent } from '@/services/stockEvents';
import { loadUserEvents } from '@/services/userFutureEvents';
import { getCaseCalendarEvents } from '@/services/stockEvents/caseCalendar';

// 将 StaticCaseNode 转换为 MarketKeyNode，供 ProfessionalKLineChart 使用
function staticNodeToMarketKeyNode(node: StaticCaseNode, stockCode: string): MarketKeyNode {
  return {
    id: node.id,
    stockCode,
    date: node.date,
    type: node.nodeType,
    title: node.nodeTypeLabel,
    close: node.close,
    changePercent: node.changePercent,
    volume: node.volume,
    previousClose: null,
    previousVolume: null,
    volumeChangePercent: null,
    detailSummary: node.marketFact,
    evidenceLevel: 'market_data_only',
  };
}

// 资料类型颜色映射
const MATERIAL_TYPE_STYLES: Record<string, { badge: string; label: string }> = {
  policy: { badge: 'bg-blue/10 text-blue', label: '政策' },
  market: { badge: 'bg-orange/10 text-orange', label: '市场' },
  company: { badge: 'bg-violet/10 text-violet', label: '公司' },
  industry: { badge: 'bg-teal/10 text-teal', label: '行业' },
};

// 时间距离标签
function formatTimeDistance(days: number): string {
  if (days === 0) return '与节点同日';
  if (days < 0) return `节点前 ${Math.abs(days)} 天`;
  return `节点后 ${days} 天`;
}

// 第十六阶段里程碑三：外层 Suspense 包装（useSearchParams 需要 Suspense 边界）
export default function CoreReplayDemoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <CoreReplayDemoContent />
    </Suspense>
  );
}

function CoreReplayDemoContent() {
  // 第十六阶段里程碑三：支持多案例切换
  const searchParams = useSearchParams();
  const urlStockCode = searchParams?.get('stock') || DEFAULT_CASE_CODE;

  // 根据URL参数获取案例，非法参数回退到默认案例（渲染期间直接派生，避免 effect 中 setState）
  const foundCase = getCaseByStockCode(urlStockCode);
  const caseData: StaticHistoricalCase = foundCase || getDefaultCase();
  const invalidStockCode = foundCase ? null : urlStockCode;

  const { stockCode, stockName, market, klines, nodes, sourceList } = caseData;

  // 默认选中第一个节点
  const [selectedNodeId, setSelectedNodeId] = useState<string>(nodes[0]?.id || '');
  // 展开的事件详情 materialId
  const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null);
  // 第十六阶段：任意交易日笔记
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [noteDates, setNoteDates] = useState<string[]>([]);
  // 第十八阶段：静态案例日历事件（从案例内置事件 + 用户事件合并）
  const [userEvents, setUserEvents] = useState<StockEvent[]>([]);
  const [isEventFormOpen, setIsEventFormOpen] = useState(false);
  const [eventFormMode, setEventFormMode] = useState<'add' | 'edit'>('add');
  const [editingEvent, setEditingEvent] = useState<StockEvent | null>(null);

  // 构造 MarketKeyNode 数组供图表使用
  const marketKeyNodes = nodes.map((n) => staticNodeToMarketKeyNode(n, stockCode));

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];

  // 第十八阶段：统一节点选择函数 — 点击 marker 或顶部节点按钮时同时更新 selectedNodeId 和 selectedDate
  // 确保右侧当前节点日期与左下复盘笔记日期始终一致
  const handleNodeSelect = useCallback((node: MarketKeyNode) => {
    setSelectedNodeId(node.id);
    setSelectedDate(node.date);
  }, []);

  const handleMaterialToggle = useCallback((materialId: string) => {
    setExpandedMaterialId((prev) => (prev === materialId ? null : materialId));
  }, []);

  // 第十六阶段：K 线普通日期点击回调（点击非节点的普通交易日）
  const handleDateClick = useCallback((date: string) => {
    setSelectedDate(date);
  }, []);

  // 第十六阶段：刷新有笔记的日期列表
  const refreshNoteDates = useCallback((code: string) => {
    if (!code) {
      setNoteDates([]);
      return;
    }
    const notes = loadNotes(code);
    setNoteDates(notes.map(n => n.date));
  }, []);

  // 第十八阶段：刷新用户事件（只加载用户事件，案例内置事件通过 getCaseCalendarEvents 合并）
  const refreshUserEvents = useCallback((code: string) => {
    if (!code) {
      setUserEvents([]);
      return;
    }
    // 从 localStorage 加载用户事件并转换为 StockEvent
    // 只取用户事件，案例内置事件在合并时从 caseData.futureEvents 读取
    const userOnlyEvents = loadUserEvents(code).map(userEventToStockEvent);
    setUserEvents(userOnlyEvents);
  }, []);

  // 第十八阶段：合并案例内置事件 + 用户事件（直接计算，不使用 useMemo 避免 React Compiler 警告）
  const stockEvents = getCaseCalendarEvents(caseData, userEvents);

  // 案例切换时重置状态（使用 "adjust during render" 模式，避免 effect 中 setState）
  // 参考：https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [prevStockCode, setPrevStockCode] = useState(stockCode);
  const [isInitialized, setIsInitialized] = useState(false);
  if (stockCode !== prevStockCode) {
    setPrevStockCode(stockCode);
    setSelectedNodeId(nodes[0]?.id || '');
    setExpandedMaterialId(null);
    // 切换案例时必须清除上一只股票的 selectedDate
    setSelectedDate(null);
    refreshNoteDates(stockCode);
    refreshUserEvents(stockCode);
  }

  // 初始挂载时加载笔记和用户事件（确保默认直达案例时日历非空）
  // 使用 "adjust during render" 模式，避免 effect 中 setState 触发级联渲染
  if (!isInitialized) {
    setIsInitialized(true);
    refreshNoteDates(stockCode);
    refreshUserEvents(stockCode);
  }

  // 第十六阶段里程碑二：事件表单处理
  const handleAddEvent = useCallback(() => {
    setEventFormMode('add');
    setEditingEvent(null);
    setIsEventFormOpen(true);
  }, []);

  const handleEditEvent = useCallback((event: StockEvent) => {
    setEventFormMode('edit');
    setEditingEvent(event);
    setIsEventFormOpen(true);
  }, []);

  const handleSaveEvent = (data: {
    date: string;
    title: string;
    category: StockEventCategory;
    sourceUrl?: string;
    description: string;
  }) => {
    if (eventFormMode === 'edit' && editingEvent) {
      updateUserStockEvent(stockCode, editingEvent.id, data);
    } else {
      addUserStockEvent(stockCode, data);
    }
    refreshUserEvents(stockCode);
    setIsEventFormOpen(false);
    setEditingEvent(null);
  };

  const handleDeleteEvent = (event: StockEvent) => {
    deleteUserStockEvent(stockCode, event.id);
    refreshUserEvents(stockCode);
  };

  const handleCloseEventForm = useCallback(() => {
    setIsEventFormOpen(false);
    setEditingEvent(null);
  }, []);

  // 自定义图表统计文案
  const customStatsLabel = `共 ${klines.length} 根 K 线 · 关键股价节点 ${nodes.length} 个 · 可追溯资料 ${nodes.reduce((sum, n) => sum + n.materials.length, 0)} 条`;

  return (
    <div className="min-h-screen bg-paper" data-testid="core-replay-demo-page">
      {/* 顶部静态案例标识栏（紧凑） */}
      <div className="bg-blue/10 border-b border-blue/20" data-testid="static-banner">
        <div className="max-w-7xl mx-auto px-4 py-1.5">
          <p className="text-xs text-blue font-semibold flex items-center gap-2 flex-wrap">
            <span>静态历史案例 · 非实时更新</span>
            <span className="text-blue/70 font-normal">基于真实历史行情和可复核公开资料制作，内容不会实时更新。</span>
          </p>
        </div>
      </div>

      {/* 页头（紧凑） */}
      <header className="bg-white border-b border-line">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-lg md:text-xl font-black text-ink" data-testid="page-title">
              {stockName}（{stockCode}）静态历史复盘案例
            </h1>
            <p className="text-xs text-muted" data-testid="case-meta">
              {market} · 历史案例区间：{caseData.requestStartDate} 至 {caseData.requestEndDate}
              <span className="ml-2">· 静态快照生成于：{caseData.snapshotGeneratedAt} · 内容不会实时更新</span>
            </p>
          </div>
          <Link
            href="/"
            className="text-sm text-blue hover:text-blue/80 font-medium border border-blue/30 rounded-lg px-3 py-1.5 transition-colors"
            data-testid="back-to-home"
          >
            ← 返回查询真实行情
          </Link>
        </div>
      </header>

      {/* 第十六阶段里程碑三：案例切换器 */}
      <div className="bg-white border-b border-line" data-testid="case-switcher">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-muted shrink-0">案例库：</span>
            {CASE_LIST.map((c) => {
              const isActive = c.stockCode === stockCode;
              return (
                <Link
                  key={c.stockCode}
                  href={`/demo/core-replay?stock=${c.stockCode}`}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded border text-xs transition-all ${
                    isActive
                      ? 'border-blue bg-blue/5 text-ink font-semibold'
                      : 'border-line text-muted hover:border-blue/40 hover:text-ink'
                  }`}
                  data-testid={`case-tab-${c.stockCode}`}
                >
                  <span className="font-semibold">{c.stockName}</span>
                  <span className="text-muted/70">{c.stockCode}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* 非法案例参数提示 */}
      {invalidStockCode && (
        <div className="bg-orange/10 border-b border-orange/20" data-testid="invalid-case-warning">
          <div className="max-w-7xl mx-auto px-4 py-1.5">
            <p className="text-xs text-orange">
              未找到代码为 {invalidStockCode} 的案例，已显示默认案例。
            </p>
          </div>
        </div>
      )}

      {/* 主体：左右布局，桌面端 3:2，移动端纵向 */}
      <main className="max-w-7xl mx-auto px-4 py-3">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          {/* 左侧：节点切换入口 + K 线图 + 复盘笔记 + 未来日历 */}
          <div className="lg:col-span-3 space-y-2 min-w-0" data-testid="left-analysis-column">
            {/* 节点切换入口（紧凑横向布局，图表上方） */}
            <div className="bg-white border border-line rounded-lg p-2" data-testid="node-switcher">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-muted shrink-0">节点：</span>
                {nodes.map((node) => {
                  const meta = KEY_NODE_TYPE_META[node.nodeType];
                  const isSelected = node.id === selectedNodeId;
                  return (
                    <button
                      key={node.id}
                      onClick={() => handleNodeSelect(staticNodeToMarketKeyNode(node, stockCode))}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs transition-all ${
                        isSelected
                          ? 'border-blue bg-blue/5 text-ink font-semibold'
                          : 'border-line text-muted hover:border-blue/40 hover:text-ink'
                      }`}
                      data-testid={`node-tab-${node.id}`}
                    >
                      <span
                        className="inline-block w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span className="text-muted/80">{node.date}</span>
                      <span>·</span>
                      <span>{node.nodeTypeLabel}</span>
                      <span>·</span>
                      <span className={`font-bold ${getChangeColorClass(node.changePercent)}`}>
                        {node.changePercent > 0 ? '+' : ''}{node.changePercent.toFixed(2)}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* K 线图 — 单层卡片，由 ProfessionalKLineChart 自身渲染 */}
            {/* 移除外层卡片外壳，避免双层边框和重复标题 */}
            <div data-testid="chart-card">
              <ProfessionalKLineChart
                klines={klines}
                marketKeyNodes={marketKeyNodes}
                onMarketKeyNodeClick={handleNodeSelect}
                onDateClick={handleDateClick}
                noteMarkers={noteDates}
                stockCode={stockCode}
                stockName={stockName}
                marketMeta={{
                  source: 'baostock',
                  sourceLabel: 'BaoStock真实行情(前复权日线)·静态快照',
                  adjustment: 'qfq',
                  isRealMarketData: true,
                  fetchedAt: `${caseData.snapshotGeneratedAt}T00:00:00.000Z`,
                  ipoDate: '2018-06-11',
                }}
                customStatsLabel={customStatsLabel}
              />
            </div>

            {/* 复盘笔记 + 未来三个月大事日历 — 位于行情图正下方 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="dual-card-area">
              <div data-testid="note-card-wrapper">
                <TradingDayNotePanel
                  stockCode={stockCode}
                  stockName={stockName}
                  selectedDate={selectedDate}
                  klines={klines}
                  marketKeyNodes={marketKeyNodes}
                  onNoteChanged={() => refreshNoteDates(stockCode)}
                />
              </div>
              <div data-testid="calendar-card-wrapper">
                <StockEventCalendar
                  events={stockEvents}
                  onAddUserEvent={handleAddEvent}
                  onEditUserEvent={handleEditEvent}
                  onDeleteUserEvent={handleDeleteEvent}
                  referenceDate={caseData.calendarAsOfDate}
                  staticCaseLabel={`静态案例日历 · 数据截至${caseData.calendarAsOfDate} · 非实时更新`}
                />
              </div>
            </div>
          </div>

          {/* 右侧：当前节点摘要 → 复盘摘要 → 事件资料 → 分析链路 */}
          <div className="lg:col-span-2 space-y-2 min-w-0" data-testid="replay-detail-panel">
            {/* 当前节点摘要（紧凑） */}
            <div className="bg-white border border-line rounded-lg p-2 md:p-3">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded ${KEY_NODE_TYPE_META[selectedNode.nodeType].badgeClass}`}
                  data-testid="current-node-type"
                >
                  {selectedNode.nodeTypeLabel}
                </span>
                <span className="text-xs text-muted" data-testid="current-node-date">
                  {selectedNode.date}
                </span>
              </div>
              <div className="flex items-baseline gap-3 flex-wrap mb-1">
                <div>
                  <span className="text-xs text-muted">收盘</span>
                  <span className="text-base font-bold text-ink ml-1" data-testid="current-node-close">
                    {selectedNode.close.toFixed(2)}
                  </span>
                </div>
                <span
                  className={`text-base font-bold ${getChangeColorClass(selectedNode.changePercent)}`}
                  data-testid="current-node-change"
                >
                  {selectedNode.changePercent > 0 ? '+' : ''}{selectedNode.changePercent.toFixed(2)}%
                </span>
                <div>
                  <span className="text-xs text-muted">量</span>
                  <span className="text-xs font-semibold text-ink ml-1" data-testid="current-node-volume">
                    {formatVolume(selectedNode.volume)}
                  </span>
                </div>
              </div>
              {/* 申万三级行业数据 */}
              <div className="mt-1 pt-1 border-t border-line/40">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted">申万三级板块：</span>
                  {selectedNode.swLevel3.industryName && selectedNode.swLevel3.changePercent !== null ? (
                    <span className="text-xs font-semibold text-ink">
                      {selectedNode.swLevel3.industryName} {selectedNode.swLevel3.changePercent > 0 ? '+' : ''}{selectedNode.swLevel3.changePercent.toFixed(2)}%
                    </span>
                  ) : (
                    <span className="text-xs text-muted/70" data-testid="sw-level3-missing">
                      板块数据暂缺
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 静态复盘摘要 */}
            {selectedNode.replaySummary ? (
              <div className="bg-white border border-line rounded-lg p-2 md:p-3" data-testid="ai-replay-card">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-bold text-ink">基于公开资料预生成的复盘摘要</span>
                </div>
                <p className="text-xs text-muted mb-1.5">
                  非实时 AI 生成 · 仅总结下方已展示的真实资料
                </p>
                <p className="text-sm text-ink leading-relaxed" data-testid="ai-replay-summary">
                  {selectedNode.replaySummary.summary}
                </p>
              </div>
            ) : (
              <div className="bg-white border border-line rounded-lg p-2 md:p-3" data-testid="ai-replay-card">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-muted">复盘摘要</span>
                </div>
                <p className="text-xs text-muted" data-testid="no-replay-summary">
                  该节点暂无可追溯的时间临近资料，不生成复盘摘要。
                </p>
              </div>
            )}

            {/* 事件资料 */}
            <div className="bg-white border border-line rounded-lg p-2 md:p-3" data-testid="candidates-card">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-ink">
                    时间邻近的可追溯资料
                  </h3>
                  <span className="text-xs text-blue font-medium bg-blue/10 px-1.5 py-0.5 rounded" data-testid="candidates-static-label">
                    静态历史案例 · 非实时更新
                  </span>
                </div>
                <span className="text-xs text-muted">
                  可追溯资料 {selectedNode.materials.length} 条
                </span>
              </div>

              {selectedNode.materials.length === 0 ? (
                <div className="py-4 text-center" data-testid="empty-materials">
                  <p className="text-xs text-muted">该节点暂无可追溯的时间临近资料</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedNode.materials.map((material) => {
                    const typeStyle = MATERIAL_TYPE_STYLES[material.materialType] || MATERIAL_TYPE_STYLES.market;
                    const isExpanded = expandedMaterialId === material.id;
                    return (
                      <div
                        key={material.id}
                        className="p-2 bg-paper rounded-lg border border-line/60"
                        data-testid={`candidate-${material.id}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-semibold text-ink leading-snug">
                            {material.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${typeStyle.badge}`}>
                            {material.materialTypeLabel}
                          </span>
                          <span className="text-xs text-muted">{material.publishedAt}</span>
                          <span className="text-xs text-muted">·</span>
                          <span className="text-xs text-muted">{formatTimeDistance(material.timeDistanceDays)}</span>
                        </div>
                        <p className="text-xs text-muted leading-relaxed mb-1">
                          {material.excerpt}
                        </p>
                        <button
                          onClick={() => handleMaterialToggle(material.id)}
                          className="text-xs text-blue hover:text-blue/80 font-medium"
                          data-testid={`material-toggle-${material.id}`}
                        >
                          {isExpanded ? '收起详情' : '查看详情'}
                        </button>
                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t border-line/40 space-y-1.5" data-testid={`material-detail-${material.id}`}>
                            <div>
                              <span className="text-xs font-semibold text-muted">来源：</span>
                              <span className="text-xs text-ink">{material.sourceName}</span>
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-muted">发布时间：</span>
                              <span className="text-xs text-ink">{material.publishedAt}</span>
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-muted">与节点相隔：</span>
                              <span className="text-xs text-ink">{formatTimeDistance(material.timeDistanceDays)}</span>
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-muted">相关性说明：</span>
                              <span className="text-xs text-ink leading-relaxed">{material.relevanceNote}</span>
                            </div>
                            <a
                              href={material.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue hover:text-blue/80 font-medium mt-1"
                              data-testid={`material-source-link-${material.id}`}
                            >
                              查看原文 ↗
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 分析链路 */}
            <div className="bg-white border border-line rounded-lg p-2 md:p-3" data-testid="analysis-chain-card">
              <h3 className="text-sm font-bold text-ink mb-2">分析链路</h3>

              {/* 行情事实 */}
              <div className="mb-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-1 h-3 bg-blue rounded-full" />
                  <span className="text-xs font-bold text-blue">行情事实</span>
                </div>
                <p className="text-xs text-ink leading-relaxed pl-2.5" data-testid="market-fact">
                  {selectedNode.marketFact}
                </p>
              </div>

              {/* 可能相关的观察线索 */}
              <div className="mb-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-1 h-3 bg-violet rounded-full" />
                  <span className="text-xs font-bold text-violet">可能相关的观察线索</span>
                </div>
                <ul className="space-y-0.5 pl-2.5" data-testid="observation-clues">
                  {selectedNode.observationClues.map((clue, idx) => (
                    <li key={idx} className="text-xs text-ink leading-relaxed flex gap-1.5">
                      <span className="text-violet/60 mt-0.5">•</span>
                      <span>{clue}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 尚未确认的部分 */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-1 h-3 bg-orange rounded-full" />
                  <span className="text-xs font-bold text-orange">尚未确认的部分</span>
                </div>
                <ul className="space-y-0.5 pl-2.5" data-testid="unconfirmed-parts">
                  {selectedNode.unconfirmedParts.map((part, idx) => (
                    <li key={idx} className="text-xs text-muted leading-relaxed flex gap-1.5">
                      <span className="text-orange/60 mt-0.5">•</span>
                      <span>{part}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 来源清单 */}
            <div className="bg-white border border-line rounded-lg p-2 md:p-3" data-testid="source-list-card">
              <h3 className="text-sm font-bold text-ink mb-2">来源清单</h3>
              <div className="space-y-1">
                {sourceList.map((src) => (
                  <div key={src.id} className="text-xs">
                    <span className="text-muted">{src.sourceName}：</span>
                    <a
                      href={src.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue hover:text-blue/80 break-all"
                    >
                      {src.title}
                    </a>
                    <span className="text-muted ml-1">（{src.publishedAt}）</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 页脚 */}
      <footer className="bg-white border-t border-line mt-4">
        <div className="max-w-7xl mx-auto px-4 py-2.5">
          <p className="text-xs text-muted text-center" data-testid="demo-footer-note">
            静态历史案例 · 非实时更新 · 行情数据来自BaoStock前复权日线快照，事件资料均可追溯。
            <Link href="/" className="text-blue hover:text-blue/80 ml-1">返回查询真实行情</Link>
          </p>
        </div>
      </footer>

      {/* 第十六阶段里程碑二：用户事件新增/编辑表单 */}
      <StockEventForm
        key={isEventFormOpen ? `${eventFormMode}-${editingEvent?.id || 'new'}` : 'closed'}
        isOpen={isEventFormOpen}
        mode={eventFormMode}
        event={editingEvent}
        stockCode={stockCode}
        onSave={handleSaveEvent}
        onCancel={handleCloseEventForm}
      />
    </div>
  );
}
