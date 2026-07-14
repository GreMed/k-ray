// 来源类型配置 - 用于事件来源追溯的中文标签映射
// EventDetailDrawer、SourceDetailModal、phase3测试共用同一份映射

import { SourceType } from '@/types';

// 来源类型中文标签映射（不仅靠颜色，同时有文字标签）
export const sourceTypeLabels: Record<SourceType, string> = {
  announcement: '公司公告',
  financial: '财务报告',
  regulatory: '监管文件',
  news: '公开新闻',
  industry: '行业信息',
  research: '券商观点',
};

// 获取来源类型中文标签
export function getSourceTypeLabel(type: SourceType): string {
  return sourceTypeLabels[type] || type;
}
