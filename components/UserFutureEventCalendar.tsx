'use client';

// 第十一阶段 A：用户维护的未来事件日历
// 展示用户自行录入的未来事件，支持新增、编辑、删除
// 明确标记为"用户录入"，不是系统验证结论

import { useState } from 'react';
import { UserFutureEvent } from '@/types';
import { CATEGORY_LABELS, CATEGORY_BADGE_CLASSES, isValidEventUrl } from '@/services/userFutureEvents';

interface UserFutureEventCalendarProps {
  stockCode: string;
  events: UserFutureEvent[];
  onAdd: () => void;
  onEdit: (event: UserFutureEvent) => void;
  onDelete: (event: UserFutureEvent) => void;
}

// 删除确认弹窗
function DeleteConfirmDialog({
  event,
  onConfirm,
  onCancel,
}: {
  event: UserFutureEvent;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
        data-testid="user-event-delete-overlay"
      />
      <div
        className="relative bg-white rounded-lg shadow-xl w-full max-w-sm"
        data-testid="user-event-delete-dialog"
      >
        <div className="p-4">
          <h3 className="text-base font-semibold text-text mb-2">确认删除</h3>
          <p className="text-sm text-muted mb-1">
            确定要删除以下事件吗？
          </p>
          <p className="text-sm text-text font-medium bg-gray-50 rounded p-2">
            {event.title}
          </p>
          <p className="text-xs text-muted mt-2">
            日期：{event.date}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-line">
          <button
            onClick={onCancel}
            className="text-xs px-4 py-2 text-muted hover:text-text transition-colors"
            data-testid="user-event-delete-cancel"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="text-xs px-4 py-2 bg-red text-white rounded hover:bg-red/80 transition-colors font-semibold"
            data-testid="user-event-delete-confirm"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UserFutureEventCalendar({
  stockCode,
  events,
  onAdd,
  onEdit,
  onDelete,
}: UserFutureEventCalendarProps) {
  // 按日期升序排序
  const sortedEvents = [...events].sort((a, b) => {
    return a.date.localeCompare(b.date);
  });

  const [deleteTarget, setDeleteTarget] = useState<UserFutureEvent | null>(null);

  return (
    <div data-testid="user-future-calendar">
      {/* 标题区 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-text">未来事件日历</h3>
          <span className="text-xs text-muted">用户录入 · {stockCode}</span>
        </div>
        <button
          onClick={onAdd}
          className="text-xs px-3 py-1.5 bg-blue text-white rounded hover:bg-blue/80 transition-colors font-semibold"
          data-testid="user-event-add-btn"
        >
          + 新增事件
        </button>
      </div>

      {/* 固定提示 */}
      <div
        className="mb-4 p-3 bg-gray-50 border border-line rounded text-xs text-muted leading-relaxed"
        data-testid="user-future-calendar-tip"
      >
        未来事件由用户自行录入和维护，仅供时间管理与复盘参考，不代表已验证事实或价格预测。
      </div>

      {/* 空状态 */}
      {sortedEvents.length === 0 ? (
        <div
          className="py-8 text-center text-sm text-muted border border-dashed border-line rounded"
          data-testid="user-future-calendar-empty"
        >
          暂无用户录入的未来事件
        </div>
      ) : (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
          data-testid="user-future-calendar-list"
        >
          {sortedEvents.map((event) => (
            <div
              key={event.id}
              className="bg-white border border-line rounded-lg p-3 hover:border-blue/40 transition-colors"
              data-testid={`user-event-card-${event.id}`}
            >
              {/* 日期 + 类别 */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-text">
                  {event.date}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${CATEGORY_BADGE_CLASSES[event.category]}`}
                  data-testid={`user-event-category-${event.id}`}
                >
                  {CATEGORY_LABELS[event.category]}
                </span>
              </div>

              {/* 标题 */}
              <p className="text-sm text-text font-medium mb-2" data-testid={`user-event-title-${event.id}`}>
                {event.title}
              </p>

              {/* 来源链接标识：合法链接可点击，非法链接显示"链接无效"，无链接显示"未附来源链接" */}
              <div className="mb-2" data-testid={`user-event-source-${event.id}`}>
                {event.originalUrl && isValidEventUrl(event.originalUrl) ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-green">已附来源链接</span>
                    <a
                      href={event.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue hover:underline truncate max-w-[200px]"
                      data-testid={`user-event-link-${event.id}`}
                    >
                      查看原文
                    </a>
                  </div>
                ) : event.originalUrl ? (
                  <span className="text-xs text-muted" data-testid={`user-event-link-invalid-${event.id}`}>
                    链接无效
                  </span>
                ) : (
                  <span className="text-xs text-muted">未附来源链接</span>
                )}
              </div>

              {/* 备注 */}
              {event.note && (
                <p className="text-xs text-muted mb-2 line-clamp-2" data-testid={`user-event-note-${event.id}`}>
                  {event.note}
                </p>
              )}

              {/* 用户录入标记 */}
              <div className="mb-2">
                <span className="text-xs text-muted bg-gray-50 px-2 py-0.5 rounded">
                  用户录入
                </span>
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center gap-2 pt-2 border-t border-line">
                <button
                  onClick={() => onEdit(event)}
                  className="text-xs text-blue hover:underline"
                  data-testid={`user-event-edit-${event.id}`}
                >
                  编辑
                </button>
                <button
                  onClick={() => setDeleteTarget(event)}
                  className="text-xs text-muted hover:text-red transition-colors"
                  data-testid={`user-event-delete-${event.id}`}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <DeleteConfirmDialog
          event={deleteTarget}
          onConfirm={() => {
            onDelete(deleteTarget);
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
