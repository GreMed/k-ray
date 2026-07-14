'use client';

import { FutureEvent } from '@/types';
import { eventTypeConfigs } from '@/config/eventTypes';
import { dateCertaintyConfigs, getDateCertaintyConfig } from '@/config/dateCertaintyConfig';

interface FutureEventCalendarProps {
  events: FutureEvent[];
  onEventClick?: (event: FutureEvent) => void;
  referenceEndDate?: string;
}

export default function FutureEventCalendar({ events, onEventClick, referenceEndDate }: FutureEventCalendarProps) {
  // 过滤逻辑：
  // confirmed/estimated：必须有 scheduledDate，且必须晚于 referenceEndDate
  // tentative：不使用日期过滤，始终保留
  const futureEvents = events.filter(e => {
    if (!referenceEndDate) return true;

    if (e.dateCertainty === 'tentative') {
      return true;
    }

    if (!e.scheduledDate) {
      return false;
    }

    return new Date(e.scheduledDate).getTime() > new Date(referenceEndDate).getTime();
  });

  // 排序：confirmed/estimated 按日期从近到远；相同日期按 eventId；tentative 始终排最后；多个 tentative 按 eventId
  const sortedEvents = [...futureEvents].sort((a, b) => {
    const aTentative = a.dateCertainty === 'tentative';
    const bTentative = b.dateCertainty === 'tentative';

    if (aTentative && !bTentative) return 1;
    if (!aTentative && bTentative) return -1;

    if (aTentative && bTentative) {
      return a.eventId.localeCompare(b.eventId);
    }

    const dateDiff = new Date(a.scheduledDate || 0).getTime() - new Date(b.scheduledDate || 0).getTime();
    if (dateDiff !== 0) return dateDiff;

    return a.eventId.localeCompare(b.eventId);
  });

  // 空状态
  if (sortedEvents.length === 0) {
    return (
      <div className="w-full border border-line rounded-lg bg-white/88 shadow-lg p-5" data-testid="future-calendar-empty">
        <h3 className="text-lg font-bold text-ink mb-4">
          未来事件日历
        </h3>
        <div className="text-center py-8">
          <div className="text-4xl text-line mb-3">📅</div>
          <p className="text-sm text-muted font-semibold" data-testid="future-calendar-empty-text">
            当前演示数据中暂无未来事件安排。
          </p>
        </div>

        <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-300">
          <p className="text-sm text-yellow-900 font-bold mb-1">
            ⚠️ 风险提示
          </p>
          <p className="text-xs text-yellow-800 leading-relaxed">
            未来事件仅用于时间管理和研究提醒，不代表事件一定发生，也不代表其将导致特定股价表现。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full border border-line rounded-lg bg-white/88 shadow-lg p-5" data-testid="future-calendar">
      <div className="flex items-start justify-between mb-2 gap-4">
        <div>
          <h3 className="text-lg font-bold text-ink">
            未来事件日历
          </h3>
          <p className="text-sm text-muted mt-1">
            自动整理未来值得关注的事件节点，帮助您提前关注可能影响股价的重要时点。
          </p>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-xs text-muted mb-1">日期确定性图例</div>
          <div className="flex gap-2">
            {dateCertaintyConfigs.map(config => (
              <span key={config.key} className={`text-[10px] px-1.5 py-0.5 rounded border ${config.color} font-semibold`}>
                {config.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <span className="text-xs text-orange bg-orange/10 px-2 py-1 rounded border border-orange/30 font-semibold">
          演示数据 - 仅作提示，不代表必然影响股价
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedEvents.map(event => {
          const config = eventTypeConfigs.find(c => c.type === event.eventType);
          const certainty = getDateCertaintyConfig(event.dateCertainty);

          return (
            <button
              key={event.eventId}
              data-testid={`future-event-card-${event.eventId}`}
              onClick={() => onEventClick?.(event)}
              className="border border-line rounded-lg bg-white p-4 hover:shadow-lg transition-shadow text-left w-full"
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: config?.color }}
                />
                <span className="text-xs font-bold bg-blue/10 text-blue px-2 py-1 rounded">
                  {config?.label.slice(0, 4)}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${certainty.color} ml-auto`}>
                  {certainty.label}
                </span>
              </div>

              {/* 日期：tentative 不显示日期，只显示"日期待定"标签 */}
              {event.dateCertainty !== 'tentative' && event.scheduledDate && (
                <div className="text-xs font-semibold text-muted mb-2">
                  {certainty.dateFieldLabel}：{event.scheduledDate}
                </div>
              )}

              <h4 className="text-base font-bold text-ink mb-2">
                {event.title}
              </h4>

              <p className="text-sm text-muted leading-relaxed mb-2">
                {event.description}
              </p>

              <p className="text-xs text-blue bg-blue/5 px-2 py-1.5 rounded border border-blue/10">
                <span className="font-semibold">关注理由：</span>{event.attentionReason}
              </p>

              {event.isDemo && (
                <div className="mt-2">
                  <span className="text-xs text-orange bg-orange/10 px-1.5 py-0.5 rounded border border-orange/20 font-semibold">
                    演示数据
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-300">
        <p className="text-sm text-yellow-900 font-bold mb-1">
          ⚠️ 风险提示
        </p>
        <p className="text-xs text-yellow-800 leading-relaxed">
          未来事件仅用于时间管理和研究提醒，不代表事件一定发生，也不代表其将导致特定股价表现。
        </p>
      </div>
    </div>
  );
}
