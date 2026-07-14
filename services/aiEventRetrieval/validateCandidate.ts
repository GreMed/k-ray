/**
 * 第十三阶段 A：AI 事件检索候选校验函数
 *
 * 纯函数，不依赖外部服务、不调用网络请求。
 * 用于未来第十三阶段 B 的 Provider 返回结果校验：确保外部候选缺少必填字段时必须丢弃。
 *
 * 核心边界：
 * 1. AI 不能补造缺失字段；
 * 2. 缺失任一必填字段即丢弃，不得降级为部分展示；
 * 3. 校验失败时统一返回"未检索到可追溯候选"，绝不使用 Mock 新闻补位。
 */

import {
  AI_CANDIDATE_REQUIRED_FIELDS,
  AICandidateRequiredField,
  AICandidateValidationResult,
  AICandidateValidationFailureReason,
} from './types';

/**
 * 合法的数据模式枚举值
 */
const VALID_DATA_MODES = new Set(['disabled', 'mock', 'real']);

/**
 * 校验 originalUrl 是否为完整合法的 http/https URL
 *
 * 使用标准 URL 解析校验：
 * - 必须能被 URL 构造器成功解析
 * - protocol 必须是 http: 或 https:
 * - hostname 不能为空
 * - hostname 必须包含点号（.）或为 localhost（拒绝把路径误当主机的 https:///path-only）
 *
 * @param value 待校验的值
 * @returns true 合法；false 非法
 */
function isValidHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  // 只允许 http / https 协议
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }
  // hostname 不能为空
  const hostname = parsed.hostname;
  if (!hostname || hostname.trim() === '') {
    return false;
  }
  // hostname 必须包含点号（.）或为 localhost
  // 防止 https:///path-only 被解析为 hostname="path-only"
  if (hostname !== 'localhost' && !hostname.includes('.')) {
    return false;
  }
  return true;
}

/**
 * 校验 publishedAt 是否为可解析的日期或日期时间
 *
 * 接受格式：
 * - YYYY-MM-DD
 * - YYYY-MM-DD HH:mm
 * - YYYY-MM-DDTHH:mm:ss
 * - 完整 ISO 字符串
 *
 * 拒绝：任意文本、空字符串、无效日期（如 2024-13-45）
 *
 * @param value 待校验的值
 * @returns true 合法；false 非法
 */
function isParseableDate(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed === '') return false;
  const date = new Date(trimmed);
  // Invalid Date 的 getTime() 返回 NaN
  if (Number.isNaN(date.getTime())) return false;
  return true;
}

/**
 * 校验 retrievedAt 是否为有效 ISO 时间字符串
 *
 * 严格要求 ISO 8601 格式（如 2024-07-12T10:00:00.000Z 或 2024-07-12T10:00:00）。
 * 拒绝：纯日期（YYYY-MM-DD）、任意文本、空字符串、无效时间。
 *
 * @param value 待校验的值
 * @returns true 合法；false 非法
 */
function isValidIsoTime(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed === '') return false;
  // ISO 8601 时间字符串必须包含 "T" 分隔符（区分于纯日期）
  if (!trimmed.includes('T')) return false;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return false;
  return true;
}

/**
 * 构造校验失败结果
 */
function fail(
  field: AICandidateRequiredField,
  reason: AICandidateValidationFailureReason,
): AICandidateValidationResult {
  return { valid: false, failedField: field, failureReason: reason };
}

/**
 * 校验单个候选是否包含所有必填字段且字段值合法
 *
 * 校验规则：
 * 1. 7 个必填字段必须存在且非空：title、publishedAt、publisher、originalUrl、retrievedAt、searchQueryUsed、dataMode
 * 2. originalUrl 必须能被 URL 构造器解析，protocol 为 http/https，hostname 非空
 * 3. dataMode 必须严格属于 disabled / mock / real
 * 4. publishedAt 必须可被 new Date() 解析为有效日期
 * 5. retrievedAt 必须是有效 ISO 时间字符串（包含 T 分隔符）
 *
 * @param candidate 待校验的候选对象（可能为部分字段）
 * @returns 校验结果：valid=true 通过；valid=false 附带失败字段和原因
 */
export function validateAICandidate(candidate: Record<string, unknown>): AICandidateValidationResult {
  for (const field of AI_CANDIDATE_REQUIRED_FIELDS) {
    const value = candidate[field];

    // 1. 缺少字段（undefined 或 null）
    if (value === undefined || value === null) {
      return fail(field, 'missing_field');
    }

    // 2. 字段为空字符串
    if (typeof value === 'string' && value.trim() === '') {
      return fail(field, 'empty_field');
    }

    // 3. originalUrl 必须用标准 URL 解析校验
    if (field === 'originalUrl') {
      if (!isValidHttpUrl(value)) {
        return fail(field, 'invalid_url');
      }
    }

    // 4. dataMode 必须严格属于 disabled / mock / real
    if (field === 'dataMode') {
      if (typeof value !== 'string' || !VALID_DATA_MODES.has(value)) {
        return fail(field, 'invalid_data_mode');
      }
    }

    // 5. publishedAt 必须是可解析的日期或日期时间
    if (field === 'publishedAt') {
      if (!isParseableDate(value)) {
        return fail(field, 'invalid_date');
      }
    }

    // 6. retrievedAt 必须是有效 ISO 时间字符串
    if (field === 'retrievedAt') {
      if (!isValidIsoTime(value)) {
        return fail(field, 'invalid_iso_time');
      }
    }
  }

  return { valid: true };
}

/**
 * 批量校验候选列表，过滤掉不完整的候选
 *
 * @param candidates 待校验的候选列表
 * @returns 过滤后的合法候选列表（不包含被丢弃的候选）
 *
 * 注意：被丢弃的候选不会出现在返回结果中，调用方应记录日志但不向用户展示。
 * 校验失败时绝不使用 Mock 新闻补位。
 */
export function filterValidAICandidates<T extends Record<string, unknown>>(candidates: T[]): T[] {
  return candidates.filter((candidate) => validateAICandidate(candidate).valid);
}

/**
 * 校验并返回详细的丢弃信息（用于日志或开发面板）
 *
 * @param candidates 待校验的候选列表
 * @returns 包含合法候选和被丢弃候选的详细信息
 */
export function validateAICandidateList<T extends Record<string, unknown>>(candidates: T[]): {
  validCandidates: T[];
  rejectedCount: number;
  rejections: Array<{ index: number; result: AICandidateValidationResult }>;
} {
  const validCandidates: T[] = [];
  const rejections: Array<{ index: number; result: AICandidateValidationResult }> = [];

  candidates.forEach((candidate, index) => {
    const result = validateAICandidate(candidate);
    if (result.valid) {
      validCandidates.push(candidate);
    } else {
      rejections.push({ index, result });
    }
  });

  return {
    validCandidates,
    rejectedCount: rejections.length,
    rejections,
  };
}
