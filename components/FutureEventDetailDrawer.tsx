'use client';

import { FutureEvent } from '@/types';
import { eventTypeConfigs } from '@/config/eventTypes';
import { getDateCertaintyConfig } from '@/config/dateCertaintyConfig';

interface FutureEventDetailDrawerProps {
  event: FutureEvent | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function FutureEventDetailDrawer({
  event,
  isOpen,
  onClose,
}: FutureEventDetailDrawerProps) {
  if (!isOpen || !event) return null;

  const config = eventTypeConfigs.find(c => c.type === event.eventType);
  const certainty = getDateCertaintyConfig(event.dateCertainty);

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/50 z-30 transition-opacity"
        onClick={onClose}
      />

      {/* 抽屉面板 */}
      <div className="fixed top-0 right-0 w-full md:w-[500px] h-full bg-white z-40 shadow-2xl overflow-y-auto" data-testid="future-event-drawer">
        {/* 头部 */}
        <div className="sticky top-0 bg-white border-b border-line px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: config?.color }}
            />
            <span className="text-xs font-semibold bg-paper px-2 py-1 rounded">
              {config?.label}
            </span>
          </div>
          <button
            onClick={onClose}
            data-testid="future-event-detail-close"
            className="text-muted hover:text-ink transition-colors text-sm font-semibold"
          >
            ✕ 关闭
          </button>
        </div>

        {/* 内容 */}
        <div className="p-5">
          {/* 事件标题 */}
          <h2 className="text-xl font-bold text-ink mb-4">
            {event.title}
          </h2>

          {/* 演示数据标注 */}
          <div className="mb-4">
            <span className="text-xs text-orange bg-orange/10 px-2 py-1 rounded border border-orange/30 font-semibold">
              演示数据 - 不代表真实事件
            </span>
          </div>

          <div className="space-y-4">
            {/* 事件类型 */}
            <div>
              <label className="text-sm font-semibold text-muted block mb-1">
                事件类型
              </label>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: config?.color }}
                />
                <span className="text-sm text-ink font-semibold">
                  {config?.label}
                </span>
              </div>
            </div>

            {/* 日期及确定性 */}
            <div>
              <label className="text-sm font-semibold text-muted block mb-1">
                日期
              </label>
              {event.dateCertainty === 'tentative' ? (
                <>
                  <span className={`text-sm px-3 py-2 rounded border font-semibold ${certainty.color} inline-block`}>
                    日期待定
                  </span>
                  <p className="text-xs text-orange mt-1">
                    具体日期尚未确认，请以正式公开信息为准。
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <time className="text-sm text-ink font-semibold bg-blue/10 px-3 py-2 rounded">
                      {event.scheduledDate}
                    </time>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${certainty.color}`}>
                      {certainty.label}
                    </span>
                  </div>
                  {event.dateCertainty === 'estimated' && (
                    <p className="text-xs text-orange mt-1">
                      此日期为预计日期，实际时间可能有所调整，请以正式公告为准。
                    </p>
                  )}
                </>
              )}
            </div>

            {/* 事件说明 */}
            <div>
              <label className="text-sm font-semibold text-muted block mb-1">
                事件说明
              </label>
              <p className="text-sm text-ink leading-relaxed bg-paper p-3 rounded">
                {event.description}
              </p>
            </div>

            {/* 为什么值得关注 */}
            <div>
              <label className="text-sm font-semibold text-muted block mb-1">
                为什么值得关注
              </label>
              <p className="text-sm text-ink leading-relaxed bg-blue/5 p-3 rounded border border-blue/10">
                {event.attentionReason}
              </p>
            </div>

            {/* 信息依据 */}
            <div>
              <label className="text-sm font-semibold text-muted block mb-1">
                信息依据
              </label>
              <p className="text-sm text-ink leading-relaxed bg-paper p-3 rounded">
                {event.sourceNote}
              </p>
            </div>
          </div>

          {/* 固定风险提示 */}
          <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-300">
            <p className="text-sm text-yellow-900 font-bold mb-1">
              ⚠️ 风险提示
            </p>
            <p className="text-xs text-yellow-800 leading-relaxed">
              未来事件仅用于时间管理和研究提醒，不代表事件一定发生，也不代表其将导致特定股价表现。
            </p>
          </div>

          {/* 重要提示 */}
          <div className="mt-4 p-4 bg-ink rounded-lg">
            <p className="text-sm text-white font-semibold mb-2">
              重要提示
            </p>
            <ul className="text-xs text-white/90 space-y-1">
              <li>• 此为演示数据，不代表真实事件</li>
              <li>• 不构成投资建议或交易信号</li>
              <li>• 请结合其他信息自行判断</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
