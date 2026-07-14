import { execFile } from 'child_process';
import type { MarketDataProvider, MarketKLineResult, MarketKLineQuery } from './types';
import { SanitizedError } from './types';
import { resolvePythonPath } from './stockInfo';

interface BaoStockRawResult {
  success: boolean;
  klines: Array<{
    id: string;
    stockId: string;
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    changePercent: number | null;
  }>;
  count: number;
  error?: string;
}

const TIMEOUT_MS = 15000;
const MAX_BUFFER = 10 * 1024 * 1024;

function getScriptPath(): string {
  // 优先使用环境变量配置的脚本绝对路径（生产部署推荐）
  // 默认使用相对路径，execFile 会以 process.cwd() 为基准解析
  // 避免在代码中使用 path.join(process.cwd(), ...) 触发 Turbopack NFT 静态分析告警
  return process.env.BAOSTOCK_SCRIPT_PATH || 'scripts/baostock_client.py';
}

// 将内部错误脱敏为用户友好消息
function sanitizeError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err);
  const stderr = typeof err === 'object' && err !== null && 'stderr' in err ? String((err as { stderr: unknown }).stderr) : '';
  // 检测常见错误类型，返回通俗提示
  if (/ENOENT|not found|no such file/i.test(raw)) {
    return new SanitizedError('本机尚未安装BaoStock运行环境。');
  }
  if (/ModuleNotFoundError.*baostock/i.test(stderr) || /ModuleNotFoundError.*baostock/i.test(raw)) {
    return new SanitizedError('BaoStock 模块未安装。请在 .venv 中执行: pip install baostock');
  }
  if (/timeout|timed out|ETIMEDOUT/i.test(raw)) {
    return new SanitizedError('BaoStock连接超时，请稍后重试。');
  }
  if (/login failed|connection|connect/i.test(raw)) {
    return new SanitizedError('BaoStock连接失败，请稍后重试。');
  }
  if (/no data|empty|没有数据/i.test(raw)) {
    return new SanitizedError('该股票在所选区间没有交易数据。');
  }
  // 默认：不暴露任何内部信息
  console.error('[BaoStockProvider] 内部错误(仅日志):', raw);
  return new SanitizedError('BaoStock服务暂时不可用，请稍后重试。');
}

function runBaoStockClient(
  stockId: string,
  stockCode: string,
  market: string,
  startDate: string,
  endDate: string,
  adjustflag: string,
): Promise<BaoStockRawResult> {
  return new Promise((resolve, reject) => {
    let pythonPath: string;
    try {
      pythonPath = resolvePythonPath();
    } catch (err) {
      // resolvePythonPath 在环境变量指向不存在路径时抛出 SanitizedError
      return reject(err);
    }
    const scriptPath = getScriptPath();

    // 使用参数数组，不拼接命令字符串
    const args = [
      scriptPath,
      stockId,
      stockCode,
      market,
      startDate,
      endDate,
      adjustflag,
    ];

    execFile(
      pythonPath,
      args,
      {
        timeout: TIMEOUT_MS,
        killSignal: 'SIGTERM',
        maxBuffer: MAX_BUFFER,
      },
      (error, stdout, stderr) => {
        if (error) {
          // 尝试从 stderr 解析结构化错误
          try {
            const parsed = JSON.parse(stderr);
            if (parsed && parsed.error) {
              return reject(sanitizeError(parsed.error));
            }
          } catch {
            // stderr 不是 JSON，脱敏处理
          }
          // 将 stderr 附加到 error 对象，便于 sanitizeError 检测 ModuleNotFoundError
          const errWithStderr = new Error(error.message) as Error & { stderr?: string };
          errWithStderr.stderr = stderr;
          return reject(sanitizeError(errWithStderr));
        }

        try {
          const result = JSON.parse(stdout) as BaoStockRawResult;
          if (!result.success) {
            return reject(sanitizeError(result.error || 'unknown'));
          }
          resolve(result);
        } catch (parseError) {
          return reject(sanitizeError(parseError));
        }
      },
    );
  });
}

export const baostockProvider: MarketDataProvider = {
  id: 'baostock',
  label: 'BaoStock真实行情(前复权日线)',

  async fetchKLines(query: MarketKLineQuery): Promise<MarketKLineResult> {
    if (query.market !== 'SH' && query.market !== 'SZ') {
      throw new SanitizedError('仅支持上交所(SH)和深交所(SZ)市场。');
    }

    const rawResult = await runBaoStockClient(
      query.stockId,
      query.stockCode,
      query.market,
      query.startDate,
      query.endDate,
      '2', // 前复权
    );

    const klines = rawResult.klines.map(k => ({
      id: k.id,
      stockId: k.stockId,
      date: k.date,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
      volume: k.volume,
      changePercent: k.changePercent ?? undefined,
    }));

    return {
      klines,
      meta: {
        source: 'baostock',
        sourceLabel: 'BaoStock真实行情(前复权日线)',
        adjustment: 'qfq',
        isRealMarketData: true,
        fetchedAt: new Date().toISOString(),
      },
    };
  },
};
