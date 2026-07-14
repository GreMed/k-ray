'use client';

import { useState, useEffect, useCallback } from 'react';
import { HistoricalEvent, EventSource, KeyNode } from '@/types';
import { eventTypeConfigs } from '@/config/eventTypes';
import { sourceTypeLabels } from '@/config/sourceTypeConfig';
import SourceDetailModal from './SourceDetailModal';

interface EventDetailDrawerProps {
  event: HistoricalEvent | null;
  sources: EventSource[]; // 支持多来源
  isOpen: boolean;
  onClose: () => void;
  // 导航相关
  currentIndex?: number;
  totalCount?: number;
  isFromGroup?: boolean;
  relatedNode?: KeyNode | null;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  onBackToList?: () => void;
  // 日期映射相关（非交易日对齐）
  isDateMapped?: boolean;
  mappedTradingDate?: string;
  // 开发环境：自动打开指定来源详情（用于截图辅助）
  autoOpenSourceId?: string | null;
  // 受控的来源详情弹窗状态
  selectedSource?: EventSource | null;
  onSelectSource?: (source: EventSource | null) => void;
}

export default function EventDetailDrawer({
  event,
  sources,
  isOpen,
  onClose,
  currentIndex,
  totalCount,
  isFromGroup,
  relatedNode,
  onNavigatePrev,
  onNavigateNext,
  onBackToList,
  isDateMapped,
  mappedTradingDate,
  autoOpenSourceId,
  selectedSource: controlledSelectedSource,
  onSelectSource,
}: EventDetailDrawerProps) {
  const [internalSelectedSource, setInternalSelectedSource] = useState<EventSource | null>(null);

  // 使用受控状态或内部状态
  const selectedSource = controlledSelectedSource !== undefined
    ? controlledSelectedSource
    : internalSelectedSource;

  const setSelectedSource = useCallback((source: EventSource | null) => {
    if (onSelectSource) {
      onSelectSource(source);
    } else {
      setInternalSelectedSource(source);
    }
  }, [onSelectSource]);

  // 包装 onClose：关闭抽屉时同时清空来源弹窗状态
  const handleClose = useCallback(() => {
    setSelectedSource(null);
    onClose();
  }, [onClose, setSelectedSource]);

  // 包装导航回调：切换事件时同时清空来源弹窗状态
  const handleNavigatePrev = useCallback(() => {
    setSelectedSource(null);
    onNavigatePrev?.();
  }, [onNavigatePrev, setSelectedSource]);

  const handleNavigateNext = useCallback(() => {
    setSelectedSource(null);
    onNavigateNext?.();
  }, [onNavigateNext, setSelectedSource]);

  const handleBackToList = useCallback(() => {
    setSelectedSource(null);
    onBackToList?.();
  }, [onBackToList, setSelectedSource]);

  // 开发环境：自动打开指定来源详情（用于截图辅助直接打开来源弹窗）
  // 仅在 autoOpenSourceId 变化时触发
  useEffect(() => {
    if (autoOpenSourceId && isOpen && sources.length > 0) {
      const target = sources.find(s => s.id === autoOpenSourceId);
      if (target) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedSource(target);
      }
    }
  }, [autoOpenSourceId, isOpen, sources, setSelectedSource]);

  if (!isOpen || !event) return null;

  const config = eventTypeConfigs.find(c => c.type === event.eventType);

  // 是否可以导航
  const hasPrev = currentIndex !== undefined && currentIndex > 1;
  const hasNext = currentIndex !== undefined && totalCount !== undefined && currentIndex < totalCount;
  const hasNavigation = currentIndex !== undefined && totalCount !== undefined;

  // 节点类型映射
  const nodeTypeLabels: Record<string, string> = {
    peak: '阶段性高点',
    bottom: '阶段性低点',
    breakout: '突破信号',
    breakdown: '跌破信号',
    turn: '趋势拐点',
  };

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/50 z-30 transition-opacity"
        onClick={handleClose}
      />

      {/* 抽屉面板 */}
      <div className="fixed top-0 right-0 w-full md:w-[500px] h-full bg-white z-40 shadow-2xl overflow-y-auto" data-testid="event-detail-drawer">
        {/* 头部 */}
        <div className="sticky top-0 bg-white border-b border-line px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: config?.color }}
            />
            <span className="text-xs font-semibold bg-paper px-2 py-1 rounded">
              {config?.label}
            </span>
            {/* 序号显示 */}
            {hasNavigation && (
              <span className="text-xs text-muted font-semibold ml-1">
                {currentIndex} / {totalCount}
              </span>
            )}
          </div>
          <button
            onClick={handleClose}
            className="text-muted hover:text-ink transition-colors text-sm font-semibold"
          >
            ✕ 关闭
          </button>
        </div>

        {/* 导航栏 */}
        {hasNavigation && (
          <div className="sticky top-[57px] bg-paper border-b border-line px-5 py-2 flex items-center justify-between z-10">
            <button
              onClick={handleNavigatePrev}
              disabled={!hasPrev}
              className="text-sm font-semibold text-blue hover:text-blue/80 disabled:text-muted/40 disabled:cursor-not-allowed transition-colors"
            >
              ← 上一条
            </button>

            {isFromGroup ? (
              <button
                onClick={handleBackToList}
                className="text-sm font-semibold text-muted hover:text-ink transition-colors"
              >
                返回事件列表
              </button>
            ) : (
              <span className="text-xs text-muted">事件详情</span>
            )}

            <button
              onClick={handleNavigateNext}
              disabled={!hasNext}
              className="text-sm font-semibold text-blue hover:text-blue/80 disabled:text-muted/40 disabled:cursor-not-allowed transition-colors"
            >
              下一条 →
            </button>
          </div>
        )}

        {/* 内容 */}
        <div className="p-5">
          {/* 事件标题 */}
          <h2 className="text-xl font-bold text-ink mb-4">
            {event.title}
          </h2>

          {/* 演示数据标注 */}
          <div className="mb-4">
            <span className="text-xs text-orange bg-orange/10 px-2 py-1 rounded border border-orange/30 font-semibold">
              演示数据 - 不代表真实事件
            </span>
          </div>

          {/* 基本信息 */}
          <div className="space-y-4">
            {/* 事件类型 */}
            <div>
              <label className="text-sm font-semibold text-muted block mb-1">
                事件类型
              </label>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: config?.color }}
                />
                <span className="text-sm text-ink font-semibold">
                  {config?.label}
                </span>
              </div>
            </div>

            {/* 事件发生时间 */}
            <div>
              <label className="text-sm font-semibold text-muted block mb-1">
                事件发生时间
              </label>
              <time className="text-sm text-ink font-semibold bg-blue/10 px-3 py-2 rounded inline-block">
                {event.occurTime}
              </time>
              {isDateMapped && mappedTradingDate && (
                <div className="mt-2">
                  <label className="text-sm font-semibold text-muted block mb-1">
                    图表对齐交易日
                  </label>
                  <div className="flex items-center gap-2">
                    <time className="text-sm text-orange font-semibold bg-orange/10 px-3 py-2 rounded border border-orange/20">
                      {mappedTradingDate}
                    </time>
                    <span className="text-xs text-orange">
                      该事件发生在非交易日，已对齐至附近交易日展示
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 事件摘要 */}
            <div>
              <label className="text-sm font-semibold text-muted block mb-1">
                事件摘要
              </label>
              <p className="text-sm text-ink leading-relaxed bg-paper p-3 rounded">
                {event.summary}
              </p>
            </div>

            {/* 可能的影响逻辑 */}
            {event.influenceLogic && (
              <div>
                <label className="text-sm font-semibold text-muted block mb-1">
                  可能的影响逻辑
                </label>
                <p className="text-sm text-ink leading-relaxed bg-green/10 p-3 rounded border border-green/20">
                  {event.influenceLogic}
                </p>
              </div>
            )}

            {/* 不确定性提示 */}
            {event.uncertaintyNote && (
              <div>
                <label className="text-sm font-semibold text-red block mb-1">
                  ⚠️ 不确定性提示
                </label>
                <p className="text-sm text-ink leading-relaxed bg-red/10 p-3 rounded border border-red/20">
                  {event.uncertaintyNote}
                </p>
              </div>
            )}

            {/* 对应关键节点信息 */}
            {relatedNode && (
              <div>
                <label className="text-sm font-semibold text-muted block mb-1">
                  对应关键节点
                </label>
                <div className="bg-violet/10 p-3 rounded border border-violet/20">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-violet/20 text-violet px-2 py-0.5 rounded font-semibold">
                      {nodeTypeLabels[relatedNode.nodeType] || relatedNode.nodeType}
                    </span>
                    <span className="text-xs text-muted font-semibold">
                      {relatedNode.date}
                    </span>
                  </div>
                  {relatedNode.description && (
                    <p className="text-sm text-ink">
                      {relatedNode.description}
                    </p>
                  )}
                  <p className="text-xs text-muted mt-1">
                    价格变化：{relatedNode.priceChange > 0 ? '+' : ''}{relatedNode.priceChange}%
                  </p>
                </div>
              </div>
            )}

            {/* 来源列表区域 */}
            <div>
              <label className="text-sm font-semibold text-muted block mb-2">
                来源追溯
              </label>

              {sources.length > 0 ? (
                <div className="space-y-3" data-testid="source-cards-container">
                  {sources.map((source) => (
                    <div
                      key={source.id}
                      data-testid={`source-card-${source.id}`}
                      className="border border-line rounded-lg p-3 bg-white hover:border-blue/40 transition-colors"
                    >
                      {/* 来源名称和类型标签 */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-sm text-ink font-semibold">
                          {source.name}
                        </span>
                        <span className="text-xs text-blue bg-blue/10 px-2 py-0.5 rounded font-semibold border border-blue/20">
                          {sourceTypeLabels[source.type] || source.type}
                        </span>
                        {source.isDemo && (
                          <span className="text-xs text-orange bg-orange/10 px-1.5 py-0.5 rounded border border-orange/20 font-semibold">
                            演示来源
                          </span>
                        )}
                      </div>

                      {/* 来源标题 */}
                      <p className="text-sm text-ink font-semibold mb-1">
                        {source.title}
                      </p>

                      {/* 发布时间和机构 */}
                      <div className="flex items-center gap-3 text-xs text-muted mb-2">
                        <span>{source.publishTime}</span>
                        <span>·</span>
                        <span>{source.publisher}</span>
                      </div>

                      {/* 摘要片段 */}
                      <p className="text-xs text-muted leading-relaxed bg-paper p-2 rounded mb-2">
                        {source.excerpt}
                      </p>

                      {/* 查看演示来源按钮 */}
                      <button
                        data-testid={`view-source-${source.id}`}
                        onClick={() => setSelectedSource(source)}
                        className="text-xs px-3 py-1.5 rounded bg-blue/10 text-blue font-semibold hover:bg-blue/20 transition-colors border border-blue/20"
                      >
                        查看演示来源 →
                      </button>
                    </div>
                  ))}

                  {/* Mock 来源警示 */}
                  <div className="text-xs text-orange bg-orange/5 p-2 rounded border border-orange/10">
                    ⚠️ 以上来源均为演示数据，不代表真实公开资料，不可作为投资决策依据
                  </div>
                </div>
              ) : (
                /* 无来源 fallback */
                <div
                  data-testid="no-source-fallback"
                  className="border border-dashed border-orange/30 rounded-lg p-4 bg-orange/5"
                >
                  <p className="text-sm text-orange font-semibold mb-1">
                    ⚠️ 暂无可追溯来源
                  </p>
                  <p className="text-xs text-muted leading-relaxed">
                    当前演示数据未提供可追溯来源，请勿将该事件解释视为已验证事实。
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 固定提示：事件线索不等于确定因果 */}
          <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-300">
            <p className="text-sm text-yellow-900 font-bold mb-1">
              ⚠️ 事件线索不等于确定因果
            </p>
            <p className="text-xs text-yellow-800 leading-relaxed">
              事件线索仅表示时间上的相邻关系，股价走势受多重因素共同影响，单一事件仅为可能的影响参考线索，不能等同于确定的因果关系。
            </p>
          </div>

          {/* 风险提示 */}
          <div className="mt-4 p-4 bg-ink rounded-lg">
            <p className="text-sm text-white font-semibold mb-2">
              重要提示
            </p>
            <ul className="text-xs text-white/90 space-y-1">
              <li>• 此为演示数据，不代表真实事件</li>
              <li>• 不构成投资建议或交易信号</li>
              <li>• 请结合其他信息自行判断</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 来源详情弹窗 */}
      <SourceDetailModal
        source={selectedSource}
        isOpen={!!selectedSource}
        onClose={() => setSelectedSource(null)}
      />
    </>
  );
}
