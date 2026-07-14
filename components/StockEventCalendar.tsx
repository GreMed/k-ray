'use client';

// 第十六阶段 里程碑二：统一未来三个月股票大事日历
// 月历布局：一至日七列，展示当前月+未来两个月
// 系统可信事件与用户事件统一展示，通过颜色和徽标区分
// 无可核验系统事件时显示真实空状态，不使用 Mock 补位

import { useState, useMemo, useCallback, useEffect } from 'react';
import { StockEvent } from '@/types';
import { STOCK_EVENT_CATEGORY_META, isUserEvent, isCaseDemoEvent, isVerifiableEvent, getEventCalendarDate } from '@/services/stockEvents';

interface StockEventCalendarProps {
  events: StockEvent[];
  onAddUserEvent?: () => void;
  onEditUserEvent?: (event: StockEvent) => void;
  onDeleteUserEvent?: (event: StockEvent) => void;
  // 静态案例固定基准日（不依赖浏览器当天日期）；真实行情页不传则使用今天
  referenceDate?: string;
  // 静态案例轻量文案标识（显示在标题处）
  staticCaseLabel?: string;
}

// 日期工具函数（使用 UTC 避免时区偏差）
function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getDaysInMonth(year: number, month: number): number {
  // month: 0-11
  return new Date(year, month + 1, 0).getDate();
}

// 获取月份第一天是星期几（0=周一, 6=周日）
function getFirstDayMondayBased(year: number, month: number): number {
  const firstDay = new Date(year, month, 1).getDay(); // 0=周日, 1=周一
  return firstDay === 0 ? 6 : firstDay - 1;
}

function formatMonthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function formatMonthLabel(year: number, month: number): string {
  return `${year}年${month + 1}月`;
}

function formatCalendarDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

export default function StockEventCalendar({
  events,
  onAddUserEvent,
  onEditUserEvent,
  onDeleteUserEvent,
  referenceDate,
  staticCaseLabel,
}: StockEventCalendarProps) {
  // 客户端挂载后才有 today（避免 SSR hydration mismatch）
  // 静态案例使用 referenceDate 作为基准日，不依赖浏览器当天
  const [todayStr, setTodayStr] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // 静态案例固定基准日，真实行情页使用今天
    setTodayStr(referenceDate || getTodayStr());
    setMounted(true);
  }, [referenceDate]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 当前显示的月份 {year, month}
  const [viewYear, setViewYear] = useState<number | null>(null);
  const [viewMonth, setViewMonth] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // 月份范围：基准月 + 未来2个月
  const monthRange = useMemo(() => {
    if (!mounted || !todayStr) return null;
    // 静态案例使用 referenceDate 推导月份范围，真实行情页使用今天
    const baseDate = new Date(todayStr + 'T00:00:00.000Z');
    const start = { year: baseDate.getUTCFullYear(), month: baseDate.getUTCMonth() };
    const endDate = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + 2, 1));
    const end = { year: endDate.getUTCFullYear(), month: endDate.getUTCMonth() };
    return { start, end };
  }, [mounted, todayStr]);

  // 初始化显示月份为当前月
  const effectiveViewYear = viewYear ?? (monthRange?.start.year ?? 2026);
  const effectiveViewMonth = viewMonth ?? (monthRange?.start.month ?? 0);

  // 月份切换
  const canGoPrev = useMemo(() => {
    if (!monthRange) return false;
    return effectiveViewYear > monthRange.start.year ||
      (effectiveViewYear === monthRange.start.year && effectiveViewMonth > monthRange.start.month);
  }, [effectiveViewYear, effectiveViewMonth, monthRange]);

  const canGoNext = useMemo(() => {
    if (!monthRange) return false;
    return effectiveViewYear < monthRange.end.year ||
      (effectiveViewYear === monthRange.end.year && effectiveViewMonth < monthRange.end.month);
  }, [effectiveViewYear, effectiveViewMonth, monthRange]);

  const handlePrevMonth = useCallback(() => {
    if (!canGoPrev) return;
    // 切换月份时清除已选日期，避免旧月份的"YYYY-MM-DD 的事件"残留到新月份
    setSelectedDate(null);
    if (effectiveViewMonth === 0) {
      setViewYear(effectiveViewYear - 1);
      setViewMonth(11);
    } else {
      setViewYear(effectiveViewYear);
      setViewMonth(effectiveViewMonth - 1);
    }
  }, [canGoPrev, effectiveViewYear, effectiveViewMonth]);

  const handleNextMonth = useCallback(() => {
    if (!canGoNext) return;
    // 切换月份时清除已选日期，避免旧月份的"YYYY-MM-DD 的事件"残留到新月份
    setSelectedDate(null);
    if (effectiveViewMonth === 11) {
      setViewYear(effectiveViewYear + 1);
      setViewMonth(0);
    } else {
      setViewYear(effectiveViewYear);
      setViewMonth(effectiveViewMonth + 1);
    }
  }, [canGoNext, effectiveViewYear, effectiveViewMonth]);

  // 按日期分组事件
  const eventsByDate = useMemo(() => {
    const map = new Map<string, StockEvent[]>();
    for (const event of events) {
      const date = getEventCalendarDate(event);
      if (date) {
        const existing = map.get(date) || [];
        existing.push(event);
        map.set(date, existing);
      }
    }
    return map;
  }, [events]);

  // 当前月份的待定事件（month 精度）
  const currentMonthPendingEvents = useMemo(() => {
    const monthKey = formatMonthKey(effectiveViewYear, effectiveViewMonth);
    return events.filter(e => e.datePrecision === 'month' && e.month === monthKey);
  }, [events, effectiveViewYear, effectiveViewMonth]);

  // 选中日期的事件
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    return eventsByDate.get(selectedDate) || [];
  }, [selectedDate, eventsByDate]);

  // 事件统计：可核验 / 演示 / 用户
  const verifiableCount = useMemo(() => events.filter(e => isVerifiableEvent(e)).length, [events]);
  const demoCount = useMemo(() => events.filter(e => isCaseDemoEvent(e)).length, [events]);
  const userEventCount = useMemo(() => events.filter(e => isUserEvent(e)).length, [events]);
  const hasDemoEvents = demoCount > 0;

  // 构造日历格子
  const calendarCells = useMemo(() => {
    const daysInMonth = getDaysInMonth(effectiveViewYear, effectiveViewMonth);
    const firstDayOffset = getFirstDayMondayBased(effectiveViewYear, effectiveViewMonth);
    const cells: Array<{ day: number | null; date: string | null }> = [];

    // 前置空格
    for (let i = 0; i < firstDayOffset; i++) {
      cells.push({ day: null, date: null });
    }
    // 当月每一天
    for (let day = 1; day <= daysInMonth; day++) {
      const date = formatCalendarDate(effectiveViewYear, effectiveViewMonth, day);
      cells.push({ day, date });
    }
    // 补齐到 7 的倍数
    while (cells.length % 7 !== 0) {
      cells.push({ day: null, date: null });
    }
    return cells;
  }, [effectiveViewYear, effectiveViewMonth]);

  const handleDateClick = useCallback((date: string) => {
    setSelectedDate(date);
  }, []);

  const handleDeleteEvent = useCallback((event: StockEvent) => {
    if (isUserEvent(event) && onDeleteUserEvent) {
      onDeleteUserEvent(event);
    }
  }, [onDeleteUserEvent]);

  const handleEditEvent = useCallback((event: StockEvent) => {
    if (isUserEvent(event) && onEditUserEvent) {
      onEditUserEvent(event);
    }
  }, [onEditUserEvent]);

  return (
    <div data-testid="stock-event-calendar" className="border border-line rounded-lg bg-white p-2 flex flex-col">
      {/* 标题 + 月份导航 + 新增（紧凑单行） */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-sm font-bold text-ink">未来大事</span>
          {hasDemoEvents && (
            <span className="text-xs text-muted/60 font-normal" data-testid="calendar-has-demo-label">
              含演示事件
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePrevMonth}
            disabled={!canGoPrev}
            className="text-xs px-1 py-0.5 text-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            data-testid="calendar-prev-month"
          >
            ←
          </button>
          <span className="text-xs font-bold text-ink" data-testid="calendar-month-label">
            {formatMonthLabel(effectiveViewYear, effectiveViewMonth)}
          </span>
          <button
            onClick={handleNextMonth}
            disabled={!canGoNext}
            className="text-xs px-1 py-0.5 text-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            data-testid="calendar-next-month"
          >
            →
          </button>
          {onAddUserEvent && (
            <button
              onClick={onAddUserEvent}
              className="text-xs text-blue hover:underline font-medium ml-1"
              data-testid="stock-event-add-btn"
            >
              + 新增
            </button>
          )}
        </div>
      </div>

      {/* 静态案例基准日标签（独立行，避免移动端标题行溢出） */}
      {staticCaseLabel && (
        <div className="text-xs text-muted/50 font-normal mb-1.5" data-testid="calendar-static-label">
          {staticCaseLabel}
        </div>
      )}

      {/* 日历网格（紧凑） */}
      <div className="bg-paper rounded border border-line p-1" data-testid="calendar-grid">
        {/* 星期表头 */}
        <div className="grid grid-cols-7 gap-0.5 mb-0.5">
          {WEEKDAY_LABELS.map(label => (
            <div key={label} className="text-center text-xs text-muted font-semibold py-0.5">
              {label}
            </div>
          ))}
        </div>
        {/* 日期格子 */}
        <div className="grid grid-cols-7 gap-0.5">
          {calendarCells.map((cell, idx) => {
            if (!cell.date) {
              return <div key={idx} className="h-6" />;
            }
            const dayEvents = eventsByDate.get(cell.date) || [];
            const isToday = cell.date === todayStr;
            const isSelected = cell.date === selectedDate;
            const hasEvents = dayEvents.length > 0;
            const hasSystemEvent = dayEvents.some(e => !isUserEvent(e));
            const hasUserEvent = dayEvents.some(e => isUserEvent(e));

            return (
              <button
                key={idx}
                onClick={() => handleDateClick(cell.date!)}
                className={`relative h-6 flex items-center justify-center text-xs rounded transition-colors ${
                  isSelected
                    ? 'bg-blue text-white font-bold'
                    : isToday
                    ? 'bg-blue/10 text-blue font-bold border border-blue/30'
                    : hasEvents
                    ? 'bg-white text-ink hover:bg-blue/5 border border-line/60'
                    : 'text-muted hover:bg-paper border border-transparent'
                }`}
                data-testid={`calendar-cell-${cell.date}`}
              >
                {cell.day}
                {hasEvents && !isSelected && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-0.5">
                    {hasSystemEvent && (
                      <span className="w-1 h-1 rounded-full bg-blue" />
                    )}
                    {hasUserEvent && (
                      <span className="w-1 h-1 rounded-full bg-violet" />
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 选中日期的事件列表（紧凑） */}
      {selectedDate && (
        <div className="mt-1.5" data-testid="selected-date-events">
          <div className="text-xs font-bold text-ink mb-1">
            {selectedDate} 的事件
          </div>
          {selectedDateEvents.length === 0 ? (
            <div className="text-xs text-muted bg-paper rounded border border-line p-2 text-center">
              该日期暂无事件
            </div>
          ) : (
            <div className="space-y-1.5">
              {selectedDateEvents.map(event => {
                const meta = STOCK_EVENT_CATEGORY_META[event.category];
                const isUser = isUserEvent(event);
                const isDemo = isCaseDemoEvent(event);
                return (
                  <div
                    key={event.id}
                    className="bg-white border border-line rounded p-2"
                    data-testid={`calendar-event-${event.id}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${meta.badgeClass}`} data-testid={`event-badge-${event.id}`}>
                        {meta.label}
                      </span>
                      {isUser && (
                        <span className="text-xs text-muted bg-gray-100 px-1.5 py-0.5 rounded" data-testid={`event-user-tag-${event.id}`}>
                          用户录入
                        </span>
                      )}
                      {isDemo && (
                        <span className="text-xs text-orange bg-orange/10 px-1.5 py-0.5 rounded" data-testid={`event-demo-tag-${event.id}`}>
                          演示·非真实日程
                        </span>
                      )}
                      {event.datePrecision === 'deadline' && (
                        <span className="text-xs text-orange bg-orange/10 px-1.5 py-0.5 rounded" data-testid={`event-deadline-tag-${event.id}`}>
                          法定最晚日
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink font-medium mb-1" data-testid={`event-title-${event.id}`}>
                      {event.title}
                    </p>
                    {event.description && (
                      <p className="text-xs text-muted mb-1" data-testid={`event-desc-${event.id}`}>
                        {event.description}
                      </p>
                    )}
                    {/* 来源链接：演示事件不显示，真实事件显示 */}
                    {event.sourceUrl && !isDemo && (
                      <a
                        href={event.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue hover:underline inline-block"
                        data-testid={`event-source-${event.id}`}
                      >
                        {event.sourceName || '查看来源'} ↗
                      </a>
                    )}
                    {/* 用户事件操作 */}
                    {isUser && (
                      <div className="flex items-center gap-2 mt-1 pt-1 border-t border-line/40">
                        {onEditUserEvent && (
                          <button
                            onClick={() => handleEditEvent(event)}
                            className="text-xs text-blue hover:underline"
                            data-testid={`event-edit-${event.id}`}
                          >
                            编辑
                          </button>
                        )}
                        {onDeleteUserEvent && (
                          <button
                            onClick={() => handleDeleteEvent(event)}
                            className="text-xs text-muted hover:text-red transition-colors"
                            data-testid={`event-delete-${event.id}`}
                          >
                            删除
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 本月待定事件（month 精度） */}
      {currentMonthPendingEvents.length > 0 && (
        <div className="mt-2" data-testid="pending-month-events">
          <div className="text-xs font-bold text-ink mb-1">本月观察窗口</div>
          <div className="space-y-1.5">
            {currentMonthPendingEvents.map(event => {
              const meta = STOCK_EVENT_CATEGORY_META[event.category];
              const isUser = isUserEvent(event);
              const isDemo = isCaseDemoEvent(event);
              return (
                <div
                  key={event.id}
                  className="bg-paper border border-dashed border-line rounded p-2"
                  data-testid={`pending-event-${event.id}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${meta.badgeClass}`}>
                      {meta.label}
                    </span>
                    <span className="text-xs text-muted">日期待定</span>
                    {isUser && (
                      <span className="text-xs text-muted bg-gray-100 px-1.5 py-0.5 rounded">
                        用户录入
                      </span>
                    )}
                    {isDemo && (
                      <span className="text-xs text-orange bg-orange/10 px-1.5 py-0.5 rounded" data-testid={`pending-demo-tag-${event.id}`}>
                        演示·非真实日程
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink font-medium">{event.title}</p>
                  {event.description && (
                    <p className="text-xs text-muted mt-0.5">{event.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 统计 + 空状态 + 免责（紧凑单行） */}
      <div className="mt-1.5 flex items-center gap-2 text-xs text-muted/60 flex-wrap">
        {verifiableCount === 0 && (
          <span data-testid="no-system-events" className="text-muted/50">
            未来三个月暂无可核验的系统事件
          </span>
        )}
        <span data-testid="calendar-stats">可核验 {verifiableCount} · 演示 {demoCount} · 用户 {userEventCount}</span>
        <span className="text-muted/40">· 仅供时间管理参考，不代表价格预测或投资建议</span>
      </div>
    </div>
  );
}
