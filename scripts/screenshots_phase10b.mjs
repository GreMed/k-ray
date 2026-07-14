// K-Ray 第十阶段 B 截图脚本（关键节点—事件候选关联体验）
//
// 生成截图：
//   01-phase10b-mock-candidates.png       Mock 模式候选（verified/unverified/多股汇总）
//   02-phase10b-empty-candidates.png      无候选空状态
//   03-phase10b-request-error.png         请求失败状态
//   04-phase10b-fallback.png              Fallback 降级状态
//   05-phase10b-mobile.png                移动端 Mock 候选
//   06-phase10b-real-empty.png            真实行情+关键节点+真实新闻空状态（真实联调无候选时）
//   07-phase10b-real-candidates.png       真实行情+关键节点+真实新闻候选（真实联调有候选时）
//
// 截图保护策略：
//   - 所有截图先输出到临时目录 screenshots_phase10b/.tmp
//   - 全部场景断言成功后，才将临时目录内容整体替换到正式目录
//   - 真实联调失败时，保留上一轮已存在的有效真实截图
//
// 真实联调等待策略：
//   - 打开真实节点抽屉后，不固定等待几秒
//   - 最多等待 30 秒，明确等待三种最终状态之一：
//     1. node-event-empty（真实空状态）
//     2. node-event-candidate-list（真实候选列表）
//     3. node-event-error（真实请求失败）
//   - 出现空状态 → assertRealEmptyScreenshot → 06-phase10b-real-empty.png
//   - 出现候选列表 → assertRealCandidatesScreenshot → 07-phase10b-real-candidates.png
//   - 出现错误状态 → 输出错误内容，非零退出码
//   - 30 秒后仍 loading → 输出"真实新闻候选请求超时"，非零退出码
//   - 不得通过扩大窗口、改写节点日期、注入 Mock 或放宽相关性规则来规避问题
//
// 断言规则：
//   - Mock 截图：模式徽标 Mock、候选列表可见、verified/unverified/多股汇总均存在
//   - 空状态截图：空状态提示可见、候选列表不存在
//   - 错误截图：错误提示可见、包含"检索失败"
//   - Fallback 截图：降级说明可见、模式徽标 Fallback
//   - 移动端截图：抽屉可见、无横向溢出
//   - 真实空状态截图：Real 徽标、空状态可见、候选列表不存在
//   - 真实候选截图（仅当有候选时）：Real 徽标、候选列表存在、至少一条 isRealEventCandidate=true、无 fallbackReason

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn, execFileSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const SCREENSHOTS_DIR = path.join(PROJECT_ROOT, '..', 'screenshots_phase10b');
// 临时目录：所有截图先输出到这里，全部断言通过后才整体替换到正式目录
const TMP_DIR = path.join(SCREENSHOTS_DIR, '.tmp');
const MOCK_PORT = 3010;
const FALLBACK_PORT = 3011;
const REAL_PORT = 3012;

// 真实联调等待最终状态的超时时间（毫秒）
const REAL_FINAL_STATE_TIMEOUT = 30000;
// 轮询间隔（毫秒）
const POLL_INTERVAL = 500;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 解析 Python 路径
function resolvePythonPath() {
  if (process.env.AKSHARE_PYTHON_PATH && fs.existsSync(process.env.AKSHARE_PYTHON_PATH)) {
    return process.env.AKSHARE_PYTHON_PATH;
  }
  const venvPython = path.join(PROJECT_ROOT, '.venv', 'bin', 'python');
  if (fs.existsSync(venvPython)) {
    return venvPython;
  }
  return 'python3';
}

// 预检：检查 AKShare 模块
function preflightAkshare(pythonPath) {
  console.log('\n🔍 AKShare 环境预检...');
  try {
    execFileSync(pythonPath, ['-c', 'import akshare'], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 });
    console.log('  ✅ AKShare 模块导入成功');
    return true;
  } catch {
    console.error('  ⚠️ AKShare 模块不可用，真实新闻候选截图将跳过');
    return false;
  }
}

// 预检：检查 BaoStock 模块
function preflightBaostock(pythonPath) {
  console.log('🔍 BaoStock 环境预检...');
  try {
    execFileSync(pythonPath, ['-c', 'import baostock'], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 });
    console.log('  ✅ BaoStock 模块导入成功');
    return true;
  } catch {
    console.error('  ⚠️ BaoStock 模块不可用，真实行情截图将跳过');
    return false;
  }
}

function startServer(env, port, name) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 启动${name}服务器（端口 ${port}）...`);
    const server = spawn('npm', ['run', 'dev', '--', '-p', String(port)], {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    });

    let resolved = false;
    let output = '';

    server.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      if (text.includes(`:${port}`) || text.includes('Ready') || text.includes('ready')) {
        if (!resolved) {
          resolved = true;
          setTimeout(() => resolve(server), 3000);
        }
      }
    });

    server.stderr.on('data', (data) => { output += data.toString(); });

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

// 截图输出到临时目录
async function takeScreenshot(page, filename, description) {
  const filePath = path.join(TMP_DIR, filename);
  await page.screenshot({ path: filePath, fullPage: true });
  const stat = fs.statSync(filePath);
  console.log(`  📸 ${description}: ${filename} (${(stat.size / 1024).toFixed(1)} KB)`);
  return filePath;
}

// 加载开发验收样本并点击第一个关键节点打开抽屉
async function loadDevSampleAndOpenDrawer(page, port) {
  await page.goto(`http://localhost:${port}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2000);

  // 点击开发验收样本按钮
  const sampleBtn = page.getByTestId('dev-key-node-sample-with-nodes');
  await sampleBtn.click();
  await sleep(1500);

  // 等待关键节点列表可见
  await page.getByTestId('key-node-list').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('key-node-items').waitFor({ state: 'visible', timeout: 10000 });

  // 点击第一个关键节点
  const firstItem = page.locator('[data-testid="key-node-items"] > *').first();
  await firstItem.click();
  await sleep(500);

  // 等待抽屉可见
  await page.getByTestId('node-event-drawer').waitFor({ state: 'visible', timeout: 10000 });
}

// 断言 Mock 候选截图
async function assertMockScreenshot(page) {
  const errors = [];

  // 模式徽标应为 Mock 演示
  const modeBadge = page.getByTestId('node-event-mode-badge');
  const badgeText = await modeBadge.textContent();
  if (!badgeText || !badgeText.includes('Mock')) {
    errors.push(`模式徽标应为 Mock 演示，实际为: ${badgeText}`);
  }

  // 候选列表应可见
  const candidateList = page.getByTestId('node-event-candidate-list');
  const listVisible = await candidateList.isVisible().catch(() => false);
  if (!listVisible) {
    errors.push('Mock 截图必须存在候选列表');
    return errors;
  }

  // 验证 verified/unverified/多股汇总 均存在
  const candidateCount = await candidateList.evaluate(el => el.children.length).catch(() => 0);
  let hasVerified = false;
  let hasUnverified = false;
  let hasMultiStock = false;

  for (let i = 0; i < candidateCount; i++) {
    const relevanceBadge = page.getByTestId(`node-event-candidate-relevance-${i}`);
    const text = await relevanceBadge.textContent().catch(() => '');
    if (text && text.includes('已验证相关')) hasVerified = true;
    if (text && text.includes('待人工确认')) hasUnverified = true;

    const multiStockBadge = page.getByTestId(`node-event-candidate-multi-stock-${i}`);
    const multiVisible = await multiStockBadge.isVisible().catch(() => false);
    if (multiVisible) hasMultiStock = true;
  }

  if (!hasVerified) errors.push('Mock 截图必须存在 verified 候选');
  if (!hasUnverified) errors.push('Mock 截图必须存在 unverified 候选');
  if (!hasMultiStock) errors.push('Mock 截图必须存在多股汇总候选');

  // 阅读提示应可见
  const readingTip = page.getByTestId('node-event-reading-tip');
  const tipVisible = await readingTip.isVisible().catch(() => false);
  if (!tipVisible) {
    errors.push('Mock 截图必须存在阅读提示');
  }

  return errors;
}

// 断言空状态截图
async function assertEmptyScreenshot(page) {
  const errors = [];

  const emptyState = page.getByTestId('node-event-empty');
  const emptyVisible = await emptyState.isVisible().catch(() => false);
  if (!emptyVisible) {
    errors.push('空状态截图必须显示空状态提示');
  }

  const emptyText = await emptyState.textContent().catch(() => '');
  if (!emptyText || !emptyText.includes('暂无可核验的事件候选')) {
    errors.push('空状态截图必须包含"暂无可核验的事件候选"');
  }

  // 候选列表不应存在
  const candidateList = page.getByTestId('node-event-candidate-list');
  const listVisible = await candidateList.isVisible().catch(() => false);
  if (listVisible) {
    errors.push('空状态截图不应显示候选列表');
  }

  return errors;
}

// 断言错误截图
async function assertErrorScreenshot(page) {
  const errors = [];

  const errorState = page.getByTestId('node-event-error');
  const errorVisible = await errorState.isVisible().catch(() => false);
  if (!errorVisible) {
    errors.push('错误截图必须显示错误状态');
  }

  const errorText = await errorState.textContent().catch(() => '');
  if (!errorText || !errorText.includes('检索失败')) {
    errors.push('错误截图必须包含"检索失败"');
  }

  return errors;
}

// 断言 Fallback 截图
async function assertFallbackScreenshot(page) {
  const errors = [];

  const modeBadge = page.getByTestId('node-event-mode-badge');
  const badgeText = await modeBadge.textContent();
  if (!badgeText || !badgeText.includes('Fallback')) {
    errors.push(`模式徽标应为 Fallback 降级，实际为: ${badgeText}`);
  }

  const fallbackReason = page.getByTestId('node-event-fallback-reason');
  const reasonVisible = await fallbackReason.isVisible().catch(() => false);
  if (!reasonVisible) {
    errors.push('Fallback 截图必须显示降级说明');
  }

  return errors;
}

// 断言移动端截图
async function assertMobileScreenshot(page) {
  const errors = [];

  const drawer = page.getByTestId('node-event-drawer');
  const drawerVisible = await drawer.isVisible().catch(() => false);
  if (!drawerVisible) {
    errors.push('移动端截图必须显示抽屉');
  }

  // 检查横向溢出
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
  });
  if (hasOverflow) {
    errors.push('移动端截图存在横向溢出');
  }

  return errors;
}

// 断言真实空状态截图：Real 徽标、空状态可见、候选列表不存在
async function assertRealEmptyScreenshot(page) {
  const errors = [];

  // 抽屉应可见
  const drawer = page.getByTestId('node-event-drawer');
  const drawerVisible = await drawer.isVisible().catch(() => false);
  if (!drawerVisible) {
    errors.push('真实空状态截图必须显示抽屉');
    return errors;
  }

  // 模式徽标应为 Real 真实
  const modeBadge = page.getByTestId('node-event-mode-badge');
  const badgeText = await modeBadge.textContent();
  if (!badgeText || !badgeText.includes('Real')) {
    errors.push(`真实空状态截图模式徽标应为 Real 真实，实际为: ${badgeText}`);
  }

  // 空状态应可见
  const emptyState = page.getByTestId('node-event-empty');
  const emptyVisible = await emptyState.isVisible().catch(() => false);
  if (!emptyVisible) {
    errors.push('真实空状态截图必须显示空状态提示');
  }

  // 候选列表不应存在
  const candidateList = page.getByTestId('node-event-candidate-list');
  const listVisible = await candidateList.isVisible().catch(() => false);
  if (listVisible) {
    errors.push('真实空状态截图不应显示候选列表');
  }

  // 节点信息区应可见
  const infoSection = page.getByTestId('node-event-section-info');
  const infoVisible = await infoSection.isVisible().catch(() => false);
  if (!infoVisible) {
    errors.push('真实空状态截图必须显示节点信息区');
  }

  // 阅读提示应可见
  const readingTip = page.getByTestId('node-event-reading-tip');
  const tipVisible = await readingTip.isVisible().catch(() => false);
  if (!tipVisible) {
    errors.push('真实空状态截图必须显示阅读提示');
  }

  return errors;
}

// 断言真实候选截图：Real 徽标、候选列表存在、至少一条 isRealEventCandidate=true、无 fallbackReason
async function assertRealCandidatesScreenshot(page) {
  const errors = [];

  // 抽屉应可见
  const drawer = page.getByTestId('node-event-drawer');
  const drawerVisible = await drawer.isVisible().catch(() => false);
  if (!drawerVisible) {
    errors.push('真实候选截图必须显示抽屉');
    return errors;
  }

  // 模式徽标应为 Real 真实
  const modeBadge = page.getByTestId('node-event-mode-badge');
  const badgeText = await modeBadge.textContent();
  if (!badgeText || !badgeText.includes('Real')) {
    errors.push(`真实候选截图模式徽标应为 Real 真实，实际为: ${badgeText}`);
  }

  // 候选列表应存在
  const candidateList = page.getByTestId('node-event-candidate-list');
  const listVisible = await candidateList.isVisible().catch(() => false);
  if (!listVisible) {
    errors.push('真实候选截图必须显示候选列表');
    return errors;
  }

  // 节点信息区应可见
  const infoSection = page.getByTestId('node-event-section-info');
  const infoVisible = await infoSection.isVisible().catch(() => false);
  if (!infoVisible) {
    errors.push('真实候选截图必须显示节点信息区');
  }

  // 阅读提示应可见
  const readingTip = page.getByTestId('node-event-reading-tip');
  const tipVisible = await readingTip.isVisible().catch(() => false);
  if (!tipVisible) {
    errors.push('真实候选截图必须显示阅读提示');
  }

  // 至少一条候选明确标识 isRealEventCandidate=true
  const realCandidateCount = await page
    .locator('[data-testid^="node-event-candidate-"][data-is-real-candidate="true"]')
    .count();
  if (realCandidateCount === 0) {
    errors.push('真实候选截图必须至少有一条 isRealEventCandidate=true 的候选');
  }

  // 不应存在 fallbackReason
  const fallbackReason = page.getByTestId('node-event-fallback-reason');
  const fallbackVisible = await fallbackReason.isVisible().catch(() => false);
  if (fallbackVisible) {
    errors.push('真实候选截图不应存在 fallbackReason（不应为降级状态）');
  }

  return errors;
}

/**
 * 等待真实联调的最终状态。
 * 最多等待 REAL_FINAL_STATE_TIMEOUT，轮询检查三种最终状态：
 *   1. node-event-empty → 返回 'empty'
 *   2. node-event-candidate-list → 返回 'candidates'
 *   3. node-event-error → 返回 'error'
 * 30 秒后仍 loading → 抛出超时错误
 */
async function waitForRealFinalState(page) {
  const startTime = Date.now();

  while (Date.now() - startTime < REAL_FINAL_STATE_TIMEOUT) {
    // 检查 loading 状态是否仍在
    const loadingVisible = await page.getByTestId('node-event-loading').isVisible().catch(() => false);

    // 检查三种最终状态
    const emptyVisible = await page.getByTestId('node-event-empty').isVisible().catch(() => false);
    if (emptyVisible) return 'empty';

    const candidateListVisible = await page.getByTestId('node-event-candidate-list').isVisible().catch(() => false);
    if (candidateListVisible) return 'candidates';

    const errorVisible = await page.getByTestId('node-event-error').isVisible().catch(() => false);
    if (errorVisible) return 'error';

    // 如果仍在 loading，继续等待
    if (loadingVisible) {
      await sleep(POLL_INTERVAL);
      continue;
    }

    // 既不是 loading 也不是三种最终状态，可能是组件还在渲染，继续等待
    await sleep(POLL_INTERVAL);
  }

  // 超时
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  throw new Error(`真实新闻候选请求超时（等待 ${elapsed}s 后仍处于 loading 状态）`);
}

/**
 * 截图保护策略：将临时目录的截图整体替换到正式目录。
 * 仅当全部场景断言成功（hasFailure=false）时才执行替换。
 * 失败时保留上一轮已存在的有效截图。
 */
function commitScreenshots(allSuccess) {
  if (!allSuccess) {
    console.log('\n🔒 存在失败场景，保留上一轮已存在的正式截图，不替换');
    // 清理临时目录
    if (fs.existsSync(TMP_DIR)) {
      const tmpFiles = fs.readdirSync(TMP_DIR).filter(f => f.endsWith('.png'));
      for (const f of tmpFiles) {
        fs.unlinkSync(path.join(TMP_DIR, f));
      }
    }
    return;
  }

  // 全部成功：用临时目录替换正式目录
  console.log('\n📦 全部场景断言通过，将临时截图整体替换到正式目录...');

  // 清空正式目录中的旧 PNG 文件
  if (fs.existsSync(SCREENSHOTS_DIR)) {
    const oldFiles = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png'));
    for (const f of oldFiles) {
      fs.unlinkSync(path.join(SCREENSHOTS_DIR, f));
    }
  } else {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  // 将临时目录的 PNG 文件移动到正式目录
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
  console.log('  K-Ray 第十阶段 B 截图（关键节点—事件候选关联）');
  console.log('========================================');

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

  const pythonPath = resolvePythonPath();
  const hasAkshare = preflightAkshare(pythonPath);
  const hasBaostock = preflightBaostock(pythonPath);

  let mockServer = null;
  let fallbackServer = null;
  let realServer = null;
  let browser = null;
  let hasFailure = false;
  const screenshotResults = [];

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-proxy-server'],
    });
    console.log('\n✅ Playwright 浏览器启动成功（已禁用代理）');

    // ========== 启动 Mock 服务器 ==========
    mockServer = await startServer({
      EVENT_NEWS_MODE: 'mock',
      NO_PROXY: 'localhost,127.0.0.1',
      no_proxy: 'localhost,127.0.0.1',
    }, MOCK_PORT, 'Mock');

    let page = await browser.newPage();

    // ========== 截图1：Mock 候选 ==========
    console.log('\n--- 截图1：Mock 候选（verified/unverified/多股汇总）---');
    try {
      await loadDevSampleAndOpenDrawer(page, MOCK_PORT);
      await sleep(2000);

      // 等待候选列表渲染
      await page.getByTestId('node-event-candidate-list').waitFor({ state: 'visible', timeout: 10000 });

      const errors = await assertMockScreenshot(page);
      if (errors.length > 0) {
        console.error('  ❌ 截图1断言失败:');
        errors.forEach(e => console.error(`     - ${e}`));
        hasFailure = true;
      } else {
        await takeScreenshot(page, '01-phase10b-mock-candidates.png', 'Mock 候选');
        screenshotResults.push('01-phase10b-mock-candidates.png');
      }
    } catch (err) {
      console.error(`  ❌ 截图1失败：${err.message}`);
      hasFailure = true;
    }

    // ========== 截图2：无候选空状态 ==========
    console.log('\n--- 截图2：无候选空状态 ---');
    try {
      // 使用 page.route 拦截 node-event-candidates API 返回空候选
      await page.route('**/api/node-event-candidates**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            candidates: [],
            meta: {
              dataMode: 'mock',
              provider: 'mock',
              upstreamPlatform: 'mock',
              sourceLabel: 'Mock演示候选(开发验收)',
              isRealData: false,
              fetchedAt: new Date().toISOString(),
              nodeDate: '2024-02-06',
              windowStart: '2024-02-03',
              windowEnd: '2024-02-09',
              totalCount: 0,
              verifiedCount: 0,
              unverifiedCount: 0,
              multiStockSummaryCount: 0,
              originalTotalCount: 5,
              cacheStatus: 'miss',
            },
          }),
        });
      });

      // 重新加载页面并打开抽屉
      await loadDevSampleAndOpenDrawer(page, MOCK_PORT);
      await sleep(2000);

      // 等待空状态渲染
      await page.getByTestId('node-event-empty').waitFor({ state: 'visible', timeout: 10000 });

      const errors = await assertEmptyScreenshot(page);
      if (errors.length > 0) {
        console.error('  ❌ 截图2断言失败:');
        errors.forEach(e => console.error(`     - ${e}`));
        hasFailure = true;
      } else {
        await takeScreenshot(page, '02-phase10b-empty-candidates.png', '无候选空状态');
        screenshotResults.push('02-phase10b-empty-candidates.png');
      }

      // 清除路由拦截
      await page.unroute('**/api/node-event-candidates**');
    } catch (err) {
      console.error(`  ❌ 截图2失败：${err.message}`);
      hasFailure = true;
      await page.unroute('**/api/node-event-candidates**').catch(() => {});
    }

    // ========== 截图3：请求失败 ==========
    console.log('\n--- 截图3：请求失败状态 ---');
    try {
      // 拦截 API 返回错误
      await page.route('**/api/node-event-candidates**', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: '上游接口异常' }),
        });
      });

      await loadDevSampleAndOpenDrawer(page, MOCK_PORT);
      await sleep(2000);

      // 等待错误状态渲染
      await page.getByTestId('node-event-error').waitFor({ state: 'visible', timeout: 10000 });

      const errors = await assertErrorScreenshot(page);
      if (errors.length > 0) {
        console.error('  ❌ 截图3断言失败:');
        errors.forEach(e => console.error(`     - ${e}`));
        hasFailure = true;
      } else {
        await takeScreenshot(page, '03-phase10b-request-error.png', '请求失败状态');
        screenshotResults.push('03-phase10b-request-error.png');
      }

      await page.unroute('**/api/node-event-candidates**');
    } catch (err) {
      console.error(`  ❌ 截图3失败：${err.message}`);
      hasFailure = true;
      await page.unroute('**/api/node-event-candidates**').catch(() => {});
    }

    // ========== 截图4：移动端 Mock 候选 ==========
    console.log('\n--- 截图4：移动端 Mock 候选 ---');
    try {
      // 恢复桌面视口先关闭抽屉
      const closeBtn = page.getByTestId('node-event-drawer-close');
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
        await sleep(500);
      }

      // 设置移动端视口
      await page.setViewportSize({ width: 375, height: 812 });
      await sleep(500);

      await loadDevSampleAndOpenDrawer(page, MOCK_PORT);
      await sleep(2000);

      // 等待候选列表渲染
      await page.getByTestId('node-event-candidate-list').waitFor({ state: 'visible', timeout: 10000 });

      const errors = await assertMobileScreenshot(page);
      if (errors.length > 0) {
        console.error('  ❌ 截图4断言失败:');
        errors.forEach(e => console.error(`     - ${e}`));
        hasFailure = true;
      } else {
        await takeScreenshot(page, '05-phase10b-mobile.png', '移动端 Mock 候选');
        screenshotResults.push('05-phase10b-mobile.png');
      }

      // 恢复桌面视口
      await page.setViewportSize({ width: 1280, height: 800 });
      await sleep(500);
    } catch (err) {
      console.error(`  ❌ 截图4失败：${err.message}`);
      hasFailure = true;
      await page.setViewportSize({ width: 1280, height: 800 }).catch(() => {});
    }

    // 关闭 Mock 服务器
    if (mockServer) {
      mockServer.kill('SIGTERM');
      mockServer = null;
      await sleep(2000);
    }

    // ========== 启动 Fallback 服务器 ==========
    fallbackServer = await startServer({
      EVENT_NEWS_MODE: 'fallback',
      AKSHARE_SCRIPT_PATH: '/nonexistent/akshare_news_client.py',
      NO_PROXY: 'localhost,127.0.0.1',
      no_proxy: 'localhost,127.0.0.1',
    }, FALLBACK_PORT, 'Fallback');

    // ========== 截图5：Fallback 降级 ==========
    console.log('\n--- 截图5：Fallback 降级状态 ---');
    try {
      await loadDevSampleAndOpenDrawer(page, FALLBACK_PORT);
      await sleep(3000);

      // 等待降级说明渲染
      await page.getByTestId('node-event-fallback-reason').waitFor({ state: 'visible', timeout: 15000 });

      const errors = await assertFallbackScreenshot(page);
      if (errors.length > 0) {
        console.error('  ❌ 截图5断言失败:');
        errors.forEach(e => console.error(`     - ${e}`));
        hasFailure = true;
      } else {
        await takeScreenshot(page, '04-phase10b-fallback.png', 'Fallback 降级状态');
        screenshotResults.push('04-phase10b-fallback.png');
      }
    } catch (err) {
      console.error(`  ❌ 截图5失败：${err.message}`);
      hasFailure = true;
    }

    // 关闭 Fallback 服务器
    if (fallbackServer) {
      fallbackServer.kill('SIGTERM');
      fallbackServer = null;
      await sleep(2000);
    }

    // ========== 截图6：真实行情+关键节点+真实新闻（空状态或候选） ==========
    if (hasAkshare && hasBaostock) {
      console.log('\n--- 截图6：真实行情+关键节点+真实新闻 ---');
      try {
        realServer = await startServer({
          EVENT_NEWS_MODE: 'real',
          AKSHARE_PYTHON_PATH: pythonPath,
          BAOSTOCK_PYTHON_PATH: pythonPath,
          NO_PROXY: 'localhost,127.0.0.1',
          no_proxy: 'localhost,127.0.0.1',
        }, REAL_PORT, '真实');

        await page.goto(`http://localhost:${REAL_PORT}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await sleep(2000);

        // 输入股票代码
        const stockInput = page.getByPlaceholder(/输入.*6.*位.*股.*代码/);
        await stockInput.waitFor({ state: 'visible', timeout: 5000 });
        await stockInput.fill('600519');
        await sleep(500);
        await stockInput.press('Enter');
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
        await queryBtn.click();
        console.log('  ✅ 已点击查询按钮');

        // 等待图表渲染
        await sleep(5000);

        // 检查是否成功
        const errorCount = await page.getByText('行情查询失败').count();
        if (errorCount > 0) {
          throw new Error('BaoStock 真实行情查询失败');
        }

        // 等待图表和关键节点列表
        await page.locator('[data-testid="chart-wrapper"]').first().waitFor({ state: 'visible', timeout: 30000 });
        await page.getByTestId('key-node-list').waitFor({ state: 'visible', timeout: 10000 });
        await sleep(2000);

        // 检查关键节点数量
        const nodeCount = await page.locator('[data-testid="key-node-items"] > *').count();
        if (nodeCount === 0) {
          throw new Error('真实行情查询结果无关键节点');
        }
        console.log(`  ✅ 关键节点数量: ${nodeCount}`);

        // 点击第一个关键节点
        const firstItem = page.locator('[data-testid="key-node-items"] > *').first();
        await firstItem.click();
        await sleep(500);

        // 等待抽屉可见
        await page.getByTestId('node-event-drawer').waitFor({ state: 'visible', timeout: 10000 });

        // 等待真实联调的最终状态（最多 30 秒）
        console.log(`  ⏳ 等待真实新闻候选最终状态（最多 ${REAL_FINAL_STATE_TIMEOUT / 1000}s）...`);
        const finalState = await waitForRealFinalState(page);
        console.log(`  ✅ 最终状态: ${finalState}`);

        if (finalState === 'empty') {
          // 真实新闻空状态
          console.log('  ℹ️ 真实联调返回窗口内无候选，生成真实空状态截图');
          const errors = await assertRealEmptyScreenshot(page);
          if (errors.length > 0) {
            console.error('  ❌ 真实空状态断言失败:');
            errors.forEach(e => console.error(`     - ${e}`));
            hasFailure = true;
          } else {
            await takeScreenshot(page, '06-phase10b-real-empty.png', '真实行情+关键节点+真实新闻空状态');
            screenshotResults.push('06-phase10b-real-empty.png');
            console.log('  ℹ️ 数据源覆盖限制：AKShare stock_news_em 仅返回近期新闻，历史节点日期可能超出覆盖范围');
          }
        } else if (finalState === 'candidates') {
          // 真实新闻候选
          console.log('  ✅ 真实联调返回窗口内有候选，生成真实候选截图');
          const errors = await assertRealCandidatesScreenshot(page);
          if (errors.length > 0) {
            console.error('  ❌ 真实候选断言失败:');
            errors.forEach(e => console.error(`     - ${e}`));
            hasFailure = true;
          } else {
            await takeScreenshot(page, '07-phase10b-real-candidates.png', '真实行情+关键节点+真实新闻候选');
            screenshotResults.push('07-phase10b-real-candidates.png');
          }
        } else if (finalState === 'error') {
          // 真实请求失败：输出错误内容，非零退出码
          const errorState = page.getByTestId('node-event-error');
          const errorText = await errorState.textContent().catch(() => '');
          console.error('  ❌ 真实新闻候选请求失败:');
          console.error(`     错误内容: ${errorText}`);
          hasFailure = true;
        }
      } catch (err) {
        console.error(`  ❌ 截图6失败：${err.message}`);
        hasFailure = true;
      }
    } else {
      console.log('\n--- 截图6：跳过（Python/AKShare/BaoStock 环境不可用）---');
    }

    // ========== 截图保护：仅当全部成功时才整体替换正式目录 ==========
    commitScreenshots(!hasFailure);

    // ========== 最终报告 ==========
    console.log('\n========================================');
    console.log('  截图脚本执行完成');
    console.log('========================================');

    if (hasFailure) {
      console.log('\n⚠️ 部分截图失败或断言未通过（见上方日志）');
      console.log('  正式截图目录保留上一轮有效截图，未被删除');
      process.exitCode = 1;
    } else {
      console.log(`\n✅ 所有截图完成且断言通过（${screenshotResults.length} 张）:`);
      screenshotResults.forEach(f => {
        const filePath = path.join(SCREENSHOTS_DIR, f);
        if (fs.existsSync(filePath)) {
          const stat = fs.statSync(filePath);
          console.log(`  📸 ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
        }
      });
      process.exitCode = 0;
    }

  } catch (err) {
    console.error('\n❌ 截图脚本失败:', err.message);
    hasFailure = true;
    process.exitCode = 1;
    // 失败时也保留旧截图，不替换
    commitScreenshots(false);
  } finally {
    if (browser) await browser.close();
    if (mockServer) mockServer.kill('SIGTERM');
    if (fallbackServer) fallbackServer.kill('SIGTERM');
    if (realServer) realServer.kill('SIGTERM');
    await sleep(2000);
  }
}

run();
