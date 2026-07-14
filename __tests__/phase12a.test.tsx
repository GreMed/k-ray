/**
 * K-Ray 第十二阶段 A 前端测试 - 用户复盘笔记
 * 覆盖测试：
 *   1. 新增笔记并显示
 *   2. 编辑笔记
 *   3. 删除笔记
 *   4. 刷新后笔记仍存在
 *   5. 同一股票不同节点隔离
 *   6. 不同股票之间隔离
 *   7. 点击图表 marker 和点击节点列表项，均能看到各自正确笔记
 *   8. 笔记为空状态
 *   9. 损坏 localStorage 数据安全降级
 *  10. 页面不存在系统因果归因、预测或投资建议文案
 *  11. 新闻候选、未来用户事件日历和历史 K 线查询不受影响（回归保护）
 *
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import Home from '@/app/page';
import { addNote, loadNotes } from '@/services/replayNotes';

// === lightweight-charts mock ===
let capturedClickHandler: ((param: { hoveredObjectId?: string }) => void) | null = null;
let capturedSetMarkersCall: Array<{ id?: string; time?: string }> = [];

jest.mock('lightweight-charts', () => {
  const originalModule = jest.requireActual('lightweight-charts');

  const mockCandlestickSeries = {
    setData: jest.fn(),
    setMarkers: jest.fn((markers: Array<{ id?: string; time?: string }>) => {
      capturedSetMarkersCall = markers;
    }),
    applyOptions: jest.fn(),
  };

  const mockChart = {
    addCandlestickSeries: jest.fn(() => mockCandlestickSeries),
    subscribeCrosshairMove: jest.fn(),
    subscribeClick: jest.fn((handler: (param: { hoveredObjectId?: string }) => void) => {
      capturedClickHandler = handler;
    }),
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

// === Mock 数据：node-event-candidates 默认返回空候选 ===
const mockEmptyCandidates = {
  candidates: [],
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
    totalCount: 0,
    verifiedCount: 0,
    unverifiedCount: 0,
    multiStockSummaryCount: 0,
    originalTotalCount: 0,
    cacheStatus: 'miss',
  },
};

function setNodeEventResponse(response: unknown, ok = true) {
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
    return Promise.resolve({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not Found' }),
    } as Response);
  });
}

describe('第十二阶段 A 前端测试 - 用户复盘笔记', () => {
  let originalNodeEnv: string | undefined;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    jest.clearAllMocks();
    mockFetch.mockClear();
    capturedClickHandler = null;
    capturedSetMarkersCall = [];
    setNodeEventResponse(mockEmptyCandidates);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    // 清空 localStorage
    window.localStorage.clear();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    consoleErrorSpy.mockRestore();
    jest.useRealTimers();
    window.localStorage.clear();
  });

  // 辅助：加载开发验收样本并点击第一个关键节点打开抽屉
  async function loadSampleAndOpenDrawer(nodeIndex = 0) {
    await act(async () => { render(<Home />); });

    const sampleBtn = screen.getByTestId('dev-key-node-sample-with-nodes');
    await act(async () => { fireEvent.click(sampleBtn); });

    await waitFor(() => {
      expect(screen.getByTestId('key-node-list')).toBeInTheDocument();
    });

    const items = screen.getByTestId('key-node-items');
    expect(items.children.length).toBeGreaterThan(nodeIndex);
    const item = items.children[nodeIndex] as HTMLElement;

    await act(async () => { fireEvent.click(item); });

    await waitFor(() => {
      expect(screen.getByTestId('node-event-drawer')).toBeInTheDocument();
    });

    // 等待笔记区域可见
    await waitFor(() => {
      expect(screen.getByTestId('replay-note-section')).toBeInTheDocument();
    });
  }

  // 辅助：在笔记表单中输入内容并保存
  async function fillAndSaveNote(content: string) {
    const textarea = screen.getByTestId('replay-note-textarea');
    await act(async () => {
      fireEvent.change(textarea, { target: { value: content } });
    });

    const saveBtn = screen.getByTestId('replay-note-save-btn');
    await act(async () => { fireEvent.click(saveBtn); });

    // 等待笔记卡片显示
    await waitFor(() => {
      expect(screen.getByTestId('replay-note-card')).toBeInTheDocument();
    });
  }

  // ========== 测试1：新增笔记并显示 ==========

  test('测试1: 新增笔记后正确显示笔记内容、节点信息和用户标记', async () => {
    await loadSampleAndOpenDrawer();

    // 初始为空状态
    expect(screen.getByTestId('replay-note-empty')).toBeInTheDocument();

    // 点击新增
    const addBtn = screen.getByTestId('replay-note-add-btn');
    await act(async () => { fireEvent.click(addBtn); });

    // 表单出现
    expect(screen.getByTestId('replay-note-form')).toBeInTheDocument();

    // 输入内容并保存
    await fillAndSaveNote('这是一个测试笔记，记录我对该节点的观察。');

    // 验证笔记卡片显示
    const card = screen.getByTestId('replay-note-card');
    expect(card).toHaveTextContent('这是一个测试笔记，记录我对该节点的观察。');

    // 验证用户标记
    expect(screen.getByTestId('replay-note-user-badge')).toHaveTextContent('用户记录');

    // 验证节点信息（股票代码、日期）
    expect(card).toHaveTextContent('600519');

    // 验证创建时间和修改时间显示
    expect(screen.getByTestId('replay-note-created-at')).toBeInTheDocument();
    expect(screen.getByTestId('replay-note-updated-at')).toBeInTheDocument();
  });

  // ========== 测试2：编辑笔记 ==========

  test('测试2: 编辑笔记后内容正确更新', async () => {
    await loadSampleAndOpenDrawer();

    // 先新增一条笔记
    await act(async () => { fireEvent.click(screen.getByTestId('replay-note-add-btn')); });
    await fillAndSaveNote('原始笔记内容');

    // 点击编辑
    const editBtn = screen.getByTestId('replay-note-edit-btn');
    await act(async () => { fireEvent.click(editBtn); });

    // 表单出现，内容应预填
    expect(screen.getByTestId('replay-note-form')).toBeInTheDocument();
    const textarea = screen.getByTestId('replay-note-textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('原始笔记内容');

    // 修改内容
    await act(async () => {
      fireEvent.change(textarea, { target: { value: '修改后的笔记内容' } });
    });

    // 保存
    await act(async () => { fireEvent.click(screen.getByTestId('replay-note-save-btn')); });

    // 验证内容已更新
    await waitFor(() => {
      const card = screen.getByTestId('replay-note-card');
      expect(card).toHaveTextContent('修改后的笔记内容');
      expect(card).not.toHaveTextContent('原始笔记内容');
    });
  });

  // ========== 测试3：删除笔记 ==========

  test('测试3: 删除笔记后显示空状态', async () => {
    await loadSampleAndOpenDrawer();

    // 先新增一条笔记
    await act(async () => { fireEvent.click(screen.getByTestId('replay-note-add-btn')); });
    await fillAndSaveNote('待删除的笔记');

    // 点击删除
    const deleteBtn = screen.getByTestId('replay-note-delete-btn');
    await act(async () => { fireEvent.click(deleteBtn); });

    // 确认对话框出现
    expect(screen.getByTestId('replay-note-delete-confirm-dialog')).toBeInTheDocument();

    // 确认删除
    await act(async () => { fireEvent.click(screen.getByTestId('replay-note-delete-confirm')); });

    // 验证回到空状态
    await waitFor(() => {
      expect(screen.getByTestId('replay-note-empty')).toBeInTheDocument();
      expect(screen.queryByTestId('replay-note-card')).not.toBeInTheDocument();
    });
  });

  // ========== 测试4：刷新后笔记仍存在 ==========

  test('测试4: 关闭抽屉并重新打开同一节点后，笔记仍存在', async () => {
    await loadSampleAndOpenDrawer();

    // 新增一条笔记
    await act(async () => { fireEvent.click(screen.getByTestId('replay-note-add-btn')); });
    await fillAndSaveNote('持久化测试笔记');

    // 关闭抽屉
    await act(async () => { fireEvent.click(screen.getByTestId('node-event-drawer-close')); });

    await waitFor(() => {
      expect(screen.queryByTestId('node-event-drawer')).not.toBeInTheDocument();
    });

    // 重新点击同一节点打开抽屉
    const items = screen.getByTestId('key-node-items');
    const firstItem = items.children[0] as HTMLElement;
    await act(async () => { fireEvent.click(firstItem); });

    await waitFor(() => {
      expect(screen.getByTestId('node-event-drawer')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId('replay-note-section')).toBeInTheDocument();
    });

    // 验证笔记仍然存在
    await waitFor(() => {
      const card = screen.getByTestId('replay-note-card');
      expect(card).toHaveTextContent('持久化测试笔记');
    });
  });

  // ========== 测试5：同一股票不同节点隔离 ==========

  test('测试5: 同一股票不同节点的笔记相互隔离', async () => {
    await loadSampleAndOpenDrawer(0);

    // 为第一个节点添加笔记
    await act(async () => { fireEvent.click(screen.getByTestId('replay-note-add-btn')); });
    await fillAndSaveNote('第一个节点的笔记');

    // 关闭抽屉
    await act(async () => { fireEvent.click(screen.getByTestId('node-event-drawer-close')); });

    await waitFor(() => {
      expect(screen.queryByTestId('node-event-drawer')).not.toBeInTheDocument();
    });

    // 点击第二个节点（如果存在）
    const items = screen.getByTestId('key-node-items');
    if (items.children.length > 1) {
      const secondItem = items.children[1] as HTMLElement;
      await act(async () => { fireEvent.click(secondItem); });

      await waitFor(() => {
        expect(screen.getByTestId('node-event-drawer')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByTestId('replay-note-section')).toBeInTheDocument();
      });

      // 第二个节点应为空状态（笔记隔离）
      expect(screen.getByTestId('replay-note-empty')).toBeInTheDocument();
      expect(screen.queryByText('第一个节点的笔记')).not.toBeInTheDocument();
    } else {
      // 如果只有一个节点，通过服务层验证数据隔离
      const stockCode = '600519';
      const firstNodeId = capturedSetMarkersCall[0]?.id || 'node-0';
      const secondNodeId = 'significant_down:600519:2024-01-15';

      // 直接通过服务层为不同节点添加笔记
      addNote(stockCode, {
        nodeId: secondNodeId,
        nodeDate: '2024-01-15',
        nodeType: 'significant_down',
        changePercent: -5.2,
        content: '第二个节点的笔记',
      });

      const notes = loadNotes(stockCode);
      expect(notes.length).toBe(2);
      expect(notes.find(n => n.nodeId === firstNodeId)).toBeDefined();
      expect(notes.find(n => n.nodeId === secondNodeId)).toBeDefined();
    }
  });

  // ========== 测试6：不同股票之间隔离 ==========

  test('测试6: 不同股票的笔记相互隔离', async () => {
    // 直接通过服务层为两只股票添加笔记
    addNote('600519', {
      nodeId: 'significant_up:600519:2024-01-10',
      nodeDate: '2024-01-10',
      nodeType: 'significant_up',
      changePercent: 6.5,
      content: '600519的笔记',
    });

    addNote('000001', {
      nodeId: 'significant_up:000001:2024-01-10',
      nodeDate: '2024-01-10',
      nodeType: 'significant_up',
      changePercent: 3.2,
      content: '000001的笔记',
    });

    // 验证数据隔离
    const notes519 = loadNotes('600519');
    const notes001 = loadNotes('000001');

    expect(notes519).toHaveLength(1);
    expect(notes519[0].content).toBe('600519的笔记');
    expect(notes519[0].stockCode).toBe('600519');

    expect(notes001).toHaveLength(1);
    expect(notes001[0].content).toBe('000001的笔记');
    expect(notes001[0].stockCode).toBe('000001');
  });

  // ========== 测试7：点击图表 marker 和点击节点列表项，均能看到正确笔记 ==========

  test('测试7: 通过图表 marker 点击打开抽屉后也能看到笔记', async () => {
    await act(async () => { render(<Home />); });

    // 加载开发样本
    await act(async () => { fireEvent.click(screen.getByTestId('dev-key-node-sample-with-nodes')); });

    await waitFor(() => {
      expect(screen.getByTestId('key-node-list')).toBeInTheDocument();
    });

    // 验证 markers 被设置
    expect(capturedSetMarkersCall.length).toBeGreaterThan(0);

    // 通过列表项点击第一个节点，添加笔记
    const items = screen.getByTestId('key-node-items');
    const firstItem = items.children[0] as HTMLElement;
    await act(async () => { fireEvent.click(firstItem); });

    await waitFor(() => {
      expect(screen.getByTestId('node-event-drawer')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId('replay-note-section')).toBeInTheDocument();
    });

    // 添加笔记
    await act(async () => { fireEvent.click(screen.getByTestId('replay-note-add-btn')); });
    await fillAndSaveNote('通过列表项添加的笔记');

    // 关闭抽屉
    await act(async () => { fireEvent.click(screen.getByTestId('node-event-drawer-close')); });

    await waitFor(() => {
      expect(screen.queryByTestId('node-event-drawer')).not.toBeInTheDocument();
    });

    // 通过图表 marker 点击同一节点
    if (capturedClickHandler && capturedSetMarkersCall.length > 0) {
      const firstMarker = capturedSetMarkersCall[0];
      await act(async () => {
        capturedClickHandler({ hoveredObjectId: firstMarker.id });
      });

      await waitFor(() => {
        expect(screen.getByTestId('node-event-drawer')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByTestId('replay-note-section')).toBeInTheDocument();
      });

      // 验证笔记仍然存在
      await waitFor(() => {
        const card = screen.getByTestId('replay-note-card');
        expect(card).toHaveTextContent('通过列表项添加的笔记');
      });
    }
  });

  // ========== 测试8：笔记为空状态 ==========

  test('测试8: 无笔记时显示清晰的空状态和固定提示', async () => {
    await loadSampleAndOpenDrawer();

    // 验证空状态
    expect(screen.getByTestId('replay-note-empty')).toBeInTheDocument();
    expect(screen.getByTestId('replay-note-empty')).toHaveTextContent('暂无复盘笔记');

    // 验证固定提示
    expect(screen.getByTestId('replay-note-tip')).toBeInTheDocument();
    expect(screen.getByTestId('replay-note-tip')).toHaveTextContent(
      '笔记由用户自行记录，仅供个人复盘参考，不代表已验证事实、因果关系或价格预测。',
    );

    // 验证新增按钮存在
    expect(screen.getByTestId('replay-note-add-btn')).toBeInTheDocument();
  });

  // ========== 测试9：损坏 localStorage 数据安全降级 ==========

  test('测试9: localStorage 中存在损坏数据时，页面不报错且显示空状态', async () => {
    // 写入损坏的 localStorage 数据
    window.localStorage.setItem('k-ray:replay-notes:600519', '{invalid json');

    // 直接测试服务层的安全降级
    const notes = loadNotes('600519');
    expect(notes).toEqual([]);

    // 写入结构不完整的数据
    window.localStorage.setItem('k-ray:replay-notes:600519', JSON.stringify([
      { id: 'incomplete', content: 'missing fields' },
      { id: 'valid-note', stockCode: '600519', nodeId: 'test', nodeDate: '2024-01-01', nodeType: 'significant_up', changePercent: 5.0, content: '完整数据', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
    ]));

    const filteredNotes = loadNotes('600519');
    // 应过滤掉不完整的数据，只保留有效的
    expect(filteredNotes).toHaveLength(1);
    expect(filteredNotes[0].id).toBe('valid-note');

    // 页面渲染不应报错
    await loadSampleAndOpenDrawer();
    expect(screen.getByTestId('replay-note-section')).toBeInTheDocument();
  });

  // ========== 测试10：页面不存在系统因果归因、预测或投资建议文案 ==========

  test('测试10: 笔记区域不存在因果归因、预测或投资建议文案', async () => {
    await loadSampleAndOpenDrawer();

    // 添加一条笔记
    await act(async () => { fireEvent.click(screen.getByTestId('replay-note-add-btn')); });
    await fillAndSaveNote('用户观察内容');

    const section = screen.getByTestId('replay-note-section');
    const sectionText = section.textContent || '';

    // 不应包含因果归因或投资建议文案
    const forbiddenPhrases = [
      '导致上涨', '导致下跌', '下跌原因', '上涨原因',
      '利好', '利空', '买入', '卖出', '目标价',
      '可能上涨', '可能下跌', '预计涨', '预计跌',
      '投资建议', '系统验证', '系统已核验',
    ];

    forbiddenPhrases.forEach(phrase => {
      expect(sectionText).not.toContain(phrase);
    });

    // 应包含用户标记
    expect(sectionText).toContain('用户记录');

    // 应包含固定提示
    expect(sectionText).toContain('不代表已验证事实、因果关系或价格预测');
  });

  // ========== 测试11：新闻候选、未来用户事件日历和历史 K 线查询不受影响 ==========

  test('测试11: 回归保护 — 新闻候选、用户未来事件日历和关键节点列表仍正常', async () => {
    await loadSampleAndOpenDrawer();

    // 验证新闻候选区域仍存在
    expect(screen.getByTestId('node-event-section-candidates')).toBeInTheDocument();

    // 验证阅读提示仍存在
    expect(screen.getByTestId('node-event-reading-tip')).toBeInTheDocument();

    // 验证节点信息区域仍存在
    expect(screen.getByTestId('node-event-section-info')).toBeInTheDocument();

    // 关闭抽屉，验证用户未来事件日历仍存在
    await act(async () => { fireEvent.click(screen.getByTestId('node-event-drawer-close')); });

    await waitFor(() => {
      expect(screen.queryByTestId('node-event-drawer')).not.toBeInTheDocument();
    });

    // 验证关键节点列表仍存在
    expect(screen.getByTestId('key-node-list')).toBeInTheDocument();

    // 验证事件日历仍存在
    expect(screen.getByTestId('calendar-card-wrapper')).toBeInTheDocument();

    // 验证图表仍存在
    expect(screen.getByTestId('chart-wrapper')).toBeInTheDocument();
  });
});
