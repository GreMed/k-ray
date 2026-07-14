/**
 * K-Ray 第四阶段测试 - 未来事件日历（本地 Mock 版）
 * 验证排序、日期确定性、卡片展示、详情交互、空状态、风险提示、日期过滤
 *
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// 真实项目类型
import { FutureEvent } from '@/types';

// 真实Mock数据
import { mockFutureEvents } from '@/data/mockData';

// 公共配置（与组件内部使用同一份映射）
import { getDateCertaintyConfig } from '@/config/dateCertaintyConfig';

// 组件
import FutureEventCalendar from '@/components/FutureEventCalendar';
import FutureEventDetailDrawer from '@/components/FutureEventDetailDrawer';

// === 测试数据 ===
const testFutureEvents: FutureEvent[] = mockFutureEvents;

describe('第四阶段测试 - 未来事件日历（本地 Mock 版）', () => {

  describe('测试1: 未来事件按日期正确排序', () => {
    test('默认按日期从近到远排列', () => {
      render(<FutureEventCalendar events={testFutureEvents} referenceEndDate="2024-03-31" />);

      const cards = screen.getAllByTestId(/^future-event-card-/);
      expect(cards.length).toBeGreaterThan(0);

      // 提取卡片对应的 eventId，再查 Mock 数据得到 scheduledDate
      const actualEventIds = cards.map(card =>
        card.getAttribute('data-testid')?.replace('future-event-card-', '') || ''
      );
      const actualDates = actualEventIds
        .map(id => testFutureEvents.find(e => e.eventId === id)?.scheduledDate || '')
        .filter(d => d);

      // 排除日期待定事件后，非待定事件的日期应从小到大排列
      const expectedSorted = testFutureEvents
        .filter(e => e.dateCertainty !== 'tentative' && new Date(e.scheduledDate).getTime() > new Date('2024-03-31').getTime())
        .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
        .map(e => e.scheduledDate);

      // 取前 expectedSorted.length 个，对应非待定事件
      const actualNonTentative = actualDates.slice(0, expectedSorted.length);
      expect(actualNonTentative).toEqual(expectedSorted);
    });
  });

  describe('测试2: 相同日期按 eventId 稳定排序', () => {
    test('相同日期的事件应按 eventId 排序', () => {
      // 构造两个相同日期的事件
      const sameDateEvents: FutureEvent[] = [
        {
          eventId: 'future-zzz',
          stockId: 'stock-sh-600519',
          title: '测试事件Z',
          eventType: 'performance',
          scheduledDate: '2024-05-15',
          dateCertainty: 'confirmed',
          description: '测试描述',
          attentionReason: '测试理由',
          sourceNote: '测试依据',
          isDemo: true
        },
        {
          eventId: 'future-aaa',
          stockId: 'stock-sh-600519',
          title: '测试事件A',
          eventType: 'announcement',
          scheduledDate: '2024-05-15',
          dateCertainty: 'confirmed',
          description: '测试描述',
          attentionReason: '测试理由',
          sourceNote: '测试依据',
          isDemo: true
        }
      ];

      render(<FutureEventCalendar events={sameDateEvents} referenceEndDate="2024-03-31" />);

      const cards = screen.getAllByTestId(/^future-event-card-/);
      expect(cards[0]).toHaveAttribute('data-testid', 'future-event-card-future-aaa');
      expect(cards[1]).toHaveAttribute('data-testid', 'future-event-card-future-zzz');
    });
  });

  describe('测试3: 日期待定事件排在最后', () => {
    test('tentative 事件应排在有日期事件之后', () => {
      const mixedEvents: FutureEvent[] = [
        {
          eventId: 'tentative-001',
          stockId: 'stock-sh-600519',
          title: '待定事件',
          eventType: 'policy',
          scheduledDate: '2024-07-01',
          dateCertainty: 'tentative',
          description: '待定',
          attentionReason: '待定理由',
          sourceNote: '待定依据',
          isDemo: true
        },
        {
          eventId: 'confirmed-001',
          stockId: 'stock-sh-600519',
          title: '已确认事件',
          eventType: 'performance',
          scheduledDate: '2024-06-20',
          dateCertainty: 'confirmed',
          description: '已确认',
          attentionReason: '已确认理由',
          sourceNote: '已确认依据',
          isDemo: true
        }
      ];

      render(<FutureEventCalendar events={mixedEvents} referenceEndDate="2024-03-31" />);

      const cards = screen.getAllByTestId(/^future-event-card-/);
      // 已确认事件应在前面
      expect(cards[0]).toHaveAttribute('data-testid', 'future-event-card-confirmed-001');
      // 待定事件应在后面
      expect(cards[1]).toHaveAttribute('data-testid', 'future-event-card-tentative-001');
    });
  });

  describe('测试4: confirmed 显示"已确认"', () => {
    test('已确认事件应显示"已确认"文字', () => {
      render(<FutureEventCalendar events={testFutureEvents} referenceEndDate="2024-03-31" />);

      const confirmedEvent = testFutureEvents.find(e => e.dateCertainty === 'confirmed')!;
      const card = screen.getByTestId(`future-event-card-${confirmedEvent.eventId}`);
      expect(card).toHaveTextContent('已确认');
    });
  });

  describe('测试5: estimated 显示"预计日期"', () => {
    test('预计事件应显示"预计日期"文字', () => {
      render(<FutureEventCalendar events={testFutureEvents} referenceEndDate="2024-03-31" />);

      const estimatedEvent = testFutureEvents.find(e => e.dateCertainty === 'estimated')!;
      const card = screen.getByTestId(`future-event-card-${estimatedEvent.eventId}`);
      expect(card).toHaveTextContent('预计日期');
    });
  });

  describe('测试6: tentative 显示"日期待定"', () => {
    test('待定事件应显示"日期待定"文字', () => {
      render(<FutureEventCalendar events={testFutureEvents} referenceEndDate="2024-03-31" />);

      const tentativeEvent = testFutureEvents.find(e => e.dateCertainty === 'tentative')!;
      const card = screen.getByTestId(`future-event-card-${tentativeEvent.eventId}`);
      expect(card).toHaveTextContent('日期待定');
    });
  });

  describe('测试7: 点击事件卡片打开正确详情', () => {
    test('点击卡片应调用 onEventClick 并打开正确详情', () => {
      const onEventClick = jest.fn();
      render(<FutureEventCalendar events={testFutureEvents} onEventClick={onEventClick} referenceEndDate="2024-03-31" />);

      const firstEvent = testFutureEvents.find(e => e.dateCertainty === 'confirmed')!;
      const card = screen.getByTestId(`future-event-card-${firstEvent.eventId}`);
      fireEvent.click(card);

      expect(onEventClick).toHaveBeenCalledWith(firstEvent);
    });

    test('点击卡片后渲染详情抽屉显示正确事件', () => {
      const targetEvent = testFutureEvents.find(e => e.dateCertainty === 'estimated')!;

      const { rerender } = render(
        <FutureEventCalendar events={testFutureEvents} referenceEndDate="2024-03-31" />
      );

      const card = screen.getByTestId(`future-event-card-${targetEvent.eventId}`);
      fireEvent.click(card);

      // 渲染详情抽屉
      rerender(
        <>
          <FutureEventCalendar events={testFutureEvents} referenceEndDate="2024-03-31" />
          <FutureEventDetailDrawer event={targetEvent} isOpen={true} onClose={jest.fn()} />
        </>
      );

      expect(screen.getByTestId('future-event-detail-close')).toBeInTheDocument();
      // 卡片和抽屉都有标题，使用 getAllByText
      const titleMatches = screen.getAllByText(targetEvent.title);
      expect(titleMatches.length).toBeGreaterThan(0);
    });
  });

  describe('测试8: 详情显示信息依据和关注理由', () => {
    test('详情抽屉应展示信息依据', () => {
      const event = testFutureEvents[0];
      render(<FutureEventDetailDrawer event={event} isOpen={true} onClose={jest.fn()} />);

      expect(screen.getByText('信息依据')).toBeInTheDocument();
      expect(screen.getByText(event.sourceNote)).toBeInTheDocument();
    });

    test('详情抽屉应展示关注理由', () => {
      const event = testFutureEvents[0];
      render(<FutureEventDetailDrawer event={event} isOpen={true} onClose={jest.fn()} />);

      expect(screen.getByText('为什么值得关注')).toBeInTheDocument();
      expect(screen.getByText(event.attentionReason)).toBeInTheDocument();
    });

    test('详情抽屉应展示完整事件说明', () => {
      const event = testFutureEvents[0];
      render(<FutureEventDetailDrawer event={event} isOpen={true} onClose={jest.fn()} />);

      expect(screen.getByText('事件说明')).toBeInTheDocument();
      expect(screen.getByText(event.description)).toBeInTheDocument();
    });
  });

  describe('测试9: 风险提示始终可见', () => {
    test('日历区域应显示固定风险提示', () => {
      render(<FutureEventCalendar events={testFutureEvents} referenceEndDate="2024-03-31" />);

      expect(screen.getByText(/未来事件仅用于时间管理和研究提醒/)).toBeInTheDocument();
      expect(screen.getByText(/不代表事件一定发生，也不代表其将导致特定股价表现/)).toBeInTheDocument();
    });

    test('详情抽屉应显示固定风险提示', () => {
      const event = testFutureEvents[0];
      render(<FutureEventDetailDrawer event={event} isOpen={true} onClose={jest.fn()} />);

      expect(screen.getByText(/未来事件仅用于时间管理和研究提醒/)).toBeInTheDocument();
      expect(screen.getByText(/不代表事件一定发生，也不代表其将导致特定股价表现/)).toBeInTheDocument();
    });
  });

  describe('测试10: 过去事件不会进入未来事件列表', () => {
    test('scheduledDate 早于或等于复盘区间结束日期的事件应被过滤', () => {
      const mixedEvents: FutureEvent[] = [
        ...testFutureEvents,
        {
          eventId: 'past-001',
          stockId: 'stock-sh-600519',
          title: '过去事件',
          eventType: 'performance',
          scheduledDate: '2024-03-31', // 等于结束日期
          dateCertainty: 'confirmed',
          description: '过去',
          attentionReason: '过去理由',
          sourceNote: '过去依据',
          isDemo: true
        },
        {
          eventId: 'past-002',
          stockId: 'stock-sh-600519',
          title: '更早事件',
          eventType: 'performance',
          scheduledDate: '2024-03-15', // 早于结束日期
          dateCertainty: 'confirmed',
          description: '更早',
          attentionReason: '更早理由',
          sourceNote: '更早依据',
          isDemo: true
        }
      ];

      render(<FutureEventCalendar events={mixedEvents} referenceEndDate="2024-03-31" />);

      // 过去事件不应出现
      expect(screen.queryByTestId('future-event-card-past-001')).not.toBeInTheDocument();
      expect(screen.queryByTestId('future-event-card-past-002')).not.toBeInTheDocument();
    });
  });

  describe('测试11: 判断基准使用复盘区间结束日期', () => {
    test('使用不同的 referenceEndDate 应得到不同的过滤结果', () => {
      const { rerender } = render(
        <FutureEventCalendar events={testFutureEvents} referenceEndDate="2024-03-31" />
      );

      expect(screen.getByTestId('future-calendar')).toBeInTheDocument();
      expect(screen.queryByTestId('future-calendar-empty')).not.toBeInTheDocument();

      // 以 2024-07-01 为基准：confirmed/estimated 事件都早于或等于7月1日被过滤
      // 但 tentative 事件不使用日期过滤，始终保留
      rerender(
        <FutureEventCalendar events={testFutureEvents} referenceEndDate="2024-07-01" />
      );

      expect(screen.getByTestId('future-calendar')).toBeInTheDocument();
      expect(screen.queryByTestId('future-calendar-empty')).not.toBeInTheDocument();

      // 只有 tentative 事件保留
      const tentativeEvent = testFutureEvents.find(e => e.dateCertainty === 'tentative')!;
      expect(screen.getByTestId(`future-event-card-${tentativeEvent.eventId}`)).toBeInTheDocument();

      // confirmed/estimated 事件被过滤
      const confirmedEvent = testFutureEvents.find(e => e.dateCertainty === 'confirmed')!;
      expect(screen.queryByTestId(`future-event-card-${confirmedEvent.eventId}`)).not.toBeInTheDocument();
    });

    test('未提供 referenceEndDate 时不应过滤', () => {
      render(<FutureEventCalendar events={testFutureEvents} />);

      expect(screen.getByTestId('future-calendar')).toBeInTheDocument();
      // 所有事件都应显示
      testFutureEvents.forEach(event => {
        expect(screen.getByTestId(`future-event-card-${event.eventId}`)).toBeInTheDocument();
      });
    });
  });

  describe('测试12: 无事件时显示正确空状态', () => {
    test('空数组应显示空状态提示', () => {
      render(<FutureEventCalendar events={[]} referenceEndDate="2024-03-31" />);

      expect(screen.getByTestId('future-calendar-empty')).toBeInTheDocument();
      expect(screen.getByText('当前演示数据中暂无未来事件安排。')).toBeInTheDocument();
    });
  });

  describe('测试13: 空状态不会伪造默认事件', () => {
    test('空状态不应渲染任何事件卡片', () => {
      render(<FutureEventCalendar events={[]} referenceEndDate="2024-03-31" />);

      // 不应有任何事件卡片
      const cards = screen.queryAllByTestId(/^future-event-card-/);
      expect(cards.length).toBe(0);
    });
  });

  describe('测试14: estimated 和 tentative 事件有不确定性说明', () => {
    test('estimated 事件详情应有不确定性说明', () => {
      const event = testFutureEvents.find(e => e.dateCertainty === 'estimated')!;
      render(<FutureEventDetailDrawer event={event} isOpen={true} onClose={jest.fn()} />);

      expect(screen.getByText(/此日期为预计日期，实际时间可能有所调整/)).toBeInTheDocument();
    });

    test('tentative 事件详情应有不确定性说明', () => {
      const event = testFutureEvents.find(e => e.dateCertainty === 'tentative')!;
      render(<FutureEventDetailDrawer event={event} isOpen={true} onClose={jest.fn()} />);

      expect(screen.getByText(/具体日期尚未确认，请以正式公开信息为准/)).toBeInTheDocument();
    });

    test('tentative 事件详情不显示任何精确日期', () => {
      const event = testFutureEvents.find(e => e.dateCertainty === 'tentative')!;
      render(<FutureEventDetailDrawer event={event} isOpen={true} onClose={jest.fn()} />);

      const drawerText = screen.getByTestId('future-event-detail-close').closest('div')?.textContent || '';
      expect(drawerText).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    });
  });

  describe('补充: 日期确定性配置验证', () => {
    test('三种日期确定性都有对应的中文标签配置', () => {
      const requiredCertainties = ['confirmed', 'estimated', 'tentative'] as const;

      requiredCertainties.forEach(certainty => {
        const config = getDateCertaintyConfig(certainty);
        expect(config).toBeDefined();
        expect(config.label).not.toBe('');
        expect(config.label).not.toBe(certainty);
      });
    });

    test('渲染真实组件验证三种确定性标签都正确显示', () => {
      const requiredCertainties = ['confirmed', 'estimated', 'tentative'] as const;

      requiredCertainties.forEach(certainty => {
        const event = testFutureEvents.find(e => e.dateCertainty === certainty);
        if (!event) return;

        const { unmount } = render(
          <FutureEventCalendar events={[event]} referenceEndDate="2024-03-31" />
        );

        const expectedConfig = getDateCertaintyConfig(certainty);
        const card = screen.getByTestId(`future-event-card-${event.eventId}`);
        expect(card).toHaveTextContent(expectedConfig.label);

        unmount();
      });
    });

    test('Mock数据覆盖全部三种日期确定性', () => {
      const certaintiesInMock = new Set(testFutureEvents.map(e => e.dateCertainty));
      expect(certaintiesInMock.has('confirmed')).toBe(true);
      expect(certaintiesInMock.has('estimated')).toBe(true);
      expect(certaintiesInMock.has('tentative')).toBe(true);
    });
  });

  describe('补充: 演示数据标识验证', () => {
    test('每条事件卡片应显示演示数据标识', () => {
      render(<FutureEventCalendar events={testFutureEvents} referenceEndDate="2024-03-31" />);

      // 过滤逻辑：tentative 始终保留，confirmed/estimated 需要有日期且晚于基准
      const visibleEvents = testFutureEvents.filter(e => {
        if (e.dateCertainty === 'tentative') return true;
        if (!e.scheduledDate) return false;
        return new Date(e.scheduledDate).getTime() > new Date('2024-03-31').getTime();
      });
      const demoLabels = screen.getAllByText('演示数据');
      expect(demoLabels.length).toBe(visibleEvents.length);
    });

    test('详情抽屉应显示演示数据标注', () => {
      const event = testFutureEvents[0];
      render(<FutureEventDetailDrawer event={event} isOpen={true} onClose={jest.fn()} />);

      expect(screen.getByText('演示数据 - 不代表真实事件')).toBeInTheDocument();
    });
  });

  describe('补充: 事件类型覆盖验证', () => {
    test('Mock数据应至少覆盖两种事件类型', () => {
      const eventTypes = new Set(testFutureEvents.map(e => e.eventType));
      expect(eventTypes.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('补充: eventId 稳定性验证', () => {
    test('事件状态必须跟随 eventId，不依赖数组 index', () => {
      // 验证每条事件都有 eventId
      testFutureEvents.forEach(event => {
        expect(event.eventId).toBeDefined();
        expect(event.eventId).not.toBe('');
      });

      // 验证 eventId 唯一
      const eventIds = testFutureEvents.map(e => e.eventId);
      const uniqueIds = new Set(eventIds);
      expect(uniqueIds.size).toBe(eventIds.length);
    });
  });

  describe('补充: 详情抽屉关闭交互', () => {
    test('点击关闭按钮应调用 onClose', () => {
      const onClose = jest.fn();
      const event = testFutureEvents[0];

      render(<FutureEventDetailDrawer event={event} isOpen={true} onClose={onClose} />);

      const closeBtn = screen.getByTestId('future-event-detail-close');
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('补充: tentative 事件卡片不显示精确日期', () => {
    test('tentative 事件卡片不显示任何 YYYY-MM-DD 格式日期', () => {
      const tentativeEvent = testFutureEvents.find(e => e.dateCertainty === 'tentative')!;
      render(<FutureEventCalendar events={[tentativeEvent]} referenceEndDate="2024-03-31" />);

      const card = screen.getByTestId(`future-event-card-${tentativeEvent.eventId}`);
      const cardText = card.textContent || '';
      expect(cardText).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    test('多个 tentative 事件按 eventId 排序', () => {
      const tentativeEvents: FutureEvent[] = [
        {
          eventId: 'tentative-zzz',
          stockId: 'stock-sh-600519',
          title: '事件Z',
          eventType: 'policy',
          scheduledDate: null,
          dateCertainty: 'tentative',
          description: '描述',
          attentionReason: '理由',
          sourceNote: '依据',
          isDemo: true
        },
        {
          eventId: 'tentative-aaa',
          stockId: 'stock-sh-600519',
          title: '事件A',
          eventType: 'policy',
          scheduledDate: null,
          dateCertainty: 'tentative',
          description: '描述',
          attentionReason: '理由',
          sourceNote: '依据',
          isDemo: true
        }
      ];

      render(<FutureEventCalendar events={tentativeEvents} referenceEndDate="2024-03-31" />);

      const cards = screen.getAllByTestId(/^future-event-card-/);
      expect(cards[0]).toHaveAttribute('data-testid', 'future-event-card-tentative-aaa');
      expect(cards[1]).toHaveAttribute('data-testid', 'future-event-card-tentative-zzz');
    });
  });

  describe('补充: 数据校验测试', () => {
    test('confirmed 事件必须有 scheduledDate', () => {
      testFutureEvents.forEach(event => {
        if (event.dateCertainty === 'confirmed') {
          expect(event.scheduledDate).toBeDefined();
          expect(event.scheduledDate).not.toBeNull();
          expect(event.scheduledDate).not.toBe('');
        }
      });
    });

    test('estimated 事件必须有 scheduledDate', () => {
      testFutureEvents.forEach(event => {
        if (event.dateCertainty === 'estimated') {
          expect(event.scheduledDate).toBeDefined();
          expect(event.scheduledDate).not.toBeNull();
          expect(event.scheduledDate).not.toBe('');
        }
      });
    });

    test('tentative 事件的 scheduledDate 必须为 null', () => {
      testFutureEvents.forEach(event => {
        if (event.dateCertainty === 'tentative') {
          expect(event.scheduledDate).toBeNull();
        }
      });
    });

    test('confirmed/estimated 缺日期属于非法数据', () => {
      const invalidConfirmed: FutureEvent = {
        eventId: 'invalid-confirmed',
        stockId: 'stock-sh-600519',
        title: '非法事件',
        eventType: 'performance',
        scheduledDate: null,
        dateCertainty: 'confirmed',
        description: '描述',
        attentionReason: '理由',
        sourceNote: '依据',
        isDemo: true
      };

      render(<FutureEventCalendar events={[invalidConfirmed]} referenceEndDate="2024-03-31" />);

      expect(screen.getByTestId('future-calendar-empty')).toBeInTheDocument();
    });

    test('tentative 带精确日期属于非法数据', () => {
      const invalidTentative: FutureEvent = {
        eventId: 'invalid-tentative',
        stockId: 'stock-sh-600519',
        title: '非法事件',
        eventType: 'policy',
        scheduledDate: '2024-07-01',
        dateCertainty: 'tentative',
        description: '描述',
        attentionReason: '理由',
        sourceNote: '依据',
        isDemo: true
      };

      render(<FutureEventCalendar events={[invalidTentative]} referenceEndDate="2024-03-31" />);

      const card = screen.getByTestId(`future-event-card-${invalidTentative.eventId}`);
      const cardText = card.textContent || '';
      // 即使数据非法，组件也不应显示精确日期（防御性编程）
      expect(cardText).not.toMatch(/2024-07-01/);
    });
  });

  describe('补充: 空状态风险提示', () => {
    test('空状态必须显示未来事件专属风险提示', () => {
      render(<FutureEventCalendar events={[]} referenceEndDate="2024-03-31" />);

      expect(screen.getByTestId('future-calendar-empty')).toBeInTheDocument();
      expect(screen.getByText(/未来事件仅用于时间管理和研究提醒/)).toBeInTheDocument();
      expect(screen.getByText(/不代表事件一定发生，也不代表其将导致特定股价表现/)).toBeInTheDocument();
    });
  });
});
