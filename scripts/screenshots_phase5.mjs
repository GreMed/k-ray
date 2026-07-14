// K-Ray 第五阶段截图脚本（严格断言版）
// 使用方法：node scripts/screenshots_phase5.mjs
//
// 严格规则：
// - 找不到按钮、目标状态或关键文案时立即 throw
// - 禁止 catch 后只打印警告继续保存截图
// - 每张截图保存前必须断言目标元素存在且可见
// - 单独使用 screenshots_phase5 目录
//
// 生成6张截图：
//   01-full-flow-result.png    完整复盘结果
//   02-all-detail-panels.png   所有详情面板（2x2拼接验收图）
//   03-empty-state.png         空状态
//   04-error-and-retry.png     错误状态和重试
//   05-mobile-complete-flow.png 移动端完整流程
//   06-production-no-dev-panels.png 生产环境无开发面板

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const SCREENSHOTS_DIR = path.join(PROJECT_ROOT, '..', 'screenshots_phase5');
const DEV_PORT = 3001;
const PROD_PORT = 3101;
const DEV_URL = `http://localhost:${DEV_PORT}`;
const PROD_URL = `http://localhost:${PROD_PORT}`;

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function assertVisible(page, selector, description) {
  const locator = page.locator(selector).first();
  try {
    await locator.waitFor({ state: 'visible', timeout: 10000 });
  } catch (err) {
    throw new Error(`断言失败："${description}" (${selector}) 不可见或不存在: ${err.message}`);
  }
  const isVisible = await locator.isVisible();
  if (!isVisible) {
    throw new Error(`断言失败："${description}" (${selector}) 不可见`);
  }
  console.log(`  ✅ ${description} 可见`);
}

async function assertText(page, text, description) {
  const locator = page.getByText(text).first();
  try {
    await locator.waitFor({ state: 'visible', timeout: 10000 });
  } catch (err) {
    throw new Error(`断言失败："${description}" — 文本 "${text}" 未找到: ${err.message}`);
  }
  console.log(`  ✅ ${description} — 文本 "${text}" 存在`);
}

async function assertNotExists(page, selector, description) {
  const count = await page.locator(selector).count();
  if (count > 0) {
    throw new Error(`断言失败："${description}" (${selector}) 应该不存在，但找到了 ${count} 个`);
  }
  console.log(`  ✅ ${description} 不存在（符合预期）`);
}

async function takeScreenshot(page, filename, description) {
  const filePath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: filePath, fullPage: true });
  if (!fs.existsSync(filePath)) {
    throw new Error(`截图失败：文件未生成 ${filePath}`);
  }
  const stat = fs.statSync(filePath);
  if (stat.size < 1000) {
    throw new Error(`截图异常：文件过小 (${stat.size} bytes) ${filePath}`);
  }
  console.log(`  📸 ${description}: ${filename} (${(stat.size / 1024).toFixed(1)} KB)`);
  return filePath;
}

function startServer(cmd, args, cwd, port, name) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 启动${name}服务器...`);
    const server = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    
    let resolved = false;
    let output = '';
    
    server.stdout.on('data', (data) => {
      output += data.toString();
      if (data.toString().includes(`:${port}`) || data.toString().includes('Ready') || data.toString().includes('ready')) {
        if (!resolved) {
          resolved = true;
          setTimeout(() => resolve(server), 2000);
        }
      }
    });
    
    server.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    server.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`${name}服务器退出，代码: ${code}\n输出: ${output}`));
      }
    });
    
    setTimeout(() => {
      if (!resolved) {
        console.log(`  ⏳ 等待超时，假设已启动...`);
        resolve(server);
        resolved = true;
      }
    }, 20000);
  });
}

async function generateComposite(screenshots, outputPath) {
  try {
    const sharp = await import('sharp');
    
    const images = [];
    for (const s of screenshots) {
      const meta = await sharp.default(s.path).metadata();
      images.push({ path: s.path, width: meta.width, height: meta.height, label: s.label });
    }
    
    const padding = 30;
    const labelHeight = 50;
    const headerHeight = 60;
    const cols = 2;
    const rows = 2;
    
    const cellWidth = Math.max(...images.map(i => i.width));
    const cellHeight = Math.max(...images.map(i => i.height)) + labelHeight;
    
    const totalWidth = cellWidth * cols + padding * (cols + 1);
    const totalHeight = cellHeight * rows + padding * (rows + 1) + headerHeight;
    
    let svg = `<svg width="${totalWidth}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<rect width="100%" height="100%" fill="#0f0f1a"/>`;
    svg += `<text x="${totalWidth/2}" y="40" text-anchor="middle" fill="#fff" font-size="24" font-weight="bold" font-family="sans-serif">所有详情面板验收（四面板拼接）</text>`;
    
    const colors = ['#1e3a5f', '#2d6a4f', '#6d28d9', '#b45309'];
    for (let i = 0; i < images.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = padding + col * (cellWidth + padding);
      const y = headerHeight + padding + row * (cellHeight + padding);
      
      svg += `<rect x="${x}" y="${y}" width="${cellWidth}" height="${labelHeight}" fill="${colors[i % colors.length]}"/>`;
      svg += `<text x="${x + cellWidth/2}" y="${y + labelHeight/2 + 8}" text-anchor="middle" fill="#fff" font-size="18" font-weight="bold" font-family="sans-serif">${images[i].label}</text>`;
    }
    svg += `</svg>`;
    
    let composite = sharp.default(Buffer.from(svg));
    const compList = [];
    
    for (let i = 0; i < images.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = padding + col * (cellWidth + padding);
      const y = headerHeight + padding + row * (cellHeight + padding) + labelHeight;
      
      compList.push({ input: images[i].path, left: x, top: y });
    }
    
    await composite.composite(compList).png().toFile(outputPath);
  } catch (e) {
    throw new Error(`拼接图生成失败: ${e.message}`);
  }
}

async function runDevScreenshots(browser) {
  console.log('\n========================================');
  console.log('  开发环境截图（共5张）');
  console.log('========================================');
  
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  console.log(`\n📍 访问开发服务器: ${DEV_URL}`);
  const response = await page.goto(DEV_URL, { waitUntil: 'networkidle', timeout: 30000 });
  if (!response.ok()) {
    throw new Error(`开发服务器返回状态码: ${response.status()}`);
  }
  console.log(`  ✅ 页面加载成功 (HTTP ${response.status()})`);
  await sleep(2000);

  // ===== 截图1: 完整复盘结果 =====
  console.log('\n🎬 01: 完整复盘结果');
  await assertText(page, '开发模式', '开发模式标识');
  await assertVisible(page, '[data-testid="dev-open-success"]', '成功状态按钮');
  
  await page.click('[data-testid="dev-open-success"]');
  await sleep(3000);
  
  await assertText(page, '走势复盘结果', '复盘结果标题');
  await assertVisible(page, '[data-testid="chart-container"]', 'K线图表容器');
  
  await takeScreenshot(page, '01-full-flow-result.png', '完整复盘结果');

  // ===== 截图2: 所有详情面板 =====
  console.log('\n🎬 02: 所有详情面板');
  const allPanels = [];
  
  // 2a: 事件详情抽屉
  console.log('  打开事件详情抽屉...');
  const mappedBtn = page.locator('[data-testid="dev-open-mapped-event"]');
  const multiBtn = page.locator('[data-testid="dev-open-multi-source-event"]');
  const singleBtn = page.locator('[data-testid="dev-open-single-source-event"]');
  
  let eventOpened = false;
  if (await mappedBtn.count() > 0 && await mappedBtn.isVisible()) {
    await mappedBtn.click();
    eventOpened = true;
  } else if (await multiBtn.count() > 0 && await multiBtn.isVisible()) {
    await multiBtn.click();
    eventOpened = true;
  } else if (await singleBtn.count() > 0 && await singleBtn.isVisible()) {
    await singleBtn.click();
    eventOpened = true;
  }
  
  if (!eventOpened) {
    throw new Error('无法打开事件详情抽屉：未找到可用的开发按钮');
  }
  
  await sleep(1000);
  await assertVisible(page, '[data-testid="event-detail-drawer"]', '事件详情抽屉');
  const eventShot = path.join(SCREENSHOTS_DIR, '_tmp_event.png');
  await page.screenshot({ path: eventShot, fullPage: true });
  allPanels.push({ path: eventShot, label: '事件详情抽屉' });
  console.log('  📸 事件详情抽屉已截图');

  // 2b: 来源详情弹窗（在抽屉内点击查看来源）
  console.log('  打开来源详情弹窗...');
  const sourceCardBtn = page.locator('[data-testid^="view-source-"]').first();
  if (await sourceCardBtn.count() > 0) {
    await sourceCardBtn.click({ timeout: 5000 });
  } else {
    throw new Error('未找到"查看来源"按钮');
  }
  await sleep(1000);
  await assertVisible(page, '[data-testid="source-detail-modal"]', '来源详情弹窗');
  const sourceShot = path.join(SCREENSHOTS_DIR, '_tmp_source.png');
  await page.screenshot({ path: sourceShot, fullPage: true });
  allPanels.push({ path: sourceShot, label: '来源详情弹窗' });
  console.log('  📸 来源详情弹窗已截图');

  // 关闭来源详情和事件抽屉
  await page.keyboard.press('Escape');
  await sleep(500);
  await page.keyboard.press('Escape');
  await sleep(500);

  // 2c: 节点详情抽屉
  console.log('  打开节点详情抽屉...');
  await assertVisible(page, '[data-testid="dev-open-node"]', '节点详情按钮');
  await page.click('[data-testid="dev-open-node"]');
  await sleep(1000);
  await assertVisible(page, '[data-testid="node-detail-drawer"]', '节点详情抽屉');
  const nodeShot = path.join(SCREENSHOTS_DIR, '_tmp_node.png');
  await page.screenshot({ path: nodeShot, fullPage: true });
  allPanels.push({ path: nodeShot, label: '节点详情抽屉' });
  console.log('  📸 节点详情抽屉已截图');
  
  await page.keyboard.press('Escape');
  await sleep(500);

  // 2d: 未来事件详情抽屉
  console.log('  打开未来事件详情抽屉...');
  await assertVisible(page, '[data-testid="dev-open-confirmed-future-event"]', '未来事件按钮');
  await page.click('[data-testid="dev-open-confirmed-future-event"]');
  await sleep(1000);
  await assertVisible(page, '[data-testid="future-event-drawer"]', '未来事件详情抽屉');
  const futureShot = path.join(SCREENSHOTS_DIR, '_tmp_future.png');
  await page.screenshot({ path: futureShot, fullPage: true });
  allPanels.push({ path: futureShot, label: '未来事件详情抽屉' });
  console.log('  📸 未来事件详情抽屉已截图');
  
  await page.keyboard.press('Escape');
  await sleep(500);

  // 生成2x2拼接图
  console.log('  生成四面板拼接验收图...');
  await generateComposite(allPanels, path.join(SCREENSHOTS_DIR, '02-all-detail-panels.png'));
  for (const p of allPanels) {
    if (fs.existsSync(p.path)) fs.unlinkSync(p.path);
  }
  console.log('  ✅ 02-all-detail-panels.png 生成完成');

  // ===== 截图3: 空状态 =====
  console.log('\n🎬 03: 空状态');
  await assertVisible(page, '[data-testid="dev-open-empty"]', '空状态按钮');
  await page.click('[data-testid="dev-open-empty"]');
  await sleep(1500);
  await assertText(page, '未找到该区间的复盘数据', '空状态标题');
  await takeScreenshot(page, '03-empty-state.png', '空状态');

  // ===== 截图4: 错误状态和重试 =====
  console.log('\n🎬 04: 错误状态和重试');
  await assertVisible(page, '[data-testid="dev-open-error"]', '错误状态按钮');
  await page.click('[data-testid="dev-open-error"]');
  await sleep(1500);
  await assertText(page, '加载失败', '错误状态标题');
  await assertVisible(page, 'button:has-text("重试")', '重试按钮');
  await takeScreenshot(page, '04-error-and-retry.png', '错误状态和重试');

  // ===== 截图5: 移动端完整流程 =====
  console.log('\n🎬 05: 移动端完整流程');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload({ waitUntil: 'networkidle' });
  await sleep(2000);
  await assertVisible(page, '[data-testid="dev-open-success"]', '移动端成功状态按钮');
  await page.click('[data-testid="dev-open-success"]');
  await sleep(3000);
  await assertText(page, '走势复盘结果', '移动端复盘结果');
  await takeScreenshot(page, '05-mobile-complete-flow.png', '移动端完整流程');

  await context.close();
  console.log('\n✅ 开发环境5张截图全部生成完成！');
}

async function runProdScreenshots(browser) {
  console.log('\n========================================');
  console.log('  生产环境验证 + 截图（第6张）');
  console.log('========================================');
  
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  console.log(`\n📍 访问生产服务器: ${PROD_URL}`);
  const response = await page.goto(PROD_URL, { waitUntil: 'networkidle', timeout: 30000 });
  if (!response.ok()) {
    throw new Error(`生产服务器返回状态码: ${response.status()}`);
  }
  console.log(`  ✅ 页面加载成功 (HTTP ${response.status()})`);
  await sleep(2000);

  console.log('\n🔍 验证生产环境无开发面板：');
  
  await assertNotExists(page, 'text=开发模式', '"开发模式" 标识');
  await assertNotExists(page, 'text=展开状态演示面板', '"展开状态演示面板" 按钮');
  
  const devElements = await page.locator('[data-testid^="dev-"]').count();
  if (devElements > 0) {
    const testIds = [];
    for (let i = 0; i < devElements; i++) {
      const tid = await page.locator('[data-testid^="dev-"]').nth(i).getAttribute('data-testid');
      testIds.push(tid);
    }
    throw new Error(`生产环境存在 ${devElements} 个 dev- 前缀元素: ${testIds.join(', ')}`);
  }
  console.log('  ✅ 所有 data-testid 以 dev- 开头的元素不存在');

  await assertText(page, 'K-Ray', '应用标题 K-Ray');
  await assertText(page, '输入一只股票，看清每段关键走势背后的原因', '主标语');
  
  await takeScreenshot(page, '06-production-no-dev-panels.png', '生产环境无开发面板');

  await context.close();
  console.log('\n✅ 生产环境验证通过！所有断言通过，截图已生成。');
}

async function main() {
  console.log('========================================');
  console.log('  K-Ray 第五阶段截图（严格断言版）');
  console.log('========================================');
  
  let devServer = null;
  let prodServer = null;
  let browser = null;
  
  try {
    browser = await chromium.launch({ headless: true });
    console.log('✅ Playwright 浏览器启动成功');
    
    // 1. 启动开发服务器
    devServer = await startServer('npm', ['run', 'dev', '--', '-p', String(DEV_PORT)], PROJECT_ROOT, DEV_PORT, '开发');
    console.log('✅ 开发服务器已启动');
    await sleep(3000);
    
    // 2. 生成开发环境5张截图
    await runDevScreenshots(browser);
    
    // 3. 关闭开发服务器
    if (devServer) {
      devServer.kill();
      await sleep(2000);
      console.log('开发服务器已关闭');
    }
    
    // 4. 启动生产服务器
    prodServer = await startServer('npm', ['start', '--', '-p', String(PROD_PORT)], PROJECT_ROOT, PROD_PORT, '生产');
    console.log('✅ 生产服务器已启动');
    await sleep(3000);
    
    // 5. 生成生产环境截图 + 验证
    await runProdScreenshots(browser);
    
    console.log('\n========================================');
  console.log('  🎉 全部6张截图生成成功！');
  console.log(`  目录: ${SCREENSHOTS_DIR}`);
  console.log('========================================');
    
  } catch (error) {
    console.error('\n❌ 截图流程失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
    if (devServer) devServer.kill();
    if (prodServer) prodServer.kill();
    await sleep(1000);
  }
}

main();
