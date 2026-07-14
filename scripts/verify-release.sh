#!/bin/bash
# K-Ray MVP 发布验证脚本
#
# 用法：
#   1. 构建镜像：docker build -t k-ray-mvp:2026-07-14 .
#   2. 运行容器：docker run --rm -p 3000:3000 --name k-ray-mvp k-ray-mvp:2026-07-14
#   3. 执行本脚本：bash scripts/verify-release.sh
#
# 依赖：curl、python3（用于解析 JSON）
# 所有 localhost 请求明确绕过系统代理，每次请求超时 10 秒
#
# 验证项：
#   1. /api/health 返回 200
#   2. / 返回 200
#   3. /demo/core-replay?stock=300750 返回 200
#   4. /demo/core-replay?stock=002594 返回 200
#   5. /dev-announcements 返回 404
#   6. /dev-ai-event-retrieval 返回 404
#   7. /dev-event-sources 返回 404
#   8. 股票名称验证（600519=贵州茅台, 301165=锐捷网络）
#   9. 真实日 K 线验证（source=baostock, isRealMarketData=true, K线数>0）

set -u

BASE_URL="${BASE_URL:-http://localhost:3000}"
# 所有 localhost 请求绕过系统代理
NO_PROXY_OPT="--noproxy localhost"
# 每次请求超时 10 秒（连接 5 秒，整体 10 秒）
TIMEOUT_OPT="--connect-timeout 5 --max-time 10"
PASS=0
FAIL=0

check() {
    local description="$1"
    local expected="$2"
    local actual="$3"
    if [ "$expected" = "$actual" ]; then
        echo "[PASS] $description"
        PASS=$((PASS + 1))
    else
        echo "[FAIL] $description (期望: $expected, 实际: $actual)"
        FAIL=$((FAIL + 1))
    fi
}

# 检查依赖工具
for tool in curl python3; do
    if ! command -v "$tool" >/dev/null 2>&1; then
        echo "[FAIL] 缺少依赖工具: $tool"
        exit 2
    fi
done

echo "=== K-Ray MVP 发布验证 ==="
echo "目标地址: $BASE_URL"
echo "代理绕过: localhost"
echo "请求超时: 10 秒"
echo ""

# 1. 健康检查
HTTP_CODE=$(curl $NO_PROXY_OPT $TIMEOUT_OPT -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health" 2>/dev/null || echo "000")
check "1. /api/health 返回 200" "200" "$HTTP_CODE"

# 2. 首页
HTTP_CODE=$(curl $NO_PROXY_OPT $TIMEOUT_OPT -s -o /dev/null -w "%{http_code}" "$BASE_URL/" 2>/dev/null || echo "000")
check "2. / 返回 200" "200" "$HTTP_CODE"

# 3. 案例页 300750
HTTP_CODE=$(curl $NO_PROXY_OPT $TIMEOUT_OPT -s -o /dev/null -w "%{http_code}" "$BASE_URL/demo/core-replay?stock=300750" 2>/dev/null || echo "000")
check "3. /demo/core-replay?stock=300750 返回 200" "200" "$HTTP_CODE"

# 4. 案例页 002594
HTTP_CODE=$(curl $NO_PROXY_OPT $TIMEOUT_OPT -s -o /dev/null -w "%{http_code}" "$BASE_URL/demo/core-replay?stock=002594" 2>/dev/null || echo "000")
check "4. /demo/core-replay?stock=002594 返回 200" "200" "$HTTP_CODE"

# 5. 开发路由隔离 - /dev-announcements
HTTP_CODE=$(curl $NO_PROXY_OPT $TIMEOUT_OPT -s -o /dev/null -w "%{http_code}" "$BASE_URL/dev-announcements" 2>/dev/null || echo "000")
check "5. /dev-announcements 返回 404" "404" "$HTTP_CODE"

# 6. 开发路由隔离 - /dev-ai-event-retrieval
HTTP_CODE=$(curl $NO_PROXY_OPT $TIMEOUT_OPT -s -o /dev/null -w "%{http_code}" "$BASE_URL/dev-ai-event-retrieval" 2>/dev/null || echo "000")
check "6. /dev-ai-event-retrieval 返回 404" "404" "$HTTP_CODE"

# 7. 开发路由隔离 - /dev-event-sources
HTTP_CODE=$(curl $NO_PROXY_OPT $TIMEOUT_OPT -s -o /dev/null -w "%{http_code}" "$BASE_URL/dev-event-sources" 2>/dev/null || echo "000")
check "7. /dev-event-sources 返回 404" "404" "$HTTP_CODE"

# 8. 股票名称验证
STOCK_NAME=$(curl $NO_PROXY_OPT $TIMEOUT_OPT -s "$BASE_URL/api/market/stock-info?stockCode=600519&market=SH" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('name',''))" 2>/dev/null || echo "")
check "8. 600519 返回贵州茅台" "贵州茅台" "$STOCK_NAME"

STOCK_NAME=$(curl $NO_PROXY_OPT $TIMEOUT_OPT -s "$BASE_URL/api/market/stock-info?stockCode=301165&market=SZ" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('name',''))" 2>/dev/null || echo "")
check "9. 301165 返回锐捷网络" "锐捷网络" "$STOCK_NAME"

# 10. 真实日 K 线验证 - 600519
KLINE_RESULT=$(curl $NO_PROXY_OPT $TIMEOUT_OPT -s "$BASE_URL/api/market/klines?stockCode=600519&market=SH&startDate=2024-01-02&endDate=2024-03-29" 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    klines = data.get('klines', [])
    meta = data.get('meta', {})
    source = meta.get('source', '')
    is_real = meta.get('isRealMarketData', False)
    count = len(klines)
    print(f'{source}|{is_real}|{count}')
except Exception:
    print('error|False|0')
" 2>/dev/null || echo "error|False|0")

SOURCE=$(echo "$KLINE_RESULT" | cut -d'|' -f1)
IS_REAL=$(echo "$KLINE_RESULT" | cut -d'|' -f2)
KLINE_COUNT=$(echo "$KLINE_RESULT" | cut -d'|' -f3)

check "10. 600519 K线 source=baostock" "baostock" "$SOURCE"
check "11. 600519 K线 isRealMarketData=True" "True" "$IS_REAL"

if [ "$KLINE_COUNT" -gt 0 ] 2>/dev/null; then
    echo "[PASS] 12. 600519 K线数量>0 (实际: $KLINE_COUNT)"
    PASS=$((PASS + 1))
else
    echo "[FAIL] 12. 600519 K线数量>0 (实际: $KLINE_COUNT)"
    FAIL=$((FAIL + 1))
fi

# 11. 真实日 K 线验证 - 301165
KLINE_RESULT=$(curl $NO_PROXY_OPT $TIMEOUT_OPT -s "$BASE_URL/api/market/klines?stockCode=301165&market=SZ&startDate=2024-01-02&endDate=2024-03-29" 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    klines = data.get('klines', [])
    meta = data.get('meta', {})
    source = meta.get('source', '')
    is_real = meta.get('isRealMarketData', False)
    count = len(klines)
    print(f'{source}|{is_real}|{count}')
except Exception:
    print('error|False|0')
" 2>/dev/null || echo "error|False|0")

SOURCE=$(echo "$KLINE_RESULT" | cut -d'|' -f1)
IS_REAL=$(echo "$KLINE_RESULT" | cut -d'|' -f2)
KLINE_COUNT=$(echo "$KLINE_RESULT" | cut -d'|' -f3)

check "13. 301165 K线 source=baostock" "baostock" "$SOURCE"
check "14. 301165 K线 isRealMarketData=True" "True" "$IS_REAL"

if [ "$KLINE_COUNT" -gt 0 ] 2>/dev/null; then
    echo "[PASS] 15. 301165 K线数量>0 (实际: $KLINE_COUNT)"
    PASS=$((PASS + 1))
else
    echo "[FAIL] 15. 301165 K线数量>0 (实际: $KLINE_COUNT)"
    FAIL=$((FAIL + 1))
fi

echo ""
echo "=== 验证结果 ==="
echo "通过: $PASS"
echo "失败: $FAIL"

if [ "$FAIL" -gt 0 ]; then
    exit 1
else
    echo "全部通过！"
    exit 0
fi
