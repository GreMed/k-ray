'use client';

import { useState, useEffect } from 'react';
import { MarketKeyNode } from '@/types';
import { KEY_NODE_TYPE_META, getChangeColorClass, formatVolume } from '@/utils/keyNodeConfig';
import ReplayNoteSection from '@/components/ReplayNoteSection';

// 候选新闻条目类型（与第十阶段 A 一致，但独立定义避免客户端打包服务端代码）
interface EventCandidateItem {
  id: string;
  queryStockCode: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  publisher: string;
  originalUrl: string;
  acquisitionProvider: string;
  upstreamPlatform: string;
  matchedStockCodes: string[];
  stockRelevanceStatus: 'verified' | 'unverified';
  verificationReason: string;
  dataMode: string;
  isRealEventCandidate: boolean;
  isMultiStockSummary?: boolean;
  fetchedAt: string;
}

interface NodeEventCandidateMeta {
  dataMode: string;
  provider: string;
  upstreamPlatform: string;
  sourceLabel: string;
  isRealData: boolean;
  fetchedAt: string;
  nodeDate: string;
  windowStart: string;
  windowEnd: string;
  totalCount: number;
  verifiedCount: number;
  unverifiedCount: number;
  multiStockSummaryCount: number;
  originalTotalCount: number;
  fallbackReason?: string;
  cacheStatus: string;
}

interface NodeEventCandidateResult {
  candidates: EventCandidateItem[];
  meta: NodeEventCandidateMeta;
}

interface NodeEventDrawerProps {
  node: MarketKeyNode | null;
  stockCode: string;
  market: 'SH' | 'SZ';
  isOpen: boolean;
  onClose: () => void;
  // 第十二阶段 A：笔记刷新触发器（开发工具修改笔记后递增，触发 ReplayNoteSection 重新加载）
  noteRefreshKey?: number;
}

export default function NodeEventDrawer({
  node,
  stockCode,
  market,
  isOpen,
  onClose,
  noteRefreshKey = 0,
}: NodeEventDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<NodeEventCandidateResult | null>(null);

  useEffect(() => {
    if (!isOpen || !node) return;
    let cancelled = false;

    const loadCandidates = async () => {
      setLoading(true);
      setError('');
      setResult(null);

      try {
        const params = new URLSearchParams({
          stockCode,
          market,
          nodeDate: node.date,
        });
        const res = await fetch(`/api/node-event-candidates?${params.toString()}`);
        if (cancelled) return;
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || `HTTP ${res.status}`);
          return;
        }

        setResult(data as NodeEventCandidateResult);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '请求失败');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadCandidates();

    return () => {
      cancelled = true;
    };
  }, [isOpen, node, stockCode, market]);

  if (!isOpen || !node) return null;

  const meta = KEY_NODE_TYPE_META[node.type];
  const isUp = node.changePercent >= 0;

  // 模式徽标
  const getModeBadge = (resultMeta: NodeEventCandidateMeta) => {
    if (resultMeta.fallbackReason) return { text: 'Fallback 降级', color: '#d97706', bg: '#fffbeb', border: '#fde68a' };
    if (resultMeta.isRealData) return { text: 'Real 真实', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' };
    return { text: 'Mock 演示', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' };
  };

  // 相关性徽标
  const getRelevanceBadge = (status: string) => {
    if (status === 'verified') return { text: '已验证相关', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' };
    return { text: '待人工确认', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' };
  };

  // 提取域名
  const extractDomain = (url: string): string => {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  };

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/40 z-30"
        onClick={onClose}
        data-testid="node-event-drawer-overlay"
      />

      {/* 抽屉 */}
      <div
        className="fixed top-0 right-0 w-full md:w-[460px] h-full bg-white z-40 shadow-2xl overflow-y-auto"
        data-testid="node-event-drawer"
      >
        {/* 头部 */}
        <div className="sticky top-0 bg-white border-b border-line px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-1 rounded border ${meta.badgeClass}`}>
              {node.title}
            </span>
            <span className="text-xs text-muted">事件候选</span>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink text-sm font-semibold px-2 py-1 rounded hover:bg-paper transition-colors"
            data-testid="node-event-drawer-close"
          >
            ✕ 关闭
          </button>
        </div>

        <div className="p-5">
          {/* ========== 关键节点信息 ========== */}
          <div data-testid="node-event-section-info" className="mb-5">
            <div className="text-sm font-bold text-ink mb-3">关键节点</div>
            <div className="space-y-3 bg-paper p-4 rounded-lg border border-line">
              {/* 股票代码 + 日期 */}
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-xs text-muted block mb-1">股票代码</label>
                  <span className="text-sm text-ink font-bold">{node.stockCode}</span>
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">日期</label>
                  <time className="text-sm text-ink font-bold bg-violet/10 px-2 py-1 rounded border border-violet/20 inline-block">
                    {node.date}
                  </time>
                </div>
              </div>

              {/* 收盘价 + 涨跌幅 */}
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-xs text-muted block mb-1">收盘价</label>
                  <span className="text-sm text-ink font-bold">{node.close.toFixed(2)}</span>
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">涨跌幅</label>
                  <span
                    className={`text-sm font-bold px-2 py-1 rounded border inline-block ${getChangeColorClass(node.changePercent)}`}
                    data-testid="node-event-change-percent"
                  >
                    {isUp ? '+' : ''}{node.changePercent.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* 节点类型 + 成交量 */}
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-xs text-muted block mb-1">节点类型</label>
                  <span className={`text-xs font-bold px-2 py-1 rounded border inline-block ${meta.badgeClass}`}>
                    {node.title}
                  </span>
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">成交量</label>
                  <span className="text-sm text-ink font-bold">{formatVolume(node.volume)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ========== 检索范围 ========== */}
          <div data-testid="node-event-section-window" className="mb-5">
            <div className="text-sm font-bold text-ink mb-3">检索范围</div>
            <div className="bg-paper p-4 rounded-lg border border-line">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted">节点日</span>
                <span className="text-ink font-bold">{node.date}</span>
                <span className="text-muted">前后各</span>
                <span className="text-ink font-bold">3</span>
                <span className="text-muted">个自然日</span>
              </div>
              {result && (
                <div className="flex items-center gap-2 text-xs text-muted mt-2">
                  <span>窗口：</span>
                  <span data-testid="node-event-window-start">{result.meta.windowStart}</span>
                  <span>~</span>
                  <span data-testid="node-event-window-end">{result.meta.windowEnd}</span>
                </div>
              )}
            </div>
          </div>

          {/* ========== 事件候选 ========== */}
          <div data-testid="node-event-section-candidates" className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-bold text-ink">事件候选</div>
              {result && (
                <div className="flex items-center gap-2">
                  {(() => {
                    const badge = getModeBadge(result.meta);
                    return (
                      <span
                        data-testid="node-event-mode-badge"
                        style={{
                          padding: '2px 6px', fontSize: 10, fontWeight: 500,
                          background: badge.bg, color: badge.color,
                          border: `1px solid ${badge.border}`, borderRadius: 3,
                        }}
                      >
                        {badge.text}
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* 加载状态 */}
            {loading && (
              <div
                data-testid="node-event-loading"
                className="bg-paper p-6 rounded-lg border border-line text-center"
              >
                <div className="text-sm text-muted">正在检索事件候选...</div>
              </div>
            )}

            {/* 错误状态 */}
            {error && !loading && (
              <div
                data-testid="node-event-error"
                className="bg-red/5 p-4 rounded-lg border border-red/20"
              >
                <div className="text-sm text-red font-semibold mb-1">检索失败</div>
                <div className="text-xs text-red/80">{error}</div>
              </div>
            )}

            {/* Fallback 降级说明 */}
            {result && result.meta.fallbackReason && (
              <div
                data-testid="node-event-fallback-reason"
                className="bg-orange/5 p-3 rounded border border-orange/20 mb-3"
              >
                <div className="text-xs text-orange font-semibold mb-1">降级说明</div>
                <div className="text-xs text-orange/80">{result.meta.fallbackReason}</div>
              </div>
            )}

            {/* 空状态 */}
            {result && result.candidates.length === 0 && !loading && !error && (
              <div
                data-testid="node-event-empty"
                className="bg-paper p-6 rounded-lg border border-line text-center"
              >
                <div className="text-sm text-muted mb-1">暂无可核验的事件候选</div>
                <div className="text-xs text-muted/70">
                  该节点时间窗口内未检索到与目标股票相关的新闻候选。
                  {result.meta.originalTotalCount > 0 && `（窗口外共 ${result.meta.originalTotalCount} 条）`}
                </div>
              </div>
            )}

            {/* 候选列表 */}
            {result && result.candidates.length > 0 && !loading && !error && (
              <div data-testid="node-event-candidate-list" className="space-y-3">
                {result.candidates.map((item, idx) => {
                  const relevanceBadge = getRelevanceBadge(item.stockRelevanceStatus);
                  const domain = item.originalUrl ? extractDomain(item.originalUrl) : '';
                  return (
                    <div
                      key={item.id}
                      data-testid={`node-event-candidate-${idx}`}
                      data-is-real-candidate={item.isRealEventCandidate ? 'true' : 'false'}
                      className="bg-white border border-line rounded-lg p-3"
                    >
                      {/* 徽标行 */}
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          data-testid={`node-event-candidate-relevance-${idx}`}
                          style={{
                            padding: '1px 6px', fontSize: 10, fontWeight: 500,
                            background: relevanceBadge.bg, color: relevanceBadge.color,
                            border: `1px solid ${relevanceBadge.border}`, borderRadius: 3,
                          }}
                        >
                          {relevanceBadge.text}
                        </span>
                        {item.isMultiStockSummary && (
                          <span
                            data-testid={`node-event-candidate-multi-stock-${idx}`}
                            style={{
                              padding: '1px 6px', fontSize: 10, fontWeight: 500,
                              background: '#fffbeb', color: '#d97706',
                              border: '1px solid #fde68a', borderRadius: 3,
                            }}
                          >
                            多股汇总
                          </span>
                        )}
                      </div>

                      {/* 标题 */}
                      <div
                        data-testid={`node-event-candidate-title-${idx}`}
                        className="text-sm text-ink font-medium mb-1 leading-relaxed"
                      >
                        {item.title}
                      </div>

                      {/* 发布时间 + 来源 */}
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          data-testid={`node-event-candidate-time-${idx}`}
                          className="text-xs text-muted"
                        >
                          {item.publishedAt}
                        </span>
                        <span
                          data-testid={`node-event-candidate-source-${idx}`}
                          className="text-xs text-muted"
                        >
                          {item.publisher}
                        </span>
                      </div>

                      {/* 原文链接 */}
                      {item.originalUrl ? (
                        <a
                          href={item.originalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid={`node-event-candidate-link-${idx}`}
                          className="text-xs text-blue hover:underline inline-flex items-center gap-1"
                        >
                          {domain || '查看原文'}
                          <span className="text-muted">↗</span>
                        </a>
                      ) : (
                        <span
                          data-testid={`node-event-candidate-no-link-${idx}`}
                          className="text-xs text-muted"
                        >
                          无有效链接
                        </span>
                      )}

                      {/* 列入理由 */}
                      <div
                        data-testid={`node-event-candidate-reason-${idx}`}
                        className="text-xs text-muted italic mt-2 pt-2 border-t border-line"
                      >
                        {item.verificationReason}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ========== 第十二阶段 A：我的复盘笔记 ========== */}
          {node && stockCode && (
            <ReplayNoteSection
              key={`${stockCode}-${node.id}-${noteRefreshKey}`}
              node={node}
              stockCode={stockCode}
              refreshKey={noteRefreshKey}
            />
          )}

          {/* ========== 阅读提示 ========== */}
          <div
            data-testid="node-event-reading-tip"
            className="p-4 bg-ink rounded-lg"
          >
            <p className="text-sm text-white font-semibold mb-2">
              阅读提示
            </p>
            <p className="text-xs text-white/90 leading-relaxed">
              以上内容仅供复盘查阅，不构成涨跌原因或投资建议。新闻候选与股价节点的关联仅基于时间窗口，不代表因果关系。请打开原文链接自行判断。
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
