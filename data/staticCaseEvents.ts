// 第十八阶段发布前收口：五个静态案例的内置未来事件
//
// 每个案例包含：
//   1. 一条可核验事件：2026-08-31 半年度报告法定最晚披露日（origin=statutory_deadline）
//   2. 两条案例演示观察窗口（origin=case_demo，月份精度）
//
// 严格规则：
//   - case_demo 事件必须有 isFictional=true、generatedAt、disclaimer
//   - case_demo 事件不得有 sourceUrl/sourceName
//   - case_demo 事件标题必须包含"演示"
//   - case_demo 事件日期精度必须为 month
//   - 可核验事件必须有 HTTPS 官方来源
//   - 所有事件 ID 包含 origin、stockCode、date/month 和稳定 slug

import { StockEvent } from '@/types';

// 监管规则官方来源（证监会令第226号，2025-07-01 起施行，与 services/stockEvents/index.ts 保持一致）
const STATUTORY_SOURCE_NAME = '中国证监会《上市公司信息披露管理办法》（证监会令第226号）';
const STATUTORY_SOURCE_URL = 'https://www.csrc.gov.cn/csrc/c101953/c7547359/content.shtml';
const CASE_DEMO_GENERATED_AT = '2026-07-14T00:00:00.000Z';
const CASE_DEMO_DISCLAIMER = 'AI生成的案例演示日程，非真实公司安排' as const;

// ============================================================================
// 可核验事件：2026 年半年度报告法定最晚披露日
// ============================================================================

function makeSemiAnnualDeadlineEvent(stockCode: string): StockEvent {
  return {
    id: `statutory-deadline:${stockCode}:semi-annual:2026`,
    stockCode,
    title: '2026年半年度报告法定最晚披露日（非公司预约日）',
    category: 'earnings_deadline',
    origin: 'statutory_deadline',
    date: '2026-08-31',
    datePrecision: 'deadline',
    status: 'upcoming',
    sourceName: STATUTORY_SOURCE_NAME,
    sourceUrl: STATUTORY_SOURCE_URL,
    verifiedAt: CASE_DEMO_GENERATED_AT,
    description: '半年度报告法定最晚披露日为当年8月31日。此为法定期限，非公司预约披露日期。',
  };
}

// ============================================================================
// 案例演示观察窗口（月份精度）
// ============================================================================

interface DemoWindowConfig {
  slug: string;          // 稳定 slug，用于 ID
  month: string;         // YYYY-MM
  title: string;         // 标题（必须包含"演示"）
  description: string;   // 描述
}

function makeCaseDemoEvent(stockCode: string, config: DemoWindowConfig): StockEvent {
  return {
    id: `case-demo:${stockCode}:${config.month}:${config.slug}`,
    stockCode,
    title: config.title,
    category: 'company_event',
    origin: 'case_demo',
    month: config.month,
    datePrecision: 'month',
    status: 'demo',
    sourceName: '',
    sourceUrl: '',
    // 不设置 verifiedAt：演示事件不是事实核验记录，避免被误解为已验证
    description: config.description,
    isFictional: true,
    generatedAt: CASE_DEMO_GENERATED_AT,
    disclaimer: CASE_DEMO_DISCLAIMER,
  };
}

// ============================================================================
// 五个案例的演示观察窗口配置
// ============================================================================

// 通用：半年度经营信息观察窗口
function makeSemiAnnualOperationWindow(stockCode: string, month: string): StockEvent {
  return makeCaseDemoEvent(stockCode, {
    slug: 'semi-annual-operation-window',
    month,
    title: '演示·半年度经营信息观察窗口',
    description: '示例关注窗口：半年度经营情况可能在中报前后披露，具体日期以公司公告为准。此为案例演示，非真实公司安排。',
  });
}

// 各公司专属观察窗口
const COMPANY_SPECIFIC_WINDOWS: Record<string, DemoWindowConfig> = {
  '300750': {
    slug: 'battery-industry-window',
    month: '2026-08',
    title: '演示·动力电池产业动态观察窗口',
    description: '示例关注窗口：动力电池产业动态（装机量、原材料价格、技术路线）可能影响板块情绪。此为案例演示，非真实公司安排。',
  },
  '600519': {
    slug: 'mid-autumn-channel-window',
    month: '2026-09',
    title: '演示·中秋国庆渠道动态观察窗口',
    description: '示例关注窗口：中秋国庆旺季前渠道打款发货动态可能反映景气度。此为案例演示，非真实公司安排。',
  },
  '603236': {
    slug: 'iot-module-industry-window',
    month: '2026-08',
    title: '演示·物联网模组产业动态观察窗口',
    description: '示例关注窗口：物联网模组出货量、车载模组渗透趋势可能影响板块预期。此为案例演示，非真实公司安排。',
  },
  '603986': {
    slug: 'storage-chip-supply-window',
    month: '2026-09',
    title: '演示·存储芯片供需动态观察窗口',
    description: '示例关注窗口：存储芯片现货价格、库存周期可能影响产业链预期。此为案例演示，非真实公司安排。',
  },
  '002594': {
    slug: 'nev-sales-window',
    month: '2026-09',
    title: '演示·新能源车销量及新品动态观察窗口',
    description: '示例关注窗口：月度销量、新车型发布可能影响市场预期。此为案例演示，非真实公司安排。',
  },
};

// ============================================================================
// 生成指定案例的全部内置事件
// ============================================================================

export function getCaseBuiltInEvents(stockCode: string): StockEvent[] {
  const events: StockEvent[] = [];

  // 1. 可核验事件：半年度报告法定最晚披露日
  events.push(makeSemiAnnualDeadlineEvent(stockCode));

  // 2. 案例演示：半年度经营信息观察窗口（7月）
  events.push(makeSemiAnnualOperationWindow(stockCode, '2026-07'));

  // 3. 案例演示：公司专属观察窗口
  const companyWindow = COMPANY_SPECIFIC_WINDOWS[stockCode];
  if (companyWindow) {
    events.push(makeCaseDemoEvent(stockCode, companyWindow));
  }

  return events;
}
