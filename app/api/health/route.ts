// K-Ray 健康检查端点
//
// 用于容器编排和负载均衡器探活。
// 设计原则：
// - 不返回环境变量内容、服务器路径、API Key
// - 不请求外部 BaoStock，避免健康检查被外部服务拖垮
// - 只返回最小化状态信息

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'k-ray',
      marketDataMode: process.env.MARKET_DATA_MODE || 'real',
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
