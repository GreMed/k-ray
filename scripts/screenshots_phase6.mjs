// K-Ray 第六阶段截图脚本（严格断言版）
// 使用方法：node scripts/screenshots_phase6.mjs
//
// 严格规则：
// - 找不到按钮、目标状态或关键文案时立即 throw
// - 禁止 catch 后只打印警告继续保存截图
// - 每张截图保存前必须断言目标元素存在且可见
// - 单独使用 screenshots_phase6 目录
// - 截图来自实际 BaoStock 联调（环境变量 MARKET_DATA_MODE 控制）
//
// 生成6张截图：
//   01-baostock-600519-real.png            600519真实行情
//   02-real-market-mock-events-label.png   真实行情+Mock事件标注
//   03-baostock-000001-no-mock-events.png  000001无Mock事件
//   04-baostock-fallback.png               降级模式
//   05-baostock-error.png                  错误状态
//   06-mobile-real-market.png              移动端真实行情

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const SCREENSHOTS_DIR = path.join(PROJECT_ROOT, '..', 'screenshots_phase6');
const DEV_PORT = 3002;
const DEV_URL = `http://localhost:${DEV_PORT}`;

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function assertVisible(page, selector, description) {
  const locator = page.locator(selector).first();
  try {
    await locator.waitFor({ state: 'visible', timeout: 15000 });
  } catch (err) {
    throw new Error(`断言失败："${description}" (${selector}) 不可见或不存在: ${err.message}`);
  }
  const isVisible = await locator.isVisible();
  if (!isVisible) {
    throw new Error(`断言失败："${description}" (${selector}) 不可见`);
  }
  console.log(`  ✅ ${description} 可见`);
}

async function assertText(page, text, description) {
  const locator = page.getByText(text).first();
  try {
    await locator.waitFor({ state: 'visible', timeout: 15000 });
  } catch (err) {
    throw new Error(`断言失败："${description}" — 文本 "${text}" 未找到: ${err.message}`);
  }
  console.log(`  ✅ ${description} — 文本 "${text}" 存在`);
}

async function assertTextNotExists(page, text, description) {
  const count = await page.getByText(text).count();
  if (count > 0) {
    throw new Error(`断言失败："${description}" — 文本 "${text}" 应该不存在，但找到了 ${count} 个`);
  }
  console.log(`  ✅ ${description} — 文本 "${text}" 不存在（符合预期）`);
}

async function takeScreenshot(page, filename, description) {
  const filePath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: filePath, fullPage: true });
  if (!fs.existsSync(filePath)) {
    throw new Error(`截图失败：文件未生成 ${filePath}`);
  }
  const stat = fs.statSync(filePath);
  if (stat.size < 1000) {
    throw new Error(`截图异常：文件过小 (${stat.size} bytes) ${filePath}`);
  }
  console.log(`  📸 ${description}: ${filename} (${(stat.size / 1024).toFixed(1)} KB)`);
  return filePath;
}

function startServer(env, name) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 启动${name}服务器（端口 ${DEV_PORT}）...`);
    const server = spawn('npm', ['run', 'dev', '--', '-p', String(DEV_PORT)], {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    });

    let resolved = false;
    let output = '';

    server.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      if (text.includes(`:${DEV_PORT}`) || text.includes('Ready') || text.includes('ready')) {
        if (!resolved) {
          resolved = true;
          setTimeout(() => resolve(server), 3000);
        }
      }
    });

    server.stderr.on('data', (data) => {
      output += data.toString();
    });

    server.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`${name}服务器退出，代码: ${code}\n输出: ${output}`));
      }
    });

    setTimeout(() => {
      if (!resolved) {
        console.log(`  ⏳ 等待超时，假设已启动...`);
        resolve(server);
        resolved = true;
      }
    }, 30000);
  });
}

// 通过搜索框选择股票
async function selectStock(page, keyword, stockName) {
  console.log(`  搜索股票: ${keyword}`);
  const input = page.getByPlaceholder(/输入.*6.*位.*股.*代码/);
  await input.fill(keyword);
  await sleep(500);
  // 等待建议出现并点击
  const suggestion = page.getByText(stockName, { exact: false }).first();
  await suggestion.waitFor({ state: 'visible', timeout: 5000 });
  await suggestion.click();
  await sleep(500);
  console.log(`  ✅ 已选择 ${stockName}`);
}

// 开启真实行情开关
async function enableRealMarket(page) {
  const toggle = page.locator('[data-testid="real-market-toggle"]');
  await toggle.waitFor({ state: 'visible', timeout: 5000 });
  const isChecked = await toggle.isChecked();
  if (!isChecked) {
    await toggle.click();
    await sleep(300);
  }
  console.log('  ✅ 已开启真实行情开关');
}

// 设置日期范围
async function setDateRange(page, start, end) {
  const startInput = page.locator('input[type="date"]').first();
  const endInput = page.locator('input[type="date"]').last();
  await startInput.fill(start);
  await endInput.fill(end);
  await sleep(300);
  console.log(`  ✅ 已设置日期范围: ${start} 至 ${end}`);
}

// 点击开始复盘并等待成功
async function startReplayAndWait(page) {
  const btn = page.getByRole('button', { name: '开始复盘' });
  await btn.waitFor({ state: 'visible', timeout: 5000 });
  await btn.click();
  // 等待成功状态
  await page.getByText(/走势复盘结果/).first().waitFor({ state: 'visible', timeout: 30000 });
  await sleep(2000); // 给K线图额外渲染时间
  console.log('  ✅ 复盘完成，K线图已渲染');
}

async function clickReset(page) {
  const btn = page.getByRole('button', { name: '重新复盘' });
  await btn.click();
  await sleep(500);
}

async function run() {
  console.log('========================================');
  console.log('  K-Ray 第六阶段截图（严格断言版）');
  console.log('  使用 BaoStock 真实联调');
  console.log('========================================');

  let server = null;
  let browser = null;
  let page = null;

  try {
    // 启动浏览器
    browser = await chromium.launch({ headless: true });
    console.log('✅ Playwright 浏览器启动成功');

    // ========================================
    // 截图 1+2: 600519 真实行情（fallback 模式）
    // ========================================
    console.log('\n========================================');
    console.log('  截图 1+2: 600519 真实行情 + Mock事件标注');
    console.log('========================================');
    server = await startServer({
      MARKET_DATA_MODE: 'fallback',
      BAOSTOCK_PYTHON_PATH: path.join(PROJECT_ROOT, '.venv', 'bin', 'python3'),
    }, 'fallback模式');

    const context1 = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    page = await context1.newPage();

    console.log(`\n📍 访问: ${DEV_URL}`);
    const response = await page.goto(DEV_URL, { waitUntil: 'networkidle', timeout: 30000 });
    if (!response.ok()) {
      throw new Error(`服务器返回状态码: ${response.status()}`);
    }
    await sleep(2000);

    // 选择 600519
    await selectStock(page, '600519', '贵州茅台');
    await enableRealMarket(page);
    await setDateRange(page, '2024-01-01', '2024-03-31');

    // ===== 截图1: 600519 真实行情 =====
    console.log('\n🎬 01: 600519 BaoStock真实行情');
    await startReplayAndWait(page);

    // 断言真实行情文案
    await assertText(page, '当前K线为BaoStock真实历史行情（前复权日线）。', '真实行情文案');
    // 断言图表底部标注
    await assertText(page, '真实历史行情', '图表真实行情标注');
    await assertText(page, 'BaoStock', '图表BaoStock标注');
    // 断言 K 线图表已渲染
    await assertVisible(page, '[data-testid="chart-container"]', 'K线图表容器');
    // 断言不显示"所有K线均为模拟"冲突文案
    await assertTextNotExists(page, /所有 K 线/, '冲突文案不存在');
    // 断言图表不显示旧固定文案
    await assertTextNotExists(page, '演示数据 - 不代表真实市场行情', '图表旧固定文案不存在');

    await takeScreenshot(page, '01-baostock-600519-real.png', '600519 BaoStock真实行情');

    // ===== 截图2: 真实行情 + Mock事件标注 =====
    console.log('\n🎬 02: 真实行情 + Mock事件标注');
    // 600519 应同时显示 Mock 事件（区间重叠）
    await assertText(page, '事件、节点、来源和未来日历仍为Mock演示内容。', 'Mock事件标注文案');
    // 滚动到事件列表区域，确保截图能看到事件
    const eventList = page.locator('h4:has-text("事件列表")').first();
    if (await eventList.count() > 0) {
      await eventList.scrollIntoViewIfNeeded();
      await sleep(500);
    }
    await takeScreenshot(page, '02-real-market-mock-events-label.png', '真实行情+Mock事件标注');

    // 重置到初始状态
    await clickReset(page);

    // ===== 截图3: 000001 真实行情，无Mock事件 =====
    console.log('\n🎬 03: 000001 真实行情，无Mock事件');
    await selectStock(page, '000001', '平安银行');
    await enableRealMarket(page);
    await setDateRange(page, '2024-01-01', '2024-03-31');
    await startReplayAndWait(page);

    // 断言真实行情文案
    await assertText(page, '当前K线为BaoStock真实历史行情（前复权日线）。', '真实行情文案');
    // 断言图表底部标注
    await assertText(page, '真实历史行情', '图表真实行情标注');
    // 断言显示"该股票暂未接入真实事件数据"
    await assertText(page, '该股票暂未接入真实事件数据。', '非600519提示');
    // 断言不显示贵州茅台Mock事件标题
    await assertTextNotExists(page, '2023年度业绩预告超预期', '茅台Mock事件1');
    await assertTextNotExists(page, '白酒行业政策调整信息', '茅台Mock事件2');
    await assertTextNotExists(page, '多家券商更新研究观点', '茅台Mock事件3');
    // 断言RiskWarning显示真实行情文案
    await assertText(page, '行情数据说明', 'RiskWarning行情数据说明');

    await takeScreenshot(page, '03-baostock-000001-no-mock-events.png', '000001无Mock事件');

    // 关闭第一个 context
    await context1.close();

    // 关闭 fallback 服务器
    if (server) {
      server.kill();
      server = null;
      await sleep(3000);
      console.log('\nfallback 服务器已关闭');
    }

    // ========================================
    // 截图 4: fallback 降级模式
    // ========================================
    console.log('\n========================================');
    console.log('  截图 4: fallback 降级模式');
    console.log('========================================');
    // 启动 fallback 模式服务器，但 Python 路径指向不存在的位置，触发降级
    server = await startServer({
      MARKET_DATA_MODE: 'fallback',
      BAOSTOCK_PYTHON_PATH: '/nonexistent/python3',
    }, 'fallback降级');

    const context2 = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    page = await context2.newPage();

    console.log(`\n📍 访问: ${DEV_URL}`);
    const response2 = await page.goto(DEV_URL, { waitUntil: 'networkidle', timeout: 30000 });
    if (!response2.ok()) {
      throw new Error(`服务器返回状态码: ${response2.status()}`);
    }
    await sleep(2000);

    await selectStock(page, '600519', '贵州茅台');
    await enableRealMarket(page);
    await setDateRange(page, '2024-01-01', '2024-03-31');
    await startReplayAndWait(page);

    // 断言降级文案
    await assertText(page, 'BaoStock真实行情暂时不可用，当前已降级为本地Mock行情。', '降级文案');
    // 断言图表底部标注
    await assertText(page, '已降级为本地Mock', '图表降级标注');
    // 断言RiskWarning显示降级文案
    await assertText(page, '行情数据说明——BaoStock当前不可用', 'RiskWarning降级文案');

    await takeScreenshot(page, '04-baostock-fallback.png', 'fallback降级模式');

    await context2.close();

    if (server) {
      server.kill();
      server = null;
      await sleep(3000);
      console.log('\nfallback降级 服务器已关闭');
    }

    // ========================================
    // 截图 5: real 模式错误状态
    // ========================================
    console.log('\n========================================');
    console.log('  截图 5: real 模式错误状态');
    console.log('========================================');
    // real 模式下 Python 不可用，直接返回错误，不降级
    server = await startServer({
      MARKET_DATA_MODE: 'real',
      BAOSTOCK_PYTHON_PATH: '/nonexistent/python3',
    }, 'real错误');

    const context3 = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    page = await context3.newPage();

    console.log(`\n📍 访问: ${DEV_URL}`);
    const response3 = await page.goto(DEV_URL, { waitUntil: 'networkidle', timeout: 30000 });
    if (!response3.ok()) {
      throw new Error(`服务器返回状态码: ${response3.status()}`);
    }
    await sleep(2000);

    await selectStock(page, '600519', '贵州茅台');
    await enableRealMarket(page);
    await setDateRange(page, '2024-01-01', '2024-03-31');

    // 点击开始复盘，等待错误状态
    const btn = page.getByRole('button', { name: '开始复盘' });
    await btn.click();
    await page.getByText('加载失败').first().waitFor({ state: 'visible', timeout: 30000 });
    await sleep(1500);

    // 断言错误状态
    await assertText(page, '加载失败', '错误状态标题');
    await assertVisible(page, 'button:has-text("重试")', '重试按钮');

    await takeScreenshot(page, '05-baostock-error.png', 'real模式错误状态');

    await context3.close();

    if (server) {
      server.kill();
      server = null;
      await sleep(3000);
      console.log('\nreal错误 服务器已关闭');
    }

    // ========================================
    // 截图 6: 移动端真实行情
    // ========================================
    console.log('\n========================================');
    console.log('  截图 6: 移动端真实行情');
    console.log('========================================');
    server = await startServer({
      MARKET_DATA_MODE: 'fallback',
      BAOSTOCK_PYTHON_PATH: path.join(PROJECT_ROOT, '.venv', 'bin', 'python3'),
    }, '移动端真实行情');

    const context4 = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
    });
    page = await context4.newPage();

    console.log(`\n📍 访问: ${DEV_URL}`);
    const response4 = await page.goto(DEV_URL, { waitUntil: 'networkidle', timeout: 30000 });
    if (!response4.ok()) {
      throw new Error(`服务器返回状态码: ${response4.status()}`);
    }
    await sleep(2000);

    await selectStock(page, '600519', '贵州茅台');
    await enableRealMarket(page);
    await setDateRange(page, '2024-01-01', '2024-03-31');
    await startReplayAndWait(page);

    await assertText(page, '当前K线为BaoStock真实历史行情（前复权日线）。', '移动端真实行情文案');

    await takeScreenshot(page, '06-mobile-real-market.png', '移动端真实行情');

    await context4.close();

    console.log('\n========================================');
    console.log('  🎉 全部6张截图生成成功！');
    console.log(`  目录: ${SCREENSHOTS_DIR}`);
    console.log('========================================');

  } catch (error) {
    console.error('\n❌ 截图流程失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
    if (server) server.kill();
    await sleep(1000);
  }
}

run();
