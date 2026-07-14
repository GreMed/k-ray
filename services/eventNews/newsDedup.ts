// K-Ray 第十阶段 A：稳定 ID 生成与去重逻辑
// 稳定 ID 优先级：
// 1. 规范化后的真实原文 URL
// 2. 如果 URL 缺失，则使用"标题 + 发布时间 + publisher"的稳定哈希
// 注意：缺少真实链接的项目仍不能标记为 verified

import crypto from 'crypto';

// URL 规范化：
// - 转小写（scheme + host 部分）
// - 去除 fragment（#...）
// - 去除常见跟踪参数
// - 去除尾部斜杠
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // scheme 和 host 转小写
    const scheme = u.protocol.toLowerCase();
    const host = u.hostname.toLowerCase();

    // 去除 fragment
    u.hash = '';

    // 去除常见跟踪参数
    const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'from', 'share'];
    paramsToRemove.forEach(p => u.searchParams.delete(p));

    // 构建规范化 URL
    let normalized = `${scheme}//${host}${u.pathname}${u.search}`;

    // 去除尾部斜杠（根路径除外）
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  } catch {
    // URL 解析失败，返回原始值
    return url;
  }
}

// 生成稳定 ID
// 优先级 1：规范化后的真实原文 URL
// 优先级 2：标题 + 发布时间 + publisher 的 SHA-256 哈希前 16 位
export function generateNewsId(
  url: string,
  title: string,
  publishTime: string,
  publisher: string,
): string {
  // 优先使用规范化 URL
  if (url && isValidUrl(url)) {
    const normalized = normalizeUrl(url);
    return `news:url:${normalized}`;
  }

  // URL 缺失或无效，使用标题+时间+来源的哈希
  const raw = `${title.trim()}|${publishTime.trim()}|${publisher.trim()}`;
  const hash = crypto.createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 16);
  return `news:hash:${hash}`;
}

// 标题规范化：去除空格、全半角差异，用于去重比较
export function normalizeTitle(title: string): string {
  return title
    .trim()
    // 全角空格转半角
    .replace(/\u3000/g, ' ')
    // 多个空格合并为一个
    .replace(/\s+/g, ' ')
    // 去除首尾标点空格
    .replace(/^[\s\u3000]+|[\s\u3000]+$/g, '');
}

// 去重：基于 ID 和 标题+时间
export function deduplicateNews<T extends { id: string; title: string; publishedAt: string }>(
  news: T[],
): T[] {
  const seen = new Map<string, T>();

  for (const item of news) {
    // 去重键 1：稳定 ID
    const idKey = item.id;

    // 去重键 2：规范化标题 + 发布时间
    const titleKey = `${normalizeTitle(item.title)}|${item.publishedAt}`;

    // 如果 ID 已存在，跳过
    if (seen.has(idKey)) {
      continue;
    }

    // 如果标题+时间已存在，跳过（处理标题只有空格/全半角差异的情况）
    const existingByTitle = Array.from(seen.values()).find(
      existing => `${normalizeTitle(existing.title)}|${existing.publishedAt}` === titleKey,
    );
    if (existingByTitle) {
      continue;
    }

    seen.set(idKey, item);
  }

  return Array.from(seen.values());
}

// 判断 IPv6 地址是否为私网或链路本地地址
function isPrivateIPv6(host: string): boolean {
  // 去除方括号（IPv6 在 URL 中可能被方括号包裹）
  const addr = host.replace(/^\[|\]$/g, '').toLowerCase();

  // ::1 回环地址
  if (addr === '::1' || addr === '0:0:0:0:0:0:0:1') return true;

  // fe80::/10 链路本地地址
  if (/^fe[89ab][0-9a-f]:/.test(addr)) return true;

  // fc00::/7 唯一本地地址（私网）
  if (/^f[cd][0-9a-f]{2}:/.test(addr)) return true;

  // ::/128 未指定地址
  if (addr === '::') return true;

  // 2001:db8::/32 文档用途
  if (/^2001:db8:/.test(addr)) return true;

  return false;
}

// 判断 IPv4 地址是否为内网/保留地址
function isPrivateIPv4(host: string): boolean {
  // 127.0.0.0/8 回环地址（整个 127 段）
  if (/^127\./.test(host)) return true;

  // 10.0.0.0/8
  if (/^10\./.test(host)) return true;

  // 192.168.0.0/16
  if (/^192\.168\./.test(host)) return true;

  // 172.16.0.0/12
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)) return true;

  // 169.254.0.0/16 链路本地地址
  if (/^169\.254\./.test(host)) return true;

  // 0.0.0.0
  if (host === '0.0.0.0') return true;

  return false;
}

// URL 验证
// 只接受合法的 HTTP/HTTPS 地址
// 拒绝 localhost、内网地址、回环地址、链路本地地址、带用户名密码的异常地址
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;

  try {
    const u = new URL(url);

    // 只接受 HTTP/HTTPS
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return false;
    }

    const host = u.hostname.toLowerCase();

    // 拒绝 localhost
    if (host === 'localhost') {
      return false;
    }

    // 拒绝 .local 域名
    if (host.endsWith('.local')) {
      return false;
    }

    // 拒绝带用户名密码的地址
    if (u.username || u.password) {
      return false;
    }

    // IPv6 地址判断
    if (host.includes(':') || host.startsWith('[')) {
      if (isPrivateIPv6(host)) return false;
      // 合法公网 IPv6 通过
      return true;
    }

    // IPv4 地址判断
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      if (isPrivateIPv4(host)) return false;
      return true;
    }

    // 普通域名，通过
    return true;
  } catch {
    return false;
  }
}

// 从 URL 提取域名（用于展示）
export function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname;
  } catch {
    return '';
  }
}
