'use client';

import { useState, useCallback } from 'react';

interface NewsEventCandidate {
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

interface EventNewsResult {
  news: NewsEventCandidate[];
  meta: {
    provider: string;
    upstreamPlatform: string;
    sourceLabel: string;
    dataMode: string;
    isRealData: boolean;
    fetchedAt: string;
    totalCount: number;
    deduplicatedCount: number;
    verifiedCount: number;
    unverifiedCount: number;
    validUrlCount: number;
    invalidUrlCount: number;
    multiStockSummaryCount: number;
    earliestPublishedAt: string | null;
    latestPublishedAt: string | null;
    fallbackReason?: string;
    cacheStatus?: 'hit' | 'miss' | 'bypass';
  };
}

const STOCK_PRESETS = [
  { code: '600519', market: 'SH' as const, name: '贵州茅台' },
  { code: '000001', market: 'SZ' as const, name: '平安银行' },
  { code: '300750', market: 'SZ' as const, name: '宁德时代' },
  { code: '688981', market: 'SH' as const, name: '中芯国际' },
];

export default function DevEventSourcesPage() {
  const [stockCode, setStockCode] = useState('600519');
  const [market, setMarket] = useState<'SH' | 'SZ'>('SH');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EventNewsResult | null>(null);
  const [error, setError] = useState<string>('');

  const handleQuery = useCallback(async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const params = new URLSearchParams({ stockCode, market });
      const res = await fetch(`/api/event-news?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  }, [stockCode, market]);

  const handlePreset = (preset: typeof STOCK_PRESETS[0]) => {
    setStockCode(preset.code);
    setMarket(preset.market);
  };

  const getModeBadge = (meta: EventNewsResult['meta']) => {
    if (meta.fallbackReason) return { text: 'Fallback 降级', color: '#d97706', bg: '#fffbeb', border: '#fde68a' };
    if (meta.isRealData) return { text: 'Real 真实', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' };
    return { text: 'Mock 演示', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' };
  };

  const getRelevanceBadge = (status: string) => {
    if (status === 'verified') return { text: 'verified', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' };
    return { text: 'unverified', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' };
  };

  const getMultiStockBadge = () => ({ text: '多股汇总', color: '#d97706', bg: '#fffbeb', border: '#fde68a' });

  const extractDomain = (url: string): string => {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px 16px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* 标题区 */}
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#0f172a', margin: 0 }}>
            K-Ray 新闻候选数据源 · 开发体验
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            第十阶段 A · AKShare stock_news_em 可行性验证 · 仅开发环境
          </p>
        </div>

        {/* 醒目提示 */}
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a',
          borderRadius: 8, padding: 12, marginBottom: 16,
        }}>
          <div style={{ fontSize: 12, color: '#92400e', fontWeight: 600, marginBottom: 4 }}>
            ⚠️ 实验性数据源，不代表正式商业数据源
          </div>
          <div style={{ fontSize: 12, color: '#92400e' }}>
            ⚠️ 新闻候选不代表股价波动原因
          </div>
          <div style={{ fontSize: 11, color: '#a16207', marginTop: 6 }}>
            数据获取工具：AKShare（开源） · 上游平台：东方财富 · 不代表东方财富官方开放 API，不代表已获得上游内容商业转载授权
          </div>
        </div>

        {/* 查询表单 */}
        <div style={{
          background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0',
          padding: 20, marginBottom: 16,
        }} data-testid="query-form">
          {/* 预设按钮 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {STOCK_PRESETS.map(p => (
              <button
                key={p.code}
                onClick={() => handlePreset(p)}
                data-testid={`preset-${p.code}`}
                style={{
                  padding: '4px 12px', fontSize: 12, borderRadius: 4,
                  border: '1px solid #cbd5e1',
                  background: stockCode === p.code ? '#f1f5f9' : '#fff',
                  color: '#334155', cursor: 'pointer',
                }}
              >
                {p.code}.{p.market} {p.name}
              </button>
            ))}
          </div>

          {/* 参数输入 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                股票代码
              </label>
              <input
                value={stockCode}
                onChange={e => setStockCode(e.target.value)}
                placeholder="6位数字"
                data-testid="stock-code-input"
                style={{
                  width: 120, padding: '6px 10px', fontSize: 13,
                  border: '1px solid #cbd5e1', borderRadius: 4, outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                市场
              </label>
              <select
                value={market}
                onChange={e => setMarket(e.target.value as 'SH' | 'SZ')}
                data-testid="market-select"
                style={{
                  padding: '6px 10px', fontSize: 13,
                  border: '1px solid #cbd5e1', borderRadius: 4, outline: 'none',
                }}
              >
                <option value="SH">SH</option>
                <option value="SZ">SZ</option>
              </select>
            </div>
            <button
              onClick={handleQuery}
              disabled={loading}
              data-testid="query-button"
              style={{
                padding: '7px 20px', fontSize: 13, fontWeight: 500,
                background: loading ? '#94a3b8' : '#0f172a',
                color: '#fff', border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '查询中...' : '查询新闻'}
            </button>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div data-testid="error-state" style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 8, padding: 16, marginBottom: 16,
          }}>
            <div style={{ fontSize: 13, color: '#dc2626', fontWeight: 500 }}>查询失败</div>
            <div style={{ fontSize: 12, color: '#991b1b', marginTop: 4 }}>{error}</div>
          </div>
        )}

        {/* 元信息 */}
        {result && (
          <div data-testid="result-meta" style={{
            background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0',
            padding: 16, marginBottom: 16,
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              {(() => {
                const badge = getModeBadge(result.meta);
                return (
                  <span data-testid="mode-badge" style={{
                    padding: '2px 8px', fontSize: 11, fontWeight: 500,
                    background: badge.bg, color: badge.color,
                    border: `1px solid ${badge.border}`, borderRadius: 3,
                  }}>
                    {badge.text}
                  </span>
                );
              })()}
              <span style={{ fontSize: 12, color: '#64748b' }}>
                来源：{result.meta.sourceLabel}
              </span>
              <span style={{ fontSize: 12, color: '#64748b' }} data-testid="total-count">
                原始返回：{result.meta.totalCount} 条
              </span>
              <span style={{ fontSize: 12, color: '#64748b' }} data-testid="dedup-count">
                去重后：{result.meta.deduplicatedCount} 条
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
              <span style={{ fontSize: 12, color: '#059669' }} data-testid="verified-count">
                verified：{result.meta.verifiedCount} 条
              </span>
              <span style={{ fontSize: 12, color: '#dc2626' }} data-testid="unverified-count">
                unverified：{result.meta.unverifiedCount} 条
              </span>
              <span style={{ fontSize: 12, color: '#64748b' }} data-testid="multi-stock-count">
                多股汇总候选：{result.meta.multiStockSummaryCount} 条
              </span>
              <span style={{ fontSize: 12, color: '#64748b' }} data-testid="valid-url-count">
                格式合格链接：{result.meta.validUrlCount} 条
              </span>
              <span style={{ fontSize: 12, color: '#64748b' }} data-testid="invalid-url-count">
                无效/缺失链接：{result.meta.invalidUrlCount} 条
              </span>
            </div>
            {result.meta.earliestPublishedAt && (
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <span style={{ fontSize: 12, color: '#64748b' }} data-testid="earliest-time">
                  最早新闻：{result.meta.earliestPublishedAt}
                </span>
                <span style={{ fontSize: 12, color: '#64748b' }} data-testid="latest-time">
                  最晚新闻：{result.meta.latestPublishedAt}
                </span>
              </div>
            )}
            {result.meta.fallbackReason && (
              <div data-testid="fallback-reason" style={{
                marginTop: 8, fontSize: 12, color: '#92400e',
                background: '#fffbeb', padding: '6px 10px', borderRadius: 4,
                border: '1px solid #fde68a',
              }}>
                降级原因：{result.meta.fallbackReason}
              </div>
            )}
            {/* 时间覆盖范围提示 */}
            {result.meta.isRealData && (
              <div data-testid="coverage-limit-hint" style={{
                marginTop: 8, fontSize: 12, color: '#6b7280',
                background: '#f9fafb', padding: '6px 10px', borderRadius: 4,
                border: '1px solid #e5e7eb',
              }}>
                当前候选来源只提供有限的近期新闻，不能用于完整历史复盘。
              </div>
            )}
          </div>
        )}

        {/* 新闻列表 */}
        {result && result.news.length > 0 && (
          <div data-testid="news-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {result.news.map((item, idx) => {
              const relevanceBadge = getRelevanceBadge(item.stockRelevanceStatus);
              const domain = item.originalUrl ? extractDomain(item.originalUrl) : '';
              return (
                <div
                  key={item.id}
                  data-testid={`news-item-${idx}`}
                  style={{
                    background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0',
                    padding: 14,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    {/* 相关性验证徽标 */}
                    <span data-testid={`relevance-badge-${idx}`} style={{
                      flexShrink: 0, padding: '2px 6px', fontSize: 10, fontWeight: 500,
                      background: relevanceBadge.bg, color: relevanceBadge.color,
                      border: `1px solid ${relevanceBadge.border}`, borderRadius: 3, marginTop: 2,
                    }}>
                      {relevanceBadge.text}
                    </span>
                    {/* 多股汇总候选徽标 */}
                    {item.isMultiStockSummary && (
                      <span data-testid={`multi-stock-badge-${idx}`} style={{
                        flexShrink: 0, padding: '2px 6px', fontSize: 10, fontWeight: 500,
                        background: getMultiStockBadge().bg, color: getMultiStockBadge().color,
                        border: `1px solid ${getMultiStockBadge().border}`, borderRadius: 3, marginTop: 2,
                      }}>
                        {getMultiStockBadge().text}
                      </span>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* 标题 */}
                      <div data-testid={`news-title-${idx}`} style={{
                        fontSize: 14, fontWeight: 500, color: '#0f172a',
                        lineHeight: 1.5,
                      }}>
                        {item.title}
                      </div>
                      {/* 短内容 */}
                      {item.excerpt && (
                        <div data-testid={`news-excerpt-${idx}`} style={{
                          fontSize: 12, color: '#475569', marginTop: 6,
                          lineHeight: 1.6, maxHeight: 60, overflow: 'hidden',
                          textOverflow: 'ellipsis', display: '-webkit-box',
                          WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                        }}>
                          {item.excerpt}
                        </div>
                      )}
                      {/* 元信息行 */}
                      <div style={{
                        display: 'flex', flexWrap: 'wrap', gap: 12,
                        marginTop: 6, fontSize: 11, color: '#94a3b8',
                      }}>
                        <span data-testid={`news-time-${idx}`}>{item.publishedAt}</span>
                        <span data-testid={`news-source-${idx}`}>{item.publisher}</span>
                        {item.matchedStockCodes.length > 0 && (
                          <span data-testid={`news-codes-${idx}`}>
                            识别到代码：{item.matchedStockCodes.join('、')}
                          </span>
                        )}
                      </div>
                      {/* 验证理由 */}
                      <div data-testid={`news-reason-${idx}`} style={{
                        fontSize: 11, color: '#6b7280', marginTop: 4,
                        fontStyle: 'italic',
                      }}>
                        {item.verificationReason}
                      </div>
                      {/* 原文链接 */}
                      {item.originalUrl && (
                        <div style={{ marginTop: 6 }}>
                          <a
                            href={item.originalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid={`news-url-${idx}`}
                            style={{ fontSize: 11, color: '#2563eb', textDecoration: 'none' }}
                          >
                            原文链接 · {domain} →
                          </a>
                        </div>
                      )}
                      {/* 无链接提示 */}
                      {!item.originalUrl && (
                        <div data-testid={`news-no-url-${idx}`} style={{
                          marginTop: 6, fontSize: 11, color: '#dc2626',
                        }}>
                          无有效原文链接
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 空结果 */}
        {result && result.news.length === 0 && (
          <div data-testid="empty-state" style={{
            background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0',
            padding: 32, textAlign: 'center',
          }}>
            <div style={{ fontSize: 14, color: '#64748b' }}>未找到新闻数据</div>
            {result.meta.isRealData && (
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
                真实接口返回了空结果，该股票可能暂时没有新闻
              </div>
            )}
          </div>
        )}

        {/* 页脚说明 */}
        <div style={{ marginTop: 24, fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
          K-Ray Phase 10A · AKShare 新闻候选数据源可行性验证 · 实验性数据源，不代表正式商业数据源
        </div>
      </div>
    </div>
  );
}
