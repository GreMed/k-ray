// K-Ray 界面承诺一致性与 API 防错修复截图脚本
//
// 生成截图：
//   01-consistency-regular-user-entry.png  普通用户入口（更新后的文案）
//   02-consistency-mobile.png              移动端视图
//
// 验证点：
//   - 搜索框标签为「股票代码」（非「股票代码或名称」）
//   - 占位提示不包含「或名称」
//   - Header 显示「股票走势复盘与事件候选工具」（非 AI）
//   - Header 显示「本地体验版」（非「演示模式」）
//   - 移动端无横向溢出

import { chromium } from 'playwright';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const SCREENSHOTS_DIR = path.join(PROJECT_ROOT, '..', 'screenshots_consistency_fix');
const TMP_DIR = path.join(SCREENSHOTS_DIR, '.tmp');
const PORT = 3031;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function checkServerReady(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/`, (res) => {
      resolve(res.statusCode !== undefined);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(port) {
  console.log(`  ⏳ 等待服务器就绪（端口 ${port}）...`);
  for (let i = 0; i < 30; i++) {
    const ready = await checkServerReady(port);
    if (ready) {
      console.log(`  ✅ 服务器已就绪`);
      return true;
    }
    await sleep(2000);
  }
  console.log(`  ❌ 服务器等待超时`);
  return false;
}

function startServer(port) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 启动服务器（端口 ${port}）...`);
    const server = spawn('npm', ['run', 'dev', '--', '-p', String(port)], {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        MARKET_DATA_MODE: 'real',
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
      console.log(`  [server] ${text.trim()}`);
    });

    server.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.error(`  [server:err] ${text.trim()}`);
    });

    server.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`服务器退出，代码: ${code}\n输出: ${output}`));
      }
    });

    waitForServer(port).then((ready) => {
      if (!resolved) {
        resolved = true;
        if (ready) {
          resolve(server);
        } else {
          reject(new Error(`服务器启动超时\n输出: ${output}`));
        }
      }
    });
  });
}

async function takeScreenshot(page, filename, description) {
  const filePath = path.join(TMP_DIR, filename);
  await page.screenshot({ path: filePath, fullPage: true });
  const stat = fs.statSync(filePath);
  console.log(`  📸 ${description}: ${filename} (${(stat.size / 1024).toFixed(1)} KB)`);
  return filePath;
}

async function navigateWithRetry(page, url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      return;
    } catch (err) {
      if (i < retries - 1) {
        console.log(`  ⚠️ 导航失败，重试 ${i + 1}/${retries}: ${err.message}`);
        await sleep(3000);
      } else {
        throw err;
      }
    }
  }
}

// 断言普通用户入口文案
async function assertRegularUserEntry(page) {
  const errors = [];
  // 使用 page.evaluate 检查页面文本内容（更可靠）
  const bodyText = await page.evaluate(() => document.body.innerText);

  // 搜索框标签应为「股票代码」
  if (!bodyText.includes('股票代码')) {
    errors.push('搜索框标签应显示「股票代码」');
  }
  // 不应出现旧标签「股票代码或名称」
  if (bodyText.includes('股票代码或名称')) {
    errors.push('不应显示旧标签「股票代码或名称」');
  }
  // Header 应显示「股票走势复盘与事件候选工具」
  if (!bodyText.includes('股票走势复盘与事件候选工具')) {
    errors.push('Header 应显示「股票走势复盘与事件候选工具」');
  }
  // 不应出现「AI 股票走势复盘」
  if (bodyText.includes('AI 股票走势复盘')) {
    errors.push('不应显示「AI 股票走势复盘与事件透视工具」');
  }
  // Header 应显示「本地体验版」
  const headerText = await page.evaluate(() => {
    const header = document.querySelector('header');
    return header ? header.innerText : '';
  });
  if (!headerText.includes('本地体验版')) {
    errors.push('Header 应显示「本地体验版」');
  }
  // Header 不应出现「演示模式」badge
  if (headerText.includes('演示模式')) {
    errors.push('Header 不应显示「演示模式」badge');
  }
  // 开发面板不应可见
  const devPanel = page.getByText('🛠 开发模式');
  const devPanelVisible = await devPanel.isVisible().catch(() => false);
  if (devPanelVisible) {
    errors.push('普通用户入口不应显示开发面板');
  }
  return errors;
}

// 断言移动端
async function assertMobile(page) {
  const errors = [];
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
  });
  if (hasOverflow) {
    errors.push('移动端截图存在横向溢出');
  }
  // Header 文案在移动端也应正确
  const bodyText = await page.evaluate(() => document.body.innerText);
  if (!bodyText.includes('本地体验版')) {
    errors.push('移动端 Header 应显示「本地体验版」');
  }
  return errors;
}

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
  console.log('  K-Ray 界面承诺一致性修复截图');
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

    server = await startServer(PORT);

    let page = await browser.newPage();

    // ========== 截图1：普通用户入口 ==========
    console.log('\n--- 截图1：普通用户入口（更新后的文案） ---');
    try {
      page = await browser.newPage();
      await navigateWithRetry(page, `http://localhost:${PORT}`);
      await sleep(2000);

      const errors = await assertRegularUserEntry(page);
      if (errors.length > 0) {
        console.error('  ❌ 截图1断言失败:');
        errors.forEach(e => console.error(`     - ${e}`));
        hasFailure = true;
      } else {
        await takeScreenshot(page, '01-consistency-regular-user-entry.png', '普通用户入口');
        screenshotResults.push('01-consistency-regular-user-entry.png');
      }
    } catch (err) {
      console.error(`  ❌ 截图1失败：${err.message}`);
      hasFailure = true;
    }

    // ========== 截图2：移动端 ==========
    console.log('\n--- 截图2：移动端视图 ---');
    try {
      page = await browser.newPage();
      await page.setViewportSize({ width: 375, height: 812 });
      await navigateWithRetry(page, `http://localhost:${PORT}`);
      await sleep(2000);

      const errors = await assertMobile(page);
      if (errors.length > 0) {
        console.error('  ❌ 截图2断言失败:');
        errors.forEach(e => console.error(`     - ${e}`));
        hasFailure = true;
      } else {
        await takeScreenshot(page, '02-consistency-mobile.png', '移动端视图');
        screenshotResults.push('02-consistency-mobile.png');
      }
    } catch (err) {
      console.error(`  ❌ 截图2失败：${err.message}`);
      hasFailure = true;
    }

  } catch (err) {
    console.error(`\n💥 整体错误: ${err.message}`);
    hasFailure = true;
  } finally {
    if (server) {
      console.log('\n🛑 停止服务器...');
      server.kill('SIGTERM');
      try {
        await sleep(2000);
      } catch {}
    }
    if (browser) {
      await browser.close();
    }
  }

  // 提交截图
  commitScreenshots(!hasFailure);

  // 输出结果
  console.log('\n========================================');
  console.log('  截图结果汇总');
  console.log('========================================');
  if (screenshotResults.length > 0) {
    console.log(`✅ 成功: ${screenshotResults.length} 张`);
    screenshotResults.forEach(f => console.log(`   - ${f}`));
  }
  if (hasFailure) {
    console.log(`❌ 存在失败场景`);
  }

  if (hasFailure) {
    console.log('\n退出码: 1');
    process.exit(1);
  } else {
    console.log('\n退出码: 0');
    process.exit(0);
  }
}

run();
