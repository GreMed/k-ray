// K-Ray 第二阶段真实截图脚本（优化版）
// 使用 Playwright 生成7张截图
/* eslint-disable @typescript-eslint/no-require-imports */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'screenshots_phase2');
const BASE_URL = 'http://localhost:3000';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function takeScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  console.log('🚀 开始生成截图...');

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // === 场景1: 桌面端专业K线图 ===
  console.log('📸 1/7: 桌面端专业K线图');
  const searchInput = page.locator('input').first();
  await searchInput.fill('600519');
  await page.waitForTimeout(500);
  const searchResult = page.locator('text=贵州茅台').first();
  if (await searchResult.isVisible()) {
    await searchResult.click();
    await page.waitForTimeout(500);
  }
  const replayBtn = page.locator('text=开始复盘');
  if (await replayBtn.isVisible()) {
    await replayBtn.click();
    await page.waitForTimeout(3500);
  }
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '01-desktop-kline-chart.png'),
    fullPage: false,
  });

  // === 场景2: 悬停OHLC数据 ===
  console.log('📸 2/7: 悬停OHLC数据');
  const chartContainer = page.locator('[data-testid="chart-container"]');
  if (await chartContainer.isVisible()) {
    const box = await chartContainer.boundingBox();
    if (box) {
      // 移动鼠标到图表中间偏左的位置
      await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
      await page.waitForTimeout(1500);
    }
  }
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '02-hover-ohlc-data.png'),
    fullPage: false,
  });

  // === 场景3: 聚合事件列表 ===
  console.log('📸 3/7: 聚合事件列表');
  // 使用开发环境截图辅助按钮稳定打开聚合事件列表
  const devOpenGroupBtn = page.locator('[data-testid="dev-open-event-group"]');
  if (await devOpenGroupBtn.isVisible()) {
    await devOpenGroupBtn.click();
    await page.waitForTimeout(1000);
  } else {
    // 回退方案：点击图表上的聚合标记
    if (await chartContainer.isVisible()) {
      const box = await chartContainer.boundingBox();
      if (box) {
        const markerX = box.x + box.width * 0.1;
        const markerY = box.y + box.height * 0.75;
        await page.mouse.click(markerX, markerY);
        await page.waitForTimeout(1500);
      }
    }
  }
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '03-event-list.png'),
    fullPage: false,
  });

  // 关闭事件列表弹窗
  const eventListCloseBtn = page.locator('text=✕ 关闭').first();
  if (await eventListCloseBtn.isVisible()) {
    await eventListCloseBtn.click();
    await page.waitForTimeout(500);
  }

  // === 场景4: 非交易日映射事件详情 ===
  console.log('📸 4/7: 非交易日映射事件详情');
  // 使用开发环境截图辅助按钮打开非交易日映射事件
  const devOpenMappedEventBtn = page.locator('[data-testid="dev-open-mapped-event"]');
  if (await devOpenMappedEventBtn.isVisible()) {
    await devOpenMappedEventBtn.click();
    await page.waitForTimeout(1000);
  } else {
    // 回退：从页面事件列表点击任意事件
    const eventButton = page.locator('text=2023年度业绩预告超预期').first();
    if (await eventButton.isVisible()) {
      await eventButton.click();
      await page.waitForTimeout(1000);
    }
  }
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '04-event-detail.png'),
    fullPage: false,
  });

  // 关闭抽屉
  const closeBtn = page.locator('text=✕ 关闭').first();
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
    await page.waitForTimeout(500);
  }

  // === 场景5: 节点详情 ===
  console.log('📸 5/7: 节点详情');
  // 使用开发环境截图辅助按钮
  const devOpenNodeBtn = page.locator('[data-testid="dev-open-node"]');
  if (await devOpenNodeBtn.isVisible()) {
    await devOpenNodeBtn.click();
    await page.waitForTimeout(1000);
  } else {
    // 回退：点击关键节点概览中的节点
    const nodeButton = page.locator('text=突破前期高点').first();
    if (await nodeButton.isVisible()) {
      await nodeButton.click();
      await page.waitForTimeout(1000);
    }
  }
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '05-node-detail.png'),
    fullPage: false,
  });

  // 关闭节点抽屉
  const nodeCloseBtn = page.locator('text=✕ 关闭').first();
  if (await nodeCloseBtn.isVisible()) {
    await nodeCloseBtn.click();
    await page.waitForTimeout(500);
  }

  // === 场景6: 快捷日期选择后的结果 ===
  console.log('📸 6/7: 快捷日期选择后的结果');
  const resetBtn = page.locator('text=重新复盘');
  if (await resetBtn.isVisible()) {
    await resetBtn.click();
    await page.waitForTimeout(1000);
  }

  // 重新搜索股票
  const searchInput2 = page.locator('input').first();
  await searchInput2.fill('600519');
  await page.waitForTimeout(500);
  const searchResult2 = page.locator('text=贵州茅台').first();
  if (await searchResult2.isVisible()) {
    await searchResult2.click();
    await page.waitForTimeout(500);
  }

  // 点击近1个月快捷选项
  const quick1m = page.locator('[data-testid="quick-option-1m"]');
  if (await quick1m.isVisible()) {
    await quick1m.click();
    await page.waitForTimeout(500);
  }

  // 开始复盘
  const replayBtn2 = page.locator('text=开始复盘');
  if (await replayBtn2.isVisible()) {
    await replayBtn2.click();
    await page.waitForTimeout(3500);
  }
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '06-quick-date-result.png'),
    fullPage: false,
  });

  // === 场景7: 手机端专业K线图 ===
  console.log('📸 7/7: 手机端专业K线图');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '07-mobile-kline-chart.png'),
    fullPage: false,
  });

  console.log('✅ 截图完成！');
  console.log('截图保存在:', SCREENSHOT_DIR);

  // 列出所有截图文件
  const files = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png'));
  files.forEach(f => {
    const stat = fs.statSync(path.join(SCREENSHOT_DIR, f));
    console.log(`  ${f} - ${(stat.size / 1024).toFixed(0)}KB`);
  });

  await browser.close();
}

takeScreenshots().catch(console.error);
