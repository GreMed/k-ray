// K-Ray 第十七阶段 UI 收口截图脚本
//
// 连接到已运行的 dev server（默认端口 3000），生成以下截图：
//   1. 桌面端完整左右布局（1440x900）
//   2. 行情图单层卡片近景
//   3. 行情图下方笔记与日历近景
//   4. 笔记编辑状态
//   5. 有事件日期的日历状态
//   6. 移动端布局（375x812）
//
// 所有截图直接写入正式目录 screenshots_phase17/

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const FINAL_DIR = path.join(PROJECT_ROOT, 'screenshots_phase17');
const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 计算文件的 SHA-256 哈希
function sha256OfFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256');
  hash.update(buffer);
  return hash.digest('hex');
}

// 读取图片尺寸（PNG 头部 IHDR 块）
function readPngSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  // PNG 文件头 8 字节签名，之后是 IHDR 块（4 字节长度 + 4 字节类型 + 4 字节宽 + 4 字节高）
  if (buffer.length < 24) return { width: 0, height: 0 };
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

async function takeScreenshot(page, filename, description, fullPage = false) {
  const filePath = path.join(FINAL_DIR, filename);
  await page.screenshot({ path: filePath, fullPage });
  const stat = fs.statSync(filePath);
  console.log(`  📸 ${description}: ${filename} (${(stat.size / 1024).toFixed(1)} KB)`);
  return filePath;
}

// 对元素截图
async function takeElementScreenshot(element, filename, description) {
  const filePath = path.join(FINAL_DIR, filename);
  await element.screenshot({ path: filePath });
  const stat = fs.statSync(filePath);
  console.log(`  📸 ${description}: ${filename} (${(stat.size / 1024).toFixed(1)} KB)`);
  return filePath;
}

async function waitForCalendarReady(page) {
  const now = new Date();
  const expectedLabel = `${now.getFullYear()}年${now.getMonth() + 1}月`;
  await page.getByTestId('calendar-month-label').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  for (let i = 0; i < 20; i++) {
    const label = (await page.getByTestId('calendar-month-label').textContent().catch(() => '')) || '';
    if (label.includes(expectedLabel)) {
      console.log(`    ✅ 日历已就绪：${label}`);
      return true;
    }
    await sleep(500);
  }
  console.log(`    ⚠️ 日历未就绪`);
  return false;
}

async function main() {
  // 确保输出目录存在
  if (!fs.existsSync(FINAL_DIR)) {
    fs.mkdirSync(FINAL_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });

  // ================================================================
  // 截图 1: 桌面端完整左右布局（1440x900）
  // ================================================================
  console.log('\n=== 截图 1: 桌面端完整左右布局 ===');
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const desktopPage = await desktopContext.newPage();
  await desktopPage.goto(`${BASE_URL}/demo/core-replay?stock=300750`, { waitUntil: 'networkidle' });
  await sleep(2000);

  // 等待图表加载
  await desktopPage.getByTestId('chart-wrapper').waitFor({ state: 'visible', timeout: 10000 });
  await waitForCalendarReady(desktopPage);
  await sleep(1000);

  const screenshot01Path = await takeScreenshot(desktopPage, '01-desktop-full-layout.png', '桌面端完整左右布局（1440x900）');
  const screenshot01Hash = sha256OfFile(screenshot01Path);
  const screenshot01Size = readPngSize(screenshot01Path);
  console.log(`    📐 01 尺寸: ${screenshot01Size.width}x${screenshot01Size.height}`);
  console.log(`    🔒 01 SHA-256: ${screenshot01Hash}`);

  // 验证布局结构
  const leftColumnExists = await desktopPage.getByTestId('left-analysis-column').isVisible().catch(() => false);
  const dualCardAreaExists = await desktopPage.getByTestId('dual-card-area').isVisible().catch(() => false);
  console.log(`    ${leftColumnExists ? '✅' : '❌'} left-analysis-column 可见`);
  console.log(`    ${dualCardAreaExists ? '✅' : '❌'} dual-card-area 可见`);

  // ================================================================
  // 截图 2: 行情图单层卡片近景（使用 chart-wrapper 元素截图）
  // ================================================================
  console.log('\n=== 截图 2: 行情图单层卡片近景（元素截图） ===');
  const chartWrapper = desktopPage.getByTestId('chart-wrapper');
  await chartWrapper.scrollIntoViewIfNeeded();
  await sleep(500);

  // 在截图前先统计 chart-wrapper 内的行情图标题数量
  const chartTitleCount = await chartWrapper.locator('strong:has-text("K 线图表")').count();
  console.log(`    📊 chart-wrapper 内 "K 线图表" 标题数量: ${chartTitleCount}`);

  const screenshot02Path = await takeElementScreenshot(chartWrapper, '02-chart-single-card.png', '行情图单层卡片近景（元素截图）');
  const screenshot02Hash = sha256OfFile(screenshot02Path);
  const screenshot02Size = readPngSize(screenshot02Path);
  console.log(`    📐 02 尺寸: ${screenshot02Size.width}x${screenshot02Size.height}`);
  console.log(`    🔒 02 SHA-256: ${screenshot02Hash}`);

  // 断言 1：01 和 02 的 SHA-256 不得相同
  if (screenshot01Hash === screenshot02Hash) {
    console.error('    ❌ 断言失败：01 和 02 的 SHA-256 相同（图片内容重复）');
    process.exit(1);
  }
  console.log('    ✅ 断言通过：01 和 02 的 SHA-256 不同');

  // 断言 2：02 的宽度和高度必须小于 01
  if (screenshot02Size.width >= screenshot01Size.width) {
    console.error(`    ❌ 断言失败：02 宽度 ${screenshot02Size.width} 不小于 01 宽度 ${screenshot01Size.width}`);
    process.exit(1);
  }
  if (screenshot02Size.height >= screenshot01Size.height) {
    console.error(`    ❌ 断言失败：02 高度 ${screenshot02Size.height} 不小于 01 高度 ${screenshot01Size.height}`);
    process.exit(1);
  }
  console.log(`    ✅ 断言通过：02 尺寸 (${screenshot02Size.width}x${screenshot02Size.height}) 小于 01 (${screenshot01Size.width}x${screenshot01Size.height})`);

  // 断言 3：02 内只存在一组行情图标题
  if (chartTitleCount !== 1) {
    console.error(`    ❌ 断言失败：02 内行情图标题数量为 ${chartTitleCount}，应为 1`);
    process.exit(1);
  }
  console.log('    ✅ 断言通过：02 内只存在一组行情图标题');

  // 验证 chart-card 无卡片样式
  const chartCard = desktopPage.getByTestId('chart-card');
  const chartCardClass = await chartCard.getAttribute('class') || '';
  const hasCardStyles = chartCardClass.includes('bg-white') || chartCardClass.includes('border') || chartCardClass.includes('rounded');
  console.log(`    ${!hasCardStyles ? '✅' : '❌'} chart-card 无卡片可视化样式 (class="${chartCardClass}")`);

  // ================================================================
  // 截图 3: 行情图下方笔记与日历近景
  // ================================================================
  console.log('\n=== 截图 3: 行情图下方笔记与日历近景 ===');
  const dualCardArea = desktopPage.getByTestId('dual-card-area');
  await dualCardArea.scrollIntoViewIfNeeded();
  await sleep(500);
  await takeScreenshot(desktopPage, '03-notes-calendar-below-chart.png', '行情图下方笔记与日历近景');

  // ================================================================
  // 截图 4: 笔记编辑状态
  // ================================================================
  console.log('\n=== 截图 4: 笔记编辑状态 ===');
  // 点击图表上的一个交易日来选中日期
  const chartContainer = desktopPage.getByTestId('chart-container');
  const chartBox = await chartContainer.boundingBox();
  if (chartBox) {
    // 点击图表中间偏左的位置（选择一个早期交易日）
    await desktopPage.mouse.click(chartBox.x + chartBox.width * 0.3, chartBox.y + chartBox.height * 0.5);
    await sleep(1000);
  }

  // 点击"+ 新增"按钮
  const addBtn = desktopPage.getByTestId('trading-day-note-add-btn');
  if (await addBtn.isVisible().catch(() => false)) {
    await addBtn.click();
    await sleep(500);

    // 在 textarea 中输入内容
    const textarea = desktopPage.getByTestId('trading-day-note-textarea');
    if (await textarea.isVisible().catch(() => false)) {
      await textarea.fill('这是第十七阶段UI收口测试笔记：验证单层卡片和紧凑布局。');
      await sleep(300);
    }

    // 滚动到笔记区域并截图
    const notePanel = desktopPage.getByTestId('trading-day-note-panel');
    await notePanel.scrollIntoViewIfNeeded();
    await sleep(300);
    await takeScreenshot(desktopPage, '04-note-editing.png', '笔记编辑状态');
    console.log('    ✅ 笔记编辑状态已截取');
  } else {
    console.log('    ⚠️ 未找到新增按钮，尝试已选择日期的笔记面板');
    const notePanel = desktopPage.getByTestId('trading-day-note-panel');
    await notePanel.scrollIntoViewIfNeeded();
    await takeScreenshot(desktopPage, '04-note-editing.png', '笔记面板状态');
  }

  // ================================================================
  // 截图 5: 有事件日期的日历状态
  // ================================================================
  console.log('\n=== 截图 5: 有事件日期的日历状态 ===');
  // 查找一个有事件的日期格子
  const calendarGrid = desktopPage.getByTestId('calendar-grid');
  await calendarGrid.scrollIntoViewIfNeeded();
  await sleep(500);

  // 尝试点击有事件的日期（查找带圆点的日期格子）
  const eventCells = desktopPage.locator('[data-testid^="calendar-cell-"]');
  const cellCount = await eventCells.count();
  let clickedEventCell = false;

  for (let i = 0; i < cellCount && !clickedEventCell; i++) {
    const cell = eventCells.nth(i);
    const cellText = (await cell.textContent().catch(() => '')) || '';
    // 检查是否有事件标记（通过查找子元素中的圆点）
    const hasDot = await cell.locator('span.w-1.h-1.rounded-full').count() > 0;
    if (hasDot) {
      await cell.click();
      await sleep(500);
      clickedEventCell = true;
      console.log(`    ✅ 点击了有事件的日期格子: ${cellText.trim()}`);
    }
  }

  if (!clickedEventCell) {
    // 如果没找到有事件的格子，点击今天
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayCell = desktopPage.getByTestId(`calendar-cell-${todayStr}`);
    if (await todayCell.isVisible().catch(() => false)) {
      await todayCell.click();
      await sleep(500);
      console.log(`    ✅ 点击了今天: ${todayStr}`);
    }
  }

  // 检查是否有事件详情显示
  const selectedDateEvents = desktopPage.getByTestId('selected-date-events');
  if (await selectedDateEvents.isVisible().catch(() => false)) {
    console.log('    ✅ 选中日期事件详情已显示');
  }

  await takeScreenshot(desktopPage, '05-calendar-with-events.png', '有事件日期的日历状态');

  await desktopContext.close();

  // ================================================================
  // 截图 6: 移动端布局（375x812）
  // ================================================================
  console.log('\n=== 截图 6: 移动端布局 ===');
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${BASE_URL}/demo/core-replay?stock=300750`, { waitUntil: 'networkidle' });
  await sleep(2000);

  await mobilePage.getByTestId('chart-wrapper').waitFor({ state: 'visible', timeout: 10000 });
  await waitForCalendarReady(mobilePage);
  await sleep(1000);

  await takeScreenshot(mobilePage, '06-mobile-layout.png', '移动端布局（375x812）', true);

  // 验证移动端无横向溢出
  const scrollWidth = await mobilePage.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await mobilePage.evaluate(() => document.documentElement.clientWidth);
  const hasOverflow = scrollWidth > clientWidth;
  console.log(`    ${!hasOverflow ? '✅' : '❌'} 移动端无横向溢出 (scrollWidth=${scrollWidth}, clientWidth=${clientWidth})`);

  await mobileContext.close();

  await browser.close();

  console.log('\n=== 截图完成 ===');
  console.log(`截图目录: ${FINAL_DIR}`);
  const files = fs.readdirSync(FINAL_DIR).filter(f => f.endsWith('.png'));
  console.log(`共生成 ${files.length} 张截图:`);
  files.forEach(f => console.log(`  - ${f}`));
}

main().catch((err) => {
  console.error('截图脚本执行失败:', err);
  process.exit(1);
});
