/**
 * K-Ray 第十阶段 A：新闻候选数据验证脚本（封板修复版）
 *
 * 支持并强制检查 VERIFY_EXPECTED_MODE=mock|real|fallback
 * 每只股票返回后检查：
 *   - meta.dataMode 是否与预期一致
 *   - real 模式必须 isRealData=true
 *   - real 模式 provider 必须为 akshare
 *   - real 模式不得出现 Mock 标题或 Mock 来源
 *   - fallback 必须有 fallbackReason
 *   - 模式不符必须退出码 1
 *
 * 对四只股票分别执行两轮真实查询（refresh=1 绕过缓存），记录：
 *   - 两轮查询时间戳和耗时
 *   - cacheStatus 必须为 bypass
 *   - 返回数量
 *   - 去重后数量
 *   - verified/unverified 数量
 *   - 多股汇总候选数量
 *   - 最早和最晚新闻时间
 *   - 两轮稳定 ID 重合数量和重合率
 *   - 是否发生超时、限流或失败
 *
 * 两轮 ID 重合率低于 80% 时：设置失败，退出码必须为 1
 *
 * 报告措辞只能写"短时间内两次独立请求结果的一致性"，不得仅凭两次查询宣布数据源长期稳定
 *
 * 保存不包含新闻全文的真实验证原始摘要：
 *   reports/phase10a-{mode}-verification.txt（根据模式分别输出，避免互相覆盖）
 *   只保存标题、时间、来源域名、ID、相关性状态和统计信息
 *
 * 报告中必须真实列出每只股票出现的其他有效股票代码
 *
 * 每轮都必须验证必填字段：
 * 结果级：news 必须是数组、meta 必须存在、各项计数必须是有效数字、dataMode/provider/upstreamPlatform/isRealData/fetchedAt 必须存在且符合预期
 * 单条新闻：id/queryStockCode/title/publishedAt/publisher/originalUrl/acquisitionProvider/upstreamPlatform/stockRelevanceStatus/verificationReason/dataMode/isRealEventCandidate/fetchedAt
 *
 * 用法：
 *   VERIFY_EXPECTED_MODE=real node scripts/verify_event_news.mjs
 *   VERIFY_EXPECTED_MODE=mock node scripts/verify_event_news.mjs
 *   VERIFY_EXPECTED_MODE=fallback node scripts/verify_event_news.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// 导入共享验证逻辑（单一来源，与 Jest 测试使用同一份代码）
import { checkRequiredFields, checkCacheStatus, calculateIdOverlap, isOverlapPass } from './verifyCore.cjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const REPORTS_DIR = path.join(PROJECT_ROOT, 'reports');

const API_BASE = process.env.VERIFY_API_BASE || 'http://localhost:3000';
const EXPECTED_MODE = process.env.VERIFY_EXPECTED_MODE;

const STOCKS = [
  { code: '600519', market: 'SH', name: '贵州茅台' },
  { code: '000001', market: 'SZ', name: '平安银行' },
  { code: '300750', market: 'SZ', name: '宁德时代' },
  { code: '688981', market: 'SH', name: '中芯国际' },
];

// 模式校验（移入 main 中执行，避免模块导入时退出）
const REPORT_FILE = EXPECTED_MODE && ['mock', 'real', 'fallback'].includes(EXPECTED_MODE)
  ? path.join(REPORTS_DIR, `phase10a-${EXPECTED_MODE}-verification.txt`)
  : path.join(REPORTS_DIR, 'phase10a-unknown-verification.txt');

// 从 URL 提取域名
function extractDomain(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

// 查询单只股票新闻（带 refresh=1 绕过缓存）
async function queryNews(stockCode, market) {
  const params = new URLSearchParams({ stockCode, market, refresh: '1' });
  const url = `${API_BASE}/api/event-news?${params.toString()}`;
  const startTime = Date.now();
  const queryTimestamp = new Date().toISOString();

  const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
  const elapsedMs = Date.now() - startTime;
  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`JSON解析失败: ${text.slice(0, 100)}`);
  }

  return { status: res.status, data, elapsedMs, queryTimestamp };
}

// 收集每只股票出现的其他有效股票代码
function collectOtherStockCodes(result, targetCode) {
  const otherCodes = new Set();
  for (const news of result.news) {
    if (news.matchedStockCodes) {
      for (const code of news.matchedStockCodes) {
        if (code !== targetCode) {
          otherCodes.add(code);
        }
      }
    }
  }
  return Array.from(otherCodes);
}

// 构建单轮查询的原始摘要（不包含新闻全文）
function buildRoundSummary(stock, round, result, elapsedMs, queryTimestamp) {
  const lines = [];
  lines.push(`  第${round}轮查询:`);
  lines.push(`    查询时间戳: ${queryTimestamp}`);
  lines.push(`    耗时: ${elapsedMs}ms`);
  lines.push(`    cacheStatus: ${result.meta.cacheStatus}`);
  lines.push(`    返回数量: ${result.meta.totalCount}`);
  lines.push(`    去重后数量: ${result.meta.deduplicatedCount}`);
  lines.push(`    verified 数量: ${result.meta.verifiedCount}`);
  lines.push(`    unverified 数量: ${result.meta.unverifiedCount}`);
  lines.push(`    多股汇总候选数量: ${result.meta.multiStockSummaryCount}`);
  lines.push(`    格式合格链接数量: ${result.meta.validUrlCount}`);
  lines.push(`    无效/缺失链接数量: ${result.meta.invalidUrlCount}`);

  if (result.meta.earliestPublishedAt) {
    lines.push(`    最早新闻时间: ${result.meta.earliestPublishedAt}`);
  }
  if (result.meta.latestPublishedAt) {
    lines.push(`    最晚新闻时间: ${result.meta.latestPublishedAt}`);
  }

  // 其他有效股票代码
  const otherCodes = collectOtherStockCodes(result, stock.code);
  if (otherCodes.length > 0) {
    lines.push(`    出现的其他有效股票代码: ${otherCodes.join('、')}`);
  } else {
    lines.push(`    出现的其他有效股票代码: 无`);
  }

  // 新闻列表（只保存标题、时间、来源域名、ID、相关性状态）
  if (result.news.length > 0) {
    lines.push(`    新闻列表（只保存标题、时间、来源域名、ID、相关性状态）:`);
    result.news.forEach((item, i) => {
      const domain = extractDomain(item.originalUrl);
      lines.push(`      ${i + 1}. [${item.stockRelevanceStatus}] ${item.title}`);
      lines.push(`         时间: ${item.publishedAt}`);
      lines.push(`         来源域名: ${domain || '无'}`);
      lines.push(`         ID: ${item.id}`);
      if (item.isMultiStockSummary) {
        lines.push(`         [多股汇总候选]`);
      }
    });
  }

  return lines.join('\n');
}

async function main() {
  // 模式校验（在 main 中执行，避免模块导入时退出）
  if (!EXPECTED_MODE || !['mock', 'real', 'fallback'].includes(EXPECTED_MODE)) {
    console.error('❌ 必须设置 VERIFY_EXPECTED_MODE=mock|real|fallback');
    console.error('   用法: VERIFY_EXPECTED_MODE=real node scripts/verify_event_news.mjs');
    process.exit(1);
  }

  console.log('========================================');
  console.log('K-Ray 第十阶段 A 新闻候选数据验证脚本（封板修复版）');
  console.log('========================================');
  console.log(`预期模式: ${EXPECTED_MODE}`);
  console.log(`API 地址: ${API_BASE}/api/event-news`);
  console.log(`报告文件: ${REPORT_FILE}`);
  console.log(`绕过缓存: refresh=1（dev-only）`);
  console.log('注意：AKShare 是数据获取工具，东方财富是上游平台。');
  console.log('本验证仅为技术可行性验证，不代表已获得上游内容商业转载授权。');
  console.log();

  // 确保报告目录存在
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  const reportLines = [];
  reportLines.push('========================================');
  reportLines.push(`K-Ray 第十阶段 A ${EXPECTED_MODE} 验证原始摘要`);
  reportLines.push(`生成时间: ${new Date().toISOString()}`);
  reportLines.push(`预期模式: ${EXPECTED_MODE}`);
  reportLines.push(`API 地址: ${API_BASE}/api/event-news`);
  reportLines.push('绕过缓存: refresh=1（dev-only，每轮请求都绕过服务缓存）');
  reportLines.push('注意：本摘要不包含新闻全文，只保存标题、时间、来源域名、ID、相关性状态和统计信息');
  reportLines.push('========================================');
  reportLines.push('');

  let hasFailure = false;
  let hasTimeoutOrFailure = false;

  for (const stock of STOCKS) {
    console.log(`--- ${stock.code}.${stock.market} (${stock.name}) ---`);
    reportLines.push(`=== ${stock.code}.${stock.market} (${stock.name}) ===`);
    reportLines.push('');

    let round1Result = null;
    let round2Result = null;

    // 第一轮查询（绕过缓存）
    try {
      console.log(`  第1轮查询中（refresh=1）...`);
      const { status, data, elapsedMs, queryTimestamp } = await queryNews(stock.code, stock.market);
      console.log(`  第1轮 HTTP状态: ${status}, 耗时: ${elapsedMs}ms, cacheStatus: ${data.meta?.cacheStatus}`);

      if (status !== 200) {
        const errorMsg = `HTTP ${status}: ${data.error || '未知错误'}`;
        console.log(`  ❌ 第1轮查询失败: ${errorMsg}`);
        reportLines.push(`  第1轮查询失败: ${errorMsg}`);
        hasFailure = true;
      } else {
        round1Result = data;

        // 必填字段检查
        const fieldErrors = checkRequiredFields(data, EXPECTED_MODE);
        if (fieldErrors.length > 0) {
          console.log(`  ❌ 第1轮必填字段检查失败:`);
          fieldErrors.forEach(e => {
            console.log(`     - ${e}`);
            reportLines.push(`  第1轮必填字段检查失败: ${e}`);
          });
          hasFailure = true;
        } else {
          console.log(`  ✅ 第1轮必填字段检查通过`);
        }

        // cacheStatus 检查
        const cacheErrors = checkCacheStatus(data);
        if (cacheErrors.length > 0) {
          console.log(`  ❌ 第1轮 cacheStatus 检查失败:`);
          cacheErrors.forEach(e => {
            console.log(`     - ${e}`);
            reportLines.push(`  第1轮 cacheStatus 检查失败: ${e}`);
          });
          hasFailure = true;
        } else {
          console.log(`  ✅ 第1轮 cacheStatus=bypass`);
        }

        reportLines.push(buildRoundSummary(stock, 1, data, elapsedMs, queryTimestamp));
      }
    } catch (err) {
      console.log(`  ❌ 第1轮请求失败: ${err.message}`);
      reportLines.push(`  第1轮请求失败: ${err.message}`);
      hasFailure = true;
      hasTimeoutOrFailure = true;
    }

    reportLines.push('');

    // 第二轮查询（绕过缓存）
    try {
      console.log(`  第2轮查询中（refresh=1）...`);
      const { status, data, elapsedMs, queryTimestamp } = await queryNews(stock.code, stock.market);
      console.log(`  第2轮 HTTP状态: ${status}, 耗时: ${elapsedMs}ms, cacheStatus: ${data.meta?.cacheStatus}`);

      if (status !== 200) {
        const errorMsg = `HTTP ${status}: ${data.error || '未知错误'}`;
        console.log(`  ❌ 第2轮查询失败: ${errorMsg}`);
        reportLines.push(`  第2轮查询失败: ${errorMsg}`);
        hasFailure = true;
      } else {
        round2Result = data;

        // 必填字段检查
        const fieldErrors = checkRequiredFields(data, EXPECTED_MODE);
        if (fieldErrors.length > 0) {
          console.log(`  ❌ 第2轮必填字段检查失败:`);
          fieldErrors.forEach(e => {
            console.log(`     - ${e}`);
            reportLines.push(`  第2轮必填字段检查失败: ${e}`);
          });
          hasFailure = true;
        } else {
          console.log(`  ✅ 第2轮必填字段检查通过`);
        }

        // cacheStatus 检查
        const cacheErrors = checkCacheStatus(data);
        if (cacheErrors.length > 0) {
          console.log(`  ❌ 第2轮 cacheStatus 检查失败:`);
          cacheErrors.forEach(e => {
            console.log(`     - ${e}`);
            reportLines.push(`  第2轮 cacheStatus 检查失败: ${e}`);
          });
          hasFailure = true;
        } else {
          console.log(`  ✅ 第2轮 cacheStatus=bypass`);
        }

        reportLines.push(buildRoundSummary(stock, 2, data, elapsedMs, queryTimestamp));
      }
    } catch (err) {
      console.log(`  ❌ 第2轮请求失败: ${err.message}`);
      reportLines.push(`  第2轮请求失败: ${err.message}`);
      hasFailure = true;
      hasTimeoutOrFailure = true;
    }

    reportLines.push('');

    // 两轮对比
    if (round1Result && round2Result) {
      const overlapResult = calculateIdOverlap(round1Result, round2Result);
      const overlap = overlapResult.overlap;
      const overlapRate = overlapResult.overlapRate;
      const overlapPercent = (overlapRate * 100).toFixed(1);
      console.log(`  两轮稳定 ID 重合数量: ${overlap}, 重合率: ${overlapPercent}%`);
      reportLines.push(`  两轮稳定 ID 重合数量: ${overlap}`);
      reportLines.push(`  两轮 ID 重合率: ${overlapPercent}%`);

      // 两轮 ID 重合率低于 80% 时：设置失败，退出码必须为 1
      // 使用共享的 isOverlapPass 函数判断
      if (!isOverlapPass(overlapResult, round1Result.news.length, round2Result.news.length)) {
        console.log(`  ❌ 两轮 ID 重合率 ${overlapPercent}% 低于 80%，短时间内两次独立请求结果一致性不足`);
        reportLines.push(`  ❌ 两轮 ID 重合率 ${overlapPercent}% 低于 80%，短时间内两次独立请求结果一致性不足`);
        hasFailure = true;
      } else {
        console.log(`  ✅ 短时间内两次独立请求结果的一致性: 重合率 ${overlapPercent}%`);
        reportLines.push(`  短时间内两次独立请求结果的一致性: 重合率 ${overlapPercent}%`);
      }

      // 两轮是否分别调用上游
      const bothCalledUpstream = round1Result.meta.cacheStatus === 'bypass' && round2Result.meta.cacheStatus === 'bypass';
      reportLines.push(`  两轮是否分别调用上游: ${bothCalledUpstream ? '是（cacheStatus 均为 bypass）' : '否'}`);
    }

    if (hasTimeoutOrFailure) {
      console.log(`  ⚠️ 发生超时或失败`);
      reportLines.push(`  ⚠️ 发生超时或失败`);
    }

    console.log();
    reportLines.push('');
  }

  // 写入报告文件（根据模式分别输出，避免互相覆盖）
  fs.writeFileSync(REPORT_FILE, reportLines.join('\n'), 'utf8');
  console.log(`原始摘要已保存到: ${REPORT_FILE}`);

  console.log('========================================');
  if (hasFailure) {
    console.log('验证结束：存在失败项（模式不符、必填字段缺失、cacheStatus 非 bypass、ID 重合率不足或请求失败）');
    process.exitCode = 1;
  } else {
    console.log('验证完成：所有股票两轮查询通过，必填字段检查通过，cacheStatus=bypass，ID 重合率 ≥ 80%');
    process.exitCode = 0;
  }
  console.log('========================================');
}

// 仅在直接运行时执行 main（作为模块导入时不执行）
const isMainModule = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('verify_event_news.mjs');
if (isMainModule) {
  main().catch((err) => {
    console.error('验证脚本异常:', err.message);
    process.exit(1);
  });
}
