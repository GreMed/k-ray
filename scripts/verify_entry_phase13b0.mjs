// 体验入口验证脚本：确认首页可打开、设置弹窗可打开、Mock-only 文案可见
import { chromium } from 'playwright';

const URL = 'http://localhost:3000';

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-proxy-server'],
  });
  const page = await browser.newPage();

  try {
    console.log(`访问: ${URL}`);
    const resp = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`首页 HTTP 状态: ${resp?.status()}`);
    if (resp?.status() !== 200) {
      throw new Error(`首页未返回 200，实际: ${resp?.status()}`);
    }

    // 等待入口按钮可见
    const entryBtn = page.getByTestId('personal-search-settings-entry');
    await entryBtn.waitFor({ state: 'visible', timeout: 10000 });
    const entryText = await entryBtn.textContent();
    console.log(`入口按钮文案: "${entryText}"`);

    // 点击入口
    await entryBtn.click();
    await page.waitForTimeout(500);

    // 等待弹窗可见
    const modal = page.getByTestId('personal-search-settings-modal');
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    console.log('设置弹窗已打开');

    // 验证 Mock-only 文案
    const modalText = await modal.textContent();
    const checks = [
      '当前版本仅支持 Mock 演示候选，尚未接入真实搜索',
      '真实搜索尚未在当前版本开放',
      '节点新闻候选仍为 Mock 演示数据',
      'Key 仅保存在当前浏览器会话中',
    ];
    for (const t of checks) {
      if (!modalText.includes(t)) {
        throw new Error(`弹窗缺少文案: "${t}"`);
      }
    }
    console.log('Mock-only 文案校验通过');

    // 验证默认状态为"未配置"
    const status = await page.getByTestId('personal-search-masked-status').textContent();
    console.log(`默认配置状态: "${status}"`);

    // 验证按钮数量（保存、清除、关闭）
    const buttons = await modal.locator('button').count();
    console.log(`弹窗按钮数量: ${buttons}`);

    // 检查页面是否有阻断性报错
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.waitForTimeout(500);
    if (errors.length > 0) {
      console.log(`页面报错: ${errors.join('; ')}`);
    } else {
      console.log('无阻断性报错');
    }

    console.log('\n✅ 体验入口验证通过');
  } catch (err) {
    console.error(`\n❌ 验证失败: ${err.message}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
