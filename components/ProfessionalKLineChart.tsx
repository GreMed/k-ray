'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  CrosshairMode,
  SeriesMarker,
  MouseEventParams,
} from 'lightweight-charts';
import { KLineData, KeyNode, HistoricalEvent, MarketDataMeta, MarketKeyNode } from '@/types';
import { eventTypeConfigs } from '@/config/eventTypes';
import {
  aggregateEventsUnified,
  generateNodeMarkerId,
  generateEventMarkerId,
  generateEventGroupMarkerId,
  type AggregatedEventGroup,
} from '@/utils/eventAggregation';
import { KEY_NODE_TYPE_META, formatVolume } from '@/utils/keyNodeConfig';

interface ProfessionalKLineChartProps {
  klines: KLineData[];
  keyNodes?: KeyNode[];
  events?: HistoricalEvent[];
  marketKeyNodes?: MarketKeyNode[];
  stockName?: string;
  isLoading?: boolean;
  marketMeta?: MarketDataMeta;
  onEventClick?: (event: HistoricalEvent) => void;
  onEventGroupClick?: (group: AggregatedEventGroup) => void;
  onNodeClick?: (node: KeyNode) => void;
  onMarketKeyNodeClick?: (node: MarketKeyNode) => void;
  onDateClick?: (date: string) => void;
  noteMarkers?: string[]; // 有笔记的日期列表，格式 YYYY-MM-DD
  stockCode?: string; // 第十六阶段封板修复：笔记 marker ID 需要包含 stockCode
  // 第十五阶段 A 收口：可选自定义统计文案，仅 Mock 演示页使用，默认行为不变
  customStatsLabel?: string;
}

// 悬停数据状态
interface HoverData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  changePercent: number | undefined;
}

// markerId 到业务对象的映射
type MarkerMapEntry =
  | { type: 'node'; node: KeyNode }
  | { type: 'market-node'; node: MarketKeyNode }
  | { type: 'event'; event: HistoricalEvent }
  | { type: 'event-group'; events: HistoricalEvent[]; group: AggregatedEventGroup }
  | { type: 'user-note'; date: string };

export default function ProfessionalKLineChart({
  klines,
  keyNodes,
  events,
  marketKeyNodes,
  stockName,
  isLoading,
  marketMeta,
  onEventClick,
  onEventGroupClick,
  onNodeClick,
  onMarketKeyNodeClick,
  onDateClick,
  noteMarkers,
  stockCode,
  customStatsLabel,
}: ProfessionalKLineChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  // markerId → 业务对象映射，useRef保证点击回调能拿到最新映射
  const markerMapRef = useRef<Map<string, MarkerMapEntry>>(new Map());
  // 回调ref，避免回调变化导致图表重建
  const onEventClickRef = useRef(onEventClick);
  const onEventGroupClickRef = useRef(onEventGroupClick);
  const onNodeClickRef = useRef(onNodeClick);
  const onMarketKeyNodeClickRef = useRef(onMarketKeyNodeClick);
  const onDateClickRef = useRef(onDateClick);

  const [hoverData, setHoverData] = useState<HoverData | null>(null);

  // 同步回调到ref
  useEffect(() => {
    onEventClickRef.current = onEventClick;
    onEventGroupClickRef.current = onEventGroupClick;
    onNodeClickRef.current = onNodeClick;
    onMarketKeyNodeClickRef.current = onMarketKeyNodeClick;
    onDateClickRef.current = onDateClick;
  }, [onEventClick, onEventGroupClick, onNodeClick, onMarketKeyNodeClick, onDateClick]);

  // 转换K线数据为lightweight-charts格式
  const convertToChartData = useCallback((data: KLineData[]): CandlestickData<Time>[] => {
    return data.map(k => ({
      time: k.date as Time,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
    }));
  }, []);

  // 创建事件和节点标记（使用统一聚合工具，设置稳定ID）
  const createMarkers = useCallback(
    (nodes?: KeyNode[], evts?: HistoricalEvent[], mktNodes?: MarketKeyNode[], noteDates?: string[]): SeriesMarker<Time>[] => {
      const markers: SeriesMarker<Time>[] = [];
      // 每次重建markers前清空映射
      const markerMap = new Map<string, MarkerMapEntry>();

      // 第九阶段：基于行情数据的关键节点标记（优先于 Mock 节点）
      if (mktNodes && mktNodes.length > 0 && klines.length > 0) {
        const klineDates = klines.map(k => k.date);
        mktNodes.forEach(node => {
          if (klineDates.includes(node.date)) {
            const meta = KEY_NODE_TYPE_META[node.type];
            const markerId = `mkt-node:${node.id}`;
            markers.push({
              id: markerId,
              time: node.date as Time,
              position: meta.position,
              shape: meta.shape,
              color: meta.color,
              text: `${node.changePercent >= 0 ? '+' : ''}${node.changePercent.toFixed(0)}%`,
              size: 2,
            });
            markerMap.set(markerId, { type: 'market-node', node });
          }
        });
      }

      // 节点标记（Mock 演示节点，第七阶段A及之前的数据结构）
      if (nodes && nodes.length > 0 && klines.length > 0) {
        const klineDates = klines.map(k => k.date);
        nodes.forEach(node => {
          // 节点日期必须是K线日期才显示
          if (klineDates.includes(node.date)) {
            const markerId = generateNodeMarkerId(node.id);
            markers.push({
              id: markerId,
              time: node.date as Time,
              position: 'aboveBar',
              shape: 'arrowUp',
              color: '#7657d9',
              text: node.nodeType.slice(0, 4),
              size: 2,
            });
            markerMap.set(markerId, { type: 'node', node });
          }
        });
      }

      // 事件标记（使用统一聚合工具）
      if (evts && evts.length > 0 && klines.length > 0) {
        const groups = aggregateEventsUnified(evts, klines);

        groups.forEach(group => {
          const config = eventTypeConfigs.find(c => c.type === group.events[0].eventType);
          const color = config?.color || '#2864e6';
          const isAggregated = group.events.length > 1;

          // 稳定markerId
          const markerId = isAggregated
            ? generateEventGroupMarkerId(group.events.map(e => e.id))
            : generateEventMarkerId(group.events[0].id);

          const text = isAggregated ? `${group.events.length}` : 'E';

          markers.push({
            id: markerId,
            time: group.mappedTradingDate as Time,
            position: 'belowBar',
            shape: 'circle',
            color: color,
            text: text,
            size: isAggregated ? 3 : 2,
          });

          if (isAggregated) {
            markerMap.set(markerId, { type: 'event-group', events: group.events, group });
          } else {
            markerMap.set(markerId, { type: 'event', event: group.events[0] });
          }
        });
      }

      // 第十六阶段：用户笔记标记（独立标记，可与关键节点同日共存）
      // 封板修复：marker ID 必须稳定包含 stockCode + date，并写入 markerMap 以支持点击
      if (noteDates && noteDates.length > 0 && klines.length > 0) {
        const klineDates = klines.map(k => k.date);
        noteDates.forEach(date => {
          if (klineDates.includes(date)) {
            const markerId = `user-note:${stockCode || 'unknown'}:${date}`;
            markers.push({
              id: markerId,
              time: date as Time,
              position: 'belowBar',
              shape: 'circle',
              color: '#f59e0b',
              text: '📝',
              size: 1,
            });
            // 封板修复：写入 markerMap，点击笔记标记时能找到 entry
            markerMap.set(markerId, { type: 'user-note', date });
          }
        });
      }

      // 按时间排序
      markers.sort((a, b) => {
        const aTime = String(a.time);
        const bTime = String(b.time);
        return aTime.localeCompare(bTime);
      });

      // 保存映射供点击回调使用
      markerMapRef.current = markerMap;

      return markers;
    },
    [klines, stockCode]
  );

  // 初始化图表
  useEffect(() => {
    if (!chartContainerRef.current || klines.length === 0) return;

    // 计算容器尺寸
    const containerWidth = chartContainerRef.current.clientWidth;
    const containerHeight = chartContainerRef.current.clientHeight || 400;

    // 创建图表
    const chart = createChart(chartContainerRef.current, {
      width: containerWidth,
      height: containerHeight,
      layout: {
        textColor: '#172033',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
      },
      grid: {
        vertLines: { color: '#e1e4e7' },
        horzLines: { color: '#e1e4e7' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#758696',
          width: 1,
          style: 3,
          labelBackgroundColor: '#2864e6',
        },
        horzLine: {
          color: '#758696',
          width: 1,
          style: 3,
          labelBackgroundColor: '#2864e6',
        },
      },
      rightPriceScale: {
        borderColor: '#d9e2ef',
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
      timeScale: {
        borderColor: '#d9e2ef',
        timeVisible: false,
        secondsVisible: false,
        tickMarkFormatter: (time: Time) => {
          // 第十四阶段 A1：横轴普通时间刻度使用 YYYY-MM-DD 格式
          // time 为 'YYYY-MM-DD' 字符串（business day），直接返回
          return String(time);
        },
      },
      // 第十四阶段 A1 封板修复：localization.timeFormatter 控制十字线底部日期标签
      // 不再出现 '09 Jan \'26' / '00:00' / 'MM-DD' 等格式
      localization: {
        timeFormatter: (time: Time) => {
          return String(time);
        },
        dateFormat: 'yyyy-MM-dd',
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
    });

    // 创建K线序列 (v4 API)
    const candlestickSeries = chart.addCandlestickSeries({
      // A 股惯例：红涨绿跌
      upColor: '#e65353',
      downColor: '#20a464',
      borderUpColor: '#e65353',
      borderDownColor: '#20a464',
      wickUpColor: '#e65353',
      wickDownColor: '#20a464',
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;

    // 设置数据
    const chartData = convertToChartData(klines);
    candlestickSeries.setData(chartData);

    // 第十四阶段 A1：setData 后必须执行完整区间适配
    // 确保默认视野覆盖返回的全部 K 线（如近1年约 242 根交易日）
    chart.timeScale().fitContent();

    // 设置标记（内部会更新 markerMapRef）
    const markers = createMarkers(keyNodes, events, marketKeyNodes, noteMarkers);
    candlestickSeries.setMarkers(markers);

    // 订阅十字线移动事件 - 悬停显示OHLC
    const crosshairHandler = (param: MouseEventParams) => {
      if (!param.time || !param.point) {
        setHoverData(null);
        return;
      }

      const timeStr = String(param.time);
      const kline = klines.find(k => k.date === timeStr);
      if (kline) {
        setHoverData({
          date: kline.date,
          open: kline.open,
          high: kline.high,
          low: kline.low,
          close: kline.close,
          volume: kline.volume,
          changePercent: kline.changePercent,
        });
      } else {
        setHoverData(null);
      }
    };
    chart.subscribeCrosshairMove(crosshairHandler);

    // 订阅点击事件 - marker点击处理
    const clickHandler = (param: MouseEventParams) => {
      if (!param) return;

      // 通过 hoveredObjectId 获取被点击的marker
      const hoveredId = param.hoveredObjectId as string | undefined;
      if (hoveredId) {
        const entry = markerMapRef.current.get(hoveredId);
        if (!entry) return;

        if (entry.type === 'node' && onNodeClickRef.current) {
          onNodeClickRef.current(entry.node);
        } else if (entry.type === 'market-node' && onMarketKeyNodeClickRef.current) {
          onMarketKeyNodeClickRef.current(entry.node);
        } else if (entry.type === 'event' && onEventClickRef.current) {
          onEventClickRef.current(entry.event);
        } else if (entry.type === 'event-group' && onEventGroupClickRef.current) {
          onEventGroupClickRef.current(entry.group);
        } else if (entry.type === 'user-note' && onDateClickRef.current) {
          // 封板修复：点击笔记标记打开对应日期的笔记
          onDateClickRef.current(entry.date);
        }
      } else if (param.time && onDateClickRef.current) {
        // 第十六阶段：点击非 marker 的普通交易日，触发日期点击回调
        onDateClickRef.current(String(param.time));
      }
    };
    chart.subscribeClick(clickHandler);

    // 处理窗口大小变化
    const handleResize = () => {
      if (chartContainerRef.current) {
        const width = chartContainerRef.current.clientWidth;
        chart.applyOptions({ width });
      }
    };

    window.addEventListener('resize', handleResize);

    // 清理：必须unsubscribe
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.unsubscribeCrosshairMove(crosshairHandler);
      chart.unsubscribeClick(clickHandler);
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      markerMapRef.current.clear();
    };
  }, [klines, keyNodes, events, marketKeyNodes, noteMarkers, stockCode, convertToChartData, createMarkers]);

  if (isLoading) {
    return (
      <div
        className="w-full min-h-[400px] border border-line rounded-lg bg-white shadow-lg flex items-center justify-center"
        data-testid="chart-loading"
      >
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue border-t-transparent mb-4"></div>
          <p className="text-muted font-semibold">加载 K 线数据...</p>
        </div>
      </div>
    );
  }

  if (!klines || klines.length === 0) {
    return (
      <div
        className="w-full min-h-[400px] border border-line rounded-lg bg-white shadow-lg flex items-center justify-center"
        data-testid="chart-empty"
      >
        <div className="text-center">
          <div className="text-6xl text-line mb-4">📊</div>
          <p className="text-muted font-semibold">暂无 K 线数据</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full border border-line rounded-lg bg-white shadow-lg overflow-hidden"
      data-testid="chart-wrapper"
    >
      {/* 标题栏 */}
      <div className="px-4 py-3 border-b border-line bg-paper/82">
        <div className="flex justify-between items-start gap-4">
          <div>
            <strong className="text-lg text-ink font-black">
              {stockName || '股票走势'} - K 线图表
            </strong>
            <span className="text-sm text-muted font-semibold block mt-1">
              专业图表 · 支持缩放、十字线、悬停数据显示
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-muted" data-testid="chart-stats">
              {customStatsLabel
                ? customStatsLabel
                : `共 ${klines.length} 根 K 线 · 关键股价节点 ${marketKeyNodes?.length || 0} 个 · 事件 ${events?.length || 0} 条`}
            </span>
          </div>
        </div>
      </div>

      {/* 悬停行情信息条（固定高度，不因悬停出现/消失而改变图表卡片高度） */}
      <div
        className="px-4 py-2 border-b border-line bg-blue/5"
        data-testid="hover-data-bar"
        style={{ minHeight: '40px', display: 'flex', alignItems: 'center' }}
      >
        {hoverData ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs w-full" data-testid="hover-data">
            <span className="font-semibold text-ink">
              日期: <span className="text-blue">{hoverData.date}</span>
            </span>
            <span className="text-muted">
              开: <span className="text-ink font-semibold">{hoverData.open}</span>
            </span>
            <span className="text-muted">
              收: <span className="text-ink font-semibold">{hoverData.close}</span>
            </span>
            <span className="text-muted">
              高: <span className="text-ink font-semibold">{hoverData.high}</span>
            </span>
            <span className="text-muted">
              低: <span className="text-ink font-semibold">{hoverData.low}</span>
            </span>
            <span className="text-muted">
              量: <span className="text-ink font-semibold">{formatVolume(hoverData.volume)}</span>
            </span>
            <span className="text-muted">
              涨跌幅:{' '}
              <span
                className="font-bold"
                style={{
                  color: hoverData.changePercent === undefined
                    ? '#667085'
                    : hoverData.changePercent >= 0
                      ? '#e65353'
                      : '#20a464',
                }}
              >
                {hoverData.changePercent === undefined
                  ? '--'
                  : `${hoverData.changePercent >= 0 ? '+' : ''}${hoverData.changePercent.toFixed(2)}%`}
              </span>
            </span>
          </div>
        ) : (
          <div className="text-xs text-muted" data-testid="hover-data-placeholder">
            移动鼠标查看日行情
          </div>
        )}
      </div>

      {/* 图表容器 */}
      <div
        ref={chartContainerRef}
        className="relative w-full"
        style={{ height: '400px' }}
        data-testid="chart-container"
      />

      {/* 行情数据标注 */}
      <div className="px-4 py-2 border-t border-line bg-orange/10">
        {marketMeta?.isRealMarketData ? (
          <span className="text-xs text-green font-semibold" data-testid="chart-data-label">
            真实历史行情 · 来源：BaoStock · 前复权日线
          </span>
        ) : marketMeta?.fallbackReason ? (
          <span className="text-xs text-orange font-semibold" data-testid="chart-data-label">
            当前K线已降级为本地Mock演示数据，不代表真实市场行情
          </span>
        ) : (
          <span className="text-xs text-orange font-semibold" data-testid="chart-data-label">
            Mock演示数据，不代表真实市场行情
          </span>
        )}
        <span className="text-xs text-muted ml-4">
          {marketMeta?.isRealMarketData
            ? '提示：鼠标悬停查看OHLC数据，拖动缩放，点击关键节点查看详情'
            : '提示：鼠标悬停查看OHLC数据，拖动缩放，点击图表上的标记查看事件/节点详情'}
        </span>
      </div>

      {/* 图例 */}
      <div className="px-4 py-2 border-t border-line bg-paper" data-testid="chart-legend">
        <div className="flex flex-wrap gap-4 text-xs text-muted">
          {/* 关键股价节点图例（真实行情模式 + 有 marketKeyNodes 时展示）
              第十四阶段 A1：图例形状与图表实际 marker 一致
              - 单日显著上涨：红色向上箭头（arrowUp）
              - 单日显著下跌：绿色向下箭头（arrowDown）
              - 阶段高点：蓝色圆点（circle）
              - 阶段低点：紫色圆点（circle） */}
          {marketKeyNodes && marketKeyNodes.length > 0 && (
            <>
              <span className="flex items-center gap-1">
                <span style={{ color: '#e65353', fontSize: '14px', lineHeight: 1 }}>▲</span>
                单日显著上涨
              </span>
              <span className="flex items-center gap-1">
                <span style={{ color: '#20a464', fontSize: '14px', lineHeight: 1 }}>▼</span>
                单日显著下跌
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue inline-block"></span>
                阶段高点
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-violet inline-block"></span>
                阶段低点
              </span>
            </>
          )}
          {/* Mock 演示节点图例（Mock 模式有 keyNodes 时展示，实际 marker 为向上箭头） */}
          {keyNodes && keyNodes.length > 0 && (
            <span className="flex items-center gap-1">
              <span style={{ color: '#7657d9', fontSize: '14px', lineHeight: 1 }}>▲</span>
              Mock 演示节点 ({keyNodes.length})
            </span>
          )}
          {/* 事件图例 */}
          {events && events.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue inline-block"></span>
              事件标记 ({events.length})
            </span>
          )}
          {/* 第十六阶段：用户笔记图例 */}
          {noteMarkers && noteMarkers.length > 0 && (
            <span className="flex items-center gap-1">
              <span style={{ color: '#f59e0b', fontSize: '14px', lineHeight: 1 }}>📝</span>
              我的笔记 ({noteMarkers.length})
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
