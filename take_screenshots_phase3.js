/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * K-Ray 第三阶段截图脚本
 * 生成来源追溯相关的5张截图
 *
 * 重要：找不到按钮时直接报错并停止，不能静默保存普通页面
 */
const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'http://localhost:3001';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'screenshots_phase3');

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

async function waitForReplayReady(page) {
  await page.waitForSelector('[data-testid="dev-open-multi-source-event"]', { timeout: 10000 });
  await page.waitForTimeout(500);
}

async function closeDrawer(page) {
  const closeBtn = page.locator('text=✕ 关闭').first();
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
    await page.waitForTimeout(500);
  }
}

/**
 * 加载覆盖指定区间的复盘数据
 * 通过开发环境按钮加载（1-3月区间）或等待页面就绪
 */
async function loadMarchRange(page) {
  const btn = await assertButtonVisible(page, 'dev-load-march-range', '加载1-3月区间');
  await btn.click();
  await page.waitForTimeout(2000);
  // 等待按钮重新出现（说明加载完成）
  await page.waitForSelector('[data-testid="dev-open-no-source-event"]', { timeout: 10000 });
  await page.waitForTimeout(500);
}

async function loadJanuaryRange(page) {
  // 通过 DevStatePanel 重新加载1月数据
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
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  console.log('🚀 开始生成第三阶段截图...');

  // 导航到首页
  await page.goto(BASE_URL);
  await page.waitForTimeout(1000);

  // 展开开发面板并加载成功状态
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

  // === 1. 多来源事件详情 ===
  console.log('📸 1/5: 多来源事件详情');
  const multiBtn = await assertButtonVisible(page, 'dev-open-multi-source-event', '多来源事件');
  await multiBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '01-multiple-sources.png'),
    fullPage: false,
  });
  await closeDrawer(page);

  // === 2. 单来源事件详情 ===
  console.log('📸 2/5: 单来源事件详情');
  const singleBtn = await assertButtonVisible(page, 'dev-open-single-source-event', '单来源事件');
  await singleBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '02-single-source.png'),
    fullPage: false,
  });
  await closeDrawer(page);

  // === 3. 无来源事件 fallback ===
  console.log('📸 3/5: 无来源事件 fallback');
  // 无来源事件发生在 2024-03-10，需要加载覆盖3月的复盘区间
  await closeDrawer(page);
  await loadMarchRange(page);

  const noSourceBtn = await assertButtonVisible(page, 'dev-open-no-source-event', '无来源事件');
  await noSourceBtn.click();

  // 严格等待 [data-testid="no-source-fallback"] 元素出现
  const fallbackLocator = page.locator('[data-testid="no-source-fallback"]');
  await fallbackLocator.waitFor({ state: 'visible', timeout: 10000 });

  // 滚动到可视区域
  await fallbackLocator.scrollIntoViewIfNeeded();

  // 断言元素可见
  const isFallbackVisible = await fallbackLocator.isVisible();
  if (!isFallbackVisible) {
    throw new Error('❌ 截图失败：[data-testid="no-source-fallback"] 不可见，停止截图');
  }

  // 断言页面包含两段必要文案（直接校验 fallback 元素的文本内容，避免 emoji 前缀干扰选择器匹配）
  const requiredTexts = [
    '暂无可追溯来源',
    '当前演示数据未提供可追溯来源，请勿将该事件解释视为已验证事实。',
  ];
  const fallbackText = (await fallbackLocator.textContent()) || '';
  for (const text of requiredTexts) {
    if (!fallbackText.includes(text)) {
      throw new Error(`❌ 截图失败：fallback 区域未包含必要文案 "${text}"，停止截图`);
    }
  }

  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '03-no-source-fallback.png'),
    fullPage: false,
  });
  await closeDrawer(page);

  // === 4. 来源详情弹窗 ===
  console.log('📸 4/5: 来源详情弹窗');
  // 使用 dev-open-source-detail 直接打开来源详情弹窗
  const sourceDetailBtn = await assertButtonVisible(page, 'dev-open-source-detail', '来源详情');
  await sourceDetailBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '04-source-detail.png'),
    fullPage: false,
  });

  // 关闭来源详情弹窗和抽屉
  const sourceCloseBtn = page.locator('[data-testid="source-detail-close"]');
  if (await sourceCloseBtn.isVisible()) {
    await sourceCloseBtn.click();
    await page.waitForTimeout(500);
  }
  await closeDrawer(page);

  // === 5. 手机端来源详情 ===
  console.log('📸 5/5: 手机端来源详情');
  // 切换到手机视口
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);

  // 重新加载1月数据
  await loadJanuaryRange(page);

  // 打开多来源事件
  const mobileMultiBtn = await assertButtonVisible(page, 'dev-open-multi-source-event', '多来源事件(手机)');
  await mobileMultiBtn.click();
  await page.waitForTimeout(1000);

  // 点击"查看演示来源"
  const viewSourceBtn = page.locator('[data-testid^="view-source-"]').first();
  if (await viewSourceBtn.isVisible()) {
    await viewSourceBtn.click();
    await page.waitForTimeout(800);
  } else {
    throw new Error('❌ 截图失败：找不到"查看演示来源"按钮');
  }
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '05-mobile-source-detail.png'),
    fullPage: false,
  });

  console.log('✅ 截图完成！');

  // 列出截图
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
