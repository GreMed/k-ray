/**
 * 第十五阶段 B1：静态真实历史复盘案例 — 测试
 *
 * 覆盖 12 项要求：
 * 1. 案例行情快照字段完整
 * 2. 案例时间范围与 K 线首尾日期一致
 * 3. 节点按钮顺序为日期、节点、涨跌幅
 * 4. 事件区只有一次轻量静态案例标识
 * 5. 每条事件可以打开详情
 * 6. 详情中存在可点击的真实原文链接
 * 7. 页面不存在 example.com
 * 8. 页面不存在"Mock 演示候选"和"Mock 演示来源"
 * 9. AI 摘要只引用现有事件
 * 10. 无事件时显示真实空状态
 * 11. 无可靠申万三级数据时显示"板块数据暂缺"
 * 12. 打开案例页时 fetch 调用次数为 0
 *
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// 在 import 页面之前 mock lightweight-charts，避免 jsdom 下 canvas 报错
jest.mock('lightweight-charts', () => {
  const originalModule = jest.requireActual('lightweight-charts');
  const mockCandlestickSeries = {
    setData: jest.fn(),
    setMarkers: jest.fn(),
    applyOptions: jest.fn(),
  };
  const mockTimeScale = {
    fitContent: jest.fn(),
  };
  const mockChart = {
    addCandlestickSeries: jest.fn(() => mockCandlestickSeries),
    subscribeCrosshairMove: jest.fn(),
    subscribeClick: jest.fn(),
    unsubscribeCrosshairMove: jest.fn(),
    unsubscribeClick: jest.fn(),
    applyOptions: jest.fn(),
    timeScale: jest.fn(() => mockTimeScale),
    remove: jest.fn(),
  };
  return {
    ...originalModule,
    createChart: jest.fn(() => mockChart),
    CrosshairMode: { Normal: 0, Magnet: 1 },
  };
});

// Mock global fetch — 用于断言"不调用 fetch"
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch as unknown as typeof fetch;

// Mock next/navigation（案例页使用 useRouter）
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
  useParams: () => ({}),
}));

import CoreReplayDemoPage from '@/app/demo/core-replay/page';
import { staticCase_300750 } from '@/data/staticCase_300750';
import { validateStaticCase } from '@/utils/validateStaticCase';

describe('第十五阶段 B1：静态真实历史复盘案例', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  // ========== 1. 案例行情快照字段完整 ==========

  describe('案例行情快照字段完整', () => {
    test('案例包含所有必需元数据字段', () => {
      expect(staticCase_300750.id).toBeTruthy();
      expect(staticCase_300750.stockCode).toBe('300750');
      expect(staticCase_300750.stockName).toBe('宁德时代');
      expect(staticCase_300750.market).toBe('SZ');
      expect(staticCase_300750.caseMode).toBe('static_historical');
      expect(staticCase_300750.isRealTime).toBe(false);
      expect(staticCase_300750.isMock).toBe(false);
      expect(staticCase_300750.requestStartDate).toBeTruthy();
      expect(staticCase_300750.requestEndDate).toBeTruthy();
      expect(staticCase_300750.actualFirstDate).toBeTruthy();
      expect(staticCase_300750.actualLastDate).toBeTruthy();
      expect(staticCase_300750.snapshotGeneratedAt).toBeTruthy();
      expect(staticCase_300750.adjustment).toBe('qfq');
      expect(staticCase_300750.source).toBe('baostock');
    });

    test('K 线数据非空且每根包含完整 OHLCV', () => {
      expect(staticCase_300750.klines.length).toBeGreaterThan(0);
      staticCase_300750.klines.forEach((k) => {
        expect(k.date).toBeTruthy();
        expect(typeof k.open).toBe('number');
        expect(typeof k.high).toBe('number');
        expect(typeof k.low).toBe('number');
        expect(typeof k.close).toBe('number');
        expect(typeof k.volume).toBe('number');
        expect(k.changePercent).toBeDefined();
      });
    });

    test('节点列表非空且每个节点包含必需字段', () => {
      expect(staticCase_300750.nodes.length).toBeGreaterThan(0);
      staticCase_300750.nodes.forEach((node) => {
        expect(node.id).toBeTruthy();
        expect(node.date).toBeTruthy();
        expect(typeof node.close).toBe('number');
        expect(typeof node.changePercent).toBe('number');
        expect(typeof node.volume).toBe('number');
        expect(node.nodeType).toBeTruthy();
        expect(node.nodeTypeLabel).toBeTruthy();
        expect(node.marketFact).toBeTruthy();
        expect(Array.isArray(node.materials)).toBe(true);
        expect(node.swLevel3).toBeDefined();
      });
    });

    test('来源清单非空且每条包含完整字段', () => {
      expect(staticCase_300750.sourceList.length).toBeGreaterThan(0);
      staticCase_300750.sourceList.forEach((src) => {
        expect(src.id).toBeTruthy();
        expect(src.title).toBeTruthy();
        expect(src.sourceName).toBeTruthy();
        expect(src.sourceUrl).toMatch(/^https?:\/\//);
        expect(src.publishedAt).toBeTruthy();
        expect(src.collectedAt).toBeTruthy();
        expect(Array.isArray(src.usedForNodeIds)).toBe(true);
      });
    });
  });

  // ========== 2. 案例时间范围与 K 线首尾日期一致 ==========

  describe('案例时间范围与 K 线首尾日期一致', () => {
    test('actualFirstDate 等于第一根 K 线日期', () => {
      const firstKlineDate = staticCase_300750.klines[0].date;
      expect(staticCase_300750.actualFirstDate).toBe(firstKlineDate);
    });

    test('actualLastDate 等于最后一根 K 线日期', () => {
      const lastKlineDate = staticCase_300750.klines[staticCase_300750.klines.length - 1].date;
      expect(staticCase_300750.actualLastDate).toBe(lastKlineDate);
    });

    test('K 线日期升序且不重复', () => {
      const dates = staticCase_300750.klines.map((k) => k.date);
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i] > dates[i - 1]).toBe(true);
      }
      const uniqueDates = new Set(dates);
      expect(uniqueDates.size).toBe(dates.length);
    });
  });

  // ========== 3. 节点按钮顺序为日期、节点、涨跌幅 ==========

  describe('节点按钮顺序', () => {
    test('每个节点按钮文本按"日期 · 节点类型 · 涨跌幅"顺序排列', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      staticCase_300750.nodes.forEach((node) => {
        const tab = screen.getByTestId(`node-tab-${node.id}`);
        const text = tab.textContent || '';

        // 验证顺序：日期 在 节点类型 之前，节点类型 在 涨跌幅 之前
        const dateIdx = text.indexOf(node.date);
        const typeIdx = text.indexOf(node.nodeTypeLabel);
        const changeStr = `${node.changePercent > 0 ? '+' : ''}${node.changePercent.toFixed(2)}%`;
        const changeIdx = text.indexOf(changeStr);

        expect(dateIdx).toBeGreaterThanOrEqual(0);
        expect(typeIdx).toBeGreaterThanOrEqual(0);
        expect(changeIdx).toBeGreaterThanOrEqual(0);
        expect(dateIdx).toBeLessThan(typeIdx);
        expect(typeIdx).toBeLessThan(changeIdx);
      });
    });
  });

  // ========== 4. 事件区只有一次轻量静态案例标识 ==========

  describe('静态案例标识', () => {
    test('事件候选卡片区域恰好有一个静态案例标识', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      const candidatesCard = screen.getByTestId('candidates-card');
      const staticLabels = candidatesCard.querySelectorAll('[data-testid="candidates-static-label"]');
      expect(staticLabels).toHaveLength(1);
      expect(staticLabels[0].textContent).toContain('静态历史案例');
      expect(staticLabels[0].textContent).toContain('非实时更新');
    });

    test('页面顶部存在静态案例标识', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      const banner = screen.getByTestId('static-banner');
      expect(banner.textContent).toContain('静态历史案例');
      expect(banner.textContent).toContain('非实时更新');
    });
  });

  // ========== 5. 每条事件可以打开详情 ==========

  describe('事件详情展开', () => {
    test('默认显示摘要和"查看详情"按钮', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      // 默认选中第一个节点（有 3 条资料）
      const firstNode = staticCase_300750.nodes[0];
      firstNode.materials.forEach((mat) => {
        const toggle = screen.getByTestId(`material-toggle-${mat.id}`);
        expect(toggle).toBeInTheDocument();
        expect(toggle.textContent).toBe('查看详情');
      });
    });

    test('点击"查看详情"后展开详情区域', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      const firstMaterial = staticCase_300750.nodes[0].materials[0];

      // 点击前详情区域不存在
      expect(screen.queryByTestId(`material-detail-${firstMaterial.id}`)).not.toBeInTheDocument();

      // 点击"查看详情"
      await act(async () => {
        fireEvent.click(screen.getByTestId(`material-toggle-${firstMaterial.id}`));
      });

      // 详情区域出现
      expect(screen.getByTestId(`material-detail-${firstMaterial.id}`)).toBeInTheDocument();

      // 按钮文本变为"收起详情"
      expect(screen.getByTestId(`material-toggle-${firstMaterial.id}`).textContent).toBe('收起详情');
    });

    test('再次点击收起详情', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      const firstMaterial = staticCase_300750.nodes[0].materials[0];

      // 展开
      await act(async () => {
        fireEvent.click(screen.getByTestId(`material-toggle-${firstMaterial.id}`));
      });
      expect(screen.getByTestId(`material-detail-${firstMaterial.id}`)).toBeInTheDocument();

      // 收起
      await act(async () => {
        fireEvent.click(screen.getByTestId(`material-toggle-${firstMaterial.id}`));
      });
      expect(screen.queryByTestId(`material-detail-${firstMaterial.id}`)).not.toBeInTheDocument();
    });
  });

  // ========== 6. 详情中存在可点击的真实原文链接 ==========

  describe('真实原文链接', () => {
    test('展开详情后存在"查看原文"链接', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      const firstMaterial = staticCase_300750.nodes[0].materials[0];

      await act(async () => {
        fireEvent.click(screen.getByTestId(`material-toggle-${firstMaterial.id}`));
      });

      const link = screen.getByTestId(`material-source-link-${firstMaterial.id}`);
      expect(link).toBeInTheDocument();
      expect(link.textContent).toContain('查看原文');
      expect(link.getAttribute('href')).toBe(firstMaterial.sourceUrl);
    });

    test('原文链接使用 http/https 协议', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      const firstMaterial = staticCase_300750.nodes[0].materials[0];

      await act(async () => {
        fireEvent.click(screen.getByTestId(`material-toggle-${firstMaterial.id}`));
      });

      const link = screen.getByTestId(`material-source-link-${firstMaterial.id}`);
      const href = link.getAttribute('href') || '';
      expect(href).toMatch(/^https?:\/\//);
    });

    test('原文链接配置安全属性 target=_blank 和 rel=noopener noreferrer', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      const firstMaterial = staticCase_300750.nodes[0].materials[0];

      await act(async () => {
        fireEvent.click(screen.getByTestId(`material-toggle-${firstMaterial.id}`));
      });

      const link = screen.getByTestId(`material-source-link-${firstMaterial.id}`);
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    });

    test('来源清单中每条也有可点击的真实链接', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      const sourceListCard = screen.getByTestId('source-list-card');
      const links = sourceListCard.querySelectorAll('a');
      expect(links.length).toBeGreaterThan(0);
      links.forEach((link) => {
        const href = link.getAttribute('href') || '';
        expect(href).toMatch(/^https?:\/\//);
      });
    });
  });

  // ========== 7. 页面不存在 example.com ==========

  describe('无 example.com', () => {
    test('页面文本不包含 example.com', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      const pageText = screen.getByTestId('core-replay-demo-page').textContent || '';
      expect(pageText).not.toContain('example.com');
    });

    test('所有链接 href 不包含 example.com', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      // 展开所有资料详情
      const firstNode = staticCase_300750.nodes[0];
      for (const mat of firstNode.materials) {
        await act(async () => {
          fireEvent.click(screen.getByTestId(`material-toggle-${mat.id}`));
        });
      }

      const links = screen.getByTestId('core-replay-demo-page').querySelectorAll('a[href]');
      links.forEach((link) => {
        const href = link.getAttribute('href') || '';
        expect(href).not.toContain('example.com');
      });
    });

    test('数据文件中所有 URL 不包含 example.com', () => {
      staticCase_300750.nodes.forEach((node) => {
        node.materials.forEach((mat) => {
          expect(mat.sourceUrl).not.toContain('example.com');
        });
      });
      staticCase_300750.sourceList.forEach((src) => {
        expect(src.sourceUrl).not.toContain('example.com');
      });
    });
  });

  // ========== 8. 页面不存在"Mock 演示候选"和"Mock 演示来源" ==========

  describe('无 Mock 误导文案', () => {
    test('页面不包含"Mock 演示候选"', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      const pageText = screen.getByTestId('core-replay-demo-page').textContent || '';
      expect(pageText).not.toContain('Mock 演示候选');
    });

    test('页面不包含"Mock 演示来源"', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      const pageText = screen.getByTestId('core-replay-demo-page').textContent || '';
      expect(pageText).not.toContain('Mock 演示来源');
    });

    test('页面不包含"Mock 数据"', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      const pageText = screen.getByTestId('core-replay-demo-page').textContent || '';
      expect(pageText).not.toContain('Mock 数据');
    });

    test('页面不包含"虚构新闻"', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      const pageText = screen.getByTestId('core-replay-demo-page').textContent || '';
      expect(pageText).not.toContain('虚构新闻');
    });

    test('案例数据 isMock 为 false', () => {
      expect(staticCase_300750.isMock).toBe(false);
    });

    test('案例数据 caseMode 为 static_historical', () => {
      expect(staticCase_300750.caseMode).toBe('static_historical');
    });
  });

  // ========== 9. AI 摘要只引用现有事件 ==========

  describe('AI 摘要引用一致性', () => {
    test('每个有摘要的节点引用的 candidateId 都存在于该节点的 materials 中', () => {
      staticCase_300750.nodes.forEach((node) => {
        if (node.replaySummary) {
          const materialIds = new Set(node.materials.map((m) => m.id));
          node.replaySummary.referencedCandidateIds.forEach((cid) => {
            expect(materialIds.has(cid)).toBe(true);
          });
        }
      });
    });

    test('摘要标注为非实时 AI 生成', () => {
      staticCase_300750.nodes.forEach((node) => {
        if (node.replaySummary) {
          expect(node.replaySummary.isRealTimeAI).toBe(false);
        }
      });
    });

    test('页面摘要标题为"基于公开资料预生成的复盘摘要"', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      // 默认节点（节点1）有摘要
      const aiCard = screen.getByTestId('ai-replay-card');
      expect(aiCard.textContent).toContain('基于公开资料预生成的复盘摘要');
      expect(aiCard.textContent).toContain('非实时 AI 生成');
    });

    test('摘要长度在 160~220 个中文字符之间', () => {
      staticCase_300750.nodes.forEach((node) => {
        if (node.replaySummary) {
          // 统计中文字符数
          const chineseChars = node.replaySummary.summary.match(/[\u4e00-\u9fa5]/g) || [];
          expect(chineseChars.length).toBeGreaterThanOrEqual(160);
          expect(chineseChars.length).toBeLessThanOrEqual(220);
        }
      });
    });
  });

  // ========== 10. 无事件时显示真实空状态 ==========

  describe('无事件空状态', () => {
    test('切换到无资料节点时显示空状态', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      // 节点 4（local_low:300750:2025-02-11）没有资料
      const emptyNode = staticCase_300750.nodes.find((n) => n.materials.length === 0);
      expect(emptyNode).toBeDefined();

      await act(async () => {
        fireEvent.click(screen.getByTestId(`node-tab-${emptyNode!.id}`));
      });

      expect(screen.getByTestId('empty-materials')).toBeInTheDocument();
      expect(screen.getByTestId('empty-materials').textContent).toContain('该节点暂无可追溯的时间临近资料');
    });

    test('无资料节点不生成复盘摘要', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      const emptyNode = staticCase_300750.nodes.find((n) => n.materials.length === 0);
      expect(emptyNode).toBeDefined();
      expect(emptyNode!.replaySummary).toBeNull();

      await act(async () => {
        fireEvent.click(screen.getByTestId(`node-tab-${emptyNode!.id}`));
      });

      expect(screen.getByTestId('no-replay-summary')).toBeInTheDocument();
      expect(screen.getByTestId('no-replay-summary').textContent).toContain('不生成复盘摘要');
    });
  });

  // ========== 11. 无可靠申万三级数据时显示"板块数据暂缺" ==========

  describe('申万三级数据暂缺', () => {
    test('所有节点申万三级数据均为 null', () => {
      staticCase_300750.nodes.forEach((node) => {
        expect(node.swLevel3.industryName).toBeNull();
        expect(node.swLevel3.changePercent).toBeNull();
        expect(node.swLevel3.sourceUrl).toBeNull();
      });
    });

    test('默认节点显示"板块数据暂缺"', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      expect(screen.getByTestId('sw-level3-missing')).toBeInTheDocument();
      expect(screen.getByTestId('sw-level3-missing').textContent).toContain('板块数据暂缺');
    });

    test('切换节点后仍显示"板块数据暂缺"', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      // 切换到第二个节点
      const secondNode = staticCase_300750.nodes[1];
      await act(async () => {
        fireEvent.click(screen.getByTestId(`node-tab-${secondNode.id}`));
      });

      expect(screen.getByTestId('sw-level3-missing')).toBeInTheDocument();
    });
  });

  // ========== 12. 打开案例页时 fetch 调用次数为 0 ==========

  describe('无网络请求', () => {
    test('页面渲染过程中不调用 fetch', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      expect(mockFetch).toHaveBeenCalledTimes(0);
    });

    test('切换节点不触发 fetch', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      const secondNode = staticCase_300750.nodes[1];
      await act(async () => {
        fireEvent.click(screen.getByTestId(`node-tab-${secondNode.id}`));
      });

      expect(mockFetch).toHaveBeenCalledTimes(0);
    });

    test('展开事件详情不触发 fetch', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      const firstMaterial = staticCase_300750.nodes[0].materials[0];
      await act(async () => {
        fireEvent.click(screen.getByTestId(`material-toggle-${firstMaterial.id}`));
      });

      expect(mockFetch).toHaveBeenCalledTimes(0);
    });
  });

  // ========== 额外：数据校验工具 ==========

  describe('数据校验工具 validateStaticCase', () => {
    test('静态案例数据通过全部校验', () => {
      const result = validateStaticCase(staticCase_300750);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('节点日期存在于 K 线数据中', () => {
      const klineDates = new Set(staticCase_300750.klines.map((k) => k.date));
      staticCase_300750.nodes.forEach((node) => {
        expect(klineDates.has(node.date)).toBe(true);
      });
    });

    test('节点涨跌幅与 K 线计算结果一致', () => {
      staticCase_300750.nodes.forEach((node) => {
        const kline = staticCase_300750.klines.find((k) => k.date === node.date);
        expect(kline).toBeDefined();
        expect(kline!.changePercent).toBeCloseTo(node.changePercent, 2);
      });
    });

    test('节点 close 与 K 线 close 一致', () => {
      staticCase_300750.nodes.forEach((node) => {
        const kline = staticCase_300750.klines.find((k) => k.date === node.date);
        expect(kline).toBeDefined();
        expect(kline!.close).toBe(node.close);
      });
    });

    test('每条事件资料都有真实 http/https 链接', () => {
      staticCase_300750.nodes.forEach((node) => {
        node.materials.forEach((mat) => {
          expect(mat.sourceUrl).toMatch(/^https?:\/\//);
          expect(mat.sourceUrl).not.toContain('example.com');
          expect(mat.sourceName).toBeTruthy();
          expect(mat.title).toBeTruthy();
          expect(mat.publishedAt).toBeTruthy();
        });
      });
    });
  });

  // ========== 额外：页面基本结构 ==========

  describe('页面基本结构', () => {
    test('页面标题为"静态历史复盘案例"', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      const title = screen.getByTestId('page-title');
      expect(title.textContent).toContain('静态历史复盘案例');
      expect(title.textContent).toContain('宁德时代');
      expect(title.textContent).toContain('300750');
    });

    test('页面显示案例时间范围', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      const meta = screen.getByTestId('case-meta');
      expect(meta.textContent).toContain('历史案例区间');
      expect(meta.textContent).toContain(staticCase_300750.requestStartDate);
      expect(meta.textContent).toContain(staticCase_300750.requestEndDate);
    });

    test('页面显示快照生成时间', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      const meta = screen.getByTestId('case-meta');
      expect(meta.textContent).toContain('静态快照生成于');
      expect(meta.textContent).toContain(staticCase_300750.snapshotGeneratedAt);
    });

    test('图表统计显示"可追溯资料"而非"事件 0 条"', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      const stats = screen.getByTestId('chart-stats');
      expect(stats.textContent).toContain('可追溯资料');
      expect(stats.textContent).not.toContain('事件 0 条');
    });

    test('不出现确定性因果表达"导致上涨"', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      const pageText = screen.getByTestId('core-replay-demo-page').textContent || '';
      expect(pageText).not.toContain('导致上涨');
    });

    test('不出现确定性因果表达"造成下跌"', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      const pageText = screen.getByTestId('core-replay-demo-page').textContent || '';
      expect(pageText).not.toContain('造成下跌');
    });
  });

  // ========== 13. 时间距离一致性（B1 封板修复新增） ==========

  describe('时间距离一致性', () => {
    // UTC 日期差值计算辅助函数（与 validateStaticCase 保持一致）
    function calcTimeDistance(publishedAt: string, nodeDate: string): number {
      const pubStr = publishedAt.slice(0, 10);
      const pubMs = Date.UTC(
        parseInt(pubStr.slice(0, 4), 10),
        parseInt(pubStr.slice(5, 7), 10) - 1,
        parseInt(pubStr.slice(8, 10), 10),
      );
      const nodeMs = Date.UTC(
        parseInt(nodeDate.slice(0, 4), 10),
        parseInt(nodeDate.slice(5, 7), 10) - 1,
        parseInt(nodeDate.slice(8, 10), 10),
      );
      const dayMs = 24 * 60 * 60 * 1000;
      const result = -Math.round((nodeMs - pubMs) / dayMs);
      // 归一化 -0 为 0，避免 Object.is(-0, 0) === false 导致测试失败
      return result === 0 ? 0 : result;
    }

    test('每条资料的时间距离与发布时间一致', () => {
      staticCase_300750.nodes.forEach((node) => {
        node.materials.forEach((mat) => {
          const expected = calcTimeDistance(mat.publishedAt, mat.nodeDate);
          expect(mat.timeDistanceDays).toBe(expected);
        });
      });
    });

    test('节点前资料 timeDistanceDays 为负数', () => {
      // mat-300750-node1-001: publishedAt 2024-09-24, nodeDate 2024-09-30 → -6
      const mat = staticCase_300750.nodes[0].materials[0];
      expect(mat.publishedAt < mat.nodeDate).toBe(true);
      expect(mat.timeDistanceDays).toBeLessThan(0);
    });

    test('节点同日资料 timeDistanceDays 为 0', () => {
      // mat-300750-node2-001: publishedAt 2024-10-08, nodeDate 2024-10-08 → 0
      const mat = staticCase_300750.nodes[1].materials[0];
      expect(mat.publishedAt.slice(0, 10)).toBe(mat.nodeDate);
      expect(mat.timeDistanceDays).toBe(0);
    });

    test('节点后资料 timeDistanceDays 为正数', () => {
      // mat-300750-node3-001: publishedAt 2024-10-09 14:22, nodeDate 2024-10-09 → 0（同日）
      // 查找实际为节点后发布的资料
      const allMaterials = staticCase_300750.nodes.flatMap((n) => n.materials);
      const afterNode = allMaterials.find((m) => m.publishedAt.slice(0, 10) > m.nodeDate);
      if (afterNode) {
        expect(afterNode.timeDistanceDays).toBeGreaterThan(0);
      }
      // 当前案例中所有资料均为节点前或同日，无节点后资料
      // 此测试验证逻辑正确性：如果有节点后资料，必须为正数
    });

    test('人工填写错误时校验必须失败', () => {
      // 构造一个 timeDistanceDays 错误的案例副本
      const badCase: typeof staticCase_300750 = {
        ...staticCase_300750,
        nodes: staticCase_300750.nodes.map((n, idx) =>
          idx === 0
            ? {
                ...n,
                materials: n.materials.map((m, midx) =>
                  midx === 0 ? { ...m, timeDistanceDays: 999 } : m,
                ),
              }
            : n,
        ),
      };
      const result = validateStaticCase(badCase);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.rule === 'material_time_distance_consistent')).toBe(true);
    });

    test('当前案例全部资料通过新的时间一致性校验', () => {
      const result = validateStaticCase(staticCase_300750);
      const timeIssues = result.issues.filter(
        (i) => i.rule === 'material_time_distance_consistent',
      );
      expect(timeIssues).toHaveLength(0);
    });

    test('事后发布的资料不能显示为"节点前"', () => {
      // 验证 mat-300750-node1-003 不再是 2024-10-08 的文章伪装成节点前
      const mat = staticCase_300750.nodes[0].materials.find(
        (m) => m.id === 'mat-300750-node1-003',
      );
      expect(mat).toBeDefined();
      expect(mat!.publishedAt).toBe('2024-09-24');
      expect(mat!.timeDistanceDays).toBe(-6);
      // 9月24日在9月30日之前，应为负数（节点前）
      expect(mat!.publishedAt.slice(0, 10) < mat!.nodeDate).toBe(true);
    });
  });

  // ========== 14. 空状态无来源推断（B1 封板修复新增） ==========

  describe('空状态无来源推断', () => {
    test('无资料节点不出现春节相关解释', () => {
      const emptyNode = staticCase_300750.nodes.find((n) => n.materials.length === 0);
      expect(emptyNode).toBeDefined();
      const allText = [
        ...emptyNode!.observationClues,
        ...emptyNode!.unconfirmedParts,
        emptyNode!.marketFact,
      ].join(' ');
      expect(allText).not.toContain('春节');
      expect(allText).not.toContain('交投清淡');
    });

    test('无资料节点不出现情绪相关解释', () => {
      const emptyNode = staticCase_300750.nodes.find((n) => n.materials.length === 0);
      expect(emptyNode).toBeDefined();
      const allText = [
        ...emptyNode!.observationClues,
        ...emptyNode!.unconfirmedParts,
      ].join(' ');
      expect(allText).not.toContain('市场情绪');
      expect(allText).not.toContain('情绪');
    });

    test('无资料节点不出现资金相关解释', () => {
      const emptyNode = staticCase_300750.nodes.find((n) => n.materials.length === 0);
      expect(emptyNode).toBeDefined();
      const allText = [
        ...emptyNode!.observationClues,
        ...emptyNode!.unconfirmedParts,
      ].join(' ');
      expect(allText).not.toContain('资金流向');
      expect(allText).not.toContain('资金');
    });

    test('无资料节点不出现技术调整相关解释', () => {
      const emptyNode = staticCase_300750.nodes.find((n) => n.materials.length === 0);
      expect(emptyNode).toBeDefined();
      const allText = [
        ...emptyNode!.observationClues,
        ...emptyNode!.unconfirmedParts,
      ].join(' ');
      expect(allText).not.toContain('技术性调整');
      expect(allText).not.toContain('技术调整');
    });

    test('无资料节点只保留行情事实和未找到资料说明', () => {
      const emptyNode = staticCase_300750.nodes.find((n) => n.materials.length === 0);
      expect(emptyNode).toBeDefined();
      expect(emptyNode!.observationClues).toHaveLength(1);
      expect(emptyNode!.observationClues[0]).toContain('未找到');
      expect(emptyNode!.unconfirmedParts).toContain('该节点暂无可追溯的时间临近资料');
      expect(emptyNode!.unconfirmedParts).toContain('当前不能判断涨跌原因');
    });

    test('页面空状态不渲染无来源推断', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      const emptyNode = staticCase_300750.nodes.find((n) => n.materials.length === 0);
      await act(async () => {
        fireEvent.click(screen.getByTestId(`node-tab-${emptyNode!.id}`));
      });

      const pageText = screen.getByTestId('core-replay-demo-page').textContent || '';
      expect(pageText).not.toContain('春节');
      expect(pageText).not.toContain('交投清淡');
    });
  });

  // ========== 15. 复盘摘要无确定性因果短语（B1 封板修复新增） ==========

  describe('复盘摘要无确定性因果短语', () => {
    const forbiddenPhrases = [
      '政策驱动行情的延续',
      '政策利好持续发酵',
      '市场情绪集中释放',
      '获利了结压力集中释放',
      '技术性调整是常见市场行为',
      '下跌更多受市场情绪和资金流向影响',
    ];

    test('所有摘要不包含本轮列出的确定性因果短语', () => {
      staticCase_300750.nodes.forEach((node) => {
        if (node.replaySummary) {
          forbiddenPhrases.forEach((phrase) => {
            expect(node.replaySummary!.summary).not.toContain(phrase);
          });
        }
      });
    });

    test('摘要不包含"政策驱动"', () => {
      staticCase_300750.nodes.forEach((node) => {
        if (node.replaySummary) {
          expect(node.replaySummary.summary).not.toContain('政策驱动');
        }
      });
    });

    test('摘要不包含"持续发酵"', () => {
      staticCase_300750.nodes.forEach((node) => {
        if (node.replaySummary) {
          expect(node.replaySummary.summary).not.toContain('持续发酵');
        }
      });
    });

    test('摘要不包含"情绪集中释放"', () => {
      staticCase_300750.nodes.forEach((node) => {
        if (node.replaySummary) {
          expect(node.replaySummary.summary).not.toContain('情绪集中释放');
        }
      });
    });

    test('摘要不包含"获利了结"', () => {
      staticCase_300750.nodes.forEach((node) => {
        if (node.replaySummary) {
          expect(node.replaySummary.summary).not.toContain('获利了结');
        }
      });
    });

    test('摘要不包含"技术性调整"', () => {
      staticCase_300750.nodes.forEach((node) => {
        if (node.replaySummary) {
          expect(node.replaySummary.summary).not.toContain('技术性调整');
        }
      });
    });

    test('摘要长度仍在 160~220 个中文字符之间', () => {
      staticCase_300750.nodes.forEach((node) => {
        if (node.replaySummary) {
          const chineseChars = node.replaySummary.summary.match(/[\u4e00-\u9fa5]/g) || [];
          expect(chineseChars.length).toBeGreaterThanOrEqual(160);
          expect(chineseChars.length).toBeLessThanOrEqual(220);
        }
      });
    });

    test('页面渲染后摘要不含确定性因果短语', async () => {
      await act(async () => { render(<CoreReplayDemoPage />); });

      const aiCard = screen.getByTestId('ai-replay-card');
      const text = aiCard.textContent || '';
      forbiddenPhrases.forEach((phrase) => {
        expect(text).not.toContain(phrase);
      });
    });
  });

  // ========== 16. sourceList 与 materials 一致性（B1 封板修复新增） ==========

  describe('sourceList 与 materials 一致性', () => {
    test('sourceList 中每个 URL 在 materials 中都能找到对应资料', () => {
      const materialUrls = new Set<string>();
      staticCase_300750.nodes.forEach((node) => {
        node.materials.forEach((mat) => {
          materialUrls.add(mat.sourceUrl);
        });
      });
      staticCase_300750.sourceList.forEach((src) => {
        expect(materialUrls.has(src.sourceUrl)).toBe(true);
      });
    });

    test('相同 URL 的标题在 sourceList 和 materials 中一致', () => {
      const materialByUrl = new Map<string, { title: string; sourceName: string; publishedAt: string }>();
      staticCase_300750.nodes.forEach((node) => {
        node.materials.forEach((mat) => {
          materialByUrl.set(mat.sourceUrl, {
            title: mat.title,
            sourceName: mat.sourceName,
            publishedAt: mat.publishedAt,
          });
        });
      });
      staticCase_300750.sourceList.forEach((src) => {
        const mat = materialByUrl.get(src.sourceUrl);
        expect(mat).toBeDefined();
        expect(src.title).toBe(mat!.title);
        expect(src.sourceName).toBe(mat!.sourceName);
        expect(src.publishedAt).toBe(mat!.publishedAt);
      });
    });

    test('sourceList 条目数量与去重后的 URL 数量一致', () => {
      const materialUrls = new Set<string>();
      staticCase_300750.nodes.forEach((node) => {
        node.materials.forEach((mat) => {
          materialUrls.add(mat.sourceUrl);
        });
      });
      expect(staticCase_300750.sourceList.length).toBe(materialUrls.size);
    });
  });
});
