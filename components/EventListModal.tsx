'use client';

import { HistoricalEvent } from '@/types';
import { eventTypeConfigs } from '@/config/eventTypes';
import type { AggregatedEventGroup } from '@/utils/eventAggregation';

interface EventListModalProps {
  group: AggregatedEventGroup | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectEvent: (event: HistoricalEvent) => void;
  eventDateMapping?: Map<string, { original: string; mapped: string; isMapped: boolean }>;
}

export default function EventListModal({
  group,
  isOpen,
  onClose,
  onSelectEvent,
  eventDateMapping,
}: EventListModalProps) {
  if (!isOpen || !group || group.events.length === 0) return null;

  const events = group.events;
  const mappedTradingDate = group.mappedTradingDate;
  const isMappedToNearbyDate = group.isMappedToNearbyDate;

  const getEventMapping = (eventId: string) => {
    if (!eventDateMapping) return null;
    return eventDateMapping.get(eventId) || null;
  };

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/40 z-30"
        onClick={onClose}
      />
      
      {/* 弹窗 */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40 bg-white rounded-lg shadow-xl max-w-md w-[90vw] max-h-[70vh] overflow-hidden" data-testid="event-list-modal">
        {/* 头部 */}
        <div className="px-4 py-3 border-b border-line bg-paper flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-ink">该区域有 {events.length} 个事件</h3>
            <p className="text-xs text-muted">请选择要查看的事件</p>
            {isMappedToNearbyDate && (
              <p className="text-xs text-orange mt-1">
                对齐交易日：{mappedTradingDate}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink text-sm font-semibold px-2 py-1 rounded hover:bg-paper transition-colors"
          >
            ✕ 关闭
          </button>
        </div>
        
        {/* 演示数据标注 */}
        <div className="px-4 py-2 bg-orange/10 border-b border-orange/20">
          <span className="text-xs text-orange font-semibold">
            ⚠️ 演示数据 - 不代表真实事件
          </span>
        </div>
        
        {/* 事件列表 */}
        <div className="overflow-y-auto max-h-[calc(70vh - 100px)]">
          {events.map((event, idx) => {
            const config = eventTypeConfigs.find(c => c.type === event.eventType);
            const mapping = getEventMapping(event.id);
            const eventIsMapped = mapping?.isMapped ?? false;
            const eventMappedDate = mapping?.mapped || mappedTradingDate;
            
            return (
              <button
                key={event.id}
                onClick={() => onSelectEvent(event)}
                className="w-full text-left px-4 py-3 border-b border-line last:border-0 hover:bg-paper transition-colors"
              >
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {/* 序号 */}
                  <span className="text-xs font-bold text-muted bg-paper px-1.5 py-0.5 rounded">
                    {idx + 1}
                  </span>
                  {/* 事件类型 */}
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: config?.color }}
                  />
                  <span className="text-xs text-muted bg-blue/10 px-1.5 py-0.5 rounded">
                    {config?.label.slice(0, 4)}
                  </span>
                  {/* 原始日期 */}
                  <span className="text-xs text-muted font-semibold">
                    {event.occurTime}
                  </span>
                  {/* 附近日期提示（非交易日映射） */}
                  {eventIsMapped && (
                    <span className="text-xs text-orange bg-orange/10 px-1.5 py-0.5 rounded border border-orange/20">
                      附近日期 → {eventMappedDate}
                    </span>
                  )}
                </div>
                
                {/* 标题 */}
                <h4 className="text-sm font-bold text-ink mb-1">
                  {event.title}
                </h4>
                
                {/* 摘要 */}
                <p className="text-xs text-muted line-clamp-2">
                  {event.summary.slice(0, 80)}...
                </p>
                
                {/* 查看提示 */}
                <span className="text-xs text-blue font-semibold mt-1 block">
                  点击查看详情 →
                </span>
              </button>
            );
          })}
        </div>
        
        {/* 底部提示 */}
        <div className="px-4 py-3 border-t border-line bg-ink">
          <p className="text-xs text-white/80">
            提示：事件线索仅表示时间上的相邻关系，不等于确定因果关系。
          </p>
        </div>
      </div>
    </>
  );
}