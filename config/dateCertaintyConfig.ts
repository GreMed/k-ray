// 日期确定性配置 - FutureEventCalendar、FutureEventDetailDrawer、phase4测试共用
import { FutureEventDateCertainty } from '@/types';

export interface DateCertaintyConfigItem {
  key: FutureEventDateCertainty;
  label: string;
  dateFieldLabel: string;
  color: string;
}

export const dateCertaintyConfigs: DateCertaintyConfigItem[] = [
  {
    key: 'confirmed',
    label: '已确认',
    dateFieldLabel: '确认日期',
    color: 'bg-green/10 text-green border-green/20',
  },
  {
    key: 'estimated',
    label: '预计日期',
    dateFieldLabel: '预计日期',
    color: 'bg-blue/10 text-blue border-blue/20',
  },
  {
    key: 'tentative',
    label: '日期待定',
    dateFieldLabel: '暂定日期',
    color: 'bg-orange/10 text-orange border-orange/20',
  },
];

// 获取日期确定性配置
export function getDateCertaintyConfig(certainty: FutureEventDateCertainty): DateCertaintyConfigItem {
  return dateCertaintyConfigs.find(c => c.key === certainty) || dateCertaintyConfigs[2];
}
