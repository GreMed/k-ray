'use client';

import { useState } from 'react';

interface DateQuickOptionsProps {
  onSelect: (startDate: string, endDate: string) => void;
  currentStartDate: string;
  currentEndDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  // 演示模式下以Mock数据最后日期为基准，不使用现实中的今天
  referenceEndDate: string;
  // 数据实际覆盖范围（用于显示部分覆盖提示）
  dataCoverageStart?: string;
  dataCoverageEnd?: string;
}

export default function DateQuickOptions({
  onSelect,
  currentStartDate,
  currentEndDate,
  onStartDateChange,
  onEndDateChange,
  referenceEndDate,
  dataCoverageStart,
  dataCoverageEnd,
}: DateQuickOptionsProps) {
  const [selectedOption, setSelectedOption] = useState<string>('custom');

  // 以 referenceEndDate 为基准计算快捷区间
  const calculateDateRange = (months: number): { start: string; end: string } => {
    const end = new Date(referenceEndDate);
    const start = new Date(referenceEndDate);
    start.setMonth(start.getMonth() - months);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  };

  // 快捷选项
  const quickOptions = [
    { key: '1m', label: '近1个月', months: 1 },
    { key: '3m', label: '近3个月', months: 3 },
    { key: '6m', label: '近6个月', months: 6 },
    { key: '1y', label: '近1年', months: 12 },
    { key: 'custom', label: '自定义', months: 0 },
  ];

  const handleQuickSelect = (key: string, months: number) => {
    setSelectedOption(key);
    if (months > 0) {
      const range = calculateDateRange(months);
      onSelect(range.start, range.end);
    }
  };

  // 检查快捷区间与数据覆盖范围的关系
  const getCoverageNote = (start: string): string | null => {
    if (!dataCoverageStart || !dataCoverageEnd) return null;
    if (new Date(start) < new Date(dataCoverageStart)) {
      return `数据实际覆盖范围：${dataCoverageStart} 至 ${dataCoverageEnd}，部分区间无数据`;
    }
    return null;
  };

  const coverageNote = selectedOption !== 'custom' ? getCoverageNote(currentStartDate) : null;

  return (
    <div className="w-full" data-testid="date-quick-options">
      {/* 快捷选项按钮 */}
      <div className="flex flex-wrap gap-2 mb-3">
        {quickOptions.map(opt => (
          <button
            key={opt.key}
            onClick={() => handleQuickSelect(opt.key, opt.months)}
            data-testid={`quick-option-${opt.key}`}
            className={`px-3 py-1.5 text-xs font-semibold rounded border transition-all ${
              selectedOption === opt.key
                ? 'bg-blue text-white border-blue'
                : 'bg-paper text-muted border-line hover:bg-blue/10 hover:text-blue hover:border-blue/30'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 自定义日期选择器 */}
      {selectedOption === 'custom' && (
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-ink mb-1.5">
              开始日期
            </label>
            <input
              type="date"
              value={currentStartDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="w-full h-[40px] px-3 border border-line rounded-lg bg-white text-ink font-semibold outline-none focus:border-blue focus:ring-1 focus:ring-blue transition-all"
              max={referenceEndDate}
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-semibold text-ink mb-1.5">
              结束日期
            </label>
            <input
              type="date"
              value={currentEndDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="w-full h-[40px] px-3 border border-line rounded-lg bg-white text-ink font-semibold outline-none focus:border-blue focus:ring-1 focus:ring-blue transition-all"
              max={referenceEndDate}
            />
          </div>
        </div>
      )}

      {/* 当前选择的日期范围显示 */}
      {selectedOption !== 'custom' && (
        <div className="flex items-center gap-2 text-xs text-muted bg-blue/10 px-3 py-2 rounded border border-blue/20">
          <span className="font-semibold">已选择:</span>
          <span className="text-blue font-bold">{currentStartDate}</span>
          <span>至</span>
          <span className="text-blue font-bold">{currentEndDate}</span>
          <span className="text-muted ml-2">（基准日：{referenceEndDate}）</span>
          <button
            onClick={() => setSelectedOption('custom')}
            className="ml-auto text-muted hover:text-blue underline"
          >
            修改
          </button>
        </div>
      )}

      {/* 数据覆盖范围提示 */}
      {coverageNote && (
        <div className="mt-2 p-2 bg-orange/10 rounded border border-orange/20">
          <p className="text-xs text-orange font-semibold">
            ⚠️ {coverageNote}
          </p>
        </div>
      )}
    </div>
  );
}
