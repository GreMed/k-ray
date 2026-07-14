'use client';

import { MarketKeyNode } from '@/types';
import { KEY_NODE_TYPE_META, getChangeColorClass, formatVolume } from '@/utils/keyNodeConfig';

interface MarketKeyNodeDrawerProps {
  node: MarketKeyNode | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function MarketKeyNodeDrawer({
  node,
  isOpen,
  onClose,
}: MarketKeyNodeDrawerProps) {
  if (!isOpen || !node) return null;

  const meta = KEY_NODE_TYPE_META[node.type];
  const isUp = node.changePercent >= 0;

  // 成交量变化展示
  let volumeChangeText: string;
  if (node.previousVolume === null) {
    volumeChangeText = '区间内无前一交易日成交量数据';
  } else if (node.previousVolume <= 0) {
    volumeChangeText = '区间内无前一交易日成交量数据';
  } else if (node.volumeChangePercent === null) {
    volumeChangeText = '区间内无前一交易日成交量数据';
  } else {
    const isVolumeUp = node.volumeChangePercent >= 0;
    volumeChangeText = `较前一交易日${isVolumeUp ? '增加' : '减少'} ${Math.abs(node.volumeChangePercent).toFixed(1)}%`;
  }

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/40 z-30"
        onClick={onClose}
        data-testid="market-node-drawer-overlay"
      />

      {/* 抽屉 */}
      <div
        className="fixed top-0 right-0 w-full md:w-[420px] h-full bg-white z-40 shadow-2xl overflow-y-auto"
        data-testid="market-node-drawer"
      >
        {/* 头部 */}
        <div className="sticky top-0 bg-white border-b border-line px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-1 rounded border ${meta.badgeClass}`}>
              {node.title}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink text-sm font-semibold px-2 py-1 rounded hover:bg-paper transition-colors"
            data-testid="market-node-drawer-close"
          >
            ✕ 关闭
          </button>
        </div>

        {/* 内容 */}
        <div className="p-5">
          {/* 仅基于行情数据标注 */}
          <div className="mb-4">
            <span
              className="text-xs text-orange bg-orange/10 px-2 py-1 rounded border border-orange/30 font-semibold"
              data-testid="market-node-evidence-label"
            >
              仅基于行情数据识别，可查看时间邻近的新闻候选
            </span>
          </div>

          {/* 基本信息 */}
          <div className="space-y-4">
            {/* 股票代码 */}
            <div>
              <label className="text-sm font-semibold text-muted block mb-1">
                股票代码
              </label>
              <span className="text-sm text-ink font-bold">
                {node.stockCode}
              </span>
            </div>

            {/* 日期 */}
            <div>
              <label className="text-sm font-semibold text-muted block mb-1">
                日期
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
              <span className={`text-sm font-bold px-3 py-2 rounded border inline-block ${meta.badgeClass}`}>
                {node.title}
              </span>
            </div>

            {/* 当日收盘价 */}
            <div>
              <label className="text-sm font-semibold text-muted block mb-1">
                当日收盘价
              </label>
              <span className="text-sm text-ink font-bold">
                {node.close.toFixed(2)}
              </span>
              {node.previousClose !== null ? (
                <span className="text-xs text-muted ml-2">
                  前收：{node.previousClose.toFixed(2)}
                </span>
              ) : (
                <span className="text-xs text-orange ml-2" data-testid="market-node-no-prev-close">
                  区间内无前收数据
                </span>
              )}
            </div>

            {/* 当日涨跌幅 */}
            <div>
              <label className="text-sm font-semibold text-muted block mb-1">
                当日涨跌幅
              </label>
              <div
                className={`text-sm font-bold px-3 py-2 rounded border inline-block ${getChangeColorClass(node.changePercent)}`}
                data-testid="market-node-change-percent"
              >
                {isUp ? '+' : ''}{node.changePercent.toFixed(2)}%
              </div>
            </div>

            {/* 成交量 */}
            <div>
              <label className="text-sm font-semibold text-muted block mb-1">
                当日成交量
              </label>
              <span className="text-sm text-ink font-bold">
                {formatVolume(node.volume)}
              </span>
              {node.previousVolume !== null && node.previousVolume > 0 && (
                <span className="text-xs text-muted ml-2">
                  前日：{formatVolume(node.previousVolume)}
                </span>
              )}
            </div>

            {/* 成交量变化 */}
            <div>
              <label className="text-sm font-semibold text-muted block mb-1">
                成交量变化
              </label>
              <div
                className={`text-sm font-bold px-3 py-2 rounded border inline-block ${
                  node.volumeChangePercent === null
                    ? 'bg-paper text-muted border-line'
                    : getChangeColorClass(node.volumeChangePercent)
                }`}
                data-testid="market-node-volume-change"
              >
                {volumeChangeText}
              </div>
            </div>

            {/* 仅基于行情数据的事实说明 */}
            <div>
              <label className="text-sm font-semibold text-muted block mb-1">
                行情事实说明
              </label>
              <p
                className="text-sm text-ink leading-relaxed bg-paper p-3 rounded border border-line"
                data-testid="market-node-detail-summary"
              >
                {node.detailSummary}
              </p>
            </div>
          </div>

          {/* 固定风险提示 */}
          <div
            className="mt-6 p-4 bg-ink rounded-lg"
            data-testid="market-node-risk-warning"
          >
            <p className="text-sm text-white font-semibold mb-2">
              风险提示
            </p>
            <p className="text-xs text-white/90 leading-relaxed">
              该节点仅表示行情波动特征，不代表已确认的涨跌原因。可查看与该节点时间邻近的新闻候选，但候选不构成因果关系或投资建议。
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
