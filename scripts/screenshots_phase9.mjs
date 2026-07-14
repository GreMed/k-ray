// K-Ray 第九阶段截图脚本（关键股价节点识别与复盘入口）
// 使用方法：node scripts/screenshots_phase9.mjs
//
// 严格规则：
// - 真实行情截图必须同时满足：
//   1. marketMeta.isRealMarketData === true
//   2. 数据来源显示 BaoStock
//   3. 页面不存在 dev-sample-banner
//   4. 图表可见
//   5. 关键股价节点列表可见
//   6. 事件数为 0
// - 任一条件不满足时，脚本必须失败并设置非零退出码
// - 不得自动加载开发样本代替真实行情截图
// - 不得覆盖已有真实截图
// - 开发样本截图只能使用 dev-sample 文件名
// - 如果 BaoStock 暂时不可用，交付报告必须诚实写"真实截图未完成"
// - 两张真实截图（01/02）必须成套生成：先写临时文件，两张都通过断言后才一起移动为最终文件
// - 任一截图失败：删除本轮临时文件，最终目录不留下半套真实截图，退出码为 1
// - 如果最终 01/02 已存在，启动前明确失败并保护旧证据
// - 只有 01 和 02 都成功且来自同一次 BaoStock 页面查询，脚本才能退出 0
//
// 生成截图：
//   01-phase9-real-market-with-nodes.png    真实行情查询后：真实 K 线 + 关键股价节点 + 无事件列表
//   02-phase9-node-detail-volume.png         真实行情节点详情：含成交量变化与风险提示
//   03-phase9-dev-sample-with-nodes.png      开发验收有节点样本
//   04-phase9-dev-sample-empty.png           开发验收空状态样本
//   05-phase9-dev-sample-mobile.png          移动端节点列表与详情

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn, execFileSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const SCREENSHOTS_DIR = path.join(PROJECT_ROOT, '..', 'screenshots_phase9');
const TEMP_DIR = path.join(SCREENSHOTS_DIR, '.tmp');
const DEV_PORT = 3005;
const DEV_URL = `http://localhost:${DEV_PORT}`;

// 解析 BaoStock Python 路径：
// 1. 优先使用环境变量 BAOSTOCK_PYTHON_PATH
// 2. 否则使用项目相对路径 .venv/bin/python
function resolvePythonPath() {
  if (process.env.BAOSTOCK_PYTHON_PATH) {
    return process.env.BAOSTOCK_PYTHON_PATH;
  }
  return path.join(PROJECT_ROOT, '.venv', 'bin', 'python');
}

// 预检：Python 文件存在 + import baostock 成功
function preflightPython(pythonPath) {
  console.log('\n🔍 Python 环境预检...');

  // 检查 1：Python 文件存在
  if (!fs.existsSync(pythonPath)) {
    console.error(`  ❌ 预检失败：Python 文件不存在: ${pythonPath}`);
    console.error('     请创建虚拟环境并安装 BaoStock，或设置 BAOSTOCK_PYTHON_PATH 环境变量');
    return false;
  }
  console.log(`  ✅ Python 文件存在: ${pythonPath}`);

  // 检查 2：import baostock 成功
  try {
    execFileSync(pythonPath, ['-c', 'import baostock'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10000,
    });
    console.log('  ✅ BaoStock 模块导入成功');
  } catch (err) {
    console.error(`  ❌ 预检失败：无法导入 BaoStock 模块`);
    console.error(`     Python 路径: ${pythonPath}`);
    console.error(`     错误: ${err.message}`);
    console.error('     请在虚拟环境中运行: pip install baostock');
    return false;
  }

  console.log('  ✅ Python 环境预检通过\n');
  return true;
}

// 确保目录存在
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
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

// 截图到临时文件（不直接写入最终路径）
async function takeTempScreenshot(page, tempFilename, description) {
  const tempPath = path.join(TEMP_DIR, tempFilename);
  await page.screenshot({ path: tempPath, fullPage: true });
  if (!fs.existsSync(tempPath)) {
    throw new Error(`截图失败：临时文件未生成 ${tempPath}`);
  }
  const stat = fs.statSync(tempPath);
  if (stat.size < 1000) {
    throw new Error(`截图异常：文件过小 (${stat.size} bytes) ${tempPath}`);
  }
  console.log(`  📸 ${description}: ${tempFilename} (${(stat.size / 1024).toFixed(1)} KB) [临时]`);
  return tempPath;
}

// 将临时文件移动为最终文件
function moveTempToFinal(tempPath, finalFilename) {
  const finalPath = path.join(SCREENSHOTS_DIR, finalFilename);
  // 保护已有真实截图
  if (fs.existsSync(finalPath)) {
    throw new Error(`不得覆盖已有真实截图：${finalFilename} 已存在`);
  }
  fs.renameSync(tempPath, finalPath);
  if (!fs.existsSync(finalPath)) {
    throw new Error(`移动失败：最终文件未生成 ${finalPath}`);
  }
  const stat = fs.statSync(finalPath);
  console.log(`  ✅ 已移动为最终文件: ${finalFilename} (${(stat.size / 1024).toFixed(1)} KB)`);
  return finalPath;
}

// 清理临时文件
function cleanupTempFiles() {
  if (fs.existsSync(TEMP_DIR)) {
    const files = fs.readdirSync(TEMP_DIR);
    for (const f of files) {
      fs.unlinkSync(path.join(TEMP_DIR, f));
    }
    console.log(`  🧹 已清理 ${files.length} 个临时文件`);
  }
}

// 截图到开发样本最终文件（03/04/05 可直接覆盖）
async function takeDevScreenshot(page, filename, description) {
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

// 通过搜索框输入6位代码
async function inputStockCode(page, code) {
  console.log(`  输入股票代码: ${code}`);
  const input = page.getByPlaceholder(/输入.*6.*位.*股.*代码/);
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill(code);
  await sleep(500);
  await input.press('Enter');
  await sleep(500);
  console.log(`  ✅ 已确认代码 ${code}`);
}

// 验证真实行情截图的所有条件
async function verifyRealMarketConditions(page) {
  console.log('  开始验证真实行情截图条件...');

  // 条件1：页面不存在 dev-sample-banner
  const devBannerCount = await page.locator('[data-testid="dev-sample-banner"]').count();
  if (devBannerCount > 0) {
    throw new Error('真实行情截图条件不满足：页面存在 dev-sample-banner（开发样本标注）');
  }
  console.log('  ✅ 条件1：页面不存在 dev-sample-banner');

  // 条件2：图表可见
  await assertVisible(page, '[data-testid="chart-wrapper"]', '条件2：K线图表');
  await assertVisible(page, '[data-testid="chart-container"]', '条件2：图表容器');

  // 条件3：数据来源显示 BaoStock
  const dataLabel = await page.locator('[data-testid="chart-data-label"]').first().textContent();
  if (!dataLabel || !dataLabel.includes('BaoStock')) {
    throw new Error(`真实行情截图条件不满足：数据来源未显示 BaoStock，实际显示："${dataLabel}"`);
  }
  console.log('  ✅ 条件3：数据来源显示 BaoStock');

  // 条件4：真实行情 banner 存在
  const realBannerCount = await page.locator('[data-testid="real-market-banner"]').count();
  if (realBannerCount === 0) {
    throw new Error('真实行情截图条件不满足：不存在 real-market-banner');
  }
  console.log('  ✅ 条件4：真实行情 banner 存在');

  // 条件5：关键股价节点列表可见
  await assertVisible(page, '[data-testid="key-node-list"]', '条件5：关键股价节点列表');

  // 条件5b：key-node-items 存在且节点项数量大于 0
  const keyNodeItemsCount = await page.locator('[data-testid="key-node-items"]').count();
  if (keyNodeItemsCount === 0) {
    throw new Error('真实行情截图条件不满足：key-node-items 不存在');
  }
  const keyNodeItemCount = await page.locator('[data-testid="key-node-items"] > *').count();
  if (keyNodeItemCount === 0) {
    throw new Error('真实行情截图条件不满足：key-node-items 内节点项数量为 0');
  }
  console.log(`  ✅ 条件5b：key-node-items 存在，节点项数量 ${keyNodeItemCount} > 0`);

  // 条件6：事件数为 0（从 chart-stats 解析）
  const statsText = await page.locator('[data-testid="chart-stats"]').first().textContent();
  const eventMatch = statsText?.match(/事件\s*(\d+)\s*条/);
  if (!eventMatch) {
    throw new Error(`真实行情截图条件不满足：无法解析事件数，stats="${statsText}"`);
  }
  const eventCount = parseInt(eventMatch[1], 10);
  if (eventCount !== 0) {
    throw new Error(`真实行情截图条件不满足：事件数为 ${eventCount}，应为 0`);
  }
  console.log('  ✅ 条件6：事件数为 0');

  // 条件7：真实模式下不渲染旧功能区域
  const legacyEventListCount = await page.locator('[data-testid="legacy-event-list"]').count();
  if (legacyEventListCount > 0) {
    throw new Error('真实行情截图条件不满足：存在 legacy-event-list');
  }
  const eventLegendCount = await page.locator('[data-testid="event-legend"]').count();
  if (eventLegendCount > 0) {
    throw new Error('真实行情截图条件不满足：存在 event-legend');
  }
  const legacyKeyNodeOverviewCount = await page.locator('[data-testid="legacy-key-node-overview"]').count();
  if (legacyKeyNodeOverviewCount > 0) {
    throw new Error('真实行情截图条件不满足：存在 legacy-key-node-overview');
  }
  const futureCalCount = await page.locator('[data-testid="future-event-calendar-wrapper"]').count();
  if (futureCalCount > 0) {
    throw new Error('真实行情截图条件不满足：存在 future-event-calendar-wrapper');
  }
  console.log('  ✅ 条件7：真实模式下不渲染旧功能区域（含 legacy-key-node-overview）');

  console.log('  ✅ 所有真实行情截图条件满足');
}

async function run() {
  console.log('========================================');
  console.log('  K-Ray 第九阶段截图（关键股价节点识别）');
  console.log('========================================');

  // === Python 环境预检 ===
  const pythonPath = resolvePythonPath();
  if (!preflightPython(pythonPath)) {
    console.error('\n❌ Python 环境预检失败，脚本终止');
    process.exitCode = 1;
    return;
  }

  // === 检查最终 01/02 是否已存在（保护旧证据） ===
  const final01Path = path.join(SCREENSHOTS_DIR, '01-phase9-real-market-with-nodes.png');
  const final02Path = path.join(SCREENSHOTS_DIR, '02-phase9-node-detail-volume.png');
  if (fs.existsSync(final01Path) && fs.existsSync(final02Path)) {
    console.error('\n❌ 真实截图 01 和 02 均已存在，拒绝覆盖旧证据');
    console.error(`   ${final01Path}`);
    console.error(`   ${final02Path}`);
    console.error('   如需重新生成，请先手动删除这两个文件');
    process.exitCode = 1;
    return;
  }

  let server = null;
  let browser = null;
  let page = null;
  // 分别维护总览和详情截图的完成状态
  let realOverviewCompleted = false;
  let realDetailCompleted = false;
  let realOverviewError = null;
  let realDetailError = null;
  // 临时文件路径
  let tempOverviewPath = null;
  let tempDetailPath = null;

  try {
    // 启动浏览器
    // 注意：系统可能配置了 http_proxy，Chromium 会继承系统代理设置
    // 导致 localhost API 请求被代理拦截返回 503
    // 使用 --no-proxy-server 禁用代理，确保 localhost 请求直达
    browser = await chromium.launch({
      headless: true,
      args: ['--no-proxy-server'],
    });
    console.log('✅ Playwright 浏览器启动成功（已禁用代理）');

    // 启动真实模式服务器，传入 BAOSTOCK_PYTHON_PATH
    // 同时设置 NO_PROXY 确保 BaoStock Python 子进程不经过系统代理
    server = await startServer({
      MARKET_DATA_MODE: 'real',
      BAOSTOCK_PYTHON_PATH: pythonPath,
      NO_PROXY: 'localhost,127.0.0.1',
      no_proxy: 'localhost,127.0.0.1',
    }, '真实行情');

    page = await browser.newPage();
    await page.goto(DEV_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    console.log('✅ 页面加载完成');

    // ========== 截图1：真实行情查询后展示关键节点（总览） ==========
    console.log('\n--- 截图1：真实行情查询后展示关键节点（总览） ---');
    try {
      await inputStockCode(page, '600519');
      await sleep(500);

      // 设置日期范围为近3个月
      const today = new Date();
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const startStr = threeMonthsAgo.toISOString().slice(0, 10);
      const endStr = today.toISOString().slice(0, 10);

      const startInput = page.locator('input[type="date"]').first();
      const endInput = page.locator('input[type="date"]').last();
      await startInput.fill(startStr);
      await endInput.fill(endStr);
      await sleep(300);

      // 点击查询日K
      const queryBtn = page.getByRole('button', { name: /查询日K|开始复盘/ });
      await queryBtn.waitFor({ state: 'visible', timeout: 5000 });
      await queryBtn.click();
      console.log('  ✅ 已点击查询按钮');

      // 等待图表渲染（BaoStock 可能需要时间）
      await sleep(5000);

      // 检查是否出现错误状态或空状态
      const errorCount = await page.getByText('行情查询失败').count();
      const emptyCount = await page.getByText('未找到该区间的K线数据').count();

      if (errorCount > 0 || emptyCount > 0) {
        const errorMsg = errorCount > 0 ? '行情查询失败' : '未找到该区间的K线数据';
        throw new Error(`BaoStock 真实行情查询失败：${errorMsg}，真实截图未完成`);
      }

      // 等待图表可见
      await page.locator('[data-testid="chart-wrapper"]').first().waitFor({ state: 'visible', timeout: 30000 });
      await sleep(3000);

      // 验证所有真实行情截图条件
      await verifyRealMarketConditions(page);

      // 截图到临时文件（不直接写入最终路径）
      tempOverviewPath = await takeTempScreenshot(page, '01-overview.tmp.png', '真实行情+关键节点+无事件');
      realOverviewCompleted = true;
      console.log('  ✅ 真实行情总览临时截图完成');

      // ========== 截图2：真实行情节点详情（临时文件，必须来自同一次 BaoStock 查询） ==========
      console.log('\n--- 截图2：节点详情含成交量变化（真实行情） ---');

      // 真实详情截图必须使用当前页面的真实行情节点，不得切换到开发样本
      const nodeItemsCount = await page.locator('[data-testid="key-node-items"] > *').count();
      if (nodeItemsCount === 0) {
        throw new Error('真实行情查询结果无关键节点，无法完成真实详情截图');
      }

      const firstItem = page.locator('[data-testid="key-node-items"] > *').first();
      await firstItem.click();
      await sleep(500);

      await assertVisible(page, '[data-testid="market-node-drawer"]', '节点详情抽屉');
      await assertVisible(page, '[data-testid="market-node-volume-change"]', '成交量变化');
      await assertVisible(page, '[data-testid="market-node-risk-warning"]', '风险提示');

      tempDetailPath = await takeTempScreenshot(page, '02-detail.tmp.png', '真实行情节点详情含成交量变化');
      realDetailCompleted = true;
      console.log('  ✅ 真实行情详情临时截图完成');

      // 关闭抽屉
      const closeBtn = page.getByTestId('market-node-drawer-close');
      await closeBtn.click();
      await sleep(500);

    } catch (err) {
      if (!realOverviewCompleted) {
        realOverviewError = err.message;
      } else {
        realDetailError = err.message;
      }
      console.error(`  ❌ 真实行情截图失败：${err.message}`);
    }

    // ========== 真实截图成套提交 ==========
    if (realOverviewCompleted && realDetailCompleted) {
      console.log('\n--- 真实截图成套提交：移动临时文件为最终文件 ---');
      try {
        moveTempToFinal(tempOverviewPath, '01-phase9-real-market-with-nodes.png');
        moveTempToFinal(tempDetailPath, '02-phase9-node-detail-volume.png');
        console.log('  ✅ 01 和 02 真实截图均已提交');
      } catch (moveErr) {
        console.error(`  ❌ 真实截图提交失败：${moveErr.message}`);
        realOverviewCompleted = false;
        realDetailCompleted = false;
        realOverviewError = `移动失败: ${moveErr.message}`;
        cleanupTempFiles();
      }
    } else {
      // 任一失败：清理临时文件，不留下半套真实截图
      console.log('\n--- 真实截图未成套完成，清理临时文件 ---');
      cleanupTempFiles();
    }

    // ========== 截图3：开发验收有节点样本 ==========
    console.log('\n--- 截图3：开发验收有节点样本 ---');
    // 先重置到初始状态
    const resetBtn = page.getByRole('button', { name: /重新查询|重新复盘|返回/ });
    if (await resetBtn.first().isVisible().catch(() => false)) {
      await resetBtn.first().click();
      await sleep(1000);
    }

    const withNodesBtn = page.getByTestId('dev-key-node-sample-with-nodes');
    await withNodesBtn.click();
    await sleep(1500);

    await assertVisible(page, '[data-testid="chart-wrapper"]', '开发样本K线图');
    await assertVisible(page, '[data-testid="key-node-list"]', '开发样本关键节点列表');
    await assertVisible(page, '[data-testid="key-node-items"]', '开发样本节点项');
    await assertVisible(page, '[data-testid="dev-sample-banner"]', '开发验收样本标注');

    await takeDevScreenshot(page, '03-phase9-dev-sample-with-nodes.png', '开发验收有节点样本');

    // ========== 截图4：开发验收空状态样本 ==========
    console.log('\n--- 截图4：开发验收空状态样本 ---');
    const noNodesBtn = page.getByTestId('dev-key-node-sample-no-nodes');
    await noNodesBtn.click();
    await sleep(1500);

    await assertVisible(page, '[data-testid="key-node-empty"]', '空状态提示');

    await takeDevScreenshot(page, '04-phase9-dev-sample-empty.png', '开发验收空状态样本');

    // ========== 截图5：移动端节点列表 ==========
    console.log('\n--- 截图5：移动端节点列表 ---');
    const withNodesBtn2 = page.getByTestId('dev-key-node-sample-with-nodes');
    await withNodesBtn2.click();
    await sleep(1500);

    await page.setViewportSize({ width: 375, height: 812 });
    await sleep(500);

    await assertVisible(page, '[data-testid="key-node-list"]', '移动端关键节点列表');

    const mobileFirstItem = page.locator('[data-testid="key-node-items"] > *').first();
    await mobileFirstItem.click();
    await sleep(500);

    await assertVisible(page, '[data-testid="market-node-drawer"]', '移动端节点详情抽屉');

    await takeDevScreenshot(page, '05-phase9-dev-sample-mobile.png', '移动端节点列表与详情');

    // ========== 最终报告 ==========
    console.log('\n========================================');
    console.log('  截图脚本执行完成');
    console.log('========================================');

    const bothCompleted = realOverviewCompleted && realDetailCompleted;

    if (bothCompleted) {
      console.log('  ✅ 真实行情总览截图：已完成（来自 BaoStock 真实数据）');
      console.log('  ✅ 真实行情详情截图：已完成（来自 BaoStock 真实数据）');
    } else {
      console.log('  ❌ 真实行情截图：未完成');
      if (!realOverviewCompleted) {
        console.log(`     总览截图失败：${realOverviewError || '未知原因'}`);
      }
      if (!realDetailCompleted) {
        console.log(`     详情截图失败：${realDetailError || '未知原因'}`);
      }
      console.log('     开发样本截图已完成，但不能代替真实行情截图');
    }

    console.log(`\n截图保存目录: ${SCREENSHOTS_DIR}`);
    const files = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png'));
    files.forEach(f => {
      const stat = fs.statSync(path.join(SCREENSHOTS_DIR, f));
      console.log(`  📸 ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
    });

    // 只有两者都完成才退出 0
    if (!bothCompleted) {
      console.log('\n❌ 真实行情截图未完成（总览或详情缺失），脚本以非零退出码结束');
      process.exitCode = 1;
    }

  } catch (err) {
    console.error('\n❌ 截图脚本失败:', err.message);
    // 清理临时文件
    cleanupTempFiles();
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close();
    }
    if (server) {
      server.kill('SIGTERM');
      await sleep(2000);
    }
  }
}

run();
