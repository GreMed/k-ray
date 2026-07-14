// 第十二阶段 A：用户复盘笔记 localStorage 服务层
// 第十六阶段升级：按 stockCode + date 隔离，支持任意交易日笔记
// 旧数据按 stockCode + nodeId 隔离，通过 migrateLegacyNotes 安全迁移
// 浏览器中存在损坏或不完整的旧笔记数据时，页面不得报错

import { ReplayNote } from '@/types';

const STORAGE_KEY_PREFIX = 'k-ray:replay-notes:';

function getStorageKey(stockCode: string): string {
  return `${STORAGE_KEY_PREFIX}${stockCode}`;
}

// 生成稳定 ID（不依赖数组位置）
export function generateNoteId(): string {
  return `rn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// 生成笔记 marker 的稳定 ID
export function generateNoteMarkerId(stockCode: string, date: string): string {
  return `user-note:${stockCode}:${date}`;
}

// 校验单条笔记数据结构是否完整（第十六阶段新格式）
function isValidNote(data: unknown): data is ReplayNote {
  if (!data || typeof data !== 'object') return false;
  const note = data as Record<string, unknown>;
  return (
    typeof note.id === 'string' &&
    typeof note.stockCode === 'string' &&
    typeof note.date === 'string' &&
    (note.nodeId === null || typeof note.nodeId === 'string') &&
    (note.nodeType === null || typeof note.nodeType === 'string') &&
    (note.changePercent === null || typeof note.changePercent === 'number') &&
    typeof note.content === 'string' &&
    typeof note.createdAt === 'string' &&
    typeof note.updatedAt === 'string'
  );
}

// 第十六阶段：旧格式笔记校验（nodeId 为必填 string，nodeDate 为必填 string）
interface LegacyNote {
  id: string;
  stockCode: string;
  nodeId: string;
  nodeDate: string;
  nodeType: string;
  changePercent: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}

function isLegacyNote(data: unknown): data is LegacyNote {
  if (!data || typeof data !== 'object') return false;
  const note = data as Record<string, unknown>;
  return (
    typeof note.id === 'string' &&
    typeof note.stockCode === 'string' &&
    typeof note.nodeId === 'string' &&
    typeof note.nodeDate === 'string' &&
    typeof note.nodeType === 'string' &&
    typeof note.changePercent === 'number' &&
    typeof note.content === 'string' &&
    typeof note.createdAt === 'string' &&
    typeof note.updatedAt === 'string'
  );
}

// 将旧格式笔记迁移为新格式（nodeDate → date，nodeId/nodeType/changePercent 保留但可空）
function migrateLegacyNote(legacy: LegacyNote): ReplayNote {
  return {
    id: legacy.id,
    stockCode: legacy.stockCode,
    date: legacy.nodeDate,
    nodeId: legacy.nodeId,
    nodeType: legacy.nodeType,
    changePercent: legacy.changePercent,
    content: legacy.content,
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt,
  };
}

// 安全解析笔记数组：损坏数据返回空数组
// 同时处理旧格式数据的迁移
function safeParseNotes(raw: string | null): ReplayNote[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 逐条处理：新格式直接保留，旧格式迁移，损坏数据丢弃
    return parsed
      .map((item): ReplayNote | null => {
        if (isValidNote(item)) return item;
        if (isLegacyNote(item)) return migrateLegacyNote(item);
        return null;
      })
      .filter((item): item is ReplayNote => item !== null);
  } catch {
    return [];
  }
}

// 读取指定股票的全部笔记（自动迁移旧数据）
export function loadNotes(stockCode: string): ReplayNote[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = getStorageKey(stockCode);
    const raw = window.localStorage.getItem(key);
    return safeParseNotes(raw);
  } catch {
    return [];
  }
}

// 读取指定股票 + 指定日期的笔记
export function loadNoteByDate(stockCode: string, date: string): ReplayNote | null {
  const notes = loadNotes(stockCode);
  return notes.find((n) => n.date === date) || null;
}

// 读取指定股票 + 指定节点的笔记（兼容旧接口，基于 date 查找）
export function loadNote(stockCode: string, nodeId: string): ReplayNote | null {
  const notes = loadNotes(stockCode);
  return notes.find((n) => n.nodeId === nodeId) || null;
}

// 新增笔记
export function addNote(
  stockCode: string,
  note: Omit<ReplayNote, 'id' | 'stockCode' | 'createdAt' | 'updatedAt'>,
): ReplayNote {
  const now = new Date().toISOString();
  const newNote: ReplayNote = {
    ...note,
    id: generateNoteId(),
    stockCode,
    createdAt: now,
    updatedAt: now,
  };
  const notes = loadNotes(stockCode);
  // 同一 stockCode + date 只保留一条，替换旧笔记
  const filtered = notes.filter((n) => n.date !== note.date);
  filtered.push(newNote);
  saveNotes(stockCode, filtered);
  return newNote;
}

// 更新笔记内容
export function updateNote(stockCode: string, noteId: string, content: string): ReplayNote | null {
  const notes = loadNotes(stockCode);
  const idx = notes.findIndex((n) => n.id === noteId);
  if (idx === -1) return null;
  notes[idx] = {
    ...notes[idx],
    content,
    updatedAt: new Date().toISOString(),
  };
  saveNotes(stockCode, notes);
  return notes[idx];
}

// 删除笔记
export function deleteNote(stockCode: string, noteId: string): boolean {
  const notes = loadNotes(stockCode);
  const filtered = notes.filter((n) => n.id !== noteId);
  if (filtered.length === notes.length) return false;
  saveNotes(stockCode, filtered);
  return true;
}

// 清空指定股票的全部笔记
export function clearNotes(stockCode: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getStorageKey(stockCode));
  } catch {
    // 忽略写入失败
  }
}

// 写入 localStorage（内部函数）
function saveNotes(stockCode: string, notes: ReplayNote[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getStorageKey(stockCode), JSON.stringify(notes));
  } catch {
    // 忽略写入失败（如存储空间不足）
  }
}
