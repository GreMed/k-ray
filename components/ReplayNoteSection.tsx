'use client';

import { useState, useCallback } from 'react';
import { MarketKeyNode, ReplayNote } from '@/types';
import { KEY_NODE_TYPE_META, getChangeColorClass } from '@/utils/keyNodeConfig';
import { loadNote, addNote, updateNote, deleteNote } from '@/services/replayNotes';

interface ReplayNoteSectionProps {
  node: MarketKeyNode;
  stockCode: string;
  // 外部刷新触发器（如开发工具修改笔记后递增，通过 key 重新挂载触发重新加载）
  refreshKey: number;
}

export default function ReplayNoteSection({ node, stockCode }: ReplayNoteSectionProps) {
  // 懒初始化：首次挂载时从 localStorage 加载
  // 父组件通过 key={stockCode-nodeId-refreshKey} 保证节点或刷新变化时重新挂载
  const [note, setNote] = useState<ReplayNote | null>(() => {
    if (!stockCode || !node) return null;
    return loadNote(stockCode, node.id);
  });
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');

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

    if (note) {
      // 编辑现有笔记
      const updated = updateNote(stockCode, note.id, content.trim());
      if (updated) {
        setNote(updated);
      }
    } else {
      // 新增笔记
      const created = addNote(stockCode, {
        date: node.date,
        nodeId: node.id,
        nodeType: node.type,
        changePercent: node.changePercent,
        content: content.trim(),
      });
      setNote(created);
    }
    setIsEditing(false);
    setContent('');
    setError('');
  }, [content, note, stockCode, node]);

  const handleDelete = useCallback(() => {
    if (!note) return;
    const success = deleteNote(stockCode, note.id);
    if (success) {
      setNote(null);
      setShowDeleteConfirm(false);
    }
  }, [note, stockCode]);

  // 格式化时间显示
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

  const meta = KEY_NODE_TYPE_META[node.type];
  const isUp = node.changePercent >= 0;

  return (
    <div data-testid="replay-note-section" className="mb-5">
      {/* 标题 */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-bold text-ink">我的复盘笔记</div>
        {!note && !isEditing && (
          <button
            onClick={handleStartAdd}
            className="text-xs text-blue hover:underline font-medium"
            data-testid="replay-note-add-btn"
          >
            + 新增笔记
          </button>
        )}
      </div>

      {/* 固定提示 */}
      <div
        data-testid="replay-note-tip"
        className="p-3 bg-paper rounded-lg border border-line mb-3"
      >
        <p className="text-xs text-muted leading-relaxed">
          笔记由用户自行记录，仅供个人复盘参考，不代表已验证事实、因果关系或价格预测。
        </p>
      </div>

      {/* 空状态 */}
      {!note && !isEditing && (
        <div
          data-testid="replay-note-empty"
          className="bg-paper p-4 rounded-lg border border-line text-center"
        >
          <div className="text-sm text-muted">暂无复盘笔记</div>
          <div className="text-xs text-muted/70 mt-1">
            点击「新增笔记」记录你对该节点的观察。
          </div>
        </div>
      )}

      {/* 编辑/新增表单 */}
      {isEditing && (
        <div
          data-testid="replay-note-form"
          className="bg-white border border-line rounded-lg p-3"
        >
          {/* 节点信息摘要 */}
          <div className="flex items-center gap-2 mb-2 text-xs text-muted">
            <span className="font-bold text-ink">{stockCode}</span>
            <span>·</span>
            <span>{node.date}</span>
            <span>·</span>
            <span className={`font-bold px-1.5 py-0.5 rounded border ${meta.badgeClass}`}>
              {node.title}
            </span>
            <span>·</span>
            <span className={`font-bold ${getChangeColorClass(node.changePercent)}`}>
              {isUp ? '+' : ''}{node.changePercent.toFixed(2)}%
            </span>
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="记录你对这个节点的观察和思考..."
            className="w-full px-3 py-2 text-sm border border-line rounded focus:outline-none focus:border-blue resize-y min-h-[100px]"
            data-testid="replay-note-textarea"
            autoFocus
          />

          {error && (
            <p className="text-xs text-red mt-1" data-testid="replay-note-form-error">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleSave}
              className="text-xs px-3 py-1.5 rounded bg-blue text-white font-semibold hover:bg-blue/80 transition-colors"
              data-testid="replay-note-save-btn"
            >
              保存
            </button>
            <button
              onClick={handleCancelEdit}
              className="text-xs px-3 py-1.5 rounded text-muted hover:text-ink font-medium transition-colors"
              data-testid="replay-note-cancel-btn"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 笔记展示 */}
      {note && !isEditing && (
        <div
          data-testid="replay-note-card"
          className="bg-white border border-line rounded-lg p-3"
        >
          {/* 用户标记 */}
          <div className="flex items-center gap-2 mb-2">
            <span
              data-testid="replay-note-user-badge"
              className="text-xs font-bold px-2 py-0.5 rounded bg-violet/10 text-violet border border-violet/20"
            >
              用户记录
            </span>
          </div>

          {/* 节点信息 */}
          <div className="flex items-center gap-2 mb-2 text-xs text-muted">
            <span className="font-bold text-ink">{note.stockCode}</span>
            <span>·</span>
            <span data-testid="replay-note-node-date">{note.date}</span>
            <span>·</span>
            <span className={`font-bold px-1.5 py-0.5 rounded border ${meta.badgeClass}`}>
              {node.title}
            </span>
            <span>·</span>
            {note.changePercent !== null && (
              <span
                className={`font-bold ${getChangeColorClass(note.changePercent)}`}
                data-testid="replay-note-change-percent"
              >
                {note.changePercent >= 0 ? '+' : ''}{note.changePercent.toFixed(2)}%
              </span>
            )}
          </div>

          {/* 笔记内容 */}
          <div
            data-testid="replay-note-content"
            className="text-sm text-ink leading-relaxed whitespace-pre-wrap mb-2"
          >
            {note.content}
          </div>

          {/* 时间信息 */}
          <div className="flex items-center gap-3 text-xs text-muted/70 mb-2">
            <span data-testid="replay-note-created-at">
              创建：{formatTime(note.createdAt)}
            </span>
            <span data-testid="replay-note-updated-at">
              修改：{formatTime(note.updatedAt)}
            </span>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-3 pt-2 border-t border-line">
            <button
              onClick={handleStartEdit}
              className="text-xs text-blue hover:underline font-medium"
              data-testid="replay-note-edit-btn"
            >
              编辑
            </button>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-xs text-muted hover:text-red font-medium transition-colors"
                data-testid="replay-note-delete-btn"
              >
                删除
              </button>
            ) : (
              <span
                data-testid="replay-note-delete-confirm-dialog"
                className="flex items-center gap-2"
              >
                <span className="text-xs text-muted">确认删除？</span>
                <button
                  onClick={handleDelete}
                  className="text-xs text-red hover:underline font-medium"
                  data-testid="replay-note-delete-confirm"
                >
                  确认删除
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-xs text-muted hover:text-ink font-medium"
                  data-testid="replay-note-delete-cancel"
                >
                  取消
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
