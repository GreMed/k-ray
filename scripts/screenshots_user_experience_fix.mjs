// K-Ray 普通用户查询体验修复截图脚本（V2）
//
// 生成截图：
//   01-ux-603236-real-klines.png       603236 显示「移远通信」并有真实 K 线
//   02-ux-market-service-unavailable.png  BaoStock 服务不可用的正确错误状态
//   03-ux-regular-user-entry.png       普通用户入口（无开发面板）
//   04-ux-dev-entry.png                开发入口（?dev=1 显示开发面板）
//   05-ux-mobile.png                   移动端视图
//
// 截图保护策略：
//   - 所有截图先输出到临时目录 screenshots_user_experience_fix/.tmp
//   - 全部场景断言成功后，才将临时目录内容整体替换到正式目录
//   - 失败时保留上一轮已存在的有效截图
//
// 环境说明：
//   - 服务器以 MARKET_DATA_MODE=real 启动（不设置 BAOSTOCK_PYTHON_PATH）
//   - 自动使用项目 .venv 中的 Python 调用 BaoStock
//   - 截图1和截图5使用真实 BaoStock API（不 mock）
//   - 截图2 mock klines API 返回 fallback + 空 K 线

import { chromium } from 'playwright';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const SCREENSHOTS_DIR = path.join(PROJECT_ROOT, '..', 'screenshots_user_experience_fix');
const TMP_DIR = path.join(SCREENSHOTS_DIR, '.tmp');
const PORT = 3030;

// 603236 截图使用的日期范围（确保有真实交易数据）
const QUERY_START_DATE = '2024-01-01';
const QUERY_END_DATE = '2024-06-30';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 轮询检查服务器是否可访问
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

// 等待服务器就绪（最多等 60 秒）
async function waitForServer(port) {
  console.log(`  ⏳ 等待服务器就绪（端口 ${port}）...`);
  for (let i = 0; i < 30; i++) {
    const ready = await checkServerReady(port);
    if (ready) {
      console.log(`  ✅ 服务器已就绪`);
      return true;
    }
    await sleep(2000);
  }
  console.log(`  ❌ 服务器等待超时`);
  return false;
}

function startServer(port) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 启动服务器（端口 ${port}，MARKET_DATA_MODE=real，不设置 BAOSTOCK_PYTHON_PATH）...`);
    const server = spawn('npm', ['run', 'dev', '--', '-p', String(port)], {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // 真实行情模式，不设置 BAOSTOCK_PYTHON_PATH 以验证 .venv 自动检测
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
      console.log(`  [server] ${text.trim()}`);
    });

    server.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.error(`  [server:err] ${text.trim()}`);
    });

    server.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`服务器退出，代码: ${code}\n输出: ${output}`));
      }
    });

    // 等待服务器就绪（轮询方式）
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

async function takeScreenshot(page, filename, description) {
  const filePath = path.join(TMP_DIR, filename);
  await page.screenshot({ path: filePath, fullPage: true });
  const stat = fs.statSync(filePath);
  console.log(`  📸 ${description}: ${filename} (${(stat.size / 1024).toFixed(1)} KB)`);
  return filePath;
}

// Mock klines API 返回 fallback + 空 K 线（模拟 BaoStock 不可用且无 Mock 数据）
async function mockFallbackEmptyKlines(page, stockCode, market, stockName) {
  await page.route('**/api/market/klines**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        stock: {
          id: `stock-${market.toLowerCase()}-${stockCode}`,
          code: stockCode,
          name: stockName,
          market,
        },
        klines: [],
        meta: {
          source: 'mock',
          sourceLabel: 'Mock演示数据(BaoStock降级)',
          adjustment: 'none',
          isRealMarketData: false,
          fetchedAt: '2024-07-01T00:00:00.000Z',
          fallbackReason: 'BaoStock真实行情暂时不可用，当前已降级为本地Mock行情。原因：BaoStock服务连接超时，且该股票无可用Mock数据。',
        },
      }),
    });
  });
}

// Mock stock-info API 返回真实名称（避免截图2等待真实查询）
async function mockStockInfo(page, stockCode, market, stockName) {
  await page.route('**/api/market/stock-info**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        stockCode,
        market,
        name: stockName,
        found: true,
        ipoDate: '2020-01-01',
      }),
    });
  });
}

// 输入股票代码并选择
async function inputCodeAndSelect(page, code) {
  const input = page.getByPlaceholder(/输入.*6.*位.*股.*代码/);
  await input.fill(code);
  await sleep(800);
  await input.press('Enter');
  await sleep(500);
}

// 设置日期范围并查询
async function setDatesAndQuery(page, startDate, endDate) {
  // 设置开始日期
  const startDateInput = page.locator('input[type="date"]').first();
  await startDateInput.fill(startDate);
  await sleep(200);

  // 设置结束日期
  const endDateInput = page.locator('input[type="date"]').nth(1);
  await endDateInput.fill(endDate);
  await sleep(200);

  // 点击查询按钮
  const queryBtn = page.getByText(/^(开始复盘|查询日K)$/);
  await queryBtn.click();
}

// 仅输入代码并点击查询（使用默认日期）
async function inputCodeAndQuery(page, code) {
  await inputCodeAndSelect(page, code);
  await sleep(500);
  const queryBtn = page.getByText(/^(开始复盘|查询日K)$/);
  await queryBtn.click();
}

// 带重试的页面导航
async function navigateWithRetry(page, url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      return;
    } catch (err) {
      if (i < retries - 1) {
        console.log(`  ⚠️ 导航失败，重试 ${i + 1}/${retries}: ${err.message}`);
        await sleep(3000);
      } else {
        throw err;
      }
    }
  }
}

// 断言603236显示「移远通信」并有真实K线
async function assert603236RealKlines(page) {
  const errors = [];
  const resultTitle = page.getByTestId('result-title');
  const titleVisible = await resultTitle.isVisible().catch(() => false);
  if (!titleVisible) {
    errors.push('603236截图必须显示结果标题');
    return errors;
  }
  const titleText = await resultTitle.textContent();
  if (!titleText || !titleText.includes('移远通信')) {
    errors.push(`603236截图结果标题应包含「移远通信」，实际: ${titleText}`);
  }
  if (!titleText || !titleText.includes('603236')) {
    errors.push(`603236截图结果标题应包含「603236」，实际: ${titleText}`);
  }
  // 不应出现伪造名称
  if (titleText && titleText.includes('股票603236')) {
    errors.push('603236截图不应出现伪造名称「股票603236」');
  }
  if (titleText && titleText.includes('名称暂未取得')) {
    errors.push('603236截图不应显示「名称暂未取得」（应显示真实名称）');
  }
  // K线图区域应可见
  const chart = page.getByTestId('kline-chart').or(page.locator('[data-testid="kline-chart"]'));
  const chartVisible = await chart.isVisible().catch(() => false);
  if (!chartVisible) {
    // 尝试其他选择器
    const chartAlt = page.locator('canvas').first();
    const chartAltVisible = await chartAlt.isVisible().catch(() => false);
    if (!chartAltVisible) {
      errors.push('603236截图应显示K线图');
    }
  }
  return errors;
}

// 断言行情服务不可用状态（fallback + 空 K 线）
async function assertMarketServiceUnavailable(page) {
  const errors = [];
  const errorState = page.getByTestId('error-state');
  const errorVisible = await errorState.isVisible().catch(() => false);
  if (!errorVisible) {
    errors.push('行情服务不可用截图必须显示错误状态');
    return errors;
  }
  const errorText = await errorState.textContent();
  if (!errorText || !errorText.includes('真实行情服务暂时不可用')) {
    errors.push('错误状态应包含「真实行情服务暂时不可用」');
  }
  if (!errorText || !errorText.includes('当前无法查询这只股票')) {
    errors.push('错误状态应包含「当前无法查询这只股票」');
  }
  // 不应显示「所选区间暂无交易数据」
  if (errorText && errorText.includes('所选区间暂无交易数据')) {
    errors.push('错误状态不应显示「所选区间暂无交易数据」（这是空状态文案，不是错误状态）');
  }
  // 不应显示「可能未上市」
  if (errorText && errorText.includes('可能未上市')) {
    errors.push('错误状态不应显示「可能未上市」');
  }
  // 不应显示「日期范围不正确」
  if (errorText && errorText.includes('日期范围不正确')) {
    errors.push('错误状态不应显示「日期范围不正确」');
  }
  // 重试按钮应可见
  const retryBtn = page.getByTestId('error-retry-btn');
  const retryVisible = await retryBtn.isVisible().catch(() => false);
  if (!retryVisible) {
    errors.push('错误状态应显示重试按钮');
  }
  // 返回按钮应可见
  const returnBtn = page.getByTestId('error-return-btn');
  const returnVisible = await returnBtn.isVisible().catch(() => false);
  if (!returnVisible) {
    errors.push('错误状态应显示返回修改按钮');
  }
  return errors;
}

// 断言普通用户入口（无开发面板）
async function assertRegularUserEntry(page) {
  const errors = [];
  const devPanel = page.getByText('🛠 开发模式');
  const devPanelVisible = await devPanel.isVisible().catch(() => false);
  if (devPanelVisible) {
    errors.push('普通用户入口不应显示开发面板');
  }
  const title = page.getByText('输入一只股票，看清每段关键走势的行情节点');
  const titleVisible = await title.isVisible().catch(() => false);
  if (!titleVisible) {
    errors.push('普通用户入口应显示页面标题');
  }
  return errors;
}

// 断言开发入口（有开发面板）
async function assertDevEntry(page) {
  const errors = [];
  const devPanel = page.getByText('🛠 开发模式');
  const devPanelVisible = await devPanel.isVisible().catch(() => false);
  if (!devPanelVisible) {
    errors.push('开发入口应显示开发面板');
  }
  return errors;
}

// 断言移动端
async function assertMobile(page) {
  const errors = [];
  const resultTitle = page.getByTestId('result-title');
  const titleVisible = await resultTitle.isVisible().catch(() => false);
  if (!titleVisible) {
    errors.push('移动端截图应显示查询结果');
  }
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
  });
  if (hasOverflow) {
    errors.push('移动端截图存在横向溢出');
  }
  return errors;
}

// 截图保护策略
function commitScreenshots(allSuccess) {
  if (!allSuccess) {
    console.log('\n🔒 存在失败场景，保留上一轮已存在的正式截图，不替换');
    if (fs.existsSync(TMP_DIR)) {
      const tmpFiles = fs.readdirSync(TMP_DIR).filter(f => f.endsWith('.png'));
      for (const f of tmpFiles) {
        fs.unlinkSync(path.join(TMP_DIR, f));
      }
    }
    return;
  }

  console.log('\n📦 全部场景断言通过，将临时截图整体替换到正式目录...');

  if (fs.existsSync(SCREENSHOTS_DIR)) {
    const oldFiles = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png'));
    for (const f of oldFiles) {
      fs.unlinkSync(path.join(SCREENSHOTS_DIR, f));
    }
  } else {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  if (fs.existsSync(TMP_DIR)) {
    const tmpFiles = fs.readdirSync(TMP_DIR).filter(f => f.endsWith('.png'));
    for (const f of tmpFiles) {
      const src = path.join(TMP_DIR, f);
      const dst = path.join(SCREENSHOTS_DIR, f);
      fs.renameSync(src, dst);
    }
  }

  console.log('  ✅ 截图已整体替换到正式目录');
}

async function run() {
  console.log('========================================');
  console.log('  K-Ray 普通用户查询体验修复截图（V2）');
  console.log('========================================');
  console.log(`  日期范围: ${QUERY_START_DATE} 至 ${QUERY_END_DATE}`);
  console.log('  服务器: MARKET_DATA_MODE=real，不设置 BAOSTOCK_PYTHON_PATH');

  // 准备临时目录
  if (fs.existsSync(TMP_DIR)) {
    const oldTmpFiles = fs.readdirSync(TMP_DIR).filter(f => f.endsWith('.png'));
    for (const f of oldTmpFiles) {
      fs.unlinkSync(path.join(TMP_DIR, f));
    }
  } else {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }
  console.log(`\n📁 临时截图目录: ${TMP_DIR}`);

  let server = null;
  let browser = null;
  let hasFailure = false;
  const screenshotResults = [];

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-proxy-server'],
    });
    console.log('\n✅ Playwright 浏览器启动成功（已禁用代理）');

    server = await startServer(PORT);

    let page = await browser.newPage();

    // ========== 截图1：603236 显示「移远通信」并有真实 K 线 ==========
    console.log('\n--- 截图1：603236 显示「移远通信」并有真实 K 线 ---');
    try {
      page = await browser.newPage();
      // 不 mock 任何 API，使用真实 BaoStock
      await navigateWithRetry(page, `http://localhost:${PORT}`);
      await sleep(2000);

      // 输入 603236 并选择
      await inputCodeAndSelect(page, '603236');
      await sleep(1000);

      // 设置日期范围并查询
      await setDatesAndQuery(page, QUERY_START_DATE, QUERY_END_DATE);

      // 等待结果标题可见（真实 BaoStock 查询可能需要几秒）
      await page.getByTestId('result-title').waitFor({ state: 'visible', timeout: 30000 });
      await sleep(2000); // 等待 K 线图渲染完成

      const errors = await assert603236RealKlines(page);
      if (errors.length > 0) {
        console.error('  ❌ 截图1断言失败:');
        errors.forEach(e => console.error(`     - ${e}`));
        hasFailure = true;
      } else {
        await takeScreenshot(page, '01-ux-603236-real-klines.png', '603236 移远通信 真实K线');
        screenshotResults.push('01-ux-603236-real-klines.png');
      }
    } catch (err) {
      console.error(`  ❌ 截图1失败：${err.message}`);
      hasFailure = true;
    }

    // ========== 截图2：BaoStock 服务不可用（fallback + 空 K 线） ==========
    console.log('\n--- 截图2：BaoStock 服务不可用的正确错误状态 ---');
    try {
      page = await browser.newPage();
      // Mock stock-info API 返回名称
      await mockStockInfo(page, '600519', 'SH', '贵州茅台');
      // Mock klines API 返回 fallback + 空 K 线
      await mockFallbackEmptyKlines(page, '600519', 'SH', '贵州茅台');
      await navigateWithRetry(page, `http://localhost:${PORT}`);
      await sleep(2000);

      // 输入 600519 并查询
      await inputCodeAndQuery(page, '600519');
      await sleep(2000);

      // 等待错误状态可见
      await page.getByTestId('error-state').waitFor({ state: 'visible', timeout: 10000 });

      const errors = await assertMarketServiceUnavailable(page);
      if (errors.length > 0) {
        console.error('  ❌ 截图2断言失败:');
        errors.forEach(e => console.error(`     - ${e}`));
        hasFailure = true;
      } else {
        await takeScreenshot(page, '02-ux-market-service-unavailable.png', 'BaoStock服务不可用');
        screenshotResults.push('02-ux-market-service-unavailable.png');
      }
    } catch (err) {
      console.error(`  ❌ 截图2失败：${err.message}`);
      hasFailure = true;
    }

    // ========== 截图3：普通用户入口 ==========
    console.log('\n--- 截图3：普通用户入口（无开发面板） ---');
    try {
      page = await browser.newPage();
      await navigateWithRetry(page, `http://localhost:${PORT}`);
      await sleep(2000);

      const errors = await assertRegularUserEntry(page);
      if (errors.length > 0) {
        console.error('  ❌ 截图3断言失败:');
        errors.forEach(e => console.error(`     - ${e}`));
        hasFailure = true;
      } else {
        await takeScreenshot(page, '03-ux-regular-user-entry.png', '普通用户入口');
        screenshotResults.push('03-ux-regular-user-entry.png');
      }
    } catch (err) {
      console.error(`  ❌ 截图3失败：${err.message}`);
      hasFailure = true;
    }

    // ========== 截图4：开发入口 ==========
    console.log('\n--- 截图4：开发入口（?dev=1 显示开发面板） ---');
    try {
      page = await browser.newPage();
      await navigateWithRetry(page, `http://localhost:${PORT}/?dev=1`);
      await sleep(2000);

      const errors = await assertDevEntry(page);
      if (errors.length > 0) {
        console.error('  ❌ 截图4断言失败:');
        errors.forEach(e => console.error(`     - ${e}`));
        hasFailure = true;
      } else {
        await takeScreenshot(page, '04-ux-dev-entry.png', '开发入口');
        screenshotResults.push('04-ux-dev-entry.png');
      }
    } catch (err) {
      console.error(`  ❌ 截图4失败：${err.message}`);
      hasFailure = true;
    }

    // ========== 截图5：移动端 ==========
    console.log('\n--- 截图5：移动端视图（603236 真实 K 线） ---');
    try {
      page = await browser.newPage();
      await page.setViewportSize({ width: 375, height: 812 });
      // 不 mock 任何 API，使用真实 BaoStock
      await navigateWithRetry(page, `http://localhost:${PORT}`);
      await sleep(2000);

      // 输入 603236 并选择
      await inputCodeAndSelect(page, '603236');
      await sleep(1000);

      // 设置日期范围并查询
      await setDatesAndQuery(page, QUERY_START_DATE, QUERY_END_DATE);

      // 等待结果标题可见
      await page.getByTestId('result-title').waitFor({ state: 'visible', timeout: 30000 });
      await sleep(2000);

      const errors = await assertMobile(page);
      if (errors.length > 0) {
        console.error('  ❌ 截图5断言失败:');
        errors.forEach(e => console.error(`     - ${e}`));
        hasFailure = true;
      } else {
        await takeScreenshot(page, '05-ux-mobile.png', '移动端视图');
        screenshotResults.push('05-ux-mobile.png');
      }
    } catch (err) {
      console.error(`  ❌ 截图5失败：${err.message}`);
      hasFailure = true;
    }

  } catch (err) {
    console.error(`\n💥 整体错误: ${err.message}`);
    hasFailure = true;
  } finally {
    if (server) {
      console.log('\n🛑 停止服务器...');
      server.kill('SIGTERM');
      try {
        await sleep(2000);
      } catch {}
    }
    if (browser) {
      await browser.close();
    }
  }

  // 提交截图
  commitScreenshots(!hasFailure);

  // 输出结果
  console.log('\n========================================');
  console.log('  截图结果汇总');
  console.log('========================================');
  if (screenshotResults.length > 0) {
    console.log(`✅ 成功: ${screenshotResults.length} 张`);
    screenshotResults.forEach(f => console.log(`   - ${f}`));
  }
  if (hasFailure) {
    console.log(`❌ 存在失败场景`);
  }

  if (hasFailure) {
    console.log('\n退出码: 1');
    process.exit(1);
  } else {
    console.log('\n退出码: 0');
    process.exit(0);
  }
}

run();
