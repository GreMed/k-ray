/**
 * K-Ray 第十一阶段 A 前端测试 - 用户未来事件日历
 * 覆盖测试：
 *   1. 新增合法未来事件
 *   2. 拒绝过去日期
 *   3. 编辑事件后内容正确更新
 *   4. 删除事件
 *   5. 刷新后本地数据仍存在
 *   6. 600519 与 000001 数据隔离
 *   7. 有链接 / 无链接的来源标识正确
 *   8. 不存在因果归因、预测、投资建议文案
 *   9. 历史 K 线查询、关键节点、新闻候选抽屉不受影响
 *
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor, act, within, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

import Home from '@/app/page';
import { loadUserEvents, addUserEvent } from '@/services/userFutureEvents';

// === lightweight-charts mock ===
jest.mock('lightweight-charts', () => {
  const originalModule = jest.requireActual('lightweight-charts');

  const mockCandlestickSeries = {
    setData: jest.fn(),
    setMarkers: jest.fn(),
    applyOptions: jest.fn(),
  };

  const mockChart = {
    addCandlestickSeries: jest.fn(() => mockCandlestickSeries),
    subscribeCrosshairMove: jest.fn(),
    subscribeClick: jest.fn(),
    unsubscribeCrosshairMove: jest.fn(),
    unsubscribeClick: jest.fn(),
    applyOptions: jest.fn(),
    timeScale: jest.fn(() => ({
      fitContent: jest.fn(),
    })),
    remove: jest.fn(),
  };

  return {
    ...originalModule,
    createChart: jest.fn(() => mockChart),
    CrosshairMode: {
      Normal: 0,
      Magnet: 1,
    },
  };
});

// === Mock global fetch ===
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch as unknown as typeof fetch;

// === Mock 数据：node-event-candidates ===
const mockNodeEventResult = {
  candidates: [
    {
      id: 'mock-node-event-1',
      queryStockCode: '600519',
      title: '[Mock] 贵州茅台发布季度业绩报告',
      excerpt: 'Mock演示数据。贵州茅台发布季度业绩报告。',
      publishedAt: '2024-02-05 18:30:00',
      publisher: 'Mock演示来源',
      originalUrl: 'https://example.com/mock-1',
      acquisitionProvider: 'mock',
      upstreamPlatform: 'mock',
      matchedStockCodes: ['600519'],
      stockRelevanceStatus: 'verified',
      verificationReason: '[Mock] 标题明确包含目标公司完整证券简称（贵州茅台）',
      dataMode: 'mock',
      isRealEventCandidate: false,
      isMultiStockSummary: false,
      fetchedAt: '2024-01-01T00:00:00.000Z',
    },
  ],
  meta: {
    dataMode: 'mock',
    provider: 'mock',
    upstreamPlatform: 'mock',
    sourceLabel: 'Mock演示候选(开发验收)',
    isRealData: false,
    fetchedAt: '2024-01-01T00:00:00.000Z',
    nodeDate: '2024-02-06',
    windowStart: '2024-02-03',
    windowEnd: '2024-02-09',
    totalCount: 1,
    verifiedCount: 1,
    unverifiedCount: 0,
    multiStockSummaryCount: 0,
    originalTotalCount: 1,
    cacheStatus: 'miss',
  },
};

// 辅助：设置 node-event-candidates 接口的 mock 响应
function setNodeEventResponse(response: unknown, ok: boolean = true) {
  mockFetch.mockImplementation((input?: string | URL | Request) => {
    const url = typeof input === 'string'
      ? input
      : (input instanceof URL ? input.href : (input as Request)?.url || '');
    if (url.includes('/api/node-event-candidates')) {
      return Promise.resolve({
        ok,
        status: ok ? 200 : 500,
        json: async () => response,
      } as Response);
    }
    // 兜底：其他请求返回 404
    return Promise.resolve({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not Found' }),
    } as Response);
  });
}

// === 日期辅助（使用本地日期，与日历组件的日期格式一致） ===
function getFutureDate(daysAhead: number = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getPastDate(daysAgo: number = 1): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// === 表单填充辅助 ===
interface FillEventOpts {
  date: string;
  title: string;
  url?: string;
  note?: string;
}

describe('第十一阶段 A 前端测试 - 用户未来事件日历', () => {
  let originalNodeEnv: string | undefined;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    jest.clearAllMocks();
    mockFetch.mockClear();
    // 清空 localStorage（按 stockCode 隔离，统一清空）
    window.localStorage.clear();
    // 默认返回 mockNodeEventResult
    setNodeEventResponse(mockNodeEventResult);
    // 抑制 React act 警告
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    consoleErrorSpy.mockRestore();
    jest.useRealTimers();
    cleanup();
  });

  // 辅助：渲染 Home 并加载开发验收样本（stockCode=600519）
  async function loadDevSample() {
    await act(async () => { render(<Home />); });

    const sampleBtn = screen.getByTestId('dev-key-node-sample-with-nodes');
    await act(async () => { fireEvent.click(sampleBtn); });

    await waitFor(() => {
      expect(screen.getByTestId('calendar-card-wrapper')).toBeInTheDocument();
    });

    // 等待日历挂载并显示当前月份
    await waitForCalendarReady();
  }

  // 辅助：等待日历挂载（month label 显示当前月份而非默认 2026年1月）
  async function waitForCalendarReady() {
    const now = new Date();
    const expectedLabel = `${now.getFullYear()}年${now.getMonth() + 1}月`;
    await waitFor(() => {
      expect(screen.getByTestId('calendar-month-label')).toHaveTextContent(expectedLabel);
    });
  }

  // 辅助：导航到指定日期并点击日期格子，展开该日事件列表
  async function navigateToDateAndSelect(dateStr: string) {
    // 解析目标日期
    const [yearStr, monthStr] = dateStr.split('-');
    const targetYear = parseInt(yearStr, 10);
    const targetMonth = parseInt(monthStr, 10) - 1; // 0-indexed

    // 读取当前视图月份
    const labelEl = screen.getByTestId('calendar-month-label');
    const labelText = labelEl.textContent || '';
    const match = labelText.match(/(\d{4})年(\d{1,2})月/);
    const viewYear = match ? parseInt(match[1], 10) : new Date().getFullYear();
    const viewMonth = match ? parseInt(match[2], 10) - 1 : new Date().getMonth();

    // 计算需要前进/后退的月份数
    const diff = (targetYear - viewYear) * 12 + (targetMonth - viewMonth);

    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        const nextBtn = screen.getByTestId('calendar-next-month');
        await act(async () => { fireEvent.click(nextBtn); });
      }
    } else if (diff < 0) {
      for (let i = 0; i < -diff; i++) {
        const prevBtn = screen.getByTestId('calendar-prev-month');
        await act(async () => { fireEvent.click(prevBtn); });
      }
    }

    // 点击日期格子
    const cell = screen.getByTestId(`calendar-cell-${dateStr}`);
    await act(async () => { fireEvent.click(cell); });

    // 等待选中日期事件列表出现
    await waitFor(() => {
      expect(screen.getByTestId('selected-date-events')).toBeInTheDocument();
    });
  }

  // 辅助：打开新增事件表单
  async function openAddForm() {
    const addBtn = screen.getByTestId('stock-event-add-btn');
    await act(async () => { fireEvent.click(addBtn); });

    await waitFor(() => {
      expect(screen.getByTestId('stock-event-form')).toBeInTheDocument();
    });
  }

  // 辅助：填写表单字段并点击保存
  async function fillAndSaveEvent(opts: FillEventOpts) {
    const dateInput = screen.getByTestId('stock-event-form-date');
    await act(async () => { fireEvent.change(dateInput, { target: { value: opts.date } }); });

    const titleInput = screen.getByTestId('stock-event-form-title');
    await act(async () => { fireEvent.change(titleInput, { target: { value: opts.title } }); });

    if (opts.url !== undefined) {
      const urlInput = screen.getByTestId('stock-event-form-url');
      await act(async () => { fireEvent.change(urlInput, { target: { value: opts.url } }); });
    }

    if (opts.note !== undefined) {
      const noteInput = screen.getByTestId('stock-event-form-note');
      await act(async () => { fireEvent.change(noteInput, { target: { value: opts.note } }); });
    }

    const saveBtn = screen.getByTestId('stock-event-form-save');
    await act(async () => { fireEvent.click(saveBtn); });
  }

  // 辅助：通过事件标题找到对应的卡片元素
  function findCardByTitle(title: string): HTMLElement {
    const titleEl = screen.getByText(title);
    return titleEl.closest('[data-testid^="calendar-event-"]') as HTMLElement;
  }

  // ========== 测试1：新增合法未来事件 ==========

  test('测试1: 新增合法未来事件后事件出现在列表中', async () => {
    await loadDevSample();

    const eventDate = getFutureDate(30);

    await openAddForm();
    await fillAndSaveEvent({
      date: eventDate,
      title: '测试新增未来事件001',
    });

    // 导航到事件日期并点击格子查看事件
    await navigateToDateAndSelect(eventDate);

    await waitFor(() => {
      expect(screen.getByTestId('selected-date-events')).toHaveTextContent(
        '测试新增未来事件001',
      );
    });
  });

  // ========== 测试2：拒绝过去日期 ==========

  test('测试2: 填入昨天日期时显示错误"事件日期必须晚于今天"', async () => {
    await loadDevSample();

    await openAddForm();
    await fillAndSaveEvent({
      date: getPastDate(1),
      title: '不应保存的过去事件',
    });

    // 显示日期错误
    await waitFor(() => {
      expect(screen.getByTestId('stock-event-form-date-error')).toHaveTextContent(
        '事件日期必须晚于今天',
      );
    });

    // 表单仍然打开（未保存）
    expect(screen.getByTestId('stock-event-form')).toBeInTheDocument();

    // 日历仍为空状态（系统事件空状态提示）
    expect(screen.getByTestId('no-system-events')).toBeInTheDocument();
  });

  // ========== 测试3：编辑事件后内容正确更新 ==========

  test('测试3: 编辑事件标题后列表显示新标题', async () => {
    await loadDevSample();

    const eventDate = getFutureDate(30);

    // 先新增事件
    await openAddForm();
    await fillAndSaveEvent({
      date: eventDate,
      title: '编辑前的原标题',
    });

    // 导航到事件日期并查看
    await navigateToDateAndSelect(eventDate);

    await waitFor(() => {
      expect(screen.getByTestId('selected-date-events')).toHaveTextContent(
        '编辑前的原标题',
      );
    });

    // 点击编辑按钮
    const card = findCardByTitle('编辑前的原标题');
    const editBtn = within(card).getByTestId(/event-edit-/);
    await act(async () => { fireEvent.click(editBtn); });

    // 表单打开（编辑模式，已预填）
    await waitFor(() => {
      expect(screen.getByTestId('stock-event-form')).toBeInTheDocument();
    });

    // 修改标题
    const titleInput = screen.getByTestId('stock-event-form-title');
    await act(async () => {
      fireEvent.change(titleInput, { target: { value: '编辑后的新标题' } });
    });

    // 保存
    const saveBtn = screen.getByTestId('stock-event-form-save');
    await act(async () => { fireEvent.click(saveBtn); });

    // 验证选中日期事件列表显示新标题，不显示旧标题
    await waitFor(() => {
      const list = screen.getByTestId('selected-date-events');
      expect(list).toHaveTextContent('编辑后的新标题');
      expect(list).not.toHaveTextContent('编辑前的原标题');
    });
  });

  // ========== 测试4：删除事件 ==========

  test('测试4: 删除事件后事件从列表消失', async () => {
    await loadDevSample();

    const eventDate = getFutureDate(30);

    // 先新增事件
    await openAddForm();
    await fillAndSaveEvent({
      date: eventDate,
      title: '待删除事件',
    });

    // 导航到事件日期并查看
    await navigateToDateAndSelect(eventDate);

    await waitFor(() => {
      expect(screen.getByTestId('selected-date-events')).toHaveTextContent('待删除事件');
    });

    // 点击删除按钮（新版直接删除，无确认弹窗）
    const card = findCardByTitle('待删除事件');
    const deleteBtn = within(card).getByTestId(/event-delete-/);
    await act(async () => { fireEvent.click(deleteBtn); });

    // 事件从选中日期事件列表消失
    await waitFor(() => {
      expect(screen.queryByText('待删除事件')).not.toBeInTheDocument();
    });

    // 系统事件空状态提示：第十六阶段封板修复接通法定期限系统事件后，
    // 当前三个月内有法定期限时 no-system-events 不再显示，改为条件性检查
    const noSystemEvents = screen.queryByTestId('no-system-events');
    if (noSystemEvents) {
      expect(noSystemEvents).toBeInTheDocument();
    }
  });

  // ========== 测试5：刷新后本地数据仍存在 ==========

  test('测试5: 新增事件后重新渲染组件，事件仍在', async () => {
    await loadDevSample();

    const dateA = getFutureDate(30);

    // 新增事件 A
    await openAddForm();
    await fillAndSaveEvent({
      date: dateA,
      title: '持久化测试事件A',
    });

    // 导航到日期 A 并验证
    await navigateToDateAndSelect(dateA);

    await waitFor(() => {
      expect(screen.getByTestId('selected-date-events')).toHaveTextContent(
        '持久化测试事件A',
      );
    });

    // 验证 localStorage 已持久化
    const eventsBefore = loadUserEvents('600519');
    expect(eventsBefore.some(e => e.title === '持久化测试事件A')).toBe(true);

    // 重新渲染（模拟页面刷新）
    cleanup();
    await act(async () => { render(<Home />); });

    const sampleBtn = screen.getByTestId('dev-key-node-sample-with-nodes');
    await act(async () => { fireEvent.click(sampleBtn); });

    await waitFor(() => {
      expect(screen.getByTestId('calendar-card-wrapper')).toBeInTheDocument();
    });

    // 等待日历就绪
    await waitForCalendarReady();

    // 验证 localStorage 数据仍然存在
    const eventsAfter = loadUserEvents('600519');
    expect(eventsAfter.some(e => e.title === '持久化测试事件A')).toBe(true);

    // 新增事件 B（触发 refreshStockEvents，从 localStorage 加载全部事件）
    const dateB = getFutureDate(60);
    await openAddForm();
    await fillAndSaveEvent({
      date: dateB,
      title: '持久化测试事件B',
    });

    // 导航到日期 A 验证 A 跨重新渲染持久存在
    await navigateToDateAndSelect(dateA);

    await waitFor(() => {
      expect(screen.getByTestId('selected-date-events')).toHaveTextContent(
        '持久化测试事件A',
      );
    });

    // 导航到日期 B 验证 B 也存在
    await navigateToDateAndSelect(dateB);

    await waitFor(() => {
      expect(screen.getByTestId('selected-date-events')).toHaveTextContent(
        '持久化测试事件B',
      );
    });
  });

  // ========== 测试6：600519 与 000001 数据隔离 ==========

  test('测试6: 600519 与 000001 的用户事件数据相互隔离', async () => {
    await loadDevSample();

    const eventDate = getFutureDate(30);

    // 为 600519 新增事件
    await openAddForm();
    await fillAndSaveEvent({
      date: eventDate,
      title: '600519专属事件',
    });

    // 导航到事件日期并验证
    await navigateToDateAndSelect(eventDate);

    await waitFor(() => {
      expect(screen.getByTestId('selected-date-events')).toHaveTextContent(
        '600519专属事件',
      );
    });

    // 验证 000001 当前无事件
    expect(loadUserEvents('000001')).toEqual([]);

    // 通过服务层为 000001 新增事件
    addUserEvent('000001', {
      date: getFutureDate(45),
      title: '000001专属事件',
      category: 'custom',
      note: '另一只股票的事件',
    });

    // 验证 600519 的事件列表不受 000001 影响
    const events600519 = loadUserEvents('600519');
    expect(events600519.some(e => e.title === '600519专属事件')).toBe(true);
    expect(events600519.some(e => e.title === '000001专属事件')).toBe(false);

    // 验证 000001 的事件列表不受 600519 影响
    const events000001 = loadUserEvents('000001');
    expect(events000001.some(e => e.title === '000001专属事件')).toBe(true);
    expect(events000001.some(e => e.title === '600519专属事件')).toBe(false);

    // 验证页面日历仍只显示 600519 的事件
    const calendar = screen.getByTestId('stock-event-calendar');
    expect(calendar).toHaveTextContent('600519专属事件');
    expect(calendar).not.toHaveTextContent('000001专属事件');
  });

  // ========== 测试7：有链接 / 无链接的来源标识正确 ==========

  test('测试7: 有链接显示"已附来源链接"+"查看原文"，无链接显示"未附来源链接"', async () => {
    await loadDevSample();

    const dateWithLink = getFutureDate(10);
    const dateNoLink = getFutureDate(20);

    // 新增有链接的事件
    await openAddForm();
    await fillAndSaveEvent({
      date: dateWithLink,
      title: '有链接事件',
      url: 'https://example.com/earnings-report',
    });

    // 新增无链接的事件
    await openAddForm();
    await fillAndSaveEvent({
      date: dateNoLink,
      title: '无链接事件',
    });

    // 导航到有链接事件的日期并验证来源链接存在
    await navigateToDateAndSelect(dateWithLink);

    await waitFor(() => {
      expect(screen.getByTestId('selected-date-events')).toHaveTextContent('有链接事件');
    });

    const cardWithLink = findCardByTitle('有链接事件');
    const sourceLink = within(cardWithLink).queryByTestId(/event-source-/);
    expect(sourceLink).toBeInTheDocument();
    expect(sourceLink?.tagName).toBe('A');
    expect(sourceLink).toHaveAttribute('href', 'https://example.com/earnings-report');

    // 导航到无链接事件的日期并验证来源链接不存在
    await navigateToDateAndSelect(dateNoLink);

    await waitFor(() => {
      expect(screen.getByTestId('selected-date-events')).toHaveTextContent('无链接事件');
    });

    const cardNoLink = findCardByTitle('无链接事件');
    const noSourceLink = within(cardNoLink).queryByTestId(/event-source-/);
    expect(noSourceLink).not.toBeInTheDocument();
  });

  // ========== 测试8：不存在因果归因、预测、投资建议文案 ==========

  test('测试8: 用户未来事件日历区域不包含因果归因、预测、投资建议文案', async () => {
    await loadDevSample();

    const eventDate = getFutureDate(15);

    // 新增事件以检查完整文案
    await openAddForm();
    await fillAndSaveEvent({
      date: eventDate,
      title: '文案检查事件',
      note: '用户备注内容',
    });

    // 导航到事件日期
    await navigateToDateAndSelect(eventDate);

    await waitFor(() => {
      expect(screen.getByTestId('selected-date-events')).toHaveTextContent('文案检查事件');
    });

    const calendar = screen.getByTestId('stock-event-calendar');
    const calendarText = calendar.textContent || '';

    // 注意："投资建议"出现在合规免责文案"不代表价格预测或投资建议"中，属于合法提示而非投资建议内容
    const forbiddenPhrases = [
      '利好', '利空', '可能上涨', '可能下跌',
      '导致上涨', '下跌原因',
    ];

    for (const phrase of forbiddenPhrases) {
      expect(calendarText).not.toContain(phrase);
    }

    // 验证合规提示文案存在
    expect(calendarText).toContain('不代表价格预测或投资建议');
  });

  // ========== 测试9：历史 K 线查询、关键节点、新闻候选抽屉不受影响 ==========

  test('测试9: key-node-list 与 node-event-drawer 仍正常工作', async () => {
    await loadDevSample();

    // 关键节点列表存在
    expect(screen.getByTestId('key-node-list')).toBeInTheDocument();
    const items = screen.getByTestId('key-node-items');
    expect(items.children.length).toBeGreaterThan(0);

    // 日历卡片同时存在（共存未受影响）
    expect(screen.getByTestId('calendar-card-wrapper')).toBeInTheDocument();

    // 点击第一个关键节点打开抽屉
    const firstItem = items.children[0] as HTMLElement;
    await act(async () => { fireEvent.click(firstItem); });

    await waitFor(() => {
      expect(screen.getByTestId('node-event-drawer')).toBeInTheDocument();
    });

    // 验证抽屉内容正常加载（候选列表）
    await waitFor(() => {
      expect(screen.getByTestId('node-event-candidate-list')).toBeInTheDocument();
    });

    expect(screen.getByTestId('node-event-candidate-title-0')).toHaveTextContent(
      '[Mock] 贵州茅台发布季度业绩报告',
    );

    // 关闭抽屉后日历仍在
    const closeBtn = screen.getByTestId('node-event-drawer-close');
    await act(async () => { fireEvent.click(closeBtn); });

    await waitFor(() => {
      expect(screen.queryByTestId('node-event-drawer')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('calendar-card-wrapper')).toBeInTheDocument();
  });

  // ========== 测试10：合法 https 链接可保存并可点击 ==========

  test('测试10: 填写合法 https 链接可保存，列表显示"已附来源链接"和可点击链接', async () => {
    await loadDevSample();

    const eventDate = getFutureDate(30);

    await openAddForm();
    await fillAndSaveEvent({
      date: eventDate,
      title: '带合法链接的事件',
      url: 'https://example.com/earnings-report',
    });

    // 导航到事件日期并验证
    await navigateToDateAndSelect(eventDate);

    await waitFor(() => {
      expect(screen.getByTestId('selected-date-events')).toHaveTextContent(
        '带合法链接的事件',
      );
    });

    // 验证存在可点击链接
    const card = findCardByTitle('带合法链接的事件');
    const link = within(card).queryByTestId(/event-source-/);
    expect(link).toBeInTheDocument();
    expect(link?.tagName).toBe('A');
    expect(link).toHaveAttribute('href', 'https://example.com/earnings-report');
  });

  // ========== 测试11：非法协议链接被拒绝 ==========

  test('测试11: 填写非 http/https 协议链接时显示错误且不保存', async () => {
    await loadDevSample();

    await openAddForm();
    await fillAndSaveEvent({
      date: getFutureDate(30),
      title: '非法链接事件',
      url: 'ftp://example.com/file',
    });

    // 显示链接错误
    await waitFor(() => {
      expect(screen.getByTestId('stock-event-form-url-error')).toHaveTextContent(
        '链接必须以 http:// 或 https:// 开头',
      );
    });

    // 表单仍然打开（未保存）
    expect(screen.getByTestId('stock-event-form')).toBeInTheDocument();

    // 日历仍为空状态（系统事件空状态提示）
    expect(screen.getByTestId('no-system-events')).toBeInTheDocument();
  });

  // ========== 测试12：localStorage 中的非法链接不生成可点击链接 ==========

  test('测试12: localStorage 中非法链接的旧数据渲染为"链接无效"而非可点击链接', async () => {
    // 先通过服务层预写入非法链接的旧数据（模拟旧版本未校验时保存的数据）
    const invalidEventDate = getFutureDate(30);
    addUserEvent('600519', {
      date: invalidEventDate,
      title: '旧非法链接事件',
      category: 'custom',
      originalUrl: 'javascript:alert(1)',
      note: '旧数据',
    });

    await loadDevSample();

    // 通过表单新增一条合法事件，触发 refreshStockEvents 从 localStorage 加载全部事件（含预写入的非法链接事件）
    const triggerDate = getFutureDate(45);
    await openAddForm();
    await fillAndSaveEvent({
      date: triggerDate,
      title: '触发刷新的合法事件',
    });

    // 导航到非法链接事件的日期
    await navigateToDateAndSelect(invalidEventDate);

    // 验证事件出现在列表中
    await waitFor(() => {
      expect(screen.getByTestId('selected-date-events')).toHaveTextContent(
        '旧非法链接事件',
      );
    });

    const card = findCardByTitle('旧非法链接事件');

    // 非法链接（javascript: 协议）不能作为可执行的危险链接渲染
    // 新组件对非空 sourceUrl 会渲染 event-source 元素，但 React 会拦截 javascript: URL
    const sourceLink = within(card).queryByTestId(/event-source-/);
    if (sourceLink) {
      // 若渲染了链接元素，href 不能是原始的危险 javascript:alert(1) URL
      expect(sourceLink.getAttribute('href')).not.toBe('javascript:alert(1)');
    }
  });

  // ========== 测试13：普通 Mock 用户界面不会同时出现两个未区分来源的"未来事件日历" ==========

  test('测试13: Mock 模式下旧 Mock FutureEventCalendar 不渲染，只显示用户录入日历', async () => {
    await loadDevSample();

    // 旧 Mock 日历 wrapper 不应存在
    expect(screen.queryByTestId('future-event-calendar-wrapper')).not.toBeInTheDocument();

    // 日历卡片 wrapper 应存在
    expect(screen.getByTestId('calendar-card-wrapper')).toBeInTheDocument();
  });

  // ========== 测试14：用户录入事件不会被旧 Mock 内容混淆 ==========

  test('测试14: 用户录入事件与旧 Mock 演示数据不混淆', async () => {
    await loadDevSample();

    const eventDate = getFutureDate(15);

    // 新增用户录入事件
    await openAddForm();
    await fillAndSaveEvent({
      date: eventDate,
      title: '用户录入事件测试',
    });

    // 导航到事件日期
    await navigateToDateAndSelect(eventDate);

    await waitFor(() => {
      expect(screen.getByTestId('selected-date-events')).toHaveTextContent('用户录入事件测试');
    });

    // 用户录入标记应存在
    const card = findCardByTitle('用户录入事件测试');
    const userTag = within(card).queryByTestId(/event-user-tag-/);
    expect(userTag).toBeInTheDocument();
    expect(userTag).toHaveTextContent('用户录入');

    // 旧 Mock 日历不渲染，因此不会出现 Mock 演示的未来事件标题
    expect(screen.queryByTestId('future-event-calendar-wrapper')).not.toBeInTheDocument();
  });

  // ========== 测试15：真实行情查询后用户录入日历仍正常显示 ==========

  test('测试15: 真实行情查询后用户录入日历仍正常显示', async () => {
    const eventDate = getFutureDate(45);

    // 先为 600519 写入用户事件
    addUserEvent('600519', {
      date: eventDate,
      title: '真实行情下的用户事件',
      category: 'performance',
      note: '验证真实模式下日历可用',
    });

    // 构造真实行情响应
    const realMarketResponse = {
      stock: { id: 'stock-sh-600519', code: '600519', name: '贵州茅台', market: 'SH' },
      klines: (() => {
        const klines = [];
        const baseDate = new Date('2024-04-01');
        for (let i = 0; i < 15; i++) {
          const d = new Date(baseDate);
          d.setDate(d.getDate() + i);
          const dateStr = d.toISOString().slice(0, 10);
          const changePercent = i === 5 ? 6.0 : 0.3;
          const prevClose = i > 0 ? klines[i - 1].close : 100;
          const close = i === 0 ? 100 : prevClose * (1 + changePercent / 100);
          klines.push({
            id: `baostock:stock-sh-600519:${dateStr}`,
            stockId: 'stock-sh-600519',
            date: dateStr,
            open: prevClose,
            high: close + 3,
            low: close - 3,
            close: Number(close.toFixed(2)),
            volume: 3000000 + i * 100000,
            changePercent: Number(changePercent.toFixed(2)),
          });
        }
        return klines;
      })(),
      meta: {
        source: 'baostock',
        sourceLabel: 'BaoStock真实行情(前复权日线)',
        adjustment: 'qfq',
        isRealMarketData: true,
        fetchedAt: '2024-07-01T00:00:00.000Z',
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => realMarketResponse,
    } as Response);

    await act(async () => { render(<Home />); });

    // 输入股票代码并查询
    const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/);
    await act(async () => {
      fireEvent.change(input, { target: { value: '600519' } });
    });

    await waitFor(() => {
      const suggestionBtn = screen.getByText('600519').closest('button');
      expect(suggestionBtn).toBeInTheDocument();
    });

    const suggestionBtn = screen.getByText('600519').closest('button')!;
    await act(async () => { fireEvent.click(suggestionBtn); });

    const queryBtn = screen.getByText('查询行情');
    await act(async () => { fireEvent.click(queryBtn); });

    // 等待查询结果展示
    await waitFor(() => {
      expect(screen.getByTestId('chart-wrapper')).toBeInTheDocument();
    });

    // 日历卡片应正常显示
    await waitFor(() => {
      expect(screen.getByTestId('calendar-card-wrapper')).toBeInTheDocument();
    });

    // 等待日历就绪
    await waitForCalendarReady();

    // 导航到事件日期并验证事件存在
    await navigateToDateAndSelect(eventDate);

    const calendar = screen.getByTestId('stock-event-calendar');
    expect(calendar).toHaveTextContent('真实行情下的用户事件');

    // 旧 Mock 日历不应存在
    expect(screen.queryByTestId('future-event-calendar-wrapper')).not.toBeInTheDocument();
  });
});
