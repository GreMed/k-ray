'use client';

import { EventSource } from '@/types';
import { sourceTypeLabels } from '@/config/sourceTypeConfig';

interface SourceDetailModalProps {
  source: EventSource | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function SourceDetailModal({
  source,
  isOpen,
  onClose,
}: SourceDetailModalProps) {
  if (!isOpen || !source) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={onClose}
        data-testid="source-detail-overlay"
      />

      {/* 弹窗面板 */}
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[500px] max-h-[80vh] bg-white rounded-lg shadow-2xl z-50 overflow-y-auto"
        data-testid="source-detail-modal"
      >
        {/* 头部 */}
        <div className="sticky top-0 bg-white border-b border-line px-5 py-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-ink">来源详情</span>
            <span className="text-xs text-blue bg-blue/10 px-2 py-0.5 rounded font-semibold border border-blue/20">
              {sourceTypeLabels[source.type] || source.type}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink transition-colors text-sm font-semibold"
            data-testid="source-detail-close"
          >
            ✕ 关闭
          </button>
        </div>

        {/* 内容 */}
        <div className="p-5 space-y-4">
          {/* 来源标题 */}
          <div>
            <label className="text-sm font-semibold text-muted block mb-1">
              来源标题
            </label>
            <h3 className="text-base text-ink font-bold leading-relaxed">
              {source.title}
            </h3>
          </div>

          {/* 来源名称 */}
          <div>
            <label className="text-sm font-semibold text-muted block mb-1">
              来源名称
            </label>
            <p className="text-sm text-ink font-semibold">
              {source.name}
            </p>
          </div>

          {/* 发布机构 */}
          <div>
            <label className="text-sm font-semibold text-muted block mb-1">
              发布机构
            </label>
            <p className="text-sm text-ink" data-testid="source-detail-publisher">
              {source.publisher}
            </p>
          </div>

          {/* 发布时间 */}
          <div>
            <label className="text-sm font-semibold text-muted block mb-1">
              发布时间
            </label>
            <time className="text-sm text-ink" data-testid="source-detail-time">
              {source.publishTime}
            </time>
          </div>

          {/* 来源类型 */}
          <div>
            <label className="text-sm font-semibold text-muted block mb-1">
              来源类型
            </label>
            <span className="text-xs text-blue bg-blue/10 px-2 py-1 rounded font-semibold border border-blue/20" data-testid="source-detail-type">
              {sourceTypeLabels[source.type] || source.type}
            </span>
          </div>

          {/* 摘要或引用片段 */}
          <div>
            <label className="text-sm font-semibold text-muted block mb-1">
              摘要 / 引用片段
            </label>
            <p
              className="text-sm text-ink leading-relaxed bg-paper p-3 rounded"
              data-testid="source-detail-excerpt"
            >
              {source.excerpt}
            </p>
          </div>

          {/* 原文地址 - 不外跳，仅展示 */}
          {source.url && (
            <div>
              <label className="text-sm font-semibold text-muted block mb-1">
                演示地址（不可访问）
              </label>
              <div className="text-sm text-muted break-all block bg-paper p-2 rounded border border-dashed border-line">
                {source.url}
              </div>
            </div>
          )}

          {/* 演示来源警示 - 始终可见 */}
          <div
            className="p-4 bg-orange/10 rounded-lg border border-orange/30"
            data-testid="source-detail-demo-warning"
          >
            <p className="text-sm text-orange font-bold mb-1">
              ⚠️ 演示来源，不代表真实公开资料
            </p>
            <p className="text-xs text-muted leading-relaxed">
              此来源信息为本地演示数据构造，不指向真实可验证的公开资料。不可作为投资决策依据，不代表已核实或权威证明。
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
