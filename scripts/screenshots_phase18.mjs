// K-Ray 第十八阶段发布前核心体验修复 — 视觉验收截图脚本（加固版）
//
// 连接到 BASE_URL 指定的体验地址（默认 http://localhost:3000），生成以下截图：
//   1. 节点日期联动（必须由点击行情图中的真实关键节点标识触发）
//   2. 默认案例无需切换即可看到日历内容
//   3. 可核验事件及官方来源
//   4. 演示事件（无来源链接）
//   5. 五个案例各有独立截图及日历统计
//   6. 移动端无横向溢出
//
// 加固机制：
//   - 任意必需元素缺失、文字不符、统计不符、请求失败或移动端溢出时，脚本非零退出
//   - 不得只打印错误后继续返回成功
//   - 支持 BASE_URL 环境变量指定体验地址
//   - 所有断言通过后才能替换正式截图（先写临时目录，全部通过后移动到正式目录）
//   - 失败时保留上一轮有效截图
//
// 所有截图直接写入 screenshots_phase18/

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const FINAL_DIR = path.join(PROJECT_ROOT, 'screenshots_phase18');
const TEMP_DIR = path.join(PROJECT_ROOT, 'screenshots_phase18_tmp');

// 支持 BASE_URL 环境变量指定体验地址，默认 http://localhost:3000
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DEMO_PATH = (stock) => `${BASE_URL}/demo/core-replay?stock=${stock}`;
const CASES = ['300750', '600519', '603236', '603986', '002594'];

// 绕过 HTTP 代理对 localhost 的拦截（开发环境可能有 http_proxy 设置）
process.env.NO_PROXY = 'localhost,127.0.0.1';
process.env.no_proxy = 'localhost,127.0.0.1';

// 全局错误收集器：任何断言失败都推入此数组，最终非零退出
const failures = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 断言函数：失败时推入 failures 并抛出错误，阻止当前步骤继续
function assert(condition, message) {
  if (!condition) {
    failures.push(message);
    throw new Error(message);
  }
}

// 等待日历就绪：calendar-month-label 可见且包含期望月份文本
async function waitForCalendarReady(page, expectedMonth = '2026年7月', timeoutMs = 10000) {
  await page.getByTestId('calendar-month-label').waitFor({ state: 'visible', timeout: timeoutMs }).catch(() => {});
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const label = (await page.getByTestId('calendar-month-label').textContent().catch(() => '')) || '';
    if (label.includes(expectedMonth)) {
      console.log(`    ✅ 日历已就绪：${label.trim()}`);
      return true;
    }
    await sleep(400);
  }
  const label = (await page.getByTestId('calendar-month-label').textContent().catch(() => '')) || '';
  const msg = `日历未就绪或月份不匹配（期望含 "${expectedMonth}"，实际 "${label.trim()}"）`;
  failures.push(msg);
  throw new Error(msg);
}

// 安全读取元素文本
async function readText(locator) {
  try {
    const txt = await locator.textContent({ timeout: 5000 });
    return (txt || '').trim();
  } catch {
    return '';
  }
}

// 读取左下复盘笔记日期摘要（trading-day-summary 内 text-muted 的 span）
async function readSummaryDate(page) {
  const dateSpan = page.getByTestId('trading-day-summary').locator('span.text-muted').first();
  return readText(dateSpan);
}

// 截图到临时目录
async function takeScreenshot(page, filename, description, fullPage = false) {
  const filePath = path.join(TEMP_DIR, filename);
  await page.screenshot({ path: filePath, fullPage });
  const stat = fs.statSync(filePath);
  console.log(`  📸 ${description}: ${filename} (${(stat.size / 1024).toFixed(1)} KB)`);
  return filePath;
}

// 元素截图到临时目录
async function takeElementScreenshot(locator, filename, description) {
  const filePath = path.join(TEMP_DIR, filename);
  await locator.screenshot({ path: filePath });
  const stat = fs.statSync(filePath);
  console.log(`  📸 ${description}: ${filename} (${(stat.size / 1024).toFixed(1)} KB)`);
  return filePath;
}

async function main() {
  console.log(`\n=== Phase 18 截图脚本启动 ===`);
  console.log(`体验地址: ${BASE_URL}`);
  console.log(`正式截图目录: ${FINAL_DIR}`);
  console.log(`临时截图目录: ${TEMP_DIR}`);

  // 准备临时目录（清空旧内容）
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true });
  }
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  // 验证体验地址可达
  console.log(`\n--- 验证体验地址可达 ---`);
  try {
    const response = await fetch(BASE_URL);
    assert(response.ok, `体验地址 ${BASE_URL} 返回非 200 状态码: ${response.status}`);
    console.log(`    ✅ 体验地址可达 (HTTP ${response.status})`);
  } catch (err) {
    assert(false, `无法连接到体验地址 ${BASE_URL}: ${err.message}`);
  }

  const browser = await chromium.launch({
    headless: true,
    // 绕过 HTTP 代理，确保直接连接本地 dev server
    args: ['--no-proxy-server'],
  });

  // ================================================================
  // 截图 1: 节点日期联动（必须由点击行情图中的真实关键节点标识触发）
  // ================================================================
  console.log('\n=== 截图 1: 节点日期联动（行情图 marker 触发）===');
  const desktopCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desktopPage = await desktopCtx.newPage();
  try {
    await desktopPage.goto(DEMO_PATH('300750'), { waitUntil: 'networkidle' });
    await sleep(2000);
    await desktopPage.getByTestId('chart-wrapper').waitFor({ state: 'visible', timeout: 10000 });
    await waitForCalendarReady(desktopPage, '2026年7月');

    // 点击前：记录 current-node-date（默认选中的第一个节点日期）
    const beforeNodeDate = await readText(desktopPage.getByTestId('current-node-date'));
    console.log(`    点击前 current-node-date: "${beforeNodeDate}"`);
    assert(beforeNodeDate !== '', '点击前 current-node-date 为空，无法判断 marker 命中');

    // 必须通过点击行情图中的关键节点标识（marker）触发，不能用顶部节点按钮代替
    // lightweight-charts 使用 canvas 渲染，通过 subscribeClick 处理点击
    // 使用 Playwright 的 mouse.click 在 canvas 上生成真实浏览器事件
    console.log('    通过行情图 marker 触发节点选择...');

    // 获取 chart-container 的位置和尺寸（canvas 在其中）
    const chartContainer = desktopPage.getByTestId('chart-container');
    const containerBox = await chartContainer.boundingBox();
    assert(containerBox !== null, '无法获取 chart-container 的边界框');

    // 在图表 canvas 上沿 x 轴尝试多个位置点击，寻找 marker
    // marker 分布在 K 线的时间轴上，尝试 10%~90% 范围内的多个位置
    // marker 可能位于 aboveBar（顶部）或 belowBar（底部），需要尝试多个 y 位置
    const yPercents = [0.15, 0.85, 0.25, 0.75, 0.10, 0.90, 0.35, 0.65, 0.50];
    const xPercents = [0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80];
    let markerHit = false;
    let hitX = 0;
    let hitY = 0;
    let hitDate = '';

    // 先尝试通过 React fiber 获取图表实例，找到 marker 的精确像素位置
    const markerPositions = await desktopPage.evaluate(() => {
      try {
        const container = document.querySelector('[data-testid="chart-container"]');
        if (!container) return { error: 'no chart-container' };

        // 遍历 React fiber 树，找到 chartRef 持有的 IChartApi 实例
        const fiberKey = Object.keys(container).find(k => k.startsWith('__reactFiber'));
        if (!fiberKey) return { error: 'no fiber' };

        let fiber = container[fiberKey];
        let chartInstance = null;

        // 向上遍历 fiber 树，检查每个组件的 state/ref
        while (fiber && !chartInstance) {
          if (fiber.memoizedState) {
            let state = fiber.memoizedState;
            while (state && !chartInstance) {
              const val = state.memoizedState;
              if (val && typeof val === 'object' && val.current && typeof val.current.timeScale === 'function') {
                chartInstance = val.current;
              }
              state = state.next;
            }
          }
          fiber = fiber.return;
        }

        if (!chartInstance) return { error: 'chart instance not found' };

        const timeScale = chartInstance.timeScale();
        // 获取所有 marker 的时间点
        // lightweight-charts 不直接暴露 markers，但我们可以通过 timeScale 获取可见范围
        const visibleRange = timeScale.getVisibleRange();
        // 获取所有 K 线数据的日期（从 DOM 中的 current-node-date 或其他方式）
        // 使用 timeToCoordinate 转换时间为像素坐标
        // 尝试获取 markers - 通过 series 的 markers
        // lightweight-charts v4: series has setMarkers but not getMarkers
        // 我们需要从组件的 props/state 获取 marker 日期
        return { chartFound: true, visibleRange };
      } catch (e) {
        return { error: e.message };
      }
    });

    if (markerPositions && markerPositions.chartFound) {
      console.log(`    ℹ️ 找到图表实例，可见范围: ${JSON.stringify(markerPositions.visibleRange)}`);
    } else if (markerPositions && markerPositions.error) {
      console.log(`    ℹ️ 无法获取图表实例: ${markerPositions.error}`);
    }

    // 同时获取关键节点日期列表（从 node-tab 按钮读取，静态案例页面使用 node-tab 而非 key-node-item）
    const nodeDates = await desktopPage.evaluate(() => {
      const items = document.querySelectorAll('[data-testid^="node-tab-"]');
      const dates = [];
      items.forEach(item => {
        // node-tab 内的 span 包含日期（格式 YYYY-MM-DD）
        const spans = item.querySelectorAll('span');
        spans.forEach(span => {
          const text = span.textContent.trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
            dates.push(text);
          }
        });
      });
      return dates;
    });
    console.log(`    ℹ️ 关键节点日期: ${nodeDates.join(', ')}`);

    // 获取图表实例后，使用 timeToCoordinate 计算每个节点日期的像素 x 坐标
    const nodePixelPositions = await desktopPage.evaluate((dates) => {
      try {
        const container = document.querySelector('[data-testid="chart-container"]');
        if (!container) return [];
        const fiberKey = Object.keys(container).find(k => k.startsWith('__reactFiber'));
        if (!fiberKey) return [];
        let fiber = container[fiberKey];
        let chartInstance = null;
        while (fiber && !chartInstance) {
          if (fiber.memoizedState) {
            let state = fiber.memoizedState;
            while (state && !chartInstance) {
              const val = state.memoizedState;
              if (val && typeof val === 'object' && val.current && typeof val.current.timeScale === 'function') {
                chartInstance = val.current;
              }
              state = state.next;
            }
          }
          fiber = fiber.return;
        }
        if (!chartInstance) return [];
        const timeScale = chartInstance.timeScale();
        const containerRect = container.getBoundingClientRect();
        const result = [];
        for (const date of dates) {
          // lightweight-charts 使用字符串日期 'YYYY-MM-DD' 作为 Time 类型
          // 直接传入字符串，不转换为 business day 对象
          const coord = timeScale.timeToCoordinate(date);
          if (coord !== null && coord !== undefined) {
            result.push({ date, x: containerRect.x + coord });
          }
        }
        return result;
      } catch {
        return [];
      }
    }, nodeDates);

    if (nodePixelPositions.length > 0) {
      console.log(`    ℹ️ 找到 ${nodePixelPositions.length} 个节点的像素位置: ${
        nodePixelPositions.map(p => `${p.date}@x=${p.x.toFixed(0)}`).join(', ')
      }`);
    }

    // 优先使用精确像素位置点击 marker
    if (nodePixelPositions.length > 0) {
      // 获取 series 实例和 K 线数据，计算 marker 的精确 y 坐标
      const markerPrecisePositions = await desktopPage.evaluate((positions) => {
        try {
          const container = document.querySelector('[data-testid="chart-container"]');
          if (!container) return [];
          const fiberKey = Object.keys(container).find(k => k.startsWith('__reactFiber'));
          if (!fiberKey) return [];
          let fiber = container[fiberKey];
          let chartInstance = null;
          let seriesInstance = null;

          // 遍历 fiber 树，找到 chart 和 series 实例
          while (fiber && (!chartInstance || !seriesInstance)) {
            if (fiber.memoizedState) {
              let state = fiber.memoizedState;
              while (state && (!chartInstance || !seriesInstance)) {
                const val = state.memoizedState;
                if (val && typeof val === 'object' && val.current) {
                  if (typeof val.current.timeScale === 'function' && !chartInstance) {
                    chartInstance = val.current;
                  }
                  // series 通常有 setData, setMarkers, applyOptions 等方法
                  if (typeof val.current.setData === 'function' && typeof val.current.setMarkers === 'function' && !seriesInstance) {
                    seriesInstance = val.current;
                  }
                }
                state = state.next;
              }
            }
            fiber = fiber.return;
          }

          if (!chartInstance || !seriesInstance) return [];
          const timeScale = chartInstance.timeScale();
          const containerRect = container.getBoundingClientRect();
          const result = [];

          for (const pos of positions) {
            // 获取该日期的 K 线数据
            // lightweight-charts v4: series.dataByIndex 不太好用，尝试用 series 的 coordinateToPrice 反推
            // 或者直接遍历 K 线数据找对应日期的 high/low
            // 使用 series.priceToCoordinate(price) 转换价格到 y 坐标
            const xCoord = timeScale.timeToCoordinate(pos.date);
            if (xCoord === null || xCoord === undefined) continue;

            // 尝试获取该日期的 bar 数据
            // 在 v4 中，可以通过 series 的内部方法获取
            // 但更简单的方式是：尝试多个 y 位置（基于图表高度的比例）
            // marker 可能在 aboveBar（顶部）或 belowBar（底部）
            // 先尝试极端位置（很顶部和很底部），再尝试中间位置
            const chartHeight = containerRect.height;
            const absX = containerRect.x + xCoord;

            // aboveBar: 在 K 线上方，通常在图表顶部 1/4 区域
            // belowBar: 在 K 线下方，通常在图表底部 1/4 区域
            // 尝试精确的 y 位置
            const yPositions = [];
            // 顶部区域（aboveBar markers）
            for (let i = 1; i <= 5; i++) {
              yPositions.push({ y: containerRect.y + chartHeight * (0.05 * i), label: `top${i}` });
            }
            // 底部区域（belowBar markers）
            for (let i = 1; i <= 5; i++) {
              yPositions.push({ y: containerRect.y + chartHeight * (1 - 0.05 * i), label: `bot${i}` });
            }
            // 中间区域
            yPositions.push({ y: containerRect.y + chartHeight * 0.5, label: 'mid' });

            result.push({ date: pos.date, x: absX, yPositions });
          }
          return result;
        } catch {
          return [];
        }
      }, nodePixelPositions);

      // 使用精确位置点击 marker
      for (const pos of markerPrecisePositions) {
        if (pos.date === beforeNodeDate) continue;
        for (const yPos of pos.yPositions) {
          const clickX = pos.x;
          const clickY = yPos.y;
          await desktopPage.mouse.move(clickX, clickY);
          await sleep(150);
          await desktopPage.mouse.click(clickX, clickY);
          await sleep(300);

          const nodeDateAfter = await readText(desktopPage.getByTestId('current-node-date'));
          const summaryDateAfter = await readSummaryDate(desktopPage);

          if (nodeDateAfter !== '' && nodeDateAfter !== beforeNodeDate && summaryDateAfter === nodeDateAfter) {
            markerHit = true;
            hitX = clickX;
            hitY = clickY;
            hitDate = nodeDateAfter;
            console.log(`    ✅ 在精确位置 x=${clickX.toFixed(0)}, y=${yPos.label}(${clickY.toFixed(0)}) 命中 marker，日期从 "${beforeNodeDate}" 变为 "${hitDate}"`);
            break;
          }
        }
        if (markerHit) break;
      }
    }

    // 如果精确位置未命中，回退到网格扫描
    if (!markerHit) {
      outer:
      for (const xPct of xPercents) {
        for (const yPct of yPercents) {
          const clickX = containerBox.x + containerBox.width * xPct;
          const clickY = containerBox.y + containerBox.height * yPct;
          // 先移动鼠标到目标位置，触发 pointermove 事件，让 lightweight-charts 更新十字准线和 hoveredObjectId
          await desktopPage.mouse.move(clickX, clickY);
          await sleep(200);
          // 然后点击，触发 subscribeClick 回调（此时 hoveredObjectId 应已设置）
          await desktopPage.mouse.click(clickX, clickY);
          await sleep(350);

          // 点击后读取 current-node-date 和 trading-day-summary
          const nodeDateAfter = await readText(desktopPage.getByTestId('current-node-date'));
          const summaryDateAfter = await readSummaryDate(desktopPage);

          // 判定 marker 命中的两个必要条件：
          //   1. current-node-date 与点击前不同（日期必须变化，否则只是普通 K 线点击）
          //   2. trading-day-summary 与新的 current-node-date 完全一致
          if (nodeDateAfter !== '' && nodeDateAfter !== beforeNodeDate && summaryDateAfter === nodeDateAfter) {
            markerHit = true;
            hitX = clickX;
            hitY = clickY;
            hitDate = nodeDateAfter;
            console.log(`    ✅ 在 x=${xPct.toFixed(2)}, y=${yPct.toFixed(2)} 位置命中 marker，日期从 "${beforeNodeDate}" 变为 "${hitDate}"`);
            break outer;
          }
          // 如果日期没有变化，不得报告"命中 marker"，继续尝试下一个位置
        }
      }
    }

    assert(markerHit,
      `在行情图 canvas 上未能命中任何关键节点 marker（所有点击位置日期均未从 "${beforeNodeDate}" 发生变化）`);
    console.log(`    ✅ 行情图 marker 点击完成 (x=${hitX.toFixed(0)}, y=${hitY.toFixed(0)})`);

    await sleep(500);

    // 读取点击后的最终值
    const newNodeDate = await readText(desktopPage.getByTestId('current-node-date'));
    const newSummaryDate = await readSummaryDate(desktopPage);
    console.log(`    点击后 current-node-date: "${newNodeDate}"`);
    console.log(`    点击后 trading-day-summary 日期: "${newSummaryDate}"`);

    // 断言：日期不能为空
    assert(newNodeDate !== '', '点击 marker 后 current-node-date 为空');
    assert(newSummaryDate !== '', '点击 marker 后 trading-day-summary 日期为空');
    // 断言：两者必须完全一致
    assert(newNodeDate === newSummaryDate,
      `节点日期联动验证失败：current-node-date="${newNodeDate}" !== trading-day-summary="${newSummaryDate}"`);
    // 断言：日期必须与点击前不同（证明是 marker 触发而非默认值）
    assert(newNodeDate !== beforeNodeDate,
      `点击后日期 "${newNodeDate}" 与点击前 "${beforeNodeDate}" 相同，可能只是普通 K 线点击而非 marker 命中`);
    console.log(`    ✅ 节点日期联动验证通过：两者一致 ("${newNodeDate}")，且与点击前不同`);

    // 滚动到 dual-card-area 可见，截图视口（节点详情和复盘笔记在同一视口内可见）
    await desktopPage.getByTestId('dual-card-area').scrollIntoViewIfNeeded().catch(() => {});
    await sleep(400);
    await takeScreenshot(desktopPage, '01-node-date-sync.png', '节点日期联动（行情图 marker 触发）', false);
  } catch (err) {
    console.error(`    ❌ 截图 1 失败: ${err.message}`);
    // failures 已由 assert 推入
  }
  await desktopCtx.close().catch(() => {});

  // ================================================================
  // 截图 2/3/4: 同一桌面页面（默认日历 → 8月可核验事件 → 7月演示事件）
  // ================================================================
  console.log('\n=== 截图 2: 默认案例无需切换即可看到日历内容 ===');
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page2 = await ctx2.newPage();
  let page2Ready = false;
  try {
    await page2.goto(DEMO_PATH('300750'), { waitUntil: 'networkidle' });
    await sleep(2000);
    await page2.getByTestId('chart-wrapper').waitFor({ state: 'visible', timeout: 10000 });
    await waitForCalendarReady(page2, '2026年7月');

    // 读取 calendar-stats
    const stats = await readText(page2.getByTestId('calendar-stats'));
    console.log(`    calendar-stats: "${stats}"`);
    const expectedStats = '可核验 1 · 演示 2 · 用户 0';
    assert(stats === expectedStats,
      `统计文本不匹配：期望 "${expectedStats}"，实际 "${stats}"`);
    console.log(`    ✅ 统计文本匹配`);

    // 读取 calendar-static-label
    const staticLabel = await readText(page2.getByTestId('calendar-static-label'));
    assert(staticLabel !== '', 'calendar-static-label 为空');
    console.log(`    ✅ calendar-static-label: "${staticLabel}"`);

    // 滚动到 calendar-card-wrapper 可见，截 dual-card-area 元素
    await page2.getByTestId('calendar-card-wrapper').scrollIntoViewIfNeeded().catch(() => {});
    await sleep(400);
    const dualCardArea = page2.getByTestId('dual-card-area');
    if (await dualCardArea.isVisible().catch(() => false)) {
      await takeElementScreenshot(dualCardArea, '02-default-case-calendar.png', '默认案例日历内容');
    } else {
      await takeScreenshot(page2, '02-default-case-calendar.png', '默认案例日历内容（视口）', false);
    }
    page2Ready = true;
  } catch (err) {
    console.error(`    ❌ 截图 2 失败: ${err.message}`);
  }

  // ----------------------------------------------------------------
  // 截图 3: 可核验事件及官方来源（切换到 8 月，点击 8/31 格子）
  // ----------------------------------------------------------------
  console.log('\n=== 截图 3: 可核验事件及官方来源 ===');
  try {
    assert(page2Ready, '截图 2 未就绪，跳过截图 3');

    // 滚动到日历区域
    await page2.getByTestId('calendar-card-wrapper').scrollIntoViewIfNeeded().catch(() => {});
    await sleep(300);

    // 点击 calendar-next-month 切换到 8 月
    const nextBtn = page2.getByTestId('calendar-next-month');
    const nextDisabled = await nextBtn.isDisabled().catch(() => false);
    assert(!nextDisabled, 'calendar-next-month 被禁用，无法切换到 8 月');
    await nextBtn.evaluate((el) => el.click());
    await sleep(500);
    await waitForCalendarReady(page2, '2026年8月', 5000);

    // 点击 8 月 31 日格子
    const aug31Cell = page2.getByTestId('calendar-cell-2026-08-31');
    await aug31Cell.waitFor({ state: 'visible', timeout: 5000 });
    await aug31Cell.evaluate((el) => el.click());
    await sleep(500);

    // 查找带 event-deadline-tag 的事件
    const deadlineTag = page2.locator('[data-testid^="event-deadline-tag-"]').first();
    await deadlineTag.waitFor({ state: 'visible', timeout: 5000 });
    const deadlineTestid = await deadlineTag.getAttribute('data-testid');
    const eventId = deadlineTestid.replace('event-deadline-tag-', '');
    console.log(`    ✅ 找到法定期限事件，id="${eventId}"`);

    // 读取事件标题
    const title = await readText(page2.getByTestId(`event-title-${eventId}`));
    assert(title !== '', '法定期限事件标题为空');
    console.log(`    ✅ 事件标题: "${title}"`);

    // 读取来源链接
    const sourceEl = page2.getByTestId(`event-source-${eventId}`);
    assert(await sourceEl.isVisible().catch(() => false), '未找到来源链接');
    const sourceUrl = (await sourceEl.getAttribute('href')) || '';
    const sourceText = await readText(sourceEl);
    assert(sourceUrl !== '', '来源链接 URL 为空');
    assert(sourceText !== '', '来源链接文本为空');
    console.log(`    ✅ 来源链接: "${sourceText}" → ${sourceUrl}`);

    // 滚动到 selected-date-events 并截图
    await page2.getByTestId('selected-date-events').scrollIntoViewIfNeeded().catch(() => {});
    await sleep(300);
    await takeScreenshot(page2, '03-verifiable-event-with-source.png', '可核验事件及官方来源（视口）', false);
  } catch (err) {
    console.error(`    ❌ 截图 3 失败: ${err.message}`);
  }

  // ----------------------------------------------------------------
  // 截图 4: 演示事件（回到 7 月，查看 pending-month-events）
  // ----------------------------------------------------------------
  console.log('\n=== 截图 4: 演示事件 ===');
  try {
    assert(page2Ready, '截图 2 未就绪，跳过截图 4');

    // 检查当前月份：若不在 7 月则回到 7 月
    const monthLabel = await readText(page2.getByTestId('calendar-month-label'));
    if (!monthLabel.includes('2026年7月')) {
      const prevBtn = page2.getByTestId('calendar-prev-month');
      const prevDisabled = await prevBtn.isDisabled().catch(() => false);
      assert(!prevDisabled, `calendar-prev-month 被禁用，当前月份: ${monthLabel}`);
      await prevBtn.evaluate((el) => el.click());
      await sleep(500);
      await waitForCalendarReady(page2, '2026年7月', 5000);
    } else {
      console.log('    ℹ️ 当前已在 7 月，直接查看 pending-month-events');
    }

    // 滚动到日历区域
    await page2.getByTestId('calendar-card-wrapper').scrollIntoViewIfNeeded().catch(() => {});
    await sleep(300);

    // 读取 pending-month-events 区域，查找带 pending-demo-tag 的事件
    const pendingArea = page2.getByTestId('pending-month-events');
    await pendingArea.waitFor({ state: 'visible', timeout: 5000 });
    const demoTag = page2.locator('[data-testid^="pending-demo-tag-"]').first();
    await demoTag.waitFor({ state: 'visible', timeout: 5000 });
    const demoTestid = await demoTag.getAttribute('data-testid');
    const demoEventId = demoTestid.replace('pending-demo-tag-', '');
    console.log(`    ✅ 找到演示事件，id="${demoEventId}"`);

    // 读取演示事件标题
    const pendingEventEl = page2.getByTestId(`pending-event-${demoEventId}`);
    const demoTitle = await readText(pendingEventEl.locator('p.font-medium').first());
    assert(demoTitle !== '', '演示事件标题为空');
    console.log(`    ✅ 演示事件标题: "${demoTitle}"`);

    // 验证演示事件无来源链接
    const sourceCount = await pendingEventEl.locator('[data-testid^="event-source-"]').count();
    const anchorCount = await pendingEventEl.locator('a').count();
    assert(sourceCount === 0 && anchorCount === 0,
      `演示事件不应有来源链接（source testid=${sourceCount}, anchor=${anchorCount}）`);
    console.log(`    ✅ 演示事件无来源链接（source testid=${sourceCount}, anchor=${anchorCount}）`);

    // 滚动到 pending-month-events 并截图
    await pendingArea.scrollIntoViewIfNeeded().catch(() => {});
    await sleep(300);
    await takeScreenshot(page2, '04-demo-event.png', '演示事件（视口）', false);
  } catch (err) {
    console.error(`    ❌ 截图 4 失败: ${err.message}`);
  }
  await ctx2.close().catch(() => {});

  // ================================================================
  // 截图 5: 五个案例各有独立截图及日历统计
  // ================================================================
  console.log('\n=== 截图 5: 五个案例各有独立截图 ===');
  const ctx5 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page5 = await ctx5.newPage();
  const caseStats = {};
  let allCasesOk = true;
  try {
    for (const stock of CASES) {
      try {
        await page5.goto(DEMO_PATH(stock), { waitUntil: 'networkidle' });
        await sleep(1500);
        await page5.getByTestId('chart-wrapper').waitFor({ state: 'visible', timeout: 10000 });
        await waitForCalendarReady(page5, '2026年7月', 8000);
        const stats = await readText(page5.getByTestId('calendar-stats'));
        assert(stats !== '', `案例 ${stock} 的 calendar-stats 为空`);
        caseStats[stock] = stats;
        console.log(`    ✅ 案例 ${stock}: ${stats}`);

        // 滚动到日历区域并截图每个案例
        await page5.getByTestId('calendar-card-wrapper').scrollIntoViewIfNeeded().catch(() => {});
        await sleep(400);
        const caseFilename = `05-case-${stock}.png`;
        await takeScreenshot(page5, caseFilename, `案例 ${stock} 日历统计`, false);
      } catch (e) {
        caseStats[stock] = `读取失败: ${e.message}`;
        console.log(`    ❌ 案例 ${stock}: ${e.message}`);
        allCasesOk = false;
      }
    }

    // 断言：五个案例都必须成功读取统计
    assert(allCasesOk, '部分案例统计读取失败');
    // 断言：五个案例的统计都非空
    for (const stock of CASES) {
      assert(caseStats[stock] && !caseStats[stock].includes('失败'),
        `案例 ${stock} 统计无效: "${caseStats[stock]}"`);
    }

    // 汇总日志
    console.log('\n    --- 五个案例统计汇总 ---');
    for (const stock of CASES) {
      console.log(`    案例 ${stock}: ${caseStats[stock] || '(空)'}`);
    }
  } catch (err) {
    console.error(`    ❌ 截图 5 失败: ${err.message}`);
  }
  await ctx5.close().catch(() => {});

  // ================================================================
  // 截图 6: 移动端无横向溢出
  // ================================================================
  console.log('\n=== 截图 6: 移动端无横向溢出 ===');
  const mobileCtx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
  });
  const mobilePage = await mobileCtx.newPage();
  try {
    await mobilePage.goto(DEMO_PATH('300750'), { waitUntil: 'networkidle' });
    await sleep(2000);
    await mobilePage.getByTestId('chart-wrapper').waitFor({ state: 'visible', timeout: 10000 });
    await waitForCalendarReady(mobilePage, '2026年7月', 8000);

    const dims = await mobilePage.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    const noOverflow = dims.scrollWidth <= dims.clientWidth;
    console.log(`    scrollWidth=${dims.scrollWidth}, clientWidth=${dims.clientWidth}`);
    assert(noOverflow,
      `移动端有横向溢出：scrollWidth=${dims.scrollWidth} > clientWidth=${dims.clientWidth}`);
    console.log(`    ✅ 移动端无横向溢出`);

    await takeScreenshot(mobilePage, '06-mobile-no-overflow.png', '移动端无横向溢出（fullPage）', true);
  } catch (err) {
    console.error(`    ❌ 截图 6 失败: ${err.message}`);
  }
  await mobileCtx.close().catch(() => {});

  await browser.close();

  // ================================================================
  // 最终断言与截图替换
  // ================================================================
  console.log('\n========================================');
  console.log('=== 截图脚本总结 ===');
  console.log('========================================');

  // 检查临时目录中的截图文件
  const tempFiles = fs.existsSync(TEMP_DIR)
    ? fs.readdirSync(TEMP_DIR).filter((f) => f.endsWith('.png')).sort()
    : [];

  // 断言：必须有足够的截图文件
  // 期望：01 + 02 + 03 + 04 + 05-case-* (5张) + 06 = 至少 10 张
  assert(tempFiles.length >= 10,
    `截图文件数量不足：期望至少 10 张，实际 ${tempFiles.length} 张`);

  // 检查必需的截图文件
  const requiredFiles = [
    '01-node-date-sync.png',
    '02-default-case-calendar.png',
    '03-verifiable-event-with-source.png',
    '04-demo-event.png',
    '06-mobile-no-overflow.png',
  ];
  for (const f of requiredFiles) {
    assert(tempFiles.includes(f), `缺少必需截图文件: ${f}`);
  }
  // 检查五个案例截图
  for (const stock of CASES) {
    assert(tempFiles.includes(`05-case-${stock}.png`), `缺少案例截图: 05-case-${stock}.png`);
  }

  console.log(`临时目录截图 (${tempFiles.length} 张):`);
  for (const f of tempFiles) {
    const stat = fs.statSync(path.join(TEMP_DIR, f));
    console.log(`  - ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
  }

  console.log('\n--- 五个案例日历统计 ---');
  for (const stock of CASES) {
    console.log(`  案例 ${stock}: ${caseStats[stock] || '(未读取)'}`);
  }

  // 如果有任何失败，不替换正式截图，保留上一轮有效截图
  if (failures.length > 0) {
    console.log('\n--- ❌ 断言失败 ---');
    for (const f of failures) {
      console.log(`  ❌ ${f}`);
    }
    console.log(`\n❌ 共 ${failures.length} 项失败，不替换正式截图，保留上一轮有效截图。`);
    // 清理临时目录
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    process.exit(1);
  }

  // 所有断言通过，将临时截图移动到正式目录
  console.log('\n✅ 所有断言通过，开始替换正式截图...');

  // 清空正式目录中的旧截图
  if (fs.existsSync(FINAL_DIR)) {
    const oldFiles = fs.readdirSync(FINAL_DIR).filter((f) => f.endsWith('.png'));
    for (const f of oldFiles) {
      fs.unlinkSync(path.join(FINAL_DIR, f));
    }
  } else {
    fs.mkdirSync(FINAL_DIR, { recursive: true });
  }

  // 移动临时截图到正式目录
  for (const f of tempFiles) {
    fs.copyFileSync(path.join(TEMP_DIR, f), path.join(FINAL_DIR, f));
  }

  // 清理临时目录
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });

  console.log(`\n✅ 正式截图已更新（${tempFiles.length} 张），目录: ${FINAL_DIR}`);
  const finalFiles = fs.readdirSync(FINAL_DIR).filter((f) => f.endsWith('.png')).sort();
  for (const f of finalFiles) {
    const stat = fs.statSync(path.join(FINAL_DIR, f));
    console.log(`  - ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
  }
  console.log('\n✅ 所有步骤均成功完成，无错误。');
}

main().catch((err) => {
  console.error('截图脚本执行失败:', err);
  failures.push(`脚本异常: ${err.message}`);
  // 清理临时目录
  try {
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  } catch {
    // ignore
  }
  process.exit(1);
});
