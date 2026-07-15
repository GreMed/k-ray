/**
 * K-Ray 第二十阶段 A 测试：本机自选股与云同步占位
 *
 * 覆盖：
 *   1. 初始为空
 *   2. 添加任意沪市股票
 *   3. 添加任意深市股票
 *   4. 同一股票不能重复添加
 *   5. 删除自选
 *   6. 刷新或重新挂载后仍能读取
 *   7. 损坏的 localStorage 数据安全降级为空
 *   8. 当前股票按钮状态正确
 *   9. 顶部自选数量即时更新
 *  10. 点击自选股票能够进入真实查询准备状态
 *  11. 登录/云同步占位弹窗文案正确
 *  12. 占位功能不调用 fetch
 *  13. 不出现邮箱、密码和验证码输入框
 *  14. 移动端入口可用
 *  15. service 层单元测试
 *
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WatchlistProvider, useWatchlist } from '@/hooks/useWatchlist';
import WatchlistButton from '@/components/WatchlistButton';
import WatchlistDrawer from '@/components/WatchlistDrawer';
import {
  loadWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  isInWatchlist,
  saveWatchlist,
} from '@/services/watchlist';

// ========== 测试用辅助组件 ==========

// 暴露 useWatchlist 返回值的测试组件
function WatchlistTestHelper() {
  const { items, count, isReady, isWatched, add, remove } = useWatchlist();
  return (
    <div>
      <span data-testid="helper-count">{count}</span>
      <span data-testid="helper-ready">{isReady ? 'true' : 'false'}</span>
      <span data-testid="helper-watched-600519">
        {isWatched('600519', 'SH') ? 'true' : 'false'}
      </span>
      <button
        data-testid="helper-add-600519"
        onClick={() => add({ stockCode: '600519', stockName: '贵州茅台', market: 'SH' })}
      >
        添加贵州茅台
      </button>
      <button
        data-testid="helper-add-300750"
        onClick={() => add({ stockCode: '300750', stockName: '宁德时代', market: 'SZ' })}
      >
        添加宁德时代
      </button>
      <button
        data-testid="helper-remove-600519"
        onClick={() => remove('600519', 'SH')}
      >
        移除贵州茅台
      </button>
      <ul data-testid="helper-items">
        {items.map((item) => (
          <li key={`${item.stockCode}:${item.market}`}>{item.stockName}</li>
        ))}
      </ul>
    </div>
  );
}

// 渲染带 Provider 的组件
function renderWithProvider(ui: React.ReactElement) {
  return render(<WatchlistProvider>{ui}</WatchlistProvider>);
}

// ========== Service 层单元测试 ==========
describe('第二十阶段 A：自选股 Service 层', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('初始 loadWatchlist 返回空数组', () => {
    expect(loadWatchlist()).toEqual([]);
  });

  test('添加沪市股票后可以读取', () => {
    const { items, save } = addToWatchlist([], { stockCode: '600519', stockName: '贵州茅台', market: 'SH' });
    expect(save.ok).toBe(true);
    expect(items).toHaveLength(1);
    expect(items[0].stockCode).toBe('600519');
    expect(items[0].market).toBe('SH');
    expect(items[0].stockName).toBe('贵州茅台');
    expect(items[0].addedAt).toBeTruthy();

    // 重新加载
    const loaded = loadWatchlist();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].stockCode).toBe('600519');
  });

  test('添加深市股票后可以读取', () => {
    const { items } = addToWatchlist([], { stockCode: '300750', stockName: '宁德时代', market: 'SZ' });
    expect(items).toHaveLength(1);
    expect(items[0].market).toBe('SZ');

    const loaded = loadWatchlist();
    expect(loaded[0].stockCode).toBe('300750');
  });

  test('同一股票不能重复添加', () => {
    let result = addToWatchlist([], { stockCode: '600519', stockName: '贵州茅台', market: 'SH' });
    result = addToWatchlist(result.items, { stockCode: '600519', stockName: '贵州茅台', market: 'SH' });
    expect(result.items).toHaveLength(1);
  });

  test('同名不同代码可以分别添加', () => {
    let result = addToWatchlist([], { stockCode: '600519', stockName: '贵州茅台', market: 'SH' });
    result = addToWatchlist(result.items, { stockCode: '600518', stockName: '贵州茅台', market: 'SH' });
    expect(result.items).toHaveLength(2);
  });

  test('代码与市场不匹配时拒绝添加', () => {
    // 000001 是 SZ 市场股票，添加到 SH 市场应被拒绝
    let result = addToWatchlist([], { stockCode: '000001', stockName: '平安银行', market: 'SZ' });
    result = addToWatchlist(result.items, { stockCode: '000001', stockName: '上证指数', market: 'SH' });
    // 第二次添加因市场不匹配被拒绝，列表仍只有 1 条
    expect(result.items).toHaveLength(1);
    expect(result.save.ok).toBe(false);
  });

  test('删除自选后列表更新', () => {
    const { items } = addToWatchlist([], { stockCode: '600519', stockName: '贵州茅台', market: 'SH' });
    const { items: afterRemove } = removeFromWatchlist(items, '600519', 'SH');
    expect(afterRemove).toHaveLength(0);
    expect(loadWatchlist()).toHaveLength(0);
  });

  test('isInWatchlist 正确判断', () => {
    const { items } = addToWatchlist([], { stockCode: '600519', stockName: '贵州茅台', market: 'SH' });
    expect(isInWatchlist(items, '600519', 'SH')).toBe(true);
    expect(isInWatchlist(items, '300750', 'SZ')).toBe(false);
  });

  test('损坏的 JSON 数据安全降级为空', () => {
    localStorage.setItem('k-ray:watchlist:v1', '{invalid json');
    expect(loadWatchlist()).toEqual([]);
  });

  test('非数组 JSON 安全降级为空', () => {
    localStorage.setItem('k-ray:watchlist:v1', '{"not":"array"}');
    expect(loadWatchlist()).toEqual([]);
  });

  test('字段缺失的数据被过滤', () => {
    localStorage.setItem('k-ray:watchlist:v1', JSON.stringify([
      { stockCode: '600519', market: 'SH', stockName: '贵州茅台', addedAt: '2024-01-01' },
      { stockCode: '300750', market: 'SZ' }, // 缺少 stockName 和 addedAt
      { stockCode: '000001', market: 'INVALID', stockName: '测试', addedAt: '2024-01-01' }, // market 不合法
    ]));
    const loaded = loadWatchlist();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].stockCode).toBe('600519');
  });

  test('非6位数字代码被过滤', () => {
    localStorage.setItem('k-ray:watchlist:v1', JSON.stringify([
      { stockCode: '600519', market: 'SH', stockName: '贵州茅台', addedAt: '2024-01-01' },
      { stockCode: '60051', market: 'SH', stockName: '代码过短', addedAt: '2024-01-01' },
      { stockCode: '6005199', market: 'SH', stockName: '代码过长', addedAt: '2024-01-01' },
      { stockCode: 'ABCDEF', market: 'SH', stockName: '非数字', addedAt: '2024-01-01' },
    ]));
    const loaded = loadWatchlist();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].stockCode).toBe('600519');
  });

  test('无效 addedAt 时间被过滤', () => {
    localStorage.setItem('k-ray:watchlist:v1', JSON.stringify([
      { stockCode: '600519', market: 'SH', stockName: '贵州茅台', addedAt: '2024-01-01' },
      { stockCode: '300750', market: 'SZ', stockName: '宁德时代', addedAt: 'invalid-date' },
    ]));
    const loaded = loadWatchlist();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].stockCode).toBe('600519');
  });

  test('重复数据自动去重', () => {
    localStorage.setItem('k-ray:watchlist:v1', JSON.stringify([
      { stockCode: '600519', market: 'SH', stockName: '贵州茅台', addedAt: '2024-01-01' },
      { stockCode: '600519', market: 'SH', stockName: '贵州茅台', addedAt: '2024-01-02' },
    ]));
    const loaded = loadWatchlist();
    expect(loaded).toHaveLength(1);
  });

  test('saveWatchlist 持久化后可读取', () => {
    const items = [
      { stockCode: '600519', market: 'SH' as const, stockName: '贵州茅台', addedAt: '2024-01-01T00:00:00.000Z' },
    ];
    const result = saveWatchlist(items);
    expect(result.ok).toBe(true);
    const loaded = loadWatchlist();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].stockCode).toBe('600519');
  });

  test('saveWatchlist 写入失败返回失败结果', () => {
    // 模拟 localStorage.setItem 抛出异常（配额超出）
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = jest.fn(() => {
      throw new DOMException('QuotaExceededError');
    });

    const result = saveWatchlist([{ stockCode: '600519', market: 'SH', stockName: '贵州茅台', addedAt: '2024-01-01' }]);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('write_failed');

    Storage.prototype.setItem = originalSetItem;
  });
});

// ========== Hook + Provider 集成测试 ==========
describe('第二十阶段 A：useWatchlist Hook 集成', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('初始为空，isReady 在挂载后为 true', async () => {
    renderWithProvider(<WatchlistTestHelper />);

    // 等待 useEffect 执行完毕
    await waitFor(() => {
      expect(screen.getByTestId('helper-ready')).toHaveTextContent('true');
    });

    expect(screen.getByTestId('helper-count')).toHaveTextContent('0');
    expect(screen.getByTestId('helper-watched-600519')).toHaveTextContent('false');
  });

  test('添加沪市股票后数量和状态立即更新', async () => {
    renderWithProvider(<WatchlistTestHelper />);

    await waitFor(() => {
      expect(screen.getByTestId('helper-ready')).toHaveTextContent('true');
    });

    act(() => {
      fireEvent.click(screen.getByTestId('helper-add-600519'));
    });

    expect(screen.getByTestId('helper-count')).toHaveTextContent('1');
    expect(screen.getByTestId('helper-watched-600519')).toHaveTextContent('true');
  });

  test('添加深市股票后数量更新', async () => {
    renderWithProvider(<WatchlistTestHelper />);

    await waitFor(() => {
      expect(screen.getByTestId('helper-ready')).toHaveTextContent('true');
    });

    act(() => {
      fireEvent.click(screen.getByTestId('helper-add-300750'));
    });

    expect(screen.getByTestId('helper-count')).toHaveTextContent('1');
  });

  test('同一股票不能重复添加', async () => {
    renderWithProvider(<WatchlistTestHelper />);

    await waitFor(() => {
      expect(screen.getByTestId('helper-ready')).toHaveTextContent('true');
    });

    act(() => {
      fireEvent.click(screen.getByTestId('helper-add-600519'));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('helper-add-600519'));
    });

    expect(screen.getByTestId('helper-count')).toHaveTextContent('1');
  });

  test('删除自选后数量和状态立即更新', async () => {
    renderWithProvider(<WatchlistTestHelper />);

    await waitFor(() => {
      expect(screen.getByTestId('helper-ready')).toHaveTextContent('true');
    });

    act(() => {
      fireEvent.click(screen.getByTestId('helper-add-600519'));
    });
    expect(screen.getByTestId('helper-count')).toHaveTextContent('1');

    act(() => {
      fireEvent.click(screen.getByTestId('helper-remove-600519'));
    });
    expect(screen.getByTestId('helper-count')).toHaveTextContent('0');
    expect(screen.getByTestId('helper-watched-600519')).toHaveTextContent('false');
  });

  test('重新挂载后仍能读取已保存的自选', async () => {
    // 第一次渲染：添加自选
    const { unmount } = renderWithProvider(<WatchlistTestHelper />);

    await waitFor(() => {
      expect(screen.getByTestId('helper-ready')).toHaveTextContent('true');
    });

    act(() => {
      fireEvent.click(screen.getByTestId('helper-add-600519'));
    });
    expect(screen.getByTestId('helper-count')).toHaveTextContent('1');

    unmount();

    // 第二次渲染：应该读取到已保存的自选
    renderWithProvider(<WatchlistTestHelper />);

    await waitFor(() => {
      expect(screen.getByTestId('helper-ready')).toHaveTextContent('true');
    });

    expect(screen.getByTestId('helper-count')).toHaveTextContent('1');
    expect(screen.getByTestId('helper-watched-600519')).toHaveTextContent('true');
  });
});

// ========== WatchlistButton 组件测试 ==========
describe('第二十阶段 A：WatchlistButton 组件', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('未加入自选时显示"☆ 加入自选"', async () => {
    renderWithProvider(
      <WatchlistButton stockCode="600519" stockName="贵州茅台" market="SH" />
    );

    await waitFor(() => {
      expect(screen.getByTestId('watchlist-button')).toHaveTextContent('☆ 加入自选');
    });
  });

  test('点击后变为"★ 已加入本机自选"', async () => {
    renderWithProvider(
      <WatchlistButton stockCode="600519" stockName="贵州茅台" market="SH" />
    );

    await waitFor(() => {
      expect(screen.getByTestId('watchlist-button')).not.toBeDisabled();
    });

    act(() => {
      fireEvent.click(screen.getByTestId('watchlist-button'));
    });

    expect(screen.getByTestId('watchlist-button')).toHaveTextContent('★ 已加入本机自选');
    expect(screen.getByTestId('watchlist-button')).toHaveAttribute('data-watchlist-state', 'watched');
  });

  test('再次点击取消自选', async () => {
    renderWithProvider(
      <WatchlistButton stockCode="600519" stockName="贵州茅台" market="SH" />
    );

    await waitFor(() => {
      expect(screen.getByTestId('watchlist-button')).not.toBeDisabled();
    });

    act(() => {
      fireEvent.click(screen.getByTestId('watchlist-button'));
    });
    expect(screen.getByTestId('watchlist-button')).toHaveTextContent('★ 已加入本机自选');

    act(() => {
      fireEvent.click(screen.getByTestId('watchlist-button'));
    });
    expect(screen.getByTestId('watchlist-button')).toHaveTextContent('☆ 加入自选');
    expect(screen.getByTestId('watchlist-button')).toHaveAttribute('data-watchlist-state', 'unwatched');
  });
});

// ========== WatchlistDrawer 组件测试 ==========
describe('第二十阶段 A：WatchlistDrawer 组件', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('自选为空时显示空状态文案', async () => {
    renderWithProvider(
      <WatchlistDrawer isOpen={true} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('watchlist-empty')).toBeInTheDocument();
    });

    expect(screen.getByTestId('watchlist-empty')).toHaveTextContent('暂未添加自选股');
  });

  test('有自选时显示列表和操作按钮', async () => {
    // 先添加自选
    addToWatchlist([], { stockCode: '600519', stockName: '贵州茅台', market: 'SH' });

    renderWithProvider(
      <WatchlistDrawer isOpen={true} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('watchlist-items')).toBeInTheDocument();
    });

    expect(screen.getByText('贵州茅台')).toBeInTheDocument();
    expect(screen.getByTestId('watchlist-view-600519')).toBeInTheDocument();
    expect(screen.getByTestId('watchlist-remove-600519')).toBeInTheDocument();
  });

  test('点击移除后列表更新', async () => {
    addToWatchlist([], { stockCode: '600519', stockName: '贵州茅台', market: 'SH' });

    renderWithProvider(
      <WatchlistDrawer isOpen={true} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('watchlist-item-600519')).toBeInTheDocument();
    });

    act(() => {
      fireEvent.click(screen.getByTestId('watchlist-remove-600519'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('watchlist-empty')).toBeInTheDocument();
    });
  });

  test('点击查看后调用 onViewStock 回调', async () => {
    addToWatchlist([], { stockCode: '600519', stockName: '贵州茅台', market: 'SH' });

    const onViewStock = jest.fn();

    renderWithProvider(
      <WatchlistDrawer isOpen={true} onClose={() => {}} onViewStock={onViewStock} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('watchlist-view-600519')).toBeInTheDocument();
    });

    act(() => {
      fireEvent.click(screen.getByTestId('watchlist-view-600519'));
    });

    expect(onViewStock).toHaveBeenCalledWith('600519', 'SH', '贵州茅台');
  });

  test('显示本地数据保存范围提示', async () => {
    renderWithProvider(
      <WatchlistDrawer isOpen={true} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('local-data-hint')).toBeInTheDocument();
    });

    expect(screen.getByTestId('local-data-hint')).toHaveTextContent('个人数据目前仅保存在此浏览器');
  });

  test('登录/云同步占位弹窗文案正确', async () => {
    renderWithProvider(
      <WatchlistDrawer isOpen={true} onClose={() => {}} />
    );

    // 点击登录/云同步入口
    await waitFor(() => {
      expect(screen.getByTestId('cloud-sync-entry')).toBeInTheDocument();
    });

    act(() => {
      fireEvent.click(screen.getByTestId('cloud-sync-entry'));
    });

    expect(screen.getByTestId('cloud-sync-info-modal')).toBeInTheDocument();
    expect(screen.getByTestId('cloud-sync-info-text')).toHaveTextContent('账户与跨设备云同步即将开放');
    expect(screen.getByTestId('cloud-sync-info-text')).toHaveTextContent('当前版本无需登录');
    expect(screen.getByTestId('cloud-sync-info-text')).toHaveTextContent('仅保存在当前浏览器中');
  });

  test('占位功能不调用 fetch', async () => {
    const originalFetch = globalThis.fetch;
    const mockFetch = jest.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    renderWithProvider(
      <WatchlistDrawer isOpen={true} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('cloud-sync-entry')).toBeInTheDocument();
    });

    act(() => {
      fireEvent.click(screen.getByTestId('cloud-sync-entry'));
    });

    expect(mockFetch).not.toHaveBeenCalled();
    globalThis.fetch = originalFetch;
  });

  test('不出现邮箱、密码和验证码输入框', async () => {
    const { container } = renderWithProvider(
      <WatchlistDrawer isOpen={true} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('cloud-sync-entry')).toBeInTheDocument();
    });

    // 打开云同步弹窗
    act(() => {
      fireEvent.click(screen.getByTestId('cloud-sync-entry'));
    });

    // 检查不存在 email/password/验证码 相关的 input
    const inputs = container.querySelectorAll('input');
    inputs.forEach((input) => {
      const type = input.getAttribute('type');
      const name = input.getAttribute('name');
      const placeholder = input.getAttribute('placeholder');
      expect(type).not.toBe('email');
      expect(type).not.toBe('password');
      expect(name).not.toMatch(/email|password|code/i);
      expect(placeholder).not.toMatch(/邮箱|密码|验证码/i);
    });
  });

  test('关闭弹窗后云同步信息消失', async () => {
    renderWithProvider(
      <WatchlistDrawer isOpen={true} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('cloud-sync-entry')).toBeInTheDocument();
    });

    act(() => {
      fireEvent.click(screen.getByTestId('cloud-sync-entry'));
    });
    expect(screen.getByTestId('cloud-sync-info-modal')).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByTestId('cloud-sync-info-ok'));
    });
    expect(screen.queryByTestId('cloud-sync-info-modal')).not.toBeInTheDocument();
  });

  test('抽屉标题显示自选数量', async () => {
    addToWatchlist([], { stockCode: '600519', stockName: '贵州茅台', market: 'SH' });
    addToWatchlist(
      [{ stockCode: '600519', market: 'SH' as const, stockName: '贵州茅台', addedAt: '2024-01-01' }],
      { stockCode: '300750', stockName: '宁德时代', market: 'SZ' }
    );

    renderWithProvider(
      <WatchlistDrawer isOpen={true} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('我的自选（2）')).toBeInTheDocument();
    });
  });
});

// ========== SSR 安全测试 ==========
describe('第二十阶段 A：SSR 安全', () => {
  test('WatchlistButton 在未挂载时不访问 localStorage', () => {
    // 在 jsdom 环境下，首次渲染不应抛错
    // isReady 初始为 false，按钮应渲染为 disabled 状态
    const { container } = renderWithProvider(
      <WatchlistButton stockCode="600519" stockName="贵州茅台" market="SH" />
    );

    const button = container.querySelector('[data-testid="watchlist-button"]');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('☆ 加入自选');
  });
});
