/**
 * K-Ray 第八阶段前端测试 - 全A股日K查询 UI行为
 * 验证自定义代码输入、错误提示、数据来源信息栏等
 *
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import Home from '@/app/page';

// Mock global fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch as unknown as typeof fetch;

function makeRealKLineResponse(stockId: string, stockCode: string, market: string, stockName: string, count: number = 10) {
  const klines = [];
  const baseDate = new Date('2024-04-01');
  for (let i = 0; i < count; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i * 3);
    const dateStr = d.toISOString().slice(0, 10);
    klines.push({
      id: `baostock:${stockId}:${dateStr}`,
      stockId,
      date: dateStr,
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

describe('第八阶段前端测试 - 全A股日K查询', () => {
  let originalNodeEnv: string | undefined;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    jest.clearAllMocks();
    mockFetch.mockClear();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    consoleErrorSpy.mockRestore();
  });

  // ========== 自定义代码输入 ==========

  test('输入6位代码后显示自定义代码选项', async () => {
    await act(async () => { render(<Home />); });

    const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: '601318' } });
    });

    // 应显示自定义代码选项
    await waitFor(() => {
      expect(screen.getByTestId('custom-code-option')).toBeInTheDocument();
    });
    expect(screen.getByText('601318')).toBeInTheDocument();
    expect(screen.getByText('SH')).toBeInTheDocument();
  });

  test('输入无法识别的6位代码显示错误', async () => {
    await act(async () => { render(<Home />); });

    const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: '200000' } });
    });

    // 应显示无法识别提示
    await waitFor(() => {
      expect(screen.getByText(/无法识别代码 200000 的市场/)).toBeInTheDocument();
    });
  });

  test('按回车确认自定义代码查询', async () => {
    mockFetch.mockResolvedValue(
      makeRealKLineResponse('stock-sh-601318', '601318', 'SH', '') as unknown as Response,
    );

    await act(async () => { render(<Home />); });

    const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: '601318' } });
    });

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    // 应显示已选择状态
    expect(screen.getByText(/已选择.*601318/)).toBeInTheDocument();
  });

  // ========== 默认真实行情模式 ==========

  test('初始状态真实行情开关默认开启', async () => {
    await act(async () => { render(<Home />); });

    // 第十四阶段 A1：真实行情开关已移除，普通用户始终使用真实行情
    expect(screen.queryByTestId('real-market-toggle')).not.toBeInTheDocument();
  });

  // ========== 数据来源信息栏 ==========

  test('查询成功后显示数据来源信息栏', async () => {
    mockFetch.mockResolvedValue(
      makeRealKLineResponse('stock-sh-600519', '600519', 'SH', '贵州茅台') as unknown as Response,
    );

    await act(async () => { render(<Home />); });

    // 选择 600519
    const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: '600519' } });
    });
    const suggestion = await screen.findByText('贵州茅台', { selector: 'button span' });
    await act(async () => { fireEvent.click(suggestion); });

    // 点击查询行情
    await act(async () => {
      fireEvent.click(screen.getByText('查询行情'));
    });

    await waitFor(() => {
      expect(screen.getByText(/走势复盘结果|日K查询结果/)).toBeInTheDocument();
    }, { timeout: 5000 });

    // 验证数据来源信息栏
    const dataSourceInfo = screen.getByTestId('data-source-info');
    expect(dataSourceInfo).toBeInTheDocument();
    expect(dataSourceInfo.textContent).toMatch(/600519\.SH/);
    expect(dataSourceInfo.textContent).toMatch(/BaoStock/);
    expect(dataSourceInfo.textContent).toMatch(/日线/);
    expect(dataSourceInfo.textContent).toMatch(/前复权/);
    expect(dataSourceInfo.textContent).toMatch(/不代表投资建议/);
  });

  // ========== 错误处理 ==========

  test('BaoStock失败时显示真实行情服务不可用提示', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'BaoStock服务暂时不可用，请稍后重试' }),
    } as unknown as Response);

    await act(async () => { render(<Home />); });

    // 选择 600519
    const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: '600519' } });
    });
    const suggestion = await screen.findByText('贵州茅台', { selector: 'button span' });
    await act(async () => { fireEvent.click(suggestion); });

    await act(async () => {
      fireEvent.click(screen.getByText('查询行情'));
    });

    await waitFor(() => {
      expect(screen.getByText('真实行情服务暂时不可用')).toBeInTheDocument();
    }, { timeout: 5000 });

    expect(screen.getByText(/当前无法查询这只股票/)).toBeInTheDocument();
  });

  test('空K线数据显示空状态提示', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        stock: { id: 'stock-sh-600519', code: '600519', name: '贵州茅台', market: 'SH' },
        klines: [],
        meta: {
          source: 'baostock',
          sourceLabel: 'BaoStock真实行情(前复权日线)',
          adjustment: 'qfq',
          isRealMarketData: true,
          fetchedAt: '2024-07-01T00:00:00.000Z',
        },
      }),
    } as unknown as Response);

    await act(async () => { render(<Home />); });

    // 选择 600519
    const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: '600519' } });
    });
    const suggestion = await screen.findByText('贵州茅台', { selector: 'button span' });
    await act(async () => { fireEvent.click(suggestion); });

    await act(async () => {
      fireEvent.click(screen.getByText('查询行情'));
    });

    await waitFor(() => {
      expect(screen.getByText(/所选区间暂无交易数据/)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  // ========== 日期范围错误 ==========

  test('开始日期晚于结束日期显示错误', async () => {
    await act(async () => { render(<Home />); });

    // 选择 600519
    const input = screen.getByPlaceholderText(/输入.*6.*位.*股.*代码/) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: '600519' } });
    });
    const suggestion = await screen.findByText('贵州茅台', { selector: 'button span' });
    await act(async () => { fireEvent.click(suggestion); });

    // 切换到自定义日期
    const customBtn = screen.getByTestId('quick-option-custom');
    await act(async () => { fireEvent.click(customBtn); });

    // 设置开始日期晚于结束日期
    const dateInputs = screen.getAllByDisplayValue(/^\d{4}-\d{2}-\d{2}$/);
    if (dateInputs.length >= 2) {
      await act(async () => {
        fireEvent.change(dateInputs[0], { target: { value: '2024-06-01' } });
      });
      await act(async () => {
        fireEvent.change(dateInputs[1], { target: { value: '2024-03-01' } });
      });
    }

    // 点击查询行情
    await act(async () => {
      fireEvent.click(screen.getByText('查询行情'));
    });

    // 应显示日期错误
    await waitFor(() => {
      expect(screen.getByTestId('date-error')).toBeInTheDocument();
    });
  });

  // ========== 近1年快捷选项 ==========

  test('日期快捷选项包含近1年', async () => {
    await act(async () => { render(<Home />); });

    expect(screen.getByTestId('quick-option-1y')).toBeInTheDocument();
    expect(screen.getByText('近1年')).toBeInTheDocument();
  });

  // ========== 不影响 Mock 模式 ==========

  test('关闭真实行情后使用 Mock 模式', async () => {
    await act(async () => { render(<Home />); });

    // 第十四阶段 A1：Mock 模式通过开发面板的 dev-key-node-sample-* 按钮访问
    await act(async () => {
      fireEvent.click(screen.getByTestId('dev-key-node-sample-with-nodes'));
    });

    await waitFor(() => {
      expect(screen.getByText(/走势复盘结果|日K查询结果/)).toBeInTheDocument();
    }, { timeout: 5000 });

    // 不应调用 fetch
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
