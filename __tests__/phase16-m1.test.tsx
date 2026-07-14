// 第十六阶段 里程碑一：任意交易日复盘笔记 测试
//
// 覆盖：
// - 笔记服务层 CRUD（stockCode + date 隔离）
// - 旧 nodeId 笔记兼容迁移
// - 损坏数据 fallback
// - 笔记 marker 稳定 ID
// - 任意交易日笔记组件交互
// - 页面无网络请求

import { describe, test, expect, beforeEach } from '@jest/globals';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import TradingDayNotePanel from '@/components/TradingDayNotePanel';
import CoreReplayDemoPage from '@/app/demo/core-replay/page';
import * as replayNotesService from '@/services/replayNotes';
import {
  loadNotes,
  loadNoteByDate,
  addNote,
  updateNote,
  deleteNote,
  clearNotes,
  generateNoteMarkerId,
} from '@/services/replayNotes';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// 测试用 K 线数据
const TEST_KLINES = [
  { id: 'k1', stockId: 's1', date: '2024-09-02', open: 200, high: 210, low: 198, close: 205, volume: 5000000, changePercent: 1.5 },
  { id: 'k2', stockId: 's1', date: '2024-09-03', open: 205, high: 215, low: 203, close: 210, volume: 6000000, changePercent: 2.4 },
  { id: 'k3', stockId: 's1', date: '2024-09-30', open: 220, high: 245, low: 218, close: 241, volume: 91000000, changePercent: 11.06 },
];

const TEST_MARKET_NODES = [
  {
    id: 'significant_up:300750:2024-09-30',
    stockCode: '300750',
    date: '2024-09-30',
    type: 'significant_up' as const,
    title: '单日显著上涨',
    close: 241,
    changePercent: 11.06,
    volume: 91000000,
    previousClose: 210,
    previousVolume: 6000000,
    volumeChangePercent: 1400,
    detailSummary: 'test',
    evidenceLevel: 'market_data_only' as const,
  },
];

describe('第十六阶段 里程碑一：任意交易日复盘笔记', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ========== 1. 笔记服务层 CRUD ==========

  describe('笔记服务层 CRUD（stockCode + date 隔离）', () => {
    test('新增笔记后可以按日期读取', () => {
      addNote('300750', {
        date: '2024-09-02',
        nodeId: null,
        nodeType: null,
        changePercent: null,
        content: '测试笔记内容',
      });
      const note = loadNoteByDate('300750', '2024-09-02');
      expect(note).not.toBeNull();
      expect(note!.content).toBe('测试笔记内容');
      expect(note!.date).toBe('2024-09-02');
      expect(note!.nodeId).toBeNull();
    });

    test('同一股票同一日期只保留一条笔记', () => {
      addNote('300750', {
        date: '2024-09-02',
        nodeId: null,
        nodeType: null,
        changePercent: null,
        content: '第一条笔记',
      });
      addNote('300750', {
        date: '2024-09-02',
        nodeId: null,
        nodeType: null,
        changePercent: null,
        content: '第二条笔记（替换）',
      });
      const notes = loadNotes('300750');
      expect(notes).toHaveLength(1);
      expect(notes[0].content).toBe('第二条笔记（替换）');
    });

    test('不同股票的笔记互相隔离', () => {
      addNote('300750', {
        date: '2024-09-02',
        nodeId: null,
        nodeType: null,
        changePercent: null,
        content: '宁德时代笔记',
      });
      addNote('600519', {
        date: '2024-09-02',
        nodeId: null,
        nodeType: null,
        changePercent: null,
        content: '贵州茅台笔记',
      });
      const notes300750 = loadNotes('300750');
      const notes600519 = loadNotes('600519');
      expect(notes300750).toHaveLength(1);
      expect(notes300750[0].content).toBe('宁德时代笔记');
      expect(notes600519).toHaveLength(1);
      expect(notes600519[0].content).toBe('贵州茅台笔记');
    });

    test('同一股票不同日期可以有多条笔记', () => {
      addNote('300750', {
        date: '2024-09-02',
        nodeId: null,
        nodeType: null,
        changePercent: null,
        content: '9月2日笔记',
      });
      addNote('300750', {
        date: '2024-09-03',
        nodeId: null,
        nodeType: null,
        changePercent: null,
        content: '9月3日笔记',
      });
      const notes = loadNotes('300750');
      expect(notes).toHaveLength(2);
    });

    test('编辑笔记内容后 updatedAt 更新', () => {
      const created = addNote('300750', {
        date: '2024-09-02',
        nodeId: null,
        nodeType: null,
        changePercent: null,
        content: '原始内容',
      });
      const updated = updateNote('300750', created.id, '修改后内容');
      expect(updated).not.toBeNull();
      expect(updated!.content).toBe('修改后内容');
      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(created.updatedAt).getTime());
    });

    test('删除笔记后不再能读取', () => {
      const created = addNote('300750', {
        date: '2024-09-02',
        nodeId: null,
        nodeType: null,
        changePercent: null,
        content: '待删除',
      });
      const success = deleteNote('300750', created.id);
      expect(success).toBe(true);
      expect(loadNoteByDate('300750', '2024-09-02')).toBeNull();
    });

    test('清空笔记后列表为空', () => {
      addNote('300750', {
        date: '2024-09-02',
        nodeId: null,
        nodeType: null,
        changePercent: null,
        content: '笔记1',
      });
      clearNotes('300750');
      expect(loadNotes('300750')).toHaveLength(0);
    });
  });

  // ========== 2. 旧 nodeId 笔记兼容迁移 ==========

  describe('旧 nodeId 笔记兼容迁移', () => {
    test('旧格式笔记（nodeDate 字段）可以自动迁移为新格式（date 字段）', () => {
      // 模拟旧格式数据写入 localStorage
      const legacyNote = {
        id: 'rn-legacy-001',
        stockCode: '300750',
        nodeId: 'significant_up:300750:2024-09-30',
        nodeDate: '2024-09-30',
        nodeType: 'significant_up',
        changePercent: 11.06,
        content: '旧格式笔记内容',
        createdAt: '2024-10-01T00:00:00.000Z',
        updatedAt: '2024-10-01T00:00:00.000Z',
      };
      localStorage.setItem('k-ray:replay-notes:300750', JSON.stringify([legacyNote]));

      // 读取时自动迁移
      const notes = loadNotes('300750');
      expect(notes).toHaveLength(1);
      expect(notes[0].date).toBe('2024-09-30');
      expect(notes[0].nodeId).toBe('significant_up:300750:2024-09-30');
      expect(notes[0].nodeType).toBe('significant_up');
      expect(notes[0].changePercent).toBe(11.06);
      expect(notes[0].content).toBe('旧格式笔记内容');
    });

    test('旧格式笔记可以通过 loadNote（按 nodeId）读取', () => {
      const legacyNote = {
        id: 'rn-legacy-002',
        stockCode: '300750',
        nodeId: 'significant_up:300750:2024-09-30',
        nodeDate: '2024-09-30',
        nodeType: 'significant_up',
        changePercent: 11.06,
        content: '旧格式笔记',
        createdAt: '2024-10-01T00:00:00.000Z',
        updatedAt: '2024-10-01T00:00:00.000Z',
      };
      localStorage.setItem('k-ray:replay-notes:300750', JSON.stringify([legacyNote]));

      const note = replayNotesService.loadNote('300750', 'significant_up:300750:2024-09-30');
      expect(note).not.toBeNull();
      expect(note!.content).toBe('旧格式笔记');
    });

    test('新格式和旧格式笔记可以混合存在', () => {
      const legacyNote = {
        id: 'rn-legacy-003',
        stockCode: '300750',
        nodeId: 'significant_up:300750:2024-09-30',
        nodeDate: '2024-09-30',
        nodeType: 'significant_up',
        changePercent: 11.06,
        content: '旧格式',
        createdAt: '2024-10-01T00:00:00.000Z',
        updatedAt: '2024-10-01T00:00:00.000Z',
      };
      localStorage.setItem('k-ray:replay-notes:300750', JSON.stringify([legacyNote]));

      // 新增新格式笔记
      addNote('300750', {
        date: '2024-09-02',
        nodeId: null,
        nodeType: null,
        changePercent: null,
        content: '新格式',
      });

      const notes = loadNotes('300750');
      expect(notes).toHaveLength(2);
    });
  });

  // ========== 3. 损坏数据 fallback ==========

  describe('损坏数据 fallback', () => {
    test('JSON 解析失败返回空数组', () => {
      localStorage.setItem('k-ray:replay-notes:300750', 'not valid json {{{');
      const notes = loadNotes('300750');
      expect(notes).toEqual([]);
    });

    test('非数组 JSON 返回空数组', () => {
      localStorage.setItem('k-ray:replay-notes:300750', '{"key": "value"}');
      const notes = loadNotes('300750');
      expect(notes).toEqual([]);
    });

    test('部分损坏的笔记被过滤，保留有效笔记', () => {
      const validNote = {
        id: 'rn-valid-001',
        stockCode: '300750',
        date: '2024-09-02',
        nodeId: null,
        nodeType: null,
        changePercent: null,
        content: '有效笔记',
        createdAt: '2024-10-01T00:00:00.000Z',
        updatedAt: '2024-10-01T00:00:00.000Z',
      };
      const invalidNote = {
        id: 'rn-invalid',
        // 缺少大量必填字段
        content: '无效笔记',
      };
      localStorage.setItem('k-ray:replay-notes:300750', JSON.stringify([validNote, invalidNote]));
      const notes = loadNotes('300750');
      expect(notes).toHaveLength(1);
      expect(notes[0].content).toBe('有效笔记');
    });

    test('SSR 环境（无 window）返回空数组', () => {
      const originalWindow = global.window;
      // @ts-expect-error 临时删除 window 模拟 SSR
      delete global.window;
      const notes = loadNotes('300750');
      expect(notes).toEqual([]);
      global.window = originalWindow;
    });
  });

  // ========== 4. 笔记 marker 稳定 ID ==========

  describe('笔记 marker 稳定 ID', () => {
    test('generateNoteMarkerId 返回稳定格式', () => {
      const markerId = generateNoteMarkerId('300750', '2024-09-30');
      expect(markerId).toBe('user-note:300750:2024-09-30');
    });

    test('不同股票同一天的 marker ID 不同', () => {
      const id1 = generateNoteMarkerId('300750', '2024-09-30');
      const id2 = generateNoteMarkerId('600519', '2024-09-30');
      expect(id1).not.toBe(id2);
    });

    test('同一股票同一天的 marker ID 稳定', () => {
      const id1 = generateNoteMarkerId('300750', '2024-09-30');
      const id2 = generateNoteMarkerId('300750', '2024-09-30');
      expect(id1).toBe(id2);
    });
  });

  // ========== 5. 任意交易日笔记组件交互 ==========

  describe('TradingDayNotePanel 组件交互', () => {
    test('未选择日期时显示空状态提示', async () => {
      await act(async () => {
        render(
          <TradingDayNotePanel
            stockCode="300750"
            stockName="宁德时代"
            selectedDate={null}
            klines={TEST_KLINES}
            marketKeyNodes={[]}
          />
        );
      });
      expect(screen.getByTestId('trading-day-note-empty')).toHaveTextContent('点击行情图中的交易日开始记录');
    });

    test('选择日期后显示当日日期摘要（不含OHLCV）', async () => {
      await act(async () => {
        render(
          <TradingDayNotePanel
            stockCode="300750"
            stockName="宁德时代"
            selectedDate="2024-09-02"
            klines={TEST_KLINES}
            marketKeyNodes={[]}
          />
        );
      });
      expect(screen.getByTestId('trading-day-summary')).toBeInTheDocument();
      expect(screen.getByTestId('trading-day-summary')).toHaveTextContent('2024-09-02');
      // 第十七阶段 UI 收口：笔记卡不再重复展示 OHLCV 行情数据
      const summary = screen.getByTestId('trading-day-summary');
      expect(summary).not.toHaveTextContent('开:');
      expect(summary).not.toHaveTextContent('高:');
      expect(summary).not.toHaveTextContent('低:');
      expect(summary).not.toHaveTextContent('收:');
      expect(summary).not.toHaveTextContent('量:');
      expect(summary).not.toHaveTextContent('涨跌幅');
    });

    test('选择日期但无笔记时显示"暂无笔记"', async () => {
      await act(async () => {
        render(
          <TradingDayNotePanel
            stockCode="300750"
            stockName="宁德时代"
            selectedDate="2024-09-02"
            klines={TEST_KLINES}
            marketKeyNodes={[]}
          />
        );
      });
      expect(screen.getByTestId('trading-day-note-no-note')).toBeInTheDocument();
    });

    test('点击新增笔记可以输入内容并保存', async () => {
      await act(async () => {
        render(
          <TradingDayNotePanel
            stockCode="300750"
            stockName="宁德时代"
            selectedDate="2024-09-02"
            klines={TEST_KLINES}
            marketKeyNodes={[]}
          />
        );
      });
      fireEvent.click(screen.getByTestId('trading-day-note-add-btn'));
      expect(screen.getByTestId('trading-day-note-form')).toBeInTheDocument();
      fireEvent.change(screen.getByTestId('trading-day-note-textarea'), {
        target: { value: '测试新增笔记' },
      });
      fireEvent.click(screen.getByTestId('trading-day-note-save-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('trading-day-note-card')).toBeInTheDocument();
      });
      expect(screen.getByTestId('trading-day-note-content')).toHaveTextContent('测试新增笔记');
    });

    test('保存笔记后 onNoteChanged 回调被调用', async () => {
      const onNoteChanged = jest.fn();
      await act(async () => {
        render(
          <TradingDayNotePanel
            stockCode="300750"
            stockName="宁德时代"
            selectedDate="2024-09-02"
            klines={TEST_KLINES}
            marketKeyNodes={[]}
            onNoteChanged={onNoteChanged}
          />
        );
      });
      fireEvent.click(screen.getByTestId('trading-day-note-add-btn'));
      fireEvent.change(screen.getByTestId('trading-day-note-textarea'), {
        target: { value: '回调测试' },
      });
      fireEvent.click(screen.getByTestId('trading-day-note-save-btn'));
      await waitFor(() => {
        expect(onNoteChanged).toHaveBeenCalledTimes(1);
      });
    });

    test('已有笔记可以编辑', async () => {
      addNote('300750', {
        date: '2024-09-02',
        nodeId: null,
        nodeType: null,
        changePercent: null,
        content: '原始内容',
      });
      await act(async () => {
        render(
          <TradingDayNotePanel
            stockCode="300750"
            stockName="宁德时代"
            selectedDate="2024-09-02"
            klines={TEST_KLINES}
            marketKeyNodes={[]}
          />
        );
      });
      expect(screen.getByTestId('trading-day-note-content')).toHaveTextContent('原始内容');
      fireEvent.click(screen.getByTestId('trading-day-note-edit-btn'));
      fireEvent.change(screen.getByTestId('trading-day-note-textarea'), {
        target: { value: '修改后内容' },
      });
      fireEvent.click(screen.getByTestId('trading-day-note-save-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('trading-day-note-content')).toHaveTextContent('修改后内容');
      });
    });

    test('已有笔记可以删除', async () => {
      addNote('300750', {
        date: '2024-09-02',
        nodeId: null,
        nodeType: null,
        changePercent: null,
        content: '待删除笔记',
      });
      await act(async () => {
        render(
          <TradingDayNotePanel
            stockCode="300750"
            stockName="宁德时代"
            selectedDate="2024-09-02"
            klines={TEST_KLINES}
            marketKeyNodes={[]}
          />
        );
      });
      fireEvent.click(screen.getByTestId('trading-day-note-delete-btn'));
      fireEvent.click(screen.getByTestId('trading-day-note-delete-confirm'));
      await waitFor(() => {
        expect(screen.queryByTestId('trading-day-note-card')).not.toBeInTheDocument();
      });
    });

    test('空内容保存时显示错误', async () => {
      await act(async () => {
        render(
          <TradingDayNotePanel
            stockCode="300750"
            stockName="宁德时代"
            selectedDate="2024-09-02"
            klines={TEST_KLINES}
            marketKeyNodes={[]}
          />
        );
      });
      fireEvent.click(screen.getByTestId('trading-day-note-add-btn'));
      fireEvent.click(screen.getByTestId('trading-day-note-save-btn'));
      expect(screen.getByTestId('trading-day-note-form-error')).toHaveTextContent('请输入笔记内容');
    });

    test('选中关键节点日期时显示节点徽标', async () => {
      await act(async () => {
        render(
          <TradingDayNotePanel
            stockCode="300750"
            stockName="宁德时代"
            selectedDate="2024-09-30"
            klines={TEST_KLINES}
            marketKeyNodes={TEST_MARKET_NODES}
          />
        );
      });
      expect(screen.getByTestId('trading-day-note-node-badge')).toBeInTheDocument();
    });

    test('笔记区域显示"用户记录"徽标', async () => {
      addNote('300750', {
        date: '2024-09-02',
        nodeId: null,
        nodeType: null,
        changePercent: null,
        content: '测试',
      });
      await act(async () => {
        render(
          <TradingDayNotePanel
            stockCode="300750"
            stockName="宁德时代"
            selectedDate="2024-09-02"
            klines={TEST_KLINES}
            marketKeyNodes={[]}
          />
        );
      });
      expect(screen.getByTestId('trading-day-note-user-badge')).toHaveTextContent('用户记录');
    });
  });

  // ========== 6. 案例页笔记功能 ==========

  describe('案例页笔记功能', () => {
    test('案例页渲染双卡片区域', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });
      expect(screen.getByTestId('dual-card-area')).toBeInTheDocument();
      expect(screen.getByTestId('note-card-wrapper')).toBeInTheDocument();
      expect(screen.getByTestId('calendar-card-wrapper')).toBeInTheDocument();
    });

    test('案例页笔记面板初始显示空状态', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });
      expect(screen.getByTestId('trading-day-note-empty')).toBeInTheDocument();
    });

    test('案例页不发起 fetch 请求', async () => {
      const originalFetch = global.fetch;
      let fetchCallCount = 0;
      global.fetch = (() => {
        fetchCallCount++;
        return Promise.resolve(new Response('{}', { status: 200 }));
      }) as typeof fetch;
      try {
        await act(async () => { render(<CoreReplayDemoPage />); });
        expect(fetchCallCount).toBe(0);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  // ========== 6. 真实 clickHandler 测试（封板修复） ==========
  // 注意：clickHandler 测试在独立文件 phase16-m1-click.test.tsx 中
  // 因为需要顶层 jest.mock lightweight-charts，不能与静态导入 ProfessionalKLineChart 的测试混用
});
