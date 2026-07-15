// K-Ray 第二十阶段 A：本机自选股服务
//
// 使用 localStorage 持久化自选股列表，按 stockCode + market 确定唯一身份。
// localStorage 不可用或数据损坏时安全回到空自选，不导致页面白屏。
// 不发起任何网络请求。

import type { WatchlistItem } from '@/types';
import { detectMarket } from '@/utils/stockCode';

const STORAGE_KEY = 'k-ray:watchlist:v1';

// saveWatchlist 的返回结果：明确区分成功/失败，调用方可据此提示用户
export interface SaveResult {
  ok: boolean;
  reason?: 'storage_unavailable' | 'write_failed';
}

// 安全读取 localStorage（SSR 和旧浏览器中 localStorage 不可用）
function getLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
}

// 校验单条数据是否为合法的 WatchlistItem
// 第二十阶段 A 验收补强：严格校验 6 位数字代码、SH/SZ 市场、有效时间
// 第二十阶段 A 验收修复（第二轮）：复用项目已有市场识别规则校验代码与市场是否匹配
function isValidItem(item: unknown): item is WatchlistItem {
  if (item == null || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;
  if (typeof obj.stockCode !== 'string') return false;
  // 股票代码必须为 6 位数字
  if (!/^\d{6}$/.test(obj.stockCode)) return false;
  // market 仅允许 SH 或 SZ
  if (obj.market !== 'SH' && obj.market !== 'SZ') return false;
  // 复用项目已有市场识别规则：代码前缀必须与市场一致
  const detected = detectMarket(obj.stockCode);
  if (detected !== obj.market) return false;
  if (typeof obj.stockName !== 'string') return false;
  if (typeof obj.addedAt !== 'string') return false;
  // addedAt 必须为有效时间
  const ts = Date.parse(obj.addedAt);
  if (Number.isNaN(ts)) return false;
  return true;
}

// 从 localStorage 加载自选列表，数据损坏时安全降级为空数组
// 第二十阶段 A 验收补强：逐条校验，单条损坏不影响整体列表
export function loadWatchlist(): WatchlistItem[] {
  const storage = getLocalStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // 逐条校验并去重（按 stockCode + market）
    const seen = new Set<string>();
    const valid: WatchlistItem[] = [];
    for (const item of parsed) {
      if (!isValidItem(item)) continue;
      const key = `${item.stockCode}:${item.market}`;
      if (seen.has(key)) continue;
      seen.add(key);
      valid.push(item);
    }
    return valid;
  } catch {
    // JSON 解析失败或数据损坏，安全回到空
    return [];
  }
}

// 保存自选列表到 localStorage
// 第二十阶段 A 验收补强：明确返回成功/失败，写入失败不得只更新内存状态
export function saveWatchlist(items: WatchlistItem[]): SaveResult {
  const storage = getLocalStorage();
  if (!storage) return { ok: false, reason: 'storage_unavailable' };

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(items));
    return { ok: true };
  } catch {
    // 写入失败（如配额超出、隐私模式），返回失败结果
    return { ok: false, reason: 'write_failed' };
  }
}

// 生成自选项的唯一标识 key
export function watchlistKey(stockCode: string, market: string): string {
  return `${stockCode}:${market}`;
}

// 检查某只股票是否已在自选列表中
export function isInWatchlist(
  items: WatchlistItem[],
  stockCode: string,
  market: string,
): boolean {
  return items.some(
    (item) => item.stockCode === stockCode && item.market === market,
  );
}

// 添加自选（去重，已存在则不重复添加）
// 第二十阶段 A 验收补强：返回写入结果，调用方可据此提示用户
// 第二十阶段 A 验收修复（第二轮）：校验代码与市场是否匹配
export function addToWatchlist(
  items: WatchlistItem[],
  item: Omit<WatchlistItem, 'addedAt'>,
): { items: WatchlistItem[]; save: SaveResult } {
  // 校验代码与市场是否匹配，不匹配则拒绝添加
  if (detectMarket(item.stockCode) !== item.market) {
    return { items, save: { ok: false, reason: 'write_failed' } };
  }
  if (isInWatchlist(items, item.stockCode, item.market)) {
    return { items, save: { ok: true } };
  }
  const newItem: WatchlistItem = {
    ...item,
    addedAt: new Date().toISOString(),
  };
  const next = [...items, newItem];
  const save = saveWatchlist(next);
  // 写入失败时回滚内存状态，避免 UI 显示"已加入"但实际未持久化
  return { items: save.ok ? next : items, save };
}

// 移除自选
export function removeFromWatchlist(
  items: WatchlistItem[],
  stockCode: string,
  market: string,
): { items: WatchlistItem[]; save: SaveResult } {
  const next = items.filter(
    (item) => !(item.stockCode === stockCode && item.market === market),
  );
  const save = saveWatchlist(next);
  return { items: save.ok ? next : items, save };
}
