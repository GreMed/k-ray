'use client';

/**
 * 第十三阶段 A：AI 辅助事件检索 · 开发验收页面
 *
 * 本页面只展示静态结构和状态，不伪装成真实 AI 检索。
 * 不接入任何真实搜索 API，不要求用户提供 API Key。
 *
 * 访问路径：/dev-ai-event-retrieval
 */

import { AI_EVENT_SAFETY_MESSAGES, AI_EVENT_DEFAULT_CONFIG } from '@/services/aiEventRetrieval/types';

// ============================================================================
// 静态展示数据（非真实检索结果，仅用于展示 UI 结构和状态）
// ============================================================================

const STATIC_MOCK_CANDIDATES = [
  {
    id: 'mock-001',
    title: '[开发样本] 贵州茅台发布2024年度业绩报告',
    excerpt: '本条为开发样本数据，展示真实检索结果的 UI 结构。非真实新闻内容。',
    publishedAt: '2024-03-15 18:30',
    publisher: '开发样本媒体',
    originalUrl: 'https://example.com/dev-sample-001',
    candidateSource: 'mock_sample' as const,
    aiRelevanceReason: '[开发样本] 检索词「贵州茅台 2024年3月 业绩」匹配到该候选',
    searchQueryUsed: '贵州茅台 2024年3月 业绩',
    relevanceStatus: 'unverified' as const,
    dataMode: 'mock' as const,
  },
  {
    id: 'mock-002',
    title: '[开发样本] 白酒行业季度分析报告',
    excerpt: '本条为开发样本数据，展示多股汇总文章的 unverified 标记。非真实新闻内容。',
    publishedAt: '2024-03-16 09:15',
    publisher: '开发样本财经',
    originalUrl: 'https://example.com/dev-sample-002',
    candidateSource: 'mock_sample' as const,
    aiRelevanceReason: '[开发样本] 行业关键词「白酒 高端消费」匹配到该候选（多股汇总）',
    searchQueryUsed: '白酒 高端消费 2024年3月',
    relevanceStatus: 'unverified' as const,
    dataMode: 'mock' as const,
    isMultiStockSummary: true,
  },
];

const STATIC_REAL_CANDIDATES = [
  {
    id: 'real-001',
    title: '[未来 UI 示例] 某公司发布季度财报（非真实数据）',
    excerpt: '此条仅展示未来真实检索结果的 UI 结构。第十三阶段 B 接入后将由 AI 检索返回真实内容。当前为静态示例，非真实检索结果。',
    publishedAt: '2024-03-15 18:30',
    publisher: '示例来源媒体（非真实来源）',
    originalUrl: 'https://example.com/static-ui-demo',
    candidateSource: 'ai_retrieved' as const,
    aiRelevanceReason: '[未来 UI 示例] 检索词与节点日期窗口匹配（非真实匹配）',
    searchQueryUsed: '示例公司 2024年3月 财报',
    relevanceStatus: 'direct_stock_match' as const,
    dataMode: 'real' as const,
  },
];

// ============================================================================
// 样式常量（与现有 dev 页面保持一致的内联 style 风格）
// ============================================================================

const COLORS = {
  bg: '#f8fafc',
  card: '#ffffff',
  border: '#e2e8f0',
  ink: '#0f172a',
  muted: '#64748b',
  weak: '#94a3b8',
  blue: '#2563eb',
  red: '#dc2626',
  orange: '#d97706',
  green: '#059669',
  violet: '#7c3aed',
  warnBg: '#fffbeb',
  warnBorder: '#fde68a',
  warnText: '#92400e',
  errorBg: '#fef2f2',
  errorBorder: '#fecaca',
  successBg: '#ecfdf5',
  successBorder: '#a7f3d0',
  mockBg: '#f9fafb',
  mockBorder: '#e5e7eb',
};

// ============================================================================
// 徽标辅助函数
// ============================================================================

function getModeBadge(dataMode: string) {
  if (dataMode === 'real') return { text: 'Real 真实检索', color: COLORS.green, bg: COLORS.successBg, border: COLORS.successBorder };
  if (dataMode === 'disabled') return { text: 'Disabled 不可用', color: COLORS.red, bg: COLORS.errorBg, border: COLORS.errorBorder };
  return { text: 'Mock 开发样本', color: COLORS.muted, bg: COLORS.mockBg, border: COLORS.mockBorder };
}

function getSourceBadge(source: string) {
  if (source === 'ai_retrieved') return { text: 'AI 检索', color: COLORS.blue, bg: '#eff6ff', border: '#bfdbfe' };
  if (source === 'user_added') return { text: '用户添加', color: COLORS.violet, bg: '#f5f3ff', border: '#ddd6fe' };
  return { text: 'Mock 样本', color: COLORS.muted, bg: COLORS.mockBg, border: COLORS.mockBorder };
}

function getRelevanceBadge(status: string) {
  if (status === 'direct_stock_match') return { text: 'direct_stock_match', color: COLORS.blue, bg: '#eff6ff', border: '#bfdbfe' };
  if (status === 'contextual_match') return { text: 'contextual_match', color: COLORS.violet, bg: '#f5f3ff', border: '#ddd6fe' };
  return { text: 'unverified', color: COLORS.muted, bg: COLORS.mockBg, border: COLORS.mockBorder };
}

// ============================================================================
// Badge 组件
// ============================================================================

function Badge({ text, color, bg, border }: { text: string; color: string; bg: string; border: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', fontSize: 11, fontWeight: 600,
      borderRadius: 4, color, background: bg, border: `1px solid ${border}`,
    }}>
      {text}
    </span>
  );
}

// ============================================================================
// 卡片容器
// ============================================================================

function Card({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return (
    <div
      data-testid={testId}
      style={{
        background: COLORS.card,
        borderRadius: 8,
        border: `1px solid ${COLORS.border}`,
        padding: 20,
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return (
    <h2
      data-testid={testId}
      style={{ fontSize: 16, fontWeight: 600, color: COLORS.ink, margin: '0 0 12px 0' }}
    >
      {children}
    </h2>
  );
}

function SubTitle({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return (
    <h3
      data-testid={testId}
      style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink, margin: '16px 0 8px 0' }}
    >
      {children}
    </h3>
  );
}

// ============================================================================
// 主页面
// ============================================================================

export default function DevAIEventRetrievalPage() {
  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, padding: '24px 16px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* 标题区 */}
        <div style={{ marginBottom: 16 }} data-testid="page-header">
          <h1 style={{ fontSize: 22, fontWeight: 600, color: COLORS.ink, margin: 0 }}>
            K-Ray AI 辅助事件检索 · 开发验收
          </h1>
          <p style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>
            第十三阶段 A · 方案与可行性设计 · 仅开发环境 · 未接入真实搜索服务
          </p>
        </div>

        {/* 醒目提示 */}
        <div
          data-testid="warning-block"
          style={{
            background: COLORS.warnBg,
            border: `1px solid ${COLORS.warnBorder}`,
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 12, color: COLORS.warnText, fontWeight: 600, marginBottom: 4 }}>
            ⚠️ {AI_EVENT_SAFETY_MESSAGES.EXPERIMENTAL_WARNING}
          </div>
          <div style={{ fontSize: 12, color: COLORS.warnText, marginBottom: 4 }}>
            ⚠️ {AI_EVENT_SAFETY_MESSAGES.NOT_CAUSE_WARNING}
          </div>
          <div style={{ fontSize: 11, color: '#a16207', marginTop: 6 }}>
            {AI_EVENT_SAFETY_MESSAGES.AI_CAPABILITY_BOUNDARY}
          </div>
          <div style={{ fontSize: 11, color: '#a16207', marginTop: 4 }}>
            {AI_EVENT_SAFETY_MESSAGES.NO_FULL_TEXT_STORAGE}
          </div>
        </div>

        {/* ========== 第一部分：方案概要 ========== */}
        <Card testId="section-overview">
          <SectionTitle testId="section-overview-title">一、方案概要</SectionTitle>
          <p style={{ fontSize: 13, color: COLORS.ink, lineHeight: 1.6, margin: '0 0 8px 0' }}>
            产品目标：用户点击某个关键股价节点时，未来可由 AI 根据「股票代码、公司名称、节点日期、前后各3天、行业关键词」检索网页新闻，并返回可打开原文的事件候选。
          </p>
          <p style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.6, margin: 0 }}>
            当前状态：第十三阶段 A 只做方案、类型契约、独立开发验收入口和测试设计。<strong>不接入任何真实搜索 API，不要求用户提供 API Key。</strong>
            等待用户选择搜索服务并授权 API Key 后，再进入第十三阶段 B。
          </p>
        </Card>

        {/* ========== 第二部分：类型契约 ========== */}
        <Card testId="section-types">
          <SectionTitle testId="section-types-title">二、Provider-Neutral 数据类型契约</SectionTitle>
          <p style={{ fontSize: 13, color: COLORS.muted, marginBottom: 12 }}>
            类型定义文件：<code style={{ fontSize: 12, color: COLORS.blue }}>services/aiEventRetrieval/types.ts</code>
          </p>

          <SubTitle testId="section-types-enums">枚举类型</SubTitle>
          <ul style={{ fontSize: 13, color: COLORS.ink, lineHeight: 1.8, margin: '0 0 12px 0', paddingLeft: 20 }}>
            <li><code>AIEventRetrievalMode</code>：<code>{`'disabled' | 'mock' | 'real'`}</code></li>
            <li><code>AIEventRetrievalProvider</code>：<code>{`'none' | 'mock' | 'openai' | 'anthropic' | 'custom'`}</code></li>
            <li><code>AICandidateSource</code>：<code>{`'ai_retrieved' | 'user_added' | 'mock_sample'`}</code></li>
            <li><code>AIRelevanceStatus</code>：<code>{`'direct_stock_match' | 'contextual_match' | 'unverified'`}</code></li>
          </ul>

          <SubTitle testId="section-types-query">查询参数 AIEventRetrievalQuery</SubTitle>
          <ul style={{ fontSize: 13, color: COLORS.ink, lineHeight: 1.8, margin: '0 0 12px 0', paddingLeft: 20 }}>
            <li><code>stockCode</code>：股票代码（6 位）</li>
            <li><code>market</code>：市场（SH / SZ）</li>
            <li><code>companyName?</code>：公司名称（用于生成检索词）</li>
            <li><code>nodeDate</code>：关键节点日期（YYYY-MM-DD）</li>
            <li><code>windowDays?</code>：前后窗口天数（默认 3）</li>
            <li><code>industryKeywords?</code>：行业关键词数组</li>
            <li><code>nodeType?</code>：节点类型</li>
          </ul>

          <SubTitle testId="section-types-candidate">候选项 AIEventCandidate（核心）</SubTitle>
          <p style={{ fontSize: 12, color: COLORS.muted, marginBottom: 8 }}>
            每条候选必须保留：标题、发布时间、来源名称、原文链接、检索时间、查询词、数据模式
          </p>
          <ul style={{ fontSize: 13, color: COLORS.ink, lineHeight: 1.8, margin: '0 0 12px 0', paddingLeft: 20 }}>
            <li><code>id</code>：稳定 ID（URL 优先，否则哈希）</li>
            <li><code>title</code> / <code>excerpt</code> / <code>publishedAt</code> / <code>publisher</code> / <code>originalUrl</code>：来自检索结果，禁止 AI 编造</li>
            <li><code>candidateSource</code>：区分 ai_retrieved / user_added / mock_sample</li>
            <li><code>aiRelevanceReason</code>：AI 生成的关联理由（不表述因果）</li>
            <li><code>searchQueryUsed</code>：AI 使用的检索词</li>
            <li><code>dataMode</code> / <code>isRealEventCandidate</code>：数据模式与真实性标记</li>
            <li><code>retrievedAt</code>：检索时间</li>
          </ul>

          <SubTitle testId="section-types-meta">元信息 AIEventRetrievalMeta</SubTitle>
          <ul style={{ fontSize: 13, color: COLORS.ink, lineHeight: 1.8, margin: '0 0 12px 0', paddingLeft: 20 }}>
            <li><code>provider</code> / <code>model</code> / <code>upstreamPlatform</code>：来源标识</li>
            <li><code>dataMode</code> / <code>isRealData</code> / <code>cacheStatus</code>：数据状态</li>
            <li><code>totalCount</code> / <code>realCandidateCount</code> / <code>userAddedCount</code>：计数</li>
            <li><code>searchQueriesUsed</code>：AI 生成的检索词列表</li>
            <li><code>nodeDate</code> / <code>windowStart</code> / <code>windowEnd</code>：时间窗口</li>
            <li><code>costInfo?</code>：成本信息（token 数、费用估算）</li>
            <li><code>disabledReason?</code>：功能不可用原因</li>
          </ul>

          <SubTitle testId="section-types-provider">Provider 接口 AIEventRetrievalDataProvider</SubTitle>
          <pre style={{
            fontSize: 12, background: COLORS.mockBg, padding: 12, borderRadius: 6,
            overflow: 'auto', color: COLORS.ink, border: `1px solid ${COLORS.mockBorder}`,
          }}>
{`interface AIEventRetrievalDataProvider {
  readonly providerId: AIEventRetrievalProvider;
  isConfigured(): boolean;
  fetchCandidates(query: AIEventRetrievalQuery): Promise<AIEventRetrievalResult>;
}`}
          </pre>
          <p style={{ fontSize: 12, color: COLORS.muted, marginTop: 8 }}>
            本阶段不实现任何 Provider，只定义契约。第十三阶段 B 实现 OpenAI / Anthropic / Custom Provider。
          </p>
        </Card>

        {/* ========== 第三部分：用户体验流程 ========== */}
        <Card testId="section-ux-flow">
          <SectionTitle testId="section-ux-flow-title">三、用户体验流程</SectionTitle>
          <div style={{ fontSize: 13, color: COLORS.ink, lineHeight: 2 }}>
            <div style={{ marginBottom: 8 }}>
              <strong>步骤 1：点击节点</strong> — 用户在日 K 图表上点击某个关键股价节点，打开节点详情抽屉。
            </div>
            <div style={{ marginBottom: 8 }}>
              <strong>步骤 2：发起检索</strong> — 抽屉内展示「AI 事件检索」区块。若已配置 API Key（第十三阶段 B），显示「检索候选」按钮；若未配置，显示「功能未开通」提示。
            </div>
            <div style={{ marginBottom: 8 }}>
              <strong>步骤 3：候选列表</strong> — AI 根据股票代码、公司名称、节点日期、行业关键词生成检索词，执行网页搜索，返回候选列表。每条候选显示：标题、发布时间、来源名称、关联理由、相关性徽标、来源类型徽标、原文链接。
            </div>
            <div style={{ marginBottom: 8 }}>
              <strong>步骤 4：打开原文</strong> — 用户点击候选的原文链接，在新标签页打开原始网页。K-Ray 不存储全文。
            </div>
            <div style={{ marginBottom: 8 }}>
              <strong>步骤 5a：无结果状态</strong> — 若 AI 检索返回 0 条候选，显示「未检索到候选」。不得使用 Mock 补位。
            </div>
            <div style={{ marginBottom: 8 }}>
              <strong>步骤 5b：失败状态</strong> — 若 API 超时或错误，显示错误信息 + 重试按钮。不得使用 Mock 补位。
            </div>
            <div style={{ marginBottom: 8 }}>
              <strong>步骤 5c：未开通状态</strong> — 若未配置 API Key，显示「功能未开通」提示 + 配置说明链接。
            </div>
          </div>
        </Card>

        {/* ========== 第四部分：配置清单 ========== */}
        <Card testId="section-config">
          <SectionTitle testId="section-config-title">四、未来真实接口所需配置清单</SectionTitle>
          <p style={{ fontSize: 12, color: COLORS.muted, marginBottom: 12 }}>
            以下配置在第十三阶段 B 实现时从环境变量读取，本阶段不要求用户提供。
          </p>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: COLORS.mockBg }}>
                <th style={{ padding: 8, textAlign: 'left', border: `1px solid ${COLORS.border}`, color: COLORS.ink }}>配置项</th>
                <th style={{ padding: 8, textAlign: 'left', border: `1px solid ${COLORS.border}`, color: COLORS.ink }}>环境变量</th>
                <th style={{ padding: 8, textAlign: 'left', border: `1px solid ${COLORS.border}`, color: COLORS.ink }}>默认值</th>
                <th style={{ padding: 8, textAlign: 'left', border: `1px solid ${COLORS.border}`, color: COLORS.ink }}>说明</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>搜索服务 Provider</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}><code>{AI_EVENT_DEFAULT_CONFIG.PROVIDER_ENV_VAR}</code></td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>none</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>openai / anthropic / custom</td>
              </tr>
              <tr>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>API Key</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}><code>{AI_EVENT_DEFAULT_CONFIG.API_KEY_ENV_VAR}</code></td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>无</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>不硬编码，从环境变量读取</td>
              </tr>
              <tr>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>AI 模型</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}><code>{AI_EVENT_DEFAULT_CONFIG.MODEL_ENV_VAR}</code></td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>由 Provider 决定</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>如 gpt-4o、claude-3.5-sonnet</td>
              </tr>
              <tr>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>请求超时</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>—</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>{AI_EVENT_DEFAULT_CONFIG.DEFAULT_TIMEOUT_MS}ms</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>30 秒</td>
              </tr>
              <tr>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>限流间隔</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>—</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>{AI_EVENT_DEFAULT_CONFIG.DEFAULT_RATE_LIMIT_MS}ms</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>最小请求间隔 1 秒</td>
              </tr>
              <tr>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>成本上限</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>—</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>${AI_EVENT_DEFAULT_CONFIG.DEFAULT_DAILY_COST_LIMIT_USD}/天</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>超出则拒绝请求</td>
              </tr>
              <tr>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>缓存 TTL</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>—</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>{AI_EVENT_DEFAULT_CONFIG.DEFAULT_CACHE_TTL_MS}ms</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>5 分钟</td>
              </tr>
              <tr>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>窗口天数</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>—</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>{AI_EVENT_DEFAULT_CONFIG.DEFAULT_WINDOW_DAYS}天</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>节点日前后各 3 天</td>
              </tr>
            </tbody>
          </table>
        </Card>

        {/* ========== 第五部分：安全与产品文案清单 ========== */}
        <Card testId="section-safety">
          <SectionTitle testId="section-safety-title">五、安全与产品文案清单</SectionTitle>
          <ul style={{ fontSize: 13, color: COLORS.ink, lineHeight: 1.8, margin: 0, paddingLeft: 20 }}>
            <li><strong>核心免责</strong>：{AI_EVENT_SAFETY_MESSAGES.NOT_CAUSE_WARNING}</li>
            <li><strong>实验性提示</strong>：{AI_EVENT_SAFETY_MESSAGES.EXPERIMENTAL_WARNING}</li>
            <li><strong>不可用提示</strong>：{AI_EVENT_SAFETY_MESSAGES.DISABLED_REASON}</li>
            <li><strong>空状态</strong>：{AI_EVENT_SAFETY_MESSAGES.EMPTY_RESULT}（不得使用 Mock 补位）</li>
            <li><strong>Mock 标签</strong>：{AI_EVENT_SAFETY_MESSAGES.MOCK_LABEL}</li>
            <li><strong>真实标签</strong>：{AI_EVENT_SAFETY_MESSAGES.REAL_LABEL}</li>
            <li><strong>用户添加标签</strong>：{AI_EVENT_SAFETY_MESSAGES.USER_ADDED_LABEL}</li>
            <li><strong>不存储全文</strong>：{AI_EVENT_SAFETY_MESSAGES.NO_FULL_TEXT_STORAGE}</li>
            <li><strong>AI 能力边界</strong>：{AI_EVENT_SAFETY_MESSAGES.AI_CAPABILITY_BOUNDARY}</li>
          </ul>
          <div
            data-testid="safety-no-causation-checklist"
            style={{
              marginTop: 16, padding: 12, background: COLORS.errorBg,
              border: `1px solid ${COLORS.errorBorder}`, borderRadius: 6,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.red, marginBottom: 8 }}>
              禁止出现的因果表述（测试将校验）
            </div>
            <ul style={{ fontSize: 12, color: COLORS.red, lineHeight: 1.8, margin: 0, paddingLeft: 16 }}>
              <li>不得出现「导致上涨」「导致下跌」「利好推动」「利空打压」</li>
              <li>不得出现「预测」「目标价」「买入」「卖出」「持有」等投资建议</li>
              <li>不得将候选表述为股价涨跌原因</li>
              <li>aiRelevanceReason 只能说明检索匹配逻辑，不能表述因果</li>
            </ul>
          </div>
        </Card>

        {/* ========== 第六部分：验收标准与测试矩阵 ========== */}
        <Card testId="section-acceptance">
          <SectionTitle testId="section-acceptance-title">六、验收标准与测试矩阵</SectionTitle>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }} data-testid="test-matrix">
            <thead>
              <tr style={{ background: COLORS.mockBg }}>
                <th style={{ padding: 8, textAlign: 'left', border: `1px solid ${COLORS.border}` }}>测试场景</th>
                <th style={{ padding: 8, textAlign: 'left', border: `1px solid ${COLORS.border}` }}>验证点</th>
                <th style={{ padding: 8, textAlign: 'left', border: `1px solid ${COLORS.border}` }}>预期</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>类型契约完整性</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>AIEventCandidate 必填字段</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>7 个必填字段全部存在</td>
              </tr>
              <tr>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>Mock 标记</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>mock 候选 isRealEventCandidate</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>必须为 false</td>
              </tr>
              <tr>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>Disabled 标记</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>disabled 模式返回</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>空候选 + disabledReason</td>
              </tr>
              <tr>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>因果隔离</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>文案不含因果/预测词</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>无「导致上涨」「预测」等</td>
              </tr>
              <tr>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>来源区分</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>candidateSource 三种值</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>ai_retrieved / user_added / mock_sample</td>
              </tr>
              <tr>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>空状态</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>real 模式 0 候选</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>显示「未检索到候选」，不补 Mock</td>
              </tr>
              <tr>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>URL 校验</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>originalUrl 格式</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>必须为 http/https</td>
              </tr>
              <tr>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>验收页面渲染</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>页面 6 个区块</td>
                <td style={{ padding: 8, border: `1px solid ${COLORS.border}` }}>全部正确渲染</td>
              </tr>
            </tbody>
          </table>
        </Card>

        {/* ========== 第七部分：静态状态展示 ========== */}
        <Card testId="section-static-states">
          <SectionTitle testId="section-static-states-title">七、静态状态展示（UI 结构示例）</SectionTitle>
          <p style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16 }}>
            以下为 UI 结构静态示例，非真实检索结果。展示各种状态的渲染样式。
          </p>

          {/* 状态 1：Disabled 未开通 */}
          <div
            data-testid="state-disabled"
            style={{
              padding: 16, background: COLORS.errorBg,
              border: `1px solid ${COLORS.errorBorder}`, borderRadius: 8, marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Badge {...getModeBadge('disabled')} />
              <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink }}>状态：未开通</span>
            </div>
            <p style={{ fontSize: 13, color: COLORS.red, margin: 0 }}>
              {AI_EVENT_SAFETY_MESSAGES.DISABLED_REASON}
            </p>
          </div>

          {/* 状态 2：Mock 开发样本 */}
          <div
            data-testid="state-mock"
            style={{
              padding: 16, background: COLORS.mockBg,
              border: `1px solid ${COLORS.mockBorder}`, borderRadius: 8, marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Badge {...getModeBadge('mock')} />
              <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink }}>状态：开发样本</span>
              <span style={{ fontSize: 12, color: COLORS.muted }}>· 共 {STATIC_MOCK_CANDIDATES.length} 条</span>
            </div>
            {STATIC_MOCK_CANDIDATES.map((c, idx) => (
              <div
                key={c.id}
                data-testid={`mock-candidate-${idx}`}
                style={{
                  padding: 12, background: COLORS.card,
                  border: `1px solid ${COLORS.border}`, borderRadius: 6, marginBottom: 8,
                }}
              >
                <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                  <Badge {...getSourceBadge(c.candidateSource)} />
                  <Badge {...getRelevanceBadge(c.relevanceStatus)} />
                  {c.isMultiStockSummary && <Badge text="多股汇总" color={COLORS.orange} bg={COLORS.warnBg} border={COLORS.warnBorder} />}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink, marginBottom: 4 }}>{c.title}</div>
                <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 4 }}>{c.excerpt}</div>
                <div style={{ fontSize: 12, color: COLORS.weak, marginBottom: 4 }}>
                  {c.publishedAt} · {c.publisher}
                </div>
                <div style={{ fontSize: 11, color: COLORS.violet, marginBottom: 4 }}>
                  关联理由：{c.aiRelevanceReason}
                </div>
                <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>
                  检索词：{c.searchQueryUsed}
                </div>
                <a href={c.originalUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: COLORS.blue }}>
                  查看原文 →
                </a>
              </div>
            ))}
          </div>

          {/* 状态 3：未来真实结果 UI 示例（非真实数据） */}
          <div
            data-testid="state-real-static"
            style={{
              padding: 16, background: COLORS.mockBg,
              border: `1px dashed ${COLORS.mockBorder}`, borderRadius: 8, marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{
                display: 'inline-block', padding: '2px 8px', fontSize: 11, fontWeight: 600,
                borderRadius: 4, color: COLORS.muted, background: COLORS.mockBg, border: `1px solid ${COLORS.mockBorder}`,
              }}>
                未来 UI 示例
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.muted }}>状态：未来真实结果 UI 示例（非真实数据）</span>
              <span style={{ fontSize: 12, color: COLORS.weak }}>· 共 {STATIC_REAL_CANDIDATES.length} 条</span>
            </div>
            <p style={{ fontSize: 11, color: COLORS.orange, marginBottom: 12 }}>
              注：此为未来真实检索结果的 UI 结构示例，非真实检索结果。第十三阶段 B 接入后将由 AI 返回真实内容。
            </p>
            {STATIC_REAL_CANDIDATES.map((c, idx) => (
              <div
                key={c.id}
                data-testid={`real-candidate-${idx}`}
                style={{
                  padding: 12, background: COLORS.card,
                  border: `1px dashed ${COLORS.mockBorder}`, borderRadius: 6, marginBottom: 8,
                }}
              >
                <div style={{
                  fontSize: 10, color: COLORS.red, fontWeight: 600, marginBottom: 6,
                  background: COLORS.errorBg, padding: '2px 6px', borderRadius: 4, display: 'inline-block',
                }}>
                  静态 UI 示例，非真实检索结果
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                  <Badge {...getSourceBadge(c.candidateSource)} />
                  <Badge {...getRelevanceBadge(c.relevanceStatus)} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink, marginBottom: 4 }}>{c.title}</div>
                <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 4 }}>{c.excerpt}</div>
                <div style={{ fontSize: 12, color: COLORS.weak, marginBottom: 4 }}>
                  {c.publishedAt} · {c.publisher}
                </div>
                <div style={{ fontSize: 11, color: COLORS.violet, marginBottom: 4 }}>
                  关联理由：{c.aiRelevanceReason}
                </div>
                <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>
                  检索词：{c.searchQueryUsed}
                </div>
                <a href={c.originalUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: COLORS.muted }}>
                  示例原文链接（不可代表真实来源） →
                </a>
              </div>
            ))}
          </div>

          {/* 状态 4：空结果 */}
          <div
            data-testid="state-empty"
            style={{
              padding: 24, textAlign: 'center',
              background: COLORS.mockBg, border: `1px solid ${COLORS.border}`,
              borderRadius: 8, marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 14, color: COLORS.muted, marginBottom: 4 }}>
              {AI_EVENT_SAFETY_MESSAGES.EMPTY_RESULT}
            </div>
            <div style={{ fontSize: 12, color: COLORS.weak }}>
              真实检索返回 0 条候选时显示此状态，不使用 Mock 补位
            </div>
          </div>

          {/* 状态 5：错误 */}
          <div
            data-testid="state-error"
            style={{
              padding: 16, background: COLORS.errorBg,
              border: `1px solid ${COLORS.errorBorder}`, borderRadius: 8, marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.red, marginBottom: 4 }}>
              检索失败
            </div>
            <div style={{ fontSize: 12, color: COLORS.red, marginBottom: 8 }}>
              [示例错误] AI 搜索服务请求超时（30s）
            </div>
            <div style={{ fontSize: 12, color: COLORS.muted }}>
              错误时不使用 Mock 补位，显示重试按钮
            </div>
          </div>

          {/* 状态 6：加载中 */}
          <div
            data-testid="state-loading"
            style={{
              padding: 24, textAlign: 'center',
              background: COLORS.card, border: `1px solid ${COLORS.border}`,
              borderRadius: 8, marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 14, color: COLORS.blue }}>
              AI 检索中...
            </div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
              正在生成检索词并执行网页搜索
            </div>
          </div>
        </Card>

        {/* ========== 页脚 ========== */}
        <div style={{ marginTop: 24, padding: 16, textAlign: 'center' }} data-testid="page-footer">
          <p style={{ fontSize: 12, color: COLORS.weak, margin: 0 }}>
            K-Ray 第十三阶段 A · AI 辅助事件检索 · 方案验证页 · 未接入真实搜索服务
          </p>
          <p style={{ fontSize: 11, color: COLORS.weak, marginTop: 4 }}>
            {AI_EVENT_SAFETY_MESSAGES.NOT_CAUSE_WARNING}
          </p>
        </div>
      </div>
    </div>
  );
}
