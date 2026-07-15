'use client';

import { useState, useMemo, useCallback, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { Stock, ReplayResult, PageState, HistoricalEvent, KeyNode, FutureEvent, EventSource, MarketKeyNode, StockEvent, StockEventCategory } from '@/types';
import { simulateReplay, DEMO_STOCK, DEMO_START_DATE, DEMO_END_DATE } from '@/utils/devHelpers';
import { mapEventToTradingDate, type AggregatedEventGroup } from '@/utils/eventAggregation';
import { detectKeyNodes } from '@/utils/keyNodes';
import Header from '@/components/Header';
import StockSearch from '@/components/StockSearch';
import DateQuickOptions from '@/components/DateQuickOptions';
import ProfessionalKLineChart from '@/components/ProfessionalKLineChart';
import EventLegend from '@/components/EventLegend';
import EventDetailDrawer from '@/components/EventDetailDrawer';
import EventListModal from '@/components/EventListModal';
import NodeDetailDrawer from '@/components/NodeDetailDrawer';
import KeyNodeList from '@/components/KeyNodeList';
import MarketKeyNodeDrawer from '@/components/MarketKeyNodeDrawer';
import NodeEventDrawer from '@/components/NodeEventDrawer';
import FutureEventDetailDrawer from '@/components/FutureEventDetailDrawer';
import StockEventCalendar from '@/components/StockEventCalendar';
import StockEventForm from '@/components/StockEventForm';
import RiskWarning from '@/components/RiskWarning';
import DevToolsPanel from '@/components/DevToolsPanel';
import TradingDayNotePanel from '@/components/TradingDayNotePanel';
import { loadStockEvents, addUserStockEvent, updateUserStockEvent, deleteUserStockEvent } from '@/services/stockEvents';
import { addUserEvent, clearUserEvents } from '@/services/userFutureEvents';
import { addNote, clearNotes, loadNotes } from '@/services/replayNotes';
import { formatStockDisplayName, detectMarket } from '@/utils/stockCode';
import { CASE_LIST } from '@/data/caseRegistry';
import WatchlistButton from '@/components/WatchlistButton';
import { useSearchParams, useRouter } from 'next/navigation';

// 第十五阶段修复：日期初始值改为组件内 useEffect 计算（见下方）
// 原模块级 new Date() 在 SSR/CSR 各执行一次，跨日或时区差异会导致
// date input 的 max/value 属性 hydration mismatch

// 第十四阶段 A1 收口：统一处理错误文案尾部标点，避免拼接后出现 。。 ！！ 。！ 等双标点
function normalizeTrailingPunctuation(s: string): string {
  return s.replace(/[。.！!]+$/, '');
}

// 第二十阶段 A：useSearchParams 需要 Suspense 边界
export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const [pageState, setPageState] = useState<PageState>('initial');
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  // 初始为空字符串，确保 SSR 与客户端首次渲染一致；客户端挂载后由 useEffect 填充实际日期
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [todayStr, setTodayStr] = useState('');
  const [replayResult, setReplayResult] = useState<ReplayResult | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<HistoricalEvent | null>(null);
  const [selectedNode, setSelectedNode] = useState<KeyNode | null>(null);
  const [selectedEventGroup, setSelectedEventGroup] = useState<AggregatedEventGroup | null>(null);
  const [isEventDrawerOpen, setIsEventDrawerOpen] = useState(false);
  const [isEventListOpen, setIsEventListOpen] = useState(false);
  const [isNodeDrawerOpen, setIsNodeDrawerOpen] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);
  // 行情查询错误信息（用户可读）
  const [marketDataError, setMarketDataError] = useState<string | null>(null);
  // 标记是否从聚合列表进入事件详情
  const [isFromGroup, setIsFromGroup] = useState(false);
  // 开发环境：自动打开来源详情的 sourceId（用于截图辅助直接打开来源弹窗）
  const [devAutoOpenSourceId, setDevAutoOpenSourceId] = useState<string | null>(null);
  // 未来事件详情
  const [selectedFutureEvent, setSelectedFutureEvent] = useState<FutureEvent | null>(null);
  const [isFutureEventDrawerOpen, setIsFutureEventDrawerOpen] = useState(false);
  // 是否正在加载中（防止重复提交）
  const [isLoading, setIsLoading] = useState(false);
  // 即时请求锁：同一事件循环内的连续点击也只触发一次请求
  const requestInFlightRef = useRef(false);
  // 来源详情弹窗状态（提升到父组件以支持嵌套 Escape 关闭）
  const [selectedSource, setSelectedSource] = useState<EventSource | null>(null);
  // 记录滚动位置，用于抽屉关闭后恢复
  const savedScrollY = useRef(0);
  // 普通用户始终使用真实行情（第十四阶段 A1：移除复选框，Mock 模式仅通过开发面板访问）
  // 第九阶段：选中的关键节点（用于详情抽屉与列表高亮）
  const [selectedMarketKeyNode, setSelectedMarketKeyNode] = useState<MarketKeyNode | null>(null);
  const [isMarketKeyNodeDrawerOpen, setIsMarketKeyNodeDrawerOpen] = useState(false);
  // 第十阶段 B：节点—事件候选抽屉（点击关键节点时打开，显示节点信息+事件候选）
  const [isNodeEventDrawerOpen, setIsNodeEventDrawerOpen] = useState(false);
  // 第九阶段：开发验收样本标记（仅开发环境，标注当前展示的是开发验收样本而非真实行情）
  const [devKeyNodeSampleMode, setDevKeyNodeSampleMode] = useState<'none' | 'withNodes' | 'noNodes'>('none');
  // 第十六阶段：统一股票事件（系统 + 用户）
  const [stockEvents, setStockEvents] = useState<StockEvent[]>([]);
  const [isUserEventFormOpen, setIsUserEventFormOpen] = useState(false);
  const [userEventFormMode, setUserEventFormMode] = useState<'add' | 'edit'>('add');
  const [editingStockEvent, setEditingStockEvent] = useState<StockEvent | null>(null);
  // 第十二阶段 A：用户复盘笔记刷新触发器（开发工具修改笔记后递增）
  const [replayNoteRefreshKey, setReplayNoteRefreshKey] = useState(0);
  // 第十六阶段：任意交易日笔记
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [noteDates, setNoteDates] = useState<string[]>([]);

  // 第二十阶段 A：从"我的自选"跳转过来时，通过 query 参数自动填入股票代码和名称
  // 验收修复（第二轮）：URL 同步 effect 只依赖 URL 参数本身（routeKey），绝不依赖 selectedStock。
  // 验收修复（第三轮）：Stock.name 保持空字符串（不写入"名称获取中"），名称自动同步交给
  // StockSearch 的 stock-info 查询。"名称获取中"/"名称暂未取得"仅为 UI 展示文案。
  // 非法 URL（detectMarket 返回 null 或市场不匹配）时清理参数并回到初始状态。
  const searchParams = useSearchParams();
  const router = useRouter();
  // routeKey 由 URL 参数组成，仅在 URL 真实变化时才变化
  const routeKey = `${searchParams.get('stock') || ''}|${searchParams.get('market') || ''}|${searchParams.get('name') || ''}`;
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const stockParam = searchParams.get('stock');
    const marketParam = searchParams.get('market');
    const nameParam = searchParams.get('name');
    // stock 和 market 为必要参数；name 可为空
    if (!stockParam || !marketParam) return;

    // 统一 URL 股票校验：代码必须能被 detectMarket 识别，且市场必须一致
    // detectMarket 返回 null（非 6/0/3 开头）时，不接受该 URL 股票
    const detected = detectMarket(stockParam);
    if (detected === null) {
      // 非法 URL：清理参数，回到初始状态，不展示旧结果
      setSelectedStock(null);
      setReplayResult(null);
      setPageState('initial');
      router.replace('/');
      return;
    }
    // 识别出的市场必须与 market 参数一致
    if (detected !== marketParam) {
      setSelectedStock(null);
      setReplayResult(null);
      setPageState('initial');
      router.replace('/');
      return;
    }

    // Stock.name：URL 提供 name 时使用真实名称，否则保持空字符串
    // "名称获取中"/"名称暂未取得"仅为 UI 文案，不写入 Stock.name
    const stockName = (nameParam && nameParam.trim()) || '';

    // 如果 URL 指向的就是当前已选中的股票：
    // - 同一股票 name 晚到同步：仅更新名称，不清空行情，不重置页面
    if (selectedStock && selectedStock.code === stockParam && selectedStock.market === marketParam) {
      // URL 补充了真实 name 且当前 name 为空或不同，只同步名称
      if (stockName && selectedStock.name !== stockName) {
        setSelectedStock({ ...selectedStock, name: stockName });
      }
      return;
    }

    // 切换股票：立即清空所有与上一只股票相关的状态
    setSelectedStock({
      id: stockParam,
      code: stockParam,
      name: stockName,
      market: marketParam,
    });
    // 清空行情结果和页面状态，返回"已选中、等待查询"状态
    setReplayResult(null);
    setPageState('initial');
    setMarketDataError(null);
    // 清空所有抽屉、弹窗、选中状态
    setSelectedEvent(null);
    setSelectedNode(null);
    setSelectedEventGroup(null);
    setIsEventDrawerOpen(false);
    setIsEventListOpen(false);
    setIsNodeDrawerOpen(false);
    setSelectedFutureEvent(null);
    setIsFutureEventDrawerOpen(false);
    setDevAutoOpenSourceId(null);
    setSelectedSource(null);
    setSelectedMarketKeyNode(null);
    setIsMarketKeyNodeDrawerOpen(false);
    setIsNodeEventDrawerOpen(false);
    setDevKeyNodeSampleMode('none');
    setIsUserEventFormOpen(false);
    setEditingStockEvent(null);
    setStockEvents([]);
    setSelectedDate(null);
    setNoteDates([]);
    // 注意：依赖项只有 routeKey，不含 selectedStock。
    // selectedStock 的读取仅用于"同一股票跳过"的幂等判断，不会形成循环。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 动态基准日：客户端挂载后为今天，初始空字符串避免 hydration mismatch
  const referenceEndDate = todayStr;

  // 客户端挂载后计算实际日期（近3个月），避免 SSR/CSR 日期不一致
  // 这是 SSR 应用中获取客户端时间的标准模式：SSR 与首次 CSR 都用空字符串，挂载后填充实际值
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsAgoDate = threeMonthsAgo.toISOString().slice(0, 10);
    setTodayStr(today);
    setEndDate(today);
    setStartDate(threeMonthsAgoDate);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 第九阶段：基于行情数据派生关键股价节点（useMemo 派生，避免 effect 中 setState）
  const marketKeyNodes = useMemo<MarketKeyNode[]>(() => {
    if (pageState !== 'success' || !replayResult || replayResult.klines.length === 0) {
      return [];
    }
    return detectKeyNodes(replayResult.klines, replayResult.stock.code);
  }, [replayResult, pageState]);

  // 动态文案：真实模式用"查询"，Mock 模式保留"复盘"
  const actionLabel = '查询行情';
  const loadingLabel = '查询行情中...';
  const resultTitle = '日K查询结果';
  const resetLabel = '重新查询';

  // 按事件日期排序、相同日期按ID排序的事件列表（用于导航）
  const sortedEvents = useMemo(() => {
    if (!replayResult) return [];
    return [...replayResult.historicalEvents].sort((a, b) => {
      const dateDiff = new Date(a.occurTime).getTime() - new Date(b.occurTime).getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.id.localeCompare(b.id);
    });
  }, [replayResult]);

  // 当前事件序号（从1开始）
  const currentEventIndex = useMemo(() => {
    if (!selectedEvent || sortedEvents.length === 0) return undefined;
    const idx = sortedEvents.findIndex(e => e.id === selectedEvent.id);
    return idx >= 0 ? idx + 1 : undefined;
  }, [selectedEvent, sortedEvents]);

  // 当前事件对应的来源列表（支持多来源）
  const currentSources = useMemo(() => {
    if (!selectedEvent || !replayResult) return [];
    return replayResult.sources.filter(s => selectedEvent.sourceIds.includes(s.id));
  }, [selectedEvent, replayResult]);

  // 当前事件对应的关键节点
  const currentRelatedNode = useMemo(() => {
    if (!selectedEvent || !replayResult) return null;
    if (!selectedEvent.relatedNodeId) return null;
    return replayResult.keyNodes.find(n => n.id === selectedEvent.relatedNodeId) || null;
  }, [selectedEvent, replayResult]);

  // 当前事件的日期映射信息（用于详情页展示）
  const currentEventDateMapping = useMemo(() => {
    if (!selectedEvent || !replayResult || replayResult.klines.length === 0) return null;
    const klineDates = replayResult.klines.map(k => k.date);
    const { mappedDate, isMapped } = mapEventToTradingDate(selectedEvent.occurTime, klineDates);
    if (!isMapped) return null;
    return { isMapped: true, mappedDate };
  }, [selectedEvent, replayResult]);

  // 验证日期
  const validateDates = useCallback((start: string, end: string): boolean => {
    if (!start || !end) {
      setDateError('请选择完整的开始和结束日期');
      return false;
    }
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    if (startMs > endMs) {
      setDateError('开始日期不能晚于结束日期，请调整后再试');
      return false;
    }
    setDateError(null);
    return true;
  }, []);

  // 获取真实K线（实验性功能，调用服务端API，服务端模式决定行为）
  const fetchRealKLines = useCallback(async (stock: Stock, start: string, end: string) => {
    const params = new URLSearchParams({
      stockCode: stock.code,
      market: stock.market,
      startDate: start,
      endDate: end,
    });
    const res = await fetch(`/api/market/klines?${params.toString()}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `行情服务请求失败 (${res.status})`);
    }
    return res.json();
  }, []);

  // 第十六阶段：加载统一股票事件（系统 + 用户）
  const refreshStockEvents = useCallback((stockCode: string) => {
    if (!stockCode) {
      setStockEvents([]);
      return;
    }
    setStockEvents(loadStockEvents(stockCode));
  }, []);

  // 第十六阶段：刷新有笔记的日期列表（用于 K 线 marker）
  const refreshNoteDates = useCallback((stockCode: string) => {
    if (!stockCode) {
      setNoteDates([]);
      return;
    }
    const notes = loadNotes(stockCode);
    setNoteDates(notes.map(n => n.date));
  }, []);

  // 第十六阶段：K 线普通日期点击回调
  const handleDateClick = useCallback((date: string) => {
    setSelectedDate(date);
  }, []);

  // 执行复盘查询（共用）
  const executeReplay = useCallback(async (stockId: string, start: string, end: string) => {
    if (isLoading || requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setIsLoading(true);
    setPageState('loading');
    setReplayResult(null);
    setMarketDataError(null);
    // 清理所有选中状态，防止旧数据串位
    setSelectedEvent(null);
    setSelectedNode(null);
    setSelectedEventGroup(null);
    setIsEventDrawerOpen(false);
    setIsEventListOpen(false);
    setIsNodeDrawerOpen(false);
    setSelectedFutureEvent(null);
    setIsFutureEventDrawerOpen(false);
    setDevAutoOpenSourceId(null);
    setSelectedSource(null);
    // 第九阶段：清理关键节点选中状态（marketKeyNodes 由 useMemo 派生，无需手动清理）
    setSelectedMarketKeyNode(null);
    setIsMarketKeyNodeDrawerOpen(false);
    setIsNodeEventDrawerOpen(false);
    setDevKeyNodeSampleMode('none');
    // 第十一阶段 A：清理用户事件状态
    setIsUserEventFormOpen(false);
    setEditingStockEvent(null);
    setStockEvents([]);
    // 第十六阶段：清理笔记选中状态
    setSelectedDate(null);
    setNoteDates([]);

    try {
      if (selectedStock) {
        // 真实行情模式：先请求API，不依赖 simulateReplay
        const realData = await fetchRealKLines(selectedStock, start, end);

        // 第十四阶段 A1 封板修复：普通用户查询接口如果返回 meta.isRealMarketData !== true，
        // 不得进入成功结果页。显示通俗错误，不展示 Mock K 线作为普通查询结果。
        // 第十四阶段 A1 收口：不保存 marketMeta，避免页脚误判为 fallback 成功结果。
        if (!realData.meta || realData.meta.isRealMarketData !== true) {
          setPageState('error');
          setMarketDataError(
            realData.meta?.fallbackReason
              || '真实行情服务暂时不可用，请稍后重试。'
          );
          setReplayResult(null);
          return;
        }

        if (!realData.klines || realData.klines.length === 0) {
          // 真实成功但 0 根 K 线 → 空状态（"所选区间暂无交易数据"）
          setPageState('empty');
          setReplayResult({
            stock: realData.stock || selectedStock,
            klines: [],
            keyNodes: [],
            historicalEvents: [],
            sources: [],
            futureEvents: [],
            marketMeta: realData.meta,
          });
          return;
        }

        // 构造 ReplayResult
        // 第九阶段修复：真实行情模式下，无论股票代码是什么，
        // historicalEvents、旧 keyNodes、sources、futureEvents 均为空。
        // 真实行情页只展示：真实日 K + 第九阶段 marketKeyNodes + 新闻候选说明文案。
        // Mock 事件/节点/来源/未来日历仅在 Mock 模式下保留。
        const finalResult: ReplayResult = {
          stock: realData.stock || selectedStock,
          klines: realData.klines,
          keyNodes: [],
          historicalEvents: [],
          sources: [],
          futureEvents: [],
          marketMeta: realData.meta,
        };

        setPageState('success');
        setReplayResult(finalResult);
        // 第十一阶段 A：加载用户录入的未来事件
        refreshStockEvents(realData.stock?.code || selectedStock.code);
        // 第十六阶段：加载有笔记的日期
        refreshNoteDates(realData.stock?.code || selectedStock.code);
      } else {
        // Mock 模式：使用现有 simulateReplay
        const { state, result } = await simulateReplay(stockId, start, end, 2000);
        setPageState(state);
        if (result) {
          setReplayResult(result);
          // 第十一阶段 A：加载用户录入的未来事件
          refreshStockEvents(result.stock.code);
          // 第十六阶段：加载有笔记的日期
          refreshNoteDates(result.stock.code);
        }
      }
    } catch (err) {
      setReplayResult(null);
      setMarketDataError(err instanceof Error ? err.message : '行情查询失败，请稍后重试');
      setPageState('error');
    } finally {
      setIsLoading(false);
      requestInFlightRef.current = false;
    }
  }, [isLoading, selectedStock, fetchRealKLines, refreshStockEvents, refreshNoteDates]);

  // 点击查询行情
  const handleStartReplay = async () => {
    if (!selectedStock) return;
    if (!validateDates(startDate, endDate)) {
      return;
    }
    await executeReplay(selectedStock.id, startDate, endDate);
  };

  // 点击单个事件 - 打开详情抽屉
  const handleEventClick = useCallback((event: HistoricalEvent) => {
    setSelectedEvent(event);
    setIsEventDrawerOpen(true);
    setIsEventListOpen(false);
    setIsFromGroup(false);
  }, []);

  // 点击事件组 - 打开列表弹窗
  const handleEventGroupClick = useCallback((group: AggregatedEventGroup) => {
    setSelectedEventGroup(group);
    setIsEventListOpen(true);
    setIsEventDrawerOpen(false);
  }, []);

  // 从事件列表选择事件
  const handleSelectEventFromList = useCallback((event: HistoricalEvent) => {
    setSelectedEvent(event);
    setIsEventDrawerOpen(true);
    setIsEventListOpen(false);
    setIsFromGroup(true);
  }, []);

  // 点击节点 - 打开节点详情
  const handleNodeClick = useCallback((node: KeyNode) => {
    setSelectedNode(node);
    setIsNodeDrawerOpen(true);
  }, []);

  // 第九阶段 / 第十阶段 B：点击关键股价节点 - 打开事件候选抽屉
  // 第十阶段 B 将原 MarketKeyNodeDrawer 替换为 NodeEventDrawer（包含节点信息+事件候选）
  // 第十八阶段：同时同步 selectedDate，确保右侧节点日期与左下复盘笔记日期一致
  const handleMarketKeyNodeClick = useCallback((node: MarketKeyNode) => {
    setSelectedMarketKeyNode(node);
    setSelectedDate(node.date);
    setIsNodeEventDrawerOpen(true);
  }, []);

  // 第十阶段 B：关闭节点事件候选抽屉
  const handleCloseNodeEventDrawer = useCallback(() => {
    setIsNodeEventDrawerOpen(false);
    setSelectedMarketKeyNode(null);
  }, []);

  // 第九阶段：关闭关键节点详情抽屉（保留用于 DevToolsPanel 直接打开）
  const handleCloseMarketKeyNodeDrawer = useCallback(() => {
    setIsMarketKeyNodeDrawerOpen(false);
    setSelectedMarketKeyNode(null);
  }, []);

  // 事件导航 - 上一条
  const handleNavigatePrev = useCallback(() => {
    if (!currentEventIndex || currentEventIndex <= 1) return;
    const prevEvent = sortedEvents[currentEventIndex - 2];
    setSelectedEvent(prevEvent);
  }, [currentEventIndex, sortedEvents]);

  // 事件导航 - 下一条
  const handleNavigateNext = useCallback(() => {
    if (!currentEventIndex || currentEventIndex >= sortedEvents.length) return;
    const nextEvent = sortedEvents[currentEventIndex];
    setSelectedEvent(nextEvent);
  }, [currentEventIndex, sortedEvents]);

  // 返回事件列表
  const handleBackToList = useCallback(() => {
    setIsEventDrawerOpen(false);
    setIsEventListOpen(true);
  }, []);

  // 关闭事件详情抽屉
  const handleCloseEventDrawer = useCallback(() => {
    setIsEventDrawerOpen(false);
    setSelectedEvent(null);
    setIsFromGroup(false);
    setDevAutoOpenSourceId(null);
    setSelectedSource(null);
  }, []);

  // 关闭事件列表弹窗
  const handleCloseEventList = useCallback(() => {
    setIsEventListOpen(false);
    setSelectedEventGroup(null);
  }, []);

  // 关闭节点详情抽屉
  const handleCloseNodeDrawer = useCallback(() => {
    setIsNodeDrawerOpen(false);
    setSelectedNode(null);
  }, []);

  // 关闭未来事件详情抽屉
  const handleCloseFutureEventDrawer = useCallback(() => {
    setIsFutureEventDrawerOpen(false);
    setSelectedFutureEvent(null);
  }, []);

  // 打开新增事件表单
  const handleAddUserEvent = useCallback(() => {
    setUserEventFormMode('add');
    setEditingStockEvent(null);
    setIsUserEventFormOpen(true);
  }, []);

  // 打开编辑事件表单
  const handleEditUserEvent = useCallback((event: StockEvent) => {
    setUserEventFormMode('edit');
    setEditingStockEvent(event);
    setIsUserEventFormOpen(true);
  }, []);

  // 保存事件（新增或编辑）
  const handleSaveStockEvent = useCallback((data: {
    date: string;
    title: string;
    category: StockEventCategory;
    sourceUrl?: string;
    description: string;
  }) => {
    const stockCode = replayResult?.stock.code || selectedStock?.code || '';
    if (!stockCode) return;

    if (userEventFormMode === 'edit' && editingStockEvent) {
      updateUserStockEvent(stockCode, editingStockEvent.id, data);
    } else {
      addUserStockEvent(stockCode, data);
    }
    refreshStockEvents(stockCode);
    setIsUserEventFormOpen(false);
    setEditingStockEvent(null);
  }, [replayResult, selectedStock, userEventFormMode, editingStockEvent, refreshStockEvents]);

  // 删除事件
  const handleDeleteUserEvent = useCallback((event: StockEvent) => {
    const stockCode = replayResult?.stock.code || selectedStock?.code || '';
    if (!stockCode) return;
    deleteUserStockEvent(stockCode, event.id);
    refreshStockEvents(stockCode);
  }, [replayResult, selectedStock, refreshStockEvents]);

  // 关闭表单
  const handleCloseUserEventForm = useCallback(() => {
    setIsUserEventFormOpen(false);
    setEditingStockEvent(null);
  }, []);

  // 开发环境：清空当前股票的用户事件
  const handleDevClearUserEvents = useCallback(() => {
    const stockCode = replayResult?.stock.code || selectedStock?.code || '';
    if (!stockCode) return;
    clearUserEvents(stockCode);
    refreshStockEvents(stockCode);
  }, [replayResult, selectedStock, refreshStockEvents]);

  // 开发环境：为 600519 载入 2 条样本
  const handleDevLoadSampleUserEvents = useCallback(() => {
    const stockCode = '600519';
    clearUserEvents(stockCode);
    const futureDate1 = new Date();
    futureDate1.setDate(futureDate1.getDate() + 30);
    const futureDate2 = new Date();
    futureDate2.setDate(futureDate2.getDate() + 90);
    addUserEvent(stockCode, {
      date: futureDate1.toISOString().slice(0, 10),
      title: '2024年三季度业绩预告',
      category: 'performance',
      originalUrl: 'https://example.com/earnings-preview',
      note: '关注营收增速与毛利率变化',
    });
    addUserEvent(stockCode, {
      date: futureDate2.toISOString().slice(0, 10),
      title: '年度股东大会',
      category: 'shareholder',
      note: '',
    });
    if (replayResult?.stock.code === '600519' || selectedStock?.code === '600519') {
      refreshStockEvents(stockCode);
    }
  }, [replayResult, selectedStock, refreshStockEvents]);

  // 第十二阶段 A：开发环境 — 为 600519 指定关键节点载入一条用户笔记样本
  const handleDevLoadSampleReplayNote = useCallback(() => {
    const stockCode = '600519';
    clearNotes(stockCode);
    // 使用第一个关键节点（如存在），否则使用预定义节点信息
    const targetNode = marketKeyNodes.length > 0 ? marketKeyNodes[0] : null;
    if (targetNode) {
      addNote(stockCode, {
        date: targetNode.date,
        nodeId: targetNode.id,
        nodeType: targetNode.type,
        changePercent: targetNode.changePercent,
        content: '这是一个样本笔记，记录我对该关键节点的观察。当日成交量明显放大，涨跌幅显著，值得关注后续走势延续性。',
      });
    } else {
      // 无可用节点时，使用预定义节点信息
      addNote(stockCode, {
        date: '2024-01-10',
        nodeId: 'significant_up:600519:2024-01-10',
        nodeType: 'significant_up',
        changePercent: 6.5,
        content: '这是一个样本笔记，记录我对该关键节点的观察。当日成交量明显放大，涨跌幅显著，值得关注后续走势延续性。',
      });
    }
    setReplayNoteRefreshKey((k) => k + 1);
  }, [marketKeyNodes]);

  // 第十二阶段 A：开发环境 — 清空当前股票的全部节点笔记
  const handleDevClearReplayNotes = useCallback(() => {
    const stockCode = replayResult?.stock.code || selectedStock?.code || '';
    if (!stockCode) return;
    clearNotes(stockCode);
    setReplayNoteRefreshKey((k) => k + 1);
  }, [replayResult, selectedStock]);

  // 重置到初始状态
  // 第二十阶段 A 验收修复（第二轮）：同步清除 URL 中的自选参数，
  // 防止 routeKey 变化前旧 URL 把股票 B 重新选回。
  const handleReset = useCallback(() => {
    setPageState('initial');
    setSelectedStock(null);
    const today = new Date().toISOString().slice(0, 10);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    setStartDate(threeMonthsAgo.toISOString().slice(0, 10));
    setEndDate(today);
    setReplayResult(null);
    setDateError(null);
    setMarketDataError(null);
    setIsEventDrawerOpen(false);
    setIsEventListOpen(false);
    setIsNodeDrawerOpen(false);
    setSelectedEvent(null);
    setSelectedEventGroup(null);
    setSelectedNode(null);
    setIsFromGroup(false);
    setSelectedFutureEvent(null);
    setIsFutureEventDrawerOpen(false);
    setIsLoading(false);
    setDevAutoOpenSourceId(null);
    setSelectedSource(null);
    // 第九阶段：清理关键节点选中状态（marketKeyNodes 由 useMemo 派生，无需手动清理）
    setSelectedMarketKeyNode(null);
    setIsMarketKeyNodeDrawerOpen(false);
    setIsNodeEventDrawerOpen(false);
    setDevKeyNodeSampleMode('none');
    // 第十一阶段 A：清理用户事件状态
    setIsUserEventFormOpen(false);
    setEditingStockEvent(null);
    setStockEvents([]);
    // 清除 URL 中的自选参数，避免旧 URL 重新覆盖
    // 检查当前 searchParams 是否包含 stock 参数（来自自选跳转）
    if (searchParams.get('stock')) {
      router.replace('/');
    }
  }, [router, searchParams]);

  // 日期变化处理
  const handleStartDateChange = useCallback((date: string) => {
    setStartDate(date);
    if (dateError) {
      validateDates(date, endDate);
    }
  }, [dateError, endDate, validateDates]);

  const handleEndDateChange = useCallback((date: string) => {
    setEndDate(date);
    if (dateError) {
      validateDates(startDate, date);
    }
  }, [dateError, startDate, validateDates]);

  // 快捷日期选择 - 真实刷新复盘
  const handleQuickDateSelect = useCallback((start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    setDateError(null);
    // 如果已有股票选择，自动刷新复盘
    if (selectedStock && pageState === 'success') {
      executeReplay(selectedStock.id, start, end);
    }
  }, [selectedStock, pageState, executeReplay]);

  // 跟踪最新的 replayResult，供 handleSelectStock 异步回调读取
  const replayResultRef = useRef<ReplayResult | null>(replayResult);
  useEffect(() => {
    replayResultRef.current = replayResult;
  }, [replayResult]);

  // 股票选择变化
  // 第二十阶段 A 验收修复（第二轮）：
  // - 用户清除股票（stock === null）时，清理 URL 中旧的自选参数
  // - 用户手动选择与 URL 不同的股票 C 时，清理 URL 中旧的股票 B 参数
  // - 同一股票名称晚到同步（code 相同）时，不清理 URL，不重复清空状态
  const handleSelectStock = useCallback((stock: Stock | null) => {
    setSelectedStock(stock);
    // 名称晚到同步：若 replayResult 已存在且 code 匹配，同步更新名称
    if (stock && stock.name) {
      const current = replayResultRef.current;
      if (current && current.stock.code === stock.code && current.stock.name !== stock.name) {
        setReplayResult({
          ...current,
          stock: { ...current.stock, name: stock.name },
        });
      }
    }
    // 清理 URL 中旧的自选参数：用户主动清除或选择了与 URL 不同的股票
    const urlStock = searchParams.get('stock');
    const urlMarket = searchParams.get('market');
    // 用户清除股票，或选择了与 URL 不同的股票 → 清理 URL
    // 同一股票名称晚到同步（code 相同）时不清理 URL
    if (urlStock && (!stock || stock.code !== urlStock || stock.market !== (urlMarket || ''))) {
      router.replace('/');
    }
  }, [router, searchParams]);

  // 错误状态：重试 - 复用 executeReplay，确保统一的状态清理和 isLoading 防重逻辑
  const handleRetry = async () => {
    const stockId = selectedStock?.id || DEMO_STOCK.id;
    const start = startDate || DEMO_START_DATE;
    const end = endDate || DEMO_END_DATE;
    // 复用 executeReplay：自动清理旧状态、isLoading 防重、try/finally 保证按钮恢复
    await executeReplay(stockId, start, end);
  };

  // 计算事件日期映射信息（用于显示附近日期提示）
  const eventDateMappingInfo = useMemo(() => {
    if (!replayResult || replayResult.klines.length === 0) return new Map();
    const klineDates = replayResult.klines.map(k => k.date);
    const mapping = new Map<string, { original: string; mapped: string; isMapped: boolean }>();
    replayResult.historicalEvents.forEach(event => {
      const { mappedDate, isMapped } = mapEventToTradingDate(event.occurTime, klineDates);
      if (isMapped) {
        mapping.set(event.id, { original: event.occurTime, mapped: mappedDate, isMapped: true });
      }
    });
    return mapping;
  }, [replayResult]);

  // 抽屉/弹窗管理：滚动锁定、滚动位置恢复、嵌套 Escape 关闭
  useEffect(() => {
    const anyOverlayOpen = isEventDrawerOpen || isEventListOpen || isNodeDrawerOpen || isFutureEventDrawerOpen || isMarketKeyNodeDrawerOpen || isNodeEventDrawerOpen;

    if (anyOverlayOpen) {
      // 打开抽屉前记录当前滚动位置
      savedScrollY.current = window.scrollY || window.pageYOffset;
      // 锁定背景滚动
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${savedScrollY.current}px`;
      document.body.style.width = '100%';
    } else {
      // 最后一个抽屉关闭后，恢复滚动位置
      const y = savedScrollY.current;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      // 恢复滚动位置
      if (y > 0) {
        window.scrollTo(0, y);
      }
    }

    // 来源详情弹窗打开状态
    const isSourceDetailOpen = !!selectedSource;

    // Escape 键 - 按层级从最上层开始关闭
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;

      // 优先级1：来源详情弹窗（最上层）
      if (isSourceDetailOpen) {
        setSelectedSource(null);
        return;
      }

      // 优先级2：事件列表弹窗
      if (isEventListOpen) {
        handleCloseEventList();
        return;
      }

      // 优先级3：事件详情抽屉
      if (isEventDrawerOpen) {
        handleCloseEventDrawer();
        return;
      }

      // 优先级4：节点详情抽屉
      if (isNodeDrawerOpen) {
        handleCloseNodeDrawer();
        return;
      }

      // 优先级5：未来事件详情抽屉
      if (isFutureEventDrawerOpen) {
        handleCloseFutureEventDrawer();
        return;
      }

      // 优先级6：关键股价节点详情抽屉
      if (isMarketKeyNodeDrawerOpen) {
        handleCloseMarketKeyNodeDrawer();
        return;
      }

      // 优先级7：第十阶段 B 节点事件候选抽屉
      if (isNodeEventDrawerOpen) {
        handleCloseNodeEventDrawer();
        return;
      }

      // 优先级8：第十一阶段 A 用户事件表单
      if (isUserEventFormOpen) {
        handleCloseUserEventForm();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // 清理副作用
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [
    isEventDrawerOpen,
    isEventListOpen,
    isNodeDrawerOpen,
    isFutureEventDrawerOpen,
    isMarketKeyNodeDrawerOpen,
    isNodeEventDrawerOpen,
    isUserEventFormOpen,
    selectedSource,
    handleCloseEventDrawer,
    handleCloseEventList,
    handleCloseNodeDrawer,
    handleCloseFutureEventDrawer,
    handleCloseMarketKeyNodeDrawer,
    handleCloseNodeEventDrawer,
    handleCloseUserEventForm,
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8 md:py-12">
        <div className="max-w-7xl mx-auto px-5 md:px-10">

          {/* 统一开发辅助面板 - 仅开发环境渲染，集中管理所有截图辅助入口 */}
          <DevToolsPanel
            pageState={pageState}
            replayResult={replayResult}
            selectedStock={selectedStock}
            startDate={startDate}
            endDate={endDate}
            executeReplay={executeReplay}
            setSelectedEvent={setSelectedEvent}
            setSelectedNode={setSelectedNode}
            setSelectedEventGroup={setSelectedEventGroup}
            setIsEventDrawerOpen={setIsEventDrawerOpen}
            setIsEventListOpen={setIsEventListOpen}
            setIsNodeDrawerOpen={setIsNodeDrawerOpen}
            setIsFromGroup={setIsFromGroup}
            setSelectedFutureEvent={setSelectedFutureEvent}
            setIsFutureEventDrawerOpen={setIsFutureEventDrawerOpen}
            setDevAutoOpenSourceId={setDevAutoOpenSourceId}
            setSelectedSource={setSelectedSource}
            setSelectedStock={setSelectedStock}
            setStartDate={setStartDate}
            setEndDate={setEndDate}
            setPageState={setPageState}
            setReplayResult={setReplayResult}
            marketKeyNodes={marketKeyNodes}
            setSelectedMarketKeyNode={setSelectedMarketKeyNode}
            setIsMarketKeyNodeDrawerOpen={setIsMarketKeyNodeDrawerOpen}
            setDevKeyNodeSampleMode={setDevKeyNodeSampleMode}
            // 第十一阶段 A：用户事件开发入口
            onDevLoadSampleUserEvents={handleDevLoadSampleUserEvents}
            onDevClearUserEvents={handleDevClearUserEvents}
            onDevOpenUserEventForm={handleAddUserEvent}
            onDevLoadSampleReplayNote={handleDevLoadSampleReplayNote}
            onDevClearReplayNotes={handleDevClearReplayNotes}
          />

          {/* 1. 初始状态 */}
          {pageState === 'initial' && (
            <div className="mb-8">
              <div className="text-center mb-8">
                <h1 className="text-3xl md:text-4xl font-black text-ink mb-4 tracking-tight">
                  输入一只股票，看清每段关键走势的行情节点
                </h1>
                <p className="text-lg text-muted leading-relaxed max-w-2xl mx-auto">
                  选择股票和查询区间后，系统会把历史 K 线与关键涨跌节点对齐展示。当前可查看与关键节点时间邻近的新闻候选；候选仅供复盘查阅，不构成已确认的涨跌原因。
                </p>
              </div>

              <div className="border border-line rounded-lg bg-white/90 shadow-lg p-5 md:p-6">
                {/* 股票搜索 */}
                <div className="mb-5">
                  <label className="block text-sm font-semibold text-ink mb-2">
                    选择股票
                  </label>
                  <StockSearch
                    onSelectStock={handleSelectStock}
                    selectedStock={selectedStock}
                  />
                </div>

                {/* 日期快捷选项 */}
                <div className="mb-5">
                  <label className="block text-sm font-semibold text-ink mb-2">
                    选择查询时间范围
                  </label>
                  <DateQuickOptions
                    onSelect={handleQuickDateSelect}
                    currentStartDate={startDate}
                    currentEndDate={endDate}
                    onStartDateChange={handleStartDateChange}
                    onEndDateChange={handleEndDateChange}
                    referenceEndDate={referenceEndDate}
                    dataCoverageStart={undefined}
                    dataCoverageEnd={undefined}
                  />
                </div>

                {/* 日期错误提示 */}
                {dateError && (
                  <div className="p-3 bg-red/10 rounded-lg border border-red/30 mb-4" data-testid="date-error">
                    <p className="text-sm text-red font-semibold">
                      ⚠️ {dateError}
                    </p>
                  </div>
                )}

                {/* 真实行情说明（始终使用真实行情，无切换入口） */}
                <div className="mb-4 p-3 bg-blue/5 rounded-lg border border-blue/20">
                  <div className="text-sm font-semibold text-ink">
                    真实历史行情
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    K线数据来自 BaoStock（前复权日线），支持沪深上市A股。查询失败时显示错误原因，不自动降级。
                  </p>
                </div>

                {/* 开始复盘/查询按钮 */}
                <button
                  onClick={handleStartReplay}
                  disabled={!selectedStock || !startDate || !endDate || isLoading}
                  className="w-full h-[48px] px-6 border-0 rounded-lg bg-blue text-white font-black shadow-lg hover:bg-blue/90 transition-all disabled:bg-muted/30 disabled:text-muted disabled:cursor-not-allowed text-base flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      {loadingLabel}
                    </>
                  ) : (
                    actionLabel
                  )}
                </button>

                {/* 提示信息 */}
                <div className="mt-4 p-3 bg-blue/10 rounded-lg border border-blue/20">
                  <p className="text-xs text-blue font-semibold">
                    支持沪深上市A股代码（如 600519、000001、300750、688981、301165）。输入6位代码后按回车即可查询真实日K线。
                  </p>
                </div>
              </div>

              {/* 第十六阶段里程碑三：静态真实案例库入口 */}
              <div className="mt-6" data-testid="core-replay-entry">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-ink">静态真实案例库</h3>
                  <span className="text-xs text-muted">基于真实历史行情和可复核公开资料 · 非实时更新</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" data-testid="case-library-grid">
                  {CASE_LIST.map((c) => (
                    <Link
                      key={c.stockCode}
                      href={`/demo/core-replay?stock=${c.stockCode}`}
                      className="block bg-white border border-line hover:border-blue/40 rounded-lg p-2.5 transition-colors group"
                      data-testid={`home-case-card-${c.stockCode}`}
                    >
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-sm font-bold text-ink group-hover:text-blue">{c.stockName}</span>
                        <span className="text-xs text-muted">{c.stockCode}.{c.market}</span>
                      </div>
                      <div className="text-xs text-muted/80 flex items-center gap-2 flex-wrap">
                        <span>{c.requestStartDate} ~ {c.requestEndDate}</span>
                        <span>·</span>
                        <span>{c.klineCount} 根 K 线</span>
                        <span>·</span>
                        <span>{c.nodeCount} 个节点</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 2. 加载状态 */}
          {pageState === 'loading' && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-blue border-t-transparent mb-6"></div>
              <h2 className="text-xl font-bold text-ink mb-2">
                正在查询日K并识别关键节点...
              </h2>
              <p className="text-sm text-muted mb-4">
                系统正在从 BaoStock 获取真实日 K 并识别关键股价节点
              </p>
              <p className="text-xs text-muted">预计需要 2-3 秒</p>
              <div className="mt-6">
                <button
                  onClick={handleReset}
                  className="text-sm text-muted hover:text-ink underline"
                >
                  返回重新选择
                </button>
              </div>
            </div>
          )}

          {/* 3. 成功状态 */}
          {pageState === 'success' && replayResult && (
            <div>
              <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
                <div>
                  <h2 className="text-2xl font-black text-ink mb-1" data-testid="result-title">
                    {formatStockDisplayName(replayResult.stock)} - {resultTitle}
                  </h2>
                  <p className="text-sm text-muted" data-testid="result-stats">
                    请求区间：{startDate} 至 {endDate}
                    {' · '}
                    实际数据：{replayResult.klines[0]?.date || '--'} 至 {replayResult.klines[replayResult.klines.length - 1]?.date || '--'}
                    {' · '}
                    K 线 {replayResult.klines.length} 根
                    {' · '}
                    关键节点 {marketKeyNodes.length} 个
                    {!replayResult.marketMeta?.isRealMarketData && (
                      <>
                        {' · '}
                        相关事件 {replayResult.historicalEvents.length} 条
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* 第二十阶段 A：加入自选按钮 */}
                  {replayResult.stock.market === 'SH' || replayResult.stock.market === 'SZ' ? (
                    <WatchlistButton
                      stockCode={replayResult.stock.code}
                      stockName={replayResult.stock.name}
                      market={replayResult.stock.market}
                    />
                  ) : null}
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 text-sm font-semibold text-muted hover:text-ink hover:bg-paper rounded-lg transition-colors border border-line"
                  >
                    {resetLabel}
                  </button>
                </div>
              </div>

              {/* 数据来源信息栏 */}
              <div className="mb-4 p-3 bg-paper rounded-lg border border-line" data-testid="data-source-info">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
                  <span>股票代码：<span className="font-semibold text-ink">{replayResult.stock.code}.{replayResult.stock.market}</span></span>
                  <span>查询区间：<span className="font-semibold text-ink">{startDate} 至 {endDate}</span></span>
                  <span>数据来源：<span className="font-semibold text-ink">{replayResult.marketMeta?.isRealMarketData ? 'BaoStock' : replayResult.marketMeta?.sourceLabel === '开发验收样本' ? '本地开发验收样本' : replayResult.marketMeta?.fallbackReason ? '本地Mock(BaoStock降级)' : '本地Mock'}</span></span>
                  <span>数据频率：<span className="font-semibold text-ink">日线</span></span>
                  <span>复权方式：<span className="font-semibold text-ink">{replayResult.marketMeta?.adjustment === 'qfq' ? '前复权' : '不复权'}</span></span>
                </div>
                <p className="mt-1.5 text-xs text-muted">
                  {replayResult.marketMeta?.isRealMarketData
                    ? '真实历史行情，不代表投资建议'
                    : replayResult.marketMeta?.fallbackReason
                      ? '已降级为本地Mock演示数据，不代表真实市场行情'
                      : '本地Mock演示数据，不代表真实市场行情'}
                </p>
              </div>

              {/* 第十四阶段 A1 封板修复：数据起始日提示
                  区分两种情况：
                  1. 真实 IPO 日期晚于请求开始日 → "该股票于 YYYY-MM-DD 上市..."
                  2. 仅周末/节假日/停牌造成首根 K 线晚于请求开始日 → "所选开始日无交易数据..."
                  不得把周末后的第一交易日描述成股票上市起点 */}
              {replayResult.klines.length > 0 &&
                replayResult.klines[0].date > startDate && (
                <div className="mb-4 p-3 bg-blue/10 rounded-lg border border-blue/20" data-testid="late-ipo-notice">
                  <p className="text-sm text-blue font-semibold">
                    {replayResult.marketMeta?.ipoDate && replayResult.marketMeta.ipoDate > startDate
                      ? `该股票于 ${replayResult.marketMeta.ipoDate} 上市，所选区间内的行情从上市后首个交易日开始。`
                      : `所选开始日无交易数据，实际行情从 ${replayResult.klines[0].date} 开始。`
                    }
                  </p>
                </div>
              )}

              {/* 行情数据来源标识 */}
              {replayResult.marketMeta?.isRealMarketData ? (
                <div className="mb-4 p-3 bg-green/10 rounded-lg border border-green/30" data-testid="real-market-banner">
                  <p className="text-sm text-green font-semibold">
                    当前K线为BaoStock真实历史行情（前复权日线）。
                  </p>
                  <p className="text-xs text-green/80 mt-1">
                    当前可查看与关键节点时间邻近的新闻候选；候选仅供复盘查阅，不构成已确认的涨跌原因。
                  </p>
                </div>
              ) : replayResult.marketMeta?.fallbackReason ? (
                <div className="mb-4 p-3 bg-yellow/10 rounded-lg border border-yellow/30">
                  <p className="text-sm text-yellow font-semibold">
                    BaoStock真实行情暂时不可用，当前已降级为本地Mock行情。
                  </p>
                  <p className="text-xs text-yellow/80 mt-1">
                    {replayResult.marketMeta.fallbackReason}
                  </p>
                </div>
              ) : null}

              {/* Mock 模式演示数据提示（仅在非真实行情时显示） */}
              {!replayResult.marketMeta?.isRealMarketData && (
                <div className="mb-6 p-3 bg-orange/10 rounded-lg border border-orange/20">
                  <p className="text-sm text-orange font-semibold">
                    ⚠️ 注意：当前展示为演示数据，不代表真实市场情况。事件、来源均为模拟生成，仅供功能演示使用。
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-2" data-testid="left-analysis-column">
                  {/* 第九阶段：开发验收样本标注（仅开发环境 + 开发样本模式下显示） */}
                  {devKeyNodeSampleMode !== 'none' && (
                    <div className="mb-4 p-3 bg-orange/10 rounded-lg border border-orange/30" data-testid="dev-sample-banner">
                      <p className="text-sm text-orange font-semibold">
                        ⚠️ 开发验收样本 · 固定 K 线数据，非真实行情结果。仅用于验证节点算法与界面。
                      </p>
                    </div>
                  )}

                  {/* 专业K线图表 — 单层卡片，由 ProfessionalKLineChart 自身渲染 */}
                  <ProfessionalKLineChart
                    klines={replayResult.klines}
                    keyNodes={replayResult.keyNodes}
                    events={replayResult.historicalEvents}
                    marketKeyNodes={marketKeyNodes}
                    stockName={formatStockDisplayName(replayResult.stock)}
                    stockCode={replayResult.stock.code}
                    marketMeta={replayResult.marketMeta}
                    onEventClick={handleEventClick}
                    onEventGroupClick={handleEventGroupClick}
                    onNodeClick={handleNodeClick}
                    onMarketKeyNodeClick={handleMarketKeyNodeClick}
                    onDateClick={handleDateClick}
                    noteMarkers={noteDates}
                  />

                  {/* 复盘笔记 + 未来三个月大事日历 — 位于行情图正下方 */}
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="dual-card-area">
                    <div data-testid="note-card-wrapper">
                      <TradingDayNotePanel
                        stockCode={replayResult.stock.code}
                        stockName={formatStockDisplayName(replayResult.stock)}
                        selectedDate={selectedDate}
                        klines={replayResult.klines}
                        marketKeyNodes={marketKeyNodes}
                        onNoteChanged={() => refreshNoteDates(replayResult.stock.code)}
                      />
                    </div>
                    <div data-testid="calendar-card-wrapper">
                      <StockEventCalendar
                        events={stockEvents}
                        onAddUserEvent={handleAddUserEvent}
                        onEditUserEvent={handleEditUserEvent}
                        onDeleteUserEvent={handleDeleteUserEvent}
                      />
                    </div>
                  </div>

                  {/* 第二十阶段 A：本地数据保存范围提示 */}
                  <p data-testid="local-data-hint-page" className="mt-2 text-xs text-muted text-center">
                    个人数据目前仅保存在此浏览器，云端同步即将开放。
                  </p>

                  {/* 旧事件列表：仅 Mock 模式渲染 */}
                  {!replayResult.marketMeta?.isRealMarketData && (
                    <div className="mt-4 border border-line rounded-lg bg-white p-4" data-testid="legacy-event-list">
                      <h4 className="text-base font-bold text-ink mb-3">
                        事件列表（点击查看详情）
                      </h4>
                      {replayResult.historicalEvents.length === 0 ? (
                        <p className="text-sm text-muted py-4 text-center">
                          该日期区间内暂无可展示事件
                        </p>
                      ) : (
                        replayResult.historicalEvents.map(event => {
                          const mapping = eventDateMappingInfo.get(event.id);
                          return (
                            <button
                              key={event.id}
                              onClick={() => handleEventClick(event)}
                              className="w-full text-left border border-line rounded-lg p-3 mb-2 hover:bg-paper transition-colors last:mb-0"
                            >
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-xs bg-blue/10 text-blue px-2 py-1 rounded font-semibold">
                                  {event.occurTime}
                                </span>
                                {mapping && mapping.isMapped && (
                                  <span className="text-xs text-orange bg-orange/10 px-2 py-1 rounded border border-orange/20" title={`原始日期：${mapping.original}，对齐交易日：${mapping.mapped}`}>
                                    附近日期 → {mapping.mapped}
                                  </span>
                                )}
                                <span className="text-sm font-bold text-ink">
                                  {event.title}
                                </span>
                              </div>
                              <p className="text-xs text-muted mt-1">
                                {event.summary.slice(0, 100)}...
                              </p>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-1">
                  {/* 旧事件图例：仅 Mock 模式渲染 */}
                  {!replayResult.marketMeta?.isRealMarketData && <EventLegend />}

                  {/* 旧 Mock 关键节点概览：仅 Mock 模式渲染 */}
                  {!replayResult.marketMeta?.isRealMarketData && (
                    <div className="mt-6 border border-line rounded-lg bg-white p-4" data-testid="legacy-key-node-overview">
                      <h4 className="text-base font-bold text-ink mb-3">
                        关键节点概览（点击查看详情）
                      </h4>
                      {replayResult.keyNodes.length === 0 ? (
                        <p className="text-sm text-muted py-4 text-center">
                          该日期区间内暂无关键节点
                        </p>
                      ) : (
                        replayResult.keyNodes.map(node => (
                          <button
                            key={node.id}
                            onClick={() => handleNodeClick(node)}
                            className="w-full text-left border border-line rounded-lg p-3 mb-2 last:mb-0 hover:bg-paper transition-colors"
                          >
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs bg-violet/10 text-violet px-2 py-1 rounded font-semibold">
                                {node.date}
                              </span>
                              <span className="text-xs bg-paper px-2 py-1 rounded">
                                {node.nodeType}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded font-semibold ${
                                node.significance === 'high' ? 'bg-red/10 text-red' : 'bg-orange/10 text-orange'
                              }`}>
                                {node.significance === 'high' ? '高重要' : '中等'}
                              </span>
                            </div>
                            <p className="text-xs text-ink font-semibold">
                              {node.description}
                            </p>
                            <p className="text-xs text-muted mt-1">
                              价格变化：{node.priceChange > 0 ? '+' : ''}{node.priceChange}%
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  {/* 第九阶段：基于行情数据的关键股价节点列表（真实与 Mock 模式均渲染） */}
                  <div className="mt-6">
                    <KeyNodeList
                      nodes={marketKeyNodes}
                      selectedNodeId={selectedMarketKeyNode?.id}
                      onNodeClick={handleMarketKeyNodeClick}
                    />
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <RiskWarning marketMeta={replayResult.marketMeta} />
              </div>
            </div>
          )}

          {/* 4. 空结果状态 */}
          {pageState === 'empty' && (
            <div className="text-center py-12" data-testid="empty-state">
              <div className="text-6xl text-line mb-4">📭</div>
              <h2 className="text-xl font-bold text-ink mb-2">
                所选区间暂无交易数据
              </h2>
              <p className="text-sm text-muted mb-6 max-w-md mx-auto">
                该日期区间内没有K线数据，可能是非交易日或该股票在此期间未上市。请尝试调整日期范围。
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleReset}
                  className="px-6 py-2 bg-blue text-white font-semibold rounded-lg hover:bg-blue/90 transition-colors"
                >
                  返回重新选择
                </button>
              </div>
            </div>
          )}

          {/* 5. 错误状态 */}
          {pageState === 'error' && (
            <div className="text-center py-12" data-testid="error-state">
              <div className="text-6xl text-red mb-4">❌</div>
              <h2 className="text-xl font-bold text-ink mb-2">
                真实行情服务暂时不可用
              </h2>
              <p className="text-sm text-muted mb-6 max-w-md mx-auto">
                {marketDataError
                  ? `${normalizeTrailingPunctuation(marketDataError)}。当前无法查询这只股票，请稍后重试或返回修改查询条件。`
                  : '真实行情服务暂时不可用，当前无法查询这只股票。请稍后重试，或返回修改查询条件。'}
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleReset}
                  className="px-6 py-2 bg-blue text-white font-semibold rounded-lg hover:bg-blue/90 transition-colors"
                  data-testid="error-return-btn"
                >
                  返回重新选择
                </button>
                <button
                  onClick={handleRetry}
                  className="px-6 py-2 bg-paper text-ink font-semibold rounded-lg hover:bg-paper/80 transition-colors border border-line"
                  data-testid="error-retry-btn"
                >
                  重试
                </button>
              </div>
            </div>
          )}

        </div>
      </main>

      <footer className="border-t border-line py-8">
        <div className="max-w-7xl mx-auto px-5 md:px-10 text-center">
          <p className="text-sm text-muted">
            K-Ray · 股票走势复盘与事件候选工具 · 本地体验版
          </p>
          <p className="text-xs text-muted mt-2" data-testid="footer-data-note">
            {pageState === 'error'
              ? '真实行情服务暂时不可用，本次未展示任何行情数据。'
              : replayResult?.marketMeta?.isRealMarketData
                ? '真实K线行情来自BaoStock（前复权日线）。当前可查看与关键节点时间邻近的新闻候选；候选仅供复盘查阅，不构成已确认的涨跌原因。'
                : replayResult?.marketMeta?.fallbackReason
                  ? 'BaoStock当前不可用，本次K线已降级为本地Mock演示数据。'
                  : replayResult
                    ? '当前为Mock演示模式，K线、事件、来源与未来日历均为演示数据，不代表真实市场情况。'
                    : '真实K线行情来自BaoStock（前复权日线）。当前可查看与关键节点时间邻近的新闻候选；候选仅供复盘查阅，不构成已确认的涨跌原因。'}
          </p>
        </div>
      </footer>

      <EventDetailDrawer
        event={selectedEvent}
        sources={currentSources}
        isOpen={isEventDrawerOpen}
        onClose={handleCloseEventDrawer}
        currentIndex={currentEventIndex}
        totalCount={sortedEvents.length}
        isFromGroup={isFromGroup}
        relatedNode={currentRelatedNode}
        onNavigatePrev={handleNavigatePrev}
        onNavigateNext={handleNavigateNext}
        onBackToList={handleBackToList}
        isDateMapped={currentEventDateMapping?.isMapped}
        mappedTradingDate={currentEventDateMapping?.mappedDate}
        autoOpenSourceId={devAutoOpenSourceId}
        selectedSource={selectedSource}
        onSelectSource={setSelectedSource}
      />

      {/* 事件列表弹窗 */}
      <EventListModal
        group={selectedEventGroup}
        isOpen={isEventListOpen}
        onClose={handleCloseEventList}
        onSelectEvent={handleSelectEventFromList}
        eventDateMapping={eventDateMappingInfo}
      />

      {/* 节点详情抽屉 */}
      <NodeDetailDrawer
        node={selectedNode}
        isOpen={isNodeDrawerOpen}
        onClose={handleCloseNodeDrawer}
      />

      {/* 未来事件详情抽屉 */}
      <FutureEventDetailDrawer
        event={selectedFutureEvent}
        isOpen={isFutureEventDrawerOpen}
        onClose={handleCloseFutureEventDrawer}
      />

      {/* 第九阶段：关键股价节点详情抽屉（保留用于 DevToolsPanel 直接打开） */}
      <MarketKeyNodeDrawer
        node={selectedMarketKeyNode}
        isOpen={isMarketKeyNodeDrawerOpen}
        onClose={handleCloseMarketKeyNodeDrawer}
      />

      {/* 第十阶段 B：关键节点—事件候选抽屉 */}
      <NodeEventDrawer
        node={selectedMarketKeyNode}
        stockCode={replayResult?.stock.code || ''}
        market={(replayResult?.stock.market === 'SH' || replayResult?.stock.market === 'SZ') ? replayResult.stock.market : 'SH'}
        isOpen={isNodeEventDrawerOpen}
        onClose={handleCloseNodeEventDrawer}
        noteRefreshKey={replayNoteRefreshKey}
      />

      {/* 第十六阶段：用户事件新增/编辑表单 */}
      <StockEventForm
        key={isUserEventFormOpen ? `${userEventFormMode}-${editingStockEvent?.id || 'new'}` : 'closed'}
        isOpen={isUserEventFormOpen}
        mode={userEventFormMode}
        event={editingStockEvent}
        stockCode={replayResult?.stock.code || selectedStock?.code || ''}
        onSave={handleSaveStockEvent}
        onCancel={handleCloseUserEventForm}
      />

    </div>
  );
}
