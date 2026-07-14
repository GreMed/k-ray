'use client';

import { useState, useCallback } from 'react';

interface AnnouncementItem {
  announcementId: string;
  stockCode: string;
  market: string;
  title: string;
  publishedAt: string;
  sourcePlatform: string;
  sourcePageUrl: string;
  originalPdfUrl: string | undefined;
  category: string;
  isRealAnnouncement: boolean;
  alignedTradingDate: string | null;
}

interface AnnouncementResult {
  announcements: AnnouncementItem[];
  meta: {
    source: string;
    sourceLabel: string;
    isRealAnnouncement: boolean;
    fetchedAt: string;
    total: number;
    verificationStatus: string;
    fallbackReason?: string;
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  earnings: '业绩',
  dividend: '分红',
  capital: '资本运作',
  operation: '经营',
  regulatory: '监管',
  suspension: '停复牌',
  other: '其他',
};

const CATEGORY_COLORS: Record<string, string> = {
  earnings: '#2563eb',
  dividend: '#059669',
  capital: '#d97706',
  operation: '#6366f1',
  regulatory: '#dc2626',
  suspension: '#ea580c',
  other: '#6b7280',
};

const STOCK_PRESETS = [
  { code: '600519', market: 'SH', name: '贵州茅台' },
  { code: '000001', market: 'SZ', name: '平安银行' },
];

export default function DevAnnouncementsPage() {
  const [stockCode, setStockCode] = useState('600519');
  const [market, setMarket] = useState<'SH' | 'SZ'>('SH');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-03-31');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnnouncementResult | null>(null);
  const [error, setError] = useState<string>('');

  const handleQuery = useCallback(async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const params = new URLSearchParams({ stockCode, market, startDate, endDate });
      const res = await fetch(`/api/announcements?${params.toString()}`);
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
  }, [stockCode, market, startDate, endDate]);

  const handlePreset = (preset: typeof STOCK_PRESETS[0]) => {
    setStockCode(preset.code);
    setMarket(preset.market as 'SH' | 'SZ');
  };

  const getModeBadge = (meta: AnnouncementResult['meta']) => {
    if (meta.fallbackReason) return { text: 'Fallback 降级', color: '#d97706' };
    if (meta.isRealAnnouncement) return { text: 'Real 真实', color: '#059669' };
    return { text: 'Mock 演示', color: '#6b7280' };
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px 16px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* 标题区 */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#0f172a', margin: 0 }}>
            K-Ray 公告数据 · 开发体验
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            第七阶段 A · 架构验证 · 仅开发环境
          </p>
        </div>

        {/* 查询表单 */}
        <div style={{
          background: '#fff',
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          padding: 20,
          marginBottom: 16,
        }}>
          {/* 预设按钮 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {STOCK_PRESETS.map(p => (
              <button
                key={p.code}
                onClick={() => handlePreset(p)}
                style={{
                  padding: '4px 12px',
                  fontSize: 12,
                  borderRadius: 4,
                  border: '1px solid #cbd5e1',
                  background: stockCode === p.code ? '#f1f5f9' : '#fff',
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                {p.code}.{p.market === 'SH' ? 'SH' : 'SZ'} {p.name}
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
                style={{
                  padding: '6px 10px', fontSize: 13,
                  border: '1px solid #cbd5e1', borderRadius: 4, outline: 'none',
                }}
              >
                <option value="SH">SH</option>
                <option value="SZ">SZ</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                开始日期
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                style={{
                  padding: '6px 10px', fontSize: 13,
                  border: '1px solid #cbd5e1', borderRadius: 4, outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                结束日期
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                style={{
                  padding: '6px 10px', fontSize: 13,
                  border: '1px solid #cbd5e1', borderRadius: 4, outline: 'none',
                }}
              />
            </div>
            <button
              onClick={handleQuery}
              disabled={loading}
              style={{
                padding: '7px 20px', fontSize: 13, fontWeight: 500,
                background: loading ? '#94a3b8' : '#0f172a',
                color: '#fff', border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '查询中...' : '查询'}
            </button>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 8, padding: 16, marginBottom: 16,
          }}>
            <div style={{ fontSize: 13, color: '#dc2626', fontWeight: 500 }}>查询失败</div>
            <div style={{ fontSize: 12, color: '#991b1b', marginTop: 4 }}>{error}</div>
          </div>
        )}

        {/* 元信息 */}
        {result && (
          <div style={{
            background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0',
            padding: 16, marginBottom: 16,
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
              {(() => {
                const badge = getModeBadge(result.meta);
                return (
                  <span style={{
                    padding: '2px 8px', fontSize: 11, fontWeight: 500,
                    background: `${badge.color}15`, color: badge.color,
                    borderRadius: 3,
                  }}>
                    {badge.text}
                  </span>
                );
              })()}
              <span style={{ fontSize: 12, color: '#64748b' }}>
                来源：{result.meta.sourceLabel}
              </span>
              <span style={{ fontSize: 12, color: '#64748b' }}>
                验证状态：{result.meta.verificationStatus}
              </span>
              <span style={{ fontSize: 12, color: '#64748b' }}>
                公告数量：{result.meta.total}
              </span>
            </div>
            {result.meta.fallbackReason && (
              <div style={{
                marginTop: 8, fontSize: 12, color: '#92400e',
                background: '#fffbeb', padding: '6px 10px', borderRadius: 4,
                border: '1px solid #fde68a',
              }}>
                降级原因：{result.meta.fallbackReason}
              </div>
            )}
          </div>
        )}

        {/* 公告列表 */}
        {result && result.announcements.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {result.announcements.map((item) => (
              <div
                key={item.announcementId}
                style={{
                  background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0',
                  padding: 14,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{
                    flexShrink: 0, padding: '2px 6px', fontSize: 10, fontWeight: 500,
                    background: `${CATEGORY_COLORS[item.category] || '#6b7280'}15`,
                    color: CATEGORY_COLORS[item.category] || '#6b7280',
                    borderRadius: 3, marginTop: 2,
                  }}>
                    {CATEGORY_LABELS[item.category] || item.category}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 500, color: '#0f172a',
                      lineHeight: 1.5,
                    }}>
                      {item.title}
                    </div>
                    <div style={{
                      display: 'flex', flexWrap: 'wrap', gap: 12,
                      marginTop: 6, fontSize: 11, color: '#94a3b8',
                    }}>
                      <span>{item.publishedAt}</span>
                      <span>{item.sourcePlatform}</span>
                      <span style={{
                        fontFamily: 'monospace', fontSize: 10,
                        color: '#cbd5e1',
                      }}>
                        {item.announcementId}
                      </span>
                    </div>
                    {(item.sourcePageUrl || item.originalPdfUrl) && (
                      <div style={{ marginTop: 6, display: 'flex', gap: 12 }}>
                        {item.sourcePageUrl && (
                          <a
                            href={item.sourcePageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 11, color: '#2563eb', textDecoration: 'none' }}
                          >
                            原文页面 →
                          </a>
                        )}
                        {item.originalPdfUrl && (
                          <a
                            href={item.originalPdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 11, color: '#2563eb', textDecoration: 'none' }}
                          >
                            PDF原文 →
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 空结果 */}
        {result && result.announcements.length === 0 && (
          <div style={{
            background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0',
            padding: 32, textAlign: 'center',
          }}>
            <div style={{ fontSize: 14, color: '#64748b' }}>无公告数据</div>
          </div>
        )}

        {/* 页脚说明 */}
        <div style={{ marginTop: 24, fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
          K-Ray Phase 7A · 架构验证完成 · 巨潮网页内部接口未通过真实公告源可用性验证
        </div>
      </div>
    </div>
  );
}
