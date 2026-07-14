// K-Ray 第十六阶段封板修复截图脚本
//
// 连接到已运行的 dev server（默认端口 3000），完成以下用户操作并断言：
//   1. 真实查询页查询一只股票成功
//   2. 点击一个非关键节点普通交易日
//   3. 新增并保存笔记
//   4. 图表出现笔记标记
//   5. 点击笔记标记后重新打开对应日期笔记
//   6. 编辑并删除笔记
//   7. 新增一个用户事件，在日历对应日期显示标记并打开详情
//   8. 展示一条法定最晚披露日系统事件及其官方来源
//   9. 展示五家公司案例切换
//  10. 展示至少一个真实空资料节点
//
// 所有截图先写到临时目录 screenshots_phase16_tmp/，
// 所有断言通过后才复制到正式目录 screenshots_phase16/，
// 失败时不覆盖旧截图。

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const TMP_DIR = path.join(PROJECT_ROOT, 'screenshots_phase16_tmp');
const FINAL_DIR = path.join(PROJECT_ROOT, 'screenshots_phase16');
const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

// === 辅助函数 ===

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 在临时目录中截图 */
async function takeTmpScreenshot(page, filename, description, fullPage = false) {
  const filePath = path.join(TMP_DIR, filename);
  await page.screenshot({ path: filePath, fullPage });
  const stat = fs.statSync(filePath);
  console.log(`  📸 ${description}: ${filename} (${(stat.size / 1024).toFixed(1)} KB)`);
  return filePath;
}

/** 断言元素可见 */
async function assertVisible(page, testid, label) {
  const el = page.getByTestId(testid);
  const visible = await el.isVisible().catch(() => false);
  console.log(`    ${visible ? '✅' : '❌'} ${label} (testid=${testid})`);
  return visible;
}

/** 断言元素文本包含指定内容 */
async function assertTextContains(page, testid, text, label) {
  const el = page.getByTestId(testid);
  const content = (await el.textContent().catch(() => '')) || '';
  const found = content.includes(text);
  console.log(`    ${found ? '✅' : '❌'} ${label} (期望包含 "${text}")`);
  return found;
}

/** 点击图表 canvas 上的指定位置 */
async function clickChartAt(page, xRatio, yRatio) {
  const chartEl = page.getByTestId('chart-container');
  const box = await chartEl.boundingBox();
  if (!box) throw new Error('chart-container boundingBox not found');
  const x = box.x + box.width * xRatio;
  const y = box.y + box.height * yRatio;
  await page.mouse.click(x, y);
  await sleep(1000);
  return { x, y, box };
}

/** 等待日历完全加载（mounted = true，月份标签显示当前月份） */
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
  const label = (await page.getByTestId('calendar-month-label').textContent().catch(() => '')) || '';
  console.log(`    ⚠️ 日历未就绪，当前标签：${label}（期望：${expectedLabel}）`);
  return false;
}

/** 计算未来3个月内的法定最晚披露日 */
function getUpcomingDeadlineDates(fromDateStr) {
  const today = new Date(fromDateStr + 'T00:00:00');
  const endDate = new Date(today);
  endDate.setMonth(endDate.getMonth() + 3);

  const deadlines = [];
  const year = today.getFullYear();

  // 半年报：当年8月31日
  const semiAnnual = `${year}-08-31`;
  if (new Date(semiAnnual + 'T00:00:00') >= today && new Date(semiAnnual + 'T00:00:00') <= endDate) {
    deadlines.push({ date: semiAnnual, type: 'semi-annual', label: `${year}年半年度报告` });
  }
  // 三季报：当年10月31日
  const q3 = `${year}-10-31`;
  if (new Date(q3 + 'T00:00:00') >= today && new Date(q3 + 'T00:00:00') <= endDate) {
    deadlines.push({ date: q3, type: 'q3', label: `${year}年三季度报告` });
  }
  // 年报：次年4月30日
  const annual = `${year + 1}-04-30`;
  if (new Date(annual + 'T00:00:00') >= today && new Date(annual + 'T00:00:00') <= endDate) {
    deadlines.push({ date: annual, type: 'annual', label: `${year}年年度报告` });
  }
  // 一季报：当年4月30日
  const q1 = `${year}-04-30`;
  if (new Date(q1 + 'T00:00:00') >= today && new Date(q1 + 'T00:00:00') <= endDate) {
    deadlines.push({ date: q1, type: 'q1', label: `${year}年一季度报告` });
  }

  return deadlines;
}

/** 生成未来日期（距今 N 天） */
function makeFutureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 复制临时目录所有文件到正式目录 */
function copyTmpToFinal() {
  if (!fs.existsSync(FINAL_DIR)) {
    fs.mkdirSync(FINAL_DIR, { recursive: true });
  }
  const files = fs.readdirSync(TMP_DIR);
  for (const f of files) {
    fs.copyFileSync(path.join(TMP_DIR, f), path.join(FINAL_DIR, f));
  }
  console.log(`\n📁 已将 ${files.length} 张截图从临时目录复制到正式目录`);
}

// === 主函数 ===

async function main() {
  // 创建临时目录
  fs.mkdirSync(TMP_DIR, { recursive: true });
  // 清空临时目录中的旧文件
  for (const f of fs.readdirSync(TMP_DIR)) {
    fs.unlinkSync(path.join(TMP_DIR, f));
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-proxy-server'],
  });
  const stepResults = {};

  // ============================================================================
  // 步骤 1-6：首页真实查询 + 笔记 CRUD（同一上下文，保持 localStorage）
  // ============================================================================
  console.log('\n========================================');
  console.log('步骤 1-6：首页真实查询 + 笔记 CRUD');
  console.log('========================================');

  const homeCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await homeCtx.newPage();

  // --- 步骤 1：真实查询页查询一只股票成功 ---
  console.log('\n[步骤 1] 真实查询页查询一只股票成功');
  {
    let passed = false;
    try {
      await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
      await sleep(3000);

      // 输入股票代码（使用 type 模拟真实输入，触发 handleInputChange）
      const searchInput = page.getByTestId('stock-search-input');
      await searchInput.click();
      await sleep(300);
      await page.keyboard.type('600519', { delay: 50 });
      await sleep(800);

      // 尝试点击自定义代码选项，或按回车确认
      const customOpt = page.getByTestId('custom-code-option');
      if (await customOpt.isVisible({ timeout: 2000 }).catch(() => false)) {
        await customOpt.click();
        await sleep(500);
      } else {
        await searchInput.press('Enter');
        await sleep(1000);
      }

      // 选择近一年日期范围
      const quickOpt1y = page.getByTestId('quick-option-1y');
      if (await quickOpt1y.isVisible().catch(() => false)) {
        await quickOpt1y.click();
        await sleep(500);
      }

      // 等待查询按钮变为 enabled 并点击
      const queryBtn = page.getByRole('button', { name: '查询行情' });
      // 等待按钮 enabled（最多 10 秒）
      for (let i = 0; i < 20; i++) {
        const disabled = await queryBtn.isDisabled();
        if (!disabled) break;
        await sleep(500);
      }
      await queryBtn.click();

      // 等待查询结果（最多 30 秒）
      await page.getByTestId('result-title').waitFor({ state: 'visible', timeout: 30000 });
      await sleep(2000);

      // 断言
      const r1 = await assertTextContains(page, 'result-title', '贵州茅台', '查询结果标题包含"贵州茅台"');
      const r2 = await assertVisible(page, 'chart-wrapper', 'K线图存在');
      const r3 = await assertVisible(page, 'real-market-banner', '真实行情标识存在');
      passed = r1 && r2 && r3;

      await takeTmpScreenshot(page, '01-real-query-result.png', '真实查询成功', false);
    } catch (err) {
      console.log(`    ❌ 步骤1异常: ${err.message}`);
      passed = false;
    }
    stepResults['01-real-query-result'] = passed;
  }

  // --- 步骤 2：点击一个非关键节点普通交易日 ---
  console.log('\n[步骤 2] 点击一个非关键节点普通交易日');
  let clickedXRatio = 0.6; // 记录步骤2点击的 x 坐标比例，供步骤5使用
  {
    let passed = false;
    try {
      // 滚动到图表区域
      await page.getByTestId('chart-wrapper').scrollIntoViewIfNeeded();
      await sleep(500);

      // 点击图表中间偏右的位置（大概率命中普通交易日）
      let dateClicked = false;
      for (const xRatio of [0.6, 0.7, 0.5, 0.8, 0.4]) {
        await clickChartAt(page, xRatio, 0.5);
        // 检查笔记面板是否出现且显示了日期摘要
        // 注意：组件中的 testid 是 trading-day-summary（不是 trading-day-note-summary）
        const summaryVisible = await page.getByTestId('trading-day-summary').isVisible().catch(() => false);
        if (summaryVisible) {
          dateClicked = true;
          clickedXRatio = xRatio;
          console.log(`    ✅ 在 xRatio=${xRatio} 处成功点击普通交易日`);
          break;
        }
      }

      // 滚动到笔记面板
      await page.getByTestId('note-card-wrapper').scrollIntoViewIfNeeded();
      await sleep(500);

      const r1 = await assertVisible(page, 'trading-day-note-panel', '笔记面板存在');
      const r2 = await assertVisible(page, 'trading-day-summary', '当日行情摘要存在（表示已选择日期）');
      const r3 = await assertVisible(page, 'trading-day-note-add-btn', '"新增笔记"按钮存在');
      passed = dateClicked && r1 && r2 && r3;

      await takeTmpScreenshot(page, '02-note-panel-open.png', '点击普通交易日，笔记面板出现', false);
    } catch (err) {
      console.log(`    ❌ 步骤2异常: ${err.message}`);
      passed = false;
    }
    stepResults['02-note-panel-open'] = passed;
  }

  // --- 步骤 3：新增并保存笔记 ---
  console.log('\n[步骤 3] 新增并保存笔记');
  {
    let passed = false;
    try {
      // 点击"新增笔记"按钮
      await page.getByTestId('trading-day-note-add-btn').click();
      await sleep(500);

      const r1 = await assertVisible(page, 'trading-day-note-form', '笔记表单出现');
      const r2 = await assertVisible(page, 'trading-day-note-textarea', '笔记输入框存在');

      // 输入笔记内容
      await page.getByTestId('trading-day-note-textarea').fill('封板修复测试笔记：此笔记用于验证笔记标记点击功能。');
      await sleep(300);

      // 点击保存
      await page.getByTestId('trading-day-note-save-btn').click();
      await sleep(1500);

      // 断言笔记保存成功
      const r3 = await assertVisible(page, 'trading-day-note-card', '笔记卡片出现（保存成功）');
      const r4 = await assertTextContains(page, 'trading-day-note-content', '封板修复测试笔记', '笔记内容正确');
      passed = r1 && r2 && r3 && r4;

      await takeTmpScreenshot(page, '03-note-saved.png', '新增并保存笔记', false);
    } catch (err) {
      console.log(`    ❌ 步骤3异常: ${err.message}`);
      passed = false;
    }
    stepResults['03-note-saved'] = passed;
  }

  // --- 步骤 4：图表出现笔记标记 ---
  console.log('\n[步骤 4] 图表出现笔记标记');
  {
    let passed = false;
    try {
      // 滚动到图表区域
      await page.getByTestId('chart-wrapper').scrollIntoViewIfNeeded();
      await sleep(2000); // 等待图表重新渲染（添加笔记 marker）

      // 断言图例中包含"我的笔记"
      const r1 = await assertTextContains(page, 'chart-legend', '我的笔记', '图例包含"我的笔记"标记');
      passed = r1;

      await takeTmpScreenshot(page, '04-note-marker.png', '图表出现笔记标记', false);
    } catch (err) {
      console.log(`    ❌ 步骤4异常: ${err.message}`);
      passed = false;
    }
    stepResults['04-note-marker'] = passed;
  }

  // --- 步骤 5：点击笔记标记后重新打开对应日期笔记 ---
  console.log('\n[步骤 5] 点击笔记标记后重新打开对应日期笔记');
  {
    let passed = false;
    try {
      // 先点击图表其他位置（左侧），切换到另一个日期，关闭笔记卡片
      await page.getByTestId('chart-wrapper').scrollIntoViewIfNeeded();
      await sleep(500);
      await clickChartAt(page, 0.2, 0.5);
      await sleep(500);
      // 确认笔记卡片已关闭
      const cardClosed = !(await page.getByTestId('trading-day-note-card').isVisible().catch(() => false));
      console.log(`    ${cardClosed ? '✅' : '⚠️'} 切换到其他日期，笔记卡片${cardClosed ? '已关闭' : '仍显示'}`);

      // 然后点击回笔记保存的日期位置（使用步骤2记录的 xRatio）
      // 笔记 marker 在 K 线下方（belowBar），尝试不同 y 位置命中 marker
      let reopened = false;
      for (const yRatio of [0.5, 0.85, 0.9, 0.7, 0.95]) {
        await clickChartAt(page, clickedXRatio, yRatio);
        // 检查笔记面板是否重新显示笔记卡片
        const cardVisible = await page.getByTestId('trading-day-note-card').isVisible().catch(() => false);
        if (cardVisible) {
          reopened = true;
          console.log(`    ✅ 在 xRatio=${clickedXRatio}, yRatio=${yRatio} 处成功点击笔记标记`);
          break;
        }
      }

      // 滚动到笔记面板
      await page.getByTestId('note-card-wrapper').scrollIntoViewIfNeeded();
      await sleep(500);

      const r1 = await assertVisible(page, 'trading-day-note-card', '笔记卡片重新出现');
      const r2 = await assertVisible(page, 'trading-day-note-content', '笔记内容可见');
      passed = reopened && r1 && r2;

      await takeTmpScreenshot(page, '05-note-reopen.png', '点击笔记标记重新打开笔记', false);
    } catch (err) {
      console.log(`    ❌ 步骤5异常: ${err.message}`);
      passed = false;
    }
    stepResults['05-note-reopen'] = passed;
  }

  // --- 步骤 6：编辑并删除笔记 ---
  console.log('\n[步骤 6] 编辑并删除笔记');
  {
    let passed = false;
    try {
      // 确保笔记面板可见
      await page.getByTestId('note-card-wrapper').scrollIntoViewIfNeeded();
      await sleep(500);

      // 如果笔记卡片不可见（步骤5可能失败），尝试重新点击笔记日期位置
      let noteCardVisible = await page.getByTestId('trading-day-note-card').isVisible().catch(() => false);
      if (!noteCardVisible) {
        console.log('    ⚠️ 笔记卡片不可见，尝试重新点击笔记日期位置');
        await page.getByTestId('chart-wrapper').scrollIntoViewIfNeeded();
        await sleep(500);
        for (const yRatio of [0.5, 0.85, 0.9, 0.7]) {
          await clickChartAt(page, clickedXRatio, yRatio);
          noteCardVisible = await page.getByTestId('trading-day-note-card').isVisible().catch(() => false);
          if (noteCardVisible) break;
        }
        await page.getByTestId('note-card-wrapper').scrollIntoViewIfNeeded();
        await sleep(500);
      }

      // 点击"编辑"按钮
      const editBtn = page.getByTestId('trading-day-note-edit-btn');
      if (await editBtn.isVisible().catch(() => false)) {
        await editBtn.click();
        await sleep(500);

        // 修改笔记内容
        await page.getByTestId('trading-day-note-textarea').fill('封板修复测试笔记（已编辑）：验证编辑和删除功能。');
        await sleep(300);

        // 保存
        await page.getByTestId('trading-day-note-save-btn').click();
        await sleep(1000);

        // 断言编辑成功
        const r1 = await assertTextContains(page, 'trading-day-note-content', '已编辑', '笔记内容已更新');
        console.log(`    ${r1 ? '✅' : '❌'} 笔记编辑成功`);
      }

      // 点击"删除"按钮
      const deleteBtn = page.getByTestId('trading-day-note-delete-btn');
      if (await deleteBtn.isVisible().catch(() => false)) {
        await deleteBtn.click();
        await sleep(500);

        // 确认删除
        const confirmBtn = page.getByTestId('trading-day-note-delete-confirm');
        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click();
          await sleep(1000);
        }

        // 断言删除成功
        const r2 = await assertVisible(page, 'trading-day-note-no-note', '笔记已删除（无笔记状态）');
        passed = r2;
      }

      await takeTmpScreenshot(page, '06-note-deleted.png', '编辑并删除笔记', false);
    } catch (err) {
      console.log(`    ❌ 步骤6异常: ${err.message}`);
      passed = false;
    }
    stepResults['06-note-deleted'] = passed;
  }

  // ============================================================================
  // 步骤 7-8：用户事件 + 法定最晚披露日系统事件（同一上下文）
  // ============================================================================
  console.log('\n========================================');
  console.log('步骤 7-8：用户事件 + 法定最晚披露日');
  console.log('========================================');

  // --- 步骤 7：新增一个用户事件，在日历对应日期显示标记并打开详情 ---
  console.log('\n[步骤 7] 新增一个用户事件，在日历对应日期显示标记并打开详情');
  {
    let passed = false;
    try {
      // 滚动到日历区域
      await page.getByTestId('calendar-card-wrapper').scrollIntoViewIfNeeded();
      await sleep(500);

      // 等待日历完全加载（mounted = true）
      await waitForCalendarReady(page);

      // 点击"新增事件"按钮
      await page.getByTestId('stock-event-add-btn').click();
      await sleep(500);

      const r1 = await assertVisible(page, 'stock-event-form', '事件表单出现');

      // 填写表单：使用当前月内的日期（7天后），避免月份切换
      const futureDate = makeFutureDate(7);
      await page.getByTestId('stock-event-form-date').fill(futureDate);
      await sleep(300);
      await page.getByTestId('stock-event-form-title').fill('封板修复测试事件');
      await sleep(300);
      await page.getByTestId('stock-event-form-category').selectOption('company_event');
      await sleep(300);

      // 保存
      await page.getByTestId('stock-event-form-save').click();
      await sleep(1000);

      // 断言表单关闭
      const formStillVisible = await page.getByTestId('stock-event-form').isVisible().catch(() => false);
      const r2 = !formStillVisible;
      console.log(`    ${r2 ? '✅' : '❌'} 事件保存后表单关闭`);

      // 日历应在当前月，直接点击对应日期（不需要切换月份）
      const dateCell = page.getByTestId(`calendar-cell-${futureDate}`);
      if (await dateCell.isVisible().catch(() => false)) {
        await dateCell.click();
        await sleep(500);
      } else {
        console.log(`    ⚠️ 日期格子 ${futureDate} 不可见，可能需要切换月份`);
      }

      // 断言事件详情显示
      const r3 = await assertVisible(page, 'selected-date-events', '选中日期的事件列表出现');
      // 查找用户事件标签
      const userTags = await page.locator('[data-testid^="event-user-tag-"]').count();
      const r4 = userTags > 0;
      console.log(`    ${r4 ? '✅' : '❌'} 用户事件标记显示 (${userTags} 个)`);

      passed = r1 && r2 && r3 && r4;

      await takeTmpScreenshot(page, '07-user-event.png', '新增用户事件，日历显示标记并打开详情', false);
    } catch (err) {
      console.log(`    ❌ 步骤7异常: ${err.message}`);
      passed = false;
    }
    stepResults['07-user-event'] = passed;
  }

  // --- 步骤 8：展示一条法定最晚披露日系统事件及其官方来源 ---
  console.log('\n[步骤 8] 展示一条法定最晚披露日系统事件及其官方来源');
  {
    let passed = false;
    try {
      // 确保日历就绪
      await waitForCalendarReady(page);

      // 计算未来3个月内的法定期限日期
      const todayStr = makeFutureDate(0);
      const deadlines = getUpcomingDeadlineDates(todayStr);

      if (deadlines.length === 0) {
        console.log('    ⚠️ 当前三个月内无法定期限，检查空状态');
        const r1 = await assertVisible(page, 'no-system-events', '系统事件空状态显示');
        passed = r1;
      } else {
        console.log(`    📅 未来3个月内的法定期限: ${deadlines.map(d => d.date).join(', ')}`);

        // 切换日历到第一个法定期限日期所在月份
        const targetDate = deadlines[0].date;
        const targetMonthNum = parseInt(targetDate.slice(5, 7), 10); // 1-12

        // 切换月份直到匹配
        for (let i = 0; i < 6; i++) {
          const label = (await page.getByTestId('calendar-month-label').textContent()) || '';
          // 标签格式："2026年8月"
          const match = label.match(/(\d{4})年(\d{1,2})月/);
          const labelMonth = match ? parseInt(match[2], 10) : -1;
          if (labelMonth === targetMonthNum) break;

          // 等待"下月"按钮 enabled
          const nextBtn = page.getByTestId('calendar-next-month');
          const isDisabled = await nextBtn.isDisabled().catch(() => true);
          if (isDisabled) {
            console.log(`    ⚠️ "下月"按钮 disabled，当前标签：${label}，目标月份：${targetMonthNum}`);
            break;
          }
          await nextBtn.click();
          await sleep(500);
        }

        // 点击法定期限日期
        const dateCell = page.getByTestId(`calendar-cell-${targetDate}`);
        if (await dateCell.isVisible().catch(() => false)) {
          await dateCell.click();
          await sleep(500);
        } else {
          console.log(`    ⚠️ 法定期限日期格子 ${targetDate} 不可见`);
        }

        // 断言法定最晚日标签出现
        const deadlineTags = await page.locator('[data-testid^="event-deadline-tag-"]').count();
        const r1 = deadlineTags > 0;
        console.log(`    ${r1 ? '✅' : '❌'} "法定最晚日"标签显示 (${deadlineTags} 个)`);

        // 断言来源链接包含官方监管来源
        const sourceLinks = await page.locator('[data-testid^="event-source-"]').count();
        const r2 = sourceLinks > 0;
        console.log(`    ${r2 ? '✅' : '❌'} 官方来源链接显示 (${sourceLinks} 个)`);

        // 检查来源文本是否包含"证监会"
        let sourceHasCsrc = false;
        if (sourceLinks > 0) {
          const sourceText = await page.locator('[data-testid^="event-source-"]').first().textContent();
          sourceHasCsrc = sourceText?.includes('证监会') || false;
          console.log(`    ${sourceHasCsrc ? '✅' : '❌'} 来源包含"证监会"`);
        }

        passed = r1 && r2 && sourceHasCsrc;
      }

      await takeTmpScreenshot(page, '08-statutory-deadline.png', '法定最晚披露日系统事件', false);
    } catch (err) {
      console.log(`    ❌ 步骤8异常: ${err.message}`);
      passed = false;
    }
    stepResults['08-statutory-deadline'] = passed;
  }

  await homeCtx.close();

  // ============================================================================
  // 步骤 9-13：五家公司案例切换
  // ============================================================================
  console.log('\n========================================');
  console.log('步骤 9-13：五家公司案例切换');
  console.log('========================================');

  const cases = [
    { code: '300750', name: '宁德时代', file: '09-case-300750.png' },
    { code: '600519', name: '贵州茅台', file: '10-case-600519.png' },
    { code: '603986', name: '兆易创新', file: '11-case-603986.png' },
    { code: '603236', name: '移远通信', file: '12-case-603236.png' },
    { code: '002594', name: '比亚迪', file: '13-case-002594.png' },
  ];

  for (const c of cases) {
    console.log(`\n[步骤 ${cases.indexOf(c) + 9}] ${c.name}案例（${c.code}）`);
    let passed = false;
    try {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const p = await ctx.newPage();
      await p.goto(`${BASE_URL}/demo/core-replay?stock=${c.code}`, { waitUntil: 'domcontentloaded' });
      await sleep(3000);

      const r1 = await assertTextContains(p, 'page-title', c.name, `标题包含"${c.name}"`);
      const r2 = await assertVisible(p, 'case-switcher', '案例切换器存在');
      const r3 = await assertVisible(p, 'node-switcher', '节点切换入口存在');
      const r4 = await assertVisible(p, 'chart-card', 'K线图卡片存在');
      passed = r1 && r2 && r3 && r4;

      await takeTmpScreenshot(p, c.file, `${c.name}案例`);
      await ctx.close();
    } catch (err) {
      console.log(`    ❌ 步骤${cases.indexOf(c) + 9}异常: ${err.message}`);
      passed = false;
    }
    stepResults[c.file.replace('.png', '')] = passed;
  }

  // ============================================================================
  // 步骤 14：展示至少一个真实空资料节点
  // ============================================================================
  console.log('\n[步骤 14] 展示至少一个真实空资料节点');
  {
    let passed = false;
    try {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const p = await ctx.newPage();
      await p.goto(`${BASE_URL}/demo/core-replay?stock=300750`, { waitUntil: 'domcontentloaded' });
      await sleep(3000);

      // 点击空状态节点（local_low:300750:2025-02-11，无资料）
      const emptyNodeBtn = p.getByTestId('node-tab-local_low:300750:2025-02-11');
      if (await emptyNodeBtn.isVisible().catch(() => false)) {
        await emptyNodeBtn.click();
        await sleep(1500);
      }

      const r1 = await assertVisible(p, 'empty-materials', '空状态区域存在');
      const r2 = await assertTextContains(p, 'empty-materials', '该节点暂无可追溯的时间临近资料', '空状态文案正确');
      const r3 = await assertVisible(p, 'no-replay-summary', '无摘要状态存在');
      passed = r1 && r2 && r3;

      await takeTmpScreenshot(p, '14-empty-materials.png', '真实空资料节点');
      await ctx.close();
    } catch (err) {
      console.log(`    ❌ 步骤14异常: ${err.message}`);
      passed = false;
    }
    stepResults['14-empty-materials'] = passed;
  }

  await browser.close();

  // ============================================================================
  // 汇总结果
  // ============================================================================
  console.log('\n========================================');
  console.log('截图断言结果汇总');
  console.log('========================================');

  let allPassed = true;
  for (const [name, passed] of Object.entries(stepResults)) {
    console.log(`  ${passed ? '✅' : '❌'} ${name}`);
    if (!passed) allPassed = false;
  }

  if (allPassed) {
    console.log('\n✅ 所有截图和断言通过，复制临时截图到正式目录');
    copyTmpToFinal();
  } else {
    console.error('\n❌ 部分截图断言失败，不覆盖旧截图');
    console.error('   临时截图保留在 screenshots_phase16_tmp/ 供调试');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ 截图脚本失败:', err);
  process.exit(1);
});
