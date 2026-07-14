// K-Ray 第十二阶段 A 截图脚本（用户复盘笔记）
//
// 生成截图：
//   01-phase12a-empty-note.png        无笔记空状态（暂无复盘笔记）
//   02-phase12a-add-note.png          新增笔记表单（textarea）
//   03-phase12a-edit-note.png         编辑笔记（已有笔记，点击编辑后显示表单）
//   04-phase12a-delete-confirm.png    删除确认（点击删除后显示确认对话框）
//   05-phase12a-mobile.png            移动端视图（375x812，显示笔记卡片）
//
// 截图保护策略：
//   - 所有截图先输出到临时目录 screenshots_phase12a/.tmp
//   - 全部场景断言成功后，才将临时目录内容整体替换到正式目录
//   - 失败时保留上一轮已存在的有效截图

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const SCREENSHOTS_DIR = path.join(PROJECT_ROOT, '..', 'screenshots_phase12a');
const TMP_DIR = path.join(SCREENSHOTS_DIR, '.tmp');
const MOCK_PORT = 3013;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function startServer(port) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 启动服务器（端口 ${port}）...`);
    const server = spawn('npm', ['run', 'dev', '--', '-p', String(port)], {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        EVENT_NEWS_MODE: 'mock',
        NO_PROXY: 'localhost,127.0.0.1',
        no_proxy: 'localhost,127.0.0.1',
      },
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

// 截图输出到临时目录
async function takeScreenshot(page, filename, description) {
  const filePath = path.join(TMP_DIR, filename);
  await page.screenshot({ path: filePath, fullPage: true });
  const stat = fs.statSync(filePath);
  console.log(`  📸 ${description}: ${filename} (${(stat.size / 1024).toFixed(1)} KB)`);
  return filePath;
}

// 清空 localStorage 中的全部复盘笔记
async function clearReplayNotes(page) {
  await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('k-ray:replay-notes:'));
    keys.forEach(k => localStorage.removeItem(k));
  });
}

// 加载开发验收样本并打开第一个关键节点的抽屉，滚动到复盘笔记区域
async function loadDevSampleAndOpenDrawer(page) {
  await page.goto(`http://localhost:${MOCK_PORT}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2000);

  // 点击开发验收样本按钮
  const sampleBtn = page.getByTestId('dev-key-node-sample-with-nodes');
  await sampleBtn.click();
  await sleep(1500);

  // 等待关键节点列表可见
  await page.getByTestId('key-node-list').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('key-node-items').waitFor({ state: 'visible', timeout: 10000 });

  // 点击第一个关键节点项打开抽屉
  const firstItem = page.locator('[data-testid="key-node-items"] > *').first();
  await firstItem.click();
  await sleep(500);

  // 等待抽屉可见
  await page.getByTestId('node-event-drawer').waitFor({ state: 'visible', timeout: 10000 });

  // 等待笔记区域存在于 DOM 中
  await page.getByTestId('replay-note-section').waitFor({ state: 'attached', timeout: 10000 });

  // 滚动抽屉容器内部，使笔记区域可见
  await page.evaluate(() => {
    const drawer = document.querySelector('[data-testid="node-event-drawer"]');
    const noteSection = document.querySelector('[data-testid="replay-note-section"]');
    if (drawer && noteSection) {
      // 滚动抽屉到笔记区域
      drawer.scrollTop = noteSection.offsetTop - 100;
    }
  });
  await sleep(500);
}

// 断言空笔记状态
async function assertEmptyNote(page) {
  const errors = [];
  const section = page.getByTestId('replay-note-section');
  const sectionVisible = await section.isVisible().catch(() => false);
  if (!sectionVisible) {
    errors.push('空笔记截图必须显示复盘笔记区域');
  }
  const empty = page.getByTestId('replay-note-empty');
  const emptyVisible = await empty.isVisible().catch(() => false);
  if (!emptyVisible) {
    errors.push('空笔记截图必须显示空状态（暂无复盘笔记）');
  }
  const tip = page.getByTestId('replay-note-tip');
  const tipVisible = await tip.isVisible().catch(() => false);
  if (!tipVisible) {
    errors.push('空笔记截图必须显示固定提示');
  }
  return errors;
}

// 断言新增笔记表单
async function assertAddNoteForm(page) {
  const errors = [];
  const form = page.getByTestId('replay-note-form');
  const formVisible = await form.isVisible().catch(() => false);
  if (!formVisible) {
    errors.push('新增笔记截图必须显示表单');
  }
  const textarea = page.getByTestId('replay-note-textarea');
  const textareaVisible = await textarea.isVisible().catch(() => false);
  if (!textareaVisible) {
    errors.push('新增笔记截图必须显示文本输入框');
  }
  const saveBtn = page.getByTestId('replay-note-save-btn');
  const saveVisible = await saveBtn.isVisible().catch(() => false);
  if (!saveVisible) {
    errors.push('新增笔记截图必须显示保存按钮');
  }
  return errors;
}

// 断言编辑笔记
async function assertEditNote(page) {
  const errors = [];
  const form = page.getByTestId('replay-note-form');
  const formVisible = await form.isVisible().catch(() => false);
  if (!formVisible) {
    errors.push('编辑笔记截图必须显示表单');
    return errors;
  }
  // 验证 textarea 中已预填内容
  const textarea = page.getByTestId('replay-note-textarea');
  const textareaValue = await textarea.inputValue().catch(() => '');
  if (!textareaValue) {
    errors.push('编辑笔记截图文本输入框应已预填内容');
  }
  return errors;
}

// 断言删除确认
async function assertDeleteConfirm(page) {
  const errors = [];
  const dialog = page.getByTestId('replay-note-delete-confirm-dialog');
  const dialogVisible = await dialog.isVisible().catch(() => false);
  if (!dialogVisible) {
    errors.push('删除确认截图必须显示确认对话框');
  }
  const confirmBtn = page.getByTestId('replay-note-delete-confirm');
  const confirmVisible = await confirmBtn.isVisible().catch(() => false);
  if (!confirmVisible) {
    errors.push('删除确认截图必须显示确认删除按钮');
  }
  return errors;
}

// 断言移动端
async function assertMobile(page) {
  const errors = [];
  const section = page.getByTestId('replay-note-section');
  const sectionVisible = await section.isVisible().catch(() => false);
  if (!sectionVisible) {
    errors.push('移动端截图必须显示复盘笔记区域');
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
  console.log('  K-Ray 第十二阶段 A 截图（用户复盘笔记）');
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

    // ========== 截图1：无笔记空状态 ==========
    console.log('\n--- 截图1：无笔记空状态 ---');
    try {
      // 先清空全部复盘笔记，确保空状态
      await page.goto(`http://localhost:${MOCK_PORT}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(1000);
      await clearReplayNotes(page);

      // 加载样本并打开抽屉
      await loadDevSampleAndOpenDrawer(page);
      await sleep(500);

      const errors = await assertEmptyNote(page);
      if (errors.length > 0) {
        console.error('  ❌ 截图1断言失败:');
        errors.forEach(e => console.error(`     - ${e}`));
        hasFailure = true;
      } else {
        await takeScreenshot(page, '01-phase12a-empty-note.png', '无笔记空状态');
        screenshotResults.push('01-phase12a-empty-note.png');
      }
    } catch (err) {
      console.error(`  ❌ 截图1失败：${err.message}`);
      hasFailure = true;
    }

    // ========== 截图2：新增笔记表单 ==========
    console.log('\n--- 截图2：新增笔记表单 ---');
    try {
      // 滚动到笔记区域
      await page.evaluate(() => {
        const drawer = document.querySelector('[data-testid="node-event-drawer"]');
        const noteSection = document.querySelector('[data-testid="replay-note-section"]');
        if (drawer && noteSection) {
          drawer.scrollTop = noteSection.offsetTop - 100;
        }
      });
      await sleep(300);

      // 点击新增笔记按钮
      const addBtn = page.getByTestId('replay-note-add-btn');
      await addBtn.waitFor({ state: 'visible', timeout: 5000 });
      await addBtn.click();
      await sleep(500);

      // 等待表单可见
      await page.getByTestId('replay-note-form').waitFor({ state: 'visible', timeout: 5000 });

      // 在 textarea 中输入文本（不保存，仅截图）
      await page.getByTestId('replay-note-textarea').fill('业绩超预期，营收同比增长30%，关注后续毛利率变化趋势与主力资金流向。');
      await sleep(500);

      const errors = await assertAddNoteForm(page);
      if (errors.length > 0) {
        console.error('  ❌ 截图2断言失败:');
        errors.forEach(e => console.error(`     - ${e}`));
        hasFailure = true;
      } else {
        await takeScreenshot(page, '02-phase12a-add-note.png', '新增笔记表单');
        screenshotResults.push('02-phase12a-add-note.png');
      }

      // 保存笔记（为后续编辑、删除、移动端截图准备数据）
      await page.getByTestId('replay-note-save-btn').click();
      await sleep(500);

      // 等待笔记卡片可见，确认保存成功
      await page.getByTestId('replay-note-card').waitFor({ state: 'visible', timeout: 5000 });
    } catch (err) {
      console.error(`  ❌ 截图2失败：${err.message}`);
      hasFailure = true;
    }

    // ========== 截图3：编辑笔记 ==========
    console.log('\n--- 截图3：编辑笔记 ---');
    try {
      // 滚动到笔记卡片
      await page.evaluate(() => {
        const drawer = document.querySelector('[data-testid="node-event-drawer"]');
        const noteCard = document.querySelector('[data-testid="replay-note-card"]');
        if (drawer && noteCard) {
          drawer.scrollTop = noteCard.offsetTop - 100;
        }
      });
      await sleep(300);

      // 点击编辑按钮
      const editBtn = page.getByTestId('replay-note-edit-btn');
      await editBtn.waitFor({ state: 'visible', timeout: 5000 });
      await editBtn.click();
      await sleep(500);

      // 等待表单可见
      await page.getByTestId('replay-note-form').waitFor({ state: 'visible', timeout: 5000 });

      const errors = await assertEditNote(page);
      if (errors.length > 0) {
        console.error('  ❌ 截图3断言失败:');
        errors.forEach(e => console.error(`     - ${e}`));
        hasFailure = true;
      } else {
        await takeScreenshot(page, '03-phase12a-edit-note.png', '编辑笔记');
        screenshotResults.push('03-phase12a-edit-note.png');
      }

      // 取消编辑，保留原笔记
      await page.getByTestId('replay-note-cancel-btn').click();
      await sleep(500);
    } catch (err) {
      console.error(`  ❌ 截图3失败：${err.message}`);
      hasFailure = true;
    }

    // ========== 截图4：删除确认 ==========
    console.log('\n--- 截图4：删除确认 ---');
    try {
      // 滚动到笔记卡片
      await page.evaluate(() => {
        const drawer = document.querySelector('[data-testid="node-event-drawer"]');
        const noteCard = document.querySelector('[data-testid="replay-note-card"]');
        if (drawer && noteCard) {
          drawer.scrollTop = noteCard.offsetTop - 100;
        }
      });
      await sleep(300);

      // 点击删除按钮
      const deleteBtn = page.getByTestId('replay-note-delete-btn');
      await deleteBtn.waitFor({ state: 'visible', timeout: 5000 });
      await deleteBtn.click();
      await sleep(500);

      // 等待确认对话框可见
      await page.getByTestId('replay-note-delete-confirm-dialog').waitFor({ state: 'visible', timeout: 5000 });

      const errors = await assertDeleteConfirm(page);
      if (errors.length > 0) {
        console.error('  ❌ 截图4断言失败:');
        errors.forEach(e => console.error(`     - ${e}`));
        hasFailure = true;
      } else {
        await takeScreenshot(page, '04-phase12a-delete-confirm.png', '删除确认');
        screenshotResults.push('04-phase12a-delete-confirm.png');
      }

      // 取消删除，保留笔记用于移动端截图
      await page.getByTestId('replay-note-delete-cancel').click();
      await sleep(500);
    } catch (err) {
      console.error(`  ❌ 截图4失败：${err.message}`);
      hasFailure = true;
    }

    // ========== 截图5：移动端 ==========
    console.log('\n--- 截图5：移动端 ---');
    try {
      // 关闭抽屉（如已打开）
      const closeBtn = page.getByTestId('node-event-drawer-close');
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
        await sleep(500);
      }

      // 设置移动端视口
      await page.setViewportSize({ width: 375, height: 812 });
      await sleep(500);

      // 重新加载样本并打开抽屉（笔记数据保留在 localStorage 中）
      await loadDevSampleAndOpenDrawer(page);
      await sleep(500);

      const errors = await assertMobile(page);
      if (errors.length > 0) {
        console.error('  ❌ 截图5断言失败:');
        errors.forEach(e => console.error(`     - ${e}`));
        hasFailure = true;
      } else {
        await takeScreenshot(page, '05-phase12a-mobile.png', '移动端');
        screenshotResults.push('05-phase12a-mobile.png');
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
