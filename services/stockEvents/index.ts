// 第十六阶段 里程碑二：统一股票事件服务层
// 整合系统可信事件和用户录入事件，提供统一 StockEvent 接口
// 用户事件数据继续使用 userFutureEvents 服务的 localStorage 存储（向后兼容）
// 系统事件：法定最晚披露日（基于公开监管规则，不需要付费数据源）

import {
  StockEvent,
  StockEventCategory,
  UserFutureEvent,
  UserFutureEventCategory,
} from '@/types';
import {
  loadUserEvents,
  addUserEvent,
  updateUserEvent,
  deleteUserEvent,
  generateEventId,
  isFutureDate,
  isValidEventUrl,
} from '@/services/userFutureEvents';
import { getUpcomingStatutoryDeadlines, ReportType } from '@/config/reportDeadlines';

// ============================================================================
// 类别元信息配置（统一事件类别 → 中文标签 + 徽标样式）
// ============================================================================

export interface StockEventCategoryMeta {
  label: string;
  badgeClass: string;       // 徽标 Tailwind 类
  dotColor: string;         // 日历小圆点颜色
}

export const STOCK_EVENT_CATEGORY_META: Record<StockEventCategory, StockEventCategoryMeta> = {
  earnings_scheduled: {
    label: '财报预约披露',
    badgeClass: 'bg-blue/10 text-blue',
    dotColor: '#2864e6',
  },
  earnings_deadline: {
    label: '法定最晚披露日',
    badgeClass: 'bg-cyan/10 text-cyan',
    dotColor: '#00a6c8',
  },
  lockup_expiry: {
    label: '限售解禁',
    badgeClass: 'bg-orange/10 text-orange',
    dotColor: '#f59e0b',
  },
  shareholder_meeting: {
    label: '股东大会',
    badgeClass: 'bg-violet/10 text-violet',
    dotColor: '#7657d9',
  },
  company_event: {
    label: '公司活动',
    badgeClass: 'bg-teal/10 text-teal',
    dotColor: '#0f8b8d',
  },
  industry_conference: {
    label: '行业会议',
    badgeClass: 'bg-rose/10 text-rose',
    dotColor: '#db2777',
  },
  user_entered: {
    label: '用户录入',
    badgeClass: 'bg-gray-100 text-gray-600',
    dotColor: '#667085',
  },
  other: {
    label: '其他',
    badgeClass: 'bg-gray-100 text-gray-600',
    dotColor: '#667085',
  },
};

// ============================================================================
// 用户事件类别 ↔ 统一事件类别 双向映射
// ============================================================================

const USER_TO_STOCK_CATEGORY: Record<UserFutureEventCategory, StockEventCategory> = {
  performance: 'earnings_scheduled',
  shareholder: 'shareholder_meeting',
  product: 'company_event',
  custom: 'user_entered',
};

const STOCK_TO_USER_CATEGORY: Partial<Record<StockEventCategory, UserFutureEventCategory>> = {
  earnings_scheduled: 'performance',
  shareholder_meeting: 'shareholder',
  company_event: 'product',
  user_entered: 'custom',
};

// ============================================================================
// 用户事件 ↔ StockEvent 转换
// ============================================================================

export function userEventToStockEvent(event: UserFutureEvent): StockEvent {
  return {
    id: event.id,
    stockCode: event.stockCode,
    title: event.title,
    category: USER_TO_STOCK_CATEGORY[event.category] || 'user_entered',
    origin: 'user_entered',
    date: event.date,
    datePrecision: 'exact',
    status: 'active',
    sourceName: event.originalUrl ? '用户提供的链接' : '',
    sourceUrl: event.originalUrl || '',
    verifiedAt: event.updatedAt,
    description: event.note,
    note: event.note,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

// ============================================================================
// 系统事件校验：缺少来源的系统事件必须被丢弃
// ============================================================================

export function isValidSystemEvent(event: StockEvent): boolean {
  // 系统事件必须有来源名称和来源链接
  if (event.origin === 'system_verified' || event.origin === 'statutory_deadline') {
    if (!event.sourceName || !event.sourceUrl) {
      return false;
    }
    if (!isValidEventUrl(event.sourceUrl)) {
      return false;
    }
  }
  // case_demo 演示事件必须有完整的防误认字段
  if (event.origin === 'case_demo') {
    if (event.isFictional !== true) return false;
    if (!event.generatedAt) return false;
    if (event.disclaimer !== 'AI生成的案例演示日程，非真实公司安排') return false;
    // case_demo 必须无来源链接（不得冒充真实）
    if (event.sourceUrl) return false;
    if (event.sourceName) return false;
  }
  // 必须有日期或月份
  if (event.datePrecision === 'month') {
    if (!event.month) return false;
  } else {
    if (!event.date) return false;
  }
  return true;
}

// ============================================================================
// case_demo 演示事件校验：强制防误认规则
// ============================================================================

export function isValidCaseDemoEvent(event: StockEvent): boolean {
  if (event.origin !== 'case_demo') return false;
  // 必须包含演示防误认字段
  if (event.isFictional !== true) return false;
  if (!event.generatedAt) return false;
  if (event.disclaimer !== 'AI生成的案例演示日程，非真实公司安排') return false;
  // 不得有来源链接和来源名称（演示事件无原文链接）
  if (event.sourceUrl) return false;
  if (event.sourceName) return false;
  // 标题必须包含"演示"
  if (!event.title.includes('演示')) return false;
  // 日期精度必须是 month（案例观察窗口为月份精度）
  if (event.datePrecision !== 'month') return false;
  if (!event.month) return false;
  return true;
}

// ============================================================================
// 法定最晚披露日系统事件生成
// ============================================================================

// 监管规则官方来源（证监会令第226号，2025-07-01 起施行，HTTPS 稳定链接）
const STATUTORY_SOURCE_NAME = '中国证监会《上市公司信息披露管理办法》（证监会令第226号）';
const STATUTORY_SOURCE_URL = 'https://www.csrc.gov.cn/csrc/c101953/c7547359/content.shtml';

// 报告类型 → 法定期限说明（保留全类型定义以便后续扩展）
const REPORT_DEADLINE_DESCRIPTIONS: Record<ReportType, string> = {
  'annual': '年度报告法定最晚披露日为次年4月30日。此为法定期限，非公司预约披露日期。',
  'semi-annual': '半年度报告法定最晚披露日为当年8月31日。此为法定期限，非公司预约披露日期。',
  'q1': '一季度报告法定最晚披露日为当年4月30日。此为法定期限，非公司预约披露日期。',
  'q3': '三季度报告法定最晚披露日为当年10月31日。此为法定期限，非公司预约披露日期。',
};

// 当前系统自动生成的法定期限事件范围：
// 只保留年度报告和半年度报告（有稳定可核验的官方监管来源）
// 一季度、三季度事件暂不自动生成，待找到分别能够支撑季度报告期限的官方交易所或监管来源后才能恢复
const AUTO_GENERATED_REPORT_TYPES: ReportType[] = ['annual', 'semi-annual'];

// 根据法定期限生成系统事件
function generateStatutoryDeadlineEvents(stockCode: string, fromDate: string): StockEvent[] {
  const deadlines = getUpcomingStatutoryDeadlines(fromDate, 3);
  const now = new Date().toISOString();

  return deadlines
    .filter(d => AUTO_GENERATED_REPORT_TYPES.includes(d.reportType))
    .map(d => ({
      id: `statutory-deadline:${stockCode}:${d.reportType}:${d.reportYear}`,
      stockCode,
      title: `${d.label}法定最晚披露日（非公司预约日）`,
      category: 'earnings_deadline' as StockEventCategory,
      origin: 'statutory_deadline' as const,
      date: d.deadline,
      datePrecision: 'deadline' as const,
      status: 'upcoming',
      sourceName: STATUTORY_SOURCE_NAME,
      sourceUrl: STATUTORY_SOURCE_URL,
      verifiedAt: now,
      description: REPORT_DEADLINE_DESCRIPTIONS[d.reportType],
    }));
}

// ============================================================================
// 加载指定股票的全部事件（系统 + 用户）
// ============================================================================

export function loadStockEvents(stockCode: string): StockEvent[] {
  if (typeof window === 'undefined') return [];

  // 加载用户事件并转换
  const userEvents = loadUserEvents(stockCode);
  const userStockEvents = userEvents.map(userEventToStockEvent);

  // 系统事件：法定最晚披露日（基于公开监管规则，不需要付费数据源）
  const today = new Date().toISOString().slice(0, 10);
  const systemEvents = generateStatutoryDeadlineEvents(stockCode, today);

  // 过滤掉无效的系统事件（缺少来源的系统事件被丢弃）
  const validSystemEvents = systemEvents.filter(isValidSystemEvent);

  return [...validSystemEvents, ...userStockEvents];
}

// ============================================================================
// 用户事件 CRUD（委托给 userFutureEvents 服务，保持向后兼容）
// ============================================================================

export interface UserStockEventData {
  date: string;
  title: string;
  category: StockEventCategory;
  sourceUrl?: string;
  description: string;
}

export function addUserStockEvent(stockCode: string, data: UserStockEventData): StockEvent {
  const userCategory: UserFutureEventCategory =
    STOCK_TO_USER_CATEGORY[data.category] || 'custom';
  const userEvent = addUserEvent(stockCode, {
    date: data.date,
    title: data.title,
    category: userCategory,
    originalUrl: data.sourceUrl,
    note: data.description,
  });
  return userEventToStockEvent(userEvent);
}

export function updateUserStockEvent(
  stockCode: string,
  eventId: string,
  updates: Partial<UserStockEventData>,
): StockEvent | null {
  const userUpdates: Partial<Omit<UserFutureEvent, 'id' | 'stockCode' | 'createdAt'>> = {};
  if (updates.date !== undefined) userUpdates.date = updates.date;
  if (updates.title !== undefined) userUpdates.title = updates.title;
  if (updates.category !== undefined) {
    userUpdates.category = STOCK_TO_USER_CATEGORY[updates.category] || 'custom';
  }
  if (updates.sourceUrl !== undefined) userUpdates.originalUrl = updates.sourceUrl;
  if (updates.description !== undefined) userUpdates.note = updates.description;

  const updated = updateUserEvent(stockCode, eventId, userUpdates);
  return updated ? userEventToStockEvent(updated) : null;
}

export function deleteUserStockEvent(stockCode: string, eventId: string): boolean {
  return deleteUserEvent(stockCode, eventId);
}

// ============================================================================
// 工具函数
// ============================================================================

// 检查事件是否为用户事件
export function isUserEvent(event: StockEvent): boolean {
  return event.origin === 'user_entered';
}

// 检查事件是否为案例演示事件
export function isCaseDemoEvent(event: StockEvent): boolean {
  return event.origin === 'case_demo';
}

// 检查事件是否为可核验事件（系统已验证或法定期限）
export function isVerifiableEvent(event: StockEvent): boolean {
  return event.origin === 'system_verified' || event.origin === 'statutory_deadline';
}

// 获取事件的显示日期（精确日期或月份）
export function getEventDisplayDate(event: StockEvent): string {
  if (event.datePrecision === 'month' && event.month) {
    return event.month;
  }
  return event.date || '';
}

// 获取事件在日历上的日期（month 精度返回 null，不放在具体日期格子上）
export function getEventCalendarDate(event: StockEvent): string | null {
  if (event.datePrecision === 'month') return null;
  return event.date || null;
}

// 生成新的用户事件 ID（复用 userFutureEvents 的 ID 生成器）
export { generateEventId, isFutureDate, isValidEventUrl };
