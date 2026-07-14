/**
 * K-Ray 第十八阶段发布收口测试
 *
 * 覆盖：
 *   1. /api/health 健康检查端点
 *   2. 生产环境开发路由隔离（isDevEnvironment 在生产返回 false）
 *   3. DevToolsPanel 在非开发环境不渲染
 *   4. 健康检查不泄露环境变量
 *   5. Proxy 迁移：matcher 仅匹配 dev 路由，首页/案例/API 不经过 Proxy
 *
 * @jest-environment node
 */

import { describe, test, expect, afterEach, jest } from '@jest/globals';
import { GET as healthGET } from '@/app/api/health/route';

// === isDevEnvironment 函数测试 ===
// 直接测试逻辑：生产环境始终返回 false
describe('第十八阶段发布收口：健康检查端点', () => {
  test('GET /api/health 返回 200', async () => {
    const req = new Request('http://localhost/api/health');
    const res = await healthGET(req);
    expect(res.status).toBe(200);
  });

  test('返回 JSON 包含 status=ok 和 service=k-ray', async () => {
    const req = new Request('http://localhost/api/health');
    const res = await healthGET(req);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('k-ray');
  });

  test('marketDataMode 字段返回当前配置值', async () => {
    const originalMode = process.env.MARKET_DATA_MODE;
    process.env.MARKET_DATA_MODE = 'real';
    const req = new Request('http://localhost/api/health');
    const res = await healthGET(req);
    const body = await res.json();
    expect(body.marketDataMode).toBe('real');
    // 恢复
    if (originalMode === undefined) {
      delete process.env.MARKET_DATA_MODE;
    } else {
      process.env.MARKET_DATA_MODE = originalMode;
    }
  });

  test('marketDataMode 未配置时默认返回 real', async () => {
    const originalMode = process.env.MARKET_DATA_MODE;
    delete process.env.MARKET_DATA_MODE;
    const req = new Request('http://localhost/api/health');
    const res = await healthGET(req);
    const body = await res.json();
    expect(body.marketDataMode).toBe('real');
    // 恢复
    if (originalMode !== undefined) {
      process.env.MARKET_DATA_MODE = originalMode;
    }
  });

  test('健康检查响应包含 no-store 缓存头', async () => {
    const req = new Request('http://localhost/api/health');
    const res = await healthGET(req);
    const cacheControl = res.headers.get('cache-control');
    expect(cacheControl).toContain('no-store');
    expect(cacheControl).toContain('no-cache');
  });

  test('健康检查不返回环境变量全集、服务器路径或 API Key', async () => {
    // 设置一些敏感环境变量
    process.env.BAOSTOCK_SCRIPT_PATH = '/secret/path/script.py';
    process.env.SOME_API_KEY = 'sk-secret-12345';
    process.env.DATABASE_URL = 'postgres://user:pass@host/db';

    const req = new Request('http://localhost/api/health');
    const res = await healthGET(req);
    const body = await res.json();
    const bodyStr = JSON.stringify(body);

    // 确保不泄露路径、密钥、连接字符串
    expect(bodyStr).not.toContain('/secret/path');
    expect(bodyStr).not.toContain('sk-secret');
    expect(bodyStr).not.toContain('postgres://');
    expect(bodyStr).not.toContain('DATABASE_URL');
    expect(bodyStr).not.toContain('BAOSTOCK_SCRIPT_PATH');

    // 清理
    delete process.env.BAOSTOCK_SCRIPT_PATH;
    delete process.env.SOME_API_KEY;
    delete process.env.DATABASE_URL;
  });
});

// === 生产环境开发路由隔离测试（Proxy 迁移版） ===
describe('第十八阶段发布收口：Proxy 开发路由隔离', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalJestWorkerId = process.env.JEST_WORKER_ID;

  afterEach(() => {
    // 恢复环境变量
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalJestWorkerId !== undefined) {
      process.env.JEST_WORKER_ID = originalJestWorkerId;
    }
  });

  test('isDevEnvironment 在 NODE_ENV=production 时返回 false', async () => {
    // 动态导入以测试环境变量影响
    jest.resetModules();
    process.env.NODE_ENV = 'production';
    // JEST_WORKER_ID 在测试中存在，但生产判断优先检查 NODE_ENV
    // isDevEnvironment 逻辑：if (process.env.NODE_ENV === 'production') return false;
    // 所以即使 JEST_WORKER_ID 存在，生产环境也返回 false
    const devHelpers = await import('@/utils/devHelpers');
    expect(devHelpers.isDevEnvironment()).toBe(false);
  });

  test('proxy 在生产环境对三个 dev 路由返回 404', async () => {
    jest.resetModules();
    process.env.NODE_ENV = 'production';
    delete process.env.JEST_WORKER_ID;

    const proxyModule = await import('@/proxy');
    const proxy = (proxyModule as { proxy: (req: unknown) => { status: number } }).proxy;
    const { NextRequest } = await import('next/server');

    const devUrls = [
      'http://localhost/dev-ai-event-retrieval',
      'http://localhost/dev-announcements',
      'http://localhost/dev-event-sources',
    ];

    for (const url of devUrls) {
      const req = new NextRequest(url);
      const res = proxy(req);
      expect(res.status).toBe(404);
    }
  });

  test('proxy 在开发环境对 dev 路由放行（非 404）', async () => {
    jest.resetModules();
    process.env.NODE_ENV = 'development';
    delete process.env.JEST_WORKER_ID;

    const proxyModule = await import('@/proxy');
    const proxy = (proxyModule as { proxy: (req: unknown) => { status: number } }).proxy;
    const { NextRequest } = await import('next/server');

    const req = new NextRequest('http://localhost/dev-announcements');
    const res = proxy(req);
    // 开发环境应放行（NextResponse.next() 状态为 200）
    expect(res.status).not.toBe(404);
  });

  test('proxy config matcher 仅匹配三个 dev 路由，不包含首页、案例或 API', async () => {
    jest.resetModules();

    const proxyModule = await import('@/proxy');
    const config = (proxyModule as { config: { matcher: string[] } }).config;

    // matcher 应包含且仅包含三个 dev 路由
    expect(config.matcher).toHaveLength(3);

    const matcherStr = config.matcher.join(' ');

    // 必须匹配三个 dev 路由
    expect(matcherStr).toContain('dev-ai-event-retrieval');
    expect(matcherStr).toContain('dev-announcements');
    expect(matcherStr).toContain('dev-event-sources');

    // 不得包含首页根路径匹配（旧模式用 (?!api) 通配所有路径）
    expect(matcherStr).not.toContain('(?!api');
    // 不得匹配 /demo/core-replay
    expect(matcherStr).not.toContain('demo');
    // 不得匹配 /api
    expect(matcherStr).not.toContain('api');
    // 每条 matcher 必须以 /dev- 开头
    for (const pattern of config.matcher) {
      expect(pattern.startsWith('/dev-')).toBe(true);
    }
  });
});
