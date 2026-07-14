# K-Ray

K-Ray 是一款 A 股交易日 K 线复盘工具，提供关键股价节点识别、事件候选关联、任意交易日笔记和未来事件日历等核心体验。

## 核心体验入口

启动开发服务器后，直接访问静态案例页：

```
http://localhost:3000/demo/core-replay?stock=300750
```

## 五个静态历史复盘案例

当前提供以下五家公司的静态历史复盘案例（K 线和事件资料在构建时已固定，运行时不请求外部接口）：

| 股票代码 | 公司名称 | 市场 |
|---------|---------|------|
| 300750 | 宁德时代 | SZ |
| 600519 | 贵州茅台 | SH |
| 603986 | 兆易创新 | SH |
| 603236 | 移远通信 | SH |
| 002594 | 比亚迪 | SZ |

## 真实行情依赖

首页真实行情查询依赖 [BaoStock](http://baostock.com) 提供的 A 股日线数据，通过 Node.js `child_process` 启动本地 Python 子进程调用。运行真实查询前需要：

- Python 3
- BaoStock（`pip install baostock`）
- AKShare（仅新闻候选功能使用，`pip install akshare==1.18.64`）

详见 `requirements.txt`。

## 本地启动方式

```bash
# 1. 安装 Node.js 依赖
npm install

# 2. 创建 Python 虚拟环境并安装依赖
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 3. 启动开发服务器
npm run dev
```

打开 `http://localhost:3000` 体验首页真实行情查询，或访问 `/demo/core-replay?stock=300750` 查看静态案例。

## Docker 启动方式

```bash
docker compose up --build
```

Docker 镜像基于 Debian 多阶段构建，包含 Node.js、Python 3、venv、BaoStock 和 CA 证书，以非 root 用户运行。详见 `Dockerfile` 和 `docker-compose.yml`。

## 发布说明

完整的发布说明（功能列表、数据类型、环境变量、健康检查、验证方法、数据限制、故障排查、回滚、投资免责声明等）请参见 [README_RELEASE.md](./README_RELEASE.md)。

## Vercel 部署说明

### 普通 Vercel Serverless 部署不支持当前 BaoStock 链路

普通 Vercel Next.js 部署尚不能保证 BaoStock 核心链路工作。原因：BaoStock 使用 Node.js `child_process` 启动本地 Python 子进程，这在 Vercel Serverless 环境中不被支持。

### 当前采用 Vercel Container Images 部署

本仓库提供 `Dockerfile.vercel`，用于 Vercel Container Images 部署，保留完整的 Node.js + Python + BaoStock 真实行情链路。

Vercel 项目必须设置以下环境变量：

```
PORT=3000
MARKET_DATA_MODE=real
EVENT_NEWS_MODE=mock
ANNOUNCEMENT_DATA_MODE=mock
```

推荐 Function Region：`hkg1`（Hong Kong）。

### 部署后验证要求

BaoStock 使用外部网络连接，必须在部署后实际查询股票名称和 K 线，不能只用 `/api/health` 判断成功。如果真实查询失败，不得降级为 Mock 冒充真实行情。

完整的 Vercel 容器部署验证步骤参见 [README_RELEASE.md](./README_RELEASE.md)。
