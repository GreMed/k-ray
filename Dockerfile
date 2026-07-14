# K-Ray MVP Dockerfile
#
# 多阶段构建：Node.js + Python（Debian bookworm-slim）
# 支持 Next.js 服务端调用 Python BaoStock 子进程
#
# 不使用 Alpine（BaoStock 依赖 glibc，Alpine 使用 musl 可能存在兼容问题）

# ============================================================================
# 阶段 1：安装 Python 运行时依赖到 /opt/venv
# ============================================================================
FROM node:22-bookworm-slim AS python-deps

# 配置 apt 重试和网络超时，应对 Docker VM 内网络不稳定
# 使用默认 HTTP Debian 镜像源（避免 ca-certificates 未安装时 HTTPS 证书验证失败的鸡生蛋问题）
RUN echo 'Acquire::Retries "8";' > /etc/apt/apt.conf.d/80-retries && \
    echo 'Acquire::http::Timeout "60";' >> /etc/apt/apt.conf.d/80-retries && \
    echo 'Acquire::https::Timeout "60";' >> /etc/apt/apt.conf.d/80-retries

# 安装系统构建依赖和 CA 证书（带重试循环，应对代理间歇性 503）
# 三次全部失败时必须以非零状态退出，不得继续构建
RUN APT_OK=0; \
    for i in 1 2 3; do \
        if apt-get update && \
           apt-get install -y --no-install-recommends --fix-missing \
               python3 \
               python3-venv \
               python3-pip \
               ca-certificates; then \
            APT_OK=1; \
            break; \
        fi; \
        sleep 5; \
    done; \
    if [ "$APT_OK" != "1" ]; then \
        echo "ERROR: apt-get failed after 3 attempts" >&2; \
        exit 1; \
    fi; \
    rm -rf /var/lib/apt/lists/*

# 创建虚拟环境并安装 BaoStock
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# 仅安装运行时必需的 Python 依赖
COPY requirements.runtime.txt /tmp/requirements.runtime.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /tmp/requirements.runtime.txt

# ============================================================================
# 阶段 2：安装 Node.js 依赖并构建 Next.js
# ============================================================================
FROM node:22-bookworm-slim AS node-deps

WORKDIR /app

# 配置 apt 重试
RUN echo 'Acquire::Retries "8";' > /etc/apt/apt.conf.d/80-retries && \
    echo 'Acquire::http::Timeout "60";' >> /etc/apt/apt.conf.d/80-retries && \
    echo 'Acquire::https::Timeout "60";' >> /etc/apt/apt.conf.d/80-retries

# 安装 CA 证书（运行时 HTTPS 请求需要，带重试循环）
# 三次全部失败时必须以非零状态退出，不得继续构建
RUN APT_OK=0; \
    for i in 1 2 3; do \
        if apt-get update && \
           apt-get install -y --no-install-recommends --fix-missing \
               ca-certificates; then \
            APT_OK=1; \
            break; \
        fi; \
        sleep 5; \
    done; \
    if [ "$APT_OK" != "1" ]; then \
        echo "ERROR: apt-get failed after 3 attempts" >&2; \
        exit 1; \
    fi; \
    rm -rf /var/lib/apt/lists/*

# 先复制 package 文件以利用 Docker 缓存
COPY package.json package-lock.json* ./

# 安装全部依赖（包括 devDependencies，构建阶段需要）
RUN npm ci

# 复制源代码
COPY . .

# 构建生产版本
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ============================================================================
# 阶段 3：生产运行时镜像
# ============================================================================
FROM node:22-bookworm-slim AS runner

WORKDIR /app

# 配置 apt 重试
RUN echo 'Acquire::Retries "8";' > /etc/apt/apt.conf.d/80-retries && \
    echo 'Acquire::http::Timeout "60";' >> /etc/apt/apt.conf.d/80-retries && \
    echo 'Acquire::https::Timeout "60";' >> /etc/apt/apt.conf.d/80-retries

# 安装运行时系统依赖：Python 3、CA 证书、curl（用于 HEALTHCHECK，带重试循环）
# 三次全部失败时必须以非零状态退出，不得继续构建
RUN APT_OK=0; \
    for i in 1 2 3; do \
        if apt-get update && \
           apt-get install -y --no-install-recommends --fix-missing \
               python3 \
               ca-certificates \
               curl; then \
            APT_OK=1; \
            break; \
        fi; \
        sleep 5; \
    done; \
    if [ "$APT_OK" != "1" ]; then \
        echo "ERROR: apt-get failed after 3 attempts" >&2; \
        exit 1; \
    fi; \
    rm -rf /var/lib/apt/lists/*

# 从 python-deps 阶段复制虚拟环境
COPY --from=python-deps /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# 创建非 root 用户
RUN groupadd --system --gid 1001 kray && \
    useradd --system --uid 1001 --gid kray --home-dir /app --shell /bin/bash kray

# 从 node-deps 阶段复制构建产物和运行时文件
COPY --from=node-deps --chown=kray:kray /app/.next/standalone ./
COPY --from=node-deps --chown=kray:kray /app/.next/static ./.next/static
COPY --from=node-deps --chown=kray:kray /app/public ./public

# 复制 Python 脚本（BaoStock 运行时需要）
COPY --chown=kray:kray scripts/baostock_client.py ./scripts/baostock_client.py
COPY --chown=kray:kray scripts/baostock_stock_info.py ./scripts/baostock_stock_info.py
COPY --chown=kray:kray requirements.runtime.txt ./requirements.runtime.txt

# 设置生产环境变量
ENV NODE_ENV=production
ENV MARKET_DATA_MODE=real
ENV EVENT_NEWS_MODE=mock
ENV ANNOUNCEMENT_DATA_MODE=mock
ENV BAOSTOCK_PYTHON_PATH=/opt/venv/bin/python
ENV BAOSTOCK_SCRIPT_PATH=/app/scripts/baostock_client.py
ENV BAOSTOCK_STOCK_INFO_SCRIPT_PATH=/app/scripts/baostock_stock_info.py
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# 切换到非 root 用户
USER kray

# 暴露端口
EXPOSE 3000

# 健康检查（不请求外部 BaoStock，只检查 /api/health）
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# 启动 Next.js 生产服务器
CMD ["node", "server.js"]
