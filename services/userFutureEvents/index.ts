// 第十一阶段 A：用户未来事件 localStorage 服务层
// 按 stockCode 隔离，不依赖外部 API 或数据库

import { UserFutureEvent } from '@/types';

const STORAGE_KEY_PREFIX = 'k-ray:user-future-events:';

function getStorageKey(stockCode: string): string {
  return `${STORAGE_KEY_PREFIX}${stockCode}`;
}

// 生成稳定 ID（不依赖数组位置）
export function generateEventId(): string {
  return `ufe-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// 读取指定股票的全部用户事件
export function loadUserEvents(stockCode: string): UserFutureEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = getStorageKey(stockCode);
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UserFutureEvent[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

// 保存指定股票的全部用户事件（内部使用）
function saveUserEvents(stockCode: string, events: UserFutureEvent[]): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getStorageKey(stockCode);
    window.localStorage.setItem(key, JSON.stringify(events));
  } catch {
    // 存储失败（如配额超限）静默忽略
  }
}

// 新增事件
export function addUserEvent(stockCode: string, event: Omit<UserFutureEvent, 'id' | 'stockCode' | 'createdAt' | 'updatedAt'>): UserFutureEvent {
  const now = new Date().toISOString();
  const newEvent: UserFutureEvent = {
    ...event,
    id: generateEventId(),
    stockCode,
    createdAt: now,
    updatedAt: now,
  };
  const events = loadUserEvents(stockCode);
  events.push(newEvent);
  saveUserEvents(stockCode, events);
  return newEvent;
}

// 编辑事件（按 id 查找，不依赖数组位置）
export function updateUserEvent(stockCode: string, eventId: string, updates: Partial<Omit<UserFutureEvent, 'id' | 'stockCode' | 'createdAt'>>): UserFutureEvent | null {
  const events = loadUserEvents(stockCode);
  const idx = events.findIndex(e => e.id === eventId);
  if (idx === -1) return null;
  const updated: UserFutureEvent = {
    ...events[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  events[idx] = updated;
  saveUserEvents(stockCode, events);
  return updated;
}

// 删除事件（按 id 查找）
export function deleteUserEvent(stockCode: string, eventId: string): boolean {
  const events = loadUserEvents(stockCode);
  const idx = events.findIndex(e => e.id === eventId);
  if (idx === -1) return false;
  events.splice(idx, 1);
  saveUserEvents(stockCode, events);
  return true;
}

// 清空指定股票的全部用户事件
export function clearUserEvents(stockCode: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getStorageKey(stockCode);
    window.localStorage.removeItem(key);
  } catch {
    // 静默忽略
  }
}

// 校验日期是否为未来日期（严格大于今天）
export function isFutureDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const input = new Date(dateStr + 'T00:00:00');
  return input > today;
}

// 校验原始链接：仅允许 http:// 或 https:// 协议
// 空字符串视为合法（链接为可选字段）
export function isValidEventUrl(url: string): boolean {
  if (!url) return true;
  const trimmed = url.trim();
  if (!trimmed) return true;
  return /^https?:\/\/.+/i.test(trimmed);
}

// 事件类别中文标签
export const CATEGORY_LABELS: Record<UserFutureEvent['category'], string> = {
  performance: '业绩披露',
  shareholder: '股东大会',
  product: '产品/行业事项',
  custom: '自定义',
};

// 事件类别徽标样式
export const CATEGORY_BADGE_CLASSES: Record<UserFutureEvent['category'], string> = {
  performance: 'bg-blue/10 text-blue',
  shareholder: 'bg-violet/10 text-violet',
  product: 'bg-orange/10 text-orange',
  custom: 'bg-gray-100 text-gray-600',
};
