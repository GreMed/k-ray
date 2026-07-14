'use client';

// 第十一阶段 A：用户未来事件新增/编辑表单
// 作为模态弹窗展示，包含日期、标题、类别、链接、备注字段

import { useState, useEffect, useCallback } from 'react';
import { UserFutureEvent, UserFutureEventCategory } from '@/types';
import { isFutureDate, isValidEventUrl, CATEGORY_LABELS } from '@/services/userFutureEvents';

// 表单初始值：编辑模式从 event 读取，新增模式为空
function getInitialValues(mode: 'add' | 'edit', event: UserFutureEvent | null) {
  if (mode === 'edit' && event) {
    return {
      date: event.date,
      title: event.title,
      category: event.category,
      originalUrl: event.originalUrl || '',
      note: event.note,
    };
  }
  return {
    date: '',
    title: '',
    category: 'performance' as UserFutureEventCategory,
    originalUrl: '',
    note: '',
  };
}

interface UserFutureEventFormProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  event: UserFutureEvent | null; // 编辑时传入
  stockCode: string;
  onSave: (data: {
    date: string;
    title: string;
    category: UserFutureEventCategory;
    originalUrl?: string;
    note: string;
  }) => void;
  onCancel: () => void;
}

export default function UserFutureEventForm({
  isOpen,
  mode,
  event,
  stockCode,
  onSave,
  onCancel,
}: UserFutureEventFormProps) {
  // 懒初始化：父组件通过 key 重新挂载保证表单状态正确
  const [date, setDate] = useState(() => getInitialValues(mode, event).date);
  const [title, setTitle] = useState(() => getInitialValues(mode, event).title);
  const [category, setCategory] = useState<UserFutureEventCategory>(() => getInitialValues(mode, event).category);
  const [originalUrl, setOriginalUrl] = useState(() => getInitialValues(mode, event).originalUrl);
  const [note, setNote] = useState(() => getInitialValues(mode, event).note);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!date) {
      newErrors.date = '请选择事件日期';
    } else if (!isFutureDate(date)) {
      newErrors.date = '事件日期必须晚于今天';
    }

    if (!title.trim()) {
      newErrors.title = '请输入事件标题';
    }

    // 原始链接校验：为空合法，非空必须 http:// 或 https://
    if (originalUrl.trim() && !isValidEventUrl(originalUrl)) {
      newErrors.url = '链接必须以 http:// 或 https:// 开头';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [date, title, originalUrl]);

  const handleSubmit = useCallback(() => {
    if (!validate()) return;
    onSave({
      date,
      title: title.trim(),
      category,
      originalUrl: originalUrl.trim() || undefined,
      note: note.trim(),
    });
  }, [validate, date, title, category, originalUrl, note, onSave]);

  // ESC 关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
        data-testid="user-event-form-overlay"
      />

      {/* 表单主体 */}
      <div
        className="relative bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        data-testid="user-event-form"
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-line">
          <h3 className="text-base font-semibold text-text">
            {mode === 'add' ? '新增未来事件' : '编辑未来事件'}
          </h3>
          <button
            onClick={onCancel}
            className="text-muted hover:text-text transition-colors"
            data-testid="user-event-form-close"
          >
            ✕
          </button>
        </div>

        {/* 表单内容 */}
        <div className="p-4 space-y-4">
          {/* 股票代码（只读） */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1">股票代码</label>
            <div className="text-sm text-text px-3 py-2 bg-gray-50 rounded border border-line">
              {stockCode}
            </div>
          </div>

          {/* 日期 */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              事件日期 <span className="text-red">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-line rounded focus:outline-none focus:border-blue"
              data-testid="user-event-form-date"
            />
            {errors.date && (
              <p className="text-xs text-red mt-1" data-testid="user-event-form-date-error">
                {errors.date}
              </p>
            )}
          </div>

          {/* 标题 */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              事件标题 <span className="text-red">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="如：2024年三季度财报披露"
              className="w-full px-3 py-2 text-sm border border-line rounded focus:outline-none focus:border-blue"
              data-testid="user-event-form-title"
            />
            {errors.title && (
              <p className="text-xs text-red mt-1" data-testid="user-event-form-title-error">
                {errors.title}
              </p>
            )}
          </div>

          {/* 类别 */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1">事件类别</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as UserFutureEventCategory)}
              className="w-full px-3 py-2 text-sm border border-line rounded focus:outline-none focus:border-blue bg-white"
              data-testid="user-event-form-category"
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* 原始链接 */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              原始链接 <span className="text-muted">(可选)</span>
            </label>
            <input
              type="url"
              value={originalUrl}
              onChange={(e) => setOriginalUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 text-sm border border-line rounded focus:outline-none focus:border-blue"
              data-testid="user-event-form-url"
            />
            {errors.url && (
              <p className="text-xs text-red mt-1" data-testid="user-event-form-url-error">
                {errors.url}
              </p>
            )}
          </div>

          {/* 备注 */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1">用户备注</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="可记录关注理由、待办事项等"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-line rounded focus:outline-none focus:border-blue resize-none"
              data-testid="user-event-form-note"
            />
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-line">
          <button
            onClick={onCancel}
            className="text-xs px-4 py-2 text-muted hover:text-text transition-colors"
            data-testid="user-event-form-cancel"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="text-xs px-4 py-2 bg-blue text-white rounded hover:bg-blue/80 transition-colors font-semibold"
            data-testid="user-event-form-save"
          >
            {mode === 'add' ? '新增' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
