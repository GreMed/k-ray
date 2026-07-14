// K-Ray 第十四阶段 A1 收口 — BaoStock 失败错误页截图
//
// 连接到已运行的 dev server（端口 3042），生成 BaoStock 失败错误页截图。
// 截图必须同时包含主体与页脚，且不得出现 "Mock" 或 "降级"。
//
// 输出：screenshots-phase14a1-final/03-baostock-failure-error-page.png

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const SCREENSHOTS_DIR = path.join(PROJECT_ROOT, 'screenshots-phase14a1-final');
const PORT = 3042;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  // 确保输出目录存在
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Mock klines API：返回 isRealMarketData=false（BaoStock 不可用降级场景）
  // 前端 isRealMarketData 保护应阻止进入成功页，显示错误，不展示 Mock K 线
  await page.route('**/api/market/klines**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        stock: {
          id: 'stock-sz-301165',
          code: '301165',
          name: '锐捷网络',
          market: 'SZ',
        },
        klines: [],
        meta: {
          source: 'mock',
          sourceLabel: 'Mock演示数据(BaoStock降级)',
          adjustment: 'none',
          isRealMarketData: false,
          fetchedAt: '2026-07-14T00:00:00.000Z',
          fallbackReason: 'BaoStock真实行情暂时不可用，请稍后重试。',
        },
      }),
    });
  });

  // 1. 访问首页
  console.log('1. 访问首页...');
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);

  // 2. 输入 301165 并选中
  console.log('2. 输入 301165...');
  const input = page.getByTestId('stock-search-input');
  await input.click();
  await input.fill('301165');
  await sleep(1000);
  const suggestion = page.locator('text=锐捷网络').first();
  await suggestion.waitFor({ state: 'visible', timeout: 15000 });
  await suggestion.click();
  await sleep(500);

  // 3. 点击「近1年」
  console.log('3. 点击「近1年」...');
  const yearBtn = page.locator('button', { hasText: '近1年' }).first();
  if (await yearBtn.isVisible()) {
    await yearBtn.click();
    await sleep(400);
  }

  // 4. 点击「查询行情」
  console.log('4. 点击「查询行情」...');
  const queryBtn = page.locator('button', { hasText: '查询行情' }).first();
  await queryBtn.click();

  // 5. 等待错误状态出现
  console.log('5. 等待错误状态...');
  await page.locator('text=/BaoStock真实行情暂时不可用|真实行情服务暂时不可用/').first().waitFor({ state: 'visible', timeout: 20000 });
  await sleep(2000);

  // 6. 截图（fullPage=true 确保包含页脚）
  console.log('6. 截图（含主体与页脚）...');
  const screenshotPath = path.join(SCREENSHOTS_DIR, '03-baostock-failure-error-page.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const stat = fs.statSync(screenshotPath);
  console.log(`   📸 截图已保存: ${screenshotPath} (${(stat.size / 1024).toFixed(1)} KB)`);

  // 7. 验证断言
  console.log('7. 验证断言...');
  const errorState = page.getByTestId('error-state');
  await errorState.waitFor({ state: 'visible' });

  const errorText = await errorState.textContent() || '';
  const footerNote = page.getByTestId('footer-data-note');
  const footerText = await footerNote.textContent() || '';

  // 断言: 错误页不含 "Mock" "降级"
  const errorHasMock = errorText.includes('Mock') || errorText.includes('降级');
  console.log(`   ${!errorHasMock ? '✅' : '❌'} 错误页不含 Mock/降级: ${!errorHasMock}`);

  // 断言: 页脚不含 "Mock" "降级"
  const footerHasMock = footerText.includes('Mock') || footerText.includes('降级');
  console.log(`   ${!footerHasMock ? '✅' : '❌'} 页脚不含 Mock/降级: ${!footerHasMock}`);

  // 断言: 页脚显示"本次未展示任何行情数据"
  const footerHasNoData = footerText.includes('本次未展示任何行情数据');
  console.log(`   ${footerHasNoData ? '✅' : '❌'} 页脚显示"本次未展示任何行情数据": ${footerHasNoData}`);

  // 断言: 错误文案没有连续两个句号
  const hasDoublePeriod = errorText.includes('。。');
  console.log(`   ${!hasDoublePeriod ? '✅' : '❌'} 错误文案无连续两个句号: ${!hasDoublePeriod}`);

  // 断言: 不进入成功页
  const hasSuccessTitle = await page.locator('text=/走势复盘结果|日K查询结果/').count();
  const hasChartLabel = await page.getByTestId('chart-data-label').count();
  console.log(`   ${hasSuccessTitle === 0 ? '✅' : '❌'} 无成功标题: ${hasSuccessTitle === 0}`);
  console.log(`   ${hasChartLabel === 0 ? '✅' : '❌'} 无图表: ${hasChartLabel === 0}`);

  // 最终结果
  const allPassed = !errorHasMock && !footerHasMock && footerHasNoData && !hasDoublePeriod && hasSuccessTitle === 0 && hasChartLabel === 0;
  console.log(`\n${allPassed ? '✅ 所有断言通过' : '❌ 部分断言失败'}`);

  await browser.close();

  if (!allPassed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ 截图脚本失败:', err);
  process.exit(1);
});
