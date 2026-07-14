/**
 * K-Ray 第七阶段公告数据本地验证脚本（方案B：通过本地 /api/announcements 请求）
 *
 * 使用前必须先启动带相应环境变量的开发服务器：
 *   ANNOUNCEMENT_DATA_MODE=mock npm run dev
 *   ANNOUNCEMENT_DATA_MODE=real npm run dev
 *   ANNOUNCEMENT_DATA_MODE=fallback npm run dev
 *
 * 然后运行：
 *   npm run verify:announcements
 *
 * 默认请求 http://localhost:3000/api/announcements
 * 可通过 VERIFY_API_BASE 环境变量修改。
 *
 * 可选环境变量 VERIFY_EXPECTED_MODE：
 *   mock     - 两只股票必须 HTTP 200 且 source=mock
 *   real     - 当前允许预期 HTTP 503 和"无法验证"错误
 *   fallback - 必须 HTTP 200、source=mock 且存在 fallbackReason
 *
 * 退出码：
 *   0 - 所有股票验证通过（或符合预期模式）
 *   1 - 存在失败项
 *
 * 这个脚本是纯 mjs，不参与 Next.js 构建，不会出现在生产 bundle 中。
 */

const API_BASE = process.env.VERIFY_API_BASE || 'http://localhost:3000';
const EXPECTED_MODE = process.env.VERIFY_EXPECTED_MODE || '';
const STOCKS = [
  { code: '600519', market: 'SH', name: '贵州茅台' },
  { code: '000001', market: 'SZ', name: '平安银行' },
];
const START_DATE = '2024-01-01';
const END_DATE = '2024-03-31';

async function queryAnnouncements(stockCode, market, startDate, endDate) {
  const params = new URLSearchParams({ stockCode, market, startDate, endDate });
  const url = `${API_BASE}/api/announcements?${params.toString()}`;

  const res = await fetch(url);
  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`JSON解析失败: ${text.slice(0, 100)}`);
  }

  return { status: res.status, data };
}

function getModeLabel(result) {
  if (!result || !result.meta) return '-';
  if (result.meta.fallbackReason) return 'fallback（已降级）';
  if (result.meta.isRealAnnouncement) return 'real（真实数据）';
  return 'mock（演示数据）';
}

/**
 * 根据 VERIFY_EXPECTED_MODE 检查结果是否符合预期。
 * 返回 null 表示通过，返回字符串表示失败原因。
 */
function checkExpectedMode(status, data, result) {
  if (!EXPECTED_MODE) return null;

  if (EXPECTED_MODE === 'mock') {
    if (status !== 200) return `预期 HTTP 200，实际 ${status}`;
    if (!result || !result.meta) return '响应缺少 meta';
    if (result.meta.source !== 'mock') return `预期 source=mock，实际 ${result.meta.source}`;
    return null;
  }

  if (EXPECTED_MODE === 'real') {
    // real 模式允许 HTTP 503 且错误文案包含"无法验证"
    if (status === 503 && data && data.error && data.error.includes('无法验证')) {
      return null;
    }
    // real 模式如 HTTP 200，则必须满足：source=cninfo、isRealAnnouncement=false、verificationStatus=unverified
    if (status === 200 && result && result.meta) {
      if (result.meta.source === 'cninfo' &&
          result.meta.isRealAnnouncement === false &&
          result.meta.verificationStatus === 'unverified') {
        return null;
      }
      // 不得接受 source=mock
      if (result.meta.source === 'mock') {
        return 'real模式不得接受 source=mock，疑似连到mock服务';
      }
      return `real模式预期200(cninfo/unverified)或503(无法验证)，实际200但 source=${result.meta.source} isReal=${result.meta.isRealAnnouncement} status=${result.meta.verificationStatus}`;
    }
    return `real模式预期 HTTP 200(cninfo/unverified) 或 503(无法验证)，实际 ${status}`;
  }

  if (EXPECTED_MODE === 'fallback') {
    if (status !== 200) return `预期 HTTP 200，实际 ${status}`;
    if (!result || !result.meta) return '响应缺少 meta';
    if (result.meta.source !== 'mock') return `预期 source=mock，实际 ${result.meta.source}`;
    if (!result.meta.fallbackReason) return '预期存在 fallbackReason，实际无';
    return null;
  }

  return null;
}

async function main() {
  console.log('========================================');
  console.log('K-Ray 第七阶段公告数据验证脚本');
  console.log('========================================');
  console.log('注意：巨潮资讯网是深圳证券交易所法定信息披露平台。');
  console.log('本验证仅为技术可行性验证，不构成商业授权。');
  console.log(`API 地址: ${API_BASE}/api/announcements`);
  if (EXPECTED_MODE) {
    console.log(`预期模式: ${EXPECTED_MODE}`);
  }
  console.log();

  let hasFailure = false;

  for (const stock of STOCKS) {
    console.log(`--- ${stock.code}.${stock.market} (${stock.name}) ---`);
    console.log(`    日期区间: ${START_DATE} ~ ${END_DATE}`);

    try {
      const { status, data } = await queryAnnouncements(
        stock.code,
        stock.market,
        START_DATE,
        END_DATE,
      );

      console.log(`    HTTP状态: ${status}`);

      if (status !== 200) {
        console.log(`    错误: ${data.error || '未知错误'}`);
        // 检查是否符合预期模式
        const modeCheck = checkExpectedMode(status, data, null);
        if (modeCheck) {
          console.log(`    ✗ ${modeCheck}`);
          hasFailure = true;
        } else if (EXPECTED_MODE) {
          console.log(`    ✓ 符合预期模式 ${EXPECTED_MODE}`);
        } else {
          hasFailure = true;
        }
        console.log();
        continue;
      }

      const result = data;
      console.log(`    数据模式: ${getModeLabel(result)}`);
      console.log(`    验证状态: ${result.meta.verificationStatus}`);
      console.log(`    是否真实公告: ${result.meta.isRealAnnouncement}`);
      console.log(`    来源: ${result.meta.sourceLabel}`);
      console.log(`    公告数量: ${result.meta.total}`);

      if (result.meta.fallbackReason) {
        console.log(`    降级原因: ${result.meta.fallbackReason}`);
      }

      if (result.announcements && result.announcements.length > 0) {
        console.log();
        console.log('    公告列表:');
        result.announcements.slice(0, 5).forEach((item, i) => {
          console.log(`      ${i + 1}. [${item.category}] ${item.title}`);
          console.log(`         发布时间: ${item.publishedAt}`);
          console.log(`         ID: ${item.announcementId}`);
          console.log(`         来源平台: ${item.sourcePlatform}`);
          if (item.sourcePageUrl) {
            console.log(`         原文链接: ${item.sourcePageUrl}`);
          } else {
            console.log(`         原文链接: 无（Mock数据无真实原文链接）`);
          }
        });
      }

      // 检查是否符合预期模式
      const modeCheck = checkExpectedMode(status, data, result);
      if (modeCheck) {
        console.log(`    ✗ ${modeCheck}`);
        hasFailure = true;
      } else if (EXPECTED_MODE) {
        console.log(`    ✓ 符合预期模式 ${EXPECTED_MODE}`);
      }
    } catch (err) {
      console.log(`    请求失败: ${err.message}`);
      console.log(`    请确认开发服务器已启动: ANNOUNCEMENT_DATA_MODE=<mode> npm run dev`);
      hasFailure = true;
    }

    console.log();
  }

  console.log('========================================');
  if (hasFailure) {
    console.log('验证结束：存在失败项');
    process.exitCode = 1;
  } else {
    console.log('验证完成');
    process.exitCode = 0;
  }
  console.log('========================================');
}

main().catch((err) => {
  console.error('验证脚本异常:', err.message);
  process.exit(1);
});
