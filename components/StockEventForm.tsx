'use client';

// 第十六阶段 里程碑二：用户事件新增/编辑表单
// 使用统一 StockEventCategory 类别体系
// 存储层委托给 userFutureEvents 服务（向后兼容旧数据）

import { useState, useEffect, useCallback } from 'react';
import { StockEvent, StockEventCategory } from '@/types';
import { STOCK_EVENT_CATEGORY_META, isFutureDate, isValidEventUrl } from '@/services/stockEvents';

// 用户可选的类别（不含系统专用类别）
const USER_SELECTABLE_CATEGORIES: StockEventCategory[] = [
  'earnings_scheduled',
  'shareholder_meeting',
  'lockup_expiry',
  'company_event',
  'industry_conference',
  'other',
];

// 表单初始值：编辑模式从 event 读取，新增模式为空
function getInitialValues(mode: 'add' | 'edit', event: StockEvent | null) {
  if (mode === 'edit' && event) {
    return {
      date: event.date || '',
      title: event.title,
      category: event.category,
      sourceUrl: event.sourceUrl || '',
      description: event.description || '',
    };
  }
  return {
    date: '',
    title: '',
    category: 'earnings_scheduled' as StockEventCategory,
    sourceUrl: '',
    description: '',
  };
}

interface StockEventFormProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  event: StockEvent | null;
  stockCode: string;
  onSave: (data: {
    date: string;
    title: string;
    category: StockEventCategory;
    sourceUrl?: string;
    description: string;
  }) => void;
  onCancel: () => void;
}

export default function StockEventForm({
  isOpen,
  mode,
  event,
  stockCode,
  onSave,
  onCancel,
}: StockEventFormProps) {
  // 懒初始化：父组件通过 key 重新挂载保证表单状态正确
  const [date, setDate] = useState(() => getInitialValues(mode, event).date);
  const [title, setTitle] = useState(() => getInitialValues(mode, event).title);
  const [category, setCategory] = useState<StockEventCategory>(() => getInitialValues(mode, event).category);
  const [sourceUrl, setSourceUrl] = useState(() => getInitialValues(mode, event).sourceUrl);
  const [description, setDescription] = useState(() => getInitialValues(mode, event).description);
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

    if (sourceUrl.trim() && !isValidEventUrl(sourceUrl)) {
      newErrors.url = '链接必须以 http:// 或 https:// 开头';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [date, title, sourceUrl]);

  const handleSubmit = useCallback(() => {
    if (!validate()) return;
    onSave({
      date,
      title: title.trim(),
      category,
      sourceUrl: sourceUrl.trim() || undefined,
      description: description.trim(),
    });
  }, [validate, date, title, category, sourceUrl, description, onSave]);

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
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
        data-testid="stock-event-form-overlay"
      />
      <div
        className="relative bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        data-testid="stock-event-form"
      >
        <div className="flex items-center justify-between p-4 border-b border-line">
          <h3 className="text-base font-semibold text-ink">
            {mode === 'add' ? '新增未来事件' : '编辑未来事件'}
          </h3>
          <button
            onClick={onCancel}
            className="text-muted hover:text-ink transition-colors"
            data-testid="stock-event-form-close"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">股票代码</label>
            <div className="text-sm text-ink px-3 py-2 bg-paper rounded border border-line">
              {stockCode}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              事件日期 <span className="text-red">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-line rounded focus:outline-none focus:border-blue"
              data-testid="stock-event-form-date"
            />
            {errors.date && (
              <p className="text-xs text-red mt-1" data-testid="stock-event-form-date-error">
                {errors.date}
              </p>
            )}
          </div>

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
              data-testid="stock-event-form-title"
            />
            {errors.title && (
              <p className="text-xs text-red mt-1" data-testid="stock-event-form-title-error">
                {errors.title}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">事件类别</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as StockEventCategory)}
              className="w-full px-3 py-2 text-sm border border-line rounded focus:outline-none focus:border-blue bg-white"
              data-testid="stock-event-form-category"
            >
              {USER_SELECTABLE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {STOCK_EVENT_CATEGORY_META[cat].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              来源链接 <span className="text-muted">(可选)</span>
            </label>
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 text-sm border border-line rounded focus:outline-none focus:border-blue"
              data-testid="stock-event-form-url"
            />
            {errors.url && (
              <p className="text-xs text-red mt-1" data-testid="stock-event-form-url-error">
                {errors.url}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">备注</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可记录关注理由、待办事项等"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-line rounded focus:outline-none focus:border-blue resize-none"
              data-testid="stock-event-form-note"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-line">
          <button
            onClick={onCancel}
            className="text-xs px-4 py-2 text-muted hover:text-ink transition-colors"
            data-testid="stock-event-form-cancel"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="text-xs px-4 py-2 bg-blue text-white rounded hover:bg-blue/80 transition-colors font-semibold"
            data-testid="stock-event-form-save"
          >
            {mode === 'add' ? '新增' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
