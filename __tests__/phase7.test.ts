/**
 * K-Ray 第七阶段测试 - 真实公司公告数据可行性验证
 * 验证参数校验、字段转换、分类规则、模式行为、错误脱敏、缓存隔离等
 *
 * @jest-environment node
 */

import {
  fetchAnnouncements,
  getAnnouncementMode,
  buildCacheKey,
  clearCache,
  _cacheSize,
  classifyAnnouncement,
  mockProvider,
  cninfoProvider,
} from '@/services/announcements';
import { SanitizedError } from '@/services/announcements/types';
import type { AnnouncementQuery } from '@/services/announcements/types';

// Mock fetch for cninfoProvider
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function makeQuery(overrides: Partial<AnnouncementQuery> = {}): AnnouncementQuery {
  return {
    stockCode: '600519',
    market: 'SH',
    startDate: '2024-01-01',
    endDate: '2024-03-31',
    ...overrides,
  };
}

function makeCnInfoSuccess(announcements: Array<Record<string, unknown>>) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      totalAnnouncement: announcements.length,
      totalRecordNum: announcements.length,
      hasMore: false,
      announcements,
    }),
    json: async () => ({
      totalAnnouncement: announcements.length,
      totalRecordNum: announcements.length,
      hasMore: false,
      announcements,
    }),
  };
}

function makeCnInfoRawAnnouncement(
  idx: number,
  title: string,
  time: string,
  secCode = '600519',
  announcementId?: string,
  adjunctUrl?: string,
  pageUrl?: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    announcementTitle: title,
    announcementTime: time,
    adjunctUrl: adjunctUrl !== undefined ? adjunctUrl : `/finalpage/2024-01-0${idx}/1200000${idx}.PDF`,
    adjunctType: 'PDF',
    pageUrl: pageUrl !== undefined ? pageUrl : '',
    secCode,
    secName: '贵州茅台',
    column: 'sse',
  };
  // 只在 announcementId 明确传入且非空时设置
  if (announcementId !== undefined && announcementId !== '') {
    result.announcementId = announcementId;
  } else if (announcementId === undefined) {
    result.announcementId = `cninfo-id-${idx}`;
  }
  // announcementId === '' 时不设置该字段，模拟来源缺失ID
  return result;
}

describe('第七阶段测试 - 真实公司公告数据可行性验证', () => {
  let originalMode: string | undefined;
  let originalContact: string | undefined;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    originalMode = process.env.ANNOUNCEMENT_DATA_MODE;
    originalContact = process.env.ANNOUNCEMENT_CONTACT_EMAIL;
    process.env.ANNOUNCEMENT_DATA_MODE = 'mock';
    delete process.env.ANNOUNCEMENT_CONTACT_EMAIL;
    jest.clearAllMocks();
    mockFetch.mockClear();
    clearCache();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalMode !== undefined) {
      process.env.ANNOUNCEMENT_DATA_MODE = originalMode;
    } else {
      delete process.env.ANNOUNCEMENT_DATA_MODE;
    }
    if (originalContact !== undefined) {
      process.env.ANNOUNCEMENT_CONTACT_EMAIL = originalContact;
    } else {
      delete process.env.ANNOUNCEMENT_CONTACT_EMAIL;
    }
    clearCache();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  // ========== 1. 参数校验 ==========

  describe('参数校验', () => {
    test('stockCode 必须为6位数字 - API路由层校验', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'mock';

      await import('@/app/api/announcements/route').then(async (mod) => {
        const req = new Request(
          'http://localhost/api/announcements?stockCode=abc&market=SH&startDate=2024-01-01&endDate=2024-03-31'
        );
        const res = await mod.GET(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toContain('6位数字');
      });
    });

    test('market 只允许 SH/SZ', async () => {
      await import('@/app/api/announcements/route').then(async (mod) => {
        const req = new Request(
          'http://localhost/api/announcements?stockCode=600519&market=XX&startDate=2024-01-01&endDate=2024-03-31'
        );
        const res = await mod.GET(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toContain('SH');
        expect(data.error).toContain('SZ');
      });
    });

    test('日期必须为 YYYY-MM-DD', async () => {
      await import('@/app/api/announcements/route').then(async (mod) => {
        const req = new Request(
          'http://localhost/api/announcements?stockCode=600519&market=SH&startDate=2024/01/01&endDate=2024-03-31'
        );
        const res = await mod.GET(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toContain('YYYY-MM-DD');
      });
    });

    test('开始日期不能晚于结束日期', async () => {
      await import('@/app/api/announcements/route').then(async (mod) => {
        const req = new Request(
          'http://localhost/api/announcements?stockCode=600519&market=SH&startDate=2024-03-31&endDate=2024-01-01'
        );
        const res = await mod.GET(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toContain('开始日期');
      });
    });

    test('最大查询区间为1年', async () => {
      await import('@/app/api/announcements/route').then(async (mod) => {
        const req = new Request(
          'http://localhost/api/announcements?stockCode=600519&market=SH&startDate=2020-01-01&endDate=2024-03-31'
        );
        const res = await mod.GET(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toContain('1年');
      });
    });
  });

  // ========== 2. 600519与000001查询参数正确 ==========

  describe('查询参数', () => {
    test('600519.SH 查询参数正确传递', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      mockFetch.mockResolvedValue(makeCnInfoSuccess([]));

      await cninfoProvider.fetchAnnouncements(makeQuery({ stockCode: '600519', market: 'SH' }));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toBe('https://www.cninfo.com.cn/new/hisAnnouncement/query');
      const body = callArgs[1].body as string;
      expect(body).toContain('stock=');
      expect(body).toContain('600519');
      expect(body).toContain('sh');
      expect(body).toContain('column=sse');
      expect(body).toContain('plate=sh');
      expect(body).toContain('seDate=');
      expect(body).toContain('2024-01-01');
      expect(body).toContain('2024-03-31');
    });

    test('000001.SZ 查询参数正确传递', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      mockFetch.mockResolvedValue(makeCnInfoSuccess([]));

      await cninfoProvider.fetchAnnouncements(makeQuery({ stockCode: '000001', market: 'SZ' }));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      const body = callArgs[1].body as string;
      expect(body).toContain('stock=');
      expect(body).toContain('000001');
      expect(body).toContain('sz');
      expect(body).toContain('column=szse');
      expect(body).toContain('plate=sz');
    });
  });

  // ========== 3. 公告字段转换 ==========

  describe('公告字段转换', () => {
    test('巨潮原始数据正确转换为 AnnouncementItem', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      const rawAnnouncements = [
        makeCnInfoRawAnnouncement(1, '贵州茅台2023年度业绩预告', '2024-01-08 16:30:00', '600519', undefined, undefined, 'https://www.cninfo.com.cn/new/disclosure/detail?stockCode=600519&announcementId=12345'),
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      expect(result.announcements).toHaveLength(1);
      const item = result.announcements[0];
      expect(item.announcementId).toMatch(/^cninfo:sh:600519:/);
      expect(item.stockCode).toBe('600519');
      expect(item.market).toBe('SH');
      expect(item.title).toBe('贵州茅台2023年度业绩预告');
      expect(item.publishedAt).toBe('2024-01-08 16:30:00');
      expect(item.sourcePlatform).toBe('巨潮资讯网');
      expect(item.sourcePageUrl).toBeDefined();
      expect(item.sourcePageUrl).toContain('https://www.cninfo.com.cn');
      expect(item.sourcePageUrl).not.toContain('orgId=');
      expect(item.originalPdfUrl).toBeDefined();
      expect(item.originalPdfUrl).toContain('https://static.cninfo.com.cn');
      expect(item.category).toBe('earnings');
      expect(item.isRealAnnouncement).toBe(true);
      expect(item.rawPublishedAt).toBe('2024-01-08 16:30:00');
      expect(item.alignedTradingDate).toBeNull();
      expect(item.fetchedAt).toBeDefined();
      expect(result.meta.verificationStatus).toBe('verified');
    });
  });

  // ========== 4. 公告ID稳定，不使用数组index ==========

  describe('稳定公告ID', () => {
    test('公告ID基于来源ID，不使用数组index', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      const rawAnnouncements = [
        makeCnInfoRawAnnouncement(1, '公告A', '2024-01-08 16:30:00', '600519', 'src-id-001'),
        makeCnInfoRawAnnouncement(2, '公告B', '2024-01-15 16:30:00', '600519', 'src-id-002'),
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      result.announcements.forEach(item => {
        expect(item.announcementId).toMatch(/^cninfo:sh:600519:src-id-/);
        expect(item.announcementId).not.toMatch(/idx-/);
        expect(item.announcementId).not.toMatch(/:0$/);
        expect(item.announcementId).not.toMatch(/:1$/);
      });
    });

    test('来源ID缺失时使用PDF路径中的稳定标识', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      const rawAnnouncements = [
        makeCnInfoRawAnnouncement(1, '公告A', '2024-01-08 16:30:00', '600519', '', '/finalpage/2024-01-08/12000001.PDF'),
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      expect(result.announcements).toHaveLength(1);
      expect(result.announcements[0].announcementId).toContain('pdf:');
      expect(result.announcements[0].announcementId).toContain('12000001');
    });

    test('来源ID缺失但PDF路径存在时使用稳定哈希（PDF路径无法提取标识时）', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      const rawAnnouncements = [
        {
          announcementTitle: '无ID公告',
          announcementTime: '2024-01-08 16:30:00',
          // adjunctUrl 存在但格式无法提取稳定标识（无文件名部分）
          adjunctUrl: '/',
          secCode: '600519',
          column: 'sse',
        },
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      expect(result.announcements).toHaveLength(1);
      expect(result.announcements[0].announcementId).toContain('hash:');
    });

    test('稳定字段不足时丢弃该条', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      const rawAnnouncements = [
        {
          announcementTitle: '无时间无PDF公告',
          secCode: '600519',
          column: 'sse',
        },
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      expect(result.announcements).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  // ========== 5. 按发布时间排序 ==========

  describe('排序', () => {
    test('按发布时间倒序排列', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      const rawAnnouncements = [
        makeCnInfoRawAnnouncement(1, '早公告', '2024-01-08 16:30:00', '600519', 'id-1'),
        makeCnInfoRawAnnouncement(2, '晚公告', '2024-03-15 16:30:00', '600519', 'id-2'),
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      expect(result.announcements[0].publishedAt).toBe('2024-03-15 16:30:00');
      expect(result.announcements[1].publishedAt).toBe('2024-01-08 16:30:00');
    });
  });

  // ========== 6. 去重 ==========

  describe('去重', () => {
    test('相同announcementId的公告去重', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      const dup = makeCnInfoRawAnnouncement(1, '重复公告', '2024-01-08 16:30:00', '600519', 'dup-id');
      mockFetch.mockResolvedValue(makeCnInfoSuccess([dup, dup, dup]));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      expect(result.announcements).toHaveLength(1);
    });
  });

  // ========== 7. 分类规则 ==========

  describe('分类规则', () => {
    test('earnings: 业绩、年报、季报、业绩预告', () => {
      expect(classifyAnnouncement('贵州茅台2023年度业绩预告')).toBe('earnings');
      expect(classifyAnnouncement('2023年年度报告')).toBe('earnings');
      expect(classifyAnnouncement('2024年第一季度报告')).toBe('earnings');
      expect(classifyAnnouncement('2023年半年度报告')).toBe('earnings');
      expect(classifyAnnouncement('业绩快报')).toBe('earnings');
    });

    test('dividend: 分红、派息', () => {
      expect(classifyAnnouncement('关于2023年度利润分配预案的公告')).toBe('dividend');
      expect(classifyAnnouncement('分红派息实施公告')).toBe('dividend');
      expect(classifyAnnouncement('送股转增公告')).toBe('dividend');
    });

    test('capital: 回购、增减持、重组、定增', () => {
      expect(classifyAnnouncement('关于回购股份的进展公告')).toBe('capital');
      expect(classifyAnnouncement('股东增持股份公告')).toBe('capital');
      expect(classifyAnnouncement('重大资产重组进展公告')).toBe('capital');
      expect(classifyAnnouncement('非公开发行A股股票预案')).toBe('capital');
      expect(classifyAnnouncement('股权激励计划草案')).toBe('capital');
    });

    test('operation: 合同、项目、中标、经营数据', () => {
      expect(classifyAnnouncement('关于公司主要经营数据的公告')).toBe('operation');
      expect(classifyAnnouncement('重大合同中标公告')).toBe('operation');
      expect(classifyAnnouncement('项目投产公告')).toBe('operation');
      expect(classifyAnnouncement('战略合作框架协议')).toBe('operation');
    });

    test('regulatory: 问询、处罚、风险警示、诉讼', () => {
      expect(classifyAnnouncement('关于收到上海证券交易所监管工作函的公告')).toBe('regulatory');
      expect(classifyAnnouncement('行政处罚决定书公告')).toBe('regulatory');
      expect(classifyAnnouncement('风险提示公告')).toBe('regulatory');
      expect(classifyAnnouncement('关于诉讼事项的公告')).toBe('regulatory');
    });

    test('suspension: 停牌、复牌', () => {
      expect(classifyAnnouncement('关于公司股票停牌的公告')).toBe('suspension');
      expect(classifyAnnouncement('复牌公告')).toBe('suspension');
    });

    test('other: 其他类型', () => {
      expect(classifyAnnouncement('公司章程修订公告')).toBe('other');
      expect(classifyAnnouncement('更换保荐机构公告')).toBe('other');
    });
  });

  // ========== 8. 超时 ==========

  describe('超时', () => {
    test('请求超时返回脱敏错误', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      mockFetch.mockImplementation(() => new Promise((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), 200);
      }));

      try {
        await cninfoProvider.fetchAnnouncements(makeQuery());
        fail('应抛出错误');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        expect(msg).toContain('超时');
        expect(msg).not.toContain('timeout');
        expect(e).toBeInstanceOf(SanitizedError);
      }
    });
  });

  // ========== 9. 错误脱敏 ==========

  describe('错误脱敏', () => {
    test('不返回本地路径或内部堆栈', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error at /secret/path',
      });

      try {
        await cninfoProvider.fetchAnnouncements(makeQuery());
        fail('应抛出错误');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        expect(msg).not.toContain('/secret/');
        expect(msg).not.toContain('Internal Server Error');
        expect(msg).not.toContain('Error:');
      }
    });

    test('403 forbidden 返回访问受限提示', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      });

      try {
        await cninfoProvider.fetchAnnouncements(makeQuery());
        fail('应抛出错误');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        expect(msg).toContain('访问受限');
        expect(e).toBeInstanceOf(SanitizedError);
      }
    });

    test('不暴露 cookie 或第三方原始响应', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Set-Cookie: sessionid=abc123; path=/',
      });

      try {
        await cninfoProvider.fetchAnnouncements(makeQuery());
        fail('应抛出错误');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        expect(msg).not.toContain('sessionid');
        expect(msg).not.toContain('Set-Cookie');
        expect(msg).not.toContain('abc123');
      }
    });
  });

  // ========== 10. 缓存 ==========

  describe('缓存', () => {
    test('相同查询第二次命中缓存，不重复调用', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      mockFetch.mockResolvedValue(makeCnInfoSuccess([
        makeCnInfoRawAnnouncement(1, '测试公告', '2024-01-08 16:30:00', '600519', 'id-1'),
      ]));

      await fetchAnnouncements(makeQuery());
      const result2 = await fetchAnnouncements(makeQuery());

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result2.announcements).toHaveLength(1);
    });

    test('不同股票代码不共用缓存', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      mockFetch
        .mockResolvedValueOnce(makeCnInfoSuccess([makeCnInfoRawAnnouncement(1, '600519公告', '2024-01-08 16:30:00', '600519', 'id-1')]))
        .mockResolvedValueOnce(makeCnInfoSuccess([makeCnInfoRawAnnouncement(2, '000001公告', '2024-01-08 16:30:00', '000001', 'id-2')]));

      await fetchAnnouncements(makeQuery({ stockCode: '600519', market: 'SH' }));
      await fetchAnnouncements(makeQuery({ stockCode: '000001', market: 'SZ' }));

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(_cacheSize()).toBe(2);
    });

    test('不同日期不共用缓存', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      mockFetch
        .mockResolvedValueOnce(makeCnInfoSuccess([makeCnInfoRawAnnouncement(1, '1月公告', '2024-01-08 16:30:00', '600519', 'id-1')]))
        .mockResolvedValueOnce(makeCnInfoSuccess([makeCnInfoRawAnnouncement(2, '3月公告', '2024-03-15 16:30:00', '600519', 'id-2')]));

      await fetchAnnouncements(makeQuery({ startDate: '2024-01-01', endDate: '2024-01-31' }));
      await fetchAnnouncements(makeQuery({ startDate: '2024-03-01', endDate: '2024-03-31' }));

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test('缓存key包含market、stockCode、startDate、endDate', () => {
      const key = buildCacheKey(makeQuery());
      const parts = key.split('|');
      expect(parts).toContain('SH');
      expect(parts).toContain('600519');
      expect(parts).toContain('2024-01-01');
      expect(parts).toContain('2024-03-31');
    });
  });

  // ========== 11. mock/real/fallback 三种模式 ==========

  describe('三种模式行为', () => {
    test('mock 模式不调用 fetch', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'mock';

      const result = await fetchAnnouncements(makeQuery());

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.meta.source).toBe('mock');
      expect(result.meta.isRealAnnouncement).toBe(false);
    });

    test('real 模式失败不降级，直接抛出错误', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'error',
      });

      await expect(fetchAnnouncements(makeQuery())).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('fallback 模式降级到 Mock', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'fallback';
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'error',
      });

      const result = await fetchAnnouncements(makeQuery());

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.meta.source).toBe('mock');
      expect(result.meta.fallbackReason).toBeDefined();
      expect(result.meta.fallbackReason).toContain('降级');
    });

    test('getAnnouncementMode 返回正确的模式', () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'mock';
      expect(getAnnouncementMode()).toBe('mock');

      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      expect(getAnnouncementMode()).toBe('real');

      process.env.ANNOUNCEMENT_DATA_MODE = 'fallback';
      expect(getAnnouncementMode()).toBe('fallback');

      delete process.env.ANNOUNCEMENT_DATA_MODE;
      expect(getAnnouncementMode()).toBe('mock');

      process.env.ANNOUNCEMENT_DATA_MODE = 'invalid';
      expect(getAnnouncementMode()).toBe('mock');
    });
  });

  // ========== 12. real模式不静默降级 ==========

  describe('real模式不静默降级', () => {
    test('real 模式下服务失败直接返回错误', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      mockFetch.mockRejectedValue(new Error('network error'));

      try {
        await fetchAnnouncements(makeQuery());
        fail('应抛出错误');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    });
  });

  // ========== 13. fallback明确返回原因 ==========

  describe('fallback明确返回原因', () => {
    test('fallback 降级结果包含 fallbackReason', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'fallback';
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => 'service unavailable',
      });

      const result = await fetchAnnouncements(makeQuery());

      expect(result.meta.fallbackReason).toBeDefined();
      expect(result.meta.fallbackReason).toContain('巨潮资讯网');
      expect(result.meta.fallbackReason).toContain('降级');
      expect(result.meta.isRealAnnouncement).toBe(false);
    });
  });

  // ========== 14. Mock provider 数据完整性 ==========

  describe('Mock provider', () => {
    test('600519 Mock 数据包含所有必要字段', async () => {
      const result = await mockProvider.fetchAnnouncements(makeQuery());

      expect(result.announcements.length).toBeGreaterThan(0);
      result.announcements.forEach(item => {
        expect(item.announcementId).toBeDefined();
        expect(item.title).toBeDefined();
        expect(item.publishedAt).toBeDefined();
        expect(item.category).toBeDefined();
        expect(item.isRealAnnouncement).toBe(false);
      });
    });

    test('000001 Mock 数据包含所有必要字段', async () => {
      const result = await mockProvider.fetchAnnouncements(makeQuery({
        stockCode: '000001',
        market: 'SZ',
      }));

      expect(result.announcements.length).toBeGreaterThan(0);
      result.announcements.forEach(item => {
        expect(item.market).toBe('SZ');
        expect(item.stockCode).toBe('000001');
      });
    });
  });

  // ========== 15. User-Agent 设置 ==========

  describe('User-Agent', () => {
    test('请求设置了 User-Agent header', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      mockFetch.mockResolvedValue(makeCnInfoSuccess([]));

      await cninfoProvider.fetchAnnouncements(makeQuery());

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers as Record<string, string>;
      expect(headers['User-Agent']).toBeDefined();
      expect(headers['User-Agent']).toContain('K-Ray-Feasibility-Probe');
    });
  });

  // ================================================================
  // 新增：真实边界测试（10项）
  // ================================================================

  describe('真实边界测试', () => {

    // 1. 空响应不得被标记为verified真实成功
    test('1. 空响应不得被标记为verified真实成功', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      mockFetch.mockResolvedValue(makeCnInfoSuccess([]));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      expect(result.announcements).toHaveLength(0);
      expect(result.meta.verificationStatus).not.toBe('verified');
      expect(result.meta.verificationStatus).toBe('unverified');
      expect(result.meta.isRealAnnouncement).toBe(false);
    });

    // 2. unverified空响应不得写入成功缓存
    test('2. unverified空响应不得写入成功缓存', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'fallback';
      mockFetch.mockResolvedValue(makeCnInfoSuccess([]));

      await fetchAnnouncements(makeQuery());

      // unverified 不应写入缓存
      expect(_cacheSize()).toBe(0);
    });

    // 3. fallback在unverified时正确降级
    test('3. fallback在unverified时正确降级', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'fallback';
      mockFetch.mockResolvedValue(makeCnInfoSuccess([]));

      const result = await fetchAnnouncements(makeQuery());

      expect(result.meta.source).toBe('mock');
      expect(result.meta.fallbackReason).toBeDefined();
      expect(result.meta.fallbackReason).toContain('无法验证');
      expect(result.meta.isRealAnnouncement).toBe(false);
    });

    // 4. real在unverified时返回错误
    test('4. real在unverified时返回错误', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      mockFetch.mockResolvedValue(makeCnInfoSuccess([]));

      try {
        await fetchAnnouncements(makeQuery());
        fail('real模式下unverified应抛出错误');
      } catch (e) {
        expect(e).toBeInstanceOf(SanitizedError);
        expect((e as Error).message).toContain('无法验证');
      }
    });

    // 5. 缺少来源ID时不使用index
    test('5. 缺少来源ID时不使用index', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      const rawAnnouncements = [
        {
          announcementTitle: '无ID公告A',
          announcementTime: '2024-01-08 16:30:00',
          adjunctUrl: '/finalpage/2024-01-08/AAA.PDF',
          secCode: '600519',
          column: 'sse',
        },
        {
          announcementTitle: '无ID公告B',
          announcementTime: '2024-01-15 16:30:00',
          adjunctUrl: '/finalpage/2024-01-15/BBB.PDF',
          secCode: '600519',
          column: 'sse',
        },
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      expect(result.announcements).toHaveLength(2);
      result.announcements.forEach(item => {
        expect(item.announcementId).not.toMatch(/:0$/);
        expect(item.announcementId).not.toMatch(/:1$/);
        expect(item.announcementId).not.toMatch(/idx-/);
      });
    });

    // 6. 调整公告顺序后稳定ID不变化
    test('6. 调整公告顺序后稳定ID不变化', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';

      const rawA = makeCnInfoRawAnnouncement(1, '公告A', '2024-01-08 16:30:00', '600519', 'stable-id-A');
      const rawB = makeCnInfoRawAnnouncement(2, '公告B', '2024-01-15 16:30:00', '600519', 'stable-id-B');

      // 第一次：A在前，B在后
      mockFetch.mockResolvedValueOnce(makeCnInfoSuccess([rawA, rawB]));
      const result1 = await cninfoProvider.fetchAnnouncements(makeQuery());

      // 第二次：B在前，A在后
      mockFetch.mockResolvedValueOnce(makeCnInfoSuccess([rawB, rawA]));
      const result2 = await cninfoProvider.fetchAnnouncements(makeQuery());

      // ID集合应该相同（与顺序无关）
      const ids1 = result1.announcements.map(a => a.announcementId).sort();
      const ids2 = result2.announcements.map(a => a.announcementId).sort();
      expect(ids1).toEqual(ids2);
    });

    // 7. 所有真实URL必须为https
    test('7. 所有真实URL必须为https', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      const rawAnnouncements = [
        makeCnInfoRawAnnouncement(1, '测试公告', '2024-01-08 16:30:00', '600519', 'url-test-id', undefined, 'https://www.cninfo.com.cn/new/disclosure/detail?stockCode=600519&announcementId=url-test-id'),
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      const item = result.announcements[0];
      expect(item.sourcePageUrl).toMatch(/^https:\/\//);
      expect(item.originalPdfUrl).toMatch(/^https:\/\//);

      // 验证请求URL也是https
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toMatch(/^https:\/\//);

      // 验证headers中的Origin和Referer也是https
      const headers = callArgs[1].headers as Record<string, string>;
      expect(headers['Origin']).toMatch(/^https:\/\//);
      expect(headers['Referer']).toMatch(/^https:\/\//);
    });

    // 8. User-Agent不含example.com
    test('8. User-Agent不含example.com', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      mockFetch.mockResolvedValue(makeCnInfoSuccess([]));

      await cninfoProvider.fetchAnnouncements(makeQuery());

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers as Record<string, string>;
      expect(headers['User-Agent']).not.toContain('example.com');
      expect(headers['User-Agent']).not.toContain('dev@');
      expect(headers['User-Agent']).toContain('K-Ray-Feasibility-Probe');
    });

    // 9. Mock数据不包含cninfo链接
    test('9. Mock数据不包含cninfo链接', async () => {
      const result = await mockProvider.fetchAnnouncements(makeQuery());

      expect(result.announcements.length).toBeGreaterThan(0);
      result.announcements.forEach(item => {
        expect(item.sourcePlatform).toBe('Mock演示来源');
        expect(item.sourcePageUrl).not.toContain('cninfo');
        expect(item.originalPdfUrl).not.toContain('cninfo');
        expect(item.announcementId).not.toContain('cninfo');
        // Mock URL 应为空
        expect(item.sourcePageUrl).toBe('');
        expect(item.originalPdfUrl).toBe('');
      });
    });

    // 10. 生产首页不包含公告开发面板文案
    test('10. 生产首页不包含公告开发面板文案', () => {
      // 验证 page.tsx 中不包含 AnnouncementDevPanel 的 import
      // 这个测试通过静态检查确保组件已被移除
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require('path');
      const pageContent = fs.readFileSync(
        path.join(__dirname, '..', 'app', 'page.tsx'),
        'utf-8',
      );

      expect(pageContent).not.toContain('AnnouncementDevPanel');
      expect(pageContent).not.toContain('公告数据验证');
      expect(pageContent).not.toContain('公告数据独立验收面板');
    });
  });

  // ========== 验证状态枚举完整性 ==========

  describe('验证状态', () => {
    test('巨潮返回匹配股票的公告时状态为verified', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      const rawAnnouncements = [
        makeCnInfoRawAnnouncement(1, '公告A', '2024-01-08 16:30:00', '600519', 'id-1'),
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      expect(result.meta.verificationStatus).toBe('verified');
      expect(result.meta.isRealAnnouncement).toBe(true);
    });

    test('巨潮返回的公告secCode不匹配时状态为unverified', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      // 返回的公告 secCode 是 600436 而非查询的 600519
      const rawAnnouncements = [
        makeCnInfoRawAnnouncement(1, '其他公司公告', '2024-01-08 16:30:00', '600436', 'id-1'),
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      expect(result.meta.verificationStatus).toBe('unverified');
      expect(result.meta.isRealAnnouncement).toBe(false);
    });

    test('严格归属：2条目标+1条其他股票 → 整次unverified，不返回任何真实公告', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      const rawAnnouncements = [
        makeCnInfoRawAnnouncement(1, '茅台公告A', '2024-01-08 16:30:00', '600519', 'id-a'),
        makeCnInfoRawAnnouncement(2, '茅台公告B', '2024-01-15 16:30:00', '600519', 'id-b'),
        makeCnInfoRawAnnouncement(3, '其他公司公告', '2024-01-20 16:30:00', '600436', 'id-c'),
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      expect(result.meta.verificationStatus).toBe('unverified');
      expect(result.meta.isRealAnnouncement).toBe(false);
      expect(result.announcements).toHaveLength(0);
    });

    test('严格归属：全部匹配时才verified', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      const rawAnnouncements = [
        makeCnInfoRawAnnouncement(1, '茅台公告A', '2024-01-08 16:30:00', '600519', 'id-a'),
        makeCnInfoRawAnnouncement(2, '茅台公告B', '2024-01-15 16:30:00', '600519', 'id-b'),
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      expect(result.meta.verificationStatus).toBe('verified');
      expect(result.meta.isRealAnnouncement).toBe(true);
      expect(result.announcements).toHaveLength(2);
    });

    test('丢弃后空结果：原始非空但全部被丢弃 → unverified', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      // secCode 匹配但 title 为空、publishedAt 不可解析、无 announcementId 和 adjunctUrl
      const rawAnnouncements = [
        {
          announcementTitle: '',
          announcementTime: 'invalid-date',
          secCode: '600519',
          column: 'sse',
        },
        {
          announcementTitle: '无时间无PDF',
          secCode: '600519',
          column: 'sse',
        },
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      expect(result.announcements).toHaveLength(0);
      expect(result.meta.verificationStatus).toBe('unverified');
      expect(result.meta.isRealAnnouncement).toBe(false);
    });

    test('丢弃后空结果：real模式返回错误', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      const rawAnnouncements = [
        {
          announcementTitle: '无时间无PDF',
          secCode: '600519',
          column: 'sse',
        },
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      try {
        await fetchAnnouncements(makeQuery());
        fail('real模式下丢弃后空结果应抛出错误');
      } catch (e) {
        expect(e).toBeInstanceOf(SanitizedError);
        expect((e as Error).message).toContain('无法验证');
      }
    });

    test('丢弃后空结果：fallback模式降级', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'fallback';
      const rawAnnouncements = [
        {
          announcementTitle: '无时间无PDF',
          secCode: '600519',
          column: 'sse',
        },
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await fetchAnnouncements(makeQuery());

      expect(result.meta.source).toBe('mock');
      expect(result.meta.fallbackReason).toBeDefined();
      expect(result.meta.fallbackReason).toContain('无法验证');
    });

    test('丢弃后空结果：不写入缓存', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'fallback';
      const rawAnnouncements = [
        {
          announcementTitle: '无时间无PDF',
          secCode: '600519',
          column: 'sse',
        },
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      await fetchAnnouncements(makeQuery());

      expect(_cacheSize()).toBe(0);
    });

    test('最低有效字段：publishedAt不可解析时丢弃', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      const rawAnnouncements = [
        makeCnInfoRawAnnouncement(1, '公告A', 'invalid-date', '600519', 'id-1'),
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      expect(result.announcements).toHaveLength(0);
      expect(result.meta.verificationStatus).toBe('unverified');
    });

    test('最低有效字段：title为空时丢弃', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      const rawAnnouncements = [
        makeCnInfoRawAnnouncement(1, '', '2024-01-08 16:30:00', '600519', 'id-1'),
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      expect(result.announcements).toHaveLength(0);
      expect(result.meta.verificationStatus).toBe('unverified');
    });

    test('最低有效字段：无announcementId且无PDF路径时丢弃', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      const rawAnnouncements = [
        {
          announcementTitle: '有标题有时间但无ID无PDF',
          announcementTime: '2024-01-08 16:30:00',
          secCode: '600519',
          column: 'sse',
        },
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      expect(result.announcements).toHaveLength(0);
      expect(result.meta.verificationStatus).toBe('unverified');
    });

    test('不推测构造无法验证的链接：无原始announcementId时sourcePageUrl为空', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      const rawAnnouncements = [
        {
          announcementTitle: '有PDF无ID的公告',
          announcementTime: '2024-01-08 16:30:00',
          adjunctUrl: '/finalpage/2024-01-08/12000001.PDF',
          secCode: '600519',
          column: 'sse',
        },
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      expect(result.announcements).toHaveLength(1);
      expect(result.announcements[0].sourcePageUrl).toBe('');
      expect(result.announcements[0].originalPdfUrl).toMatch(/^https:\/\//);
    });

    test('禁止推测详情链接：有announcementId但无pageUrl和adjunctUrl → 丢弃', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      const rawAnnouncements = [
        {
          announcementId: 'real-id-001',
          announcementTitle: '只有ID无链接的公告',
          announcementTime: '2024-01-08 16:30:00',
          secCode: '600519',
          column: 'sse',
          // 没有 pageUrl 和 adjunctUrl
        },
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      expect(result.announcements).toHaveLength(0);
      expect(result.meta.verificationStatus).toBe('unverified');
    });

    test('禁止推测详情链接：有真实pageUrl → 保留原始链接', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      const rawAnnouncements = [
        makeCnInfoRawAnnouncement(1, '有真实pageUrl的公告', '2024-01-08 16:30:00', '600519', 'id-1', undefined, 'https://www.cninfo.com.cn/new/disclosure/detail?stockCode=600519&announcementId=99999'),
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      expect(result.announcements).toHaveLength(1);
      expect(result.announcements[0].sourcePageUrl).toBe('https://www.cninfo.com.cn/new/disclosure/detail?stockCode=600519&announcementId=99999');
      // 不再出现 orgId= 的推测链接
      expect(result.announcements[0].sourcePageUrl).not.toContain('orgId=');
    });

    test('禁止推测详情链接：非cninfo域名pageUrl → 拒绝', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      const rawAnnouncements = [
        makeCnInfoRawAnnouncement(1, '非cninfo链接的公告', '2024-01-08 16:30:00', '600519', 'id-1', undefined, 'https://evil.example.com/fake-page'),
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      // pageUrl 被拒绝，但有 adjunctUrl 所以仍然保留
      expect(result.announcements).toHaveLength(1);
      expect(result.announcements[0].sourcePageUrl).toBe('');
      expect(result.announcements[0].originalPdfUrl).toMatch(/^https:\/\//);
    });

    test('禁止推测详情链接：不再出现orgId=的推测链接', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      // 有 pageUrl 和 adjunctUrl 的完整公告
      const rawAnnouncements = [
        makeCnInfoRawAnnouncement(1, '完整公告', '2024-01-08 16:30:00', '600519', 'id-1', undefined, 'https://www.cninfo.com.cn/new/disclosure/detail?stockCode=600519&announcementId=123'),
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      expect(result.announcements).toHaveLength(1);
      // 检查所有可能的 URL 字段，不应出现 orgId=
      expect(result.announcements[0].sourcePageUrl).not.toContain('orgId=');
      if (result.announcements[0].originalPdfUrl) {
        expect(result.announcements[0].originalPdfUrl).not.toContain('orgId=');
      }
    });

    test('域名严格校验：www.cninfo.com.cn 通过', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      const rawAnnouncements = [
        makeCnInfoRawAnnouncement(1, '标准子域名公告', '2024-01-08 16:30:00', '600519', 'id-1', undefined, 'https://www.cninfo.com.cn/new/disclosure/detail?stockCode=600519&announcementId=99999'),
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      expect(result.announcements).toHaveLength(1);
      expect(result.announcements[0].sourcePageUrl).toBe('https://www.cninfo.com.cn/new/disclosure/detail?stockCode=600519&announcementId=99999');
    });

    test('域名严格校验：cninfo.com.cn 根域名通过', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      const rawAnnouncements = [
        makeCnInfoRawAnnouncement(1, '根域名公告', '2024-01-08 16:30:00', '600519', 'id-1', undefined, 'https://cninfo.com.cn/some/path'),
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      expect(result.announcements).toHaveLength(1);
      expect(result.announcements[0].sourcePageUrl).toBe('https://cninfo.com.cn/some/path');
    });

    test('域名严格校验：static.cninfo.com.cn 子域名通过', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      const rawAnnouncements = [
        makeCnInfoRawAnnouncement(1, '静态资源子域名公告', '2024-01-08 16:30:00', '600519', 'id-1', undefined, 'https://static.cninfo.com.cn/some/path'),
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      expect(result.announcements).toHaveLength(1);
      expect(result.announcements[0].sourcePageUrl).toBe('https://static.cninfo.com.cn/some/path');
    });

    test('域名严格校验：evilcninfo.com.cn 伪域名拒绝', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      const rawAnnouncements = [
        makeCnInfoRawAnnouncement(1, '伪域名公告', '2024-01-08 16:30:00', '600519', 'id-1', undefined, 'https://evilcninfo.com.cn/fake-page'),
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      // pageUrl 被拒绝，但有 adjunctUrl 所以仍然保留
      expect(result.announcements).toHaveLength(1);
      expect(result.announcements[0].sourcePageUrl).toBe('');
      expect(result.announcements[0].originalPdfUrl).toMatch(/^https:\/\//);
    });

    test('域名严格校验：cninfo.com.cn.evil.com 后缀注入拒绝', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      const rawAnnouncements = [
        makeCnInfoRawAnnouncement(1, '后缀注入公告', '2024-01-08 16:30:00', '600519', 'id-1', undefined, 'https://cninfo.com.cn.evil.com/fake-page'),
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      // pageUrl 被拒绝，但有 adjunctUrl 所以仍然保留
      expect(result.announcements).toHaveLength(1);
      expect(result.announcements[0].sourcePageUrl).toBe('');
      expect(result.announcements[0].originalPdfUrl).toMatch(/^https:\/\//);
    });

    test('PDF URL域名校验：非cninfo域名完整URL拒绝', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      const rawAnnouncements = [
        makeCnInfoRawAnnouncement(1, '非cninfo域名PDF', '2024-01-08 16:30:00', '600519', 'id-1', 'https://evil.com/fake.pdf', 'https://www.cninfo.com.cn/valid-page'),
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      // originalPdfUrl 被拒绝，但有 sourcePageUrl 所以仍然保留
      expect(result.announcements).toHaveLength(1);
      expect(result.announcements[0].sourcePageUrl).toContain('cninfo.com.cn');
      expect(result.announcements[0].originalPdfUrl).toBeUndefined();
    });

    test('PDF URL域名校验：static.cninfo.com.cn 完整URL通过', async () => {
      process.env.ANNOUNCEMENT_DATA_MODE = 'real';
      const rawAnnouncements = [
        makeCnInfoRawAnnouncement(1, '合法PDF链接', '2024-01-08 16:30:00', '600519', 'id-1', 'https://static.cninfo.com.cn/finalpage/2024-01-08/120000001.PDF', ''),
      ];
      mockFetch.mockResolvedValue(makeCnInfoSuccess(rawAnnouncements));

      const result = await cninfoProvider.fetchAnnouncements(makeQuery());

      expect(result.announcements).toHaveLength(1);
      expect(result.announcements[0].originalPdfUrl).toBe('https://static.cninfo.com.cn/finalpage/2024-01-08/120000001.PDF');
    });

    test('本地验证脚本存在且为mjs', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require('path');
      const scriptPath = path.join(__dirname, '..', 'scripts', 'verify-announcements.mjs');
      expect(fs.existsSync(scriptPath)).toBe(true);
      const content = fs.readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('/api/announcements');
      expect(content).not.toContain('require(');
      expect(content).toContain('real模式不得接受 source=mock');
    });

    test('验证脚本：real模式拒绝mock服务（退出码逻辑）', () => {
      // 验证脚本中包含 real 模式下拒绝 source=mock 的逻辑
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require('path');
      const scriptPath = path.join(__dirname, '..', 'scripts', 'verify-announcements.mjs');
      const content = fs.readFileSync(scriptPath, 'utf-8');

      // 检查关键判断逻辑存在
      expect(content).toContain("result.meta.source === 'cninfo'");
      expect(content).toContain("result.meta.isRealAnnouncement === false");
      expect(content).toContain("result.meta.verificationStatus === 'unverified'");
      expect(content).toContain("result.meta.source === 'mock'");
      expect(content).toContain('real模式不得接受 source=mock');
      expect(content).toContain('data.error.includes');
    });
  });
});
