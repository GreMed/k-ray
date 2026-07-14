'use client';

import { MarketDataMeta } from '@/types';

interface RiskWarningProps {
  marketMeta?: MarketDataMeta;
}

export default function RiskWarning({ marketMeta }: RiskWarningProps) {
  // 根据行情状态决定数据说明文案
  // 真实模式：不提及 Mock 事件/来源/未来日历
  // Mock 模式：保留原有演示数据说明
  const dataNoteText = marketMeta?.isRealMarketData
    ? '行情数据说明——当前K线来自BaoStock真实历史日线。当前可查看与关键节点时间邻近的新闻候选；候选仅供复盘查阅，不构成已确认的涨跌原因。'
    : marketMeta?.fallbackReason
      ? '行情数据说明——BaoStock当前不可用，本次K线已降级为本地Mock演示数据。'
      : '演示数据说明——当前K线及配套内容使用本地Mock数据，仅供功能演示。';

  const dataNoteColor = marketMeta?.isRealMarketData
    ? 'text-green'
    : marketMeta?.fallbackReason
      ? 'text-yellow'
      : 'text-orange';

  return (
    <div className="w-full bg-ink rounded-lg shadow-lg p-5" data-testid="risk-warning">
      <h3 className="text-lg font-bold text-white mb-3">
        ⚠️ 重要风险提示
      </h3>

      <ul className="space-y-2">
        <li className="flex items-start gap-2">
          <span className="text-red font-bold text-sm">•</span>
          <span className="text-sm text-white/90 leading-relaxed">
            <strong className="text-white">不预测股价</strong> — K-Ray 只做历史复盘，不对未来价格走势做出任何预测或判断。
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-red font-bold text-sm">•</span>
          <span className="text-sm text-white/90 leading-relaxed">
            <strong className="text-white">不构成投资建议</strong> — K-Ray 不会给出任何买入、卖出或持有的操作建议，不提供交易信号。
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-red font-bold text-sm">•</span>
          <span className="text-sm text-white/90 leading-relaxed">
            <strong className="text-white">节点仅表示行情波动特征</strong> — 关键股价节点基于可计算的行情数据识别，不代表已确认的涨跌原因。当前可查看与节点时间邻近的新闻候选，但候选不构成因果关系或投资建议。
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className={`${dataNoteColor} font-bold text-sm`}>•</span>
          <span className="text-sm text-white/90 leading-relaxed" data-testid="risk-data-note">
            <strong className="text-white">{dataNoteText}</strong>
          </span>
        </li>
      </ul>

      <div className="mt-4 p-3 bg-white/10 rounded border border-white/20">
        <p className="text-xs text-white/80">
          K-Ray 定位为走势复盘工具，帮助用户更快看懂过去发生了什么。投资决策请结合自身判断，并咨询专业投资顾问。
        </p>
      </div>
    </div>
  );
}
