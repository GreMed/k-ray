// K-Ray 第十五阶段 A 收口：截图生成 + 首屏布局位置断言
//
// 连接到已运行的 dev server（端口 3042），生成 5 张截图：
// 1. 首页体验入口
// 2. 1440×900 默认节点首屏（fullPage: false，含位置断言）
// 3. 第二个节点首屏（fullPage: false，含位置断言）
// 4. 完整页面（fullPage: true）
// 5. 移动端页面
//
// 位置断言：1440×900 首屏必须同时看到节点切换入口、AI复盘要点、第一条事件候选
// 任一元素超出首屏 viewport，脚本非零退出。
//
// 输出目录：screenshots-phase15a/

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const SCREENSHOTS_DIR = path.join(PROJECT_ROOT, 'screenshots-phase15a');
const PORT = 3042;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function takeScreenshot(page, filename, description, fullPage = true) {
  const filePath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: filePath, fullPage });
  const stat = fs.statSync(filePath);
  console.log(`  📸 ${description}: ${filename} (${(stat.size / 1024).toFixed(1)} KB)`);
  return filePath;
}

// 首屏布局位置断言：验证关键元素在 viewport 内
async function assertFirstScreenLayout(page, viewportHeight, label) {
  console.log(`\n  [首屏断言] ${label} (viewport height=${viewportHeight})`);

  let allPassed = true;

  // 1. 节点切换入口在 viewport 内
  const nodeSwitcher = page.getByTestId('node-switcher');
  const nsBox = await nodeSwitcher.boundingBox();
  const nsVisible = nsBox && nsBox.y + nsBox.height <= viewportHeight;
  console.log(`    ${nsVisible ? '✅' : '❌'} 节点切换入口在viewport内 (y=${nsBox?.y}, bottom=${nsBox ? nsBox.y + nsBox.height : 'N/A'})`);
  if (!nsVisible) allPassed = false;

  // 2. AI 复盘要点在 viewport 内
  const aiReplay = page.getByTestId('ai-replay-card');
  const aiBox = await aiReplay.boundingBox();
  const aiVisible = aiBox && aiBox.y + aiBox.height <= viewportHeight;
  console.log(`    ${aiVisible ? '✅' : '❌'} AI复盘要点在viewport内 (y=${aiBox?.y}, bottom=${aiBox ? aiBox.y + aiBox.height : 'N/A'})`);
  if (!aiVisible) allPassed = false;

  // 3. 第一条事件候选在 viewport 内
  const firstCandidate = page.locator('[data-testid^="candidate-mock-candidate-"]').first();
  const candBox = await firstCandidate.boundingBox();
  const candVisible = candBox && candBox.y + candBox.height <= viewportHeight;
  console.log(`    ${candVisible ? '✅' : '❌'} 第一条事件候选在viewport内 (y=${candBox?.y}, bottom=${candBox ? candBox.y + candBox.height : 'N/A'})`);
  if (!candVisible) allPassed = false;

  // 4. K 线图主体在 viewport 内
  const chartCard = page.getByTestId('chart-card');
  const chartBox = await chartCard.boundingBox();
  const chartVisible = chartBox && chartBox.y >= 0 && chartBox.y < viewportHeight;
  console.log(`    ${chartVisible ? '✅' : '❌'} K线图主体在viewport内 (y=${chartBox?.y})`);
  if (!chartVisible) allPassed = false;

  return allPassed;
}

async function main() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  let layoutPassed = true;

  // ============================================================================
  // 截图 1：首页体验入口
  // ============================================================================
  console.log('\n[截图 1] 首页体验入口');
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await sleep(2500);
    await takeScreenshot(page, '01-home-entry.png', '首页体验入口');
    await context.close();
  }

  // ============================================================================
  // 截图 2：1440×900 默认节点首屏（fullPage: false + 位置断言）
  // ============================================================================
  console.log('\n[截图 2] 1440×900 默认节点首屏（fullPage: false）');
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`http://localhost:${PORT}/demo/core-replay`, { waitUntil: 'domcontentloaded' });
    await sleep(3500);

    // 位置断言（非零退出判断）
    const passed = await assertFirstScreenLayout(page, 900, '默认节点首屏');
    if (!passed) layoutPassed = false;

    // 首屏截图必须使用 fullPage: false
    await takeScreenshot(page, '02-default-firstscreen.png', '默认节点首屏', false);
    await context.close();
  }

  // ============================================================================
  // 截图 3：第二个节点首屏（fullPage: false + 位置断言）
  // ============================================================================
  console.log('\n[截图 3] 第二个节点首屏（fullPage: false）');
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`http://localhost:${PORT}/demo/core-replay`, { waitUntil: 'domcontentloaded' });
    await sleep(3000);

    // 点击第二个节点（阶段高点 2024-10-08）
    const secondNodeId = 'mock-node-300750-local_high-2024-10-08';
    await page.getByTestId(`node-tab-${secondNodeId}`).click();
    await sleep(1500);

    // 位置断言
    const passed = await assertFirstScreenLayout(page, 900, '第二个节点首屏');
    if (!passed) layoutPassed = false;

    await takeScreenshot(page, '03-second-node-firstscreen.png', '第二个节点首屏', false);
    await context.close();
  }

  // ============================================================================
  // 截图 4：完整页面（fullPage: true，第三个节点）
  // ============================================================================
  console.log('\n[截图 4] 完整页面');
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
    const page = await context.newPage();
    await page.goto(`http://localhost:${PORT}/demo/core-replay`, { waitUntil: 'domcontentloaded' });
    await sleep(3000);

    // 点击第三个节点（单日显著下跌 2024-10-16）
    const thirdNodeId = 'mock-node-300750-significant_down-2024-10-16';
    await page.getByTestId(`node-tab-${thirdNodeId}`).click();
    await sleep(1500);
    await takeScreenshot(page, '04-full-page.png', '完整页面（第三个节点）');
    await context.close();
  }

  // ============================================================================
  // 截图 5：移动端页面
  // ============================================================================
  console.log('\n[截图 5] 移动端页面');
  {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto(`http://localhost:${PORT}/demo/core-replay`, { waitUntil: 'domcontentloaded' });
    await sleep(3500);

    // 检查是否有横向溢出
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    console.log(`  移动端：scrollWidth=${scrollWidth}, clientWidth=${clientWidth}, 溢出=${scrollWidth > clientWidth}`);

    await takeScreenshot(page, '05-mobile.png', '移动端页面');
    await context.close();
  }

  await browser.close();

  console.log(`\n截图已保存到 ${SCREENSHOTS_DIR}`);

  if (!layoutPassed) {
    console.error('\n❌ 首屏布局断言失败：有元素超出 1440×900 viewport');
    process.exit(1);
  }

  console.log('\n✅ 所有截图和首屏布局断言通过');
}

main().catch((err) => {
  console.error('❌ 截图脚本失败:', err);
  process.exit(1);
});
