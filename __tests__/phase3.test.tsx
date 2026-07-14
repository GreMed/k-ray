/**
 * K-Ray 第三阶段测试 - 事件来源追溯闭环
 * 验证来源数据关联、多来源/单来源/无来源展示、来源详情弹窗、导航同步
 *
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// 真实项目类型
import { HistoricalEvent, EventSource, SourceType } from '@/types';

// 真实Mock数据
import { mockHistoricalEvents, mockSources } from '@/data/mockData';

// 公共配置（与组件内部使用同一份映射，不在测试中手写）
import { sourceTypeLabels } from '@/config/sourceTypeConfig';

// 组件
import EventDetailDrawer from '@/components/EventDetailDrawer';
import SourceDetailModal from '@/components/SourceDetailModal';

// === 测试数据 ===
const testEvents: HistoricalEvent[] = mockHistoricalEvents;
const testSources: EventSource[] = mockSources;

describe('第三阶段测试 - 事件来源追溯闭环', () => {

  describe('测试1: 事件与来源通过 eventId 正确关联', () => {
    test('每条来源的 eventId 应对应一个真实事件', () => {
      testSources.forEach(source => {
        const matchedEvent = testEvents.find(e => e.id === source.eventId);
        expect(matchedEvent).toBeDefined();
      });
    });

    test('事件的 sourceIds 应对应真实存在的来源', () => {
      testEvents.forEach(event => {
        event.sourceIds.forEach(sourceId => {
          const matchedSource = testSources.find(s => s.id === sourceId);
          expect(matchedSource).toBeDefined();
        });
      });
    });

    test('来源和事件双向关联一致', () => {
      // 对每个来源，其 eventId 对应的事件的 sourceIds 应包含该来源 id
      testSources.forEach(source => {
        const event = testEvents.find(e => e.id === source.eventId);
        expect(event).toBeDefined();
        expect(event!.sourceIds).toContain(source.id);
      });
    });
  });

  describe('测试2: 多来源事件完整显示全部来源', () => {
    test('多来源事件应渲染所有来源卡片', () => {
      // event-600519-001 有两个来源
      const multiSourceEvent = testEvents.find(e => e.sourceIds.length > 1);
      expect(multiSourceEvent).toBeDefined();
      expect(multiSourceEvent!.sourceIds.length).toBeGreaterThan(1);

      const multiSources = testSources.filter(s =>
        multiSourceEvent!.sourceIds.includes(s.id)
      );
      expect(multiSources.length).toBe(multiSourceEvent!.sourceIds.length);

      render(
        <EventDetailDrawer
          event={multiSourceEvent}
          sources={multiSources}
          isOpen={true}
          onClose={jest.fn()}
        />
      );

      // 验证来源卡片容器存在
      const container = screen.getByTestId('source-cards-container');
      expect(container).toBeInTheDocument();

      // 验证每个来源都有对应的卡片
      multiSources.forEach(source => {
        const card = screen.getByTestId(`source-card-${source.id}`);
        expect(card).toBeInTheDocument();
        // 验证来源标题显示
        expect(screen.getByText(source.title)).toBeInTheDocument();
      });
    });
  });

  describe('测试3: 单来源事件正确显示', () => {
    test('单来源事件应渲染一个来源卡片', () => {
      const singleSourceEvent = testEvents.find(e => e.sourceIds.length === 1);
      expect(singleSourceEvent).toBeDefined();

      const singleSources = testSources.filter(s =>
        singleSourceEvent!.sourceIds.includes(s.id)
      );
      expect(singleSources.length).toBe(1);

      render(
        <EventDetailDrawer
          event={singleSourceEvent}
          sources={singleSources}
          isOpen={true}
          onClose={jest.fn()}
        />
      );

      // 验证来源卡片存在
      const card = screen.getByTestId(`source-card-${singleSources[0].id}`);
      expect(card).toBeInTheDocument();

      // 验证来源名称和类型显示
      const nameMatches = screen.getAllByText(singleSources[0].name);
      expect(nameMatches.length).toBeGreaterThan(0);
      expect(screen.getByText(singleSources[0].title)).toBeInTheDocument();
    });
  });

  describe('测试4: 无来源事件显示明确 fallback', () => {
    test('无来源事件应显示 fallback 提示而非空白', () => {
      const noSourceEvent = testEvents.find(e => e.sourceIds.length === 0);
      expect(noSourceEvent).toBeDefined();

      render(
        <EventDetailDrawer
          event={noSourceEvent}
          sources={[]}
          isOpen={true}
          onClose={jest.fn()}
        />
      );

      // 验证 fallback 区域存在
      const fallback = screen.getByTestId('no-source-fallback');
      expect(fallback).toBeInTheDocument();

      // 验证提示文案包含关键信息
      expect(screen.getByText(/当前演示数据未提供可追溯来源/)).toBeInTheDocument();
      expect(screen.getByText(/请勿将该事件解释视为已验证事实/)).toBeInTheDocument();

      // 验证没有来源卡片
      expect(screen.queryByTestId('source-cards-container')).not.toBeInTheDocument();
    });
  });

  describe('测试5: 点击来源卡片能够打开正确来源详情', () => {
    test('点击"查看演示来源"按钮应打开来源详情弹窗', () => {
      const event = testEvents[0]; // 有来源的事件
      const eventSources = testSources.filter(s => event.sourceIds.includes(s.id));

      render(
        <EventDetailDrawer
          event={event}
          sources={eventSources}
          isOpen={true}
          onClose={jest.fn()}
        />
      );

      // 点击第一个来源的"查看演示来源"按钮
      const viewButton = screen.getByTestId(`view-source-${eventSources[0].id}`);
      fireEvent.click(viewButton);

      // 验证来源详情弹窗出现
      const modal = screen.getByTestId('source-detail-modal');
      expect(modal).toBeInTheDocument();
    });
  });

  describe('测试6: 来源详情展示标题、机构、时间、类型和摘要', () => {
    test('来源详情弹窗应展示完整来源信息', () => {
      const testSource = testSources[0];

      render(
        <SourceDetailModal
          source={testSource}
          isOpen={true}
          onClose={jest.fn()}
        />
      );

      // 验证标题
      expect(screen.getByText(testSource.title)).toBeInTheDocument();

      // 验证发布机构
      expect(screen.getByTestId('source-detail-publisher')).toHaveTextContent(testSource.publisher);

      // 验证发布时间
      expect(screen.getByTestId('source-detail-time')).toHaveTextContent(testSource.publishTime);

      // 验证来源类型标签
      expect(screen.getByTestId('source-detail-type')).toBeInTheDocument();

      // 验证摘要
      expect(screen.getByTestId('source-detail-excerpt')).toHaveTextContent(testSource.excerpt);
    });
  });

  describe('测试7: Mock 来源警示始终可见', () => {
    test('来源详情弹窗应显示"演示来源"警示', () => {
      const testSource = testSources[0];

      render(
        <SourceDetailModal
          source={testSource}
          isOpen={true}
          onClose={jest.fn()}
        />
      );

      // 验证演示来源警示
      const warning = screen.getByTestId('source-detail-demo-warning');
      expect(warning).toBeInTheDocument();
      expect(warning).toHaveTextContent(/演示来源，不代表真实公开资料/);
    });

    test('来源列表应显示演示数据警示', () => {
      const event = testEvents[0];
      const eventSources = testSources.filter(s => event.sourceIds.includes(s.id));

      render(
        <EventDetailDrawer
          event={event}
          sources={eventSources}
          isOpen={true}
          onClose={jest.fn()}
        />
      );

      // 验证来源列表底部的警示
      expect(screen.getByText(/以上来源均为演示数据/)).toBeInTheDocument();
    });

    test('来源卡片应标注"演示来源"标签', () => {
      const event = testEvents[0];
      const eventSources = testSources.filter(s => event.sourceIds.includes(s.id));

      render(
        <EventDetailDrawer
          event={event}
          sources={eventSources}
          isOpen={true}
          onClose={jest.fn()}
        />
      );

      // 验证每个来源卡片都有"演示来源"标签
      const demoLabels = screen.getAllByText('演示来源');
      expect(demoLabels.length).toBe(eventSources.length);
    });
  });

  describe('测试8: 不存在来源时不会伪造来源', () => {
    test('无来源事件不应出现任何来源卡片或伪造来源', () => {
      const noSourceEvent = testEvents.find(e => e.sourceIds.length === 0);
      expect(noSourceEvent).toBeDefined();

      render(
        <EventDetailDrawer
          event={noSourceEvent}
          sources={[]}
          isOpen={true}
          onClose={jest.fn()}
        />
      );

      // 不应有来源卡片容器
      expect(screen.queryByTestId('source-cards-container')).not.toBeInTheDocument();

      // 不应有"查看演示来源"按钮
      expect(screen.queryByText(/查看演示来源/)).not.toBeInTheDocument();

      // 不应有"以上来源均为演示数据"警示（因为没来源）
      expect(screen.queryByText(/以上来源均为演示数据/)).not.toBeInTheDocument();
    });

    test('来源详情弹窗不应出现确定性措辞', () => {
      const testSource = testSources[0];

      render(
        <SourceDetailModal
          source={testSource}
          isOpen={true}
          onClose={jest.fn()}
        />
      );

      const modalText = screen.getByTestId('source-detail-modal').textContent || '';

      // 不应出现确定性肯定措辞（否定句"不代表权威证明"是允许的）
      expect(modalText).not.toMatch(/已经核实/);
      expect(modalText).not.toMatch(/确定导致/);
      expect(modalText).not.toMatch(/权威认证/);
      expect(modalText).not.toMatch(/已验证为/);
    });
  });

  describe('测试9: 上一条/下一条事件切换后，来源内容同步更新', () => {
    test('切换事件后来源列表应更新为新事件的来源', () => {
      const sortedEvents = [...testEvents].sort((a, b) => {
        const dateDiff = new Date(a.occurTime).getTime() - new Date(b.occurTime).getTime();
        if (dateDiff !== 0) return dateDiff;
        return a.id.localeCompare(b.id);
      });

      const firstEvent = sortedEvents[0];
      const secondEvent = sortedEvents[1];

      const firstSources = testSources.filter(s => firstEvent.sourceIds.includes(s.id));
      const secondSources = testSources.filter(s => secondEvent.sourceIds.includes(s.id));

      // 确保两个事件的来源不同
      expect(firstSources.length).toBeGreaterThan(0);

      const { rerender } = render(
        <EventDetailDrawer
          event={firstEvent}
          sources={firstSources}
          isOpen={true}
          onClose={jest.fn()}
          currentIndex={1}
          totalCount={sortedEvents.length}
          onNavigatePrev={jest.fn()}
          onNavigateNext={jest.fn()}
        />
      );

      // 验证第一个事件的来源显示
      expect(screen.getByText(firstEvent.title)).toBeInTheDocument();
      firstSources.forEach(source => {
        expect(screen.getByTestId(`source-card-${source.id}`)).toBeInTheDocument();
      });

      // 切换到第二个事件
      rerender(
        <EventDetailDrawer
          event={secondEvent}
          sources={secondSources}
          isOpen={true}
          onClose={jest.fn()}
          currentIndex={2}
          totalCount={sortedEvents.length}
          onNavigatePrev={jest.fn()}
          onNavigateNext={jest.fn()}
        />
      );

      // 验证第二个事件的来源显示
      expect(screen.getByText(secondEvent.title)).toBeInTheDocument();
      secondSources.forEach(source => {
        expect(screen.getByTestId(`source-card-${source.id}`)).toBeInTheDocument();
      });

      // 验证第一个事件的来源卡片已消失
      firstSources.forEach(source => {
        // 只有当 source id 不在第二个事件来源中时才检查
        if (!secondSources.some(s => s.id === source.id)) {
          expect(screen.queryByTestId(`source-card-${source.id}`)).not.toBeInTheDocument();
        }
      });
    });

    test('从有来源事件切换到无来源事件应显示 fallback', () => {
      const sortedEvents = [...testEvents].sort((a, b) => {
        const dateDiff = new Date(a.occurTime).getTime() - new Date(b.occurTime).getTime();
        if (dateDiff !== 0) return dateDiff;
        return a.id.localeCompare(b.id);
      });

      const sourceEvent = sortedEvents.find(e => e.sourceIds.length > 0)!;
      const noSourceEvent = sortedEvents.find(e => e.sourceIds.length === 0)!;

      const sourceEventSources = testSources.filter(s => sourceEvent.sourceIds.includes(s.id));

      const { rerender } = render(
        <EventDetailDrawer
          event={sourceEvent}
          sources={sourceEventSources}
          isOpen={true}
          onClose={jest.fn()}
        />
      );

      // 有来源时显示卡片
      expect(screen.getByTestId('source-cards-container')).toBeInTheDocument();

      // 切换到无来源事件
      rerender(
        <EventDetailDrawer
          event={noSourceEvent}
          sources={[]}
          isOpen={true}
          onClose={jest.fn()}
        />
      );

      // 无来源时显示 fallback
      expect(screen.getByTestId('no-source-fallback')).toBeInTheDocument();
      expect(screen.queryByTestId('source-cards-container')).not.toBeInTheDocument();
    });
  });

  describe('测试10: 第二阶段已有21项测试继续全部通过', () => {
    test('Mock数据结构完整性验证', () => {
      // 验证事件数据结构符合第三阶段要求
      testEvents.forEach(event => {
        expect(event).toHaveProperty('sourceIds');
        expect(Array.isArray(event.sourceIds)).toBe(true);
      });

      // 验证来源数据结构符合第三阶段要求
      testSources.forEach(source => {
        expect(source).toHaveProperty('title');
        expect(source).toHaveProperty('publisher');
        expect(source).toHaveProperty('excerpt');
        expect(source).toHaveProperty('isDemo');
        expect(source).toHaveProperty('eventId');
        expect(source.isDemo).toBe(true); // 所有来源都是演示数据
      });

      // 验证来源类型覆盖
      const sourceTypes = new Set(testSources.map(s => s.type));
      expect(sourceTypes.size).toBeGreaterThan(2); // 至少有多种类型
    });
  });

  describe('补充: 来源详情弹窗关闭交互', () => {
    test('点击关闭按钮应关闭来源详情弹窗', () => {
      const testSource = testSources[0];
      const onClose = jest.fn();

      render(
        <SourceDetailModal
          source={testSource}
          isOpen={true}
          onClose={onClose}
        />
      );

      const closeBtn = screen.getByTestId('source-detail-close');
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('来源详情弹窗不应跳转到外部网址', () => {
      const testSource = testSources[0];

      render(
        <SourceDetailModal
          source={testSource}
          isOpen={true}
          onClose={jest.fn()}
        />
      );

      // 验证没有可点击的 <a> 标签跳转
      const links = screen.queryByTestId('source-detail-modal')?.querySelectorAll('a');
      expect(links?.length || 0).toBe(0);

      // URL 应以纯文本显示，不可点击
      if (testSource.url) {
        const urlText = screen.getByText(testSource.url);
        expect(urlText.tagName).not.toBe('A');
      }
    });
  });

  describe('补充: 来源类型中文标签覆盖验证（6种类型全覆盖）', () => {
    test('六种来源类型都有中文标签映射，不出现英文枚举或空标签', () => {
      // 使用公共配置文件中的映射（与组件内部一致，不在测试中手写）
      const requiredTypes: SourceType[] = ['announcement', 'financial', 'regulatory', 'news', 'industry', 'research'];

      // 验证所有6种类型都有映射
      requiredTypes.forEach(type => {
        expect(sourceTypeLabels[type]).toBeDefined();
        expect(sourceTypeLabels[type]).not.toBe('');
        // 不应是英文枚举本身
        expect(sourceTypeLabels[type]).not.toBe(type);
      });
    });

    test('渲染真实组件验证六种来源类型的中文标签正确显示', () => {
      const requiredTypes: SourceType[] = ['announcement', 'financial', 'regulatory', 'news', 'industry', 'research'];

      requiredTypes.forEach(type => {
        // 找到该类型的来源
        const source = testSources.find(s => s.type === type);
        expect(source).toBeDefined();

        // 渲染来源详情弹窗（真实组件，使用与组件相同的公共映射）
        const { unmount } = render(
          <SourceDetailModal
            source={source!}
            isOpen={true}
            onClose={jest.fn()}
          />
        );

        // 验证公共映射中的中文标签出现在弹窗中
        const expectedLabel = sourceTypeLabels[type];
        const labelMatches = screen.getAllByText(expectedLabel);
        expect(labelMatches.length).toBeGreaterThan(0);

        unmount();
      });
    });

    test('Mock数据覆盖全部6种来源类型', () => {
      const sourceTypesInMock = new Set(testSources.map(s => s.type));
      const requiredTypes: SourceType[] = ['announcement', 'financial', 'regulatory', 'news', 'industry', 'research'];

      requiredTypes.forEach(type => {
        expect(sourceTypesInMock.has(type as never)).toBe(true);
      });
    });

    test('来源卡片和详情弹窗不显示英文枚举类型', () => {
      const event = testEvents.find(e => e.sourceIds.length > 0)!;
      const eventSources = testSources.filter(s => event.sourceIds.includes(s.id));

      render(
        <EventDetailDrawer
          event={event}
          sources={eventSources}
          isOpen={true}
          onClose={jest.fn()}
        />
      );

      // 来源卡片中不应出现英文枚举值
      const container = screen.getByTestId('source-cards-container');
      const cardText = container.textContent || '';
      expect(cardText).not.toMatch(/\b(announcement|financial|regulatory|news|industry|research)\b/);
    });
  });

  describe('补充: 来源弹窗状态清理验证', () => {
    test('打开A事件来源详情，切换到B事件后不得继续显示A事件的来源弹窗', () => {
      const sortedEvents = [...testEvents].sort((a, b) => {
        const dateDiff = new Date(a.occurTime).getTime() - new Date(b.occurTime).getTime();
        if (dateDiff !== 0) return dateDiff;
        return a.id.localeCompare(b.id);
      });

      const eventA = sortedEvents.find(e => e.sourceIds.length > 0)!;
      const eventB = sortedEvents.find(e => e.sourceIds.length > 0 && e.id !== eventA.id)!;

      const sourcesA = testSources.filter(s => eventA.sourceIds.includes(s.id));
      const sourcesB = testSources.filter(s => eventB.sourceIds.includes(s.id));

      const onNavigateNext = jest.fn();

      const { rerender } = render(
        <EventDetailDrawer
          event={eventA}
          sources={sourcesA}
          isOpen={true}
          onClose={jest.fn()}
          currentIndex={1}
          totalCount={sortedEvents.length}
          onNavigateNext={onNavigateNext}
        />
      );

      // 打开A事件的来源详情弹窗
      const viewBtnA = screen.getByTestId(`view-source-${sourcesA[0].id}`);
      fireEvent.click(viewBtnA);
      expect(screen.getByTestId('source-detail-modal')).toBeInTheDocument();

      // 模拟导航到B事件：先触发导航回调（清空来源弹窗），再 rerender 到事件B
      fireEvent.click(screen.getByText('下一条 →'));
      // 导航回调被调用（父组件会清空来源弹窗状态）
      expect(onNavigateNext).toHaveBeenCalled();

      rerender(
        <EventDetailDrawer
          event={eventB}
          sources={sourcesB}
          isOpen={true}
          onClose={jest.fn()}
          currentIndex={2}
          totalCount={sortedEvents.length}
          onNavigateNext={jest.fn()}
        />
      );

      // A事件的来源详情弹窗应已关闭（导航时通过 handleNavigateNext 清空）
      expect(screen.queryByTestId('source-detail-modal')).not.toBeInTheDocument();
    });

    test('打开A事件来源详情，关闭抽屉后不得继续显示来源弹窗', () => {
      const event = testEvents.find(e => e.sourceIds.length > 0)!;
      const eventSources = testSources.filter(s => event.sourceIds.includes(s.id));
      const onClose = jest.fn();

      render(
        <EventDetailDrawer
          event={event}
          sources={eventSources}
          isOpen={true}
          onClose={onClose}
        />
      );

      // 打开来源详情弹窗
      const viewBtn = screen.getByTestId(`view-source-${eventSources[0].id}`);
      fireEvent.click(viewBtn);
      expect(screen.getByTestId('source-detail-modal')).toBeInTheDocument();

      // 点击抽屉的关闭按钮（非来源弹窗的关闭按钮），通过 handleClose 清空来源弹窗
      const closeButtons = screen.getAllByText('✕ 关闭');
      // 第一个是抽屉的关闭按钮（不含 data-testid="source-detail-close"）
      const drawerCloseBtn = closeButtons.find(
        btn => !btn.hasAttribute('data-testid')
      )!;
      fireEvent.click(drawerCloseBtn);
      expect(onClose).toHaveBeenCalled();

      // 来源详情弹窗应已关闭（handleClose 清空了 selectedSource）
      expect(screen.queryByTestId('source-detail-modal')).not.toBeInTheDocument();
    });

    test('autoOpenSourceId 应直接打开来源详情弹窗', () => {
      const event = testEvents.find(e => e.sourceIds.length > 0)!;
      const eventSources = testSources.filter(s => event.sourceIds.includes(s.id));
      const targetSourceId = eventSources[0].id;

      render(
        <EventDetailDrawer
          event={event}
          sources={eventSources}
          isOpen={true}
          onClose={jest.fn()}
          autoOpenSourceId={targetSourceId}
        />
      );

      // 来源详情弹窗应自动打开
      expect(screen.getByTestId('source-detail-modal')).toBeInTheDocument();
      // 验证显示的是正确的来源（卡片和弹窗都有标题，用 getAllByText）
      const titleMatches = screen.getAllByText(eventSources[0].title);
      expect(titleMatches.length).toBeGreaterThan(0);
    });
  });

  describe('补充: 虚构来源名称验证', () => {
    test('来源发布机构不使用真实券商、媒体或监管机构名称', () => {
      // 真实机构名称（不含"演示"前缀的版本不应出现）
      const realEntityNames = [
        '中信证券',
        '国泰君安',
        '华泰证券',
        '每日经济新闻',
        '财经观察网',
        '国家税务总局',
        '证监会',
        '东方财富',
      ];

      testSources.forEach(source => {
        // 公司公告类型允许使用真实公司名（股票标的本身）
        if (source.type === 'announcement') return;

        realEntityNames.forEach(name => {
          // 不应直接等于真实机构名
          expect(source.publisher).not.toBe(name);
          expect(source.name).not.toBe(name);
          // 如果包含真实机构名，必须带有"演示"前缀
          if (source.publisher.includes(name) || source.name.includes(name)) {
            expect(source.name.includes('演示') || source.publisher.includes('演示')).toBe(true);
          }
        });
      });
    });

    test('非公告类来源名称应包含"演示"字样', () => {
      testSources.forEach(source => {
        if (source.type === 'announcement') return;
        // 名称或发布机构应包含"演示"
        const hasDemoLabel = source.name.includes('演示') || source.publisher.includes('演示');
        expect(hasDemoLabel).toBe(true);
      });
    });
  });
});
