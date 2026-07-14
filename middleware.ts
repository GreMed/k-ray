// K-Ray 中间件：生产环境开发路由隔离
//
// 生产环境（NODE_ENV === 'production'）下，所有 /dev-* 路由返回 404，
// 避免普通用户访问开发辅助页面。
// 开发环境仍可正常使用这些页面。

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 仅在生产环境隔离 dev 路由
  if (process.env.NODE_ENV === 'production') {
    const { pathname } = request.nextUrl;

    // 匹配所有 /dev-* 开头的路由
    if (pathname.startsWith('/dev-') || pathname === '/dev') {
      // 直接返回 404，Next.js 会渲染默认 404 页面
      return new NextResponse(null, { status: 404 });
    }
  }

  return NextResponse.next();
}

export const config = {
  // 匹配所有非静态资源路径（middleware 内部再判断是否为 /dev-* 路由）
  // 不直接使用 '/dev-:path*' 是因为 path-to-regexp 将 :path* 解析为以 / 分隔的路径段，
  // 导致 /dev-announcements 不被匹配
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
