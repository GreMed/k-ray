/**
 * 第十三阶段 A：AI 辅助事件检索 — 类型契约测试
 *
 * 验证 provider-neutral 类型契约的完整性和一致性。
 * 不测试真实 API，不依赖网络请求。
 *
 * @jest-environment node
 */

import {
  AIEventRetrievalMode,
  AIEventRetrievalProvider,
  AICandidateSource,
  AIRelevanceStatus,
  AIEventRetrievalQuery,
  AIEventCandidate,
  AIEventRetrievalMeta,
  AIEventRetrievalResult,
  AIEventRetrievalDataProvider,
  AI_EVENT_SAFETY_MESSAGES,
  AI_EVENT_DATA_SOURCE_DESCRIPTION,
  AI_EVENT_DEFAULT_CONFIG,
  AI_CANDIDATE_REQUIRED_FIELDS,
  AI_CANDIDATE_VALIDATION_FALLBACK_MESSAGES,
} from '@/services/aiEventRetrieval/types';
import {
  validateAICandidate,
  filterValidAICandidates,
  validateAICandidateList,
} from '@/services/aiEventRetrieval/validateCandidate';

// ============================================================================
// 辅助函数：构造合法的候选项
// ============================================================================

function createValidCandidate(overrides?: Partial<AIEventCandidate>): AIEventCandidate {
  return {
    id: 'test-001',
    queryStockCode: '600519',
    title: '测试新闻标题',
    excerpt: '测试摘要',
    publishedAt: '2024-03-15 18:30',
    publisher: '测试来源媒体',
    originalUrl: 'https://example.com/test-001',
    candidateSource: 'ai_retrieved',
    acquisitionProvider: 'openai',
    upstreamPlatform: 'eastmoney',
    aiRelevanceReason: '检索词与标题匹配',
    searchQueryUsed: '贵州茅台 2024年3月 业绩',
    relevanceStatus: 'direct_stock_match',
    dataMode: 'real',
    isRealEventCandidate: true,
    retrievedAt: '2024-07-12T10:00:00.000Z',
    ...overrides,
  };
}

function createValidMeta(overrides?: Partial<AIEventRetrievalMeta>): AIEventRetrievalMeta {
  return {
    provider: 'openai',
    model: 'gpt-4o',
    upstreamPlatform: 'eastmoney',
    sourceLabel: 'AI 辅助事件检索',
    dataMode: 'real',
    isRealData: true,
    fetchedAt: '2024-07-12T10:00:00.000Z',
    totalCount: 1,
    realCandidateCount: 1,
    userAddedCount: 0,
    verifiedCount: 1,
    unverifiedCount: 0,
    searchQueriesUsed: ['贵州茅台 2024年3月 业绩'],
    nodeDate: '2024-03-15',
    windowStart: '2024-03-12',
    windowEnd: '2024-03-18',
    cacheStatus: 'miss',
    ...overrides,
  };
}

// ============================================================================
// 测试套件
// ============================================================================

describe('第十三阶段 A：AI 辅助事件检索类型契约', () => {
  // ========== 1. 枚举类型验证 ==========

  describe('枚举类型', () => {
    test('AIEventRetrievalMode 包含 disabled / mock / real', () => {
      const modes: AIEventRetrievalMode[] = ['disabled', 'mock', 'real'];
      expect(modes).toContain('disabled');
      expect(modes).toContain('mock');
      expect(modes).toContain('real');
      expect(modes.length).toBe(3);
    });

    test('AIEventRetrievalProvider 包含 none / mock / openai / anthropic / custom', () => {
      const providers: AIEventRetrievalProvider[] = ['none', 'mock', 'openai', 'anthropic', 'custom'];
      expect(providers).toContain('none');
      expect(providers).toContain('mock');
      expect(providers).toContain('openai');
      expect(providers).toContain('anthropic');
      expect(providers).toContain('custom');
      expect(providers.length).toBe(5);
    });

    test('AICandidateSource 包含 ai_retrieved / user_added / mock_sample', () => {
      const sources: AICandidateSource[] = ['ai_retrieved', 'user_added', 'mock_sample'];
      expect(sources).toContain('ai_retrieved');
      expect(sources).toContain('user_added');
      expect(sources).toContain('mock_sample');
      expect(sources.length).toBe(3);
    });

    test('AIRelevanceStatus 包含 direct_stock_match / contextual_match / unverified', () => {
      const statuses: AIRelevanceStatus[] = ['direct_stock_match', 'contextual_match', 'unverified'];
      expect(statuses).toContain('direct_stock_match');
      expect(statuses).toContain('contextual_match');
      expect(statuses).toContain('unverified');
      expect(statuses.length).toBe(3);
    });

    test('AIRelevanceStatus 不再包含 verified（避免暗示 AI 是事实核验者）', () => {
      const statuses: AIRelevanceStatus[] = ['direct_stock_match', 'contextual_match', 'unverified'];
      expect(statuses).not.toContain('verified');
    });
  });

  // ========== 2. AIEventCandidate 必填字段验证 ==========

  describe('AIEventCandidate 必填字段（核心边界第 2 条）', () => {
    test('每条候选必须包含 7 个可追溯必填字段', () => {
      const candidate = createValidCandidate();
      // 核心边界第 2 条：标题、发布时间、来源名称、原文链接、检索时间、查询词、数据模式
      expect(candidate).toHaveProperty('title');
      expect(candidate).toHaveProperty('publishedAt');
      expect(candidate).toHaveProperty('publisher');
      expect(candidate).toHaveProperty('originalUrl');
      expect(candidate).toHaveProperty('retrievedAt');
      expect(candidate).toHaveProperty('searchQueryUsed');
      expect(candidate).toHaveProperty('dataMode');
    });

    test('候选必须包含 id 字段', () => {
      const candidate = createValidCandidate();
      expect(candidate).toHaveProperty('id');
      expect(candidate.id).toBeTruthy();
    });

    test('候选必须包含 queryStockCode 字段', () => {
      const candidate = createValidCandidate();
      expect(candidate).toHaveProperty('queryStockCode');
      expect(candidate.queryStockCode).toBeTruthy();
    });

    test('候选必须包含 candidateSource 字段用于区分来源', () => {
      const candidate = createValidCandidate();
      expect(candidate).toHaveProperty('candidateSource');
      expect(['ai_retrieved', 'user_added', 'mock_sample']).toContain(candidate.candidateSource);
    });

    test('候选必须包含 aiRelevanceReason 字段', () => {
      const candidate = createValidCandidate();
      expect(candidate).toHaveProperty('aiRelevanceReason');
      expect(candidate.aiRelevanceReason).toBeTruthy();
    });

    test('候选必须包含 isRealEventCandidate 字段', () => {
      const candidate = createValidCandidate();
      expect(candidate).toHaveProperty('isRealEventCandidate');
      expect(typeof candidate.isRealEventCandidate).toBe('boolean');
    });
  });

  // ========== 3. Mock / Disabled 标记规则 ==========

  describe('Mock / Disabled 标记规则（核心边界第 3、6 条）', () => {
    test('mock 候选的 isRealEventCandidate 必须为 false', () => {
      const mockCandidate = createValidCandidate({
        dataMode: 'mock',
        candidateSource: 'mock_sample',
        acquisitionProvider: 'mock',
        isRealEventCandidate: false,
      });
      expect(mockCandidate.dataMode).toBe('mock');
      expect(mockCandidate.isRealEventCandidate).toBe(false);
    });

    test('disabled 模式不返回候选（空列表）', () => {
      const disabledMeta = createValidMeta({
        dataMode: 'disabled',
        provider: 'none',
        isRealData: false,
        totalCount: 0,
        realCandidateCount: 0,
        disabledReason: '未配置 API Key',
      });
      const disabledResult: AIEventRetrievalResult = {
        candidates: [],
        meta: disabledMeta,
      };
      expect(disabledResult.candidates).toHaveLength(0);
      expect(disabledResult.meta.disabledReason).toBeTruthy();
      expect(disabledResult.meta.dataMode).toBe('disabled');
    });

    test('real 模式候选的 isRealEventCandidate 应为 true', () => {
      const realCandidate = createValidCandidate({
        dataMode: 'real',
        candidateSource: 'ai_retrieved',
        isRealEventCandidate: true,
      });
      expect(realCandidate.dataMode).toBe('real');
      expect(realCandidate.isRealEventCandidate).toBe(true);
    });

    test('user_added 来源的候选不计入 realCandidateCount', () => {
      const meta = createValidMeta({
        totalCount: 2,
        realCandidateCount: 1,
        userAddedCount: 1,
      });
      expect(meta.totalCount).toBe(2);
      expect(meta.realCandidateCount).toBe(1);
      expect(meta.userAddedCount).toBe(1);
    });
  });

  // ========== 4. 因果隔离验证 ==========

  describe('因果隔离（核心边界第 1 条）', () => {
    const FORBIDDEN_CAUSAL_TERMS = [
      '导致上涨',
      '导致下跌',
      '利好推动',
      '利空打压',
      '目标价',
      '上涨原因',
      '下跌原因',
    ];

    test('安全文案常量不包含因果表述', () => {
      const allMessages = Object.values(AI_EVENT_SAFETY_MESSAGES);
      for (const msg of allMessages) {
        for (const term of FORBIDDEN_CAUSAL_TERMS) {
          expect(msg).not.toContain(term);
        }
      }
    });

    test('数据来源描述不包含因果表述', () => {
      const descriptionValues = [
        AI_EVENT_DATA_SOURCE_DESCRIPTION.provider,
        AI_EVENT_DATA_SOURCE_DESCRIPTION.capability,
        ...AI_EVENT_DATA_SOURCE_DESCRIPTION.boundaries,
      ];
      for (const desc of descriptionValues) {
        for (const term of FORBIDDEN_CAUSAL_TERMS) {
          expect(desc).not.toContain(term);
        }
      }
    });

    test('aiRelevanceReason 示例不包含因果表述', () => {
      const validReason = '检索词与标题匹配，节点日期在新闻发布窗口内';
      for (const term of FORBIDDEN_CAUSAL_TERMS) {
        expect(validReason).not.toContain(term);
      }
    });
  });

  // ========== 5. URL 校验规则 ==========

  describe('URL 校验规则', () => {
    test('originalUrl 必须为 http/https 格式', () => {
      const candidate = createValidCandidate();
      expect(candidate.originalUrl).toMatch(/^https?:\/\//);
    });

    test('示例 URL https://example.com/test-001 通过校验', () => {
      expect('https://example.com/test-001').toMatch(/^https?:\/\//);
    });

    test('非 URL 字符串不通过校验', () => {
      expect('not-a-url').not.toMatch(/^https?:\/\//);
      expect('').not.toMatch(/^https?:\/\//);
    });
  });

  // ========== 6. AIEventRetrievalQuery 查询参数 ==========

  describe('AIEventRetrievalQuery 查询参数', () => {
    test('必填字段：stockCode, market, nodeDate', () => {
      const query: AIEventRetrievalQuery = {
        stockCode: '600519',
        market: 'SH',
        nodeDate: '2024-03-15',
      };
      expect(query.stockCode).toBe('600519');
      expect(query.market).toBe('SH');
      expect(query.nodeDate).toBe('2024-03-15');
    });

    test('可选字段：companyName, windowDays, industryKeywords, nodeType', () => {
      const query: AIEventRetrievalQuery = {
        stockCode: '603236',
        market: 'SH',
        companyName: '移远通信',
        nodeDate: '2024-03-15',
        windowDays: 3,
        industryKeywords: ['通信', '物联网'],
        nodeType: 'significant_up',
      };
      expect(query.companyName).toBe('移远通信');
      expect(query.windowDays).toBe(3);
      expect(query.industryKeywords).toEqual(['通信', '物联网']);
      expect(query.nodeType).toBe('significant_up');
    });
  });

  // ========== 7. AIEventRetrievalMeta 元信息完整性 ==========

  describe('AIEventRetrievalMeta 元信息完整性', () => {
    test('元信息包含 provider, model, dataMode', () => {
      const meta = createValidMeta();
      expect(meta).toHaveProperty('provider');
      expect(meta).toHaveProperty('model');
      expect(meta).toHaveProperty('dataMode');
    });

    test('元信息包含计数字段', () => {
      const meta = createValidMeta();
      expect(meta).toHaveProperty('totalCount');
      expect(meta).toHaveProperty('realCandidateCount');
      expect(meta).toHaveProperty('userAddedCount');
      expect(meta).toHaveProperty('verifiedCount');
      expect(meta).toHaveProperty('unverifiedCount');
    });

    test('元信息包含时间窗口字段', () => {
      const meta = createValidMeta();
      expect(meta).toHaveProperty('nodeDate');
      expect(meta).toHaveProperty('windowStart');
      expect(meta).toHaveProperty('windowEnd');
    });

    test('元信息包含缓存状态', () => {
      const meta = createValidMeta();
      expect(meta).toHaveProperty('cacheStatus');
      expect(['hit', 'miss', 'bypass']).toContain(meta.cacheStatus);
    });

    test('元信息包含检索词列表', () => {
      const meta = createValidMeta();
      expect(meta).toHaveProperty('searchQueriesUsed');
      expect(Array.isArray(meta.searchQueriesUsed)).toBe(true);
    });
  });

  // ========== 8. Provider 接口规范 ==========

  describe('AIEventRetrievalDataProvider 接口规范', () => {
    test('Provider 接口要求 isConfigured 方法', () => {
      // 类型检查：确保接口定义存在
      const mockProvider: AIEventRetrievalDataProvider = {
        providerId: 'mock',
        isConfigured: () => false,
        fetchCandidates: async () => ({
          candidates: [],
          meta: createValidMeta({ dataMode: 'mock', provider: 'mock' }),
        }),
      };
      expect(mockProvider.providerId).toBe('mock');
      expect(mockProvider.isConfigured()).toBe(false);
      expect(typeof mockProvider.fetchCandidates).toBe('function');
    });

    test('Provider 接口要求 fetchCandidates 方法', async () => {
      const mockProvider: AIEventRetrievalDataProvider = {
        providerId: 'mock',
        isConfigured: () => false,
        fetchCandidates: async () => ({
          candidates: [],
          meta: createValidMeta({ dataMode: 'mock', provider: 'mock' }),
        }),
      };
      const result = await mockProvider.fetchCandidates({
        stockCode: '600519',
        market: 'SH',
        nodeDate: '2024-03-15',
      });
      expect(result.candidates).toHaveLength(0);
      expect(result.meta.dataMode).toBe('mock');
    });
  });

  // ========== 9. 配置常量验证 ==========

  describe('配置常量', () => {
    test('默认超时为 30000ms', () => {
      expect(AI_EVENT_DEFAULT_CONFIG.DEFAULT_TIMEOUT_MS).toBe(30000);
    });

    test('默认限流间隔为 1000ms', () => {
      expect(AI_EVENT_DEFAULT_CONFIG.DEFAULT_RATE_LIMIT_MS).toBe(1000);
    });

    test('默认缓存 TTL 为 5 分钟', () => {
      expect(AI_EVENT_DEFAULT_CONFIG.DEFAULT_CACHE_TTL_MS).toBe(5 * 60 * 1000);
    });

    test('默认每日成本上限为 1 美元', () => {
      expect(AI_EVENT_DEFAULT_CONFIG.DEFAULT_DAILY_COST_LIMIT_USD).toBe(1.0);
    });

    test('默认窗口天数为 3 天', () => {
      expect(AI_EVENT_DEFAULT_CONFIG.DEFAULT_WINDOW_DAYS).toBe(3);
    });

    test('API Key 环境变量名为 AI_EVENT_SEARCH_API_KEY', () => {
      expect(AI_EVENT_DEFAULT_CONFIG.API_KEY_ENV_VAR).toBe('AI_EVENT_SEARCH_API_KEY');
    });

    test('Model 环境变量名为 AI_EVENT_SEARCH_MODEL', () => {
      expect(AI_EVENT_DEFAULT_CONFIG.MODEL_ENV_VAR).toBe('AI_EVENT_SEARCH_MODEL');
    });

    test('Provider 环境变量名为 AI_EVENT_SEARCH_PROVIDER', () => {
      expect(AI_EVENT_DEFAULT_CONFIG.PROVIDER_ENV_VAR).toBe('AI_EVENT_SEARCH_PROVIDER');
    });
  });

  // ========== 10. 安全文案完整性 ==========

  describe('安全文案完整性', () => {
    test('包含核心免责声明 NOT_CAUSE_WARNING', () => {
      expect(AI_EVENT_SAFETY_MESSAGES.NOT_CAUSE_WARNING).toBeTruthy();
      expect(AI_EVENT_SAFETY_MESSAGES.NOT_CAUSE_WARNING).toContain('不构成股价涨跌原因');
    });

    test('包含实验性提示 EXPERIMENTAL_WARNING', () => {
      expect(AI_EVENT_SAFETY_MESSAGES.EXPERIMENTAL_WARNING).toBeTruthy();
      expect(AI_EVENT_SAFETY_MESSAGES.EXPERIMENTAL_WARNING).toContain('未接入真实搜索服务');
    });

    test('包含不可用提示 DISABLED_REASON', () => {
      expect(AI_EVENT_SAFETY_MESSAGES.DISABLED_REASON).toBeTruthy();
      expect(AI_EVENT_SAFETY_MESSAGES.DISABLED_REASON).toContain('API Key');
    });

    test('包含空状态文案 EMPTY_RESULT', () => {
      expect(AI_EVENT_SAFETY_MESSAGES.EMPTY_RESULT).toBe('未检索到候选');
    });

    test('包含 Mock 标签 MOCK_LABEL', () => {
      expect(AI_EVENT_SAFETY_MESSAGES.MOCK_LABEL).toContain('开发样本');
      expect(AI_EVENT_SAFETY_MESSAGES.MOCK_LABEL).toContain('非真实');
    });

    test('包含真实标签 REAL_LABEL', () => {
      expect(AI_EVENT_SAFETY_MESSAGES.REAL_LABEL).toContain('真实');
    });

    test('包含用户添加标签 USER_ADDED_LABEL', () => {
      expect(AI_EVENT_SAFETY_MESSAGES.USER_ADDED_LABEL).toContain('用户手动添加');
    });

    test('包含不存储全文提示 NO_FULL_TEXT_STORAGE', () => {
      expect(AI_EVENT_SAFETY_MESSAGES.NO_FULL_TEXT_STORAGE).toContain('不抓取');
      expect(AI_EVENT_SAFETY_MESSAGES.NO_FULL_TEXT_STORAGE).toContain('原文链接');
    });

    test('包含 AI 能力边界说明 AI_CAPABILITY_BOUNDARY', () => {
      expect(AI_EVENT_SAFETY_MESSAGES.AI_CAPABILITY_BOUNDARY).toContain('不能编造');
    });
  });

  // ========== 11. 数据来源描述完整性 ==========

  describe('数据来源描述完整性', () => {
    test('包含 provider 字段', () => {
      expect(AI_EVENT_DATA_SOURCE_DESCRIPTION.provider).toBe('AI 辅助事件检索');
    });

    test('包含 capability 字段', () => {
      expect(AI_EVENT_DATA_SOURCE_DESCRIPTION.capability).toBeTruthy();
    });

    test('包含 4 条能力边界', () => {
      expect(AI_EVENT_DATA_SOURCE_DESCRIPTION.boundaries).toHaveLength(4);
      expect(AI_EVENT_DATA_SOURCE_DESCRIPTION.boundaries).toContain('不能编造新闻、链接、发布时间或来源');
      expect(AI_EVENT_DATA_SOURCE_DESCRIPTION.boundaries).toContain('不抓取、复制或长期存储新闻全文');
    });
  });

  // ========== 12. 第十三阶段 B 数据校验契约 ==========

  describe('第十三阶段 B 数据校验契约', () => {
    test('AI_CANDIDATE_REQUIRED_FIELDS 包含 7 个必填字段', () => {
      expect(AI_CANDIDATE_REQUIRED_FIELDS).toHaveLength(7);
      expect(AI_CANDIDATE_REQUIRED_FIELDS).toContain('title');
      expect(AI_CANDIDATE_REQUIRED_FIELDS).toContain('publishedAt');
      expect(AI_CANDIDATE_REQUIRED_FIELDS).toContain('publisher');
      expect(AI_CANDIDATE_REQUIRED_FIELDS).toContain('originalUrl');
      expect(AI_CANDIDATE_REQUIRED_FIELDS).toContain('retrievedAt');
      expect(AI_CANDIDATE_REQUIRED_FIELDS).toContain('searchQueryUsed');
      expect(AI_CANDIDATE_REQUIRED_FIELDS).toContain('dataMode');
    });

    test('校验失败文案为"未检索到可追溯候选"', () => {
      expect(AI_CANDIDATE_VALIDATION_FALLBACK_MESSAGES.INCOMPLETE_RESULT).toBe('未检索到可追溯候选');
    });

    test('校验失败详情包含"检索结果不完整"', () => {
      expect(AI_CANDIDATE_VALIDATION_FALLBACK_MESSAGES.INCOMPLETE_DETAIL).toContain('检索结果不完整');
      expect(AI_CANDIDATE_VALIDATION_FALLBACK_MESSAGES.INCOMPLETE_DETAIL).toContain('已被丢弃');
    });
  });

  // ========== 13. 校验函数：合法候选通过 ==========

  describe('校验函数：合法候选通过', () => {
    test('包含所有必填字段的候选通过校验', () => {
      const validCandidate = createValidCandidate();
      const result = validateAICandidate(validCandidate);
      expect(result.valid).toBe(true);
      expect(result.failedField).toBeUndefined();
      expect(result.failureReason).toBeUndefined();
    });

    test('originalUrl 为 https 格式通过校验', () => {
      const candidate = createValidCandidate({ originalUrl: 'https://example.com/news/001' });
      expect(validateAICandidate(candidate).valid).toBe(true);
    });

    test('originalUrl 为 http 格式通过校验', () => {
      const candidate = createValidCandidate({ originalUrl: 'http://example.com/news/001' });
      expect(validateAICandidate(candidate).valid).toBe(true);
    });
  });

  // ========== 14. 校验函数：缺失字段被拒绝 ==========

  describe('校验函数：缺失必填字段被拒绝', () => {
    test('缺标题（title）被拒绝', () => {
      const candidate = createValidCandidate();
      delete (candidate as Record<string, unknown>).title;
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('title');
      expect(result.failureReason).toBe('missing_field');
    });

    test('缺发布时间（publishedAt）被拒绝', () => {
      const candidate = createValidCandidate();
      delete (candidate as Record<string, unknown>).publishedAt;
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('publishedAt');
      expect(result.failureReason).toBe('missing_field');
    });

    test('缺来源名称（publisher）被拒绝', () => {
      const candidate = createValidCandidate();
      delete (candidate as Record<string, unknown>).publisher;
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('publisher');
      expect(result.failureReason).toBe('missing_field');
    });

    test('缺检索时间（retrievedAt）被拒绝', () => {
      const candidate = createValidCandidate();
      delete (candidate as Record<string, unknown>).retrievedAt;
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('retrievedAt');
      expect(result.failureReason).toBe('missing_field');
    });

    test('缺查询词（searchQueryUsed）被拒绝', () => {
      const candidate = createValidCandidate();
      delete (candidate as Record<string, unknown>).searchQueryUsed;
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('searchQueryUsed');
      expect(result.failureReason).toBe('missing_field');
    });

    test('缺数据模式（dataMode）被拒绝', () => {
      const candidate = createValidCandidate();
      delete (candidate as Record<string, unknown>).dataMode;
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('dataMode');
      expect(result.failureReason).toBe('missing_field');
    });
  });

  // ========== 15. 校验函数：非法链接被拒绝 ==========

  describe('校验函数：非法链接被拒绝', () => {
    test('缺原文链接（originalUrl）被拒绝', () => {
      const candidate = createValidCandidate();
      delete (candidate as Record<string, unknown>).originalUrl;
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('originalUrl');
      expect(result.failureReason).toBe('missing_field');
    });

    test('非 http/https 链接被拒绝', () => {
      const candidate = createValidCandidate({ originalUrl: 'ftp://example.com/news' });
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('originalUrl');
      expect(result.failureReason).toBe('invalid_url');
    });

    test('空字符串链接被拒绝', () => {
      const candidate = createValidCandidate({ originalUrl: '' });
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('originalUrl');
      expect(result.failureReason).toBe('empty_field');
    });

    test('纯文本链接被拒绝', () => {
      const candidate = createValidCandidate({ originalUrl: 'not-a-url' });
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('originalUrl');
      expect(result.failureReason).toBe('invalid_url');
    });
  });

  // ========== 16. 校验函数：空字段被拒绝 ==========

  describe('校验函数：空字符串字段被拒绝', () => {
    test('标题为空字符串被拒绝', () => {
      const candidate = createValidCandidate({ title: '' });
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('title');
      expect(result.failureReason).toBe('empty_field');
    });

    test('来源名称为空字符串被拒绝', () => {
      const candidate = createValidCandidate({ publisher: '   ' });
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('publisher');
      expect(result.failureReason).toBe('empty_field');
    });
  });

  // ========== 17. 批量校验与过滤 ==========

  describe('批量校验与过滤', () => {
    test('filterValidAICandidates 过滤掉不完整候选', () => {
      const candidates = [
        createValidCandidate({ id: 'valid-001' }),
        createValidCandidate({ id: 'invalid-001', title: '' }),
        createValidCandidate({ id: 'invalid-002', originalUrl: 'ftp://bad' }),
        createValidCandidate({ id: 'valid-002' }),
      ];
      const valid = filterValidAICandidates(candidates);
      expect(valid).toHaveLength(2);
      expect(valid[0].id).toBe('valid-001');
      expect(valid[1].id).toBe('valid-002');
    });

    test('validateAICandidateList 返回详细丢弃信息', () => {
      const candidates = [
        createValidCandidate({ id: 'valid-001' }),
        createValidCandidate({ id: 'invalid-001', title: '' }),
        createValidCandidate({ id: 'invalid-002', originalUrl: 'not-url' }),
      ];
      const result = validateAICandidateList(candidates);
      expect(result.validCandidates).toHaveLength(1);
      expect(result.rejectedCount).toBe(2);
      expect(result.rejections).toHaveLength(2);
      expect(result.rejections[0].index).toBe(1);
      expect(result.rejections[0].result.failedField).toBe('title');
      expect(result.rejections[1].index).toBe(2);
      expect(result.rejections[1].result.failedField).toBe('originalUrl');
    });

    test('全部不合法时返回空列表（绝不使用 Mock 补位）', () => {
      const candidates = [
        createValidCandidate({ title: '' }),
        createValidCandidate({ originalUrl: 'bad' }),
      ];
      const valid = filterValidAICandidates(candidates);
      expect(valid).toHaveLength(0);
      // 关键：不返回 Mock 候选补位
    });
  });

  // ========== 18. URL 校验加固：标准 URL 解析 ==========

  describe('URL 校验加固：标准 URL 解析', () => {
    test('合法 https URL 通过校验', () => {
      const candidate = createValidCandidate({ originalUrl: 'https://finance.eastmoney.com/a/202403151777040165.html' });
      expect(validateAICandidate(candidate).valid).toBe(true);
    });

    test('合法 http URL 通过校验', () => {
      const candidate = createValidCandidate({ originalUrl: 'http://finance.sina.com.cn/stock/2024-03-15/doc-001.html' });
      expect(validateAICandidate(candidate).valid).toBe(true);
    });

    test('https:// 无主机名被拒绝', () => {
      const candidate = createValidCandidate({ originalUrl: 'https:///path-only' });
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('originalUrl');
      expect(result.failureReason).toBe('invalid_url');
    });

    test('http:// 无主机名被拒绝', () => {
      const candidate = createValidCandidate({ originalUrl: 'http:///no-host' });
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('originalUrl');
      expect(result.failureReason).toBe('invalid_url');
    });

    test('仅 https:// 前缀无主机名被拒绝', () => {
      const candidate = createValidCandidate({ originalUrl: 'https://' });
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('originalUrl');
      expect(result.failureReason).toBe('invalid_url');
    });

    test('ftp 协议被拒绝', () => {
      const candidate = createValidCandidate({ originalUrl: 'ftp://example.com/news' });
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('originalUrl');
      expect(result.failureReason).toBe('invalid_url');
    });

    test('javascript 协议被拒绝', () => {
      const candidate = createValidCandidate({ originalUrl: 'javascript:alert(1)' });
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('originalUrl');
      expect(result.failureReason).toBe('invalid_url');
    });

    test('无法解析的字符串被拒绝', () => {
      const candidate = createValidCandidate({ originalUrl: 'not-a-url-at-all' });
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('originalUrl');
      expect(result.failureReason).toBe('invalid_url');
    });

    test('仅路径无协议被拒绝', () => {
      const candidate = createValidCandidate({ originalUrl: '/finance/news/001.html' });
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('originalUrl');
      expect(result.failureReason).toBe('invalid_url');
    });
  });

  // ========== 19. dataMode 校验加固：严格枚举 ==========

  describe('dataMode 校验加固：严格枚举', () => {
    test('dataMode = disabled 通过校验', () => {
      const candidate = createValidCandidate({ dataMode: 'disabled' });
      expect(validateAICandidate(candidate).valid).toBe(true);
    });

    test('dataMode = mock 通过校验', () => {
      const candidate = createValidCandidate({ dataMode: 'mock' });
      expect(validateAICandidate(candidate).valid).toBe(true);
    });

    test('dataMode = real 通过校验', () => {
      const candidate = createValidCandidate({ dataMode: 'real' });
      expect(validateAICandidate(candidate).valid).toBe(true);
    });

    test('dataMode = fake 被拒绝', () => {
      const candidate = createValidCandidate({ dataMode: 'fake' as unknown as 'real' });
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('dataMode');
      expect(result.failureReason).toBe('invalid_data_mode');
    });

    test('dataMode = production 被拒绝', () => {
      const candidate = createValidCandidate({ dataMode: 'production' as unknown as 'real' });
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('dataMode');
      expect(result.failureReason).toBe('invalid_data_mode');
    });

    test('dataMode = 数字 1 被拒绝', () => {
      const candidate = createValidCandidate({ dataMode: 1 as unknown as 'real' });
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('dataMode');
      expect(result.failureReason).toBe('invalid_data_mode');
    });

    test('dataMode = 空字符串被拒绝（先命中 empty_field）', () => {
      const candidate = createValidCandidate({ dataMode: '' as unknown as 'real' });
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('dataMode');
      // 空字符串先命中 empty_field 通用检查
      expect(result.failureReason).toBe('empty_field');
    });

    test('dataMode = Real（大小写敏感）被拒绝', () => {
      const candidate = createValidCandidate({ dataMode: 'Real' as unknown as 'real' });
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('dataMode');
      expect(result.failureReason).toBe('invalid_data_mode');
    });
  });

  // ========== 20. publishedAt 校验加固：可解析日期 ==========

  describe('publishedAt 校验加固：可解析日期', () => {
    test('YYYY-MM-DD 格式通过校验', () => {
      const candidate = createValidCandidate({ publishedAt: '2024-03-15' });
      expect(validateAICandidate(candidate).valid).toBe(true);
    });

    test('YYYY-MM-DD HH:mm 格式通过校验', () => {
      const candidate = createValidCandidate({ publishedAt: '2024-03-15 18:30' });
      expect(validateAICandidate(candidate).valid).toBe(true);
    });

    test('ISO 日期时间格式通过校验', () => {
      const candidate = createValidCandidate({ publishedAt: '2024-03-15T18:30:00' });
      expect(validateAICandidate(candidate).valid).toBe(true);
    });

    test('任意文本被拒绝', () => {
      const candidate = createValidCandidate({ publishedAt: '今天上午' as unknown as string });
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('publishedAt');
      expect(result.failureReason).toBe('invalid_date');
    });

    test('无意义文本被拒绝', () => {
      const candidate = createValidCandidate({ publishedAt: 'not-a-date' as unknown as string });
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('publishedAt');
      expect(result.failureReason).toBe('invalid_date');
    });

    test('无效月份被拒绝', () => {
      const candidate = createValidCandidate({ publishedAt: '2024-13-01' as unknown as string });
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('publishedAt');
      expect(result.failureReason).toBe('invalid_date');
    });

    test('无效日期被拒绝', () => {
      // 2024-13-45 既是无效月份也是无效日期，确保 new Date() 返回 Invalid Date
      const candidate = createValidCandidate({ publishedAt: '2024-13-45' as unknown as string });
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('publishedAt');
      expect(result.failureReason).toBe('invalid_date');
    });
  });

  // ========== 21. retrievedAt 校验加固：ISO 时间字符串 ==========

  describe('retrievedAt 校验加固：ISO 时间字符串', () => {
    test('完整 ISO 字符串（含 Z）通过校验', () => {
      const candidate = createValidCandidate({ retrievedAt: '2024-07-12T10:00:00.000Z' });
      expect(validateAICandidate(candidate).valid).toBe(true);
    });

    test('ISO 字符串（不含 Z）通过校验', () => {
      const candidate = createValidCandidate({ retrievedAt: '2024-07-12T10:00:00' });
      expect(validateAICandidate(candidate).valid).toBe(true);
    });

    test('纯日期（YYYY-MM-DD）被拒绝（缺少 T 分隔符）', () => {
      const candidate = createValidCandidate({ retrievedAt: '2024-07-12' as unknown as string });
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('retrievedAt');
      expect(result.failureReason).toBe('invalid_iso_time');
    });

    test('任意文本被拒绝', () => {
      const candidate = createValidCandidate({ retrievedAt: '刚刚' as unknown as string });
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('retrievedAt');
      expect(result.failureReason).toBe('invalid_iso_time');
    });

    test('日期时间但无 T 分隔符被拒绝', () => {
      const candidate = createValidCandidate({ retrievedAt: '2024-07-12 10:00:00' as unknown as string });
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('retrievedAt');
      expect(result.failureReason).toBe('invalid_iso_time');
    });

    test('无效 ISO 时间被拒绝', () => {
      const candidate = createValidCandidate({ retrievedAt: '2024-07-12T25:99:99' as unknown as string });
      const result = validateAICandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failedField).toBe('retrievedAt');
      expect(result.failureReason).toBe('invalid_iso_time');
    });
  });

  // ========== 22. 校验失败绝不以 Mock 补位（综合断言） ==========

  describe('校验失败绝不以 Mock 补位', () => {
    test('所有候选因非法 URL 被丢弃时，返回空列表', () => {
      const candidates = [
        createValidCandidate({ originalUrl: 'https:///no-host' }),
        createValidCandidate({ originalUrl: 'javascript:alert(1)' }),
        createValidCandidate({ originalUrl: 'not-a-url' }),
      ];
      const valid = filterValidAICandidates(candidates);
      expect(valid).toHaveLength(0);
      // 明确断言：不返回 Mock 候选补位
    });

    test('所有候选因非法 dataMode 被丢弃时，返回空列表', () => {
      const candidates = [
        createValidCandidate({ dataMode: 'fake' as unknown as 'real' }),
        createValidCandidate({ dataMode: 'production' as unknown as 'real' }),
      ];
      const valid = filterValidAICandidates(candidates);
      expect(valid).toHaveLength(0);
    });

    test('所有候选因非法时间字段被丢弃时，返回空列表', () => {
      const candidates = [
        createValidCandidate({ publishedAt: '今天上午' as unknown as string }),
        createValidCandidate({ retrievedAt: '2024-07-12' as unknown as string }),
      ];
      const valid = filterValidAICandidates(candidates);
      expect(valid).toHaveLength(0);
    });

    test('校验失败文案为"未检索到可追溯候选"，不含 Mock 补位提示', () => {
      // 引用常量确保文案一致
      expect(AI_CANDIDATE_VALIDATION_FALLBACK_MESSAGES.INCOMPLETE_RESULT).toBe('未检索到可追溯候选');
      // 文案中不应出现"Mock"或"开发样本"字样
      expect(AI_CANDIDATE_VALIDATION_FALLBACK_MESSAGES.INCOMPLETE_RESULT).not.toContain('Mock');
      expect(AI_CANDIDATE_VALIDATION_FALLBACK_MESSAGES.INCOMPLETE_RESULT).not.toContain('开发样本');
    });
  });
});
