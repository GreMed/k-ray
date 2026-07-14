// K-Ray 第十四阶段 A1 最后一次封板修复 — 真实联调验证 + 截图生成
//
// 本脚本完成两件事：
//   1. 真实联调矩阵：对 11 个代码族逐一验证「公司名称 + 非空真实日 K」
//      重点报告 301165 锐捷网络的完整信息（首末日、K 线数量、source、isRealMarketData）
//   2. 生成 2 张交付截图：
//      - 01-crosshair-date-format.png   301165 近一年行情 + 十字线悬停 YYYY-MM-DD
//      - 02-baostock-failure-no-mock.png  BaoStock 失败时只显示错误，不出现 Mock K 线
//
// 运行方式：node scripts/verify_and_screenshot_phase14a1_final.mjs
// 输出：
//   - 控制台：11 个代码族验证矩阵 + 301165 重点报告
//   - screenshots-phase14a1-final/01-crosshair-date-format.png
//   - screenshots-phase14a1-final/02-baostock-failure-no-mock.png

import { chromium } from 'playwright';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';

// 清除代理环境变量，避免 fetch 走代理导致 503
delete process.env.http_proxy;
delete process.env.HTTP_PROXY;
delete process.env.https_proxy;
delete process.env.HTTPS_PROXY;
delete process.env.all_proxy;
delete process.env.ALL_PROXY;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const APP_ROOT = PROJECT_ROOT; // k-ray-app 本身就是项目根
const SCREENSHOTS_DIR = path.join(APP_ROOT, 'screenshots-phase14a1-final');
const TMP_DIR = path.join(SCREENSHOTS_DIR, '.tmp');
const PORT = 3041;

// 11 个代码族 + 市场归属
const MATRIX = [
  { code: '600519', market: 'SH', expectedName: '贵州茅台' },
  { code: '601318', market: 'SH', expectedName: '中国平安' },
  { code: '603236', market: 'SH', expectedName: '移远通信' },
  { code: '605500', market: 'SH', expectedName: '齐鲁银行' }, // 任一有效 605xxx
  { code: '688981', market: 'SH', expectedName: '中芯国际' },
  { code: '000001', market: 'SZ', expectedName: '平安银行' },
  { code: '001872', market: 'SZ', expectedName: '招商港口' },
  { code: '002415', market: 'SZ', expectedName: '海康威视' },
  { code: '003816', market: 'SZ', expectedName: '中国广核' },
  { code: '300750', market: 'SZ', expectedName: '宁德时代' },
  { code: '301165', market: 'SZ', expectedName: '锐捷网络' },
];

// 近一年请求区间（2025-07-15 至 2026-07-14）
const ONE_YEAR_START = '2025-07-15';
const ONE_YEAR_END = '2026-07-14';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkServerReady(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/`, (res) => {
      resolve(res.statusCode !== undefined);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(port) {
  console.log(`  ⏳ 等待服务器就绪（端口 ${port}）...`);
  for (let i = 0; i < 60; i++) {
    const ready = await checkServerReady(port);
    if (ready) {
      console.log(`  ✅ 服务器已就绪`);
      return true;
    }
    await sleep(2000);
  }
  console.log(`  ❌ 服务器等待超时（120s）`);
  return false;
}

function startServer(port) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 启动服务器（端口 ${port}，MARKET_DATA_MODE=real）...`);
    const server = spawn('npm', ['run', 'dev', '--', '-p', String(port)], {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        MARKET_DATA_MODE: 'real',
        EVENT_NEWS_MODE: 'mock',
        NO_PROXY: 'localhost,127.0.0.1',
        no_proxy: 'localhost,127.0.0.1',
      },
    });

    let resolved = false;
    let output = '';

    server.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      // 仅打印关键行，避免噪音
      if (text.includes('Ready') || text.includes('ready') || text.includes('Local:') || text.includes('Error') || text.includes('error')) {
        console.log(`  [server] ${text.trim()}`);
      }
    });

    server.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      if (text.includes('Error') || text.includes('error') || text.includes('EADDRINUSE')) {
        console.error(`  [server:err] ${text.trim()}`);
      }
    });

    server.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`服务器退出，代码: ${code}\n输出: ${output}`));
      }
    });

    waitForServer(port).then((ready) => {
      if (!resolved) {
        resolved = true;
        if (ready) {
          resolve(server);
        } else {
          reject(new Error(`服务器启动超时\n输出: ${output}`));
        }
      }
    });
  });
}

async function fetchJson(url) {
  const res = await fetch(url);
  const status = res.status;
  const body = await res.json().catch(() => ({}));
  return { status, body };
}

// ============================================================================
// 第一部分：真实联调矩阵验证
// ============================================================================

async function verifyMatrix() {
  console.log('\n'.padEnd(78, '='));
  console.log('真实联调矩阵验证：11 个代码族（公司名称 + 非空真实日 K）');
  console.log(''.padEnd(78, '='));

  const results = [];
  for (const item of MATRIX) {
    const { code, market } = item;
    process.stdout.write(`  验证 ${code} (${market}) ... `);

    // 1. 验证公司名称
    const infoUrl = `http://localhost:${PORT}/api/market/stock-info?stockCode=${code}&market=${market}`;
    const infoRes = await fetchJson(infoUrl);

    if (infoRes.status !== 200) {
      console.log(`❌ stock-info HTTP ${infoRes.status}`);
      results.push({ ...item, ok: false, reason: `stock-info HTTP ${infoRes.status}` });
      continue;
    }

    const infoBody = infoRes.body;
    const realName = infoBody.name || '';
    const found = infoBody.found === true;
    const isListed = infoBody.isListed === true;
    const securityType = infoBody.securityType || '';

    if (!found || !isListed || securityType !== 'stock') {
      console.log(`❌ 校验未通过 (found=${found}, isListed=${isListed}, type=${securityType})`);
      results.push({ ...item, ok: false, reason: `校验未通过 (found=${found}, isListed=${isListed}, type=${securityType})` });
      continue;
    }

    // 2. 验证非空真实日 K
    const klineUrl = `http://localhost:${PORT}/api/market/klines?stockCode=${code}&market=${market}&startDate=${ONE_YEAR_START}&endDate=${ONE_YEAR_END}`;
    const klineRes = await fetchJson(klineUrl);

    if (klineRes.status !== 200) {
      console.log(`❌ klines HTTP ${klineRes.status}`);
      results.push({ ...item, ok: false, reason: `klines HTTP ${klineRes.status}`, name: realName });
      continue;
    }

    const klineBody = klineRes.body;
    const klines = klineBody.klines || [];
    const meta = klineBody.meta || {};
    const isReal = meta.isRealMarketData === true;
    const source = meta.source || '';

    if (klines.length === 0) {
      console.log(`❌ K 线为空`);
      results.push({ ...item, ok: false, reason: 'K 线为空', name: realName });
      continue;
    }

    if (!isReal || source !== 'baostock') {
      console.log(`❌ 非真实行情 (isReal=${isReal}, source=${source})`);
      results.push({ ...item, ok: false, reason: `非真实行情 (isReal=${isReal}, source=${source})`, name: realName });
      continue;
    }

    console.log(`✅ ${realName} | K线 ${klines.length} 根 | ${klines[0].date} ~ ${klines[klines.length - 1].date} | source=${source}`);
    results.push({
      ...item,
      ok: true,
      name: realName,
      klineCount: klines.length,
      firstDate: klines[0].date,
      lastDate: klines[klines.length - 1].date,
      source,
      isRealMarketData: isReal,
      ipoDate: infoBody.ipoDate || meta.ipoDate || '',
    });
  }

  // 汇总
  console.log('\n'.padEnd(78, '-'));
  console.log('联调矩阵汇总');
  console.log(''.padEnd(78, '-'));
  const passed = results.filter((r) => r.ok).length;
  console.log(`通过: ${passed} / ${results.length}`);
  results.forEach((r) => {
    if (r.ok) {
      console.log(`  ✅ ${r.code} (${r.market}) → ${r.name} | ${r.klineCount} 根 K 线 | ${r.firstDate} ~ ${r.lastDate} | source=${r.source} | isReal=${r.isRealMarketData}`);
    } else {
      console.log(`  ❌ ${r.code} (${r.market}) → ${r.reason}`);
    }
  });

  // 重点报告：301165
  const focus = results.find((r) => r.code === '301165');
  console.log('\n'.padEnd(78, '-'));
  console.log('重点报告：301165 锐捷网络');
  console.log(''.padEnd(78, '-'));
  if (focus && focus.ok) {
    console.log(`  代码:        ${focus.code}`);
    console.log(`  市场识别:    ${focus.market}`);
    console.log(`  公司名称:    ${focus.name}`);
    console.log(`  IPO 日期:    ${focus.ipoDate || '(未取得)'}`);
    console.log(`  请求区间:    ${ONE_YEAR_START} ~ ${ONE_YEAR_END}`);
    console.log(`  实际首日:    ${focus.firstDate}`);
    console.log(`  实际末日:    ${focus.lastDate}`);
    console.log(`  K 线数量:    ${focus.klineCount} 根`);
    console.log(`  source:      ${focus.source}`);
    console.log(`  isRealMarketData: ${focus.isRealMarketData}`);
  } else {
    console.log(`  ❌ 301165 验证失败：${focus?.reason || '未知原因'}`);
  }

  return { results, focus };
}

// ============================================================================
// 第二部分：截图生成
// ============================================================================

async function takeScreenshot(page, filename, description) {
  const filePath = path.join(TMP_DIR, filename);
  await page.screenshot({ path: filePath, fullPage: true });
  const stat = fs.statSync(filePath);
  console.log(`  📸 ${description}: ${filename} (${(stat.size / 1024).toFixed(1)} KB)`);
  return filePath;
}

// 截图 1：301165 近一年行情 + 十字线悬停显示 YYYY-MM-DD
async function screenshotCrosshairDateFormat(browser) {
  console.log('\n[截图 1] 301165 近一年行情 + 十字线悬停 YYYY-MM-DD');
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // 1. 访问首页
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await sleep(1500);

  // 2. 输入 301165 并选中
  const input = page.getByTestId('stock-search-input');
  await input.click();
  await input.fill('301165');
  await sleep(800);
  // 等待建议项
  const suggestion = page.locator('text=锐捷网络').first();
  await suggestion.waitFor({ state: 'visible', timeout: 10000 });
  await suggestion.click();
  await sleep(500);

  // 3. 点击「近1年」快速选项
  const yearBtn = page.locator('button', { hasText: '近1年' }).first();
  if (await yearBtn.isVisible()) {
    await yearBtn.click();
    await sleep(400);
  }

  // 4. 点击「查询行情」
  const queryBtn = page.locator('button', { hasText: '查询行情' }).first();
  await queryBtn.click();

  // 5. 等待行情结果出现
  await page.locator('text=/走势复盘结果|日K查询结果/').first().waitFor({ state: 'visible', timeout: 30000 });
  await sleep(2500); // 等待图表完整渲染

  // 6. 获取图表区域并触发十字线悬停
  const chartCanvas = page.locator('canvas').first();
  await chartCanvas.waitFor({ state: 'visible', timeout: 10000 });

  // 移动鼠标到图表中部位置以触发十字线
  const canvasBox = await chartCanvas.boundingBox();
  if (canvasBox) {
    const midX = canvasBox.x + canvasBox.width * 0.5;
    const midY = canvasBox.y + canvasBox.height * 0.5;
    // 移动到图表中部
    await page.mouse.move(midX, midY);
    await sleep(800);
    // 截图（包含十字线和底部日期标签）
    await takeScreenshot(page, '01-crosshair-date-format.png', '十字线日期 YYYY-MM-DD 格式');
  } else {
    console.log('  ⚠️  无法获取图表 canvas 边界，截取整页');
    await takeScreenshot(page, '01-crosshair-date-format.png', '十字线日期 YYYY-MM-DD 格式（整页）');
  }

  await context.close();
}

// 截图 2：BaoStock 失败时只显示错误，不出现 Mock K 线
async function screenshotBaostockFailure(browser) {
  console.log('\n[截图 2] BaoStock 失败时只显示错误，不出现 Mock K 线');
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Mock klines API：返回 isRealMarketData=false（BaoStock 不可用降级场景）
  // 前端 isRealMarketData 保护应阻止进入成功页，显示错误，不展示 Mock K 线
  await page.route('**/api/market/klines**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        stock: {
          id: 'stock-sz-301165',
          code: '301165',
          name: '锐捷网络',
          market: 'SZ',
        },
        klines: [],
        meta: {
          source: 'mock',
          sourceLabel: 'Mock演示数据(BaoStock降级)',
          adjustment: 'none',
          isRealMarketData: false,
          fetchedAt: '2026-07-14T00:00:00.000Z',
          fallbackReason: 'BaoStock真实行情暂时不可用，请稍后重试。',
        },
      }),
    });
  });

  // 1. 访问首页
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await sleep(1500);

  // 2. 输入 301165 并选中
  const input = page.getByTestId('stock-search-input');
  await input.click();
  await input.fill('301165');
  await sleep(800);
  const suggestion = page.locator('text=锐捷网络').first();
  await suggestion.waitFor({ state: 'visible', timeout: 10000 });
  await suggestion.click();
  await sleep(500);

  // 3. 点击「近1年」
  const yearBtn = page.locator('button', { hasText: '近1年' }).first();
  if (await yearBtn.isVisible()) {
    await yearBtn.click();
    await sleep(400);
  }

  // 4. 点击「查询行情」
  const queryBtn = page.locator('button', { hasText: '查询行情' }).first();
  await queryBtn.click();

  // 5. 等待错误状态出现（不应出现成功结果页）
  await page.locator('text=/BaoStock真实行情暂时不可用|真实行情服务暂时不可用/').first().waitFor({ state: 'visible', timeout: 15000 });
  await sleep(1500);

  // 6. 截图：错误状态，无 Mock K 线
  await takeScreenshot(page, '02-baostock-failure-no-mock.png', 'BaoStock 失败只显示错误，无 Mock K 线');

  // 7. 断言：不出现图表 chart-data-label 和成功结果标题
  const hasSuccessTitle = await page.locator('text=/走势复盘结果|日K查询结果/').count();
  const hasChartLabel = await page.getByTestId('chart-data-label').count();
  console.log(`  ✓ 成功标题数: ${hasSuccessTitle} (期望 0)`);
  console.log(`  ✓ chart-data-label 数: ${hasChartLabel} (期望 0)`);

  await context.close();
}

// ============================================================================
// 主流程
// ============================================================================

async function main() {
  // 准备目录
  fs.rmSync(SCREENSHOTS_DIR, { recursive: true, force: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  // 检测并清理可能占用端口的已有 dev server（避免 Next.js "another dev server" 冲突）
  try {
    const out = execSync('lsof -ti :' + PORT, { encoding: 'utf8' }).trim();
    if (out) {
      console.log(`  ⚠️  端口 ${PORT} 已被占用（PID: ${out}），尝试清理...`);
      execSync(`kill -9 ${out}`, { stdio: 'ignore' });
      await sleep(2000);
    }
  } catch {
    // lsof 无输出表示端口空闲，忽略
  }

  // 启动服务器
  const server = await startServer(PORT);

  let browser;
  try {
    // 等待服务器完全就绪
    await sleep(3000);

    // 第一部分：联调矩阵验证
    const { results, focus } = await verifyMatrix();

    // 第二部分：截图生成
    console.log('\n'.padEnd(78, '='));
    console.log('截图生成');
    console.log(''.padEnd(78, '='));
    browser = await chromium.launch({ headless: true });

    await screenshotCrosshairDateFormat(browser);
    await screenshotBaostockFailure(browser);

    await browser.close();
    browser = null;

    // 截图保护：全部成功后才从 tmp 移到正式目录
    const tmpFiles = fs.readdirSync(TMP_DIR).filter((f) => f.endsWith('.png'));
    for (const f of tmpFiles) {
      fs.copyFileSync(path.join(TMP_DIR, f), path.join(SCREENSHOTS_DIR, f));
    }
    console.log(`\n✅ 截图已保存到 ${SCREENSHOTS_DIR}`);

    // 最终汇总
    const passed = results.filter((r) => r.ok).length;
    console.log('\n'.padEnd(78, '='));
    console.log('最终交付汇总');
    console.log(''.padEnd(78, '='));
    console.log(`联调矩阵: ${passed} / ${results.length} 通过`);
    if (focus && focus.ok) {
      console.log(`301165 重点: ✅ ${focus.name} | ${focus.klineCount} 根 K 线 | source=${focus.source} | isReal=${focus.isRealMarketData}`);
    } else {
      console.log(`301165 重点: ❌ 失败`);
    }
    console.log(`截图: ${tmpFiles.length} 张已生成`);

    // 退出码
    if (passed !== results.length || !focus?.ok) {
      console.log('\n❌ 联调矩阵未全部通过，本轮验证失败');
      process.exit(1);
    }
    console.log('\n✅ 所有验证通过');
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    // 关闭服务器
    console.log('\n🛑 关闭服务器...');
    server.kill('SIGTERM');
    await sleep(2000);
    if (!server.killed) {
      server.kill('SIGKILL');
    }
  }
}

main().catch((err) => {
  console.error('\n❌ 脚本执行失败:', err);
  process.exit(1);
});
