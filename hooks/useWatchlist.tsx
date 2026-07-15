// K-Ray 第二十阶段 A：自选股全局状态 Context
//
// 通过 React Context 在整个应用内共享单一自选状态实例，
// 避免多个组件各自维护互相冲突的自选列表。
// - 初始加载在 useEffect 中执行，确保 SSR 期间不访问 localStorage
// - 通过 storage 事件实现多标签页同步
// - 添加/移除操作立即更新状态并持久化，写入失败时提示用户

'use client';

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import {
  loadWatchlist,
  addToWatchlist as addToStorage,
  removeFromWatchlist as removeFromStorage,
  isInWatchlist,
} from '@/services/watchlist';
import type { WatchlistItem } from '@/types';

export interface WatchlistContextValue {
  items: WatchlistItem[];
  count: number;
  isReady: boolean;
  // 最近一次操作失败提示（写入失败时设置，下一次操作成功或手动清除时清空）
  errorMessage: string | null;
  isWatched: (stockCode: string, market: string) => boolean;
  add: (item: Omit<WatchlistItem, 'addedAt'>) => void;
  remove: (stockCode: string, market: string) => void;
  clearError: () => void;
}

const SAVE_FAILED_ADD_MESSAGE = '浏览器保存失败，本次未加入自选。';
const SAVE_FAILED_REMOVE_MESSAGE = '浏览器保存失败，本次未移除自选。';

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  // 初始为空数组，SSR 和首次渲染时不访问 localStorage
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 客户端挂载后加载 localStorage 数据
  // SSR 安全：首次渲染不访问 localStorage，挂载后通过 useEffect 读取
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setItems(loadWatchlist());
    setIsReady(true);

    // 监听其他标签页的 localStorage 变化
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'k-ray:watchlist:v1') {
        setItems(loadWatchlist());
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const add = useCallback((item: Omit<WatchlistItem, 'addedAt'>) => {
    const result = addToStorage(items, item);
    if (!result.save.ok) {
      setErrorMessage(SAVE_FAILED_ADD_MESSAGE);
      return; // 写入失败，保留旧状态
    }
    setErrorMessage(null);
    setItems(result.items);
  }, [items]);

  const remove = useCallback((stockCode: string, market: string) => {
    const result = removeFromStorage(items, stockCode, market);
    if (!result.save.ok) {
      setErrorMessage(SAVE_FAILED_REMOVE_MESSAGE);
      return; // 移除失败，保留原自选
    }
    setErrorMessage(null);
    setItems(result.items);
  }, [items]);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const isWatched = useCallback(
    (stockCode: string, market: string) => {
      return isInWatchlist(items, stockCode, market);
    },
    [items],
  );

  const value: WatchlistContextValue = {
    items,
    count: items.length,
    isReady,
    errorMessage,
    isWatched,
    add,
    remove,
    clearError,
  };

  return (
    <WatchlistContext.Provider value={value}>
      {children}
    </WatchlistContext.Provider>
  );
}

// 使用自选股状态的 Hook
// 在 WatchlistProvider 内使用时返回共享状态；
// 在无 Provider 的测试环境中返回空状态的本地实现，不抛错
export function useWatchlist(): WatchlistContextValue {
  const ctx = useContext(WatchlistContext);

  // 无 Provider 时（如单元测试中直接渲染组件），返回安全的空状态
  if (!ctx) {
    return {
      items: [],
      count: 0,
      isReady: false,
      errorMessage: null,
      isWatched: () => false,
      add: () => {},
      remove: () => {},
      clearError: () => {},
    };
  }

  return ctx;
}
