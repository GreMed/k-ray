'use client';

import { useState } from 'react';
import PersonalSearchSettings from './PersonalSearchSettings';

/**
 * 品牌头部组件
 *
 * 第十三阶段 B0：在右侧增加"个人搜索服务设置"入口。
 * 当前版本仅支持 Mock 演示候选，设置入口为未来真实搜索预留。
 */

export default function Header() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // 每次打开弹窗时递增 counter，作为 PersonalSearchSettings 的 key 触发重新挂载
  // 确保每次打开时从 sessionStorage 重新读取配置状态
  const [openCounter, setOpenCounter] = useState(0);

  const handleOpenSettings = () => {
    setOpenCounter((c) => c + 1);
    setIsSettingsOpen(true);
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
              {/* 第十三阶段 B0：个人搜索服务设置入口 */}
              <button
                data-testid="personal-search-settings-entry"
                onClick={handleOpenSettings}
                className="px-3 py-1.5 text-xs font-semibold text-blue bg-blue/5 border border-blue/20 rounded-lg hover:bg-blue/10 transition-colors"
                aria-label="个人搜索服务设置"
              >
                个人搜索服务设置
              </button>

              {/* Local Experience Badge */}
              <span className="px-2 py-1 bg-orange/10 text-orange text-xs font-semibold rounded border border-orange/30">
                本地体验版
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* 个人搜索服务设置弹窗（key 触发重新挂载，确保每次打开时重新读取 sessionStorage） */}
      <PersonalSearchSettings
        key={openCounter}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
}
