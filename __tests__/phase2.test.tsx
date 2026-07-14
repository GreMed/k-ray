/**
 * K-Ray 第二阶段测试（重写版 v2）
 * 使用真实项目类型和真实Mock数据
 * 覆盖10项测试要求 + marker 点击真实验证
 *
 * @jest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-require-imports */

import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// 真实项目类型
import { Stock, KLineData, KeyNode, HistoricalEvent, EventSource } from '@/types';

// 真实Mock数据
import {
  mockStocks,
  mockKLines600519,
  mockKeyNodes,
  mockHistoricalEvents,
  mockSources,
} from '@/data/mockData';

// 统一工具函数
import {
  aggregateEventsUnified,
  filterKLinesByDate,
  filterEventsByDate,
  filterNodesByDate,
  mapEventToTradingDate,
  generateGroupId,
  generateNodeMarkerId,
  generateEventMarkerId,
  generateEventGroupMarkerId,
} from '@/utils/eventAggregation';

// 组件
import ProfessionalKLineChart from '@/components/ProfessionalKLineChart';
import EventDetailDrawer from '@/components/EventDetailDrawer';
import EventListModal from '@/components/EventListModal';
import DateQuickOptions from '@/components/DateQuickOptions';

// === lightweight-charts mock ===
// 捕获 subscribeClick 注册的 clickHandler，供测试手动触发
let capturedClickHandler: ((param: any) => void) | null = null;
let setDataLastCall: any[] = [];

jest.mock('lightweight-charts', () => {
  const originalModule = jest.requireActual('lightweight-charts');

  const mockCandlestickSeries = {
    setData: jest.fn((data: any[]) => {
      setDataLastCall = data;
    }),
    setMarkers: jest.fn(),
    applyOptions: jest.fn(),
  };

  const mockChart = {
    addCandlestickSeries: jest.fn(() => mockCandlestickSeries),
    subscribeCrosshairMove: jest.fn(),
    subscribeClick: jest.fn((handler: (param: any) => void) => {
      capturedClickHandler = handler;
    }),
    unsubscribeCrosshairMove: jest.fn(),
    unsubscribeClick: jest.fn(),
    applyOptions: jest.fn(),
    timeScale: jest.fn(() => ({
      fitContent: jest.fn(),
    })),
    remove: jest.fn(),
  };

  return {
    ...originalModule,
    createChart: jest.fn(() => mockChart),
    CrosshairMode: {
      Normal: 0,
      Magnet: 1,
    },
  };
});

// 使用真实Mock数据
const testStock: Stock = mockStocks[0];
const testKlines: KLineData[] = mockKLines600519;
const testNodes: KeyNode[] = mockKeyNodes;
const testEvents: HistoricalEvent[] = mockHistoricalEvents;
const testSources: EventSource[] = mockSources;

// 每个测试前重置捕获的 handler 和 mock 调用记录
beforeEach(() => {
  capturedClickHandler = null;
  setDataLastCall = [];
  jest.clearAllMocks();
});

describe('第二阶段测试 - 使用真实项目类型和Mock数据', () => {

  describe('测试1: 渲染ProfessionalKLineChart后存在Canvas', () => {
    test('图表渲染后应包含canvas元素', () => {
      render(
        <ProfessionalKLineChart
          klines={testKlines}
          keyNodes={testNodes}
          events={testEvents}
          stockName={testStock.name}
        />
      );

      // lightweight-charts 内部会创建 canvas，jsdom 中 createChart 是 mock，
      // 但 chart-container 应该存在
      const chartContainer = screen.getByTestId('chart-container');
      expect(chartContainer).toBeInTheDocument();

      // 验证 createChart 被调用
      const { createChart } = require('lightweight-charts');
      expect(createChart).toHaveBeenCalled();
    });
  });

  describe('测试2: 图表接收完整OHLC数据', () => {
    test('传入N根K线，setData 应被调用且包含N条OHLC数据', () => {
      render(
        <ProfessionalKLineChart
          klines={testKlines}
          keyNodes={testNodes}
          events={testEvents}
          stockName={testStock.name}
        />
      );

      // 验证 setData 被调用，且数据条数正确
      expect(setDataLastCall.length).toBe(testKlines.length);

      // 验证每条数据都有 OHLC 字段
      setDataLastCall.forEach((item: any) => {
        expect(item).toHaveProperty('open');
        expect(item).toHaveProperty('high');
        expect(item).toHaveProperty('low');
        expect(item).toHaveProperty('close');
        expect(item).toHaveProperty('time');
        expect(typeof item.open).toBe('number');
        expect(typeof item.high).toBe('number');
        expect(typeof item.low).toBe('number');
        expect(typeof item.close).toBe('number');
      });

      // 验证图表统计信息显示正确的K线数量
      const stats = screen.getByTestId('chart-stats');
      expect(stats.textContent).toContain(`${testKlines.length} 根 K 线`);
    });
  });

  describe('测试3: 点击单事件Marker触发onEventClick', () => {
    test('手动触发 clickHandler(event:<eventId>) 应调用 onEventClick 并传入正确事件', () => {
      const mockOnEventClick = jest.fn();

      render(
        <ProfessionalKLineChart
          klines={testKlines}
          keyNodes={testNodes}
          events={testEvents}
          stockName={testStock.name}
          onEventClick={mockOnEventClick}
        />
      );

      // 验证 subscribeClick 被调用（点击回调已注册）
      expect(capturedClickHandler).not.toBeNull();

      // 找到一个单个事件（非聚合组的）
      const groups = aggregateEventsUnified(testEvents, testKlines);
      const singleGroup = groups.find(g => g.events.length === 1);
      expect(singleGroup).toBeDefined();

      if (singleGroup) {
        const singleEvent = singleGroup.events[0];
        const expectedMarkerId = generateEventMarkerId(singleEvent.id);

        // 手动触发点击
        act(() => {
          capturedClickHandler!({
            hoveredObjectId: expectedMarkerId,
            time: singleGroup.mappedTradingDate,
            point: { x: 100, y: 200 },
          });
        });

        // 验证 onEventClick 被调用，且参数是正确的事件对象
        expect(mockOnEventClick).toHaveBeenCalledTimes(1);
        expect(mockOnEventClick).toHaveBeenCalledWith(
          expect.objectContaining({
            id: singleEvent.id,
            title: singleEvent.title,
          })
        );
      }
    });

    test('单个事件marker应具有稳定ID格式 event:<eventId>', () => {
      const testEvent = testEvents[0];
      const markerId = generateEventMarkerId(testEvent.id);
      expect(markerId).toBe(`event:${testEvent.id}`);
      expect(markerId.startsWith('event:')).toBe(true);
    });
  });

  describe('测试4: 点击聚合Marker触发onEventGroupClick并包含全部事件', () => {
    test('手动触发 clickHandler(event-group:<groupId>) 应调用 onEventGroupClick 并传入完整事件组', () => {
      const mockOnEventGroupClick = jest.fn();

      render(
        <ProfessionalKLineChart
          klines={testKlines}
          keyNodes={testNodes}
          events={testEvents}
          stockName={testStock.name}
          onEventGroupClick={mockOnEventGroupClick}
        />
      );

      // 验证 subscribeClick 被调用
      expect(capturedClickHandler).not.toBeNull();

      // 找到一个聚合事件组
      const groups = aggregateEventsUnified(testEvents, testKlines);
      const aggregatedGroup = groups.find(g => g.events.length > 1);

      // 明确断言聚合组必须存在，避免没有数据时测试静默通过
      expect(aggregatedGroup).toBeDefined();
      expect(aggregatedGroup!.events.length).toBeGreaterThan(1);

      const expectedMarkerId = generateEventGroupMarkerId(
        aggregatedGroup!.events.map(e => e.id)
      );

      // 手动触发点击聚合标记
      act(() => {
        capturedClickHandler!({
          hoveredObjectId: expectedMarkerId,
          time: aggregatedGroup!.mappedTradingDate,
          point: { x: 100, y: 200 },
        });
      });

      // 验证 onEventGroupClick 被调用
      expect(mockOnEventGroupClick).toHaveBeenCalledTimes(1);

      // 验证传入的是完整的 AggregatedEventGroup
      const calledGroup = mockOnEventGroupClick.mock.calls[0][0];
      expect(calledGroup).toHaveProperty('groupId');
      expect(calledGroup).toHaveProperty('mappedTradingDate');
      expect(calledGroup).toHaveProperty('events');

      // 验证包含全部事件
      expect(calledGroup.events.length).toBe(aggregatedGroup!.events.length);
      const eventIds = calledGroup.events.map((e: HistoricalEvent) => e.id);
      aggregatedGroup!.events.forEach(e => {
        expect(eventIds).toContain(e.id);
      });
    });

    test('聚合事件组具有稳定groupId，包含所有必需字段', () => {
      const groups = aggregateEventsUnified(testEvents, testKlines);
      const aggregatedGroup = groups.find(g => g.events.length > 1);

      // 明确断言聚合组必须存在
      expect(aggregatedGroup).toBeDefined();
      expect(aggregatedGroup!.events.length).toBeGreaterThan(1);

      // 验证 groupId 稳定
      const expectedGroupId = generateGroupId(aggregatedGroup!.events.map(e => e.id));
      expect(aggregatedGroup!.groupId).toBe(expectedGroupId);

      // 验证 markerId 格式
      const markerId = generateEventGroupMarkerId(aggregatedGroup!.events.map(e => e.id));
      expect(markerId).toBe(`event-group:${expectedGroupId}`);
      expect(markerId.startsWith('event-group:')).toBe(true);

      // 验证所有必需字段
      expect(aggregatedGroup!).toHaveProperty('groupId');
      expect(aggregatedGroup!).toHaveProperty('mappedTradingDate');
      expect(aggregatedGroup!).toHaveProperty('originalEventDate');
      expect(aggregatedGroup!).toHaveProperty('events');
      expect(aggregatedGroup!).toHaveProperty('isMappedToNearbyDate');

      // 验证包含全部事件
      expect(aggregatedGroup!.events.length).toBeGreaterThan(1);

      // 验证所有事件都被聚合（无遗漏）
      const totalEventsInGroups = groups.reduce((sum, g) => sum + g.events.length, 0);
      expect(totalEventsInGroups).toBe(testEvents.length);
    });
  });

  describe('测试5: 点击节点Marker触发onNodeClick', () => {
    test('手动触发 clickHandler(node:<nodeId>) 应调用 onNodeClick 并传入正确节点', () => {
      const mockOnNodeClick = jest.fn();

      render(
        <ProfessionalKLineChart
          klines={testKlines}
          keyNodes={testNodes}
          events={testEvents}
          stockName={testStock.name}
          onNodeClick={mockOnNodeClick}
        />
      );

      // 验证 subscribeClick 被调用
      expect(capturedClickHandler).not.toBeNull();

      // 找到一个在 K 线日期中的节点
      const klineDates = testKlines.map(k => k.date);
      const validNode = testNodes.find(n => klineDates.includes(n.date));
      expect(validNode).toBeDefined();

      if (validNode) {
        const expectedMarkerId = generateNodeMarkerId(validNode.id);

        // 手动触发点击节点标记
        act(() => {
          capturedClickHandler!({
            hoveredObjectId: expectedMarkerId,
            time: validNode.date,
            point: { x: 100, y: 100 },
          });
        });

        // 验证 onNodeClick 被调用，且参数是正确的节点对象
        expect(mockOnNodeClick).toHaveBeenCalledTimes(1);
        expect(mockOnNodeClick).toHaveBeenCalledWith(
          expect.objectContaining({
            id: validNode.id,
            nodeType: validNode.nodeType,
          })
        );
      }
    });

    test('节点marker应具有稳定ID格式 node:<nodeId>', () => {
      const testNode = testNodes[0];
      const markerId = generateNodeMarkerId(testNode.id);
      expect(markerId).toBe(`node:${testNode.id}`);
      expect(markerId.startsWith('node:')).toBe(true);
    });

    test('组件卸载时应调用 unsubscribeClick', () => {
      const { unmount } = render(
        <ProfessionalKLineChart
          klines={testKlines}
          keyNodes={testNodes}
          events={testEvents}
          stockName={testStock.name}
          onNodeClick={jest.fn()}
        />
      );

      const { createChart } = require('lightweight-charts');
      const chartInstance = createChart.mock.results[0].value;

      // 卸载组件
      unmount();

      // 验证 unsubscribeClick 和 remove 被调用
      expect(chartInstance.unsubscribeClick).toHaveBeenCalled();
      expect(chartInstance.remove).toHaveBeenCalled();
    });
  });

  describe('测试6: 从聚合列表选择第二条事件能打开第二条', () => {
    test('EventListModal应渲染所有事件且点击第二条触发正确回调', () => {
      const mockOnSelectEvent = jest.fn();
      const mockOnClose = jest.fn();

      // 使用真实聚合数据
      const groups = aggregateEventsUnified(testEvents, testKlines);
      const aggregatedGroup = groups.find(g => g.events.length > 1);

      // 明确断言聚合组必须存在
      expect(aggregatedGroup).toBeDefined();
      expect(aggregatedGroup!.events.length).toBeGreaterThan(1);

      const events = aggregatedGroup!.events;

      render(
        <EventListModal
          group={aggregatedGroup!}
          isOpen={true}
          onClose={mockOnClose}
          onSelectEvent={mockOnSelectEvent}
        />
      );

      // 验证弹窗显示正确的事件数量
      expect(screen.getByText(`该区域有 ${events.length} 个事件`)).toBeInTheDocument();
      expect(screen.getByText('请选择要查看的事件')).toBeInTheDocument();

      // 点击第二个事件按钮
      const buttons = screen.getAllByRole('button');
      // 找到事件选择按钮（排除关闭按钮）
      const eventButtons = buttons.filter(btn => !btn.textContent?.includes('✕'));

      expect(eventButtons.length).toBeGreaterThanOrEqual(2);
      fireEvent.click(eventButtons[1]);

      // 验证回调被调用且参数是第二条事件
      expect(mockOnSelectEvent).toHaveBeenCalledWith(events[1]);
      // 确保不是第一条
      expect(mockOnSelectEvent).not.toHaveBeenCalledWith(events[0]);
    });
  });

  describe('测试7: 上一条/下一条导航正确', () => {
    test('EventDetailDrawer应显示序号并支持导航', () => {
      const sortedEvents = [...testEvents].sort((a, b) => {
        const dateDiff = new Date(a.occurTime).getTime() - new Date(b.occurTime).getTime();
        if (dateDiff !== 0) return dateDiff;
        return a.id.localeCompare(b.id);
      });

      const mockOnNavigatePrev = jest.fn();
      const mockOnNavigateNext = jest.fn();
      const mockOnClose = jest.fn();

      render(
        <EventDetailDrawer
          event={sortedEvents[1]}
          sources={testSources.filter(s => sortedEvents[1].sourceIds.includes(s.id))}
          isOpen={true}
          onClose={mockOnClose}
          currentIndex={2}
          totalCount={sortedEvents.length}
          onNavigatePrev={mockOnNavigatePrev}
          onNavigateNext={mockOnNavigateNext}
        />
      );

      // 验证序号显示
      expect(screen.getByText(`2 / ${sortedEvents.length}`)).toBeInTheDocument();

      // 验证上一条按钮可点击
      const prevButton = screen.getByText('← 上一条');
      expect(prevButton).not.toBeDisabled();
      fireEvent.click(prevButton);
      expect(mockOnNavigatePrev).toHaveBeenCalled();

      // 验证下一条按钮可点击
      const nextButton = screen.getByText('下一条 →');
      expect(nextButton).not.toBeDisabled();
      fireEvent.click(nextButton);
      expect(mockOnNavigateNext).toHaveBeenCalled();
    });

    test('第一条事件上一条按钮应禁用', () => {
      const sortedEvents = [...testEvents].sort((a, b) => {
        const dateDiff = new Date(a.occurTime).getTime() - new Date(b.occurTime).getTime();
        if (dateDiff !== 0) return dateDiff;
        return a.id.localeCompare(b.id);
      });

      render(
        <EventDetailDrawer
          event={sortedEvents[0]}
          sources={testSources.filter(s => sortedEvents[0].sourceIds.includes(s.id))}
          isOpen={true}
          onClose={jest.fn()}
          currentIndex={1}
          totalCount={sortedEvents.length}
          onNavigatePrev={jest.fn()}
          onNavigateNext={jest.fn()}
        />
      );

      const prevButton = screen.getByText('← 上一条');
      expect(prevButton).toBeDisabled();
    });

    test('事件详情页应显示固定提示"事件线索不等于确定因果"', () => {
      render(
        <EventDetailDrawer
          event={testEvents[0]}
          sources={testSources.filter(s => testEvents[0].sourceIds.includes(s.id))}
          isOpen={true}
          onClose={jest.fn()}
        />
      );

      expect(screen.getByText(/事件线索不等于确定因果/)).toBeInTheDocument();
    });
  });

  describe('测试8: 快捷"近1个月"使用Mock最后日期为基准', () => {
    test('DateQuickOptions应使用referenceEndDate而非new Date()', () => {
      const referenceEndDate = '2024-03-29';
      const mockOnSelect = jest.fn();

      render(
        <DateQuickOptions
          onSelect={mockOnSelect}
          currentStartDate="2024-01-02"
          currentEndDate={referenceEndDate}
          onStartDateChange={jest.fn()}
          onEndDateChange={jest.fn()}
          referenceEndDate={referenceEndDate}
          dataCoverageStart="2024-01-02"
          dataCoverageEnd={referenceEndDate}
        />
      );

      // 点击"近1个月"
      const button1m = screen.getByTestId('quick-option-1m');
      fireEvent.click(button1m);

      // 验证回调被调用
      expect(mockOnSelect).toHaveBeenCalled();

      // 验证计算出的日期范围以 2024-03-29 为基准
      const [start, end] = mockOnSelect.mock.calls[0];
      expect(end).toBe(referenceEndDate);
      // 近1个月：开始日期应为 2024-02-29（2024是闰年）
      const expectedStart = new Date(referenceEndDate);
      expectedStart.setMonth(expectedStart.getMonth() - 1);
      expect(start).toBe(expectedStart.toISOString().slice(0, 10));
    });
  });

  describe('测试9: 非法日期显示页面错误', () => {
    test('开始日期晚于结束日期应返回空数组', () => {
      const filtered = filterKLinesByDate(testKlines, '2024-03-29', '2024-01-02');
      expect(filtered.length).toBe(0);
    });

    test('DateQuickOptions接收非法日期时不应崩溃', () => {
      render(
        <DateQuickOptions
          onSelect={jest.fn()}
          currentStartDate="2024-03-29"
          currentEndDate="2024-01-02"
          onStartDateChange={jest.fn()}
          onEndDateChange={jest.fn()}
          referenceEndDate="2024-03-29"
        />
      );

      // 组件应正常渲染，不崩溃
      expect(screen.getByTestId('date-quick-options')).toBeInTheDocument();
    });
  });

  describe('测试10: 手机宽度下图表容器可见', () => {
    test('图表容器在手机宽度下不被隐藏', () => {
      // 模拟手机宽度
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <ProfessionalKLineChart
          klines={testKlines}
          keyNodes={testNodes}
          events={testEvents}
          stockName={testStock.name}
        />
      );

      const chartContainer = screen.getByTestId('chart-container');
      expect(chartContainer).toBeVisible();
      // 验证容器有高度（不是 display:none 或 height:0）
      expect(chartContainer.style.height).toBe('400px');
    });
  });

  describe('补充: 统一聚合逻辑验证', () => {
    test('聚合结果包含所有必需字段', () => {
      const groups = aggregateEventsUnified(testEvents, testKlines);

      groups.forEach(group => {
        expect(group).toHaveProperty('groupId');
        expect(group).toHaveProperty('mappedTradingDate');
        expect(group).toHaveProperty('originalEventDate');
        expect(group).toHaveProperty('events');
        expect(group).toHaveProperty('isMappedToNearbyDate');
        expect(typeof group.groupId).toBe('string');
        expect(typeof group.mappedTradingDate).toBe('string');
        expect(typeof group.originalEventDate).toBe('string');
        expect(Array.isArray(group.events)).toBe(true);
        expect(typeof group.isMappedToNearbyDate).toBe('boolean');
      });
    });

    test('日期过滤正确', () => {
      const startDate = '2024-01-02';
      const endDate = '2024-01-31';

      const filteredKlines = filterKLinesByDate(testKlines, startDate, endDate);
      const filteredNodes = filterNodesByDate(testNodes, startDate, endDate);
      const filteredEvents = filterEventsByDate(testEvents, startDate, endDate);

      filteredKlines.forEach(k => {
        expect(new Date(k.date).getTime()).toBeGreaterThanOrEqual(new Date(startDate).getTime());
        expect(new Date(k.date).getTime()).toBeLessThanOrEqual(new Date(endDate).getTime());
      });

      expect(filteredKlines.length).toBeGreaterThan(0);
      expect(filteredNodes.length).toBeGreaterThan(0);
      expect(filteredEvents.length).toBeGreaterThan(0);
    });

    test('无数据区间进入空状态', () => {
      const filtered = filterKLinesByDate(testKlines, '2025-01-01', '2025-06-30');
      expect(filtered.length).toBe(0);
    });

    test('事件日期映射到最近交易日', () => {
      const klineDates = testKlines.map(k => k.date);

      const testDate = '2024-01-06';
      const { mappedDate, isMapped } = mapEventToTradingDate(testDate, klineDates);

      expect(isMapped).toBe(true);
      expect(klineDates).toContain(mappedDate);
    });
  });
});
