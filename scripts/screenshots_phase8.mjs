// K-Ray 第八阶段截图脚本（全A股日K查询 MVP）
// 使用方法：node scripts/screenshots_phase8.mjs
//
// 严格规则：
// - 找不到按钮、目标状态或关键文案时立即 throw
// - 禁止 catch 后只打印警告继续保存截图
// - 每张截图保存前必须断言目标元素存在且可见
// - 单独使用 screenshots_phase8 目录
// - 截图来自实际 BaoStock 联调（环境变量 MARKET_DATA_MODE=real）
//
// 生成6张截图：
//   01-phase8-600519-success.png      600519查询成功
//   02-phase8-000001-success.png      000001查询成功
//   03-phase8-300750-success.png      300750查询成功
//   04-phase8-688981-success.png      688981查询成功
//   05-phase8-invalid-code-error.png  非法代码错误提示
//   06-phase8-empty-data.png          空数据提示

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const SCREENSHOTS_DIR = path.join(PROJECT_ROOT, '..', 'screenshots_phase8');
const DEV_PORT = 3004;
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

// 通过搜索框输入6位代码并按回车确认
async function inputStockCode(page, code) {
  console.log(`  输入股票代码: ${code}`);
  const input = page.getByPlaceholder(/输入.*6.*位.*股.*代码/);
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill(code);
  await sleep(500);
  // 按回车确认
  await input.press('Enter');
  await sleep(500);
  console.log(`  ✅ 已确认代码 ${code}`);
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

// 点击重新复盘回到初始状态
async function clickReset(page) {
  const btn = page.getByRole('button', { name: '重新复盘' });
  await btn.click();
  await sleep(500);
}

async function run() {
  console.log('========================================');
  console.log('  K-Ray 第八阶段截图（全A股日K查询 MVP）');
  console.log('  使用 BaoStock 真实联调（real 模式）');
  console.log('========================================');

  let server = null;
  let browser = null;
  let page = null;

  try {
    // 启动浏览器
    browser = await chromium.launch({ headless: true });
    console.log('✅ Playwright 浏览器启动成功');

    // 启动 real 模式服务器
    server = await startServer({
      MARKET_DATA_MODE: 'real',
      BAOSTOCK_PYTHON_PATH: path.join(PROJECT_ROOT, '.venv', 'bin', 'python3'),
    }, 'real模式');

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    page = await context.newPage();

    console.log(`\n📍 访问: ${DEV_URL}`);
    const response = await page.goto(DEV_URL, { waitUntil: 'networkidle', timeout: 30000 });
    if (!response.ok()) {
      throw new Error(`服务器返回状态码: ${response.status()}`);
    }
    await sleep(2000);

    // 断言真实行情开关默认开启
    const toggle = page.locator('[data-testid="real-market-toggle"]');
    await toggle.waitFor({ state: 'visible', timeout: 5000 });
    const isChecked = await toggle.isChecked();
    if (!isChecked) {
      throw new Error('真实行情开关应默认开启');
    }
    console.log('  ✅ 真实行情开关默认开启');

    // ========================================
    // 截图 1: 600519 查询成功
    // ========================================
    console.log('\n========================================');
    console.log('  截图 1: 600519 贵州茅台 查询成功');
    console.log('========================================');
    await inputStockCode(page, '600519');
    await setDateRange(page, '2024-01-02', '2024-03-29');
    await startReplayAndWait(page);

    // 断言数据来源信息栏
    await assertVisible(page, '[data-testid="data-source-info"]', '数据来源信息栏');
    const dataSourceInfo = page.locator('[data-testid="data-source-info"]');
    const infoText = await dataSourceInfo.textContent();
    if (!infoText.includes('600519.SH')) throw new Error('数据来源信息栏未显示 600519.SH');
    if (!infoText.includes('BaoStock')) throw new Error('数据来源信息栏未显示 BaoStock');
    if (!infoText.includes('日线')) throw new Error('数据来源信息栏未显示 日线');
    if (!infoText.includes('前复权')) throw new Error('数据来源信息栏未显示 前复权');
    if (!infoText.includes('不代表投资建议')) throw new Error('数据来源信息栏未显示免责声明');
    console.log('  ✅ 数据来源信息栏内容完整');

    // 断言K线图表已渲染
    await assertVisible(page, '[data-testid="chart-container"]', 'K线图表容器');
    // 断言真实行情文案
    await assertText(page, '当前K线为BaoStock真实历史行情（前复权日线）。', '真实行情文案');

    await takeScreenshot(page, '01-phase8-600519-success.png', '600519查询成功');

    await clickReset(page);

    // ========================================
    // 截图 2: 000001 查询成功
    // ========================================
    console.log('\n========================================');
    console.log('  截图 2: 000001 平安银行 查询成功');
    console.log('========================================');
    await inputStockCode(page, '000001');
    await setDateRange(page, '2024-01-02', '2024-03-29');
    await startReplayAndWait(page);

    await assertVisible(page, '[data-testid="data-source-info"]', '数据来源信息栏');
    await assertVisible(page, '[data-testid="chart-container"]', 'K线图表容器');
    await assertText(page, '当前K线为BaoStock真实历史行情（前复权日线）。', '真实行情文案');

    await takeScreenshot(page, '02-phase8-000001-success.png', '000001查询成功');

    await clickReset(page);

    // ========================================
    // 截图 3: 300750 查询成功
    // ========================================
    console.log('\n========================================');
    console.log('  截图 3: 300750 宁德时代 查询成功');
    console.log('========================================');
    await inputStockCode(page, '300750');
    await setDateRange(page, '2024-01-02', '2024-03-29');
    await startReplayAndWait(page);

    await assertVisible(page, '[data-testid="data-source-info"]', '数据来源信息栏');
    await assertVisible(page, '[data-testid="chart-container"]', 'K线图表容器');
    await assertText(page, '当前K线为BaoStock真实历史行情（前复权日线）。', '真实行情文案');

    await takeScreenshot(page, '03-phase8-300750-success.png', '300750查询成功');

    await clickReset(page);

    // ========================================
    // 截图 4: 688981 查询成功
    // ========================================
    console.log('\n========================================');
    console.log('  截图 4: 688981 中芯国际 查询成功');
    console.log('========================================');
    await inputStockCode(page, '688981');
    await setDateRange(page, '2024-01-02', '2024-03-29');
    await startReplayAndWait(page);

    await assertVisible(page, '[data-testid="data-source-info"]', '数据来源信息栏');
    await assertVisible(page, '[data-testid="chart-container"]', 'K线图表容器');
    await assertText(page, '当前K线为BaoStock真实历史行情（前复权日线）。', '真实行情文案');

    await takeScreenshot(page, '04-phase8-688981-success.png', '688981查询成功');

    await clickReset(page);

    // ========================================
    // 截图 5: 非法代码错误提示
    // ========================================
    console.log('\n========================================');
    console.log('  截图 5: 非法代码错误提示');
    console.log('========================================');
    // 输入无法识别的6位代码（B股代码 200000）
    const input = page.getByPlaceholder(/输入.*6.*位.*股.*代码/);
    await input.waitFor({ state: 'visible', timeout: 5000 });
    await input.fill('200000');
    await sleep(800); // 等待错误提示出现

    // 断言错误提示显示
    await assertText(page, /无法识别代码 200000 的市场/, '无法识别市场提示');

    await takeScreenshot(page, '05-phase8-invalid-code-error.png', '非法代码错误提示');

    // 清除输入
    await input.fill('');
    await sleep(300);

    // ========================================
    // 截图 6: 空数据提示
    // ========================================
    console.log('\n========================================');
    console.log('  截图 6: 空数据提示');
    console.log('========================================');
    // 查询一个有数据股票的未来日期区间
    await inputStockCode(page, '600519');
    // 设置未来日期（BaoStock无数据）
    await setDateRange(page, '2030-01-01', '2030-03-01');

    // 点击开始复盘，等待空状态
    const btn = page.getByRole('button', { name: '开始复盘' });
    await btn.click();
    await page.getByText(/未找到该区间的K线数据/).first().waitFor({ state: 'visible', timeout: 30000 });
    await sleep(1500);

    await assertText(page, '未找到该区间的K线数据', '空数据提示');

    await takeScreenshot(page, '06-phase8-empty-data.png', '空数据提示');

    await context.close();

    console.log('\n========================================');
    console.log('  ✅ 第八阶段截图全部完成！');
    console.log('========================================');
    console.log(`截图保存目录: ${SCREENSHOTS_DIR}`);
    const files = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png'));
    files.forEach(f => {
      const stat = fs.statSync(path.join(SCREENSHOTS_DIR, f));
      console.log(`  📸 ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
    });

  } catch (err) {
    console.error('\n❌ 截图脚本失败:', err.message);
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close();
    }
    if (server) {
      server.kill();
      await sleep(3000);
      console.log('\n服务器已关闭');
    }
  }
}

run();
