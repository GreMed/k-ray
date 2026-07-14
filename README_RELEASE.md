# K-Ray MVP 2026-07-14 发布说明

## 1. 这个版本能做什么

K-Ray 是一款 A 股历史行情复盘工具。本 MVP 版本提供以下核心功能：

- **真实行情查询**：输入 A 股股票代码（6 位数字），查询真实前复权日线 K 线数据
- **关键股价节点识别**：自动识别区间内的显著上涨/下跌日、阶段高点/低点
- **静态历史复盘案例**：内置 5 家公司的真实历史案例（宁德时代、贵州茅台、兆易创新、移远通信、比亚迪），每个案例包含真实 K 线和可追溯的公开资料
- **交易日复盘笔记**：点击任意交易日 K 线，添加个人笔记
- **未来三个月大事日历**：显示法定财报披露期限和用户自定义事件

## 2. 哪些是真实数据

| 功能 | 数据来源 | 说明 |
|------|---------|------|
| 首页行情查询 | BaoStock | 真实 A 股前复权日线，通过 Python 子进程调用 |
| 股票基础信息 | BaoStock | 真实公司名称、上市状态、证券类型 |
| 关键股价节点 | 基于 BaoStock 真实 K 线计算 | 算法识别，非人工标注 |
| 静态案例 K 线 | BaoStock 历史快照 | 一次性获取真实数据后保存为静态文件 |
| 静态案例事件资料 | 真实公开信息 | 国新办发布会、政治局会议、证监会公告等，均附原文链接 |
| 法定期限事件 | 证监会官方规定 | 年报次年 4 月 30 日、半年报当年 8 月 31 日 |

## 3. 哪些是静态案例

`/demo/core-replay` 页面提供 5 个静态历史复盘案例：

| 股票代码 | 公司名称 | 区间 |
|---------|---------|------|
| 300750 | 宁德时代 | 2024-09-01 至 2025-02-28 |
| 600519 | 贵州茅台 | 2024-06-01 至 2024-12-31 |
| 603986 | 兆易创新 | 2024-06-01 至 2024-12-31 |
| 603236 | 移远通信 | 2024-06-01 至 2024-12-31 |
| 002594 | 比亚迪 | 2024-06-01 至 2024-12-31 |

这些案例的 K 线和事件资料在项目构建时已固定，运行时不请求外部接口。

### 3.1 日历事件类型说明

静态案例的未来日历中包含三类事件，含义和边界如下：

| 事件类型 | 标识 | 含义 | 来源链接 | 可信度 |
|---------|------|------|---------|--------|
| **可核验事件（verifiable）** | 可核验标签 | 有明确官方来源的真实事件，如法定财报披露期限 | 有，指向证监会等官方网站 | 可追溯、可复核 |
| **演示事件（case_demo）** | 演示标签 | AI 生成的演示观察窗口，用于展示日历功能 | 无 | 仅供参考，非已确认的真实事件 |
| **用户事件（user）** | 用户标签 | 用户自行添加的个人事件 | 由用户提供（可选） | 用户个人记录 |

**关于演示事件（case_demo）的重要说明：**

- 演示事件是 AI 生成的演示观察窗口，**不是已确认的真实事件**
- 演示事件**没有真实来源链接**，不可作为事实依据
- 演示事件**不能用于价格预测或投资建议**
- 演示事件不设置 `verifiedAt`（事实核验时间戳），避免被误解为已通过核验的事实记录
- 演示事件仅在静态案例日历中展示，不会出现在首页真实行情查询页面

## 4. 哪些仍然是 Mock

| 功能 | 状态 | 说明 |
|------|------|------|
| 新闻事件 | Mock | 当前发布版未接入真实新闻搜索，显示 Mock 数据并明确标注 |
| 公告数据 | Mock | 当前发布版未接入真实公告源，显示 Mock 数据并明确标注 |
| AI 复盘摘要 | 静态预生成 | 非实时 AI，基于公开资料预先编写 |

Mock 内容在页面上会明确标注为 Mock，不会冒充真实搜索结果。

## 5. Docker 启动方式

### 前置条件

- Docker 20.10+
- Docker Compose 2.0+
- 至少 512MB 可用内存

### 方式一：docker compose（推荐）

```bash
# 1. 进入项目目录
cd k-ray-app

# 2. 构建并启动
docker compose up -d --build

# 3. 查看日志
docker compose logs -f k-ray

# 4. 停止
docker compose down
```

### 方式二：docker 命令

```bash
# 1. 构建镜像
docker build -t k-ray-mvp:2026-07-14 .

# 2. 运行容器
docker run -d \
  --name k-ray-mvp \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e MARKET_DATA_MODE=real \
  k-ray-mvp:2026-07-14

# 3. 查看日志
docker logs -f k-ray-mvp

# 4. 停止并删除
docker stop k-ray-mvp && docker rm k-ray-mvp
```

启动后访问 `http://localhost:3000`。

## 6. 环境变量说明

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `NODE_ENV` | `production` | Node.js 运行环境，生产必须为 production |
| `MARKET_DATA_MODE` | `real` | 行情数据模式：real（真实）、mock、fallback |
| `EVENT_NEWS_MODE` | `mock` | 新闻事件模式：当前发布版仅支持 mock |
| `ANNOUNCEMENT_DATA_MODE` | `mock` | 公告数据模式：当前发布版仅支持 mock |
| `BAOSTOCK_PYTHON_PATH` | `/opt/venv/bin/python` | Python 解释器路径（容器内 venv） |
| `BAOSTOCK_SCRIPT_PATH` | `/app/scripts/baostock_client.py` | BaoStock K 线查询脚本路径 |
| `BAOSTOCK_STOCK_INFO_SCRIPT_PATH` | `/app/scripts/baostock_stock_info.py` | BaoStock 股票信息查询脚本路径 |
| `PORT` | `3000` | 服务监听端口 |
| `HOSTNAME` | `0.0.0.0` | 服务监听地址 |

参考 `.env.production.example` 了解完整配置。

## 7. 健康检查方式

### 命令行

```bash
curl http://localhost:3000/api/health
```

预期返回：

```json
{
  "status": "ok",
  "service": "k-ray",
  "marketDataMode": "real"
}
```

### Docker 内置健康检查

容器已配置 `HEALTHCHECK`，每 30 秒自动检查一次。查看健康状态：

```bash
docker inspect --format='{{.State.Health.Status}}' k-ray-mvp
```

健康检查只检查 `/api/health` 端点，不请求外部 BaoStock，不会因外部服务不可用而误判。

## 8. 真实行情验证方法

### 验证股票信息

```bash
# 贵州茅台
curl "http://localhost:3000/api/market/stock-info?stockCode=600519&market=SH"

# 锐捷网络（创业板）
curl "http://localhost:3000/api/market/stock-info?stockCode=301165&market=SZ"
```

预期返回 JSON 包含 `found: true`、`securityType: "stock"`、`isListed: true`。

### 验证 K 线数据

```bash
curl "http://localhost:3000/api/market/klines?stockCode=600519&market=SH&startDate=2024-01-02&endDate=2024-03-29"
```

预期返回 JSON 中：
- `meta.source` = `"baostock"`
- `meta.isRealMarketData` = `true`
- `klines` 数组长度 > 0

## 9. 数据不会实时到分钟级

K-Ray 当前版本只提供**日线级别**的行情数据：

- 数据来源是 BaoStock 的日线数据，不是分时数据
- 每个交易日一根 K 线，包含开盘价、收盘价、最高价、最低价、成交量
- 不提供实时分钟级报价
- 不提供 Level-2 行情
- 历史数据可能因复权方式不同而与实际交易价格有差异（页面使用前复权）

## 10. 个人笔记只保存在浏览器

- 交易日复盘笔记存储在浏览器的 `localStorage` 中
- 笔记不会上传到服务器
- 清除浏览器数据或更换设备后笔记会丢失
- 不同股票的笔记相互独立
- 未来日历的用户自定义事件同样存储在 `localStorage`

## 11. 常见错误及解决方法

### 容器启动后无法访问

**症状**：`curl http://localhost:3000` 连接被拒绝

**排查**：
```bash
# 检查容器是否运行
docker ps | grep k-ray

# 检查日志
docker logs k-ray-mvp

# 检查端口映射
docker port k-ray-mvp
```

**常见原因**：
- 端口 3000 被占用：修改 `docker-compose.yml` 中的端口映射，如 `"8080:3000"`
- 容器启动失败：查看日志中的错误信息

### BaoStock 查询失败

**症状**：首页行情查询返回 503 错误

**排查**：
```bash
# 进入容器测试 Python 环境
docker exec -it k-ray-mvp /opt/venv/bin/python -c "import baostock; print('ok')"

# 测试 BaoStock 连接
docker exec -it k-ray-mvp /opt/venv/bin/python /app/scripts/baostock_stock_info.py 600519 SH
```

**常见原因**：
- 容器无法访问外网（BaoStock 需要连接 `baostock.com`）
- Python venv 损坏：重新构建镜像 `docker compose up -d --build`

### 健康检查失败

**症状**：`docker inspect` 显示 health 状态为 `unhealthy`

**排查**：
```bash
# 手动执行健康检查
docker exec k-ray-mvp curl -f http://localhost:3000/api/health
```

**常见原因**：
- 服务启动慢：增大 `start_period`（docker-compose.yml 中 healthcheck 配置）
- 内存不足：增大容器内存限制

### 页面显示"真实行情服务暂时不可用"

**说明**：这是前端保护机制。当后端返回的 `meta.isRealMarketData` 不为 `true` 时，普通用户会看到此提示。

**解决**：确认 `MARKET_DATA_MODE=real` 且 BaoStock 服务正常。

## 12. 回滚到上一镜像的方法

```bash
# 1. 停止当前容器
docker compose down

# 2. 如果有上一版本镜像，直接运行
docker run -d --name k-ray-mvp -p 3000:3000 k-ray-mvp:<上一版本标签>

# 3. 如果没有上一版本镜像，从 tar 包恢复
docker load -i k-ray-mvp-<上一版本>.tar
docker run -d --name k-ray-mvp -p 3000:3000 k-ray-mvp:<上一版本标签>
```

建议在每次部署前保存当前镜像：

```bash
docker save k-ray-mvp:2026-07-14 -o k-ray-mvp-2026-07-14.tar
```

## 13. 不构成投资建议的声明

K-Ray 提供的所有行情数据、事件资料、复盘摘要和关键节点分析仅供学习和研究使用，**不构成任何投资建议**。

- 历史行情不代表未来走势
- 事件资料与股价变动的时间邻近关系不等于因果关系
- 关键节点识别基于算法，可能存在偏差
- 用户应自行判断信息的准确性和适用性
- 据此操作风险自担

## 14. Vercel 容器部署

### 普通 Vercel Serverless 部署不支持 BaoStock

普通 Vercel Next.js 部署尚不能保证 BaoStock 核心链路工作。BaoStock 使用 Node.js `child_process` 启动本地 Python 子进程，这在 Vercel Serverless 环境中不被支持。

### 当前采用 Vercel Container Images 部署

本仓库提供 `Dockerfile.vercel`，用于 Vercel Container Images 部署，保留完整的 Node.js + Python + BaoStock 真实行情链路。容器监听非特权端口 3000，以非 root 用户运行。

### Vercel 项目环境变量

Vercel 项目必须设置以下环境变量：

```
PORT=3000
MARKET_DATA_MODE=real
EVENT_NEWS_MODE=mock
ANNOUNCEMENT_DATA_MODE=mock
```

### 推荐 Function Region

推荐 `hkg1`（Hong Kong），与 BaoStock 服务器网络延迟较低。

### 部署后验证（必须实际查询，不能只用健康检查）

BaoStock 使用外部网络连接，必须在部署后实际查询股票名称和 K 线，不能只用 `/api/health` 判断成功。

```bash
# 1. 健康检查（仅确认服务启动）
curl https://<vercel-domain>/api/health

# 2. 股票名称验证（必须返回真实名称）
curl "https://<vercel-domain>/api/market/stock-info?stockCode=600519&market=SH"
# 预期: name=贵州茅台, found=true, securityType=stock, isListed=true

# 3. K 线验证（必须返回真实 BaoStock 数据）
curl "https://<vercel-domain>/api/market/klines?stockCode=600519&market=SH&startDate=2024-01-02&endDate=2024-03-29"
# 预期: meta.source=baostock, meta.isRealMarketData=true, klines 非空
```

**如果真实查询失败，不得降级为 Mock 冒充真实行情。** 前端会在 `meta.isRealMarketData !== true` 时显示"真实行情服务暂时不可用，请稍后重试。"

---

**版本**：K-Ray MVP 2026-07-14
**技术栈**：Next.js 16 + React 19 + Python 3 + BaoStock
**许可**：仅供内部使用
