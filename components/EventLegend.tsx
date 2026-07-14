'use client';

import { eventTypeConfigs } from '@/config/eventTypes';

// 事件分类图例组件

export default function EventLegend() {
  return (
    <div className="w-full border border-line rounded-lg bg-white/88 shadow-lg p-5" data-testid="event-legend">
      <h3 className="text-lg font-bold text-ink mb-4">
        事件分类图例
      </h3>
      <p className="text-sm text-muted mb-4">
        不同类型的驱动事件以不同颜色的圆点与标签呈现,帮助您一眼区分某段行情主要由哪类因素驱动。
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {eventTypeConfigs.map(config => (
          <div
            key={config.type}
            className="flex items-center gap-2 min-h-[44px] border border-line rounded-lg bg-white px-3 py-2"
          >
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: config.color }}
            />
            <div className="flex-1">
              <span className="text-sm font-bold text-ink block">
                {config.label}
              </span>
              <span className="text-xs text-muted block">
                {config.description}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}