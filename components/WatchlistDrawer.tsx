// K-Ray 第二十阶段 A：自选股抽屉
//
// 从右侧滑入的轻量抽屉，展示：
// 1. 自选股列表（查看/移除）
// 2. 登录/云同步占位（不发起网络请求，不收集个人信息）
// 3. 本地数据保存范围提示

'use client';

import { useState } from 'react';
import { useWatchlist } from '@/hooks/useWatchlist';

interface WatchlistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onViewStock?: (stockCode: string, market: 'SH' | 'SZ', stockName: string) => void;
}

export default function WatchlistDrawer({ isOpen, onClose, onViewStock }: WatchlistDrawerProps) {
  const { items, remove, count, isReady, errorMessage, clearError } = useWatchlist();
  const [showCloudSyncInfo, setShowCloudSyncInfo] = useState(false);

  if (!isOpen) return null;

  const handleView = (stockCode: string, market: 'SH' | 'SZ', stockName: string) => {
    if (onViewStock) {
      onViewStock(stockCode, market, stockName);
    }
    onClose();
  };

  return (
    <>
      {/* 遮罩层 */}
      <div
        data-testid="watchlist-drawer-overlay"
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* 抽屉主体 */}
      <div
        data-testid="watchlist-drawer"
        className="fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 shadow-xl flex flex-col"
      >
        {/* 抽屉头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-line shrink-0">
          <h2 className="text-base font-bold text-ink">
            我的自选（{count}）
          </h2>
          <button
            data-testid="watchlist-drawer-close"
            onClick={onClose}
            className="px-2 py-1 text-sm text-muted hover:text-ink transition-colors"
            aria-label="关闭自选列表"
          >
            ✕
          </button>
        </div>

        {/* 抽屉内容（可滚动） */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* 自选列表 */}
          {!isReady ? (
            <p className="text-sm text-muted text-center py-8">加载中…</p>
          ) : count === 0 ? (
            <div data-testid="watchlist-empty" className="text-center py-8">
              <p className="text-sm text-muted mb-2">暂未添加自选股</p>
              <p className="text-xs text-muted/70">
                查询股票后，可点击&ldquo;加入自选&rdquo;保存到当前浏览器。
              </p>
            </div>
          ) : (
            <ul data-testid="watchlist-items" className="space-y-2">
              {items.map((item) => (
                <li
                  key={`${item.stockCode}:${item.market}`}
                  data-testid={`watchlist-item-${item.stockCode}`}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-line hover:bg-paper transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink truncate">
                      {(item.stockName && item.stockName.trim()) ? item.stockName : '名称暂未获取'}
                    </p>
                    <p className="text-xs text-muted">
                      {item.stockCode} · {item.market}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      data-testid={`watchlist-view-${item.stockCode}`}
                      onClick={() => handleView(item.stockCode, item.market, item.stockName)}
                      className="px-2.5 py-1 text-xs font-medium text-blue hover:bg-blue/5 rounded border border-blue/20 transition-colors"
                    >
                      查看
                    </button>
                    <button
                      data-testid={`watchlist-remove-${item.stockCode}`}
                      onClick={() => remove(item.stockCode, item.market)}
                      className="px-2.5 py-1 text-xs text-muted hover:text-red rounded transition-colors"
                    >
                      移除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* 本地数据提示 */}
          <div className="mt-4 pt-3 border-t border-line">
            <p data-testid="local-data-hint" className="text-xs text-muted leading-relaxed">
              个人数据目前仅保存在此浏览器，云端同步即将开放。
            </p>
          </div>

          {/* 保存失败提示（写入 localStorage 失败时显示） */}
          {errorMessage && (
            <div
              data-testid="watchlist-save-error"
              className="mt-2 px-3 py-2 text-xs text-red bg-red/5 border border-red/20 rounded-lg flex items-center justify-between gap-2"
            >
              <span>{errorMessage}</span>
              <button
                onClick={clearError}
                className="text-muted hover:text-ink shrink-0"
                aria-label="关闭提示"
              >
                ✕
              </button>
            </div>
          )}

          {/* 登录 / 云端同步占位 */}
          <div className="mt-3">
            <button
              data-testid="cloud-sync-entry"
              onClick={() => setShowCloudSyncInfo(true)}
              className="w-full px-3 py-2 text-sm font-medium text-muted bg-paper border border-line rounded-lg hover:bg-line/30 transition-colors text-center"
            >
              登录 / 云端同步
              <span className="ml-1.5 text-xs text-muted/60">即将开放</span>
            </button>
          </div>
        </div>
      </div>

      {/* 云同步占位说明弹窗 */}
      {showCloudSyncInfo && (
        <div
          data-testid="cloud-sync-info-modal"
          className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4"
          onClick={() => setShowCloudSyncInfo(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-ink">账户与云同步</h3>
              <button
                data-testid="cloud-sync-info-close"
                onClick={() => setShowCloudSyncInfo(false)}
                className="px-2 py-1 text-sm text-muted hover:text-ink"
                aria-label="关闭"
              >
                ✕
              </button>
            </div>
            <p data-testid="cloud-sync-info-text" className="text-sm text-muted leading-relaxed">
              账户与跨设备云同步即将开放。
              <br /><br />
              当前版本无需登录。自选股、复盘笔记和用户添加的未来事件仅保存在当前浏览器中。清理浏览器数据后可能丢失。
            </p>
            <div className="mt-4 text-right">
              <button
                data-testid="cloud-sync-info-ok"
                onClick={() => setShowCloudSyncInfo(false)}
                className="px-4 py-1.5 text-sm font-medium text-blue border border-blue/30 rounded-lg hover:bg-blue/5 transition-colors"
              >
                知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
