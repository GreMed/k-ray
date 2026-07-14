'use client';

import { useState, useCallback, useMemo } from 'react';
import { KLineData, MarketKeyNode } from '@/types';
import { KEY_NODE_TYPE_META } from '@/utils/keyNodeConfig';
import { loadNoteByDate, addNote, updateNote, deleteNote } from '@/services/replayNotes';

interface TradingDayNotePanelProps {
  stockCode: string;
  stockName: string;
  selectedDate: string | null;
  klines: KLineData[];
  marketKeyNodes: MarketKeyNode[];
  // 笔记变更后回调（通知父组件刷新 marker）
  onNoteChanged?: () => void;
}

export default function TradingDayNotePanel({
  stockCode,
  selectedDate,
  klines,
  marketKeyNodes,
  onNoteChanged,
  // stockName 不再使用：第十七阶段 UI 收口已删除 OHLCV 摘要，股票名称不再在笔记中展示
}: TradingDayNotePanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');
  // 笔记版本号：保存/删除后递增，触发 currentNote 重新计算
  const [noteVersion, setNoteVersion] = useState(0);

  // 草稿隔离：当 stockCode 或 selectedDate 变化时，必须退出编辑状态并清空草稿和错误提示，
  // 防止日期 A 的草稿串到日期 B 或上一只股票的草稿串到当前股票。
  // 使用 "adjust during render" 模式（React 官方推荐），避免 useEffect 中 setState 触发级联渲染。
  const [prevStockCode, setPrevStockCode] = useState(stockCode);
  const [prevSelectedDate, setPrevSelectedDate] = useState(selectedDate);
  if (stockCode !== prevStockCode || selectedDate !== prevSelectedDate) {
    setPrevStockCode(stockCode);
    setPrevSelectedDate(selectedDate);
    setIsEditing(false);
    setContent('');
    setError('');
    setShowDeleteConfirm(false);
  }

  // 派生当前笔记：选中日期变化或 noteVersion 变化时重新加载
  // 只加载该股票、该日期已经保存的笔记，不会加载草稿
  const note = useMemo(() => {
    if (!stockCode || !selectedDate) return null;
    return loadNoteByDate(stockCode, selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockCode, selectedDate, noteVersion]);

  // 查找当前日期对应的 K 线数据（仅用于校验日期有效性）
  const kline = selectedDate ? klines.find(k => k.date === selectedDate) : null;
  // 查找当前日期是否是关键节点
  const marketKeyNode = selectedDate
    ? marketKeyNodes.find(n => n.date === selectedDate) || null
    : null;

  const handleStartAdd = useCallback(() => {
    setIsEditing(true);
    setContent('');
    setError('');
  }, []);

  const handleStartEdit = useCallback(() => {
    if (!note) return;
    setIsEditing(true);
    setContent(note.content);
    setError('');
  }, [note]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setContent('');
    setError('');
  }, []);

  const handleSave = useCallback(() => {
    if (!content.trim()) {
      setError('请输入笔记内容');
      return;
    }
    if (!selectedDate) return;

    if (note) {
      updateNote(stockCode, note.id, content.trim());
    } else {
      addNote(stockCode, {
        date: selectedDate,
        nodeId: marketKeyNode?.id || null,
        nodeType: marketKeyNode?.type || null,
        changePercent: marketKeyNode?.changePercent ?? null,
        content: content.trim(),
      });
    }
    setIsEditing(false);
    setContent('');
    setError('');
    setNoteVersion(v => v + 1);
    onNoteChanged?.();
  }, [content, note, stockCode, selectedDate, marketKeyNode, onNoteChanged]);

  const handleDelete = useCallback(() => {
    if (!note) return;
    const success = deleteNote(stockCode, note.id);
    if (success) {
      setShowDeleteConfirm(false);
      setNoteVersion(v => v + 1);
      onNoteChanged?.();
    }
  }, [note, stockCode, onNoteChanged]);

  const formatTime = (iso: string): string => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  // 第十七阶段 UI 收口：卡片样式自包含，外层 wrapper 不再添加重复样式
  const cardClass = 'border border-line rounded-lg bg-white p-2 flex flex-col';

  // 空状态：未选择日期
  if (!selectedDate) {
    return (
      <div data-testid="trading-day-note-panel" className={`${cardClass} h-full`}>
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm font-bold text-ink">我的复盘笔记</div>
        </div>
        <div
          data-testid="trading-day-note-empty"
          className="flex-1 text-xs text-muted text-center flex items-center justify-center py-4"
        >
          点击行情图中的交易日开始记录
        </div>
        <p className="text-xs text-muted/50 mt-1">用户个人记录，非系统验证结论</p>
      </div>
    );
  }

  // 选中日期但该日期不在 K 线数据中（不应该发生，但做防御）
  if (!kline) {
    return (
      <div data-testid="trading-day-note-panel" className={`${cardClass} h-full`}>
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm font-bold text-ink">我的复盘笔记</div>
        </div>
        <div className="flex-1 text-xs text-muted text-center flex items-center justify-center py-4">
          日期 {selectedDate} 不在当前行情数据中
        </div>
      </div>
    );
  }

  return (
    <div data-testid="trading-day-note-panel" className={cardClass}>
      {/* 标题 + 日期 + 节点标签（紧凑单行） */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-bold text-ink">我的复盘笔记</span>
          {/* 当日摘要：仅日期 + 节点标签，不重复 OHLCV */}
          <span data-testid="trading-day-summary" className="flex items-center gap-1.5">
            <span className="text-xs text-muted">{selectedDate}</span>
            {marketKeyNode && (
              <span
                className={`text-xs font-bold px-1.5 py-0.5 rounded border ${KEY_NODE_TYPE_META[marketKeyNode.type].badgeClass}`}
                data-testid="trading-day-note-node-badge"
              >
                {marketKeyNode.title}
              </span>
            )}
          </span>
        </div>
        {!note && !isEditing && (
          <button
            onClick={handleStartAdd}
            className="text-xs text-blue hover:underline font-medium"
            data-testid="trading-day-note-add-btn"
          >
            + 新增
          </button>
        )}
      </div>

      {/* 编辑/新增表单 */}
      {isEditing && (
        <div data-testid="trading-day-note-form" className="mb-1.5">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="记录你对这个交易日的观察和思考..."
            className="w-full px-2 py-1.5 text-xs border border-line rounded focus:outline-none focus:border-blue resize-y min-h-[64px] max-h-[120px]"
            data-testid="trading-day-note-textarea"
            autoFocus
          />
          {error && (
            <p className="text-xs text-red mt-1" data-testid="trading-day-note-form-error">
              {error}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <button
              onClick={handleSave}
              className="text-xs px-2.5 py-1 rounded bg-blue text-white font-semibold hover:bg-blue/80 transition-colors"
              data-testid="trading-day-note-save-btn"
            >
              保存
            </button>
            <button
              onClick={handleCancelEdit}
              className="text-xs px-2.5 py-1 rounded text-muted hover:text-ink font-medium transition-colors"
              data-testid="trading-day-note-cancel-btn"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 笔记展示 */}
      {note && !isEditing && (
        <div data-testid="trading-day-note-card" className="bg-paper rounded border border-line/60 p-2 mb-1.5">
          <div className="flex items-center gap-1.5 mb-1">
            <span
              data-testid="trading-day-note-user-badge"
              className="text-xs font-bold px-1.5 py-0.5 rounded bg-violet/10 text-violet"
            >
              用户记录
            </span>
          </div>

          <div
            data-testid="trading-day-note-content"
            className="text-xs text-ink leading-relaxed whitespace-pre-wrap mb-1"
          >
            {note.content}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted/60 mb-1">
            <span data-testid="trading-day-note-created-at">
              创建：{formatTime(note.createdAt)}
            </span>
            <span data-testid="trading-day-note-updated-at">
              修改：{formatTime(note.updatedAt)}
            </span>
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-line/40">
            <button
              onClick={handleStartEdit}
              className="text-xs text-blue hover:underline font-medium"
              data-testid="trading-day-note-edit-btn"
            >
              编辑
            </button>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-xs text-muted hover:text-red font-medium transition-colors"
                data-testid="trading-day-note-delete-btn"
              >
                删除
              </button>
            ) : (
              <span
                data-testid="trading-day-note-delete-confirm-dialog"
                className="flex items-center gap-1.5"
              >
                <span className="text-xs text-muted">确认删除？</span>
                <button
                  onClick={handleDelete}
                  className="text-xs text-red hover:underline font-medium"
                  data-testid="trading-day-note-delete-confirm"
                >
                  确认
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-xs text-muted hover:text-ink font-medium transition-colors"
                  data-testid="trading-day-note-delete-cancel"
                >
                  取消
                </button>
              </span>
            )}
          </div>
        </div>
      )}

      {/* 空状态：选择了日期但无笔记 */}
      {!note && !isEditing && (
        <div
          data-testid="trading-day-note-no-note"
          className="text-xs text-muted text-center py-2 bg-paper rounded border border-line/60 mb-1.5"
        >
          该交易日暂无笔记
        </div>
      )}

      {/* 边界说明：单行小字 */}
      <p className="text-xs text-muted/50 mt-auto">用户个人记录，非系统验证结论</p>
    </div>
  );
}
