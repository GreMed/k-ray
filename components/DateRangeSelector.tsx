'use client';

// 时间区间选择组件

interface DateRangeSelectorProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

export default function DateRangeSelector({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange
}: DateRangeSelectorProps) {
  return (
    <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
      {/* 开始时间 */}
      <div className="flex-1 md:w-[190px]">
        <label className="block text-sm font-semibold text-ink mb-2">
          复盘开始时间
        </label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="w-full h-[42px] px-3 border border-line rounded-lg bg-white text-ink font-semibold outline-none focus:border-blue focus:ring-1 focus:ring-blue transition-all"
        />
      </div>

      {/* 结束时间 */}
      <div className="flex-1 md:w-[190px]">
        <label className="block text-sm font-semibold text-ink mb-2">
          复盘结束时间
        </label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="w-full h-[42px] px-3 border border-line rounded-lg bg-white text-ink font-semibold outline-none focus:border-blue focus:ring-1 focus:ring-blue transition-all"
        />
      </div>
    </div>
  );
}