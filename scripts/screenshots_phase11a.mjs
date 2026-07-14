// K-Ray 第十一阶段 A 截图脚本（用户维护的未来事件日历）
//
// 生成截图：
//   01-phase11a-empty-calendar.png      空日历（无用户事件）
//   02-phase11a-add-event.png           新增事件表单
//   03-phase11a-edit-event.png          编辑事件
//   04-phase11a-delete-confirm.png      删除确认弹窗
//   05-phase11a-mobile.png              移动端
//
// 截图保护策略：
//   - 所有截图先输出到临时目录 screenshots_phase11a/.tmp
//   - 全部场景断言成功后，才将临时目录内容整体替换到正式目录
//   - 失败时保留上一轮已存在的有效截图

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const SCREENSHOTS_DIR = path.join(PROJECT_ROOT, '..', 'screenshots_phase11a');
const TMP_DIR = path.join(SCREENSHOTS_DIR, '.tmp');
const MOCK_PORT = 3020;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function startServer(port) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 启动服务器（端口 ${port}）...`);
    const server = spawn('npm', ['run', 'dev', '--', '-p', String(port)], {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, EVENT_NEWS_MODE: 'mock' },
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
        reject(new Error(`服务器退出，代码: ${code}\n输出: ${output}`));
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

async function takeScreenshot(page, filename, description) {
  const filePath = path.join(TMP_DIR, filename);
  await page.screenshot({ path: filePath, fullPage: true });
  const stat = fs.statSync(filePath);
  console.log(`  📸 ${description}: ${filename} (${(stat.size / 1024).toFixed(1)} KB)`);
  return filePath;
}

// 加载开发验收样本
async function loadDevSample(page) {
  await page.goto(`http://localhost:${MOCK_PORT}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2000);

  // 清空 localStorage 中的用户事件
  await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('k-ray:user-future-events:'));
    keys.forEach(k => localStorage.removeItem(k));
  });

  // 点击开发验收样本按钮
  const sampleBtn = page.getByTestId('dev-key-node-sample-with-nodes');
  await sampleBtn.click();
  await sleep(1500);

  // 等待用户未来事件日历可见
  await page.getByTestId('user-future-calendar').waitFor({ state: 'visible', timeout: 10000 });
}

// 断言空日历
async function assertEmptyCalendar(page) {
  const errors = [];
  const empty = page.getByTestId('user-future-calendar-empty');
  const emptyVisible = await empty.isVisible().catch(() => false);
  if (!emptyVisible) {
    errors.push('空日历截图必须显示空状态');
  }
  const tip = page.getByTestId('user-future-calendar-tip');
  const tipVisible = await tip.isVisible().catch(() => false);
  if (!tipVisible) {
    errors.push('空日历截图必须显示固定提示');
  }
  return errors;
}

// 断言新增事件表单
async function assertAddEventForm(page) {
  const errors = [];
  const form = page.getByTestId('user-event-form');
  const formVisible = await form.isVisible().catch(() => false);
  if (!formVisible) {
    errors.push('新增事件截图必须显示表单');
  }
  const dateInput = page.getByTestId('user-event-form-date');
  const dateVisible = await dateInput.isVisible().catch(() => false);
  if (!dateVisible) {
    errors.push('新增事件截图必须显示日期输入');
  }
  const titleInput = page.getByTestId('user-event-form-title');
  const titleVisible = await titleInput.isVisible().catch(() => false);
  if (!titleVisible) {
    errors.push('新增事件截图必须显示标题输入');
  }
  return errors;
}

// 断言编辑事件
async function assertEditEvent(page) {
  const errors = [];
  const form = page.getByTestId('user-event-form');
  const formVisible = await form.isVisible().catch(() => false);
  if (!formVisible) {
    errors.push('编辑事件截图必须显示表单');
    return errors;
  }
  // 验证表单标题为"编辑未来事件"
  const formText = await form.textContent();
  if (!formText || !formText.includes('编辑未来事件')) {
    errors.push('编辑事件截图表单标题应为"编辑未来事件"');
  }
  // 验证表单已预填数据
  const titleInput = page.getByTestId('user-event-form-title');
  const titleValue = await titleInput.inputValue();
  if (!titleValue) {
    errors.push('编辑事件截图标题应已预填');
  }
  return errors;
}

// 断言删除确认弹窗
async function assertDeleteConfirm(page) {
  const errors = [];
  const dialog = page.getByTestId('user-event-delete-dialog');
  const dialogVisible = await dialog.isVisible().catch(() => false);
  if (!dialogVisible) {
    errors.push('删除确认截图必须显示确认弹窗');
  }
  const confirmBtn = page.getByTestId('user-event-delete-confirm');
  const confirmVisible = await confirmBtn.isVisible().catch(() => false);
  if (!confirmVisible) {
    errors.push('删除确认截图必须显示删除按钮');
  }
  const cancelBtn = page.getByTestId('user-event-delete-cancel');
  const cancelVisible = await cancelBtn.isVisible().catch(() => false);
  if (!cancelVisible) {
    errors.push('删除确认截图必须显示取消按钮');
  }
  return errors;
}

// 断言移动端
async function assertMobile(page) {
  const errors = [];
  const calendar = page.getByTestId('user-future-calendar');
  const calendarVisible = await calendar.isVisible().catch(() => false);
  if (!calendarVisible) {
    errors.push('移动端截图必须显示用户未来事件日历');
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

// 截图保护策略：将临时目录的截图整体替换到正式目录
function commitScreenshots(allSuccess) {
  if (!allSuccess) {
    console.log('\n🔒 存在失败场景，保留上一轮已存在的正式截图，不替换');
    if (fs.existsSync(TMP_DIR)) {
      const tmpFiles = fs.readdirSync(TMP_DIR).filter(f => f.endsWith('.png'));
      for (const f of tmpFiles) {
        fs.unlinkSync(path.join(TMP_DIR, f));
      }
    }
    return;
  }

  console.log('\n📦 全部场景断言通过，将临时截图整体替换到正式目录...');

  if (fs.existsSync(SCREENSHOTS_DIR)) {
    const oldFiles = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png'));
    for (const f of oldFiles) {
      fs.unlinkSync(path.join(SCREENSHOTS_DIR, f));
    }
  } else {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

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
  console.log('  K-Ray 第十一阶段 A 截图（用户维护的未来事件日历）');
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

  let server = null;
  let browser = null;
  let hasFailure = false;
  const screenshotResults = [];

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-proxy-server'],
    });
    console.log('\n✅ Playwright 浏览器启动成功（已禁用代理）');

    server = await startServer(MOCK_PORT);

    let page = await browser.newPage();

    // ========== 截图1：空日历 ==========
    console.log('\n--- 截图1：空日历 ---');
    try {
      await loadDevSample(page);
      await sleep(500);

      const errors = await assertEmptyCalendar(page);
      if (errors.length > 0) {
        console.error('  ❌ 截图1断言失败:');
        errors.forEach(e => console.error(`     - ${e}`));
        hasFailure = true;
      } else {
        await takeScreenshot(page, '01-phase11a-empty-calendar.png', '空日历');
        screenshotResults.push('01-phase11a-empty-calendar.png');
      }
    } catch (err) {
      console.error(`  ❌ 截图1失败：${err.message}`);
      hasFailure = true;
    }

    // ========== 截图2：新增事件表单 ==========
    console.log('\n--- 截图2：新增事件表单 ---');
    try {
      // 点击新增事件按钮
      const addBtn = page.getByTestId('user-event-add-btn');
      await addBtn.click();
      await sleep(500);

      // 等待表单可见
      await page.getByTestId('user-event-form').waitFor({ state: 'visible', timeout: 5000 });

      // 填写表单数据（不保存，仅截图）
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const dateStr = futureDate.toISOString().slice(0, 10);

      await page.getByTestId('user-event-form-date').fill(dateStr);
      await page.getByTestId('user-event-form-title').fill('2024年三季度业绩预告');
      await page.getByTestId('user-event-form-category').selectOption('performance');
      await page.getByTestId('user-event-form-url').fill('https://example.com/earnings');
      await page.getByTestId('user-event-form-note').fill('关注营收增速与毛利率变化');
      await sleep(500);

      const errors = await assertAddEventForm(page);
      if (errors.length > 0) {
        console.error('  ❌ 截图2断言失败:');
        errors.forEach(e => console.error(`     - ${e}`));
        hasFailure = true;
      } else {
        await takeScreenshot(page, '02-phase11a-add-event.png', '新增事件表单');
        screenshotResults.push('02-phase11a-add-event.png');
      }

      // 保存事件（为后续截图准备数据）
      await page.getByTestId('user-event-form-save').click();
      await sleep(500);
    } catch (err) {
      console.error(`  ❌ 截图2失败：${err.message}`);
      hasFailure = true;
    }

    // ========== 截图3：编辑事件 ==========
    console.log('\n--- 截图3：编辑事件 ---');
    try {
      // 等待事件列表渲染
      await page.getByTestId('user-future-calendar-list').waitFor({ state: 'visible', timeout: 5000 });

      // 点击第一个事件的编辑按钮
      const editBtn = page.locator('[data-testid^="user-event-edit-"]').first();
      await editBtn.click();
      await sleep(500);

      // 等待表单可见
      await page.getByTestId('user-event-form').waitFor({ state: 'visible', timeout: 5000 });

      // 修改标题
      await page.getByTestId('user-event-form-title').fill('2024年三季度业绩预告（已更新）');
      await sleep(500);

      const errors = await assertEditEvent(page);
      if (errors.length > 0) {
        console.error('  ❌ 截图3断言失败:');
        errors.forEach(e => console.error(`     - ${e}`));
        hasFailure = true;
      } else {
        await takeScreenshot(page, '03-phase11a-edit-event.png', '编辑事件');
        screenshotResults.push('03-phase11a-edit-event.png');
      }

      // 取消编辑
      await page.getByTestId('user-event-form-cancel').click();
      await sleep(500);
    } catch (err) {
      console.error(`  ❌ 截图3失败：${err.message}`);
      hasFailure = true;
    }

    // ========== 截图4：删除确认 ==========
    console.log('\n--- 截图4：删除确认弹窗 ---');
    try {
      // 点击第一个事件的删除按钮
      const deleteBtn = page.locator('[data-testid^="user-event-delete-"]').first();
      await deleteBtn.click();
      await sleep(500);

      // 等待确认弹窗可见
      await page.getByTestId('user-event-delete-dialog').waitFor({ state: 'visible', timeout: 5000 });

      const errors = await assertDeleteConfirm(page);
      if (errors.length > 0) {
        console.error('  ❌ 截图4断言失败:');
        errors.forEach(e => console.error(`     - ${e}`));
        hasFailure = true;
      } else {
        await takeScreenshot(page, '04-phase11a-delete-confirm.png', '删除确认弹窗');
        screenshotResults.push('04-phase11a-delete-confirm.png');
      }

      // 取消删除
      await page.getByTestId('user-event-delete-cancel').click();
      await sleep(500);
    } catch (err) {
      console.error(`  ❌ 截图4失败：${err.message}`);
      hasFailure = true;
    }

    // ========== 截图5：移动端 ==========
    console.log('\n--- 截图5：移动端 ---');
    try {
      // 设置移动端视口
      await page.setViewportSize({ width: 375, height: 812 });
      await sleep(500);

      // 滚动到用户未来事件日历
      await page.getByTestId('user-future-calendar').scrollIntoViewIfNeeded();
      await sleep(500);

      const errors = await assertMobile(page);
      if (errors.length > 0) {
        console.error('  ❌ 截图5断言失败:');
        errors.forEach(e => console.error(`     - ${e}`));
        hasFailure = true;
      } else {
        await takeScreenshot(page, '05-phase11a-mobile.png', '移动端');
        screenshotResults.push('05-phase11a-mobile.png');
      }

      // 恢复桌面视口
      await page.setViewportSize({ width: 1280, height: 800 });
    } catch (err) {
      console.error(`  ❌ 截图5失败：${err.message}`);
      hasFailure = true;
      await page.setViewportSize({ width: 1280, height: 800 }).catch(() => {});
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
    commitScreenshots(false);
  } finally {
    if (browser) await browser.close();
    if (server) server.kill('SIGTERM');
    await sleep(2000);
  }
}

run();
