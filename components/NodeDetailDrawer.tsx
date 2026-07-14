'use client';

import { KeyNode } from '@/types';

interface NodeDetailDrawerProps {
  node: KeyNode | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function NodeDetailDrawer({
  node,
  isOpen,
  onClose
}: NodeDetailDrawerProps) {
  if (!isOpen || !node) return null;

  // 节点类型映射
  const nodeTypeLabels = {
    peak: '阶段性高点',
    bottom: '阶段性低点',
    breakout: '突破信号',
    breakdown: '跌破信号',
    turn: '趋势拐点'
  };
  
  const nodeTypeColors = {
    peak: 'text-red bg-red/10 border-red/20',
    bottom: 'text-green bg-green/10 border-green/20',
    breakout: 'text-blue bg-blue/10 border-blue/20',
    breakdown: 'text-orange bg-orange/10 border-orange/20',
    turn: 'text-violet bg-violet/10 border-violet/20'
  };

  const typeLabel = nodeTypeLabels[node.nodeType] || node.nodeType;
  const typeColorClass = nodeTypeColors[node.nodeType] || 'text-muted bg-paper border-line';
  const significanceLabel = node.significance === 'high' ? '高重要性' : '中等重要性';
  const significanceColorClass = node.significance === 'high' 
    ? 'bg-red/10 text-red border-red/20' 
    : 'bg-orange/10 text-orange border-orange/20';

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/40 z-30"
        onClick={onClose}
      />
      
      {/* 抽屉 */}
      <div className="fixed top-0 right-0 w-full md:w-[400px] h-full bg-white z-40 shadow-2xl overflow-y-auto" data-testid="node-detail-drawer">
        {/* 头部 */}
        <div className="sticky top-0 bg-white border-b border-line px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-1 rounded border ${typeColorClass}`}>
              {typeLabel}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink text-sm font-semibold px-2 py-1 rounded hover:bg-paper transition-colors"
          >
            ✕ 关闭
          </button>
        </div>
        
        {/* 内容 */}
        <div className="p-5">
          {/* 演示标注 */}
          <div className="mb-4">
            <span className="text-xs text-orange bg-orange/10 px-2 py-1 rounded border border-orange/30 font-semibold">
              ⚠️ 演示数据 - 不代表真实节点
            </span>
          </div>
          
          {/* 基本信息 */}
          <div className="space-y-4">
            {/* 节点日期 */}
            <div>
              <label className="text-sm font-semibold text-muted block mb-1">
                节点日期
              </label>
              <time className="text-sm text-ink font-bold bg-violet/10 px-3 py-2 rounded border border-violet/20 inline-block">
                {node.date}
              </time>
            </div>
            
            {/* 节点类型 */}
            <div>
              <label className="text-sm font-semibold text-muted block mb-1">
                节点类型
              </label>
              <span className={`text-sm font-bold px-3 py-2 rounded border inline-block ${typeColorClass}`}>
                {typeLabel}
              </span>
            </div>
            
            {/* 价格变化 */}
            <div>
              <label className="text-sm font-semibold text-muted block mb-1">
                价格变化幅度
              </label>
              <div className={`text-sm font-bold px-3 py-2 rounded border inline-block ${
                node.priceChange > 0 
                  ? 'bg-green/10 text-green border-green/20' 
                  : 'bg-red/10 text-red border-red/20'
              }`}>
                {node.priceChange > 0 ? '+' : ''}{node.priceChange}%
              </div>
            </div>
            
            {/* 重要程度 */}
            <div>
              <label className="text-sm font-semibold text-muted block mb-1">
                重要程度
              </label>
              <span className={`text-sm font-bold px-3 py-2 rounded border inline-block ${significanceColorClass}`}>
                {significanceLabel}
              </span>
            </div>
            
            {/* 节点描述 */}
            {node.description && (
              <div>
                <label className="text-sm font-semibold text-muted block mb-1">
                  节点描述
                </label>
                <p className="text-sm text-ink leading-relaxed bg-paper p-3 rounded border border-line">
                  {node.description}
                </p>
              </div>
            )}
          </div>
          
          {/* 底部提示 */}
          <div className="mt-6 p-4 bg-ink rounded-lg">
            <p className="text-sm text-white font-semibold mb-2">
              重要提示
            </p>
            <ul className="text-xs text-white/90 space-y-1">
              <li>• 此为演示数据，不代表真实节点</li>
              <li>• 节点识别仅为辅助分析工具</li>
              <li>• 不构成投资建议或交易信号</li>
              <li>• 请结合其他信息自行判断</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}