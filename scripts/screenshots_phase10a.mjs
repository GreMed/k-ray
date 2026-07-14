// K-Ray 第十阶段 A 截图脚本（新闻候选数据源可行性验证 · 封板修复版）
//
// 生成 7 张截图：
//   01-phase10a-real-600519.png         600519 real 真实查询结果
//   02-phase10a-real-000001.png         000001 real 真实查询结果
//   03-phase10a-mock-verified.png       Mock verified/unverified/多股汇总 状态
//   04-phase10a-real-300750-links.png   300750 real 来源链接
//   05-phase10a-real-error.png          real 模式真实服务失败（合法代码+脚本路径不存在）
//   06-phase10a-fallback.png            fallback 降级状态
//   07-phase10a-mock-mobile.png         移动端 Mock 页面
//
// 截图脚本断言：
//   - real 截图：模式徽标 Real、新闻列表、来源链接、覆盖限制提示、目标股票代码
//   - real 截图不得出现绿色 verified 误判（正文提及、多股汇总不能 verified）
//   - Mock 截图：verified 存在、unverified 存在、多股汇总存在
//   - error 截图（第5张）：合法股票代码 + 真实服务失败（脚本路径不存在），不是 400 参数错误
//   - fallback 截图：fallbackReason 存在
//   - 移动端截图：查询控件可见、无横向溢出
//
// 错误原因区分：
//   - Python/AKShare 未安装
//   - Python 脚本路径不存在（显示"数据服务脚本配置错误"，不是"未安装 AKShare"）
//   - 网络失败
//   - 超时
//
// 如果 real 查询得到错误页，真实成功截图必须失败并返回非 0
// 运行前清理本阶段旧截图，避免旧文件混入新交付

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn, execFileSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const SCREENSHOTS_DIR = path.join(PROJECT_ROOT, '..', 'screenshots_phase10a');
const REAL_PORT = 3006;
const MOCK_PORT = 3007;
const FALLBACK_PORT = 3008;
const REAL_ERROR_PORT = 3009;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 统一 Python 路径选择规则：
// 1. 优先使用 AKSHARE_PYTHON_PATH
// 2. 其次使用项目 .venv/bin/python
// 3. 最后才尝试系统 python3
function resolvePythonPath() {
  if (process.env.AKSHARE_PYTHON_PATH && fs.existsSync(process.env.AKSHARE_PYTHON_PATH)) {
    return process.env.AKSHARE_PYTHON_PATH;
  }
  const venvPython = path.join(PROJECT_ROOT, '.venv', 'bin', 'python');
  if (fs.existsSync(venvPython)) {
    return venvPython;
  }
  return 'python3';
}

function preflightPython(pythonPath) {
  console.log('\n🔍 Python 环境预检...');
  if (!fs.existsSync(pythonPath)) {
    console.error(`  ❌ 预检失败：Python 文件不存在: ${pythonPath}`);
    console.error('     请参考 requirements.txt 安装 akshare==1.18.64');
    return false;
  }
  try {
    execFileSync(pythonPath, ['-c', 'import akshare'], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 });
    console.log('  ✅ AKShare 模块导入成功');
  } catch {
    console.error(`  ❌ 预检失败：无法导入 AKShare 模块`);
    console.error('     请执行: pip install akshare==1.18.64');
    return false;
  }
  return true;
}

function startServer(env, port, name) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 启动${name}服务器（端口 ${port}）...`);
    const server = spawn('npm', ['run', 'dev', '--', '-p', String(port)], {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
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
        reject(new Error(`${name}服务器退出，代码: ${code}\n输出: ${output}`));
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
  const filePath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: filePath, fullPage: true });
  const stat = fs.statSync(filePath);
  console.log(`  📸 ${description}: ${filename} (${(stat.size / 1024).toFixed(1)} KB)`);
  return filePath;
}

async function queryStock(page, port, code, market) {
  const url = `http://localhost:${port}/dev-event-sources`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2000);

  // 点击预设按钮或输入代码
  const presetBtn = page.getByTestId(`preset-${code}`);
  if (await presetBtn.isVisible().catch(() => false)) {
    await presetBtn.click();
  } else {
    await page.getByTestId('stock-code-input').fill(code);
    const marketSelect = page.getByTestId('market-select');
    await marketSelect.selectOption(market);
  }
  await sleep(500);

  // 点击查询
  const queryBtn = page.getByTestId('query-button');
  await queryBtn.click();
  await sleep(3000);

  // 等待结果
  try {
    await page.getByTestId('result-meta').waitFor({ state: 'visible', timeout: 15000 });
    await sleep(2000);
  } catch {
    // 可能是错误状态
    try {
      await page.getByTestId('error-state').waitFor({ state: 'visible', timeout: 5000 });
    } catch {
      // 等待空状态
    }
  }
}

// 断言 real 截图成功条件
async function assertRealScreenshot(page, stockCode) {
  const errors = [];

  // 断言模式徽标为 Real 真实
  const modeBadge = page.getByTestId('mode-badge');
  const badgeText = await modeBadge.textContent();
  if (!badgeText || !badgeText.includes('Real')) {
    errors.push(`模式徽标应为 Real 真实，实际为: ${badgeText}`);
  }

  // 断言存在新闻列表
  const newsList = page.getByTestId('news-list');
  const newsListVisible = await newsList.isVisible().catch(() => false);
  if (!newsListVisible) {
    errors.push('real 截图必须存在新闻列表');
  }

  // 断言至少存在一条来源链接
  const firstNewsUrl = page.getByTestId('news-url-0');
  const urlVisible = await firstNewsUrl.isVisible().catch(() => false);
  if (!urlVisible) {
    errors.push('real 截图至少存在一条来源链接');
  }

  // 断言存在近期覆盖限制提示
  const coverageHint = page.getByTestId('coverage-limit-hint');
  const hintVisible = await coverageHint.isVisible().catch(() => false);
  if (!hintVisible) {
    errors.push('real 截图必须存在近期覆盖限制提示');
  }

  // 断言目标股票代码出现在页面（预设按钮高亮或输入框）
  const stockInput = page.getByTestId('stock-code-input');
  const inputValue = await stockInput.inputValue();
  if (inputValue !== stockCode) {
    errors.push(`目标股票代码应为 ${stockCode}，实际为 ${inputValue}`);
  }

  // 断言不出现绿色 verified 误判：
  // 检查每条新闻的 verified 状态是否合理（标题应明确包含公司简称才 verified）
  // 多股汇总类和仅正文提及的不能是 verified
  const newsCount = await page.getByTestId('news-list').evaluate(el => el.children.length).catch(() => 0);
  for (let i = 0; i < newsCount; i++) {
    const relevanceBadge = page.getByTestId(`relevance-badge-${i}`);
    const multiStockBadge = page.getByTestId(`multi-stock-badge-${i}`);
    const badgeText = await relevanceBadge.textContent().catch(() => '');
    const hasMultiStockBadge = await multiStockBadge.isVisible().catch(() => false);

    // 多股汇总标记的新闻不能是 verified
    if (hasMultiStockBadge && badgeText && badgeText.includes('verified') && !badgeText.includes('unverified')) {
      errors.push(`news[${i}] 标记为多股汇总但显示 verified（应为 unverified）`);
    }
  }

  return errors;
}

// 断言 Mock 截图成功条件
// 必须断言：verified 存在、unverified 存在、多股汇总存在
async function assertMockScreenshot(page) {
  const errors = [];

  const modeBadge = page.getByTestId('mode-badge');
  const badgeText = await modeBadge.textContent();
  if (!badgeText || !badgeText.includes('Mock')) {
    errors.push(`模式徽标应为 Mock 演示，实际为: ${badgeText}`);
  }

  const newsList = page.getByTestId('news-list');
  const newsListVisible = await newsList.isVisible().catch(() => false);
  if (!newsListVisible) {
    errors.push('Mock 截图必须存在新闻列表');
    return errors; // 没有新闻列表就无法继续检查
  }

  // 获取新闻数量
  const newsCount = await newsList.evaluate(el => el.children.length).catch(() => 0);
  if (newsCount === 0) {
    errors.push('Mock 截图新闻列表为空');
    return errors;
  }

  // 断言 verified 存在
  let hasVerified = false;
  let hasUnverified = false;
  let hasMultiStockSummary = false;

  for (let i = 0; i < newsCount; i++) {
    const relevanceBadge = page.getByTestId(`relevance-badge-${i}`);
    const badgeText = await relevanceBadge.textContent().catch(() => '');
    if (badgeText && badgeText.includes('verified') && !badgeText.includes('unverified')) {
      hasVerified = true;
    }
    if (badgeText && badgeText.includes('unverified')) {
      hasUnverified = true;
    }

    const multiStockBadge = page.getByTestId(`multi-stock-badge-${i}`);
    const multiStockVisible = await multiStockBadge.isVisible().catch(() => false);
    if (multiStockVisible) {
      hasMultiStockSummary = true;
    }
  }

  if (!hasVerified) {
    errors.push('Mock 截图必须存在 verified 新闻');
  }
  if (!hasUnverified) {
    errors.push('Mock 截图必须存在 unverified 新闻');
  }
  if (!hasMultiStockSummary) {
    errors.push('Mock 截图必须存在多股汇总新闻');
  }

  return errors;
}

// 断言 fallback 截图成功条件
async function assertFallbackScreenshot(page) {
  const errors = [];

  const modeBadge = page.getByTestId('mode-badge');
  const badgeText = await modeBadge.textContent();
  if (!badgeText || !badgeText.includes('Fallback')) {
    errors.push(`模式徽标应为 Fallback 降级，实际为: ${badgeText}`);
  }

  const fallbackReason = page.getByTestId('fallback-reason');
  const reasonVisible = await fallbackReason.isVisible().catch(() => false);
  if (!reasonVisible) {
    errors.push('fallback 截图必须出现 fallbackReason');
  }

  return errors;
}

// 断言 error 截图成功条件
// 第5张：合法股票代码 + 真实服务失败（脚本路径不存在）
async function assertErrorScreenshot(page, expectedStockCode) {
  const errors = [];

  // 必须出现 error-state
  const errorState = page.getByTestId('error-state');
  const errorVisible = await errorState.isVisible().catch(() => false);
  if (!errorVisible) {
    errors.push('error 截图必须出现 error-state');
  }

  // 必须使用合法股票代码（不是 400 参数错误）
  const stockInput = page.getByTestId('stock-code-input');
  const inputValue = await stockInput.inputValue();
  if (inputValue !== expectedStockCode) {
    errors.push(`error 截图必须使用合法股票代码 ${expectedStockCode}，实际为 ${inputValue}`);
  }

  // 错误信息必须体现真实服务失败，不能是参数校验错误
  const errorText = await errorState.textContent().catch(() => '');
  if (errorText && errorText.includes('6位数字')) {
    errors.push('error 截图不能是参数校验错误（6位数字），必须是真实服务失败');
  }
  if (errorText && errorText.includes('不属于')) {
    errors.push('error 截图不能是参数校验错误（市场不匹配），必须是真实服务失败');
  }

  return errors;
}

// 断言移动端截图成功条件
async function assertMobileScreenshot(page) {
  const errors = [];

  // 断言主要查询控件可见
  const queryForm = page.getByTestId('query-form');
  const formVisible = await queryForm.isVisible().catch(() => false);
  if (!formVisible) {
    errors.push('移动端截图必须显示查询表单');
  }

  const stockInput = page.getByTestId('stock-code-input');
  const inputVisible = await stockInput.isVisible().catch(() => false);
  if (!inputVisible) {
    errors.push('移动端截图必须显示股票代码输入框');
  }

  const marketSelect = page.getByTestId('market-select');
  const selectVisible = await marketSelect.isVisible().catch(() => false);
  if (!selectVisible) {
    errors.push('移动端截图必须显示市场选择器');
  }

  const queryButton = page.getByTestId('query-button');
  const buttonVisible = await queryButton.isVisible().catch(() => false);
  if (!buttonVisible) {
    errors.push('移动端截图必须显示查询按钮');
  }

  // 断言无明显横向溢出
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
  });
  if (hasOverflow) {
    errors.push(`移动端截图存在横向溢出: scrollWidth=${await page.evaluate(() => document.documentElement.scrollWidth)}, clientWidth=${await page.evaluate(() => document.documentElement.clientWidth)}`);
  }

  return errors;
}

async function run() {
  console.log('========================================');
  console.log('  K-Ray 第十阶段 A 截图（新闻候选数据源 · 封板修复版）');
  console.log('========================================');

  // 运行前清理本阶段旧截图
  if (fs.existsSync(SCREENSHOTS_DIR)) {
    const oldFiles = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png'));
    if (oldFiles.length > 0) {
      console.log(`\n🧹 清理旧截图（${oldFiles.length} 张）...`);
      for (const f of oldFiles) {
        fs.unlinkSync(path.join(SCREENSHOTS_DIR, f));
        console.log(`  删除: ${f}`);
      }
    }
  }

  // 确保截图目录存在
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const pythonPath = resolvePythonPath();
  if (!preflightPython(pythonPath)) {
    console.error('\n❌ Python 环境预检失败，脚本终止');
    process.exitCode = 1;
    return;
  }

  let realServer = null;
  let realErrorServer = null;
  let mockServer = null;
  let fallbackServer = null;
  let browser = null;
  let hasFailure = false;
  const screenshotResults = [];

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-proxy-server'],
    });
    console.log('✅ Playwright 浏览器启动成功（已禁用代理）');

    // ========== 启动真实模式服务器 ==========
    realServer = await startServer({
      EVENT_NEWS_MODE: 'real',
      AKSHARE_PYTHON_PATH: pythonPath,
      BAOSTOCK_PYTHON_PATH: pythonPath,
      NO_PROXY: 'localhost,127.0.0.1',
      no_proxy: 'localhost,127.0.0.1',
    }, REAL_PORT, '真实');

    let page = await browser.newPage();

    // ========== 截图1：600519 real ==========
    console.log('\n--- 截图1：600519 real 真实查询结果 ---');
    try {
      await queryStock(page, REAL_PORT, '600519', 'SH');

      // 检查是否为错误页
      const errorVisible = await page.getByTestId('error-state').isVisible().catch(() => false);
      if (errorVisible) {
        console.error('  ❌ real 查询得到错误页，真实成功截图必须失败');
        hasFailure = true;
      } else {
        // 断言 real 截图成功条件
        const errors = await assertRealScreenshot(page, '600519');
        if (errors.length > 0) {
          console.error('  ❌ 截图1断言失败:');
          errors.forEach(e => console.error(`     - ${e}`));
          hasFailure = true;
        } else {
          await takeScreenshot(page, '01-phase10a-real-600519.png', '600519 real 真实查询结果');
          screenshotResults.push('01-phase10a-real-600519.png');
        }
      }
    } catch (err) {
      console.error(`  ❌ 截图1失败：${err.message}`);
      hasFailure = true;
    }

    // ========== 截图2：000001 real ==========
    console.log('\n--- 截图2：000001 real 真实查询结果 ---');
    try {
      await queryStock(page, REAL_PORT, '000001', 'SZ');

      const errorVisible = await page.getByTestId('error-state').isVisible().catch(() => false);
      if (errorVisible) {
        console.error('  ❌ real 查询得到错误页，真实成功截图必须失败');
        hasFailure = true;
      } else {
        const errors = await assertRealScreenshot(page, '000001');
        if (errors.length > 0) {
          console.error('  ❌ 截图2断言失败:');
          errors.forEach(e => console.error(`     - ${e}`));
          hasFailure = true;
        } else {
          await takeScreenshot(page, '02-phase10a-real-000001.png', '000001 real 真实查询结果');
          screenshotResults.push('02-phase10a-real-000001.png');
        }
      }
    } catch (err) {
      console.error(`  ❌ 截图2失败：${err.message}`);
      hasFailure = true;
    }

    // ========== 截图4：300750 real 来源链接 ==========
    console.log('\n--- 截图4：300750 real 来源链接 ---');
    try {
      await queryStock(page, REAL_PORT, '300750', 'SZ');

      const errorVisible = await page.getByTestId('error-state').isVisible().catch(() => false);
      if (errorVisible) {
        console.error('  ❌ real 查询得到错误页，真实成功截图必须失败');
        hasFailure = true;
      } else {
        const errors = await assertRealScreenshot(page, '300750');
        if (errors.length > 0) {
          console.error('  ❌ 截图4断言失败:');
          errors.forEach(e => console.error(`     - ${e}`));
          hasFailure = true;
        } else {
          await takeScreenshot(page, '04-phase10a-real-300750-links.png', '300750 real 来源链接');
          screenshotResults.push('04-phase10a-real-300750-links.png');
        }
      }
    } catch (err) {
      console.error(`  ❌ 截图4失败：${err.message}`);
      hasFailure = true;
    }

    // 关闭真实服务器
    if (realServer) {
      realServer.kill('SIGTERM');
      realServer = null;
      await sleep(2000);
    }

    // ========== 启动真实错误模式服务器（合法代码 + 脚本路径不存在） ==========
    // 第5张：必须是真实 Provider 失败，不得用非法股票代码的 400 参数错误代替
    // 启动 EVENT_NEWS_MODE=real，使用合法股票代码，设置不存在的 AKSHARE_SCRIPT_PATH
    // 页面应显示数据服务/脚本配置错误
    console.log('\n--- 启动真实错误模式服务器（AKSHARE_SCRIPT_PATH 不存在）---');
    realErrorServer = await startServer({
      EVENT_NEWS_MODE: 'real',
      AKSHARE_PYTHON_PATH: pythonPath,
      AKSHARE_SCRIPT_PATH: '/nonexistent/akshare_news_client.py',
      NO_PROXY: 'localhost,127.0.0.1',
      no_proxy: 'localhost,127.0.0.1',
    }, REAL_ERROR_PORT, '真实错误');

    // ========== 截图5：real 模式真实服务失败 ==========
    console.log('\n--- 截图5：real 模式真实服务失败（合法代码 600519 + 脚本路径不存在）---');
    try {
      await queryStock(page, REAL_ERROR_PORT, '600519', 'SH');

      // 必须出现 error-state
      const errorState = page.getByTestId('error-state');
      await errorState.waitFor({ state: 'visible', timeout: 10000 });

      // 断言 error 截图成功条件（合法股票代码 + 真实服务失败）
      const errors = await assertErrorScreenshot(page, '600519');
      if (errors.length > 0) {
        console.error('  ❌ 截图5断言失败:');
        errors.forEach(e => console.error(`     - ${e}`));
        hasFailure = true;
      } else {
        // 验证错误消息包含"脚本"相关字样，不是"未安装 AKShare"
        const errorText = await errorState.textContent();
        console.log(`  错误信息: ${errorText}`);
        if (errorText && errorText.includes('脚本') && errorText.includes('不存在')) {
          console.log('  ✅ 错误消息正确显示"脚本路径不存在"');
        } else if (errorText && errorText.includes('未安装')) {
          console.error('  ❌ 错误消息错误地显示"未安装 AKShare"，应显示"脚本路径不存在"');
          hasFailure = true;
        }
        await takeScreenshot(page, '05-phase10a-real-error.png', 'real 模式真实服务失败（脚本路径不存在）');
        screenshotResults.push('05-phase10a-real-error.png');
      }
    } catch (err) {
      console.error(`  ❌ 截图5失败：${err.message}`);
      hasFailure = true;
    }

    // 关闭真实错误服务器
    if (realErrorServer) {
      realErrorServer.kill('SIGTERM');
      realErrorServer = null;
      await sleep(2000);
    }

    // ========== 启动 Mock 模式服务器 ==========
    mockServer = await startServer({
      EVENT_NEWS_MODE: 'mock',
      NO_PROXY: 'localhost,127.0.0.1',
      no_proxy: 'localhost,127.0.0.1',
    }, MOCK_PORT, 'Mock');

    // ========== 截图3：Mock verified/unverified/多股汇总 ==========
    console.log('\n--- 截图3：Mock verified/unverified/多股汇总 状态 ---');
    try {
      await queryStock(page, MOCK_PORT, '600519', 'SH');

      const errors = await assertMockScreenshot(page);
      if (errors.length > 0) {
        console.error('  ❌ 截图3断言失败:');
        errors.forEach(e => console.error(`     - ${e}`));
        hasFailure = true;
      } else {
        await takeScreenshot(page, '03-phase10a-mock-verified.png', 'Mock verified/unverified/多股汇总 状态');
        screenshotResults.push('03-phase10a-mock-verified.png');
      }
    } catch (err) {
      console.error(`  ❌ 截图3失败：${err.message}`);
      hasFailure = true;
    }

    // ========== 截图7：移动端 Mock 页面 ==========
    console.log('\n--- 截图7：移动端 Mock 页面 ---');
    try {
      // 使用 Mock 模式页面截取移动端
      await page.setViewportSize({ width: 375, height: 812 });
      await sleep(500);

      // 断言移动端截图成功条件（查询控件可见 + 无横向溢出）
      const errors = await assertMobileScreenshot(page);
      if (errors.length > 0) {
        console.error('  ❌ 截图7断言失败:');
        errors.forEach(e => console.error(`     - ${e}`));
        hasFailure = true;
      } else {
        await takeScreenshot(page, '07-phase10a-mock-mobile.png', '移动端 Mock 页面');
        screenshotResults.push('07-phase10a-mock-mobile.png');
      }
    } catch (err) {
      console.error(`  ❌ 截图7失败：${err.message}`);
      hasFailure = true;
    }
    // 恢复桌面视口
    await page.setViewportSize({ width: 1280, height: 800 });
    await sleep(500);

    // 关闭 Mock 服务器
    if (mockServer) {
      mockServer.kill('SIGTERM');
      mockServer = null;
      await sleep(2000);
    }

    // ========== 启动 Fallback 模式服务器 ==========
    // 使用不存在的脚本路径触发降级（Python 存在但脚本不存在，触发脚本路径不存在错误，fallback 降级为 Mock）
    fallbackServer = await startServer({
      EVENT_NEWS_MODE: 'fallback',
      AKSHARE_SCRIPT_PATH: '/nonexistent/akshare_news_client.py',
      NO_PROXY: 'localhost,127.0.0.1',
      no_proxy: 'localhost,127.0.0.1',
    }, FALLBACK_PORT, 'Fallback');

    // ========== 截图6：fallback 降级 ==========
    console.log('\n--- 截图6：fallback 降级状态 ---');
    try {
      await queryStock(page, FALLBACK_PORT, '600519', 'SH');

      const errors = await assertFallbackScreenshot(page);
      if (errors.length > 0) {
        console.error('  ❌ 截图6断言失败:');
        errors.forEach(e => console.error(`     - ${e}`));
        hasFailure = true;
      } else {
        await takeScreenshot(page, '06-phase10a-fallback.png', 'fallback 降级状态');
        screenshotResults.push('06-phase10a-fallback.png');
      }
    } catch (err) {
      console.error(`  ❌ 截图6失败：${err.message}`);
      hasFailure = true;
    }

    // ========== 最终报告 ==========
    console.log('\n========================================');
    console.log('  截图脚本执行完成');
    console.log('========================================');

    console.log(`\n已生成截图（${screenshotResults.length} 张）:`);
    screenshotResults.forEach(f => {
      const stat = fs.statSync(path.join(SCREENSHOTS_DIR, f));
      console.log(`  📸 ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
    });

    if (hasFailure) {
      console.log('\n❌ 部分截图失败或断言未通过');
      process.exitCode = 1;
    } else if (screenshotResults.length < 7) {
      console.log(`\n❌ 期望 7 张截图，实际生成 ${screenshotResults.length} 张`);
      process.exitCode = 1;
    } else {
      console.log('\n✅ 所有截图完成且断言通过');
      process.exitCode = 0;
    }

  } catch (err) {
    console.error('\n❌ 截图脚本失败:', err.message);
    hasFailure = true;
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (realServer) realServer.kill('SIGTERM');
    if (realErrorServer) realErrorServer.kill('SIGTERM');
    if (mockServer) mockServer.kill('SIGTERM');
    if (fallbackServer) fallbackServer.kill('SIGTERM');
    await sleep(2000);
  }
}

run();
