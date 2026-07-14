// 第十八阶段发布前收口：静态案例日历事件合并与隔离纯函数
//
// 合并来源：
//   1. 案例内置可核验事件（statutory_deadline / system_verified）
//   2. 案例演示观察窗口（case_demo）
//   3. 当前股票的本地用户事件（user_entered）
//
// 严格规则：
//   - 不同股票事件不能串位（按 stockCode 隔离）
//   - 静态案例不得调用依赖系统当前日期的 loadStockEvents()
//   - case_demo 事件必须通过 isValidCaseDemoEvent 校验
//   - 可核验事件必须通过 isValidSystemEvent 校验
//   - 用户事件保持原 CRUD 行为不变

import { StockEvent, StaticHistoricalCase } from '@/types';
import { isValidSystemEvent, isValidCaseDemoEvent, userEventToStockEvent } from './index';
import { loadUserEvents } from '@/services/userFutureEvents';

/**
 * 合并静态案例内置事件与当前股票的本地用户事件
 *
 * @param caseData 静态案例数据（包含 futureEvents）
 * @param userEvents 当前股票的用户事件（可选，未传入则从 localStorage 加载）
 * @returns 合并后的事件列表，按 stockCode 严格隔离
 */
export function getCaseCalendarEvents(
  caseData: StaticHistoricalCase,
  userEvents?: StockEvent[],
): StockEvent[] {
  const stockCode = caseData.stockCode;

  // 1. 案例内置事件：按 origin 分类校验
  const caseBuiltInEvents = caseData.futureEvents.filter((event) => {
    // 严格按 stockCode 隔离，防止串位
    if (event.stockCode !== stockCode) return false;

    if (event.origin === 'case_demo') {
      return isValidCaseDemoEvent(event);
    }
    if (event.origin === 'statutory_deadline' || event.origin === 'system_verified') {
      return isValidSystemEvent(event);
    }
    // case_demo / statutory_deadline / system_verified 以外的 origin 不应出现在案例内置事件中
    return false;
  });

  // 2. 用户事件：按 stockCode 隔离
  const resolvedUserEvents: StockEvent[] = userEvents
    ? userEvents.filter((e) => e.stockCode === stockCode && e.origin === 'user_entered')
    : loadUserEvents(stockCode).map(userEventToStockEvent);

  // 3. 合并：案例内置事件 + 用户事件
  return [...caseBuiltInEvents, ...resolvedUserEvents];
}
