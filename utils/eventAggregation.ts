// 统一的事件定位与聚合工具
// 供 ProfessionalKLineChart 和测试共同使用，不维护两套算法

import { KLineData, HistoricalEvent, KeyNode } from '@/types';

// 聚合事件组
export interface AggregatedEventGroup {
  // 稳定groupId：按排序后的事件ID组合
  groupId: string;
  // 映射到的交易日（K线日期）
  mappedTradingDate: string;
  // 原始事件日期（组内最早事件日期）
  originalEventDate: string;
  // 组内所有事件
  events: HistoricalEvent[];
  // 是否映射到附近交易日（原始日期不是交易日）
  isMappedToNearbyDate: boolean;
}

// 单个事件的定位结果
export interface EventPositionResult {
  // 事件ID
  eventId: string;
  // 映射到的交易日
  mappedTradingDate: string;
  // 原始事件日期
  originalEventDate: string;
  // 是否映射到附近交易日
  isMappedToNearbyDate: boolean;
}

// 生成稳定的groupId：按事件ID排序后用-连接
export function generateGroupId(eventIds: string[]): string {
  return [...eventIds].sort().join('-');
}

// 生成稳定的单个marker ID
export function generateNodeMarkerId(nodeId: string): string {
  return `node:${nodeId}`;
}

export function generateEventMarkerId(eventId: string): string {
  return `event:${eventId}`;
}

export function generateEventGroupMarkerId(eventIds: string[]): string {
  return `event-group:${generateGroupId(eventIds)}`;
}

// 将事件日期映射到最近的交易日
export function mapEventToTradingDate(
  eventDate: string,
  klineDates: string[]
): { mappedDate: string; isMapped: boolean } {
  if (klineDates.length === 0) {
    return { mappedDate: eventDate, isMapped: false };
  }

  if (klineDates.includes(eventDate)) {
    return { mappedDate: eventDate, isMapped: false };
  }

  // 找最近的交易日
  const nearestDate = klineDates.reduce((prev, curr) => {
    const prevDiff = Math.abs(new Date(prev).getTime() - new Date(eventDate).getTime());
    const currDiff = Math.abs(new Date(curr).getTime() - new Date(eventDate).getTime());
    return currDiff < prevDiff ? curr : prev;
  });

  return { mappedDate: nearestDate, isMapped: true };
}

// 计算事件在K线时间轴上的水平位置（0-1）
export function getEventPosition(eventDate: string, klines: KLineData[]): number {
  if (klines.length === 0) return 0;
  const eventMs = new Date(eventDate).getTime();
  const firstMs = new Date(klines[0].date).getTime();
  const lastMs = new Date(klines[klines.length - 1].date).getTime();
  if (lastMs === firstMs) return 0;
  return (eventMs - firstMs) / (lastMs - firstMs);
}

// 统一的事件聚合函数
// 聚合规则：水平位置差距小于3%的事件聚合为一组
export function aggregateEventsUnified(
  events: HistoricalEvent[],
  klines: KLineData[]
): AggregatedEventGroup[] {
  if (events.length === 0 || klines.length === 0) return [];

  const klineDates = klines.map(k => k.date);
  const sortedKlineDates = [...klineDates].sort();

  // 为每个事件计算映射日期和位置
  const eventsWithPosition = events.map(event => {
    // 优先使用事件自身日期，不绑定到节点日期
    const eventDate = event.occurTime;
    const { mappedDate, isMapped } = mapEventToTradingDate(eventDate, sortedKlineDates);
    const position = getEventPosition(mappedDate, klines);

    return {
      event,
      originalEventDate: eventDate,
      mappedTradingDate: mappedDate,
      isMappedToNearbyDate: isMapped,
      position,
    };
  });

  // 按位置排序
  eventsWithPosition.sort((a, b) => {
    const posDiff = a.position - b.position;
    if (Math.abs(posDiff) > 0.0001) return posDiff;
    // 位置相同按ID排序
    return a.event.id.localeCompare(b.event.id);
  });

  // 聚合：水平距离小于3%的事件聚合为一组
  const groups: AggregatedEventGroup[] = [];
  type EventWithPosition = typeof eventsWithPosition[number];
  let currentGroup: EventWithPosition[] = [];

  for (const item of eventsWithPosition) {
    if (currentGroup.length === 0) {
      currentGroup.push(item);
    } else {
      const lastItem = currentGroup[currentGroup.length - 1];
      if (Math.abs(item.position - lastItem.position) < 0.03) {
        currentGroup.push(item);
      } else {
        groups.push(buildGroup(currentGroup));
        currentGroup = [item];
      }
    }
  }

  if (currentGroup.length > 0) {
    groups.push(buildGroup(currentGroup));
  }

  return groups;
}

// 构建聚合组
function buildGroup(items: Array<{
  event: HistoricalEvent;
  originalEventDate: string;
  mappedTradingDate: string;
  isMappedToNearbyDate: boolean;
  position: number;
}>): AggregatedEventGroup {
  const eventIds = items.map(i => i.event.id);
  const groupId = generateGroupId(eventIds);

  // 使用组内第一个事件的映射日期作为组的映射日期
  const mappedTradingDate = items[0].mappedTradingDate;
  const originalEventDate = items[0].originalEventDate;
  // 如果组内任一事件被映射，则整组标记为映射
  const isMappedToNearbyDate = items.some(i => i.isMappedToNearbyDate);

  return {
    groupId,
    mappedTradingDate,
    originalEventDate,
    events: items.map(i => i.event),
    isMappedToNearbyDate,
  };
}

// 单独的日期过滤函数（用于测试和页面）
export function filterKLinesByDate(klines: KLineData[], startDate: string, endDate: string): KLineData[] {
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();

  return klines.filter(k => {
    const kMs = new Date(k.date).getTime();
    return kMs >= startMs && kMs <= endMs;
  });
}

export function filterNodesByDate(nodes: KeyNode[], startDate: string, endDate: string): KeyNode[] {
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();

  return nodes.filter(n => {
    const nMs = new Date(n.date).getTime();
    return nMs >= startMs && nMs <= endMs;
  });
}

export function filterEventsByDate(events: HistoricalEvent[], startDate: string, endDate: string): HistoricalEvent[] {
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();

  return events.filter(e => {
    const eMs = new Date(e.occurTime).getTime();
    return eMs >= startMs && eMs <= endMs;
  });
}
