'use client';

import { MarketKeyNode } from '@/types';
import { KEY_NODE_TYPE_META, getChangeColorClass, formatVolume } from '@/utils/keyNodeConfig';

interface KeyNodeListProps {
  nodes: MarketKeyNode[];
  selectedNodeId?: string | null;
  onNodeClick?: (node: MarketKeyNode) => void;
}

export default function KeyNodeList({
  nodes,
  selectedNodeId,
  onNodeClick,
}: KeyNodeListProps) {
  return (
    <div
      className="border border-line rounded-lg bg-white p-4"
      data-testid="key-node-list"
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-base font-bold text-ink">
          关键股价节点
        </h4>
        <span className="text-xs text-muted" data-testid="key-node-count">
          共 {nodes.length} 个节点
        </span>
      </div>

      <p className="text-xs text-muted mb-3">
        点击节点可查看时间邻近的新闻候选；候选仅供复盘查阅，不代表已确认的因果关系
      </p>

      {nodes.length === 0 ? (
        <div
          className="py-8 text-center"
          data-testid="key-node-empty"
        >
          <p className="text-sm text-muted">
            当前区间未识别到符合规则的关键波动节点
          </p>
        </div>
      ) : (
        <div className="space-y-2" data-testid="key-node-items">
          {nodes.map(node => {
            const meta = KEY_NODE_TYPE_META[node.type];
            const isSelected = selectedNodeId === node.id;
            return (
              <button
                key={node.id}
                onClick={() => onNodeClick?.(node)}
                className={`w-full text-left border rounded-lg p-3 transition-colors ${
                  isSelected
                    ? 'border-blue bg-blue/5'
                    : 'border-line hover:bg-paper'
                }`}
                data-testid={`key-node-item-${node.id}`}
              >
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs bg-violet/10 text-violet px-2 py-1 rounded font-semibold">
                    {node.date}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded font-semibold ${meta.badgeClass}`}>
                    {node.title}
                  </span>
                  <span
                    className={`text-xs px-2 py-1 rounded font-semibold ${getChangeColorClass(node.changePercent)}`}
                    data-testid={`key-node-change-${node.id}`}
                  >
                    {node.changePercent >= 0 ? '+' : ''}{node.changePercent.toFixed(1)}%
                  </span>
                </div>
                <p className="text-xs text-muted">
                  收盘价：{node.close.toFixed(2)} · 成交量：{formatVolume(node.volume)}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
