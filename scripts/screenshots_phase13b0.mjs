// K-Ray 第十三阶段 B0 截图脚本（个人搜索服务设置入口）
//
// 生成截图：
//   01-phase13b0-settings-modal.png  普通用户视角：首页顶部入口已打开设置弹窗，
//                                     画面清楚显示"当前版本仅支持 Mock 演示候选，尚未接入真实搜索"
//
// 截图保护策略：
//   - 所有截图先输出到临时目录 screenshots_phase13b0/.tmp
//   - 全部场景断言成功后，才将临时目录内容整体替换到正式目录
//   - 失败时保留上一轮已存在的有效截图

import { chromium } from 'playwright';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const SCREENSHOTS_DIR = path.join(PROJECT_ROOT, '..', 'screenshots_phase13b0');
const TMP_DIR = path.join(SCREENSHOTS_DIR, '.tmp');
// 优先复用已在端口 3000 运行的 dev 服务器；若未运行则自启新实例
const EXISTING_PORT = 3000;
const NEW_PORT = 3015;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 轮询检查服务器是否可访问
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

// 等待服务器就绪（最多等 60 秒）
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
    console.log(`\n🚀 启动服务器（端口 ${port}，Mock 模式）...`);
    const server = spawn('npm', ['run', 'dev', '--', '-p', String(port)], {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        MARKET_DATA_MODE: 'mock',
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

// 截图输出到临时目录
async function takeScreenshot(page, filename, description) {
  const filePath = path.join(TMP_DIR, filename);
  await page.screenshot({ path: filePath, fullPage: true });
  const stat = fs.statSync(filePath);
  console.log(`  📸 ${description}: ${filename} (${(stat.size / 1024).toFixed(1)} KB)`);
  return filePath;
}

// 断言设置弹窗已打开并显示 Mock-only 提示
async function assertSettingsModalWithMockOnlyNotice(page) {
  const errors = [];

  // 弹窗应可见
  const modal = page.getByTestId('personal-search-settings-modal');
  const modalVisible = await modal.isVisible().catch(() => false);
  if (!modalVisible) {
    errors.push('设置弹窗必须可见');
    return errors;
  }

  // Mock-only 提示应可见
  const mockOnlyNotice = page.getByTestId('personal-search-mock-only-notice');
  const noticeVisible = await mockOnlyNotice.isVisible().catch(() => false);
  if (!noticeVisible) {
    errors.push('弹窗必须显示 Mock-only 提示区块');
  }

  // 弹窗文本必须包含"当前版本仅支持 Mock 演示候选，尚未接入真实搜索"
  const modalText = await modal.textContent();
  if (!modalText || !modalText.includes('当前版本仅支持 Mock 演示候选，尚未接入真实搜索')) {
    errors.push('弹窗必须清楚显示"当前版本仅支持 Mock 演示候选，尚未接入真实搜索"');
  }

  // 弹窗文本必须包含"真实搜索尚未在当前版本开放"
  if (!modalText || !modalText.includes('真实搜索尚未在当前版本开放')) {
    errors.push('弹窗必须显示"真实搜索尚未在当前版本开放"');
  }

  // 普通用户视角：不应显示开发面板
  const devPanel = page.getByText('🛠 开发模式');
  const devPanelVisible = await devPanel.isVisible().catch(() => false);
  if (devPanelVisible) {
    errors.push('普通用户视角不应显示开发面板');
  }

  return errors;
}

// 截图保护策略
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
  console.log('  K-Ray 第十三阶段 B0 截图（个人搜索服务设置）');
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

    // 检测是否已有 dev 服务器在端口 3000 运行
    const existingReady = await checkServerReady(EXISTING_PORT);
    let activePort;
    if (existingReady) {
      console.log(`\n✅ 检测到已有 dev 服务器运行在端口 ${EXISTING_PORT}，直接复用`);
      activePort = EXISTING_PORT;
    } else {
      server = await startServer(NEW_PORT);
      activePort = NEW_PORT;
    }

    // ========== 截图1：普通用户视角 — 首页顶部入口已打开设置弹窗 ==========
    console.log('\n--- 截图1：普通用户视角 — 首页顶部入口已打开设置弹窗 ---');
    try {
      const page = await browser.newPage();
      await page.goto(`http://localhost:${activePort}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(2500);

      // 点击首页顶部的"个人搜索服务设置"入口
      const entryBtn = page.getByTestId('personal-search-settings-entry');
      await entryBtn.waitFor({ state: 'visible', timeout: 10000 });
      await entryBtn.click();
      await sleep(800);

      // 等待弹窗可见
      await page.getByTestId('personal-search-settings-modal').waitFor({ state: 'visible', timeout: 10000 });

      const errors = await assertSettingsModalWithMockOnlyNotice(page);
      if (errors.length > 0) {
        console.error('  ❌ 截图1断言失败:');
        errors.forEach(e => console.error(`     - ${e}`));
        hasFailure = true;
      } else {
        await takeScreenshot(page, '01-phase13b0-settings-modal.png', '普通用户视角：设置弹窗显示 Mock-only 提示');
        screenshotResults.push('01-phase13b0-settings-modal.png');
      }
    } catch (err) {
      console.error(`  ❌ 截图1失败：${err.message}`);
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
