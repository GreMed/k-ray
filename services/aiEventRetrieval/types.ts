/**
 * 第十三阶段 A：AI 辅助事件检索 — Provider-Neutral 类型契约
 *
 * 本阶段只定义类型契约与服务接口规范，不接入任何真实搜索 API。
 * 等待用户选择搜索服务并授权 API Key 后，再进入第十三阶段 B 实现真实联网搜索。
 *
 * 核心边界：
 * 1. AI 检索结果只是"候选信息"，不得表述为涨跌原因、预测或投资建议；
 * 2. 每条候选必须保留：标题、发布时间、来源名称、原文链接、检索时间、查询词、数据模式；
 * 3. 没有真实候选时必须显示"未检索到候选"，不得使用 Mock 新闻补位；
 * 4. AI 只能做检索词生成、相关性排序和关联理由说明，不能编造新闻、链接、发布时间或来源；
 * 5. 不抓取、复制或长期存储新闻全文；页面只展示必要摘要和原文链接；
 * 6. 需要明确区分：真实网页检索结果 / 用户手动添加链接 / Mock 开发样本。
 */

// ============================================================================
// 枚举类型
// ============================================================================

/**
 * AI 事件检索数据模式
 * - disabled: 未配置 API Key，功能不可用
 * - mock: 开发样本数据，明确标记为非真实
 * - real: 真实网页检索结果
 */
export type AIEventRetrievalMode = 'disabled' | 'mock' | 'real';

/**
 * AI 事件检索 Provider 类型（provider-neutral，未来可扩展）
 * - none: 未配置
 * - mock: Mock 开发样本
 * - openai: OpenAI 搜索服务（未来支持）
 * - anthropic: Anthropic 搜索服务（未来支持）
 * - custom: 自定义搜索服务（未来支持）
 */
export type AIEventRetrievalProvider = 'none' | 'mock' | 'openai' | 'anthropic' | 'custom';

/**
 * 候选来源类型（区分三种数据来源，满足核心边界第 6 条）
 * - ai_retrieved: AI 网页检索结果
 * - user_added: 用户手动添加的链接
 * - mock_sample: Mock 开发样本
 */
export type AICandidateSource = 'ai_retrieved' | 'user_added' | 'mock_sample';

/**
 * 相关性状态（仅表示检索匹配方式，不代表事实核验，不代表涨跌原因）
 * - direct_stock_match: 标题或正文片段直接提到目标股票/公司；
 * - contextual_match: 行业、上下游或市场背景相关，需用户判断；
 * - unverified: 无法确认
 *
 * 重要：这些状态仅表示检索匹配方式，AI 不是事实核验者，
 * 不代表候选与股价变动存在因果关系。
 */
export type AIRelevanceStatus = 'direct_stock_match' | 'contextual_match' | 'unverified';

// ============================================================================
// 查询与候选类型
// ============================================================================

/**
 * AI 事件检索查询参数
 *
 * 由关键节点点击触发，包含股票信息、节点日期、行业关键词，
 * 供 AI 生成检索词并执行网页搜索。
 */
export interface AIEventRetrievalQuery {
  /** 股票代码（6 位数字） */
  stockCode: string;
  /** 市场（SH / SZ） */
  market: 'SH' | 'SZ';
  /** 公司名称（用于生成检索词，如"贵州茅台""移远通信"） */
  companyName?: string;
  /** 关键节点日期（YYYY-MM-DD） */
  nodeDate: string;
  /** 节点前后窗口天数（默认 3，即节点日前后各 3 个自然日） */
  windowDays?: number;
  /** 行业关键词（用于生成检索词，如["白酒","高端消费"]） */
  industryKeywords?: string[];
  /** 节点类型（用于上下文理解） */
  nodeType?: 'significant_up' | 'significant_down' | 'local_high' | 'local_low';
}

/**
 * AI 检索事件候选项
 *
 * 核心边界第 2 条：每条候选必须保留以下字段：
 * - title（标题）
 * - publishedAt（发布时间）
 * - publisher（来源名称）
 * - originalUrl（原文链接）
 * - retrievedAt（检索时间）
 * - searchQueryUsed（查询词）
 * - dataMode（数据模式）
 *
 * 核心边界第 4 条：AI 不能编造新闻、链接、发布时间或来源。
 * 核心边界第 5 条：不抓取、复制或长期存储新闻全文。
 */
export interface AIEventCandidate {
  /** 稳定 ID（优先规范化原文 URL，否则用标题+时间+来源稳定哈希） */
  id: string;
  /** 查询的股票代码 */
  queryStockCode: string;
  /** 新闻标题（来自检索结果，禁止 AI 编造） */
  title: string;
  /** 摘要（来自检索结果，禁止 AI 生成或改写） */
  excerpt: string;
  /** 发布时间（YYYY-MM-DD HH:mm 或 YYYY-MM-DD，来自检索结果） */
  publishedAt: string;
  /** 来源名称（媒体或平台名称，来自检索结果） */
  publisher: string;
  /** 原文链接（必须为 http/https URL，来自检索结果） */
  originalUrl: string;
  /** 候选来源类型（区分 ai_retrieved / user_added / mock_sample） */
  candidateSource: AICandidateSource;
  /** 数据获取 Provider */
  acquisitionProvider: AIEventRetrievalProvider;
  /** 上游平台（如 eastmoney、sina 等） */
  upstreamPlatform: string;
  /** AI 生成的关联理由（说明为何检索到该候选，不表述因果） */
  aiRelevanceReason: string;
  /** AI 使用的检索词（用于透明化检索过程） */
  searchQueryUsed: string;
  /** 相关性状态 */
  relevanceStatus: AIRelevanceStatus;
  /** 数据模式 */
  dataMode: AIEventRetrievalMode;
  /** 是否为真实事件候选（mock/disabled 必须为 false） */
  isRealEventCandidate: boolean;
  /** 是否为多股汇总文章（资金流向榜、板块榜单等） */
  isMultiStockSummary?: boolean;
  /** 检索时间（ISO 格式） */
  retrievedAt: string;
}

// ============================================================================
// 元信息与结果类型
// ============================================================================

/**
 * AI 事件检索元信息
 *
 * 记录检索过程的完整元数据，用于透明化展示和成本监控。
 */
export interface AIEventRetrievalMeta {
  /** 数据获取 Provider */
  provider: AIEventRetrievalProvider;
  /** 使用的 AI 模型（如 gpt-4o、claude-3.5-sonnet 等，mock/disabled 为空字符串） */
  model: string;
  /** 上游搜索平台 */
  upstreamPlatform: string;
  /** 来源标签（用于 UI 展示） */
  sourceLabel: string;
  /** 数据模式 */
  dataMode: AIEventRetrievalMode;
  /** 是否为真实数据 */
  isRealData: boolean;
  /** 检索时间（ISO 格式） */
  fetchedAt: string;
  /** 候选总数 */
  totalCount: number;
  /** 真实候选数（仅 ai_retrieved 且 dataMode=real） */
  realCandidateCount: number;
  /** 用户手动添加数 */
  userAddedCount: number;
  /** verified 数量 */
  verifiedCount: number;
  /** unverified 数量 */
  unverifiedCount: number;
  /** AI 生成的检索词列表（透明化检索过程） */
  searchQueriesUsed: string[];
  /** 节点日期（YYYY-MM-DD） */
  nodeDate: string;
  /** 窗口开始日期（YYYY-MM-DD，含） */
  windowStart: string;
  /** 窗口结束日期（YYYY-MM-DD，含） */
  windowEnd: string;
  /** 查询耗时（毫秒） */
  queryDurationMs?: number;
  /** 成本信息（token 数、费用估算，用于成本监控） */
  costInfo?: {
    inputTokens?: number;
    outputTokens?: number;
    estimatedCostUsd?: number;
  };
  /** 降级原因（real 模式失败时） */
  fallbackReason?: string;
  /** 缓存状态 */
  cacheStatus: 'hit' | 'miss' | 'bypass';
  /** 功能不可用原因（disabled 时） */
  disabledReason?: string;
}

/**
 * AI 事件检索结果
 */
export interface AIEventRetrievalResult {
  /** 候选列表（按发布时间排序） */
  candidates: AIEventCandidate[];
  /** 元信息 */
  meta: AIEventRetrievalMeta;
}

// ============================================================================
// Provider 接口规范
// ============================================================================

/**
 * AI 事件检索 Provider 接口规范
 *
 * 未来实现真实搜索服务时（第十三阶段 B），需实现此接口。
 * 本阶段不实现任何 Provider，只定义契约。
 *
 * Provider 实现要求：
 * 1. isConfigured() 必须在 API Key 缺失时返回 false
 * 2. fetchCandidates() 在 disabled 模式下返回空结果 + disabledReason
 * 3. fetchCandidates() 在 real 模式下失败时，不得用 Mock 补位
 * 4. 每条返回的候选必须包含完整的可追溯字段
 */
export interface AIEventRetrievalDataProvider {
  /** Provider 标识 */
  readonly providerId: AIEventRetrievalProvider;
  /** 是否已配置可用（API Key 是否存在） */
  isConfigured(): boolean;
  /** 执行检索 */
  fetchCandidates(query: AIEventRetrievalQuery): Promise<AIEventRetrievalResult>;
}

// ============================================================================
// 配置类型（第十三阶段 B 使用）
// ============================================================================

/**
 * AI 事件检索配置项
 *
 * 第十三阶段 B 实现真实搜索服务时使用，从环境变量读取。
 * 本阶段只定义结构，不读取任何配置。
 */
export interface AIEventRetrievalConfig {
  /** 搜索服务提供商 */
  provider: AIEventRetrievalProvider;
  /** API Key（从环境变量 AI_EVENT_SEARCH_API_KEY 读取，不硬编码） */
  apiKey?: string;
  /** AI 模型名称（如 gpt-4o、claude-3.5-sonnet） */
  model?: string;
  /** 请求超时（毫秒，默认 30000） */
  timeoutMs?: number;
  /** 限流：最小请求间隔（毫秒，默认 1000） */
  rateLimitMs?: number;
  /** 成本上限（美元/天，超出则拒绝请求） */
  dailyCostLimitUsd?: number;
  /** 是否启用缓存（默认 true） */
  enableCache?: boolean;
  /** 缓存 TTL（毫秒，默认 300000 = 5 分钟） */
  cacheTtlMs?: number;
  /** 环境变量名（用于读取 API Key） */
  apiKeyEnvVar?: string;
}

// ============================================================================
// 安全文案常量
// ============================================================================

/**
 * 安全与产品文案常量
 *
 * 核心边界第 1 条：AI 检索结果只是"候选信息"，不得表述为涨跌原因、预测或投资建议。
 */
export const AI_EVENT_SAFETY_MESSAGES = {
  /** 核心免责声明 */
  NOT_CAUSE_WARNING: 'AI 检索结果仅为事件候选信息，不构成股价涨跌原因、预测或投资建议',
  /** 实验性提示 */
  EXPERIMENTAL_WARNING: '本功能为实验性 AI 检索能力，当前处于方案验证阶段，未接入真实搜索服务',
  /** 功能不可用提示 */
  DISABLED_REASON: '未配置 AI 搜索服务 API Key，当前功能不可用。请等待第十三阶段 B 配置真实搜索服务',
  /** 真实空状态 */
  EMPTY_RESULT: '未检索到候选',
  /** Mock 样本标签 */
  MOCK_LABEL: '开发样本（非真实检索结果）',
  /** 真实检索标签 */
  REAL_LABEL: '真实网页检索结果',
  /** 用户手动添加标签 */
  USER_ADDED_LABEL: '用户手动添加链接',
  /** 不存储全文提示 */
  NO_FULL_TEXT_STORAGE: '本功能不抓取、复制或长期存储新闻全文，仅展示摘要和原文链接',
  /** AI 能力边界说明 */
  AI_CAPABILITY_BOUNDARY: 'AI 只能做检索词生成、相关性排序和关联理由说明，不能编造新闻、链接、发布时间或来源',
} as const;

/**
 * 数据来源描述（用于 UI 展示和文档）
 */
export const AI_EVENT_DATA_SOURCE_DESCRIPTION = {
  /** 功能名称 */
  provider: 'AI 辅助事件检索',
  /** 能力说明 */
  capability: '根据股票代码、公司名称、节点日期、行业关键词生成检索词，检索网页新闻',
  /** 能力边界 */
  boundaries: [
    'AI 只能做检索词生成、相关性排序和关联理由说明',
    '不能编造新闻、链接、发布时间或来源',
    '不抓取、复制或长期存储新闻全文',
    '不表述为股价涨跌原因、预测或投资建议',
  ],
} as const;

// ============================================================================
// 默认配置常量（第十三阶段 B 使用）
// ============================================================================

/**
 * 默认配置值
 *
 * 第十三阶段 B 实现时使用，本阶段只定义常量。
 */
export const AI_EVENT_DEFAULT_CONFIG = {
  /** 默认超时 30 秒 */
  DEFAULT_TIMEOUT_MS: 30000,
  /** 默认限流间隔 1 秒 */
  DEFAULT_RATE_LIMIT_MS: 1000,
  /** 默认缓存 5 分钟 */
  DEFAULT_CACHE_TTL_MS: 5 * 60 * 1000,
  /** 默认每日成本上限 1 美元 */
  DEFAULT_DAILY_COST_LIMIT_USD: 1.0,
  /** 默认窗口天数 3 天 */
  DEFAULT_WINDOW_DAYS: 3,
  /** API Key 环境变量名 */
  API_KEY_ENV_VAR: 'AI_EVENT_SEARCH_API_KEY',
  /** 模型环境变量名 */
  MODEL_ENV_VAR: 'AI_EVENT_SEARCH_MODEL',
  /** Provider 环境变量名 */
  PROVIDER_ENV_VAR: 'AI_EVENT_SEARCH_PROVIDER',
} as const;

// ============================================================================
// 第十三阶段 B 数据校验契约（本阶段定义规则，不实现 Provider）
// ============================================================================

/**
 * 候选校验必填字段列表
 *
 * 核心边界第 2 条：每条候选必须保留以下字段，缺失任一即丢弃。
 * 核心边界第 4 条：AI 不能编造新闻、链接、发布时间或来源，因此不允许补造缺失字段。
 */
export const AI_CANDIDATE_REQUIRED_FIELDS = [
  'title',          // 标题
  'publishedAt',    // 发布时间
  'publisher',      // 来源名称
  'originalUrl',    // http/https 原文链接
  'retrievedAt',    // 检索时间
  'searchQueryUsed',// 查询词
  'dataMode',       // 数据模式
] as const;

/** 候选校验必填字段类型 */
export type AICandidateRequiredField = typeof AI_CANDIDATE_REQUIRED_FIELDS[number];

/**
 * 校验失败原因
 * - missing_field: 缺少必填字段
 * - invalid_url: 原文链接无法解析或非 http/https 格式
 * - empty_field: 字段为空字符串
 * - invalid_data_mode: dataMode 不属于 disabled / mock / real
 * - invalid_date: publishedAt 无法解析为有效日期
 * - invalid_iso_time: retrievedAt 不是有效 ISO 时间字符串
 */
export type AICandidateValidationFailureReason =
  | 'missing_field'
  | 'invalid_url'
  | 'empty_field'
  | 'invalid_data_mode'
  | 'invalid_date'
  | 'invalid_iso_time';

/**
 * 候选校验结果
 */
export interface AICandidateValidationResult {
  /** 是否通过校验 */
  valid: boolean;
  /** 失败字段名（valid=false 时有值） */
  failedField?: AICandidateRequiredField;
  /** 失败原因（valid=false 时有值） */
  failureReason?: AICandidateValidationFailureReason;
}

/**
 * 校验失败时的统一文案（绝不使用 Mock 新闻补位）
 */
export const AI_CANDIDATE_VALIDATION_FALLBACK_MESSAGES = {
  /** 候选不完整时的统一提示 */
  INCOMPLETE_RESULT: '未检索到可追溯候选',
  /** 校验失败详情说明（用于日志或开发面板，不直接展示给用户） */
  INCOMPLETE_DETAIL: '检索结果不完整：部分候选缺少必填字段或链接非法，已被丢弃',
} as const;
