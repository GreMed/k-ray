// 事件类型配置 - 用于K线图标记和分类

import { EventType } from '@/types';

export interface EventTypeConfigItem {
  type: EventType;
  label: string;
  shortLabel: string;
  color: string;
  description: string;
}

export const eventTypeConfigs: EventTypeConfigItem[] = [
  {
    type: 'performance',
    label: '财报业绩类',
    shortLabel: '业绩',
    color: '#2a9d8f',
    description: '业绩超预期 / 低于预期、指引调整'
  },
  {
    type: 'announcement',
    label: '公司公告类',
    shortLabel: '公告',
    color: '#2563eb',
    description: '重大事项、人事变动、回购公告'
  },
  {
    type: 'policy',
    label: '行业政策类',
    shortLabel: '政策',
    color: '#f4a261',
    description: '监管变化、政策落地、补贴调整'
  },
  {
    type: 'order',
    label: '订单客户类',
    shortLabel: '订单',
    color: '#0f8b8d',
    description: '大订单、客户结构变化、放量验证'
  },
  {
    type: 'capital',
    label: '资本市场类',
    shortLabel: '资本',
    color: '#7c3aed',
    description: '定增、回购、减持、解禁'
  },
  {
    type: 'sector',
    label: '板块行情类',
    shortLabel: '板块',
    color: '#0ea5e9',
    description: '板块整体上涨或调整'
  },
  {
    type: 'expectation',
    label: '机构预期类',
    shortLabel: '机构',
    color: '#db2777',
    description: '评级调整、目标价变化、关键券商观点'
  },
  {
    type: 'risk',
    label: '风险事件类',
    shortLabel: '风险',
    color: '#e76f51',
    description: '诉讼、处罚、产业链负面信号'
  }
];

// 获取事件类型配置
export function getEventTypeConfig(type: EventType): EventTypeConfigItem {
  return eventTypeConfigs.find(config => config.type === type) || eventTypeConfigs[0];
}

// 获取事件类型颜色
export function getEventColor(type: EventType): string {
  return getEventTypeConfig(type).color;
}

// 获取事件类型标签
export function getEventLabel(type: EventType): string {
  return getEventTypeConfig(type).label;
}

// 获取事件类型短标签
export function getEventShortLabel(type: EventType): string {
  return getEventTypeConfig(type).shortLabel;
}