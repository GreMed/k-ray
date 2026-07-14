/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * K-Ray 第四阶段截图脚本
 * 生成未来事件日历相关的6张截图
 *
 * 重要：找不到目标元素时直接报错并停止，不能静默保存普通页面
 */
const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'http://localhost:3001';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'screenshots_phase4');

const fs = require('fs');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

/**
 * 断言按钮存在且可见，否则抛错停止
 */
async function assertButtonVisible(page, testid, label) {
  const btn = page.locator(`[data-testid="${testid}"]`);
  const visible = await btn.isVisible();
  if (!visible) {
    throw new Error(`❌ 截图失败：找不到 data-testid="${testid}" 按钮（${label}），停止截图`);
  }
  return btn;
}

/**
 * 断言元素存在且可见，否则抛错停止
 */
async function assertElementVisible(page, testid, label) {
  const el = page.locator(`[data-testid="${testid}"]`);
  await el.waitFor({ state: 'visible', timeout: 10000 });
  const visible = await el.isVisible();
  if (!visible) {
    throw new Error(`❌ 截图失败：找不到 data-testid="${testid}" 元素（${label}），停止截图`);
  }
  return el;
}

async function waitForReplayReady(page) {
  await page.waitForSelector('[data-testid="dev-open-future-calendar"]', { timeout: 10000 });
  await page.waitForTimeout(500);
}

async function closeDrawer(page) {
  const closeBtn = page.locator('[data-testid="future-event-detail-close"]');
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
    await page.waitForTimeout(500);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  console.log('🚀 开始生成第四阶段截图...');

  await page.goto(BASE_URL);
  await page.waitForTimeout(1000);

  const expandBtn = page.locator('text=展开状态演示面板');
  if (await expandBtn.isVisible()) {
    await expandBtn.click();
    await page.waitForTimeout(500);
  }

  const successBtn = page.locator('text=成功状态（示例数据）');
  if (await successBtn.isVisible()) {
    await successBtn.click();
    await page.waitForTimeout(2000);
  }

  await waitForReplayReady(page);

  // === 1. 未来事件日历 ===
  console.log('📸 1/6: 未来事件日历');
  const calendarBtn = await assertButtonVisible(page, 'dev-open-future-calendar', '定位未来事件日历');
  await calendarBtn.click();
  await page.waitForTimeout(800);

  const calendarEl = await assertElementVisible(page, 'future-calendar', '未来事件日历');
  await calendarEl.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  // 断言标题和风险提示文案完整显示
  const calendarText = (await calendarEl.textContent()) || '';
  if (!calendarText.includes('未来事件日历')) {
    throw new Error('❌ 截图失败：日历区域未包含"未来事件日历"标题');
  }
  if (!calendarText.includes('未来事件仅用于时间管理和研究提醒')) {
    throw new Error('❌ 截图失败：日历区域未包含风险提示');
  }
  if (!calendarText.includes('不代表事件一定发生，也不代表其将导致特定股价表现')) {
    throw new Error('❌ 截图失败：日历区域风险提示不完整');
  }

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '01-future-calendar.png'),
    fullPage: false,
  });

  // === 2. 已确认事件详情 ===
  console.log('📸 2/6: 已确认事件详情');
  await closeDrawer(page);
  const confirmedBtn = await assertButtonVisible(page, 'dev-open-confirmed-future-event', '已确认事件');
  await confirmedBtn.click();
  await page.waitForTimeout(800);

  const confirmedDrawer = await assertElementVisible(page, 'future-event-detail-close', '已确认事件详情抽屉');
  await confirmedDrawer.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '02-confirmed-event-detail.png'),
    fullPage: false,
  });

  // === 3. 预计日期事件详情 ===
  console.log('📸 3/6: 预计日期事件详情');
  await closeDrawer(page);
  const estimatedBtn = await assertButtonVisible(page, 'dev-open-estimated-future-event', '预计日期事件');
  await estimatedBtn.click();
  await page.waitForTimeout(800);

  const estimatedDrawer = await assertElementVisible(page, 'future-event-detail-close', '预计日期事件详情抽屉');
  await estimatedDrawer.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '03-estimated-event-detail.png'),
    fullPage: false,
  });

  // === 4. 日期待定事件详情 ===
  console.log('📸 4/6: 日期待定事件详情');
  await closeDrawer(page);
  const tentativeBtn = await assertButtonVisible(page, 'dev-open-tentative-future-event', '日期待定事件');
  await tentativeBtn.click();
  await page.waitForTimeout(800);

  const tentativeDrawer = await assertElementVisible(page, 'future-event-detail-close', '日期待定事件详情抽屉');
  await tentativeDrawer.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  // 断言：日期待定事件详情不得出现任何精确日期（YYYY-MM-DD格式）
  // 使用 page.locator 查找整个抽屉面板（右侧固定定位的面板）
  const drawerPanel = page.locator('.fixed.top-0.right-0.w-full.md\\:w-\\[500px\\].h-full.bg-white.z-40');
  const drawerText = (await drawerPanel.textContent()) || '';
  const datePattern = /\d{4}-\d{2}-\d{2}/g;
  const datesFound = drawerText.match(datePattern);
  if (datesFound && datesFound.length > 0) {
    throw new Error(`❌ 截图失败：日期待定事件详情中不应包含精确日期，发现：${datesFound.join(', ')}`);
  }

  // 断言：日期待定事件详情必须显示"日期待定"
  if (!drawerText.includes('日期待定')) {
    throw new Error('❌ 截图失败：日期待定事件详情未显示"日期待定"');
  }

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '04-tentative-event-detail.png'),
    fullPage: false,
  });

  // === 5. 空状态 ===
  console.log('📸 5/6: 空状态');
  await closeDrawer(page);
  const emptyBtn = await assertButtonVisible(page, 'dev-show-empty-future-events', '显示空状态');
  await emptyBtn.click();
  await page.waitForTimeout(800);

  const emptyEl = await assertElementVisible(page, 'future-calendar-empty', '空状态');
  await emptyEl.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  // 断言空状态文案存在
  const emptyText = (await emptyEl.textContent()) || '';
  if (!emptyText.includes('当前演示数据中暂无未来事件安排。')) {
    throw new Error('❌ 截图失败：空状态未包含必要文案"当前演示数据中暂无未来事件安排。"');
  }

  // 断言空状态必须包含风险提示
  if (!emptyText.includes('未来事件仅用于时间管理和研究提醒')) {
    throw new Error('❌ 截图失败：空状态未包含风险提示');
  }
  if (!emptyText.includes('不代表事件一定发生，也不代表其将导致特定股价表现')) {
    throw new Error('❌ 截图失败：空状态风险提示不完整');
  }

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '05-empty-future-events.png'),
    fullPage: false,
  });

  // === 6. 手机端未来事件日历 ===
  console.log('📸 6/6: 手机端未来事件日历');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);

  await page.goto(BASE_URL);
  await page.waitForTimeout(1000);

  const expandBtn2 = page.locator('text=展开状态演示面板');
  if (await expandBtn2.isVisible()) {
    await expandBtn2.click();
    await page.waitForTimeout(500);
  }
  const successBtn2 = page.locator('text=成功状态（示例数据）');
  if (await successBtn2.isVisible()) {
    await successBtn2.click();
    await page.waitForTimeout(2000);
  }

  await waitForReplayReady(page);

  const mobileCalendarBtn = await assertButtonVisible(page, 'dev-open-future-calendar', '定位未来事件日历(手机)');
  await mobileCalendarBtn.click();
  await page.waitForTimeout(800);

  const mobileCalendarEl = await assertElementVisible(page, 'future-calendar', '未来事件日历(手机)');
  // 使用 scrollIntoView 并设置 paddingTop，确保标题不被导航遮挡
  await mobileCalendarEl.evaluate(el => {
    el.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
    window.scrollBy(0, -80);
  });
  await page.waitForTimeout(500);

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '06-mobile-future-calendar.png'),
    fullPage: false,
  });

  console.log('✅ 截图完成！');

  const files = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png'));
  files.forEach(f => {
    const stat = fs.statSync(path.join(SCREENSHOT_DIR, f));
    console.log(`  ${f} - ${Math.round(stat.size / 1024)}KB`);
  });

  await browser.close();
})().catch(err => {
  console.error(err.message);
  process.exit(1);
});
