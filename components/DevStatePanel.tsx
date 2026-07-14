'use client';

import { useState } from 'react';
import { Stock, ReplayResult, PageState } from '@/types';
import { DEMO_STOCK, DEMO_START_DATE, DEMO_END_DATE, simulateReplay, isDevEnvironment } from '@/utils/devHelpers';

interface DevStatePanelProps {
  onStateChange: (state: PageState) => void;
  onLoadReplay: (stock: Stock, startDate: string, endDate: string, result: ReplayResult) => void;
  currentStock: Stock | null;
  currentStartDate: string;
  currentEndDate: string;
}

export default function DevStatePanel({
  onStateChange,
  onLoadReplay,
  currentStock,
  currentStartDate,
  currentEndDate
}: DevStatePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 生产环境不渲染任何内容
  if (!isDevEnvironment()) {
    return null;
  }

  // 触发成功状态：同步股票、日期和结果数据
  const handleSuccessDemo = async () => {
    const stock = DEMO_STOCK;
    const startDate = DEMO_START_DATE;
    const endDate = DEMO_END_DATE;

    onStateChange('loading');
    const { state, result } = await simulateReplay(stock.id, startDate, endDate, 1000);
    
    if (state === 'success' && result) {
      onLoadReplay(stock, startDate, endDate, result);
    } else {
      onStateChange('empty');
    }
  };

  // 使用当前选中的股票和日期触发成功状态
  const handleSuccessWithCurrent = async () => {
    if (!currentStock) {
      // 如果没有选中股票，使用演示默认值
      await handleSuccessDemo();
      return;
    }

    onStateChange('loading');
    const { state, result } = await simulateReplay(
      currentStock.id, 
      currentStartDate, 
      currentEndDate, 
      1000
    );
    
    if (state === 'success' && result) {
      onLoadReplay(currentStock, currentStartDate, currentEndDate, result);
    } else {
      onStateChange('empty');
    }
  };

  return (
    <div className="mb-6 p-3 bg-violet/10 border border-violet/30 rounded-lg">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-violet">开发模式</span>
          <span className="text-xs text-muted">
            状态演示入口（仅开发环境可见，生产构建自动移除）
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs px-3 py-1.5 rounded border border-violet/40 text-violet font-semibold hover:bg-violet/10 transition-colors"
          >
            {isExpanded ? '收起状态面板' : '展开状态演示面板'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-violet/20">
          <p className="text-xs text-muted mb-2">点击下方按钮直接切换到对应状态（成功状态会同步股票、日期和结果数据）：</p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => onStateChange('initial')}
              className="text-xs px-3 py-1.5 rounded bg-ink text-white font-semibold hover:bg-ink/80 transition-colors"
            >
              初始状态
            </button>
            <button
              onClick={() => onStateChange('loading')}
              className="text-xs px-3 py-1.5 rounded bg-blue text-white font-semibold hover:bg-blue/80 transition-colors"
            >
              加载状态
            </button>
            <button
              onClick={handleSuccessDemo}
              className="text-xs px-3 py-1.5 rounded bg-green text-white font-semibold hover:bg-green/80 transition-colors"
            >
              成功状态（示例数据）
            </button>
            {currentStock && (
              <button
                onClick={handleSuccessWithCurrent}
                className="text-xs px-3 py-1.5 rounded bg-green/80 text-white font-semibold hover:bg-green/70 transition-colors"
              >
                成功状态（当前选择）
              </button>
            )}
            <button
              onClick={() => onStateChange('empty')}
              className="text-xs px-3 py-1.5 rounded bg-orange text-white font-semibold hover:bg-orange/80 transition-colors"
            >
              空结果状态
            </button>
            <button
              onClick={() => onStateChange('error')}
              className="text-xs px-3 py-1.5 rounded bg-red text-white font-semibold hover:bg-red/80 transition-colors"
            >
              错误状态
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
