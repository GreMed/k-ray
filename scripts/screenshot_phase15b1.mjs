// K-Ray 第十五阶段 B1：静态真实历史复盘案例截图脚本
//
// 连接到已运行的 dev server，生成 6 张截图：
// 1. 案例完整首屏（时间范围、行情图、节点按钮、当前节点及复盘摘要）
// 2. 包含真实事件资料的节点
// 3. 事件详情打开状态（真实来源和"查看原文"）
// 4. 没有合格资料时的真实空状态
// 5. 申万三级数据暂缺状态
// 6. 1440×900 桌面截图（默认状态信息布局完整）
//
// 每张截图先断言页面状态，断言失败时脚本非零退出。
// 输出目录：screenshots_phase15b1/

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const SCREENSHOTS_DIR = path.join(PROJECT_ROOT, 'screenshots_phase15b1');
const PORT = process.env.PORT || 3042;
const BASE_URL = `http://localhost:${PORT}`;

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

// 断言辅助函数
async function assertElement(page, testId, label) {
  const el = page.getByTestId(testId);
  const visible = await el.isVisible().catch(() => false);
  console.log(`    ${visible ? '✅' : '❌'} ${label} (testid=${testId})`);
  return visible;
}

async function assertText(page, testId, text, label) {
  const el = page.getByTestId(testId);
  const content = (await el.textContent().catch(() => '')) || '';
  const found = content.includes(text);
  console.log(`    ${found ? '✅' : '❌'} ${label} (期望包含 "${text}")`);
  return found;
}

async function assertNoText(page, text, label) {
  const bodyText = await page.evaluate(() => document.body.textContent || '');
  const absent = !bodyText.includes(text);
  console.log(`    ${absent ? '✅' : '❌'} ${label} (不应包含 "${text}")`);
  return absent;
}

async function main() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  let allPassed = true;

  // ============================================================================
  // 截图 1：案例完整首屏（时间范围、行情图、节点按钮、当前节点及复盘摘要）
  // ============================================================================
  console.log('\n[截图 1] 案例完整首屏');
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/demo/core-replay`, { waitUntil: 'domcontentloaded' });
    await sleep(3000);

    // 断言页面状态
    console.log('  [断言]');
    const r1 = await assertText(page, 'page-title', '静态历史复盘案例', '标题为"静态历史复盘案例"');
    const r2 = await assertText(page, 'case-meta', '历史案例区间', '显示案例时间范围');
    const r3 = await assertText(page, 'case-meta', '静态快照生成于', '显示快照生成时间');
    const r4 = await assertElement(page, 'node-switcher', '节点切换入口存在');
    const r5 = await assertElement(page, 'chart-card', 'K线图卡片存在');
    const r6 = await assertElement(page, 'ai-replay-card', '复盘摘要卡片存在');
    const r7 = await assertText(page, 'ai-replay-card', '基于公开资料预生成的复盘摘要', '摘要标题正确');
    const r8 = await assertText(page, 'static-banner', '静态历史案例', '顶部标识存在');
    if (![r1, r2, r3, r4, r5, r6, r7, r8].every(Boolean)) allPassed = false;

    await takeScreenshot(page, '01-full-firstscreen.png', '案例完整首屏', false);
    await context.close();
  }

  // ============================================================================
  // 截图 2：包含真实事件资料的节点
  // ============================================================================
  console.log('\n[截图 2] 包含真实事件资料的节点');
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/demo/core-replay`, { waitUntil: 'domcontentloaded' });
    await sleep(2500);

    // 默认节点（节点1）有 3 条资料
    console.log('  [断言]');
    const r1 = await assertText(page, 'candidates-card', '可追溯资料', '事件资料区域存在');
    const r2 = await assertText(page, 'candidates-card', '3 条', '显示 3 条资料');
    const r3 = await assertElement(page, 'candidate-mat-300750-node1-001', '第一条资料存在');
    const r4 = await assertElement(page, 'candidate-mat-300750-node1-002', '第二条资料存在');
    const r5 = await assertElement(page, 'candidate-mat-300750-node1-003', '第三条资料存在');
    const r6 = await assertText(page, 'candidates-static-label', '静态历史案例', '事件区有静态标识');
    if (![r1, r2, r3, r4, r5, r6].every(Boolean)) allPassed = false;

    await takeScreenshot(page, '02-node-with-materials.png', '包含真实事件资料的节点');
    await context.close();
  }

  // ============================================================================
  // 截图 3：事件详情打开状态（真实来源和"查看原文"）
  // ============================================================================
  console.log('\n[截图 3] 事件详情打开状态');
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/demo/core-replay`, { waitUntil: 'domcontentloaded' });
    await sleep(2500);

    // 点击第一条资料的"查看详情"
    await page.getByTestId('material-toggle-mat-300750-node1-001').click();
    await sleep(1000);

    // 断言
    console.log('  [断言]');
    const r1 = await assertElement(page, 'material-detail-mat-300750-node1-001', '详情区域已展开');
    const r2 = await assertText(page, 'material-detail-mat-300750-node1-001', '来源：', '显示来源名称');
    const r3 = await assertText(page, 'material-detail-mat-300750-node1-001', '发布时间：', '显示发布时间');
    const r4 = await assertText(page, 'material-detail-mat-300750-node1-001', '与节点相隔：', '显示相隔天数');
    const r5 = await assertText(page, 'material-detail-mat-300750-node1-001', '相关性说明：', '显示相关性说明');
    const r6 = await assertText(page, 'material-detail-mat-300750-node1-001', '查看原文', '存在"查看原文"按钮');

    // 验证链接属性
    const link = page.getByTestId('material-source-link-mat-300750-node1-001');
    const href = await link.getAttribute('href');
    const target = await link.getAttribute('rel');
    const r7 = href && href.startsWith('http');
    const r8 = target === 'noopener noreferrer';
    console.log(`    ${r7 ? '✅' : '❌'} 原文链接为真实 http/https URL (${href})`);
    console.log(`    ${r8 ? '✅' : '❌'} 链接配置 rel="noopener noreferrer"`);
    if (![r1, r2, r3, r4, r5, r6, r7, r8].every(Boolean)) allPassed = false;

    await takeScreenshot(page, '03-material-detail-open.png', '事件详情打开状态');
    await context.close();
  }

  // ============================================================================
  // 截图 4：没有合格资料时的真实空状态
  // ============================================================================
  console.log('\n[截图 4] 没有合格资料时的真实空状态');
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/demo/core-replay`, { waitUntil: 'domcontentloaded' });
    await sleep(2500);

    // 点击节点 4（local_low:300750:2025-02-11，无资料）
    await page.getByTestId('node-tab-local_low:300750:2025-02-11').click();
    await sleep(1500);

    // 断言
    console.log('  [断言]');
    const r1 = await assertElement(page, 'empty-materials', '空状态区域存在');
    const r2 = await assertText(page, 'empty-materials', '该节点暂无可追溯的时间临近资料', '空状态文案正确');
    const r3 = await assertElement(page, 'no-replay-summary', '无摘要状态存在');
    const r4 = await assertText(page, 'no-replay-summary', '不生成复盘摘要', '无摘要文案正确');
    if (![r1, r2, r3, r4].every(Boolean)) allPassed = false;

    await takeScreenshot(page, '04-empty-materials.png', '没有合格资料时的真实空状态');
    await context.close();
  }

  // ============================================================================
  // 截图 5：申万三级数据暂缺状态
  // ============================================================================
  console.log('\n[截图 5] 申万三级数据暂缺状态');
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/demo/core-replay`, { waitUntil: 'domcontentloaded' });
    await sleep(2500);

    // 断言（默认节点就应该显示暂缺）
    console.log('  [断言]');
    const r1 = await assertElement(page, 'sw-level3-missing', '申万暂缺标识存在');
    const r2 = await assertText(page, 'sw-level3-missing', '板块数据暂缺', '暂缺文案正确');

    // 切换节点验证仍然暂缺
    await page.getByTestId('node-tab-significant_down:300750:2024-10-09').click();
    await sleep(1000);
    const r3 = await assertText(page, 'sw-level3-missing', '板块数据暂缺', '切换节点后仍暂缺');
    if (![r1, r2, r3].every(Boolean)) allPassed = false;

    // 切回默认节点截图
    await page.getByTestId('node-tab-significant_up:300750:2024-09-30').click();
    await sleep(500);
    await takeScreenshot(page, '05-sw-level3-missing.png', '申万三级数据暂缺状态');
    await context.close();
  }

  // ============================================================================
  // 截图 6：1440×900 桌面截图（默认状态信息布局完整）
  // ============================================================================
  console.log('\n[截图 6] 1440×900 桌面截图');
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/demo/core-replay`, { waitUntil: 'domcontentloaded' });
    await sleep(3000);

    // 断言默认状态信息布局完整
    console.log('  [断言] 默认状态信息布局');
    const r1 = await assertText(page, 'current-node-date', '2024-09-30', '当前节点日期正确');
    const r2 = await assertText(page, 'current-node-type', '单日显著上涨', '当前节点类型正确');
    const r3 = await assertElement(page, 'current-node-close', '收盘价存在');
    const r4 = await assertElement(page, 'current-node-change', '涨跌幅存在');
    const r5 = await assertElement(page, 'current-node-volume', '成交量存在');
    const r6 = await assertElement(page, 'sw-level3-missing', '申万三级区域存在');
    const r7 = await assertElement(page, 'market-fact', '行情事实存在');
    const r8 = await assertElement(page, 'observation-clues', '观察线索存在');
    const r9 = await assertElement(page, 'unconfirmed-parts', '未确认部分存在');
    const r10 = await assertElement(page, 'source-list-card', '来源清单存在');

    // 验证页面不包含 example.com
    const r11 = await assertNoText(page, 'example.com', '页面不包含 example.com');
    const r12 = await assertNoText(page, 'Mock 演示候选', '页面不包含 Mock 演示候选');
    const r13 = await assertNoText(page, 'Mock 演示来源', '页面不包含 Mock 演示来源');
    if (![r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12, r13].every(Boolean)) allPassed = false;

    await takeScreenshot(page, '06-desktop-1440x900.png', '1440×900 桌面截图', false);
    await context.close();
  }

  await browser.close();

  console.log(`\n截图已保存到 ${SCREENSHOTS_DIR}`);

  if (!allPassed) {
    console.error('\n❌ 截图断言失败：有页面状态断言未通过');
    process.exit(1);
  }

  console.log('\n✅ 所有截图和页面状态断言通过');
}

main().catch((err) => {
  console.error('❌ 截图脚本失败:', err);
  process.exit(1);
});
