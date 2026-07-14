// 第十六阶段 里程碑二：A股财报法定最晚披露日集中配置
// 规则来源：中国证监会《上市公司信息披露管理办法》（证监会令第226号，2025-07-01 起施行）
// 年报：次年4月30日前；半年报：当年8月31日前；一季报：当年4月30日前；三季报：当年10月31日前
// 集中配置，不散落在组件中

export type ReportType = 'annual' | 'semi-annual' | 'q1' | 'q3';

export interface ReportDeadlineConfig {
  reportType: ReportType;
  label: string;            // 如 "年度报告"
  deadlineMonth: number;    // 1-12
  deadlineDay: number;      // 月内最晚日
  // 根据报告年份计算法定最晚披露日
  getDeadline: (reportYear: number) => string;
}

function formatDeadline(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export const REPORT_DEADLINES: ReportDeadlineConfig[] = [
  {
    reportType: 'annual',
    label: '年度报告',
    deadlineMonth: 4,
    deadlineDay: 30,
    getDeadline: (reportYear: number) => formatDeadline(reportYear + 1, 4, 30),
  },
  {
    reportType: 'semi-annual',
    label: '半年度报告',
    deadlineMonth: 8,
    deadlineDay: 31,
    getDeadline: (reportYear: number) => formatDeadline(reportYear, 8, 31),
  },
  {
    reportType: 'q1',
    label: '一季度报告',
    deadlineMonth: 4,
    deadlineDay: 30,
    getDeadline: (reportYear: number) => formatDeadline(reportYear, 4, 30),
  },
  {
    reportType: 'q3',
    label: '三季度报告',
    deadlineMonth: 10,
    deadlineDay: 31,
    getDeadline: (reportYear: number) => formatDeadline(reportYear, 10, 31),
  },
];

// 根据基准日获取未来 N 个月内可能到期的法定披露日
// 只返回截止日在 [fromDate, fromDate + N months] 范围内的
export function getUpcomingStatutoryDeadlines(
  fromDate: string,
  monthsAhead: number = 3,
): Array<{
  reportType: ReportType;
  label: string;
  deadline: string;
  reportYear: number;
}> {
  const from = new Date(fromDate + 'T00:00:00.000Z');
  const to = new Date(from);
  to.setUTCMonth(to.getUTCMonth() + monthsAhead);

  const results: Array<{
    reportType: ReportType;
    label: string;
    deadline: string;
    reportYear: number;
  }> = [];

  // 检查当前年和前一年的各类报告截止日
  for (const config of REPORT_DEADLINES) {
    for (const reportYear of [from.getUTCFullYear() - 1, from.getUTCFullYear()]) {
      const deadline = config.getDeadline(reportYear);
      const deadlineDate = new Date(deadline + 'T00:00:00.000Z');
      if (deadlineDate >= from && deadlineDate <= to) {
        results.push({
          reportType: config.reportType,
          label: `${reportYear}年${config.label}`,
          deadline,
          reportYear,
        });
      }
    }
  }

  return results.sort((a, b) => a.deadline.localeCompare(b.deadline));
}

// 获取法定期限标签（用于 UI 显示）
export function getDeadlineLabel(reportType: ReportType): string {
  const config = REPORT_DEADLINES.find(c => c.reportType === reportType);
  return config?.label || '未知报告类型';
}
