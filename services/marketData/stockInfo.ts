import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { SanitizedError } from './types';

// 证券类型（基于 BaoStock type 字段）
// type="1" → stock, type="2" → index, type="3" → bond, type="4"/"5" → fund, 其他 → other
export type SecurityType = 'stock' | 'index' | 'bond' | 'fund' | 'other' | 'unknown';

// 股票名称查询结果
export interface StockInfoResult {
  stockCode: string;
  market: 'SH' | 'SZ';
  name: string; // 空字符串表示查询成功但未找到名称
  found: boolean;
  ipoDate?: string;
  securityType: SecurityType; // 证券类型
  isListed: boolean; // 是否为上市状态（status="1"）
}

// BaoStock Python 脚本返回的原始结构
interface BaoStockStockInfoRaw {
  success: boolean;
  code: string;
  code_name: string;
  ipoDate: string;
  outDate: string;
  type: string;
  status: string;
  found: boolean;
  error?: string;
}

/**
 * 将 BaoStock type 字段映射为 SecurityType
 * type="1" → stock, type="2" → index, type="3" → bond, type="4"/"5" → fund, 其他 → other
 */
function parseSecurityType(typeStr: string): SecurityType {
  switch (typeStr) {
    case '1': return 'stock';
    case '2': return 'index';
    case '3': return 'bond';
    case '4':
    case '5': return 'fund';
    default: return typeStr ? 'other' : 'unknown';
  }
}

const TIMEOUT_MS = 15000;
const MAX_BUFFER = 10 * 1024 * 1024;

// 内存缓存：stockCode+market → StockInfoResult
// 避免每次输入重复请求 BaoStock
const stockInfoCache = new Map<string, StockInfoResult>();

// 缓存正在进行的查询，避免并发重复请求
const pendingQueries = new Map<string, Promise<StockInfoResult>>();

/**
 * 解析 Python 可执行路径。
 * 优先级：
 * 1. 环境变量 BAOSTOCK_PYTHON_PATH（显式覆盖）
 * 2. 项目根目录 .venv/bin/python（普通 npm run dev 默认使用）
 * 3. python3（系统全局）
 *
 * 若环境变量指向的路径不存在，抛出明确配置错误。
 */
export function resolvePythonPath(): string {
  // 1. 环境变量显式覆盖
  const envPath = process.env.BAOSTOCK_PYTHON_PATH;
  if (envPath) {
    if (!fs.existsSync(envPath)) {
      throw new SanitizedError(
        `环境变量 BAOSTOCK_PYTHON_PATH 指向的 Python 不存在: ${envPath}。请检查配置或移除该环境变量以使用项目 .venv。`
      );
    }
    return envPath;
  }

  // 2. 项目 .venv 中的 Python（普通 npm run dev 默认）
  // 使用 process.cwd() 作为基准，避免 Turbopack NFT 静态分析告警
  const venvPython = path.join(process.cwd(), '.venv', 'bin', 'python');
  if (fs.existsSync(venvPython)) {
    return venvPython;
  }

  // 3. 系统 python3
  return 'python3';
}

/**
 * 检测 BaoStock 是否可用。
 * 通过尝试 import baostock 来判断，不实际查询数据。
 */
export function detectBaoStockEnvironment(): { available: boolean; pythonPath: string; reason?: string } {
  const pythonPath = resolvePythonPath();
  // 检测 .venv 是否存在
  const venvPython = path.join(process.cwd(), '.venv', 'bin', 'python');
  const hasVenv = fs.existsSync(venvPython);

  if (hasVenv || process.env.BAOSTOCK_PYTHON_PATH) {
    // 有 .venv 或显式配置，假定 BaoStock 已安装
    return { available: true, pythonPath };
  }

  // 无 .venv，使用系统 python3，需要检测 BaoStock 是否安装
  return {
    available: false,
    pythonPath,
    reason: '未找到项目 .venv，且未设置 BAOSTOCK_PYTHON_PATH。请创建虚拟环境并安装 BaoStock: python3 -m venv .venv && .venv/bin/pip install baostock',
  };
}

function getScriptPath(): string {
  return process.env.BAOSTOCK_STOCK_INFO_SCRIPT_PATH || 'scripts/baostock_stock_info.py';
}

function runBaoStockStockInfo(
  stockCode: string,
  market: string,
): Promise<BaoStockStockInfoRaw> {
  return new Promise((resolve, reject) => {
    const pythonPath = resolvePythonPath();
    const scriptPath = getScriptPath();

    const args = [scriptPath, stockCode, market];

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
              return reject(new SanitizedError(parsed.error));
            }
          } catch {
            // stderr 不是 JSON
          }
          // 检测常见错误类型
          const raw = error.message;
          if (/ENOENT|not found|no such file/i.test(raw)) {
            return reject(new SanitizedError('本机尚未安装BaoStock运行环境。'));
          }
          if (/ModuleNotFoundError.*baostock/i.test(stderr)) {
            return reject(new SanitizedError('BaoStock 模块未安装。请在 .venv 中执行: pip install baostock'));
          }
          return reject(new SanitizedError('BaoStock服务暂时不可用，请稍后重试。'));
        }

        try {
          const result = JSON.parse(stdout) as BaoStockStockInfoRaw;
          if (!result.success) {
            return reject(new SanitizedError(result.error || 'BaoStock查询失败'));
          }
          resolve(result);
        } catch {
          return reject(new SanitizedError('BaoStock返回数据解析失败。'));
        }
      },
    );
  });
}

/**
 * 查询股票真实证券简称。
 * 带内存缓存，同一代码+市场只查询一次。
 * 查询失败时抛出 SanitizedError，不返回伪名称。
 */
export async function fetchStockInfo(
  stockCode: string,
  market: 'SH' | 'SZ',
): Promise<StockInfoResult> {
  const cacheKey = `${stockCode}:${market}`;

  // 1. 命中缓存
  const cached = stockInfoCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // 2. 命中正在进行的查询（避免并发重复请求）
  const pending = pendingQueries.get(cacheKey);
  if (pending) {
    return pending;
  }

  // 3. 发起查询
  const queryPromise = (async (): Promise<StockInfoResult> => {
    const raw = await runBaoStockStockInfo(stockCode, market);
    const result: StockInfoResult = {
      stockCode,
      market,
      name: raw.code_name || '',
      found: raw.found,
      ipoDate: raw.ipoDate || undefined,
      securityType: parseSecurityType(raw.type),
      isListed: raw.status === '1',
    };
    stockInfoCache.set(cacheKey, result);
    return result;
  })();

  pendingQueries.set(cacheKey, queryPromise);

  try {
    return await queryPromise;
  } finally {
    pendingQueries.delete(cacheKey);
  }
}

/**
 * 清除股票名称缓存（仅用于测试）。
 */
export function clearStockInfoCache(): void {
  stockInfoCache.clear();
}
