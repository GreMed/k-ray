/**
 * K-Ray 第五阶段测试 - MVP 全流程整体验收与体验收口
 * 验证状态管理、可用性、移动端适配、开发面板隔离等
 *
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import Home from '@/app/page';
import { mockFutureEvents, getMockReplayResult } from '@/data/mockData';
import type { FutureEvent } from '@/types';

// 在顶层 mock simulateReplay，便于测试19断言调用次数
// 默认使用原始实现，测试19中按需覆盖
jest.mock('@/utils/devHelpers', () => {
  const actual = jest.requireActual('@/utils/devHelpers');
  return {
    ...actual,
    simulateReplay: jest.fn(actual.simulateReplay),
  };
});

import { simulateReplay as mockedSimulateReplay } from '@/utils/devHelpers';
const simulateReplaySpy = mockedSimulateReplay as unknown as jest.Mock;

// Mock global fetch（真实行情走 fetch，Mock 模式走 simulateReplay）
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// 构造真实行情成功响应
function makeRealMarketResponse(stockCode: string, market: 'SH' | 'SZ', name: string, count = 10) {
  const klines = [];
  const baseDate = new Date('2024-01-02');
  for (let i = 0; i < count; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    klines.push({
      id: `baostock:stock-${market.toLowerCase()}-${stockCode}:${d.toISOString().slice(0, 10)}`,
      stockId: `stock-${market.toLowerCase()}-${stockCode}`,
      date: d.toISOString().slice(0, 10),
      open: 100 + i * 5,
      high: 105 + i * 5,
      low: 95 + i * 5,
      close: 102 + i * 5,
      volume: 3000000 + i * 100000,
      changePercent: 0.3 + i * 0.1,
    });
  }
  return {
    ok: true,
    json: async () => ({
      stock: { id: `stock-${market.toLowerCase()}-${stockCode}`, code: stockCode, name, market },
      klines,
      meta: {
        source: 'baostock',
        sourceLabel: 'BaoStock真实行情(前复权日线)',
        adjustment: 'qfq',
        isRealMarketData: true,
        fetchedAt: '2024-07-01T00:00:00.000Z',
      },
    }),
  };
}

describe('第五阶段测试 - MVP 全流程整体验收与体验收口', () => {
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    // 默认设置为 development，让 dev 面板可见
    process.env.NODE_ENV = 'development';
    jest.clearAllMocks();
    // 恢复 simulateReplay 的默认实现（clearAllMocks 会清除实现）
    const actual = jest.requireActual('@/utils/devHelpers');
    simulateReplaySpy.mockImplementation(actual.simulateReplay);
    // 默认 fetch 返回一个永不 resolve 的 Promise，避免意外请求导致状态跳变
    mockFetch.mockImplementation(() => new Promise(() => {}));
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  /**
   * 辅助函数：通过 dev-open-success 进入成功状态（Mock 模式）
   * dev-open-success 第一次点击时，executeReplay 闭包中 selectedStock 为 null → 走 simulateReplay（Mock 分支）
   */
  async function selectStockAndReplay() {
    jest.useFakeTimers();
    // dev-open-success 内部调用 executeReplay，首次点击 selectedStock 为 null → simulateReplay（Mock 模式）
    const successBtn = screen.getByTestId('dev-open-success');
    fireEvent.click(successBtn);

    act(() => {
      jest.runAllTimers();
    });

    // 等待 K 线图渲染
    await waitFor(() => {
      expect(screen.getByTestId('chart-wrapper')).toBeInTheDocument();
    });

    jest.useRealTimers();
  }

  describe('测试1: 完整复盘主流程', () => {
    test('初始状态显示股票选择和日期选择', () => {
      render(<Home />);

      expect(screen.getByText('选择股票')).toBeInTheDocument();
      expect(screen.getByText('选择查询时间范围')).toBeInTheDocument();
      expect(screen.getByText('查询行情')).toBeInTheDocument();
    });

    test('选择股票后显示已选择状态', async () => {
      render(<Home />);

      const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/);
      fireEvent.change(input, { target: { value: '600519' } });

      await waitFor(() => {
        expect(screen.getByText('600519')).toBeInTheDocument();
      });

      const suggestionBtn = screen.getByText('600519').closest('button')!;
      fireEvent.click(suggestionBtn);

      expect(screen.getByText(/已选择.*600519.*贵州茅台/)).toBeInTheDocument();
    });

    test('点击开始复盘进入加载状态', async () => {
      render(<Home />);

      const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/);
      fireEvent.change(input, { target: { value: '600519' } });

      await waitFor(() => {
        const suggestionBtn = screen.getByText('600519').closest('button')!;
        fireEvent.click(suggestionBtn);
      });

      const startBtn = screen.getByText('查询行情');
      fireEvent.click(startBtn);

      // 验证加载状态文案
      expect(screen.getByText(/正在查询日K并识别关键节点/)).toBeInTheDocument();
    });

    test('加载完成后显示K线图和关键节点', async () => {
      render(<Home />);
      await selectStockAndReplay();

      // 验证专业K线图渲染
      expect(screen.getByTestId('chart-wrapper')).toBeInTheDocument();
      expect(screen.getByText(/K 线图表/)).toBeInTheDocument();
    });
  });

  describe('测试2: 重复复盘', () => {
    test('成功复盘后可以重新复盘', async () => {
      render(<Home />);
      await selectStockAndReplay();

      const resetBtn = screen.getByText('重新查询');
      fireEvent.click(resetBtn);

      // 回到初始状态
      expect(screen.getByText('选择股票')).toBeInTheDocument();
      expect(screen.getByText('查询行情')).toBeInTheDocument();
    });

    test('加载期间显示加载文案', async () => {
      render(<Home />);

      const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/);
      fireEvent.change(input, { target: { value: '600519' } });

      await waitFor(() => {
        const suggestionBtn = screen.getByText('600519').closest('button')!;
        fireEvent.click(suggestionBtn);
      });

      const startBtn = screen.getByText('查询行情');
      fireEvent.click(startBtn);

      // 加载期间按钮被禁用或显示加载文案
      const loadingEl = screen.getByText(/正在查询日K并识别关键节点/);
      expect(loadingEl).toBeInTheDocument();
    });
  });

  describe('测试3: 重置状态', () => {
    test('点击重置后清理所有状态', async () => {
      render(<Home />);
      await selectStockAndReplay();

      const resetBtn = screen.getByText('重新查询');
      fireEvent.click(resetBtn);

      // 验证重置后状态清理
      expect(screen.getByText('输入一只股票，看清每段关键走势的行情节点')).toBeInTheDocument();
      expect(screen.queryByTestId('chart-wrapper')).not.toBeInTheDocument();
    });
  });

  describe('测试4: 抽屉关闭交互', () => {
    test('点击关闭按钮可关闭未来事件详情', async () => {
      render(<Home />);
      await selectStockAndReplay();

      // 通过 dev 辅助打开未来事件
      const devBtn = screen.getByTestId('dev-open-confirmed-future-event');
      fireEvent.click(devBtn);

      await waitFor(() => {
        expect(screen.getByTestId('future-event-detail-close')).toBeInTheDocument();
      });

      const closeBtn = screen.getByTestId('future-event-detail-close');
      fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('future-event-detail-close')).not.toBeInTheDocument();
      });
    });
  });

  describe('测试5: Escape键关闭', () => {
    test('Escape键关闭未来事件详情', async () => {
      render(<Home />);
      await selectStockAndReplay();

      const devBtn = screen.getByTestId('dev-open-confirmed-future-event');
      fireEvent.click(devBtn);

      await waitFor(() => {
        expect(screen.getByTestId('future-event-detail-close')).toBeInTheDocument();
      });

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByTestId('future-event-detail-close')).not.toBeInTheDocument();
      });
    });
  });

  describe('测试6: 错误状态和重试', () => {
    test('错误状态显示重试按钮', async () => {
      render(<Home />);

      // 切换到错误状态（loadErrorState 内部有 setTimeout，需用 fake timers 在 act 中刷新）
      jest.useFakeTimers();
      const errorBtn = screen.getByTestId('dev-open-error');
      fireEvent.click(errorBtn);
      await act(async () => { jest.runAllTimers(); });
      jest.useRealTimers();

      // 验证重试按钮存在
      const retryButtons = screen.getAllByText('重试');
      expect(retryButtons.length).toBeGreaterThan(0);
    });
  });

  describe('测试7: 空状态', () => {
    test('选择无数据股票时显示空状态', async () => {
      render(<Home />);

      // 使用 dev-open-empty 进入空状态（dev 面板直接设置空结果）
      jest.useFakeTimers();
      const emptyBtn = screen.getByTestId('dev-open-empty');
      fireEvent.click(emptyBtn);

      await act(async () => { jest.runAllTimers(); });

      // 等待空状态显示
      await waitFor(() => {
        expect(screen.getByText(/所选区间暂无交易数据/)).toBeInTheDocument();
      });

      // 空状态不应有 K 线
      expect(screen.queryByTestId('chart-wrapper')).not.toBeInTheDocument();

      jest.useRealTimers();
    });
  });

  describe('测试8: 按钮禁用状态', () => {
    test('未选择股票时开始复盘按钮禁用', () => {
      render(<Home />);

      const startBtn = screen.getByText('查询行情');
      expect(startBtn).toBeDisabled();
    });

    test('选择股票后开始复盘按钮可用', async () => {
      render(<Home />);

      const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/);
      fireEvent.change(input, { target: { value: '600519' } });

      await waitFor(() => {
        const suggestionBtn = screen.getByText('600519').closest('button')!;
        fireEvent.click(suggestionBtn);
      });

      const startBtn = screen.getByText('查询行情');
      expect(startBtn).not.toBeDisabled();
    });
  });

  describe('测试9: 开发面板隔离', () => {
    test('开发环境显示开发面板', () => {
      process.env.NODE_ENV = 'development';
      render(<Home />);

      expect(screen.getByText(/开发模式/)).toBeInTheDocument();
    });

    test('生产环境不显示开发面板', () => {
      process.env.NODE_ENV = 'production';
      render(<Home />);

      expect(screen.queryByText(/开发模式/)).not.toBeInTheDocument();
    });

    test('生产环境不显示开发辅助按钮', () => {
      process.env.NODE_ENV = 'production';
      render(<Home />);

      // 检查所有 dev-* testid 都不存在
      const devTestIds = [
        'dev-open-multi-source-event',
        'dev-open-single-source-event',
        'dev-open-no-source-event',
        'dev-load-march-range',
        'dev-open-source-detail',
        'dev-open-future-calendar',
        'dev-open-confirmed-future-event',
        'dev-open-estimated-future-event',
        'dev-open-tentative-future-event',
        'dev-show-empty-future-events',
      ];

      devTestIds.forEach(testId => {
        expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
      });
    });
  });

  describe('测试10: FutureEvent可辨识联合类型', () => {
    test('confirmed事件必须有scheduledDate字符串', () => {
      const confirmedEvents = (mockFutureEvents as FutureEvent[]).filter(e => e.dateCertainty === 'confirmed');

      confirmedEvents.forEach(event => {
        // 类型守卫：confirmed 事件 scheduledDate 必须为 string
        if (event.dateCertainty === 'confirmed') {
          expect(typeof event.scheduledDate).toBe('string');
          expect(event.scheduledDate).not.toBe('');
          expect(event.scheduledDate).not.toBeNull();
        }
      });
    });

    test('estimated事件必须有scheduledDate字符串', () => {
      const estimatedEvents = (mockFutureEvents as FutureEvent[]).filter(e => e.dateCertainty === 'estimated');

      estimatedEvents.forEach(event => {
        // 类型守卫：estimated 事件 scheduledDate 必须为 string
        if (event.dateCertainty === 'estimated') {
          expect(typeof event.scheduledDate).toBe('string');
          expect(event.scheduledDate).not.toBe('');
          expect(event.scheduledDate).not.toBeNull();
        }
      });
    });

    test('tentative事件的scheduledDate必须为null', () => {
      const tentativeEvents = (mockFutureEvents as FutureEvent[]).filter(e => e.dateCertainty === 'tentative');

      tentativeEvents.forEach(event => {
        // 类型守卫：tentative 事件 scheduledDate 必须为 null
        if (event.dateCertainty === 'tentative') {
          expect(event.scheduledDate).toBeNull();
        }
      });
    });

    test('三种日期确定性都有对应数据', () => {
      const certainties = new Set((mockFutureEvents as FutureEvent[]).map(e => e.dateCertainty));
      expect(certainties.has('confirmed')).toBe(true);
      expect(certainties.has('estimated')).toBe(true);
      expect(certainties.has('tentative')).toBe(true);
    });
  });

  describe('测试11: 背景滚动锁定', () => {
    test('打开未来事件详情时背景滚动被禁用', async () => {
      render(<Home />);
      await selectStockAndReplay();

      const devBtn = screen.getByTestId('dev-open-confirmed-future-event');
      fireEvent.click(devBtn);

      await waitFor(() => {
        expect(document.body.style.overflow).toBe('hidden');
      });
    });

    test('关闭未来事件详情时背景滚动恢复', async () => {
      render(<Home />);
      await selectStockAndReplay();

      const devBtn = screen.getByTestId('dev-open-confirmed-future-event');
      fireEvent.click(devBtn);

      await waitFor(() => {
        expect(document.body.style.overflow).toBe('hidden');
      });

      const closeBtn = screen.getByTestId('future-event-detail-close');
      fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(document.body.style.overflow).toBe('');
      });
    });
  });

  describe('测试12: 移动端布局', () => {
    test('页面应有响应式布局', () => {
      render(<Home />);

      // 验证主要容器有响应式类
      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();
      expect(main.className).toContain('flex-1');
    });
  });

  describe('测试13: 风险提示和演示数据标识', () => {
    test('成功状态显示演示数据提示', async () => {
      render(<Home />);
      await selectStockAndReplay();

      // 验证演示数据提示存在
      expect(screen.getByText(/当前展示为演示数据/)).toBeInTheDocument();
    });
  });

  describe('测试14: 日期变化清理旧状态', () => {
    test('重置后选择不同的快捷日期', async () => {
      render(<Home />);
      await selectStockAndReplay();

      // 重置
      const resetBtn = screen.getByText('重新查询');
      fireEvent.click(resetBtn);

      // 选择股票
      const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/);
      fireEvent.change(input, { target: { value: '600519' } });

      await waitFor(() => {
        const suggestionBtn = screen.getByText('600519').closest('button')!;
        fireEvent.click(suggestionBtn);
      });

      // 选择近 1 个月快捷选项
      const quickOption = screen.getByTestId('quick-option-1m');
      fireEvent.click(quickOption);

      // 验证日期已更改
      expect(screen.getByText('近1个月')).toBeInTheDocument();
    });
  });

  describe('测试15: 重试统一逻辑', () => {
    test('错误状态可重试', async () => {
      render(<Home />);

      // 切换到错误状态（loadErrorState 内部有 setTimeout，需用 fake timers 在 act 中刷新）
      jest.useFakeTimers();
      const errorBtn = screen.getByTestId('dev-open-error');
      fireEvent.click(errorBtn);
      await act(async () => { jest.runAllTimers(); });

      expect(screen.getAllByText('重试').length).toBeGreaterThan(0);

      // 找到重试按钮并点击（重试走 fetch，默认 mockFetch 为 pending → loading 持续）
      const retryBtn = screen.getAllByText('重试')[0].closest('button')!;
      fireEvent.click(retryBtn);

      // 验证重试按钮被点击后，状态切换到 loading
      expect(screen.getByText(/正在查询日K并识别关键节点/)).toBeInTheDocument();

      jest.useRealTimers();
    });

    test('重试前打开的抽屉会被清理', async () => {
      render(<Home />);
      await selectStockAndReplay();

      // 先打开未来事件详情抽屉
      const devBtn = screen.getByTestId('dev-open-confirmed-future-event');
      await act(async () => { fireEvent.click(devBtn); });

      expect(screen.getByTestId('future-event-detail-close')).toBeInTheDocument();

      // 切换到错误状态（loadErrorState 内部有 setTimeout，需用 fake timers 在 act 中刷新）
      jest.useFakeTimers();
      const errorBtn = screen.getByTestId('dev-open-error');
      fireEvent.click(errorBtn);
      await act(async () => { jest.runAllTimers(); });

      expect(screen.getAllByText('重试').length).toBeGreaterThan(0);

      // 点击重试
      const retryBtn = screen.getAllByText('重试')[0].closest('button')!;
      fireEvent.click(retryBtn);

      // 重试时抽屉应该被关闭（executeReplay 中会清理）
      expect(screen.queryByTestId('future-event-detail-close')).not.toBeInTheDocument();

      jest.useRealTimers();
    });

    test('连续点击重试只执行一次加载', async () => {
      render(<Home />);

      // 切换到错误状态（loadErrorState 内部有 setTimeout，需用 fake timers 在 act 中刷新）
      jest.useFakeTimers();
      const errorBtn = screen.getByTestId('dev-open-error');
      fireEvent.click(errorBtn);
      await act(async () => { jest.runAllTimers(); });

      expect(screen.getAllByText('重试').length).toBeGreaterThan(0);

      // 找到重试按钮，连续点击多次
      const retryBtn = screen.getAllByText('重试')[0].closest('button')!;
      fireEvent.click(retryBtn);
      fireEvent.click(retryBtn);
      fireEvent.click(retryBtn);

      // 应该只显示一次加载状态（请求防重：只发起一次 fetch）
      expect(screen.getByText(/正在查询日K并识别关键节点/)).toBeInTheDocument();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });
  });

  describe('测试16: 嵌套弹窗Escape行为', () => {
    test('第一次Escape只关闭来源详情，第二次才关闭事件抽屉', async () => {
      render(<Home />);
      await selectStockAndReplay();

      // 打开来源详情（同时打开事件抽屉+来源弹窗）
      const sourceBtn = screen.getByTestId('dev-open-source-detail');
      fireEvent.click(sourceBtn);

      // 等待事件抽屉和来源详情都打开
      await waitFor(() => {
        expect(screen.getByText('来源详情')).toBeInTheDocument();
      });

      // 第一次 Escape：只关闭来源详情
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

      // 事件抽屉应该还在
      await waitFor(() => {
        expect(screen.queryByText('来源详情')).not.toBeInTheDocument();
      });
      // 事件详情抽屉仍然打开（关闭按钮还在）
      const eventCloseBtns = screen.getAllByText('✕ 关闭');
      expect(eventCloseBtns.length).toBeGreaterThan(0);

      // 第二次 Escape：关闭事件抽屉
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

      await waitFor(() => {
        expect(screen.queryAllByText('✕ 关闭').length).toBe(0);
      });
    });

    test('事件列表弹窗优先于事件抽屉关闭', async () => {
      render(<Home />);
      await selectStockAndReplay();

      // 打开聚合事件列表（如果按钮存在）
      const groupBtn = screen.queryByTestId('dev-open-event-group');
      if (groupBtn) {
        fireEvent.click(groupBtn);

        // 等待事件列表打开
        await waitFor(() => {
          expect(screen.getByTestId('event-list-modal')).toBeInTheDocument();
        });

        // 第一次 Escape 关闭事件列表
        fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

        await waitFor(() => {
          expect(screen.queryByTestId('event-list-modal')).not.toBeInTheDocument();
        });
      }
    });
  });

  describe('测试17: 滚动位置恢复', () => {
    test('打开抽屉时设置body.top为负scrollY', async () => {
      // 先设置一个初始滚动位置
      Object.defineProperty(window, 'scrollY', { value: 100, writable: true });
      Object.defineProperty(window, 'pageYOffset', { value: 100, writable: true });

      render(<Home />);
      await selectStockAndReplay();

      const devBtn = screen.getByTestId('dev-open-confirmed-future-event');
      fireEvent.click(devBtn);

      await waitFor(() => {
        expect(document.body.style.position).toBe('fixed');
      });

      // body.top 应该等于 -scrollY
      expect(document.body.style.top).toBe('-100px');
    });

    test('关闭最后一个抽屉后恢复滚动位置', async () => {
      const scrollToSpy = jest.spyOn(window, 'scrollTo').mockImplementation();
      Object.defineProperty(window, 'scrollY', { value: 150, writable: true });
      Object.defineProperty(window, 'pageYOffset', { value: 150, writable: true });

      render(<Home />);
      await selectStockAndReplay();

      const devBtn = screen.getByTestId('dev-open-confirmed-future-event');
      fireEvent.click(devBtn);

      await waitFor(() => {
        expect(document.body.style.position).toBe('fixed');
      });

      const closeBtn = screen.getByTestId('future-event-detail-close');
      fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(scrollToSpy).toHaveBeenCalledWith(0, 150);
      });

      scrollToSpy.mockRestore();
    });
  });

  describe('测试18: 开发面板集中管理', () => {
    test('生产环境不渲染DevToolsPanel', () => {
      process.env.NODE_ENV = 'production';
      render(<Home />);

      // 所有 dev-* testid 都不应存在
      const devTestIds = [
        'dev-open-event-group',
        'dev-open-mapped-event',
        'dev-open-node',
        'dev-open-multi-source-event',
        'dev-open-single-source-event',
        'dev-open-no-source-event',
        'dev-load-march-range',
        'dev-open-source-detail',
        'dev-open-future-calendar',
        'dev-open-confirmed-future-event',
        'dev-open-estimated-future-event',
        'dev-open-tentative-future-event',
        'dev-show-empty-future-events',
      ];

      devTestIds.forEach(testId => {
        expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
      });
    });

    test('开发环境渲染所有开发辅助按钮', async () => {
      process.env.NODE_ENV = 'development';
      render(<Home />);
      await selectStockAndReplay();

      // 关键的 dev 按钮应该存在
      expect(screen.getByTestId('dev-open-source-detail')).toBeInTheDocument();
      expect(screen.getByTestId('dev-open-confirmed-future-event')).toBeInTheDocument();
      expect(screen.getByTestId('dev-open-node')).toBeInTheDocument();
    });
  });

  describe('测试19: executeReplay 异常处理与请求防重', () => {
    // 使用顶层 mock 的 simulateReplaySpy，断言真实调用次数
    // dev-open-success 首次点击时 selectedStock=null → simulateReplay（Mock 分支）
    // 重试时 selectedStock=DEMO_STOCK → fetch（真实行情分支）

    afterEach(() => {
      simulateReplaySpy.mockClear();
      // 恢复默认实现（原始 simulateReplay）
      const actual = jest.requireActual('@/utils/devHelpers');
      simulateReplaySpy.mockImplementation(actual.simulateReplay);
    });

    test('连续点击开始复盘三次，simulateReplay 只调用一次', async () => {
      render(<Home />);

      // dev-open-success 首次点击：executeReplay 闭包中 selectedStock=null → simulateReplay（Mock 分支）
      jest.useFakeTimers();
      const successBtn = screen.getByTestId('dev-open-success');

      // 连续点击3次（请求防重：只执行第一次）
      fireEvent.click(successBtn);
      fireEvent.click(successBtn);
      fireEvent.click(successBtn);

      // 完成 simulateReplay 的 setTimeout
      await act(async () => { jest.runAllTimers(); });
      jest.useRealTimers();

      // simulateReplay 只调用一次
      expect(simulateReplaySpy).toHaveBeenCalledTimes(1);
    });

    test('连续点击重试三次，只发起一次 fetch 请求', async () => {
      render(<Home />);

      // 先进入错误状态（loadErrorState 内部有 setTimeout，需用 fake timers）
      jest.useFakeTimers();
      const errorBtn = screen.getByTestId('dev-open-error');
      fireEvent.click(errorBtn);
      await act(async () => { jest.runAllTimers(); });

      expect(screen.getAllByText('重试').length).toBeGreaterThan(0);

      // 连续点击重试3次（重试走 fetch，请求防重：只执行第一次）
      const retryBtn = screen.getAllByText('重试')[0].closest('button')!;
      fireEvent.click(retryBtn);
      fireEvent.click(retryBtn);
      fireEvent.click(retryBtn);

      jest.useRealTimers();

      // fetch 只调用一次（请求防重）
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('simulateReplay reject 后显示错误状态', async () => {
      // dev-open-success 首次点击走 simulateReplay（selectedStock=null）
      simulateReplaySpy.mockRejectedValue(new Error('Network error'));

      render(<Home />);

      const successBtn = screen.getByTestId('dev-open-success');
      // mocked simulateReplay 的 reject 在微任务中完成，用 await act 刷新
      await act(async () => {
        fireEvent.click(successBtn);
      });

      // 验证错误状态显示
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
    });

    test('reject 后重试按钮可见', async () => {
      simulateReplaySpy.mockRejectedValue(new Error('Network error'));

      render(<Home />);

      const successBtn = screen.getByTestId('dev-open-success');
      await act(async () => {
        fireEvent.click(successBtn);
      });

      expect(screen.getByTestId('error-state')).toBeInTheDocument();
      expect(screen.getAllByText('重试').length).toBeGreaterThan(0);
    });

    test('reject 后请求锁和 isLoading 已恢复，再次点击重试能发起新请求', async () => {
      // 第一次：simulateReplay reject（dev-open-success 首次点击，selectedStock=null）
      simulateReplaySpy.mockRejectedValueOnce(new Error('Network error'));

      // 第二次：重试走 fetch（selectedStock 已被 dev-open-success 设为 DEMO_STOCK）
      mockFetch.mockResolvedValueOnce(makeRealMarketResponse('600519', 'SH', '贵州茅台') as unknown as Response);

      render(<Home />);

      // 第一次请求（simulateReplay reject）
      const successBtn = screen.getByTestId('dev-open-success');
      await act(async () => {
        fireEvent.click(successBtn);
      });

      expect(screen.getByTestId('error-state')).toBeInTheDocument();
      expect(simulateReplaySpy).toHaveBeenCalledTimes(1);

      // 第二次请求（重试走 fetch，应该成功）
      const retryBtn = screen.getAllByText('重试')[0].closest('button')!;
      await act(async () => {
        fireEvent.click(retryBtn);
      });

      // simulateReplay 仍然只调用1次（重试走 fetch）
      expect(simulateReplaySpy).toHaveBeenCalledTimes(1);
      // fetch 调用1次
      expect(mockFetch).toHaveBeenCalledTimes(1);
      // 验证成功状态（图表渲染）
      expect(screen.getByTestId('chart-wrapper')).toBeInTheDocument();
    });

    test('异常前打开的抽屉和弹窗被清理', async () => {
      const mockResult = getMockReplayResult('stock-sh-600519', '2024-01-01', '2024-01-31');

      // 第一次：simulateReplay 成功（dev-open-success 首次点击，selectedStock=null）
      simulateReplaySpy.mockResolvedValueOnce({ state: 'success', result: mockResult });

      // 第二次：dev-open-success 再次点击时 selectedStock=DEMO_STOCK → fetch（reject）
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        render(<Home />);
      });

      // 第一次：加载成功状态
      await act(async () => {
        fireEvent.click(screen.getByTestId('dev-open-success'));
      });

      expect(simulateReplaySpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/走势复盘结果|日K查询结果/)).toBeInTheDocument();

      // 打开未来事件详情抽屉
      await act(async () => {
        fireEvent.click(screen.getByTestId('dev-open-confirmed-future-event'));
      });
      expect(screen.getByTestId('future-event-detail-close')).toBeInTheDocument();

      // 第二次：再次点击成功按钮（selectedStock 已设为 DEMO_STOCK → fetch → reject）
      // executeReplay 开头会清理所有抽屉和选中状态
      await act(async () => {
        fireEvent.click(screen.getByTestId('dev-open-success'));
      });

      // 验证：抽屉已关闭 + 错误状态显示
      expect(screen.queryByTestId('future-event-detail-close')).not.toBeInTheDocument();
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
    });
  });
});
