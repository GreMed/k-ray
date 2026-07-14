'use client';

import { KLineData, KeyNode, HistoricalEvent } from '@/types';
import { eventTypeConfigs } from '@/config/eventTypes';

interface KLineChartPlaceholderProps {
  klines?: KLineData[];
  keyNodes?: KeyNode[];
  events?: HistoricalEvent[];
  stockName?: string;
  isLoading?: boolean;
  onEventClick?: (event: HistoricalEvent) => void;
  onEventGroupClick?: (events: HistoricalEvent[]) => void;
  onNodeClick?: (node: KeyNode) => void;
}

export default function KLineChartPlaceholder({
  klines,
  keyNodes,
  events,
  stockName,
  isLoading,
  onEventClick,
  onEventGroupClick,
  onNodeClick
}: KLineChartPlaceholderProps) {
  
  if (isLoading) {
    return (
      <div className="w-full min-h-[440px] border border-line rounded-lg bg-white shadow-lg flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue border-t-transparent mb-4"></div>
          <p className="text-muted font-semibold">加载 K 线数据...</p>
          <p className="text-xs text-muted mt-2">正在生成走势事件标注</p>
        </div>
      </div>
    );
  }
  
  if (!klines || klines.length === 0) {
    return (
      <div className="w-full min-h-[440px] border border-line rounded-lg bg-white shadow-lg flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl text-line mb-4">📊</div>
          <p className="text-muted font-semibold">K 线主视图占位区域</p>
          <p className="text-xs text-muted mt-2">选择股票和时间区间后，点击查询行情查看走势</p>
        </div>
      </div>
    );
  }

  // === 唯一数据口径：visibleKlines ===
  const visibleKlines = klines;
  const candleCount = visibleKlines.length;
  const startDate = visibleKlines[0].date;
  const endDate = visibleKlines[candleCount - 1].date;
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();

  // === 共用的水平位置计算函数 ===
  // 基于日期在 visibleKlines 中的索引或时间插值
  const getPositionByDate = (date: string): { leftPercent: number; index: number | null; isExact: boolean } => {
    const dateIndex = visibleKlines.findIndex(k => k.date === date);
    if (dateIndex >= 0) {
      // 精确匹配到交易日
      const leftPercent = ((dateIndex + 0.5) / candleCount) * 100;
      return { leftPercent, index: dateIndex, isExact: true };
    }
    // 未匹配到交易日，在时间范围内插值，定位到最近位置
    const dateMs = new Date(date).getTime();
    if (endMs === startMs) {
      return { leftPercent: 50, index: null, isExact: false };
    }
    const rawPercent = ((dateMs - startMs) / (endMs - startMs)) * 100;
    const leftPercent = Math.max(2, Math.min(98, rawPercent));
    return { leftPercent, index: null, isExact: false };
  };

  // === 节点位置计算 ===
  const nodePositions = (keyNodes || []).map(node => ({
    node,
    ...getPositionByDate(node.date)
  }));

  // === 事件位置计算与聚合 ===
  // 先计算每个事件的位置
  const eventPositions = (events || []).map(event => {
    // 如果有 relatedNodeId，先找对应节点日期
    if (event.relatedNodeId && keyNodes && keyNodes.length > 0) {
      const relatedNode = keyNodes.find(n => n.id === event.relatedNodeId);
      if (relatedNode) {
        const pos = getPositionByDate(relatedNode.date);
        return { event, ...pos, isNearNode: true };
      }
    }
    // 否则按事件日期定位
    const pos = getPositionByDate(event.occurTime);
    return { event, ...pos, isNearNode: false };
  });

  // 聚合同一水平位置的事件（距离小于3%视为同一区域）
  const minGap = 3;
  interface EventGroup {
    leftPercent: number;
    events: HistoricalEvent[];
    isExact: boolean;
  }
  const eventGroups: EventGroup[] = [];
  
  // 按位置排序
  const sortedEvents = [...eventPositions].sort((a, b) => a.leftPercent - b.leftPercent);
  
  for (const ep of sortedEvents) {
    let addedToGroup = false;
    for (const group of eventGroups) {
      if (Math.abs(group.leftPercent - ep.leftPercent) < minGap) {
        group.events.push(ep.event);
        addedToGroup = true;
        break;
      }
    }
    if (!addedToGroup) {
      eventGroups.push({
        leftPercent: ep.leftPercent,
        events: [ep.event],
        isExact: ep.isExact
      });
    }
  }

  // 动态调整蜡烛宽度
  const candleWidth = candleCount > 40 ? 4 : candleCount > 30 ? 6 : candleCount > 20 ? 8 : 10;

  return (
    <div className="w-full border border-line rounded-lg bg-white shadow-lg overflow-hidden">
      {/* 标题 */}
      <div className="px-5 py-4 border-b border-line bg-paper/82">
        <div className="flex justify-between items-start gap-4">
          <div>
            <strong className="text-xl text-ink font-black">
              {stockName || '股票走势'} - K 线事件透视
            </strong>
            <span className="text-sm text-muted font-semibold mt-1 block">
              自动识别关键涨跌节点，并标注具有解释价值的重要事件
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-sm font-semibold text-muted bg-paper px-2 py-1 rounded">
              事件密度: 精简
            </span>
            <span className="text-xs text-muted" data-testid="chart-stats">
              共 {candleCount} 根 K 线 · {nodePositions.length} 个节点 · {eventGroups.length} 组事件标记
            </span>
          </div>
        </div>
      </div>
      
      {/* K线图区域 */}
      <div className="relative min-h-[400px] p-5 bg-white">
        {/* 背景网格 */}
        <div 
          className="absolute inset-5 pointer-events-none"
          style={{
            backgroundImage: `
              repeating-linear-gradient(0deg, transparent 0 51px, rgba(217, 226, 239, 0.7) 52px),
              repeating-linear-gradient(90deg, transparent 0 75px, rgba(217, 226, 239, 0.42) 76px)
            `
          }}
        />
        
        {/* K线蜡烛 - 全部绘制，基于 visibleKlines */}
        <div className="absolute left-[34px] right-[34px] bottom-[72px] h-[260px] flex items-end justify-between">
          {visibleKlines.map((kline, idx) => {
            const changePct = kline.changePercent ?? 0;
            const isUp = changePct >= 0;
            const height = Math.abs(changePct) * 25 + 25;
            const color = isUp ? 'bg-green' : 'bg-red';
            const lineColor = isUp ? 'bg-green/70' : 'bg-red/70';
            
            return (
              <div
                key={kline.id}
                data-testid="kline-candle"
                data-date={kline.date}
                data-index={idx}
                className={`relative rounded-sm ${color}`}
                style={{ 
                  height: `${Math.min(height, 240)}px`,
                  width: `${candleWidth}px`
                }}
                title={`${kline.date}: 收盘 ${kline.close}`}
              >
                {/* 蜡烛线 */}
                <div
                  className={`absolute left-1/2 transform -translate-x-1/2 w-[1px] ${lineColor}`}
                  style={{ top: '-10px', bottom: '-10px' }}
                />
              </div>
            );
          })}
        </div>
        
        {/* 关键节点标记 - 基于共用的位置函数，可点击 */}
        {nodePositions.map((np) => {
          const leftPercent = np.leftPercent;
          
          return (
            <button
              key={np.node.id}
              data-testid="key-node-marker"
              data-node-id={np.node.id}
              data-date={np.node.date}
              onClick={() => onNodeClick?.(np.node)}
              className="absolute transform -translate-x-1/2 z-10 cursor-pointer hover:scale-125 transition-transform"
              style={{ left: `calc(34px + (100% - 68px) * ${leftPercent / 100})`, top: '8px' }}
              title={`${np.node.date}: ${np.node.description} (点击查看详情)`}
            >
              {/* 节点菱形标记 */}
              <div className="w-3 h-3 rotate-45 bg-violet border-2 border-white shadow-md" />
              {/* 日期标签 */}
              <div className="text-[9px] text-violet font-semibold mt-0.5 whitespace-nowrap absolute left-1/2 -translate-x-1/2">
                {np.node.date.slice(5)}
                {!np.isExact && (
                  <span className="text-orange ml-0.5">(附近)</span>
                )}
              </div>
            </button>
          );
        })}
        
        {/* 事件标记 - 小型圆点/聚合标记，可点击 */}
        {eventGroups.map((group, groupIdx) => {
          const leftPercent = group.leftPercent;
          const hasMultiple = group.events.length > 1;
          const firstEvent = group.events[0];
          const config = eventTypeConfigs.find(c => c.type === firstEvent.eventType);
          const color = config?.color || '#2864e6';
          
          // 使用事件ID组合作为key，不使用groupIdx
          const eventKey = group.events.map(e => e.id).sort().join('-');
          
          // 多个事件时显示聚合标记
          const label = hasMultiple 
            ? `${group.events.length}个事件` 
            : firstEvent.title.slice(0, 12) + '...';
          
          // 垂直位置：按组索引分配，避免重叠
          const topPositions = ['70px', '140px', '210px', '280px'];
          const top = topPositions[groupIdx % topPositions.length];
          
          return (
            <button
              key={eventKey}
              data-testid="event-marker"
              data-event-ids={group.events.map(e => e.id).join(',')}
              data-left-percent={leftPercent.toFixed(1)}
              onClick={() => {
                // 聚合事件：展示列表
                // 单个事件：直接打开详情
                if (hasMultiple && onEventGroupClick) {
                  onEventGroupClick(group.events);
                } else if (!hasMultiple && onEventClick) {
                  onEventClick(firstEvent);
                }
              }}
              className="absolute z-20 flex items-center gap-1 cursor-pointer hover:scale-110 transition-transform"
              style={{ 
                left: `calc(34px + (100% - 68px) * ${leftPercent / 100} - ${hasMultiple ? 28 : 60}px)`,
                top
              }}
              title={hasMultiple 
                ? `点击查看事件列表：${group.events.map(e => e.title).join('、')}`
                : `点击查看：${firstEvent.title}`
              }
            >
              {/* 彩色圆点 */}
              <div 
                className="w-3 h-3 rounded-full shadow-sm border border-white"
                style={{ backgroundColor: color }}
              />
              {/* 简短标签 */}
              <span className="text-[10px] font-semibold bg-white/95 px-1.5 py-0.5 rounded shadow-sm border border-line">
                {label}
              </span>
              {/* 聚合数量 */}
              {hasMultiple && (
                <span className="text-[10px] font-bold bg-violet text-white px-1.5 py-0.5 rounded-full">
                  {group.events.length}
                </span>
              )}
            </button>
          );
        })}
        
        {/* 底部轴线 */}
        <div className="absolute left-5 right-5 bottom-[54px] h-[1px] bg-gray-300" />
        
        {/* 日期标签 */}
        <div className="absolute left-5 right-5 bottom-[36px] flex justify-between text-[10px] text-muted">
          <span>{startDate}</span>
          <span>{endDate}</span>
        </div>
        
        {/* 演示数据标注 */}
        <div className="absolute top-2 right-2">
          <span className="text-xs text-orange bg-orange/10 px-2 py-1 rounded border border-orange/30 font-semibold">
            演示数据
          </span>
        </div>

        {/* 节点图例 */}
        {nodePositions.length > 0 && (
          <div className="absolute bottom-2 left-5">
            <span className="text-[10px] text-muted flex items-center gap-1">
              <span className="w-2 h-2 rotate-45 bg-violet inline-block"></span>
              关键节点 ({nodePositions.length})
            </span>
          </div>
        )}
        
        {/* 事件图例 */}
        {eventGroups.length > 0 && (
          <div className="absolute bottom-2 right-5">
            <span className="text-[10px] text-muted flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue inline-block"></span>
              事件标记 ({eventGroups.length}组)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}