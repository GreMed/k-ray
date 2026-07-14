/**
 * K-Ray 第十六阶段 里程碑二测试 — 未来三个月股票大事日历
 * 覆盖测试：
 *   1. 三个月范围
 *   2. 月份切换边界
 *   3. exact / deadline / month 三种日期精度
 *   4. 系统事件来源校验
 *   5. 无来源系统事件被丢弃
 *   6. 用户事件允许无来源
 *   7. 法定期限不冒充预约日期
 *   8. 用户旧数据迁移
 *   9. 股票代码隔离
 *   10. 空状态不使用 Mock 补位
 *
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

import StockEventCalendar from '@/components/StockEventCalendar';
import StockEventForm from '@/components/StockEventForm';
import {
  loadStockEvents,
  addUserStockEvent,
  updateUserStockEvent,
  deleteUserStockEvent,
  userEventToStockEvent,
  isValidSystemEvent,
  isUserEvent,
  getEventCalendarDate,
  STOCK_EVENT_CATEGORY_META,
} from '@/services/stockEvents';
import {
  REPORT_DEADLINES,
  getUpcomingStatutoryDeadlines,
  getDeadlineLabel,
} from '@/config/reportDeadlines';
import { addUserEvent, loadUserEvents } from '@/services/userFutureEvents';
import { StockEvent } from '@/types';

// === 轻量图表 mock ===
jest.mock('lightweight-charts', () => {
  const mockSeries = {
    setData: jest.fn(),
    setMarkers: jest.fn(),
    applyOptions: jest.fn(),
  };
  const mockChart = {
    addCandlestickSeries: jest.fn(() => mockSeries),
    subscribeCrosshairMove: jest.fn(),
    subscribeClick: jest.fn(),
    unsubscribeCrosshairMove: jest.fn(),
    unsubscribeClick: jest.fn(),
    applyOptions: jest.fn(),
    timeScale: jest.fn(() => ({ fitContent: jest.fn() })),
    remove: jest.fn(),
  };
  return {
    createChart: jest.fn(() => mockChart),
    CrosshairMode: { Normal: 0, Magnet: 1 },
    LineStyle: { Solid: 0 },
    ColorType: { Solid: 0 },
  };
});

// === 辅助函数 ===

function makeFutureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function makeStockEvent(overrides: Partial<StockEvent> = {}): StockEvent {
  return {
    id: `test-${Math.random().toString(36).slice(2, 9)}`,
    stockCode: '600519',
    title: '测试事件',
    category: 'earnings_scheduled',
    origin: 'system_verified',
    date: makeFutureDate(30),
    datePrecision: 'exact',
    status: 'active',
    sourceName: '上交所公告',
    sourceUrl: 'https://www.sse.com.cn/disclosure/listedinfo/announcement/',
    verifiedAt: new Date().toISOString(),
    description: '测试描述',
    ...overrides,
  };
}

beforeEach(() => {
  // 清理 localStorage
  if (typeof window !== 'undefined') {
    window.localStorage.clear();
  }
});

afterEach(() => {
  cleanup();
});

// ============================================================================
// 确定性时间固定：所有依赖 loadStockEvents 法定期限的测试统一使用 2026-07-14
// 避免"运行当天必须存在未来三个月法定期限事件"导致的不确定性
// ============================================================================

const FIXED_NOW = new Date('2026-07-14T00:00:00.000Z');
const realDate = Date;
const realNow = Date.now;

beforeAll(() => {
  // 固定 Date 构造函数和 Date.now
  (global as unknown as { Date: DateConstructor }).Date = class extends realDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(FIXED_NOW.getTime());
      } else {
        // 透传给原始 Date 构造器（处理 new Date('2026-08-31') 等）
        super(...(args as Parameters<DateConstructor>));
      }
    }
    static now() {
      return FIXED_NOW.getTime();
    }
  } as unknown as DateConstructor;
  Date.now = () => FIXED_NOW.getTime();
});

afterAll(() => {
  // 恢复真实时间
  (global as unknown as { Date: DateConstructor }).Date = realDate;
  Date.now = realNow;
});

// ============================================================================
// 1. 法定期限配置测试
// ============================================================================

describe('第十六阶段里程碑二：法定期限配置', () => {
  test('年报道定最晚披露日为次年4月30日', () => {
    const annual = REPORT_DEADLINES.find(d => d.reportType === 'annual')!;
    expect(annual.getDeadline(2024)).toBe('2025-04-30');
  });

  test('半年度报告法定最晚披露日为当年8月31日', () => {
    const semi = REPORT_DEADLINES.find(d => d.reportType === 'semi-annual')!;
    expect(semi.getDeadline(2024)).toBe('2024-08-31');
  });

  test('一季报法定最晚披露日为当年4月30日', () => {
    const q1 = REPORT_DEADLINES.find(d => d.reportType === 'q1')!;
    expect(q1.getDeadline(2024)).toBe('2024-04-30');
  });

  test('三季报法定最晚披露日为当年10月31日', () => {
    const q3 = REPORT_DEADLINES.find(d => d.reportType === 'q3')!;
    expect(q3.getDeadline(2024)).toBe('2024-10-31');
  });

  test('getUpcomingStatutoryDeadlines 返回未来三个月内的法定期限', () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const deadlines = getUpcomingStatutoryDeadlines(todayStr, 3);
    // 应该返回数组（可能为空，取决于当前日期附近是否有截止日）
    expect(Array.isArray(deadlines)).toBe(true);
    // 所有返回的截止日都应在未来三个月范围内
    const threeMonthsLater = new Date(today);
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
    for (const d of deadlines) {
      const deadlineDate = new Date(d.deadline + 'T00:00:00.000Z');
      expect(deadlineDate.getTime()).toBeGreaterThanOrEqual(new Date(todayStr + 'T00:00:00.000Z').getTime());
      expect(deadlineDate.getTime()).toBeLessThanOrEqual(threeMonthsLater.getTime());
    }
  });

  test('getDeadlineLabel 返回正确的报告类型标签', () => {
    expect(getDeadlineLabel('annual')).toBe('年度报告');
    expect(getDeadlineLabel('semi-annual')).toBe('半年度报告');
    expect(getDeadlineLabel('q1')).toBe('一季度报告');
    expect(getDeadlineLabel('q3')).toBe('三季度报告');
  });
});

// ============================================================================
// 2. 系统事件来源校验
// ============================================================================

describe('第十六阶段里程碑二：系统事件来源校验', () => {
  test('有来源的系统事件通过校验', () => {
    const event = makeStockEvent({
      origin: 'system_verified',
      sourceName: '上交所',
      sourceUrl: 'https://www.sse.com.cn',
    });
    expect(isValidSystemEvent(event)).toBe(true);
  });

  test('无来源名称的系统事件被丢弃', () => {
    const event = makeStockEvent({
      origin: 'system_verified',
      sourceName: '',
      sourceUrl: 'https://www.sse.com.cn',
    });
    expect(isValidSystemEvent(event)).toBe(false);
  });

  test('无来源链接的系统事件被丢弃', () => {
    const event = makeStockEvent({
      origin: 'system_verified',
      sourceName: '上交所',
      sourceUrl: '',
    });
    expect(isValidSystemEvent(event)).toBe(false);
  });

  test('来源链接非法的系统事件被丢弃', () => {
    const event = makeStockEvent({
      origin: 'system_verified',
      sourceName: '上交所',
      sourceUrl: 'not-a-url',
    });
    expect(isValidSystemEvent(event)).toBe(false);
  });

  test('法定截止日事件也需要有来源', () => {
    const event = makeStockEvent({
      origin: 'statutory_deadline',
      sourceName: '',
      sourceUrl: '',
    });
    expect(isValidSystemEvent(event)).toBe(false);
  });

  test('用户事件不需要来源（允许无来源）', () => {
    const event = makeStockEvent({
      origin: 'user_entered',
      sourceName: '',
      sourceUrl: '',
    });
    expect(isValidSystemEvent(event)).toBe(true);
  });

  test('month 精度的事件必须有 month 字段', () => {
    const event = makeStockEvent({
      datePrecision: 'month',
      month: undefined,
      date: undefined,
    });
    expect(isValidSystemEvent(event)).toBe(false);
  });

  test('month 精度的事件有 month 字段时通过校验', () => {
    const event = makeStockEvent({
      origin: 'user_entered',
      datePrecision: 'month',
      month: '2026-08',
      date: undefined,
    });
    expect(isValidSystemEvent(event)).toBe(true);
  });
});

// ============================================================================
// 3. 用户事件 ↔ StockEvent 转换
// ============================================================================

describe('第十六阶段里程碑二：用户事件转换', () => {
  test('userEventToStockEvent 正确转换所有字段', () => {
    const futureDate = makeFutureDate(45);
    addUserEvent('600519', {
      date: futureDate,
      title: '测试事件',
      category: 'performance',
      originalUrl: 'https://example.com',
      note: '测试备注',
    });

    const userEvents = loadUserEvents('600519');
    expect(userEvents.length).toBe(1);

    const stockEvent = userEventToStockEvent(userEvents[0]);
    expect(stockEvent.origin).toBe('user_entered');
    expect(stockEvent.date).toBe(futureDate);
    expect(stockEvent.title).toBe('测试事件');
    expect(stockEvent.category).toBe('earnings_scheduled');
    expect(stockEvent.sourceUrl).toBe('https://example.com');
    expect(stockEvent.description).toBe('测试备注');
    expect(stockEvent.datePrecision).toBe('exact');
  });

  test('旧类别正确映射到新类别', () => {
    const futureDate = makeFutureDate(60);

    addUserEvent('000001', {
      date: futureDate,
      title: '股东大会',
      category: 'shareholder',
      note: '',
    });
    const events = loadUserEvents('000001');
    const stockEvent = userEventToStockEvent(events[0]);
    expect(stockEvent.category).toBe('shareholder_meeting');
  });

  test('isUserEvent 正确识别用户事件', () => {
    const userEvent = makeStockEvent({ origin: 'user_entered' });
    const systemEvent = makeStockEvent({ origin: 'system_verified' });
    expect(isUserEvent(userEvent)).toBe(true);
    expect(isUserEvent(systemEvent)).toBe(false);
  });

  test('getEventCalendarDate 返回精确日期', () => {
    const exactEvent = makeStockEvent({ datePrecision: 'exact', date: '2026-08-15' });
    expect(getEventCalendarDate(exactEvent)).toBe('2026-08-15');
  });

  test('getEventCalendarDate 对 month 精度返回 null', () => {
    const monthEvent = makeStockEvent({ datePrecision: 'month', month: '2026-08', date: undefined });
    expect(getEventCalendarDate(monthEvent)).toBe(null);
  });
});

// ============================================================================
// 4. 用户事件 CRUD 和股票代码隔离
// ============================================================================

describe('第十六阶段里程碑二：用户事件 CRUD 和隔离', () => {
  test('新增用户事件后可以加载', () => {
    const futureDate = makeFutureDate(30);
    addUserStockEvent('600519', {
      date: futureDate,
      title: '测试新增',
      category: 'earnings_scheduled',
      sourceUrl: 'https://example.com',
      description: '测试描述',
    });

    const events = loadStockEvents('600519');
    // 封板修复：现在包含系统法定期限事件，过滤出用户事件验证
    const userEvents = events.filter(e => e.origin === 'user_entered');
    expect(userEvents.length).toBe(1);
    expect(userEvents[0].title).toBe('测试新增');
    expect(userEvents[0].origin).toBe('user_entered');
  });

  test('编辑用户事件后内容更新', () => {
    const futureDate = makeFutureDate(30);
    const event = addUserStockEvent('600519', {
      date: futureDate,
      title: '原始标题',
      category: 'earnings_scheduled',
      description: '原始描述',
    });

    updateUserStockEvent('600519', event.id, {
      title: '更新标题',
      description: '更新描述',
    });

    const events = loadStockEvents('600519');
    const userEvents = events.filter(e => e.origin === 'user_entered');
    expect(userEvents[0].title).toBe('更新标题');
    expect(userEvents[0].description).toBe('更新描述');
  });

  test('删除用户事件后不再加载', () => {
    const futureDate = makeFutureDate(30);
    const event = addUserStockEvent('600519', {
      date: futureDate,
      title: '待删除',
      category: 'other',
      description: '',
    });

    const success = deleteUserStockEvent('600519', event.id);
    expect(success).toBe(true);

    const events = loadStockEvents('600519');
    const userEvents = events.filter(e => e.origin === 'user_entered');
    expect(userEvents.length).toBe(0);
  });

  test('股票代码隔离：600519 和 000001 的事件互不影响', () => {
    const futureDate = makeFutureDate(30);
    addUserStockEvent('600519', {
      date: futureDate,
      title: '茅台事件',
      category: 'earnings_scheduled',
      description: '',
    });
    addUserStockEvent('000001', {
      date: futureDate,
      title: '平安事件',
      category: 'shareholder_meeting',
      description: '',
    });

    const events519 = loadStockEvents('600519');
    const events001 = loadStockEvents('000001');
    const userEvents519 = events519.filter(e => e.origin === 'user_entered');
    const userEvents001 = events001.filter(e => e.origin === 'user_entered');
    expect(userEvents519.length).toBe(1);
    expect(userEvents001.length).toBe(1);
    expect(userEvents519[0].title).toBe('茅台事件');
    expect(userEvents001[0].title).toBe('平安事件');
  });
});

// ============================================================================
// 5. 旧数据迁移
// ============================================================================

describe('第十六阶段里程碑二：旧数据迁移', () => {
  test('旧 UserFutureEvent 数据通过 loadStockEvents 正确加载', () => {
    const futureDate = makeFutureDate(30);
    // 使用旧服务直接写入 localStorage
    addUserEvent('600519', {
      date: futureDate,
      title: '旧格式事件',
      category: 'performance',
      originalUrl: 'https://example.com/old',
      note: '旧格式备注',
    });

    // 通过新服务加载
    const events = loadStockEvents('600519');
    // 封板修复：过滤出用户事件验证
    const userEvents = events.filter(e => e.origin === 'user_entered');
    expect(userEvents.length).toBe(1);
    expect(userEvents[0].title).toBe('旧格式事件');
    expect(userEvents[0].origin).toBe('user_entered');
    expect(userEvents[0].category).toBe('earnings_scheduled');
    expect(userEvents[0].sourceUrl).toBe('https://example.com/old');
    expect(userEvents[0].description).toBe('旧格式备注');
  });

  test('旧数据不丢失：新服务 CRUD 不破坏旧 localStorage 格式', () => {
    const futureDate1 = makeFutureDate(30);
    const futureDate2 = makeFutureDate(60);

    // 旧服务写入
    addUserEvent('600519', {
      date: futureDate1,
      title: '旧事件',
      category: 'shareholder',
      note: '',
    });

    // 新服务写入
    addUserStockEvent('600519', {
      date: futureDate2,
      title: '新事件',
      category: 'other',
      description: '',
    });

    // 旧服务仍能读取全部
    const oldEvents = loadUserEvents('600519');
    expect(oldEvents.length).toBe(2);

    // 新服务也能读取全部（封板修复：过滤用户事件）
    const stockEvents = loadStockEvents('600519');
    const userStockEvents = stockEvents.filter(e => e.origin === 'user_entered');
    expect(userStockEvents.length).toBe(2);
  });
});

// ============================================================================
// 6. 空状态
// ============================================================================

describe('第十六阶段里程碑二：空状态', () => {
  test('无事件时显示系统事件空状态', async () => {
    render(<StockEventCalendar events={[]} />);

    await waitFor(() => {
      expect(screen.getByTestId('no-system-events')).toBeInTheDocument();
    });
    expect(screen.getByTestId('no-system-events')).toHaveTextContent('未来三个月暂无可核验的系统事件');
  });

  test('空状态不使用 Mock 补位', async () => {
    render(<StockEventCalendar events={[]} />);

    await waitFor(() => {
      const emptyState = screen.getByTestId('no-system-events');
      // 不应包含 Mock 字样
      expect(emptyState.textContent).not.toMatch(/mock|演示|模拟/i);
    });
  });
});

// ============================================================================
// 7. 日历组件渲染和交互
// ============================================================================

describe('第十六阶段里程碑二：日历组件渲染', () => {
  test('渲染月份标签和星期表头', async () => {
    render(<StockEventCalendar events={[]} />);

    await waitFor(() => {
      expect(screen.getByTestId('calendar-grid')).toBeInTheDocument();
    });

    // 星期表头
    expect(screen.getByText('一')).toBeInTheDocument();
    expect(screen.getByText('日')).toBeInTheDocument();
  });

  test('三个月范围：当前月可显示，可切换到下月和下下月', async () => {
    render(<StockEventCalendar events={[]} />);

    await waitFor(() => {
      expect(screen.getByTestId('calendar-month-label')).toBeInTheDocument();
    });

    const now = new Date();
    const currentMonthLabel = `${now.getFullYear()}年${now.getMonth() + 1}月`;
    expect(screen.getByTestId('calendar-month-label')).toHaveTextContent(currentMonthLabel);

    // 下月按钮可用
    const nextBtn = screen.getByTestId('calendar-next-month');
    expect(nextBtn).not.toBeDisabled();

    // 点击下月
    fireEvent.click(nextBtn);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthLabel = `${nextMonth.getFullYear()}年${nextMonth.getMonth() + 1}月`;
    await waitFor(() => {
      expect(screen.getByTestId('calendar-month-label')).toHaveTextContent(nextMonthLabel);
    });
  });

  test('月份切换边界：不能切换到三个月范围之外', async () => {
    render(<StockEventCalendar events={[]} />);

    await waitFor(() => {
      expect(screen.getByTestId('calendar-month-label')).toBeInTheDocument();
    });

    // 上月按钮应禁用（当前月是最早月份）
    const prevBtn = screen.getByTestId('calendar-prev-month');
    expect(prevBtn).toBeDisabled();

    // 切换到下下月
    const nextBtn = screen.getByTestId('calendar-next-month');
    fireEvent.click(nextBtn);
    await waitFor(() => {
      expect(nextBtn).not.toBeDisabled();
    });
    fireEvent.click(nextBtn);

    // 下下月时，下月按钮应禁用（最远月份）
    await waitFor(() => {
      expect(nextBtn).toBeDisabled();
    });
  });

  test('点击日期格子显示该日期事件', async () => {
    const futureDate = makeFutureDate(15);
    const event = makeStockEvent({
      date: futureDate,
      title: '测试日历事件',
      origin: 'user_entered',
    });

    render(<StockEventCalendar events={[event]} />);

    await waitFor(() => {
      expect(screen.getByTestId('calendar-grid')).toBeInTheDocument();
    });

    // 等待日历挂载完成
    await waitFor(() => {
      const label = screen.getByTestId('calendar-month-label');
      expect(label.textContent).not.toBe('2026年1月');
    });

    // 导航到事件所在月份并点击日期
    const eventDate = new Date(futureDate + 'T00:00:00');
    const now = new Date();
    const monthDiff = (eventDate.getFullYear() - now.getFullYear()) * 12 + (eventDate.getMonth() - now.getMonth());

    for (let i = 0; i < monthDiff; i++) {
      fireEvent.click(screen.getByTestId('calendar-next-month'));
    }

    // 点击事件日期格子
    const cell = await screen.findByTestId(`calendar-cell-${futureDate}`);
    fireEvent.click(cell);

    // 应显示该日期的事件
    await waitFor(() => {
      expect(screen.getByTestId('selected-date-events')).toBeInTheDocument();
    });
    expect(screen.getByText('测试日历事件')).toBeInTheDocument();
  });

  test('系统事件和用户事件在日历上有不同的小圆点颜色', async () => {
    const futureDate = makeFutureDate(15);
    const systemEvent = makeStockEvent({
      date: futureDate,
      origin: 'system_verified',
      sourceName: '上交所',
      sourceUrl: 'https://www.sse.com.cn',
    });
    const userEvent = makeStockEvent({
      id: 'user-event-1',
      date: futureDate,
      origin: 'user_entered',
      sourceName: '',
      sourceUrl: '',
    });

    render(<StockEventCalendar events={[systemEvent, userEvent]} />);

    await waitFor(() => {
      expect(screen.getByTestId('calendar-grid')).toBeInTheDocument();
    });

    // 等待挂载
    await waitFor(() => {
      const label = screen.getByTestId('calendar-month-label');
      expect(label.textContent).not.toBe('2026年1月');
    });

    // 导航到事件月份
    const eventDate = new Date(futureDate + 'T00:00:00');
    const now = new Date();
    const monthDiff = (eventDate.getFullYear() - now.getFullYear()) * 12 + (eventDate.getMonth() - now.getMonth());

    for (let i = 0; i < monthDiff; i++) {
      fireEvent.click(screen.getByTestId('calendar-next-month'));
    }

    const cell = await screen.findByTestId(`calendar-cell-${futureDate}`);
    // 应有两个小圆点（系统+用户）
    const dots = cell.querySelectorAll('.rounded-full');
    expect(dots.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================================
// 8. 事件详情区分系统与用户
// ============================================================================

describe('第十六阶段里程碑二：系统与用户事件区分', () => {
  test('用户事件显示用户录入标记', async () => {
    const futureDate = makeFutureDate(15);
    const userEvent = makeStockEvent({
      id: 'user-test-1',
      date: futureDate,
      origin: 'user_entered',
      sourceName: '',
      sourceUrl: '',
      title: '用户事件',
    });

    render(<StockEventCalendar events={[userEvent]} />);

    await waitFor(() => {
      expect(screen.getByTestId('calendar-grid')).toBeInTheDocument();
    });

    // 等待挂载
    await waitFor(() => {
      const label = screen.getByTestId('calendar-month-label');
      expect(label.textContent).not.toBe('2026年1月');
    });

    // 导航到事件月份
    const eventDate = new Date(futureDate + 'T00:00:00');
    const now = new Date();
    const monthDiff = (eventDate.getFullYear() - now.getFullYear()) * 12 + (eventDate.getMonth() - now.getMonth());

    for (let i = 0; i < monthDiff; i++) {
      fireEvent.click(screen.getByTestId('calendar-next-month'));
    }

    const cell = await screen.findByTestId(`calendar-cell-${futureDate}`);
    fireEvent.click(cell);

    await waitFor(() => {
      expect(screen.getByTestId(`event-user-tag-${userEvent.id}`)).toBeInTheDocument();
    });
  });

  test('系统事件不显示用户录入标记', async () => {
    const futureDate = makeFutureDate(15);
    const systemEvent = makeStockEvent({
      id: 'sys-test-1',
      date: futureDate,
      origin: 'system_verified',
      sourceName: '上交所',
      sourceUrl: 'https://www.sse.com.cn',
      title: '系统事件',
    });

    render(<StockEventCalendar events={[systemEvent]} />);

    await waitFor(() => {
      expect(screen.getByTestId('calendar-grid')).toBeInTheDocument();
    });

    await waitFor(() => {
      const label = screen.getByTestId('calendar-month-label');
      expect(label.textContent).not.toBe('2026年1月');
    });

    const eventDate = new Date(futureDate + 'T00:00:00');
    const now = new Date();
    const monthDiff = (eventDate.getFullYear() - now.getFullYear()) * 12 + (eventDate.getMonth() - now.getMonth());

    for (let i = 0; i < monthDiff; i++) {
      fireEvent.click(screen.getByTestId('calendar-next-month'));
    }

    const cell = await screen.findByTestId(`calendar-cell-${futureDate}`);
    fireEvent.click(cell);

    await waitFor(() => {
      expect(screen.getByTestId(`calendar-event-${systemEvent.id}`)).toBeInTheDocument();
    });

    // 不应有用户录入标记
    expect(screen.queryByTestId(`event-user-tag-${systemEvent.id}`)).not.toBeInTheDocument();
  });

  test('法定最晚日事件显示法定最晚日标签', async () => {
    const futureDate = makeFutureDate(15);
    const deadlineEvent = makeStockEvent({
      id: 'deadline-test-1',
      date: futureDate,
      origin: 'statutory_deadline',
      datePrecision: 'deadline',
      sourceName: '证监会',
      sourceUrl: 'http://www.csrc.gov.cn',
      title: '年报法定最晚披露日',
    });

    render(<StockEventCalendar events={[deadlineEvent]} />);

    await waitFor(() => {
      expect(screen.getByTestId('calendar-grid')).toBeInTheDocument();
    });

    await waitFor(() => {
      const label = screen.getByTestId('calendar-month-label');
      expect(label.textContent).not.toBe('2026年1月');
    });

    const eventDate = new Date(futureDate + 'T00:00:00');
    const now = new Date();
    const monthDiff = (eventDate.getFullYear() - now.getFullYear()) * 12 + (eventDate.getMonth() - now.getMonth());

    for (let i = 0; i < monthDiff; i++) {
      fireEvent.click(screen.getByTestId('calendar-next-month'));
    }

    const cell = await screen.findByTestId(`calendar-cell-${futureDate}`);
    fireEvent.click(cell);

    await waitFor(() => {
      expect(screen.getByTestId(`event-deadline-tag-${deadlineEvent.id}`)).toBeInTheDocument();
    });
    expect(screen.getByTestId(`event-deadline-tag-${deadlineEvent.id}`)).toHaveTextContent('法定最晚日');
  });
});

// ============================================================================
// 9. month 精度事件显示在"本月待定事件"
// ============================================================================

describe('第十六阶段里程碑二：month 精度事件', () => {
  test('month 精度事件显示在本月待定事件区域', async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const monthEvent = makeStockEvent({
      id: 'month-test-1',
      origin: 'user_entered',
      datePrecision: 'month',
      month: currentMonth,
      date: undefined,
      title: '待定的用户事件测试',
      sourceName: '',
      sourceUrl: '',
    });

    render(<StockEventCalendar events={[monthEvent]} />);

    await waitFor(() => {
      expect(screen.getByTestId('pending-month-events')).toBeInTheDocument();
    });
    expect(screen.getByText('本月观察窗口')).toBeInTheDocument();
    expect(screen.getByText('待定的用户事件测试')).toBeInTheDocument();
  });
});

// ============================================================================
// 12. 封板修复：服务层真正返回法定最晚披露日系统事件
// ============================================================================

describe('第十六阶段封板修复：法定最晚披露日系统事件', () => {
  test('loadStockEvents 返回包含法定最晚披露日系统事件', () => {
    const events = loadStockEvents('600519');
    const systemEvents = events.filter(e => e.origin === 'statutory_deadline');

    // 当前日期是 2026-07-14，未来三个月内应有法定期限事件
    // 至少应该有一些法定期限事件（具体数量取决于当前日期）
    expect(systemEvents.length).toBeGreaterThan(0);
  });

  test('法定期限事件使用 statutory_deadline origin 和 deadline datePrecision', () => {
    const events = loadStockEvents('600519');
    const systemEvents = events.filter(e => e.origin === 'statutory_deadline');

    systemEvents.forEach(e => {
      expect(e.origin).toBe('statutory_deadline');
      expect(e.datePrecision).toBe('deadline');
      expect(e.category).toBe('earnings_deadline');
      expect(e.date).toBeTruthy();
      expect(e.sourceName).toBeTruthy();
      expect(e.sourceUrl).toBeTruthy();
      // 必须包含"非公司预约日"标识
      expect(e.title).toContain('非公司预约日');
      expect(e.description).toContain('法定期限');
      expect(e.description).toContain('非公司预约');
    });
  });

  test('法定期限事件有官方监管规则来源', () => {
    const events = loadStockEvents('600519');
    const systemEvents = events.filter(e => e.origin === 'statutory_deadline');

    systemEvents.forEach(e => {
      expect(e.sourceName).toContain('证监会');
      expect(e.sourceUrl).toMatch(/^https?:\/\/.+/);
      expect(e.sourceUrl).toContain('csrc.gov.cn');
    });
  });

  test('法定期限事件不冒充公司预约披露日', () => {
    const events = loadStockEvents('600519');
    const systemEvents = events.filter(e => e.origin === 'statutory_deadline');

    systemEvents.forEach(e => {
      // 不得使用 earnings_scheduled 类别（那是公司预约日）
      expect(e.category).not.toBe('earnings_scheduled');
      // 标题必须明确标注"法定最晚披露日"
      expect(e.title).toContain('法定最晚披露日');
    });
  });

  test('法定期限事件在未来三个月范围内', () => {
    const events = loadStockEvents('600519');
    const systemEvents = events.filter(e => e.origin === 'statutory_deadline');

    const now = new Date();
    const threeMonthsLater = new Date();
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

    systemEvents.forEach(e => {
      const eventDate = new Date(e.date!);
      expect(eventDate.getTime()).toBeGreaterThanOrEqual(now.getTime());
      expect(eventDate.getTime()).toBeLessThanOrEqual(threeMonthsLater.getTime());
    });
  });

  test('系统事件与用户事件可以共存', () => {
    const futureDate = makeFutureDate(30);
    addUserStockEvent('600519', {
      date: futureDate,
      title: '用户测试事件',
      category: 'other',
      description: '',
    });

    const events = loadStockEvents('600519');
    const systemEvents = events.filter(e => e.origin === 'statutory_deadline');
    const userEvents = events.filter(e => e.origin === 'user_entered');

    expect(systemEvents.length).toBeGreaterThan(0);
    expect(userEvents.length).toBe(1);
  });

  test('不同股票代码的法定期限事件按代码隔离', () => {
    const events519 = loadStockEvents('600519');
    const events001 = loadStockEvents('000001');

    const system519 = events519.filter(e => e.origin === 'statutory_deadline');
    const system001 = events001.filter(e => e.origin === 'statutory_deadline');

    // 系统事件数量应相同（法定期限对所有股票一致）
    expect(system519.length).toBe(system001.length);

    // 但 stockCode 必须不同
    system519.forEach(e => expect(e.stockCode).toBe('600519'));
    system001.forEach(e => expect(e.stockCode).toBe('000001'));
  });
});

// ============================================================================
// 13. 第十八阶段可信度收口：监管来源与系统事件范围约束
// ============================================================================

describe('第十八阶段可信度收口：法定期限监管来源约束', () => {
  // 法定期限事件 ID 中包含 reportType，可以从 ID 反推类型
  function extractReportTypeFromId(id: string): string | null {
    const match = id.match(/^statutory-deadline:[^:]+:([^:]+):/);
    return match ? match[1] : null;
  }

  test('自动生成的系统事件只有 annual 和 semi-annual', () => {
    const events = loadStockEvents('600519');
    const systemEvents = events.filter(e => e.origin === 'statutory_deadline');

    expect(systemEvents.length).toBeGreaterThan(0);
    systemEvents.forEach(e => {
      const reportType = extractReportTypeFromId(e.id);
      expect(reportType).not.toBeNull();
      expect(['annual', 'semi-annual']).toContain(reportType);
    });
  });

  test('不生成 q1、q3 系统事件', () => {
    const events = loadStockEvents('600519');
    const systemEvents = events.filter(e => e.origin === 'statutory_deadline');

    systemEvents.forEach(e => {
      const reportType = extractReportTypeFromId(e.id);
      expect(reportType).not.toBe('q1');
      expect(reportType).not.toBe('q3');
    });
  });

  test('来源 URL 必须为 HTTPS', () => {
    const events = loadStockEvents('600519');
    const systemEvents = events.filter(e => e.origin === 'statutory_deadline');

    expect(systemEvents.length).toBeGreaterThan(0);
    systemEvents.forEach(e => {
      expect(e.sourceUrl).toMatch(/^https:\/\//);
    });
  });

  test('来源域名必须严格属于 csrc.gov.cn', () => {
    const events = loadStockEvents('600519');
    const systemEvents = events.filter(e => e.origin === 'statutory_deadline');

    expect(systemEvents.length).toBeGreaterThan(0);
    systemEvents.forEach(e => {
      const url = new URL(e.sourceUrl!);
      // hostname 必须等于 csrc.gov.cn 或为其子域名
      expect(
        url.hostname === 'csrc.gov.cn' || url.hostname.endsWith('.csrc.gov.cn')
      ).toBe(true);
    });
  });

  test('来源 URL 必须等于指定的稳定官方内容页', () => {
    const EXPECTED_URL = 'https://www.csrc.gov.cn/csrc/c101953/c7547359/content.shtml';
    const events = loadStockEvents('600519');
    const systemEvents = events.filter(e => e.origin === 'statutory_deadline');

    expect(systemEvents.length).toBeGreaterThan(0);
    systemEvents.forEach(e => {
      expect(e.sourceUrl).toBe(EXPECTED_URL);
    });
  });

  test('法定期限事件标题仍标注"法定最晚披露日"和"非公司预约日"', () => {
    const events = loadStockEvents('600519');
    const systemEvents = events.filter(e => e.origin === 'statutory_deadline');

    expect(systemEvents.length).toBeGreaterThan(0);
    systemEvents.forEach(e => {
      expect(e.title).toContain('法定最晚披露日');
      expect(e.title).toContain('非公司预约日');
    });
  });
});

// ============================================================================
// 10. 事件表单
// ============================================================================

describe('第十六阶段里程碑二：事件表单', () => {
  test('新增模式渲染空表单', () => {
    render(
      <StockEventForm
        isOpen={true}
        mode="add"
        event={null}
        stockCode="600519"
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByTestId('stock-event-form')).toBeInTheDocument();
    expect(screen.getByTestId('stock-event-form-date')).toHaveValue('');
    expect(screen.getByTestId('stock-event-form-title')).toHaveValue('');
  });

  test('编辑模式加载已有事件数据', () => {
    const event = makeStockEvent({
      title: '编辑测试',
      date: '2026-08-15',
      category: 'shareholder_meeting',
      description: '编辑描述',
    });

    render(
      <StockEventForm
        isOpen={true}
        mode="edit"
        event={event}
        stockCode="600519"
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByTestId('stock-event-form-title')).toHaveValue('编辑测试');
    expect(screen.getByTestId('stock-event-form-date')).toHaveValue('2026-08-15');
    expect(screen.getByTestId('stock-event-form-note')).toHaveValue('编辑描述');
  });

  test('空标题提交时显示错误', () => {
    const onSave = jest.fn();
    render(
      <StockEventForm
        isOpen={true}
        mode="add"
        event={null}
        stockCode="600519"
        onSave={onSave}
        onCancel={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('stock-event-form-save'));

    expect(screen.getByTestId('stock-event-form-title-error')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  test('过去日期提交时显示错误', () => {
    const onSave = jest.fn();
    render(
      <StockEventForm
        isOpen={true}
        mode="add"
        event={null}
        stockCode="600519"
        onSave={onSave}
        onCancel={jest.fn()}
      />
    );

    // 设置过去日期
    fireEvent.change(screen.getByTestId('stock-event-form-date'), { target: { value: '2020-01-01' } });
    fireEvent.change(screen.getByTestId('stock-event-form-title'), { target: { value: '测试' } });
    fireEvent.click(screen.getByTestId('stock-event-form-save'));

    expect(screen.getByTestId('stock-event-form-date-error')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  test('合法数据提交时调用 onSave', () => {
    const onSave = jest.fn();
    render(
      <StockEventForm
        isOpen={true}
        mode="add"
        event={null}
        stockCode="600519"
        onSave={onSave}
        onCancel={jest.fn()}
      />
    );

    const futureDate = makeFutureDate(30);
    fireEvent.change(screen.getByTestId('stock-event-form-date'), { target: { value: futureDate } });
    fireEvent.change(screen.getByTestId('stock-event-form-title'), { target: { value: '测试事件' } });
    fireEvent.change(screen.getByTestId('stock-event-form-note'), { target: { value: '测试备注' } });
    fireEvent.click(screen.getByTestId('stock-event-form-save'));

    expect(onSave).toHaveBeenCalledWith({
      date: futureDate,
      title: '测试事件',
      category: 'earnings_scheduled',
      sourceUrl: undefined,
      description: '测试备注',
    });
  });
});

// ============================================================================
// 11. 类别元信息
// ============================================================================

describe('第十六阶段里程碑二：类别元信息', () => {
  test('所有类别都有标签和徽标样式', () => {
    const categories: StockEvent['category'][] = [
      'earnings_scheduled',
      'earnings_deadline',
      'lockup_expiry',
      'shareholder_meeting',
      'company_event',
      'industry_conference',
      'user_entered',
      'other',
    ];

    for (const cat of categories) {
      const meta = STOCK_EVENT_CATEGORY_META[cat];
      expect(meta).toBeDefined();
      expect(meta.label).toBeTruthy();
      expect(meta.badgeClass).toBeTruthy();
      expect(meta.dotColor).toBeTruthy();
    }
  });

  test('财报预约披露和法定最晚披露日有不同的标签', () => {
    expect(STOCK_EVENT_CATEGORY_META.earnings_scheduled.label).toBe('财报预约披露');
    expect(STOCK_EVENT_CATEGORY_META.earnings_deadline.label).toBe('法定最晚披露日');
    // 标签不同，确保不冒充
    expect(STOCK_EVENT_CATEGORY_META.earnings_scheduled.label).not.toBe(STOCK_EVENT_CATEGORY_META.earnings_deadline.label);
  });
});
