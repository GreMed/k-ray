// K-Ray Proxy：生产环境开发路由隔离
//
// Next.js 16 将 middleware 重命名为 proxy，本文件替代原 middleware.ts。
// 生产环境（NODE_ENV === 'production'）下，/dev-* 路由返回 404，
// 避免普通用户访问开发辅助页面。
// 开发环境仍可正常使用这些页面。
//
// matcher 仅匹配实际存在的开发验收页面，首页、核心案例、API 路由
// 和其他普通用户页面不经过 Proxy。

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function proxy(_request: NextRequest) {
  // 仅在生产环境隔离 dev 路由
  if (process.env.NODE_ENV === 'production') {
    // 直接返回 404，Next.js 会渲染默认 404 页面
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  // 仅匹配三个实际存在的开发验收页面及其子路径
  // 首页 /、核心案例 /demo/core-replay、API /api/* 均不经过 Proxy
  matcher: [
    '/dev-ai-event-retrieval/:path*',
    '/dev-announcements/:path*',
    '/dev-event-sources/:path*',
  ],
};
