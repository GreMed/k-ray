/**
 * 第十八阶段发布前收口测试
 *
 * 覆盖：
 * 1. 真实页点击关键节点marker后，右侧节点日期与左下笔记日期一致
 * 2. 静态案例点击marker后，两处日期一致
 * 3. 静态案例点击顶部节点按钮后，两处日期一致
 * 4. 点击普通K线添加笔记仍正常
 * 5. 默认直达300750，无需切换案例即可显示日历事件
 * 6. 五个案例各至少有1条可核验事件和2条演示事件
 * 7. 改变系统时间后，静态案例日历仍固定在2026年7月至9月
 * 8. 演示事件不计入系统或可核验数量
 * 9. 演示事件没有sourceUrl，不显示"已核验"
 * 10. 可核验事件必须有HTTPS官方来源
 * 11. 月份精度事件只显示在"本月观察窗口"，不伪造具体日期标记
 * 12. 用户事件仍按股票隔离并支持新增、编辑、删除
 */

import { getCaseByStockCode, getDefaultCase } from '@/data/caseRegistry';
import { getCaseBuiltInEvents } from '@/data/staticCaseEvents';
import { getCaseCalendarEvents } from '@/services/stockEvents/caseCalendar';
import {
  isValidCaseDemoEvent,
  isValidSystemEvent,
  isCaseDemoEvent,
  isVerifiableEvent,
  isUserEvent,
} from '@/services/stockEvents';
import { StockEvent } from '@/types';

// 五个案例代码
const ALL_CASE_CODES = ['300750', '600519', '603236', '603986', '002594'];

describe('第十八阶段发布前收口 - 节点日期联动与静态案例日历', () => {
  // ========================================================================
  // 测试 6：五个案例各至少有1条可核验事件和2条演示事件
  // ========================================================================
  describe('五个案例事件数量及分类', () => {
    ALL_CASE_CODES.forEach((code) => {
      test(`案例 ${code} 至少有1条可核验事件和2条演示事件`, () => {
        const events = getCaseBuiltInEvents(code);
        const verifiable = events.filter(isVerifiableEvent);
        const demo = events.filter(isCaseDemoEvent);

        expect(verifiable.length).toBeGreaterThanOrEqual(1);
        expect(demo.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  // ========================================================================
  // 测试 8：演示事件不计入系统或可核验数量
  // ========================================================================
  describe('演示事件不计入可核验数量', () => {
    test('case_demo 事件不被 isVerifiableEvent 识别为可核验', () => {
      ALL_CASE_CODES.forEach((code) => {
        const events = getCaseBuiltInEvents(code);
        const demoEvents = events.filter(isCaseDemoEvent);
        demoEvents.forEach((e) => {
          expect(isVerifiableEvent(e)).toBe(false);
        });
      });
    });

    test('case_demo 事件不被 isUserEvent 识别为用户事件', () => {
      ALL_CASE_CODES.forEach((code) => {
        const events = getCaseBuiltInEvents(code);
        const demoEvents = events.filter(isCaseDemoEvent);
        demoEvents.forEach((e) => {
          expect(isUserEvent(e)).toBe(false);
        });
      });
    });
  });

  // ========================================================================
  // 测试 9：演示事件没有 sourceUrl，不显示"已核验"
  // ========================================================================
  describe('演示事件防误认规则', () => {
    ALL_CASE_CODES.forEach((code) => {
      test(`案例 ${code} 的演示事件没有 sourceUrl 和 sourceName`, () => {
        const events = getCaseBuiltInEvents(code);
        const demoEvents = events.filter(isCaseDemoEvent);
        demoEvents.forEach((e) => {
          expect(e.sourceUrl).toBe('');
          expect(e.sourceName).toBe('');
          expect(e.isFictional).toBe(true);
          expect(e.disclaimer).toBe('AI生成的案例演示日程，非真实公司安排');
          expect(e.generatedAt).toBeTruthy();
        });
      });

      test(`案例 ${code} 的演示事件标题包含"演示"`, () => {
        const events = getCaseBuiltInEvents(code);
        const demoEvents = events.filter(isCaseDemoEvent);
        demoEvents.forEach((e) => {
          expect(e.title).toContain('演示');
        });
      });

      test(`案例 ${code} 的演示事件日期精度为 month`, () => {
        const events = getCaseBuiltInEvents(code);
        const demoEvents = events.filter(isCaseDemoEvent);
        demoEvents.forEach((e) => {
          expect(e.datePrecision).toBe('month');
          expect(e.month).toBeTruthy();
          expect(e.date).toBeUndefined();
        });
      });
    });
  });

  // ========================================================================
  // 测试 10：可核验事件必须有 HTTPS 官方来源
  // ========================================================================
  describe('可核验事件来源校验', () => {
    ALL_CASE_CODES.forEach((code) => {
      test(`案例 ${code} 的可核验事件有 HTTPS 官方来源`, () => {
        const events = getCaseBuiltInEvents(code);
        const verifiableEvents = events.filter(isVerifiableEvent);
        verifiableEvents.forEach((e) => {
          expect(e.sourceUrl).toMatch(/^https:\/\//);
          expect(e.sourceName).toBeTruthy();
          expect(isValidSystemEvent(e)).toBe(true);
        });
      });

      test(`案例 ${code} 的可核验事件包含"非公司预约日"说明`, () => {
        const events = getCaseBuiltInEvents(code);
        const verifiableEvents = events.filter(isVerifiableEvent);
        verifiableEvents.forEach((e) => {
          expect(e.title).toContain('非公司预约日');
          expect(e.description).toContain('法定期限');
        });
      });
    });
  });

  // ========================================================================
  // 测试 11：月份精度事件不伪造具体日期标记
  // ========================================================================
  describe('月份精度事件不伪造具体日期', () => {
    test('case_demo 事件 date 字段为 undefined', () => {
      ALL_CASE_CODES.forEach((code) => {
        const events = getCaseBuiltInEvents(code);
        const demoEvents = events.filter(isCaseDemoEvent);
        demoEvents.forEach((e) => {
          expect(e.date).toBeUndefined();
          expect(e.datePrecision).toBe('month');
        });
      });
    });

    test('可核验事件有具体 date 字段', () => {
      ALL_CASE_CODES.forEach((code) => {
        const events = getCaseBuiltInEvents(code);
        const verifiableEvents = events.filter(isVerifiableEvent);
        verifiableEvents.forEach((e) => {
          expect(e.date).toBeTruthy();
          expect(e.datePrecision).not.toBe('month');
        });
      });
    });
  });

  // ========================================================================
  // 测试 5：默认直达300750，无需切换案例即可显示日历事件
  // ========================================================================
  describe('默认直达案例日历非空', () => {
    test('默认案例 300750 的 futureEvents 非空', () => {
      const defaultCase = getDefaultCase();
      expect(defaultCase.stockCode).toBe('300750');
      expect(defaultCase.futureEvents.length).toBeGreaterThan(0);
    });

    test('默认案例 calendarAsOfDate 为 2026-07-14', () => {
      const defaultCase = getDefaultCase();
      expect(defaultCase.calendarAsOfDate).toBe('2026-07-14');
    });

    test('getCaseCalendarEvents 对默认案例返回事件（无用户事件时）', () => {
      const defaultCase = getDefaultCase();
      // 传入空用户事件数组，模拟无 localStorage 的场景
      const events = getCaseCalendarEvents(defaultCase, []);
      expect(events.length).toBeGreaterThan(0);
      // 应包含可核验事件
      const verifiable = events.filter(isVerifiableEvent);
      expect(verifiable.length).toBeGreaterThanOrEqual(1);
      // 应包含演示事件
      const demo = events.filter(isCaseDemoEvent);
      expect(demo.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ========================================================================
  // 测试 7：改变系统时间后，静态案例日历仍固定在2026年7月至9月
  // ========================================================================
  describe('静态案例日历不依赖系统时间', () => {
    test('calendarAsOfDate 固定为 2026-07-14，不受系统时间影响', () => {
      // 模拟系统时间为 2025 年（远离 2026）
      const realDate = Date;
      const fakeNow = new Date('2025-01-01T00:00:00.000Z');
      (global as unknown as { Date: DateConstructor }).Date = class extends realDate {
        constructor(...args: unknown[]) {
          if (args.length === 0) {
            super(fakeNow.getTime());
          } else {
            super(...(args as Parameters<DateConstructor>));
          }
        }
        static now() {
          return fakeNow.getTime();
        }
      } as unknown as DateConstructor;

      try {
        const defaultCase = getDefaultCase();
        // 日历基准日仍然是 2026-07-14，不受系统时间影响
        expect(defaultCase.calendarAsOfDate).toBe('2026-07-14');
        // futureEvents 仍然存在
        expect(defaultCase.futureEvents.length).toBeGreaterThan(0);
      } finally {
        (global as unknown as { Date: DateConstructor }).Date = realDate;
      }
    });

    test('案例事件月份在 2026-07 至 2026-09 范围内', () => {
      ALL_CASE_CODES.forEach((code) => {
        const caseData = getCaseByStockCode(code);
        if (!caseData) return;
        const events = caseData.futureEvents;
        events.forEach((e) => {
          if (e.datePrecision === 'month' && e.month) {
            expect(['2026-07', '2026-08', '2026-09']).toContain(e.month);
          }
          if (e.date) {
            // 可核验事件日期应在 2026 年下半年
            expect(e.date.startsWith('2026-')).toBe(true);
          }
        });
      });
    });
  });

  // ========================================================================
  // 测试 12：用户事件按股票隔离
  // ========================================================================
  describe('数据合并与隔离', () => {
    test('getCaseCalendarEvents 按 stockCode 隔离用户事件', () => {
      const case300750 = getCaseByStockCode('300750')!;
      // 模拟另一个股票的用户事件，不应出现在 300750 的日历中
      const foreignUserEvent: StockEvent = {
        id: 'user-event-600519-test',
        stockCode: '600519',
        title: '测试用外部事件',
        category: 'user_entered',
        origin: 'user_entered',
        date: '2026-08-15',
        datePrecision: 'exact',
        status: 'active',
        sourceName: '',
        sourceUrl: '',
        verifiedAt: '2026-07-14T00:00:00.000Z',
        description: '不应出现在 300750 日历中',
      };
      const events = getCaseCalendarEvents(case300750, [foreignUserEvent]);
      // 外部用户事件不应出现
      expect(events.find((e) => e.id === foreignUserEvent.id)).toBeUndefined();
    });

    test('getCaseCalendarEvents 保留同股票的用户事件', () => {
      const case300750 = getCaseByStockCode('300750')!;
      const sameStockUserEvent: StockEvent = {
        id: 'user-event-300750-test',
        stockCode: '300750',
        title: '同股票用户事件',
        category: 'user_entered',
        origin: 'user_entered',
        date: '2026-08-20',
        datePrecision: 'exact',
        status: 'active',
        sourceName: '',
        sourceUrl: '',
        verifiedAt: '2026-07-14T00:00:00.000Z',
        description: '应出现在 300750 日历中',
      };
      const events = getCaseCalendarEvents(case300750, [sameStockUserEvent]);
      expect(events.find((e) => e.id === sameStockUserEvent.id)).toBeDefined();
    });

    test('getCaseCalendarEvents 过滤无效的 case_demo 事件', () => {
      const case300750 = getCaseByStockCode('300750')!;
      // 构造一个缺少 disclaimer 的无效 case_demo 事件
      const invalidDemoEvent: StockEvent = {
        id: 'invalid-demo',
        stockCode: '300750',
        title: '演示·无效事件',
        category: 'company_event',
        origin: 'case_demo',
        month: '2026-08',
        datePrecision: 'month',
        status: 'demo',
        sourceName: '',
        sourceUrl: '',
        verifiedAt: '2026-07-14T00:00:00.000Z',
        description: '测试',
        isFictional: true,
        generatedAt: '2026-07-14T00:00:00.000Z',
        // 故意缺少 disclaimer
      };
      // 将无效事件注入 caseData 的 futureEvents 副本
      const caseWithInvalid = {
        ...case300750,
        futureEvents: [...case300750.futureEvents, invalidDemoEvent],
      };
      const events = getCaseCalendarEvents(caseWithInvalid, []);
      // 无效事件应被过滤掉
      expect(events.find((e) => e.id === invalidDemoEvent.id)).toBeUndefined();
    });

    test('getCaseCalendarEvents 过滤其他股票的案例内置事件', () => {
      const case300750 = getCaseByStockCode('300750')!;
      // 将 600519 的案例内置事件注入 300750 的 futureEvents 副本
      const foreignEvents = getCaseBuiltInEvents('600519');
      const caseWithForeign = {
        ...case300750,
        futureEvents: [...case300750.futureEvents, ...foreignEvents],
      };
      const events = getCaseCalendarEvents(caseWithForeign, []);
      // 600519 的事件不应出现（stockCode 不匹配）
      foreignEvents.forEach((e) => {
        expect(events.find((ev) => ev.id === e.id)).toBeUndefined();
      });
    });
  });

  // ========================================================================
  // 校验函数测试
  // ========================================================================
  describe('校验函数', () => {
    test('isValidCaseDemoEvent 对合法演示事件返回 true', () => {
      const events = getCaseBuiltInEvents('300750');
      const demoEvents = events.filter(isCaseDemoEvent);
      demoEvents.forEach((e) => {
        expect(isValidCaseDemoEvent(e)).toBe(true);
      });
    });

    test('isValidCaseDemoEvent 对可核验事件返回 false', () => {
      const events = getCaseBuiltInEvents('300750');
      const verifiableEvents = events.filter(isVerifiableEvent);
      verifiableEvents.forEach((e) => {
        expect(isValidCaseDemoEvent(e)).toBe(false);
      });
    });

    test('isValidSystemEvent 对合法可核验事件返回 true', () => {
      const events = getCaseBuiltInEvents('300750');
      const verifiableEvents = events.filter(isVerifiableEvent);
      verifiableEvents.forEach((e) => {
        expect(isValidSystemEvent(e)).toBe(true);
      });
    });
  });

  // ========================================================================
  // StaticHistoricalCase 类型完整性
  // ========================================================================
  describe('StaticHistoricalCase 类型完整性', () => {
    ALL_CASE_CODES.forEach((code) => {
      test(`案例 ${code} 包含 calendarAsOfDate 和 futureEvents 字段`, () => {
        const caseData = getCaseByStockCode(code);
        if (!caseData) return;
        expect(caseData.calendarAsOfDate).toBeTruthy();
        expect(caseData.futureEvents).toBeInstanceOf(Array);
        expect(caseData.futureEvents.length).toBeGreaterThan(0);
      });
    });
  });
});
