/**
 * K-Ray 第六阶段前端测试 - 真实行情模式下的UI行为
 * 验证 000001 不显示 Mock 事件、真实行情文案、降级文案、组件动态文案
 *
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import Home from '@/app/page';

// Mock simulateReplay
jest.mock('@/utils/devHelpers', () => {
  const actual = jest.requireActual('@/utils/devHelpers');
  return {
    ...actual,
    simulateReplay: jest.fn(actual.simulateReplay),
  };
});

// Mock global fetch for /api/market/klines
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch as unknown as typeof fetch;

import { simulateReplay as mockedSimulateReplay } from '@/utils/devHelpers';
const simulateReplaySpy = mockedSimulateReplay as unknown as jest.Mock;

function makeRealKLineResponse(stockId: string, stockCode: string, market: string, stockName: string, count: number = 10) {
  const klines = [];
  const baseDate = new Date('2024-01-02');
  for (let i = 0; i < count; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i * 3);
    const dateStr = d.toISOString().slice(0, 10);
    klines.push({
      id: `baostock:${stockId}:${dateStr}`,
      stockId,
      date: dateStr,
      open: 1700 + i * 10,
      high: 1720 + i * 10,
      low: 1690 + i * 10,
      close: 1710 + i * 10,
      volume: 5000000 + i * 100000,
      changePercent: 0.5 + i * 0.1,
    });
  }
  return {
    ok: true,
    json: async () => ({
      stock: { id: stockId, code: stockCode, name: stockName, market },
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

function makeFallbackKLineResponse(stockId: string, stockCode: string, market: string, stockName: string, count: number = 10) {
  const klines = [];
  const baseDate = new Date('2024-01-02');
  for (let i = 0; i < count; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i * 3);
    const dateStr = d.toISOString().slice(0, 10);
    klines.push({
      id: `mock:${stockId}:${dateStr}`,
      stockId,
      date: dateStr,
      open: 1700 + i * 10,
      high: 1720 + i * 10,
      low: 1690 + i * 10,
      close: 1710 + i * 10,
      volume: 5000000 + i * 100000,
    });
  }
  return {
    ok: true,
    json: async () => ({
      stock: { id: stockId, code: stockCode, name: stockName, market },
      klines,
      meta: {
        source: 'mock',
        sourceLabel: '本地Mock数据',
        adjustment: 'qfq',
        isRealMarketData: false,
        fetchedAt: '2024-07-01T00:00:00.000Z',
        fallbackReason: 'BaoStock服务暂时不可用',
      },
    }),
  };
}

// 辅助：通过搜索选择股票
async function selectStock(container: HTMLElement, keyword: string, stockName: string) {
  const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/) as HTMLInputElement;
  await act(async () => {
    fireEvent.change(input, { target: { value: keyword } });
  });
  const suggestion = await screen.findByText(stockName, { selector: 'button span' });
  await act(async () => {
    fireEvent.click(suggestion);
  });
}

describe('第六阶段前端测试 - 真实行情UI行为', () => {
  let originalNodeEnv: string | undefined;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    jest.clearAllMocks();
    mockFetch.mockClear();
    const actual = jest.requireActual('@/utils/devHelpers');
    simulateReplaySpy.mockImplementation(actual.simulateReplay);
    // 安全 mock console.error，避免故意触发的异常污染测试输出
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    consoleErrorSpy.mockRestore();
  });

  // ========== 000001 不显示贵州茅台 Mock 事件 ==========

  test('000001 真实行情不显示贵州茅台 Mock 事件', async () => {
    mockFetch.mockResolvedValue(
      makeRealKLineResponse('stock-sz-000001', '000001', 'SZ', '平安银行', 15) as unknown as Response,
    );

    const { container } = await act(async () => {
      return render(<Home />);
    });

    // 选择 000001
    await selectStock(container, '000001', '平安银行');

    // 真实行情默认开启（第八阶段）

    // 点击查询行情
    await act(async () => {
      fireEvent.click(screen.getByText('查询行情'));
    });

    // 等待成功状态
    await waitFor(() => {
      expect(screen.getByText(/走势复盘结果|日K查询结果/)).toBeInTheDocument();
    }, { timeout: 5000 });

    // 验证没有贵州茅台的 Mock 事件
    expect(screen.queryByText('2023年度业绩预告超预期')).not.toBeInTheDocument();
    expect(screen.queryByText('白酒行业政策调整信息')).not.toBeInTheDocument();
    expect(screen.queryByText('多家券商更新研究观点')).not.toBeInTheDocument();

    // 真实模式下不渲染旧事件列表区域（第九阶段：真实行情页清理旧功能区域）
    expect(screen.queryByTestId('legacy-event-list')).not.toBeInTheDocument();

    // 验证显示真实行情文案
    expect(screen.getByText('当前K线为BaoStock真实历史行情（前复权日线）。')).toBeInTheDocument();
  });

  // ========== 真实行情与 Mock 事件文案 ==========

  test('600519 真实行情显示真实行情文案和 Mock 事件标注', async () => {
    mockFetch.mockResolvedValue(
      makeRealKLineResponse('stock-sh-600519', '600519', 'SH', '贵州茅台', 20) as unknown as Response,
    );

    const { container } = await act(async () => {
      return render(<Home />);
    });

    // 选择 600519
    await selectStock(container, '600519', '贵州茅台');

    // 真实行情默认开启（第八阶段）

    // 点击查询行情
    await act(async () => {
      fireEvent.click(screen.getByText('查询行情'));
    });

    // 等待成功状态
    await waitFor(() => {
      expect(screen.getByText(/走势复盘结果|日K查询结果/)).toBeInTheDocument();
    }, { timeout: 5000 });

    // 验证显示真实行情文案
    expect(screen.getByText('当前K线为BaoStock真实历史行情（前复权日线）。')).toBeInTheDocument();
    expect(screen.getByText('当前可查看与关键节点时间邻近的新闻候选；候选仅供复盘查阅，不构成已确认的涨跌原因。')).toBeInTheDocument();

    // 验证不显示"所有K线均为模拟"的冲突文案
    expect(screen.queryByText(/所有 K 线/)).not.toBeInTheDocument();
  });

  // ========== 真实行情错误状态 ==========
  // 注：错误状态 UI 已在 phase5 测试中覆盖，服务端错误处理在 phase6.test.ts 中覆盖

  // ========== Mock 模式不调用 API ==========

  test('Mock 模式不调用真实行情 API', async () => {
    await act(async () => {
      render(<Home />);
    });

    // 第十四阶段 A1：Mock 模式通过开发面板的 dev-key-node-sample-* 按钮访问
    await act(async () => {
      fireEvent.click(screen.getByTestId('dev-key-node-sample-with-nodes'));
    });

    // 等待成功状态
    await waitFor(() => {
      expect(screen.getByText(/走势复盘结果|日K查询结果/)).toBeInTheDocument();
    }, { timeout: 5000 });

    // 验证没有调用 fetch（API）
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ========== 真实行情开关可见 ==========

  test('初始状态显示真实行情开关', async () => {
    await act(async () => {
      render(<Home />);
    });

    // 第十四阶段 A1：真实行情开关已移除，普通用户始终使用真实行情
    expect(screen.queryByTestId('real-market-toggle')).not.toBeInTheDocument();
  });

  // ========== 组件动态文案测试 ==========

  describe('组件动态文案', () => {
    // 1. real 状态出现"真实历史行情"和"BaoStock"
    test('real 状态：ProfessionalKLineChart 显示"真实历史行情"和"BaoStock"', async () => {
      mockFetch.mockResolvedValue(
        makeRealKLineResponse('stock-sh-600519', '600519', 'SH', '贵州茅台', 10) as unknown as Response,
      );

      const { container } = await act(async () => {
        return render(<Home />);
      });

      await selectStock(container, '600519', '贵州茅台');
      // 真实行情默认开启（第八阶段）
      await act(async () => { fireEvent.click(screen.getByText('查询行情')); });

      await waitFor(() => {
        expect(screen.getByText(/走势复盘结果|日K查询结果/)).toBeInTheDocument();
      }, { timeout: 5000 });

      const chartLabel = screen.getByTestId('chart-data-label');
      expect(chartLabel).toHaveTextContent('真实历史行情');
      expect(chartLabel).toHaveTextContent('BaoStock');
    });

    // 2. real 状态不出现"当前页面使用本地 mock 数据"
    test('real 状态：RiskWarning 不显示"当前页面使用本地 mock 数据"', async () => {
      mockFetch.mockResolvedValue(
        makeRealKLineResponse('stock-sh-600519', '600519', 'SH', '贵州茅台', 10) as unknown as Response,
      );

      const { container } = await act(async () => {
        return render(<Home />);
      });

      await selectStock(container, '600519', '贵州茅台');
      // 真实行情默认开启（第八阶段）
      await act(async () => { fireEvent.click(screen.getByText('查询行情')); });

      await waitFor(() => {
        expect(screen.getByText(/走势复盘结果|日K查询结果/)).toBeInTheDocument();
      }, { timeout: 5000 });

      expect(screen.queryByText(/当前页面使用本地 mock 数据/)).not.toBeInTheDocument();
    });

    // 3. real 状态不出现"演示数据 - 不代表真实市场行情"
    test('real 状态：ProfessionalKLineChart 不显示"演示数据 - 不代表真实市场行情"', async () => {
      mockFetch.mockResolvedValue(
        makeRealKLineResponse('stock-sh-600519', '600519', 'SH', '贵州茅台', 10) as unknown as Response,
      );

      const { container } = await act(async () => {
        return render(<Home />);
      });

      await selectStock(container, '600519', '贵州茅台');
      // 真实行情默认开启（第八阶段）
      await act(async () => { fireEvent.click(screen.getByText('查询行情')); });

      await waitFor(() => {
        expect(screen.getByText(/走势复盘结果|日K查询结果/)).toBeInTheDocument();
      }, { timeout: 5000 });

      expect(screen.queryByText(/演示数据 - 不代表真实市场行情/)).not.toBeInTheDocument();
    });

    // 4. fallback 状态被普通用户路径拒绝
    // 第十四阶段 A1 封板修复：普通用户查询接口如果返回 meta.isRealMarketData !== true，
    // 不得进入成功结果页。fallback 响应(isRealMarketData=false)被拒绝，进入错误状态。
    // 第十四阶段 A1 收口：错误页和页脚不得显示 Mock 降级残留文案。
    test('fallback 状态：普通查询进入错误状态，无图表，页脚和错误页不含 Mock 降级', async () => {
      mockFetch.mockResolvedValue(
        makeFallbackKLineResponse('stock-sh-600519', '600519', 'SH', '贵州茅台', 10) as unknown as Response,
      );

      const { container } = await act(async () => {
        return render(<Home />);
      });

      await selectStock(container, '600519', '贵州茅台');
      // 真实行情默认开启（第八阶段）
      await act(async () => { fireEvent.click(screen.getByText('查询行情')); });

      // 等待错误状态显示
      await waitFor(() => {
        // 显示 fallbackReason 错误文案（来自 makeFallbackKLineResponse 的 fallbackReason）
        expect(screen.getByText(/BaoStock服务暂时不可用/)).toBeInTheDocument();
      }, { timeout: 5000 });

      // 断言1: fallback/non-real 响应进入错误状态
      expect(screen.getByTestId('error-state')).toBeInTheDocument();

      // 断言2: 错误页没有图表（无 chart-data-label、无 chart-wrapper）
      expect(screen.queryByTestId('chart-data-label')).not.toBeInTheDocument();
      expect(screen.queryByTestId('chart-wrapper')).not.toBeInTheDocument();

      // 不进入成功页（不显示结果标题）
      expect(screen.queryByText(/走势复盘结果|日K查询结果/)).not.toBeInTheDocument();

      // 断言3: 错误页和页脚均不含 "Mock" "降级"
      const errorState = screen.getByTestId('error-state');
      expect(errorState.textContent).not.toContain('Mock');
      expect(errorState.textContent).not.toContain('降级');
      const footerNote = screen.getByTestId('footer-data-note');
      expect(footerNote.textContent).not.toContain('Mock');
      expect(footerNote.textContent).not.toContain('降级');

      // 断言4: 页脚显示"本次未展示任何行情数据"
      expect(footerNote.textContent).toContain('本次未展示任何行情数据');

      // 断言5: 错误文案没有连续两个句号
      const errorText = errorState.textContent || '';
      expect(errorText).not.toContain('。。');
      expect(errorText).not.toContain('！！');
      expect(errorText).not.toContain('。！');
    });

    // 4b. fallbackReason 自带尾部句号时，错误文案不出现双标点
    test('fallback 状态：fallbackReason 自带句号时错误文案不出现 。。', async () => {
      // 自定义 fallbackReason 带尾部句号
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          stock: { id: 'stock-sh-600519', code: '600519', name: '贵州茅台', market: 'SH' },
          klines: [],
          meta: {
            source: 'mock',
            sourceLabel: '本地Mock数据',
            adjustment: 'qfq',
            isRealMarketData: false,
            fetchedAt: '2024-07-01T00:00:00.000Z',
            fallbackReason: 'BaoStock真实行情暂时不可用，请稍后重试。',
          },
        }),
      } as unknown as Response);

      const { container } = await act(async () => {
        return render(<Home />);
      });

      await selectStock(container, '600519', '贵州茅台');
      await act(async () => { fireEvent.click(screen.getByText('查询行情')); });

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      }, { timeout: 5000 });

      const errorText = screen.getByTestId('error-state').textContent || '';
      // 不出现连续两个句号
      expect(errorText).not.toContain('。。');
      // 应该只保留一个句号分隔
      expect(errorText).toContain('请稍后重试。当前无法查询');
    });

    // 5. mock 状态继续显示 Mock 提示
    test('mock 状态：ProfessionalKLineChart 显示 Mock 演示提示', async () => {
      await act(async () => {
        render(<Home />);
      });

      // 第十四阶段 A1：Mock 模式通过开发面板的 dev-key-node-sample-* 按钮访问
      await act(async () => { fireEvent.click(screen.getByTestId('dev-key-node-sample-with-nodes')); });

      await waitFor(() => {
        expect(screen.getByText(/走势复盘结果|日K查询结果/)).toBeInTheDocument();
      }, { timeout: 5000 });

      const chartLabel = screen.getByTestId('chart-data-label');
      expect(chartLabel).toHaveTextContent('Mock演示数据');

      // RiskWarning 也应显示 Mock 模式文案
      const riskNote = screen.getByTestId('risk-data-note');
      expect(riskNote).toHaveTextContent('演示数据说明');
    });
  });
});
