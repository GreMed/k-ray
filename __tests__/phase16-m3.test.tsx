/**
 * K-Ray 第十六阶段 里程碑三 测试
 * 多公司静态真实复盘案例库
 *
 * 覆盖测试：
 *   1. 案例注册表完整性
 *   2. 每个案例的数据校验（K线、节点、资料、摘要、来源）
 *   3. 来源链接有效性
 *   4. 静态摘要引用校验
 *   5. 真实空状态节点
 *   6. 无实时 AI 请求
 *   7. 多案例切换
 *   8. URL 案例参数
 *   9. 非法案例参数回退
 *  10. 案例切换器渲染
 *  11. 申万三级数据为 null
 *
 * @jest-environment jsdom
 */

import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CASE_REGISTRY, CASE_LIST, getCaseByStockCode, getDefaultCase, getValidCaseCodes, DEFAULT_CASE_CODE } from '@/data/caseRegistry';
import { StaticHistoricalCase } from '@/types';

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
    timeScale: jest.fn(() => ({ fitContent: jest.fn() })),
    remove: jest.fn(),
  };
  return {
    ...originalModule,
    createChart: jest.fn(() => mockChart),
    CrosshairMode: { Normal: 0, Magnet: 1 },
  };
});

// === Mock global fetch（检测无网络请求） ===
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch as unknown as typeof fetch;

// === Mock useSearchParams ===
let mockSearchParams: URLSearchParams | null = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

// 辅助：设置 URL search params
function setSearchParams(params: Record<string, string> | null) {
  if (params === null) {
    mockSearchParams = new URLSearchParams();
  } else {
    mockSearchParams = new URLSearchParams(params);
  }
}

// 辅助：检查 URL 是否合法
function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// 辅助：检查日期格式
function isValidDate(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

// 辅助：计算两个日期之间的天数差
function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1 + 'T00:00:00');
  const d2 = new Date(date2 + 'T00:00:00');
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

describe('第十六阶段里程碑三：多公司静态真实复盘案例库', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
    setSearchParams(null);
    window.localStorage.clear();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    cleanup();
  });

  // ============================================================================
  // 1. 案例注册表完整性
  // ============================================================================

  describe('案例注册表完整性', () => {
    test('注册表包含至少 5 个案例', () => {
      const codes = getValidCaseCodes();
      expect(codes.length).toBeGreaterThanOrEqual(5);
    });

    test('注册表包含指定的 5 家公司', () => {
      const codes = getValidCaseCodes();
      expect(codes).toContain('300750');
      expect(codes).toContain('600519');
      expect(codes).toContain('603986');
      expect(codes).toContain('603236');
      expect(codes).toContain('002594');
    });

    test('CASE_LIST 与 CASE_REGISTRY 一致', () => {
      expect(CASE_LIST.length).toBe(Object.keys(CASE_REGISTRY).length);
      CASE_LIST.forEach(c => {
        expect(CASE_REGISTRY[c.stockCode]).toBeDefined();
      });
    });

    test('默认案例代码为 300750', () => {
      expect(DEFAULT_CASE_CODE).toBe('300750');
    });

    test('getDefaultCase 返回宁德时代案例', () => {
      const c = getDefaultCase();
      expect(c.stockCode).toBe('300750');
      expect(c.stockName).toBe('宁德时代');
    });

    test('getCaseByStockCode 对非法代码返回 null', () => {
      expect(getCaseByStockCode('')).toBeNull();
      expect(getCaseByStockCode('999999')).toBeNull();
      expect(getCaseByStockCode('invalid')).toBeNull();
    });

    test('getCaseByStockCode 对合法代码返回案例', () => {
      const c = getCaseByStockCode('600519');
      expect(c).not.toBeNull();
      expect(c!.stockName).toBe('贵州茅台');
    });
  });

  // ============================================================================
  // 2. 每个案例的数据校验
  // ============================================================================

  describe('每个案例的数据校验', () => {
    const caseCodes = ['300750', '600519', '603986', '603236', '002594'];

    caseCodes.forEach(code => {
      describe(`案例 ${code}`, () => {
        let caseData: StaticHistoricalCase;

        beforeAll(() => {
          caseData = CASE_REGISTRY[code];
        });

        test('基本信息完整', () => {
          expect(caseData.stockCode).toBe(code);
          expect(caseData.stockName).toBeTruthy();
          expect(caseData.market).toMatch(/^(SH|SZ)$/);
          expect(caseData.caseMode).toBe('static_historical');
          expect(caseData.isRealTime).toBe(false);
          expect(caseData.isMock).toBe(false);
          expect(caseData.adjustment).toBe('qfq');
          expect(caseData.source).toBe('baostock');
        });

        test('日期格式正确', () => {
          expect(isValidDate(caseData.requestStartDate)).toBe(true);
          expect(isValidDate(caseData.requestEndDate)).toBe(true);
          expect(isValidDate(caseData.actualFirstDate)).toBe(true);
          expect(isValidDate(caseData.actualLastDate)).toBe(true);
          expect(isValidDate(caseData.snapshotGeneratedAt)).toBe(true);
        });

        test('K 线数据非空', () => {
          expect(caseData.klines.length).toBeGreaterThan(0);
        });

        test('K 线按日期升序', () => {
          for (let i = 1; i < caseData.klines.length; i++) {
            expect(caseData.klines[i].date > caseData.klines[i - 1].date).toBe(true);
          }
        });

        test('K 线日期在案例区间内', () => {
          caseData.klines.forEach(k => {
            expect(k.date >= caseData.actualFirstDate).toBe(true);
            expect(k.date <= caseData.actualLastDate).toBe(true);
          });
        });

        test('K 线 OHLCV 值合法', () => {
          caseData.klines.forEach(k => {
            expect(k.open).toBeGreaterThan(0);
            expect(k.high).toBeGreaterThanOrEqual(k.open);
            expect(k.high).toBeGreaterThanOrEqual(k.close);
            expect(k.low).toBeLessThanOrEqual(k.open);
            expect(k.low).toBeLessThanOrEqual(k.close);
            expect(k.close).toBeGreaterThan(0);
            expect(k.volume).toBeGreaterThanOrEqual(0);
          });
        });

        test('节点数量在 3-10 之间', () => {
          expect(caseData.nodes.length).toBeGreaterThanOrEqual(3);
          expect(caseData.nodes.length).toBeLessThanOrEqual(10);
        });

        test('节点日期在 K 线数据中存在', () => {
          const klineDates = new Set(caseData.klines.map(k => k.date));
          caseData.nodes.forEach(n => {
            expect(klineDates.has(n.date)).toBe(true);
          });
        });

        test('节点 OHLCV 与对应 K 线一致', () => {
          const klineMap = new Map(caseData.klines.map(k => [k.date, k]));
          caseData.nodes.forEach(n => {
            const k = klineMap.get(n.date);
            expect(k).toBeDefined();
            expect(n.close).toBe(k!.close);
            expect(n.volume).toBe(k!.volume);
          });
        });

        test('至少有一个空状态节点（materials 为空）', () => {
          const emptyNodes = caseData.nodes.filter(n => n.materials.length === 0);
          expect(emptyNodes.length).toBeGreaterThanOrEqual(1);
        });

        test('空状态节点 replaySummary 为 null', () => {
          caseData.nodes.forEach(n => {
            if (n.materials.length === 0) {
              expect(n.replaySummary).toBeNull();
            }
          });
        });

        test('有资料的节点至少 2 个', () => {
          const nodesWithMaterials = caseData.nodes.filter(n => n.materials.length > 0);
          expect(nodesWithMaterials.length).toBeGreaterThanOrEqual(2);
        });

        test('所有资料包含必填字段', () => {
          caseData.nodes.forEach(n => {
            n.materials.forEach(m => {
              expect(m.id).toBeTruthy();
              expect(m.title).toBeTruthy();
              expect(m.publishedAt).toBeTruthy();
              expect(m.sourceName).toBeTruthy();
              expect(m.sourceUrl).toBeTruthy();
              expect(m.collectedAt).toBeTruthy();
              expect(m.stockCode).toBe(code);
              expect(m.nodeDate).toBe(n.date);
              expect(typeof m.timeDistanceDays).toBe('number');
              expect(m.materialType).toBeTruthy();
              expect(m.materialTypeLabel).toBeTruthy();
              expect(m.excerpt).toBeTruthy();
              expect(m.relevanceNote).toBeTruthy();
            });
          });
        });

        test('所有资料链接为合法 http/https URL', () => {
          caseData.nodes.forEach(n => {
            n.materials.forEach(m => {
              expect(isValidUrl(m.sourceUrl)).toBe(true);
              expect(m.sourceUrl.startsWith('http://') || m.sourceUrl.startsWith('https://')).toBe(true);
            });
          });
        });

        test('资料链接不使用 example.com', () => {
          caseData.nodes.forEach(n => {
            n.materials.forEach(m => {
              expect(m.sourceUrl).not.toContain('example.com');
            });
          });
        });

        test('资料 timeDistanceDays 与日期一致', () => {
          caseData.nodes.forEach(n => {
            n.materials.forEach(m => {
              const publishedDate = m.publishedAt.split(' ')[0]; // 取日期部分
              const expected = daysBetween(n.date, publishedDate);
              expect(m.timeDistanceDays).toBe(expected);
            });
          });
        });

        test('有资料节点的 replaySummary 非空', () => {
          caseData.nodes.forEach(n => {
            if (n.materials.length > 0) {
              expect(n.replaySummary).not.toBeNull();
              expect(n.replaySummary!.summary.length).toBeGreaterThanOrEqual(100);
              expect(n.replaySummary!.summary.length).toBeLessThanOrEqual(300);
              expect(n.replaySummary!.isRealTimeAI).toBe(false);
              expect(n.replaySummary!.generatedAt).toBeTruthy();
            }
          });
        });

        test('replaySummary 引用的 candidateId 真实存在', () => {
          caseData.nodes.forEach(n => {
            if (n.replaySummary) {
              const materialIds = new Set(n.materials.map(m => m.id));
              n.replaySummary.referencedCandidateIds.forEach(refId => {
                expect(materialIds.has(refId)).toBe(true);
              });
            }
          });
        });

        test('replaySummary 不包含确定性因果表述', () => {
          const causalPhrases = ['导致', '造成', '引发', '使得股价', '是上涨的原因', '是下跌的原因'];
          caseData.nodes.forEach(n => {
            if (n.replaySummary) {
              causalPhrases.forEach(phrase => {
                // 允许在"不构成确定性因果关系"等否定句中出现
                const summary = n.replaySummary!.summary;
                const idx = summary.indexOf(phrase);
                if (idx >= 0) {
                  const context = summary.substring(Math.max(0, idx - 10), idx + phrase.length + 10);
                  expect(context).toContain('不');
                }
              });
            }
          });
        });

        test('来源清单非空', () => {
          expect(caseData.sourceList.length).toBeGreaterThan(0);
        });

        test('来源清单条目完整', () => {
          caseData.sourceList.forEach(s => {
            expect(s.id).toBeTruthy();
            expect(s.title).toBeTruthy();
            expect(s.sourceName).toBeTruthy();
            expect(s.sourceUrl).toBeTruthy();
            expect(isValidUrl(s.sourceUrl)).toBe(true);
            expect(s.publishedAt).toBeTruthy();
            expect(s.collectedAt).toBeTruthy();
            expect(Array.isArray(s.usedForNodeIds)).toBe(true);
          });
        });

        test('申万三级数据全部为 null', () => {
          caseData.nodes.forEach(n => {
            expect(n.swLevel3.industryName).toBeNull();
            expect(n.swLevel3.indexCode).toBeNull();
            expect(n.swLevel3.changePercent).toBeNull();
            expect(n.swLevel3.sourceUrl).toBeNull();
            expect(n.swLevel3.collectedAt).toBeNull();
          });
        });

        // 封板修复：成交量换算检查（volume/1000000 = 万手，保留两位小数）
        test('marketFact 中成交量描述与 volume 字段一致', () => {
          caseData.nodes.forEach(n => {
            const expectedWanShou = (n.volume / 1000000).toFixed(2);
            // marketFact 中应包含正确的万手数值
            expect(n.marketFact).toContain(expectedWanShou);
            // 不得出现"XXX 万手"整数描述（除非与计算结果一致）
            // 不得出现"XXX 万股"误标为手
          });
        });

        // 封板修复：来源名称与链接域名一致性
        test('来源名称与链接域名一致', () => {
          caseData.nodes.forEach(n => {
            n.materials.forEach(m => {
              const url = new URL(m.sourceUrl);
              const domain = url.hostname;
              // court.gov.cn 不能只标为"新华网"
              if (domain.includes('court.gov.cn')) {
                expect(m.sourceName).toContain('最高人民法院');
              }
              // sina.com.cn 应标为"新浪财经"或类似
              if (domain.includes('sina.com.cn')) {
                expect(m.sourceName).toContain('新浪');
              }
              // eastmoney.com 应标为"东方财富"或类似
              if (domain.includes('eastmoney.com')) {
                expect(m.sourceName).toContain('东方财富');
              }
              // scio.gov.cn 应标为"国务院新闻办公室"或类似
              if (domain.includes('scio.gov.cn')) {
                expect(m.sourceName).toContain('国务院新闻办公室');
              }
            });
          });
        });

        // 第十八阶段可信度收口：每个案例至少有一条"可直接关联目标股票"的真实资料
        // 规则：materialType 为 company/industry，或资料标题、摘要明确包含目标公司名称/股票代码
        // 且来源链接真实存在、可追溯。300750 同日大宗交易资料明确提到"宁德时代"，可作为直接相关市场资料
        test('至少有一条可直接关联目标股票的真实资料', () => {
          const stockName = caseData.stockName;
          const stockCode = caseData.stockCode;
          const directlyRelatedMaterials = caseData.nodes.flatMap(n =>
            n.materials.filter(m => {
              const isCompanyOrIndustry = m.materialType === 'company' || m.materialType === 'industry';
              const mentionsTarget =
                (m.title && m.title.includes(stockName)) ||
                (m.title && m.title.includes(stockCode)) ||
                (m.excerpt && m.excerpt.includes(stockName)) ||
                (m.excerpt && m.excerpt.includes(stockCode));
              const hasValidSource = !!m.sourceUrl && isValidUrl(m.sourceUrl);
              return (isCompanyOrIndustry || mentionsTarget) && hasValidSource;
            })
          );
          expect(directlyRelatedMaterials.length).toBeGreaterThanOrEqual(1);
        });

        // 第十八阶段可信度收口：宏观政策资料必须标注"市场层面政策，非公司专属事件"
        test('宏观政策资料标注为市场层面非公司专属事件', () => {
          caseData.nodes.forEach(n => {
            n.materials.filter(m => m.materialType === 'policy').forEach(m => {
              expect(m.relevanceNote).toContain('此为市场层面政策，非公司专属事件。');
            });
          });
        });

        // 封板修复：referencedCandidateIds 引用真实存在的 material
        test('replaySummary 引用的 candidateId 全部存在于该节点 materials 中', () => {
          caseData.nodes.forEach(n => {
            if (n.replaySummary) {
              const materialIds = new Set(n.materials.map(m => m.id));
              n.replaySummary.referencedCandidateIds.forEach(refId => {
                expect(materialIds.has(refId)).toBe(true);
              });
            }
          });
        });
      });
    });
  });

  // ============================================================================
  // 3. 页面渲染测试
  // ============================================================================

  describe('页面渲染测试', () => {
    test('案例切换器渲染所有案例', async () => {
      const CoreReplayDemoPage = (await import('@/app/demo/core-replay/page')).default;
      setSearchParams({});

      await act(async () => { render(<CoreReplayDemoPage />); });

      await waitFor(() => {
        expect(screen.getByTestId('case-switcher')).toBeInTheDocument();
      });

      // 检查所有案例 tab
      ['300750', '600519', '603986', '603236', '002594'].forEach(code => {
        expect(screen.getByTestId(`case-tab-${code}`)).toBeInTheDocument();
      });
    });

    test('默认显示宁德时代案例', async () => {
      const CoreReplayDemoPage = (await import('@/app/demo/core-replay/page')).default;
      setSearchParams({});

      await act(async () => { render(<CoreReplayDemoPage />); });

      await waitFor(() => {
        expect(screen.getByTestId('page-title')).toHaveTextContent('宁德时代');
      });
    });

    test('URL 参数切换到贵州茅台', async () => {
      const CoreReplayDemoPage = (await import('@/app/demo/core-replay/page')).default;
      setSearchParams({ stock: '600519' });

      await act(async () => { render(<CoreReplayDemoPage />); });

      await waitFor(() => {
        expect(screen.getByTestId('page-title')).toHaveTextContent('贵州茅台');
        expect(screen.getByTestId('page-title')).toHaveTextContent('600519');
      });
    });

    test('URL 参数切换到比亚迪', async () => {
      const CoreReplayDemoPage = (await import('@/app/demo/core-replay/page')).default;
      setSearchParams({ stock: '002594' });

      await act(async () => { render(<CoreReplayDemoPage />); });

      await waitFor(() => {
        expect(screen.getByTestId('page-title')).toHaveTextContent('比亚迪');
      });
    });

    test('非法案例参数显示警告并回退到默认', async () => {
      const CoreReplayDemoPage = (await import('@/app/demo/core-replay/page')).default;
      setSearchParams({ stock: '999999' });

      await act(async () => { render(<CoreReplayDemoPage />); });

      await waitFor(() => {
        expect(screen.getByTestId('invalid-case-warning')).toBeInTheDocument();
        expect(screen.getByTestId('page-title')).toHaveTextContent('宁德时代');
      });
    });

    test('案例切换器中当前案例高亮', async () => {
      const CoreReplayDemoPage = (await import('@/app/demo/core-replay/page')).default;
      setSearchParams({ stock: '603986' });

      await act(async () => { render(<CoreReplayDemoPage />); });

      await waitFor(() => {
        const activeTab = screen.getByTestId('case-tab-603986');
        expect(activeTab.className).toContain('border-blue');
      });
    });
  });

  // ============================================================================
  // 4. 无网络请求测试
  // ============================================================================

  describe('无网络请求', () => {
    test('页面渲染期间不发起任何 fetch 请求', async () => {
      const CoreReplayDemoPage = (await import('@/app/demo/core-replay/page')).default;
      setSearchParams({});

      await act(async () => {
        render(<CoreReplayDemoPage />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('core-replay-demo-page')).toBeInTheDocument();
      });

      // 静态案例页不应发起任何网络请求
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // 5. 案例数据一致性
  // ============================================================================

  describe('案例数据一致性', () => {
    test('所有案例的快照生成日期一致', () => {
      const dates = CASE_LIST.map(c => c.snapshotGeneratedAt);
      const uniqueDates = new Set(dates);
      expect(uniqueDates.size).toBe(1);
    });

    test('所有案例的请求区间一致（除 300750 外）', () => {
      // 300750 是第十五阶段 B1 的案例，区间不同
      const newCases = CASE_LIST.filter(c => c.stockCode !== '300750');
      const startDates = new Set(newCases.map(c => c.requestStartDate));
      const endDates = new Set(newCases.map(c => c.requestEndDate));
      expect(startDates.size).toBe(1);
      expect(endDates.size).toBe(1);
    });

    test('每个案例 K 线数量 > 100', () => {
      CASE_LIST.forEach(c => {
        expect(c.klineCount).toBeGreaterThan(100);
      });
    });

    test('每个案例节点数量 >= 3', () => {
      CASE_LIST.forEach(c => {
        expect(c.nodeCount).toBeGreaterThanOrEqual(3);
      });
    });

    test('每个案例来源数量 > 0', () => {
      CASE_LIST.forEach(c => {
        expect(c.sourceCount).toBeGreaterThan(0);
      });
    });
  });
});
