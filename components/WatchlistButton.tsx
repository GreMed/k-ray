// K-Ray 第二十阶段 A：自选股按钮
//
// 在股票名称附近显示轻量按钮，支持加入/取消自选。
// 按钮不喧宾夺主，保持 K-Ray 现有视觉风格。
// 写入失败时显示轻量提示，不显示"已加入"。

'use client';

import { useWatchlist } from '@/hooks/useWatchlist';

interface WatchlistButtonProps {
  stockCode: string;
  stockName: string;
  market: 'SH' | 'SZ';
}

export default function WatchlistButton({ stockCode, stockName, market }: WatchlistButtonProps) {
  const { isWatched, add, remove, isReady, errorMessage, clearError } = useWatchlist();

  // SSR 或首次渲染时未加载 localStorage，渲染占位但不显示交互状态
  if (!isReady) {
    return (
      <button
        data-testid="watchlist-button"
        disabled
        className="px-2.5 py-1 text-xs font-medium text-muted border border-line rounded-lg opacity-50"
        aria-label="加入自选"
      >
        ☆ 加入自选
      </button>
    );
  }

  const watched = isWatched(stockCode, market);

  const handleClick = () => {
    if (watched) {
      remove(stockCode, market);
    } else {
      add({ stockCode, stockName, market });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        data-testid="watchlist-button"
        data-watchlist-state={watched ? 'watched' : 'unwatched'}
        onClick={handleClick}
        className={
          watched
            ? 'px-2.5 py-1 text-xs font-medium text-gold border border-gold/30 rounded-lg hover:bg-gold/5 transition-colors'
            : 'px-2.5 py-1 text-xs font-medium text-muted hover:text-gold border border-line rounded-lg hover:border-gold/30 transition-colors'
        }
        aria-label={watched ? '取消自选' : '加入自选'}
      >
        {watched ? '★ 已加入本机自选' : '☆ 加入自选'}
      </button>
      {errorMessage && (
        <span
          data-testid="watchlist-save-error"
          className="text-xs text-red"
          onClick={clearError}
          role="button"
          tabIndex={0}
        >
          {errorMessage}
        </span>
      )}
    </div>
  );
}
