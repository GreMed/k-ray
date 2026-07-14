import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 启用 standalone 输出模式，用于 Docker 生产部署
  // 生成最小化独立运行包，只需 node server.js 即可启动
  output: 'standalone',
  // 将 BaoStock Python 脚本声明为外部运行依赖
  // 该脚本在运行时通过 execFile 调用，不参与构建打包
  // 显式声明可让 Next.js output tracing 正确包含这些文件
  outputFileTracingIncludes: {
    '/api/market/klines': [
      './scripts/baostock_client.py',
      './requirements.txt',
    ],
  },
};

export default nextConfig;
