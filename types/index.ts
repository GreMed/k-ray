// K-Ray 核心数据模型类型定义

// 股票信息 - 考虑不同市场可能出现相同代码的情况
export interface Stock {
  id: string; // 稳定ID
  code: string; // 股票代码,如 "600519"
  name: string; // 股票名称,如 "贵州茅台"
  market: 'SH' | 'SZ' | 'HK' | 'US'; // 市场:上海、深圳、香港、美国
  sector?: string; // 所属行业板块
}

// K线数据
export interface KLineData {
  id: string; // 稳定ID
  stockId: string; // 关联股票ID
  date: string; // 日期,统一格式 YYYY-MM-DD
  open: number; // 开盘价
  high: number; // 最高价
  low: number; // 最低价
  close: number; // 收盘价
  volume: number; // 成交量
  changePercent?: number; // 涨跌幅百分比
}

// 关键走势节点（Mock 演示数据用，保留以兼容第七阶段A及之前的数据结构）
export interface KeyNode {
  id: string; // 稳定ID
  stockId: string; // 关联股票ID
  date: string; // 日期,统一格式 YYYY-MM-DD
  nodeType: 'peak' | 'bottom' | 'breakout' | 'breakdown' | 'turn'; // 节点类型
  priceChange: number; // 价格变化幅度
  significance: 'high' | 'medium' | 'low'; // 重要程度
  description?: string; // 节点描述
}

// 第九阶段：基于行情数据识别的关键股价节点类型
export type MarketKeyNodeType =
  | 'significant_up' // 单日显著上涨
  | 'significant_down' // 单日显著下跌
  | 'local_high' // 阶段高点
  | 'local_low'; // 阶段低点

// 第九阶段：基于行情数据识别的关键股价节点
// 仅描述行情事实，不解释涨跌原因
export interface MarketKeyNode {
  id: string; // 稳定ID，格式：节点类型:股票代码:日期
  stockCode: string; // 股票代码，如 "600519"
  date: string; // 日期，统一格式 YYYY-MM-DD
  type: MarketKeyNodeType; // 节点类型
  title: string; // 节点标题，如 "单日显著上涨"
  close: number; // 当日收盘价
  changePercent: number; // 当日涨跌幅百分比
  volume: number; // 当日成交量（单位：股）
  previousClose: number | null; // 前一交易日收盘价，首日为 null
  previousVolume: number | null; // 前一交易日成交量，首日为 null
  volumeChangePercent: number | null; // 较前一交易日成交量变化百分比，首日为 null
  detailSummary: string; // 仅基于行情数据的事实说明
  evidenceLevel: 'market_data_only'; // 本阶段固定为仅行情数据
}

// 事件类型枚举
export type EventType = 
  | 'performance' // 财报业绩类
  | 'announcement' // 公司公告类
  | 'policy' // 行业政策类
  | 'order' // 订单客户类
  | 'capital' // 资本市场类
  | 'sector' // 板块行情类
  | 'expectation' // 机构预期类
  | 'risk'; // 风险事件类

// 来源类型枚举
export type SourceType = 'announcement' | 'financial' | 'regulatory' | 'news' | 'industry' | 'research';

// 事件来源
export interface EventSource {
  id: string; // 稳定ID
  name: string; // 来源名称,如 "公司公告"、"东方财富"、"券商研报"
  type: SourceType; // 来源类型
  title: string; // 来源标题
  publishTime: string; // 来源发布时间,统一格式 YYYY-MM-DD HH:mm
  publisher: string; // 发布机构
  excerpt: string; // 摘要或引用片段
  url?: string; // 原文链接(演示模式下为虚构地址)
  isDemo: boolean; // 是否为演示数据
  eventId: string; // 对应的eventId
}

// 历史事件
export interface HistoricalEvent {
  id: string; // 稳定ID
  stockId: string; // 关联股票ID
  eventType: EventType; // 事件类型
  title: string; // 事件标题
  summary: string; // 事件摘要
  occurTime: string; // 事件发生时间,统一格式 YYYY-MM-DD
  sourceIds: string[]; // 关联来源ID列表(对应EventSource的id),支持多来源
  influenceLogic?: string; // 可能的影响逻辑
  uncertaintyNote?: string; // 不确定性提示
  relatedNodeId?: string; // 关联的关键节点ID
}

// 未来事件日期确定性类型
export type FutureEventDateCertainty = 'confirmed' | 'estimated' | 'tentative';

// 未来事件 - 可辨识联合类型
// confirmed/estimated 必须有 scheduledDate（string）
// tentative 的 scheduledDate 必须为 null
export type FutureEvent =
  | {
      eventId: string;
      stockId: string;
      title: string;
      eventType: EventType;
      scheduledDate: string;
      dateCertainty: 'confirmed';
      description: string;
      attentionReason: string;
      sourceNote: string;
      isDemo: boolean;
    }
  | {
      eventId: string;
      stockId: string;
      title: string;
      eventType: EventType;
      scheduledDate: string;
      dateCertainty: 'estimated';
      description: string;
      attentionReason: string;
      sourceNote: string;
      isDemo: boolean;
    }
  | {
      eventId: string;
      stockId: string;
      title: string;
      eventType: EventType;
      scheduledDate: null;
      dateCertainty: 'tentative';
      description: string;
      attentionReason: string;
      sourceNote: string;
      isDemo: boolean;
    };

// 页面状态
export type PageState = 'initial' | 'loading' | 'success' | 'empty' | 'error';

// 复盘查询参数
export interface ReplayQuery {
  stockId: string; // 股票ID
  startDate: string; // 开始日期 YYYY-MM-DD
  endDate: string; // 结束日期 YYYY-MM-DD
}

// 复盘结果数据
export interface ReplayResult {
  stock: Stock;
  klines: KLineData[];
  keyNodes: KeyNode[];
  historicalEvents: HistoricalEvent[];
  sources: EventSource[];
  futureEvents: FutureEvent[];
  marketMeta?: MarketDataMeta;
}

// 市场数据源元信息
export interface MarketDataMeta {
  source: 'baostock' | 'mock';
  sourceLabel: string;
  adjustment: 'qfq' | 'none';
  isRealMarketData: boolean;
  fetchedAt: string;
  fallbackReason?: string;
  // 第十四阶段 A1 封板修复：真实 IPO 日期，用于区分"晚上市"与"周末/节假日/停牌"
  ipoDate?: string;
}

// 第十一阶段 A：用户录入的未来事件
// 明确标记为"用户录入"，不是系统验证结论
export type UserFutureEventCategory =
  | 'performance'    // 业绩披露
  | 'shareholder'    // 股东大会
  | 'product'        // 产品/行业事项
  | 'custom';        // 自定义

export interface UserFutureEvent {
  id: string;              // 稳定 ID，不依赖数组位置
  stockCode: string;       // 按 stockCode 隔离
  date: string;            // 事件日期（YYYY-MM-DD，必须为未来日期）
  title: string;           // 事件标题
  category: UserFutureEventCategory; // 事件类别
  originalUrl?: string;    // 可选原始链接
  note: string;            // 用户备注
  createdAt: string;       // 创建时间 ISO
  updatedAt: string;       // 更新时间 ISO
}

// ============================================================================
// 第十六阶段 里程碑二：统一股票事件类型
// 系统可信事件与用户事件统一为 StockEvent，通过 origin 字段区分可信度
// ============================================================================

// 统一事件类别
export type StockEventCategory =
  | 'earnings_scheduled'    // 财报预约披露
  | 'earnings_deadline'     // 财报法定最晚披露日
  | 'lockup_expiry'         // 限售解禁
  | 'shareholder_meeting'   // 股东大会
  | 'company_event'         // 公司官方活动
  | 'industry_conference'   // 行业会议
  | 'user_entered'          // 用户录入
  | 'other';                // 其他

// 事件来源：系统已验证 / 法定截止日 / 案例演示 / 用户录入
export type StockEventOrigin = 'system_verified' | 'statutory_deadline' | 'case_demo' | 'user_entered';

// 日期精度：精确日期 / 法定最晚日 / 仅月份
export type StockEventDatePrecision = 'exact' | 'deadline' | 'month';

// 统一股票事件
export interface StockEvent {
  id: string;
  stockCode: string;
  title: string;
  category: StockEventCategory;
  origin: StockEventOrigin;
  date?: string;            // YYYY-MM-DD（exact / deadline 精度使用）
  month?: string;           // YYYY-MM（month 精度使用）
  datePrecision: StockEventDatePrecision;
  status: string;
  sourceName: string;       // 系统事件必须有来源名称，用户事件可为空
  sourceUrl: string;        // 系统事件必须有来源链接，用户事件可为空
  verifiedAt?: string;      // ISO 时间戳（case_demo 演示事件不设置此字段，避免被理解为事实核验记录）
  description: string;
  // 用户事件特有字段
  note?: string;            // 用户备注
  createdAt?: string;       // 用户事件创建时间
  updatedAt?: string;       // 用户事件修改时间
  // case_demo 演示事件特有字段（强制校验）
  isFictional?: boolean;             // case_demo 必须为 true
  generatedAt?: string;              // case_demo 必须填写生成时间
  disclaimer?: 'AI生成的案例演示日程，非真实公司安排'; // case_demo 固定 disclaimer
}

// 第十二阶段 A：用户复盘笔记（第十六阶段升级为任意交易日笔记）
// 明确标记为"用户记录 / 用户观点"，不是系统验证结论
// 第十六阶段：按 stockCode + date 隔离，支持任意交易日
// 旧数据按 stockCode + nodeId 隔离，通过 migrateLegacyNotes 安全迁移
export interface ReplayNote {
  id: string;              // 稳定 ID，不依赖数组位置
  stockCode: string;       // 所属股票代码
  date: string;            // 交易日日期（YYYY-MM-DD，第十六阶段新增，任意交易日笔记的主键之一）
  nodeId: string | null;   // 所属关键节点 ID（格式：节点类型:股票代码:日期）；普通交易日为 null
  nodeType: string | null; // 节点类型（冗余存储，便于展示）；普通交易日为 null
  changePercent: number | null; // 节点涨跌幅（冗余存储，便于展示）；普通交易日为 null
  content: string;         // 用户填写的观察内容
  createdAt: string;       // 创建时间 ISO
  updatedAt: string;       // 最后修改时间 ISO
}

// ============================================================================
// 第十五阶段 A：Mock 核心复盘体验数据类型
// 所有字段显式标记 dataMode: 'mock'，与真实行情数据严格隔离
// ============================================================================

// Mock 事件候选类型：公司、行业、上下游、市场
export type MockCandidateType = 'company' | 'industry' | 'upstream' | 'market';

// Mock 核验状态：所有候选均为 Mock 数据，不进行真实核验
export type MockVerificationStatus = 'mock_unverified';

// Mock 事件候选项
export interface MockEventCandidate {
  id: string;                          // 稳定 ID
  title: string;                       // 候选标题
  date: string;                        // 候选日期 YYYY-MM-DD
  candidateType: MockCandidateType;    // 候选类型
  candidateTypeLabel: string;          // 候选类型中文标签（公司/行业/上下游/市场）
  timeDistanceDays: number;            // 与节点的时间距离（天，负数=节点之前，正数=节点之后）
  timeDistanceLabel: string;           // 时间距离标签，如 "节点前 3 天"
  reasonForCandidate: string;          // 为什么进入候选列表
  verificationStatus: MockVerificationStatus; // 核验状态
  verificationLabel: string;           // 核验状态标签，如 "待核验"
  dataMode: 'mock';                    // 显式标记 Mock
}

// Mock 复盘节点
export interface MockReplayNode {
  id: string;                          // 稳定 ID
  date: string;                        // 日期 YYYY-MM-DD
  close: number;                       // 收盘价
  changePercent: number;               // 涨跌幅百分比
  volume: number;                      // 成交量（单位：股）
  nodeType: MarketKeyNodeType;         // 节点类型（复用第九阶段类型）
  nodeTypeLabel: string;               // 节点类型中文标签
  aiReplaySummary: string;             // AI 复盘要点（80~150 字）
  marketFact: string;                  // 行情事实
  observationClues: string[];          // 可能相关的观察线索
  unconfirmedParts: string[];          // 尚未确认的部分
  candidates: MockEventCandidate[];    // 事件候选列表（2~4 条）
  dataMode: 'mock';                    // 显式标记 Mock
}

// Mock 核心复盘案例
export interface MockCoreReplayCase {
  id: string;                          // 稳定 ID
  stockCode: string;                   // 股票代码
  stockName: string;                   // 股票名称
  market: 'SH' | 'SZ';                 // 市场
  sector: string;                      // 所属行业
  description: string;                 // 案例说明
  klines: KLineData[];                 // Mock K 线数据
  nodes: MockReplayNode[];             // Mock 复盘节点（至少 3 个）
  dataMode: 'mock';                    // 显式标记 Mock
}

// ============================================================================
// 第十五阶段 B1：静态真实历史复盘案例数据类型
// 基于真实历史行情和真实公开资料制作，预先存储在项目中
// 不实时查询，不接入实时 AI
// ============================================================================

// 真实资料类型：政策、市场、公司、行业
export type StaticMaterialType = 'policy' | 'market' | 'company' | 'industry';

// 申万三级行业数据（仅当有可靠来源时填充，否则全为 null）
export interface SwLevel3Data {
  industryName: string | null;         // 申万三级行业名称
  indexCode: string | null;            // 申万三级行业指数代码
  changePercent: number | null;        // 当日涨跌幅
  sourceUrl: string | null;            // 来源链接
  collectedAt: string | null;          // 采集时间
}

// 真实事件资料（每条必须有可复核的原文链接）
export interface StaticEventMaterial {
  id: string;                          // 稳定唯一 ID
  title: string;                       // 真实标题
  publishedAt: string;                 // 真实发布时间 YYYY-MM-DD 或 YYYY-MM-DD HH:mm
  sourceName: string;                  // 来源名称
  sourceUrl: string;                   // 可直接打开的 http/https 原文链接
  collectedAt: string;                 // 检索/采集时间 YYYY-MM-DD
  stockCode: string;                   // 对应的股票代码
  nodeDate: string;                    // 对应的节点日期
  timeDistanceDays: number;            // 与节点相隔的自然日数（负=节点前，正=节点后）
  materialType: StaticMaterialType;    // 资料类型
  materialTypeLabel: string;           // 资料类型中文标签
  excerpt: string;                     // 简短摘要
  relevanceNote: string;               // 相关性说明（不得写确定性因果）
}

// 静态复盘摘要（预生成，非实时 AI）
export interface StaticReplaySummary {
  summary: string;                     // 摘要正文（160~220 中文字符）
  referencedCandidateIds: string[];    // 引用的事件 candidateId 列表
  isRealTimeAI: false;                 // 明确标注：不是实时 AI 生成
  generatedAt: string;                 // 生成时间
}

// 静态案例节点
export interface StaticCaseNode {
  id: string;                          // 稳定 ID（来自关键节点算法）
  date: string;                        // 日期 YYYY-MM-DD
  close: number;                       // 收盘价（来自快照）
  changePercent: number;               // 涨跌幅（来自快照）
  volume: number;                      // 成交量（来自快照）
  nodeType: MarketKeyNodeType;         // 节点类型
  nodeTypeLabel: string;               // 节点类型中文标签
  marketFact: string;                  // 行情事实说明
  observationClues: string[];          // 可能相关的观察线索
  unconfirmedParts: string[];          // 尚未确认的部分
  materials: StaticEventMaterial[];    // 真实事件资料列表
  replaySummary: StaticReplaySummary | null; // 静态复盘摘要（无合格资料时为 null）
  swLevel3: SwLevel3Data;              // 申万三级行业数据
}

// 来源清单条目
export interface StaticCaseSourceEntry {
  id: string;                          // 来源 ID
  title: string;                       // 来源标题
  sourceName: string;                  // 来源名称
  sourceUrl: string;                   // 真实 URL
  publishedAt: string;                 // 发布时间
  collectedAt: string;                 // 采集时间
  usedForNodeIds: string[];            // 被哪些节点引用
}

// 静态真实历史复盘案例
export interface StaticHistoricalCase {
  id: string;                          // 案例稳定 ID
  stockCode: string;                   // 股票代码
  stockName: string;                   // 股票名称
  market: 'SH' | 'SZ';                 // 市场
  description: string;                 // 案例说明
  caseMode: 'static_historical';       // 案例模式：静态历史
  isRealTime: false;                   // 是否实时：否
  isMock: false;                       // 是否 Mock：否
  requestStartDate: string;            // 请求开始日期
  requestEndDate: string;              // 请求结束日期
  actualFirstDate: string;             // 实际首根 K 线日期
  actualLastDate: string;              // 实际末根 K 线日期
  snapshotGeneratedAt: string;         // 快照生成时间
  adjustment: 'qfq';                   // 复权方式
  source: 'baostock';                  // 行情来源
  klines: KLineData[];                 // K 线数据（来自快照）
  nodes: StaticCaseNode[];             // 关键节点列表
  sourceList: StaticCaseSourceEntry[]; // 来源清单
  // 静态案例日历基准日：日历不依赖浏览器当天日期，固定以该日为基准
  calendarAsOfDate: string;            // 如 '2026-07-14'
  // 静态案例内置的未来事件（可核验 + 案例演示），不依赖运行时 loadStockEvents()
  futureEvents: StockEvent[];
}

// ========== 第二十阶段 A：本机自选股 ==========

// 自选股记录（localStorage 持久化，按 stockCode + market 确定唯一身份）
export interface WatchlistItem {
  stockCode: string;   // 股票代码，如 "600519"
  market: 'SH' | 'SZ'; // 市场
  stockName: string;   // 股票名称
  addedAt: string;     // 加入时间 ISO 字符串
}