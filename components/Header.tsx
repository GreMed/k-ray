'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PersonalSearchSettings from './PersonalSearchSettings';
import WatchlistDrawer from './WatchlistDrawer';
import { useWatchlist } from '@/hooks/useWatchlist';

/**
 * 品牌头部组件
 *
 * 第十三阶段 B0：在右侧增加"个人搜索服务设置"入口。
 * 第二十阶段 A：在右侧增加"我的自选"入口，点击打开抽屉。
 * 第二十阶段 A 验收修复：恢复移动端"个人搜索服务设置"入口（放入移动端菜单）。
 */

export default function Header() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // 每次打开弹窗时递增 counter，作为 PersonalSearchSettings 的 key 触发重新挂载
  // 确保每次打开时从 sessionStorage 重新读取配置状态
  const [openCounter, setOpenCounter] = useState(0);
  const [isWatchlistOpen, setIsWatchlistOpen] = useState(false);
  // 移动端菜单展开状态
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { count, isReady } = useWatchlist();
  const router = useRouter();

  const handleOpenSettings = () => {
    setOpenCounter((c) => c + 1);
    setIsSettingsOpen(true);
    setIsMobileMenuOpen(false);
  };

  // 点击自选股"查看"后，跳转到首页并通过 query 参数传递股票信息
  // 首页读取 query 参数后自动填入股票代码和名称
  // name 允许为空：仅 stock 和 market 为必要参数
  const handleViewStock = (stockCode: string, market: 'SH' | 'SZ', stockName: string) => {
    const params = new URLSearchParams();
    params.set('stock', stockCode);
    params.set('market', market);
    // 名称作为可选参数传递，为空时不携带，首页会用"名称获取中"占位
    if (stockName && stockName.trim()) {
      params.set('name', stockName);
    }
    router.push(`/?${params.toString()}`);
  };

  return (
    <>
      <header className="w-full border-b border-line sticky top-0 z-20 bg-white/84 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 md:px-10">
          <div className="min-h-[68px] flex items-center justify-between gap-5">
            {/* Brand */}
            <div className="flex items-center gap-3 font-bold tracking-wide">
              <div className="w-[38px] h-[38px] rounded-lg bg-gradient-to-br from-blue to-cyan shadow-lg flex items-center justify-center text-white font-black text-lg">
                K
              </div>
              <span className="text-xl font-black text-ink">K-Ray</span>
            </div>

            {/* Product Description */}
            <div className="hidden md:flex items-center gap-2 text-sm text-muted">
              <span className="px-3 py-1 border border-blue/20 rounded-full bg-white/74 text-blue font-semibold">
                股票走势复盘与事件候选工具
              </span>
            </div>

            {/* 右侧操作区 */}
            <div className="flex items-center gap-2">
              {/* 第二十阶段 A：我的自选入口（桌面+移动端均可见） */}
              <button
                data-testid="watchlist-entry"
                onClick={() => setIsWatchlistOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold text-ink bg-paper border border-line rounded-lg hover:bg-line/30 transition-colors"
                aria-label="我的自选"
              >
                我的自选{isReady && count > 0 ? `（${count}）` : ''}
              </button>

              {/* 第十三阶段 B0：个人搜索服务设置入口（桌面端可见） */}
              <button
                data-testid="personal-search-settings-entry"
                onClick={handleOpenSettings}
                className="hidden md:inline-block px-3 py-1.5 text-xs font-semibold text-blue bg-blue/5 border border-blue/20 rounded-lg hover:bg-blue/10 transition-colors"
                aria-label="个人搜索服务设置"
              >
                个人搜索服务设置
              </button>

              {/* 移动端菜单按钮 */}
              <button
                data-testid="mobile-menu-toggle"
                onClick={() => setIsMobileMenuOpen((v) => !v)}
                className="md:hidden px-2.5 py-1.5 text-xs font-semibold text-ink bg-paper border border-line rounded-lg hover:bg-line/30 transition-colors"
                aria-label="更多菜单"
                aria-expanded={isMobileMenuOpen}
              >
                ☰
              </button>

              {/* Local Experience Badge（桌面端） */}
              <span className="hidden md:inline-block px-2 py-1 bg-orange/10 text-orange text-xs font-semibold rounded border border-orange/30">
                本地体验版
              </span>
            </div>
          </div>

          {/* 移动端下拉菜单 */}
          {isMobileMenuOpen && (
            <div data-testid="mobile-menu" className="md:hidden pb-3 pt-1 space-y-2">
              <button
                data-testid="personal-search-settings-entry-mobile"
                onClick={handleOpenSettings}
                className="w-full text-left px-3 py-2 text-sm font-semibold text-blue bg-blue/5 border border-blue/20 rounded-lg hover:bg-blue/10 transition-colors"
              >
                个人搜索服务设置
              </button>
              <span className="block px-3 py-1 bg-orange/10 text-orange text-xs font-semibold rounded border border-orange/30 text-center">
                本地体验版
              </span>
            </div>
          )}
        </div>
      </header>

      {/* 个人搜索服务设置弹窗（key 触发重新挂载，确保每次打开时重新读取 sessionStorage） */}
      <PersonalSearchSettings
        key={openCounter}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* 第二十阶段 A：我的自选抽屉 */}
      <WatchlistDrawer
        isOpen={isWatchlistOpen}
        onClose={() => setIsWatchlistOpen(false)}
        onViewStock={handleViewStock}
      />
    </>
  );
}
