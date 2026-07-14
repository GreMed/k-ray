# K-Ray 项目阶段状态记录

> 最近更新：2026-07-14（第十五阶段 B1 已封板通过）
> 维护说明：本文件仅记录各阶段封板状态与冻结边界，不作为需求文档。修改业务代码前请先核对本文件的冻结边界。

---

## 第七阶段 A：真实公告数据可行性验证（已封板）

**状态**：已封板，公告数据服务层、验证脚本、开发验收入口、测试全部冻结，不再修改。

**结论**：
- 公告服务层架构验证完成，mock / real / fallback 三模式可用。
- 验证脚本退出码可靠，来源链接校验已加固。
- 巨潮资讯网页内部接口未通过真实公告源可用性验证，不能作为可靠免费公告 API。
- 当前不能进入第七阶段 B，需等待新的合规、稳定、可追溯公告数据源方案。

**冻结边界**：
- 不得修改公告服务层代码。
- 不得探索巨潮网页内部接口。
- 不接新闻，不接 AI 归因。
- 不进入第七阶段 B，直到有新的公告数据源方案。

---

## 第八阶段：全 A 股日 K 查询 MVP（已封板）

**状态**：已封板通过，不再修改已通过功能。

**能力清单**：
- 支持输入任意合法沪深 A 股代码；
- 自动识别 SH / SZ 市场（600xxx/601xxx/603xxx/605xxx/688xxx→SH；000xxx/001xxx/002xxx/003xxx/300xxx→SZ）；
- 使用 BaoStock 查询真实历史日 K（前复权日线）；
- 真实行情默认开启；
- 验证股票：600519.SH / 000001.SZ / 300750.SZ / 688981.SH 均可查询；
- 非法代码、空 K 线、BaoStock 请求失败均有明确用户提示；
- 真实查询失败显示错误原因，不自动 fallback 到演示数据。

**交付质量**：
- `npm test -- --runInBand`：263 passed，无 React act warning；
- `npm run lint`：0 errors / 0 warnings；
- `npm run build`：成功。

**文案规则**：
- 真实行情模式按钮/状态文案使用“查询”系列：查询日K（按钮）/ 查询行情中...（加载）/ 日K查询结果（结果标题）/ 重新查询（重置）。
- Mock 演示模式保留“复盘”系列文案。

---

## 第九阶段：关键股价节点识别与复盘入口（已封板）

> 以下为第九阶段封板时的能力边界记录。第十阶段 B 已在此基础上接入新闻候选能力，相关用户可见文案已在第十阶段 B 验收修复中同步更新为"当前可查看与关键节点时间邻近的新闻候选"。

**状态**：已封板通过，不再修改已通过功能。基于真实 A 股历史日 K 数据识别关键股价节点，在图表和详情区清晰呈现。

**能力清单**：
- 基于日 K 数据自动识别四类关键股价节点：单日显著上涨（≥+5%）、单日显著下跌（≤-5%）、阶段高点（前后5日最高）、阶段低点（前后5日最低）；
- 图表中标记关键节点，支持点击查看详情；
- 关键节点列表区域展示日期、类型、涨跌幅，支持点击打开详情；
- 节点详情抽屉展示股票代码、日期、类型、收盘价、涨跌幅、成交量、行情事实说明；
- 固定风险提示："该节点仅表示行情波动特征，不代表已确认的涨跌原因。事件关联功能尚未接入。"
- evidenceLevel 固定为 market_data_only，页面展示"仅基于行情数据识别，尚未接入事件解释"；
- 开发验收入口支持：加载有节点样本、加载空状态样本、直接打开第一个节点详情；
- 开发验收样本明确标注"开发验收样本 · 非真实行情"。

**节点规则**：
- 阈值集中配置在 utils/keyNodeConfig.ts（significantUpThreshold=5, significantDownThreshold=-5, localExtremumWindow=5）；
- 同日多规则命中按优先级去重：显著上涨/下跌（优先级1）> 阶段高点/低点（优先级2）；
- 任意连续 60 个交易日最多展示 8 个节点（滑动窗口算法，非固定分桶）；限流排序分类型处理：显著上涨/下跌按绝对涨跌幅从大到小保留，阶段高点/低点按日期从早到晚保留，最终以完整稳定 ID 字符串排序作为 tiebreaker；
- 稳定 ID 格式：`节点类型:股票代码:日期`，不依赖数组位置；
- 前后不足 5 个交易日的数据不参与阶段高低点识别。

**交付质量**：
- `npm test -- --runInBand`：333 passed（含第九阶段算法与前端测试），无 React act warning；
- `npm run lint`：0 errors / 0 warnings；
- `npm run build`：成功；
- BaoStock 真实联调：600519.SH、2026-04-10 至 2026-07-10、62 根前复权日 K；
- 真实行情识别出 6 个关键股价节点；
- 第九阶段截图脚本退出码 0。

**真实验收截图**：
- `screenshots_phase9/01-phase9-real-market-with-nodes.png` — 真实行情查询后：真实 K 线 + 关键股价节点 + 无事件列表
- `screenshots_phase9/02-phase9-node-detail-volume.png` — 真实行情节点详情：含成交量变化与风险提示

**开发验收截图**：
- `screenshots_phase9/03-phase9-dev-sample-with-nodes.png` — 开发验收有节点样本
- `screenshots_phase9/04-phase9-dev-sample-empty.png` — 开发验收空状态样本
- `screenshots_phase9/05-phase9-dev-sample-mobile.png` — 移动端节点列表与详情

**严格边界**：
- 仅基于行情数据识别节点，不解释涨跌原因；
- 不接公告、新闻、市场传闻、资金流、AI 归因；
- 不显示"上涨原因""下跌原因""利好""利空"等结论；
- 不给买卖建议、涨跌预测或目标价；
- 不修改第七阶段 A 公告服务层；
- 不破坏第八阶段已通过的 A 股真实日 K 查询能力；
- 无真实事件数据时不使用 Mock 事件解释真实行情。

**冻结边界**：
- 不修改已通过的关键节点识别规则；
- 不修改任意连续 60 日最多 8 个节点的规则；
- 不修改真实行情与 Mock 内容分离规则；
- 不将行情节点描述成已确认的涨跌原因；
- 后续事件接入必须作为新阶段单独开发和验收。

---

## 第十阶段 A：真实个股新闻数据源可行性验证（已封板通过）

**状态**：已封板通过，不再修改已通过功能。用户于 2026-07-11 正式验收通过，封板决定日期为 2026-07-11（真实上游联调和截图产物日期仍保留其实际生成日期 2026-07-10）。本阶段只验证数据源可行性，不正式接入事件流。

**目标**：验证 AKShare 的 `stock_news_em` 接口能否稳定获得"与指定股票有关、带发布时间、带来源、带原文链接"的真实事件候选。

**数据来源链路**：
- 数据获取工具：AKShare（开源 Python 库）；
- 上游平台：东方财富（非官方开放 API）；
- 不代表已获得商业转载授权。

**能力清单**：
- 独立的新闻候选数据服务层 `services/eventNews/`，包含 types、stockRelevance、newsDedup、cache、akshareNewsProvider、mockProvider、index（三模式切换）；
- 独立 API `/api/event-news`，参数校验（6 位代码、SH/SZ、代码与市场交叉校验）；
- 独立开发验收页面 `/dev-event-sources`；
- 独立验证脚本 `npm run verify:event-news`；
- 独立模式 `EVENT_NEWS_MODE=mock | real | fallback`，不复用公告或行情服务模式；
- 股票相关性验证（verified / unverified）；
- 稳定 ID（URL 优先，否则标题+时间+来源哈希）与去重；
- URL 验证（拒绝 localhost、内网、0.0.0.0、127.0.0.0/8、169.254.0.0/16、::1、IPv6 私网和链路本地地址、带凭据地址）；
- 发布时间必须真实可解析（拒绝 2026-99-99、25:61:61、2026-02-30 等无效日期）；
- 缓存键包含数据模式，避免 mock/real/fallback 串缓存；
- 时间覆盖范围记录（总数、最早、最晚时间）；
- dev-only `refresh=1` 参数绕过服务缓存（仅 NODE_ENV=development），API 返回 `cacheStatus: hit|miss|bypass`；
- Mock 数据根据当前查询股票生成主体（600519→贵州茅台、000001→平安银行、300750→宁德时代、688981→中芯国际），不固定显示某一只股票。

**数据模型**：
- `NewsEventCandidate`：id、queryStockCode、title、excerpt、publishedAt、publisher、originalUrl、acquisitionProvider（real 模式为 akshare，mock/fallback 模式为 mock）、upstreamPlatform（real 模式为 eastmoney，mock/fallback 模式为 mock）、matchedStockCodes、stockRelevanceStatus、verificationReason、dataMode、isRealEventCandidate（mock/fallback 必须为 false）、isMultiStockSummary（多股汇总候选）、fetchedAt。
- `EventNewsResultMeta`：provider、upstreamPlatform、sourceLabel、dataMode、isRealData、fetchedAt、totalCount、deduplicatedCount、verifiedCount、unverifiedCount、validUrlCount、invalidUrlCount、multiStockSummaryCount、earliestPublishedAt、latestPublishedAt、fallbackReason（仅 fallback）、cacheStatus（hit/miss/bypass，bypass 仅 dev/验证环境）。

**股票相关性验证规则**（封板修复后严格规则）：
- `verified` 的产品含义：新闻标题已经能够确认目标公司是主要新闻主体。正文提及、股票列表出现、履历关系、指数代码或板块成分，只能视为候选线索，不能 verified。
- `extractStockCodes` 提取六位数字后必须再用 `isValidEventNewsAShareCode` 过滤（支持 301xxx 创业板前缀），确保只保留符合沪深 A 股代码前缀的数字（142472、335366 等不得识别为股票代码）；
- 删除"茅台""平安""宁德""中芯"等过宽简称匹配，只使用完整证券简称（贵州茅台、平安银行、宁德时代、中芯国际）；
- "中国平安"不能因为包含"平安"而匹配平安银行；"宁德市"不能匹配宁德时代；"茅台镇"不能匹配贵州茅台；
- 不能因查询参数是某股票代码就标记全部结果为该股票新闻；
- 判断顺序（严格按序）：
  1. 缺少格式合格来源链接 → unverified，isRealEventCandidate=false；
  2. 标题属于榜单、板块、资金流、ETF、指数、融资、大宗交易或"等N股"（正则 `/等\s*\d+\s*股/`）、"等多股"、"多家公司"、"多只股票"、"多只个股"等多主体内容 → unverified，isMultiStockSummary=true，isRealEventCandidate=false（该判断早于证券简称和代码 verified 判断）；
  2.5. 标题同时出现目标代码和其他有效股票代码 → 多主体结构，unverified，isMultiStockSummary=true；
  3. 标题明确包含目标公司完整证券简称，并且不是汇总/多主体标题 → verified，isRealEventCandidate=true；
  4. 标题只出现股票代码（无其他股票代码）→ 只有能结合市场明确确认时才 verified；000001 必须特别处理（只有出现"平安银行"、000001.SZ、SZ000001 等明确身份时才 verified；"上证指数（000001）"必须 unverified）；
  5. 目标公司或代码只出现在正文 → 一律 unverified，验证理由写明"仅正文提及，不能确认目标公司是新闻主体"，isRealEventCandidate=false；
  6. 标题属于其他公司，但正文提到目标公司的任职经历、合作方、同行对比或板块成分 → unverified，不得成为真实事件候选。
- 分别提取 `titleStockCodes` 和 `bodyStockCodes`，禁止只使用 `title.includes(targetStockCode)` 判断代码主体，避免目标代码只是较长数字的一部分（如 `160051900元` 中的 `600519` 不应识别为目标代码）；
- `verifyStockRelevance` 接收目标 market，以区分 000001.SZ（平安银行）与上证指数代码（000001）；
- 多股汇总候选不得设置 isRealEventCandidate=true；
- 金额、指数编号和普通六位数字不能仅凭格式就认定为目标股票。

**交付质量**（封板最终结果，2026-07-11 验收通过）：
- `npm test -- --runInBand`：542 passed（含第十阶段 A 算法、前端、验证脚本自动化测试），无 React act warning；
- `npm run lint -- --max-warnings=0`：0 errors / 0 warnings；
- `npm run build`：成功；
- 7 张阶段截图已生成（`screenshots_phase10a/01-07`）；
- 验证脚本支持 `VERIFY_EXPECTED_MODE=mock|real|fallback` 强制模式检查，模式不符退出码 1；
- 验证脚本支持 dev-only `refresh=1` 参数绕过服务缓存，两轮请求都断言 `cacheStatus=bypass`；
- 验证脚本必填字段检查（结果级 + 单条新闻），字段缺失退出码 1；
- 验证脚本 ID 重合率低于 80% 时退出码 1，措辞为"短时间内两次独立请求结果的一致性"；
- 验证脚本根据模式分别输出报告 `reports/phase10a-{mode}-verification.txt`，避免互相覆盖；
- 验证脚本自动化测试证明：模式不符退出 1、必填字段缺失退出 1、cacheStatus 非 bypass 退出 1、ID 重合率不足退出 1；
- 验证器与测试使用同一份共享实现 `scripts/verifyCore.cjs`（CommonJS），verify_event_news.mjs 和 Jest 测试导入同一文件，不存在重复实现；
- 四只股票两轮独立请求（绕过缓存）真实验证原始摘要保存于 `reports/phase10a-real-verification.txt`；
- 截图脚本生成 7 张截图，运行前清理旧截图，断言模式徽标/股票代码/新闻列表/来源链接/覆盖限制提示/error-state/fallbackReason/Mock verified+unverified+多股汇总/移动端无横向溢出。

**四只股票两轮独立请求结果**（AKShare stock_news_em，2026-07-10，refresh=1 绕过缓存）：
- 两轮请求均通过 `cacheStatus=bypass` 断言，确认每轮都调用了真实 provider；
- 两轮 ID 重合率 ≥ 80%，完成短时间两次独立请求一致性验证；
- 具体统计数据见 `reports/phase10a-real-verification.txt`；
- 不再宣布"数据源长期稳定"，仅记录"短时间内两次独立请求结果的一致性"。

**时间覆盖范围结论**：
- stock_news_em 只返回近期约 2-3 周的 10 条新闻；
- 不支持指定历史区间查询；
- 不足以覆盖用户选择的关键股价节点日期（第九阶段节点可追溯数月）；
- 开发验收页面明确提示："当前候选来源只提供有限的近期新闻，不能用于完整历史复盘"。

**链接统计**：格式合格链接（均为 HTTP/HTTPS 合法地址，未做 HTTP 可访问性检查，文案为"格式合格链接"）。

**失败和降级机制**（封板修复后）：
- mock 模式：仅返回明确标注的本地演示新闻，acquisitionProvider=mock、upstreamPlatform=mock、isRealEventCandidate=false，不冒充 AKShare 或东方财富；
- real 模式：只返回真实接口结果，acquisitionProvider=akshare、upstreamPlatform=eastmoney，接口失败时报错，禁止偷偷返回 Mock；
- fallback 模式：真实接口失败后降级为 Mock，结果 dataMode 标记为 fallback 并附 fallbackReason，acquisitionProvider/upstreamPlatform 保持 mock 标识不冒充 AKShare；
- real 模式空结果为真实空状态，不补 Mock。

**验收截图**（封板修复后 7 张，文件名包含 real/mock/fallback）：
- `screenshots_phase10a/01-phase10a-real-600519.png` — 600519 real 真实查询结果
- `screenshots_phase10a/02-phase10a-real-000001.png` — 000001 real 真实查询结果
- `screenshots_phase10a/03-phase10a-mock-verified.png` — Mock verified/unverified/多股汇总 状态
- `screenshots_phase10a/04-phase10a-real-300750-links.png` — 300750 real 来源链接
- `screenshots_phase10a/05-phase10a-real-error.png` — real 模式真实服务失败（合法代码 600519 + 脚本路径不存在，非 400 参数错误）
- `screenshots_phase10a/06-phase10a-fallback.png` — fallback 降级状态
- `screenshots_phase10a/07-phase10a-mock-mobile.png` — 移动端 Mock 页面（断言查询控件可见、无横向溢出）

**独立体验入口**：
- 页面：`http://localhost:3000/dev-event-sources`；
- 环境安装：`python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`；
- 启动命令：在 `k-ray-app` 目录执行 `EVENT_NEWS_MODE=real npm run dev`，浏览器访问上述地址（无需预设 Python 环境变量，服务层会优先使用 AKSHARE_PYTHON_PATH，其次 .venv/bin/python，最后 python3）；
- 验证脚本：`VERIFY_EXPECTED_MODE=real node scripts/verify_event_news.mjs`（必须设置预期模式，两轮独立请求均通过 refresh=1 绕过缓存，断言 cacheStatus=bypass，模式不符退出码 1，ID 重合率低于 80% 退出码 1）。

**数据授权风险**：
- AKShare 是数据获取工具，东方财富是上游平台，非官方开放 API；
- AKShare 开源不代表已获得上游内容的商业转载授权；
- 本阶段不得宣布该数据源可直接用于正式商业产品；
- unverified 数据只能出现在开发验收页面，不能进入未来正式事件流。

**最终产品结论**（封板通过）：
- AKShare 新闻来源仅为"真实新闻候选来源"，不作为正式商业数据源；
- 已完成严格股票相关性筛选（verified 仅限标题能确认目标公司是主要新闻主体的新闻）、真实上游绕过缓存验证（两轮 cacheStatus=bypass）与可追溯链接展示（格式合格来源链接）；
- **不得将新闻候选直接解释为股价涨跌原因**；
- **不得作为投资建议或预测**；
- 时间覆盖严重不足（仅近期 2-3 周，不支持历史区间），无法支撑关键股价节点的历史复盘；
- 多数结果为多股汇总类新闻，个股归属需逐条人工复核；
- 授权风险不明确，不能直接用于正式商业产品。

**封板冻结边界**（2026-07-11 封板通过后）：
- 不修改第十阶段 A 已通过的新闻服务层、筛选规则、验证脚本、测试和截图；
- 不修改第八阶段真实行情查询逻辑；
- 不修改第九阶段关键节点识别算法；
- 不修改第七阶段 A 公告服务层；
- 不把新闻接入主复盘页面；
- 不把新闻绑定到关键股价节点；
- 不做 AI 归因、摘要、情绪判断或影响评分；
- 不生成"该新闻导致股价上涨/下跌"等结论；
- 不抓取或长期保存新闻全文；
- 不进入第十阶段 B；
- 不接公告、资金流、市场传闻或 AI 归因；
- 不用 Mock 新闻冒充真实新闻。

---

## 第十阶段 B：关键节点—事件候选关联体验（已封板通过）

**状态**：已封板通过，不再修改已通过功能。用户于 2026-07-11 正式验收通过，封板决定日期为 2026-07-11。将第九阶段关键股价节点与第十阶段 A 新闻候选来源连接，在主复盘页面提供可核验的事件候选阅读入口。

**目标**：为"股价复盘图"建立可核验的事件候选阅读入口。用户点击关键股价节点后，看到该节点附近时间内、与该股票可能相关的新闻候选，并能打开原始链接自行判断。不做 AI 归因、投资建议或涨跌预测。

**能力清单**：
- 点击关键股价节点（K 线图标记或列表项）打开右侧抽屉；
- 抽屉展示三部分内容：
  1. 关键节点信息：股票代码、日期、收盘价、涨跌幅、节点类型、成交量；
  2. 检索范围：节点日前后各 3 个自然日（窗口起止日期明确展示）；
  3. 事件候选列表：按发布时间排序，每条候选展示标题、发布时间、来源平台、原文链接、相关性状态（已验证相关 / 待人工确认）、列入理由；
- 模式徽标区分 Real / Mock / Fallback 三种数据来源；
- 阅读提示："以上内容仅供复盘查阅，不构成涨跌原因或投资建议。新闻候选与股价节点的关联仅基于时间窗口，不代表因果关系。请打开原文链接自行判断。"
- 保留第十阶段 A 的 real / mock / fallback 模式区分；
- 空状态明确显示"暂无可核验的事件候选"，不用 Mock 冒充真实结果；
- 请求失败时显示"检索失败"与错误信息；
- Fallback 降级时显示降级说明；
- 待人工确认（unverified）内容显示"待人工确认"徽标，不显示为"已验证相关"；
- 多股汇总候选额外显示"多股汇总"徽标。

**用户体验入口及操作步骤**：
1. 启动开发服务器：`npm run dev`（默认真实行情模式，EVENT_NEWS_MODE 默认 mock）；
2. 输入 A 股代码（如 600519）并查询日 K；
3. K 线图和列表中显示关键股价节点标记；
4. 点击任意关键节点标记或列表项；
5. 右侧弹出抽屉，展示节点信息、检索范围和事件候选列表；
6. 点击候选的原文链接可跳转原始页面；
7. 开发验收入口：DevToolsPanel 中的"加载有节点样本"按钮可加载固定开发样本，不依赖 BaoStock。

**修改文件**：
- 新建 `services/nodeEvents/types.ts` — 第十阶段 B 类型定义（NodeEventQuery / NodeEventCandidateMeta / NodeEventCandidateResult）；
- 新建 `services/nodeEvents/index.ts` — 第十阶段 B 服务层（日期窗口过滤、Mock 候选生成、real/fallback 转换），不修改第十阶段 A 的 mockProvider；
- 新建 `app/api/node-event-candidates/route.ts` — 第十阶段 B API 路由（参数校验：stockCode/market/nodeDate/windowDays）；
- 新建 `components/NodeEventDrawer.tsx` — 第十阶段 B 核心 UI 组件（抽屉式面板，含节点信息、检索范围、事件候选、阅读提示）；
- 修改 `app/page.tsx` — 集成 NodeEventDrawer，点击关键节点时打开抽屉（原 MarketKeyNodeDrawer 保留用于 DevToolsPanel 直接打开）；
- 新建 `__tests__/phase10b.test.ts` — 第十阶段 B 服务层测试（38 个测试）；
- 新建 `__tests__/phase10b-frontend.test.tsx` — 第十阶段 B 前端测试（10 个测试）；
- 新建 `scripts/screenshots_phase10b.mjs` — 第十阶段 B 截图脚本（6 张截图，含断言）；
- 修改 `__tests__/phase9-frontend.test.tsx` — 适配 NodeEventDrawer 变更（点击关键节点现在打开 node-event-drawer 而非 market-node-drawer）；
- 修改 `jest.config.js` — 添加 `process.env.TZ = 'UTC'` 解决日期偏移问题。

**真实与 Mock 数据边界**：
- Mock 模式（EVENT_NEWS_MODE=mock）：在 nodeEvents 服务层独立生成节点日期附近的 3 条 Mock 候选（verified / unverified 多股汇总 / unverified 仅正文提及），不调用第十阶段 A 的 mockProvider，避免日期不匹配；Mock 候选明确标注 `[Mock]` 前缀和 `acquisitionProvider=mock`；
- Real 模式（EVENT_NEWS_MODE=real）：调用第十阶段 A 的 `fetchEventNews` 获取真实新闻，然后按节点日期窗口（±3 自然日）过滤；窗口内无候选时显示空状态，不补 Mock；
- Fallback 模式（EVENT_NEWS_MODE=fallback）：真实接口失败后降级为 Mock，结果携带 `fallbackReason` 和降级说明；
- 新闻发布时间必须与节点日期和查询窗口清晰区分；不可用未来新闻解释历史节点（日期窗口过滤确保只返回窗口内候选）。

**已知限制**：
- 第十阶段 A 的 AKShare `stock_news_em` 接口仅返回近期 2-3 周新闻，不支持历史区间查询；真实模式下，如果关键节点日期超出新闻覆盖范围，抽屉将显示空状态；
- 事件候选与股价节点的关联仅基于时间窗口（±3 自然日），不代表因果关系；
- 不做自动排序或"影响力评分"；
- 不新增 AI 调用；
- 多股汇总候选和仅正文提及的候选标记为"待人工确认"，不显示为"已验证相关"；
- 新闻链接文案为"格式合格链接"（HTTP 可访问性未验证）。

**交付质量**（封板最终结果，2026-07-11 验收通过）：
- `npm test -- --runInBand`：593 passed（16 suites），含第十阶段 B 服务层测试和前端测试（含图表 marker 点击端到端测试），无 React act warning；
- `npm run lint`：0 errors / 0 warnings；
- `npm run build`：成功；
- 第十阶段 B 截图脚本退出码 0，正式截图共 6 张，所有断言通过。

**验收截图**（封板最终结果，共 6 张，`screenshots_phase10b/`）：
- `01-phase10b-mock-candidates.png` — Mock 候选（verified/unverified/多股汇总）
- `02-phase10b-empty-candidates.png` — 无候选空状态
- `03-phase10b-request-error.png` — 请求失败状态
- `04-phase10b-fallback.png` — Fallback 降级状态
- `05-phase10b-mobile.png` — 移动端 Mock 候选
- `06-phase10b-real-empty.png` — 真实行情+关键节点+真实新闻空状态

**真实联调结论**（封板时）：
- 真实行情（BaoStock）与关键股价节点加载成功；
- 当前真实新闻窗口内无候选（AKShare `stock_news_em` 仅返回近期 2-3 周新闻，关键节点日期超出覆盖范围），因此展示真实空状态（`06-phase10b-real-empty.png`）；
- **不得将真实空状态描述为真实新闻候选**；真实空状态就是"窗口内无候选"的事实；
- 截图脚本等待真实联调最终状态（最多 30 秒轮询 `node-event-empty` / `node-event-candidate-list` / `node-event-error` 三种状态之一），最终状态为 `empty`；
- 不得通过扩大时间窗口、改写节点日期、注入 Mock 或放宽相关性规则来制造真实候选结果；
- 截图脚本采用临时目录策略：全部场景断言成功后才整体替换正式截图目录，失败时保留上一轮有效截图。

**开发边界遵守**：
- 不修改第八阶段已通过的行情查询逻辑；
- 不修改第九阶段已通过的关键节点识别规则（marketKeyNodes 由 page.tsx 的 useMemo 派生，detectKeyNodes 未修改）；
- 不修改第十阶段 A 已封板的新闻服务层、筛选规则、验证脚本和测试（nodeEvents 服务层在 eventNews 上层做日期窗口过滤，不修改 eventNews 代码）；
- 不新增 AI 调用；
- 不做自动排序或"影响力评分"；
- 不接入公告、资金流、市场传闻、未来事件日历或 AI 归因。

---

## 第十一阶段 A：用户维护的未来事件日历（已封板通过）

**状态**：已封板通过，不再修改已通过功能。用户于 2026-07-12 正式验收通过，封板决定日期为 2026-07-12。在日 K 查询结果页提供用户自行维护的未来事件日历，支持新增、编辑、删除和本地持久化。

**目标**：让用户在查看某只股票的历史复盘后，能维护自己确认过的未来事项，形成可回看、可编辑的时间表。所有事件均为用户录入，不是系统验证结论。

**能力清单**：
- 在日 K 查询结果页显示"未来事件日历 · 用户录入"区域；
- 用户可新增未来事件，字段包括：日期（必须未来）、标题、事件类别（业绩披露/股东大会/产品行业事项/自定义）、可选原始链接、用户备注；
- 用户可编辑和删除自己录入的事件；
- 事件按日期升序展示，仅展示当前查询股票的事件；
- 历史日期不可新增为未来事件；
- 新增、编辑、删除后页面立即更新；
- 本地刷新后仍保留数据（localStorage 持久化）；
- 有链接显示"已附来源链接"，无链接显示"未附来源链接"；
- 原始链接校验：仅允许 `http://` 或 `https://` 协议，非法链接不保存并显示错误提示；
- localStorage 中非法链接的旧数据渲染为"链接无效"，不生成可点击链接；
- 固定提示文案："未来事件由用户自行录入和维护，仅供时间管理与复盘参考，不代表已验证事实或价格预测。"

**日历区分方案**：
- 采用方案 A：普通用户界面不再渲染旧 Mock `FutureEventCalendar`；
- 用户只看到"未来事件日历 · 用户录入"一个日历；
- 旧 Mock 日历组件代码保留但不在正常页面展示；
- 用户录入日历在真实行情和 Mock 模式中均可用。

**修改文件**：
- 新建 `types/index.ts` 中新增 `UserFutureEvent` 和 `UserFutureEventCategory` 类型定义；
- 新建 `services/userFutureEvents/index.ts` — localStorage 服务层（按 stockCode 隔离，稳定 id，CRUD 操作，`isFutureDate` 和 `isValidEventUrl` 校验函数）；
- 新建 `components/UserFutureEventCalendar.tsx` — 日历列表组件（空状态、固定提示、删除确认弹窗、按日期升序、非法链接显示"链接无效"）；
- 新建 `components/UserFutureEventForm.tsx` — 新增/编辑表单组件（懒初始化 + key 重新挂载，日期校验，链接协议校验）；
- 修改 `app/page.tsx` — 集成用户未来事件日历与表单，移除旧 Mock `FutureEventCalendar` 渲染，新增状态管理、事件处理函数、ESC 键优先级（8）、开发验收入口；
- 修改 `components/DevToolsPanel.tsx` — 新增 3 个开发验收入口按钮（载入样本/打开新增表单/清空事件），移除旧 Mock 日历的"显示空状态"按钮；
- 新建 `__tests__/phase11a.test.tsx` — 15 个测试场景（含链接校验和回归测试）；
- 新建 `scripts/screenshots_phase11a.mjs` — 截图脚本（临时目录保护策略）。

**产品边界**：
- 未来事件均为用户录入，不是系统验证结论；
- 数据只保存在当前浏览器本地，按股票代码隔离；
- 仅允许 `http://` / `https://` 来源链接；
- 不提供未来价格预测、影响判断或投资建议；
- 不显示"利好""利空""可能上涨""可能下跌"等影响判断；
- 不接入外部公告、新闻、资金流、市场传闻、AI 归因或账户同步；
- 不使用 Mock 事件冒充真实未来事项。

**数据隔离与持久化**：
- localStorage key 格式：`k-ray:user-future-events:{stockCode}`；
- 每条事件有稳定 id（`ufe-{timestamp}-{random}`），编辑/删除不依赖数组位置；
- 切换股票不会串数据。

**交付质量**（封板最终结果，2026-07-12 验收通过）：
- `npm test -- --runInBand`：608 passed（17 suites），含第十一阶段 A 的 15 个测试场景，无 React act warning；
- `npm run lint`：0 errors / 0 warnings；
- `npm run build`：成功；
- 第十一阶段 A 截图脚本退出码 0，正式截图共 5 张，所有断言通过。

**验收截图**（封板最终结果，共 5 张，`screenshots_phase11a/`）：
- `01-phase11a-empty-calendar.png` — 空日历（用户可清晰识别"未来事件日历 · 用户录入"）
- `02-phase11a-add-event.png` — 新增事件表单
- `03-phase11a-edit-event.png` — 编辑事件
- `04-phase11a-delete-confirm.png` — 删除确认弹窗
- `05-phase11a-mobile.png` — 移动端

**冻结边界**（2026-07-12 封板通过后）：
- 不修改用户未来事件 CRUD、本地保存、链接校验、数据隔离和截图保护逻辑；
- 不重新启用旧 Mock 未来事件日历；
- 不接入外部公告、新闻、资金流、市场传闻、AI 归因或账户同步。

---

## 第十四阶段 A1：沪深真实行情核心链路封板修复（已封板通过）

**状态**：已封板通过，不再修改已通过功能。用户于 2026-07-14 正式验收通过，封板决定日期为 2026-07-14。

**封板日期**：2026-07-14

**目标**：修复沪深真实行情核心链路，确保普通用户始终使用真实行情、严格校验上市股票、修复十字线日期格式、修正数据起始日提示、清理错误页 Mock 降级残留、统一异常状态码与错误文案。

**能力清单**：
- 普通用户默认且始终使用真实历史日 K（`getMarketDataMode` 未配置或非法值默认 `real`）；
- 前端 isRealMarketData 保护：`meta.isRealMarketData !== true` 时不进入成功结果页，不展示 Mock K 线；
- 严格上市股票校验：`found === true`、`securityType === 'stock'`、`isListed === true` 三条件同时满足；
- 基础信息查询异常失败关闭：返回 503，不继续调用 K 线服务，SanitizedError 保留脱敏文案，普通 Error/未知异常统一返回脱敏文案不暴露内部细节；
- 十字线日期格式：`localization.timeFormatter` + `timeVisible:false` + `tickMarkFormatter` 全部 `YYYY-MM-DD`；
- 数据起始日提示：区分晚上市（IPO 日期晚于请求开始日）与周末/节假日/停牌（首根 K 线晚于请求开始日）；
- 错误页 Mock 降级残留清理：不保存 `replayResult`，页脚 `pageState === 'error'` 优先判断，统一显示"本次未展示任何行情数据"；
- 错误文案双标点修复：`normalizeTrailingPunctuation` 去除尾部标点后拼接，不出现 `。。`、`！！`、`。！`；
- 保留开发面板 Mock 验收能力（`dev-key-node-sample-*` 按钮直接注入，绕过 isRealMarketData 检查）。

**最终质量**：
- `npm test -- --runInBand`：25 个测试套件通过，911 项测试通过，无 React act warning；
- `npm run lint`：0 errors / 0 warnings；
- `npm run build`：成功。

**真实用户联调结果**：
- 输入代码：301165；
- 自动匹配公司名称：锐捷网络（SZ）；
- 选择区间：近1年；
- 成功返回 BaoStock 真实前复权日 K；
- 请求区间：2025-07-13 至 2026-07-13；
- 实际行情区间：2025-07-14 至 2026-07-13；
- 共 242 根 K 线；
- 29 个关键股价节点；
- `source=baostock`，`isRealMarketData=true`。

**错误状态验收结果**：
- BaoStock 失败时不展示行情图（无图表、无成功标题）；
- 不自动降级到 Mock（`setReplayResult(null)`）；
- 页面和页脚不出现 "Mock"、"降级" 等误导文案；
- 页脚明确显示"真实行情服务暂时不可用，本次未展示任何行情数据。"；
- 股票基础信息异常统一返回安全的 503（SanitizedError 保留脱敏文案，普通 Error 统一脱敏文案），不暴露内部异常原文。

**阶段截图**：
- `screenshots-phase14a1-final/03-baostock-failure-error-page.png` — BaoStock 失败错误页（含主体与页脚，无 Mock 降级文案）

**冻结边界**（2026-07-14 封板通过后）：
- 不修改已经通过的真实行情查询链路；
- 不修改股票名称同步逻辑；
- 不修改错误状态和页脚判断；
- 不恢复生产环境 Mock 降级；
- 后续 UI 升级、事件归因和搜索接入必须作为新阶段单独开发验收。

---

## 第十五阶段 A：核心复盘 Mock 闭环体验（已封板通过）

> **历史阶段说明**：第十五阶段 A 记录的是 Mock 体验页在当时的封板状态。该用户体验页已于第十五阶段 B1 被静态真实历史案例替代，以下内容仅作为历史里程碑记录，不代表当前 /demo/core-replay 的产品状态。

**状态**：已封板通过，不再修改已通过功能。用户于 2026-07-14 正式验收通过，封板决定日期为 2026-07-14。

**封板日期**：2026-07-14

**目标**：让普通用户能够完整体验 K-Ray 最核心的产品价值闭环：查看股价关键节点 → 阅读 AI 复盘要点 → 查看事件候选 → 理解候选与行情节点的关系及核验边界。不接入真实 AI、搜索 API 或 API Key 调用。

**最终质量**：
- `npm test -- --runInBand`：26 个测试套件通过，963 项测试通过；
- `npm run lint`：0 errors / 0 warnings；
- `npm run build`：成功，`/demo/core-replay` 构建成功；
- 5 张阶段截图生成；
- 1440×900 首屏布局断言通过（节点切换入口、AI 复盘要点、第一条事件候选均在 viewport 内）。

**最终用户能力**：
- 首页提供"体验完整AI复盘示例"普通用户入口（不放在开发面板中，不要求用户知道开发路由）；
- 独立 Mock 页面 `/demo/core-replay` 展示宁德时代（300750）固定复盘案例；
- 三个关键节点可以切换（单日显著上涨 2024-09-24、阶段高点 2024-10-08、单日显著下跌 2024-10-16）；
- 首屏展示 K 线、节点切换入口、AI 复盘要点和事件候选（1440×900 不滚动可见）；
- 候选展示时间距离、候选类型（公司/行业/上下游/市场）、候选理由和 Mock 待核验状态；
- 分析链路区分行情事实、可能相关线索和尚未确认部分。

**数据边界**：
- `/demo/core-replay` 为 100% Mock 演示；
- 不发起搜索或 AI 网络请求；
- 不使用 API Key；
- 不写入本地存储；
- 无真实原文链接；
- 不构成已确认的涨跌原因；
- 不影响首页 BaoStock 真实行情查询。

**阶段截图**：
- `screenshots-phase15a/01-home-entry.png` — 首页体验入口
- `screenshots-phase15a/02-default-firstscreen.png` — 1440×900 默认节点首屏
- `screenshots-phase15a/03-second-node-firstscreen.png` — 第二个节点首屏
- `screenshots-phase15a/04-full-page.png` — 完整页面
- `screenshots-phase15a/05-mobile.png` — 移动端页面

**冻结边界**（2026-07-14 封板通过后）：
- 第十五阶段 A 的 Mock 记录和历史截图仅作为阶段归档保留；当前 /demo/core-replay 的有效产品基准以第十五阶段 B1 为准。不得将旧 Mock 内容恢复到当前用户体验入口，也不得把 Mock 内容混入真实行情查询。
- 不把 Mock 候选描述为真实核验结果；
- 后续真实 AI 检索必须作为新阶段单独开发和验收。

---

## 第十五阶段 B1：静态真实历史复盘案例（已封板通过）

**状态**：已封板通过，不再修改已通过功能。用户于 2026-07-14 正式验收通过，封板决定日期为 2026-07-14。

**封板日期**：2026-07-14

**目标**：将 `/demo/core-replay` 从 Mock 数据改造为基于真实历史行情和真实公开资料制作、预先存储在项目中的静态历史复盘案例。不实时查询，不接入实时 AI，所有行情数字、日期、事件标题、来源和链接必须能复核。

**已完成能力**：
1. 宁德时代 300750.SZ 静态真实历史案例；
2. BaoStock 真实前复权日 K 静态快照；
3. 案例区间：2024-09-01 至 2025-02-28；
4. 实际行情区间：2024-09-02 至 2025-02-28；
5. 共 116 根日 K；
6. 共 4 个关键股价节点；
7. 共 6 条节点资料，对应 6 个不同的可追溯来源链接；
8. 支持节点切换、资料详情展开和原文跳转；
9. 静态复盘摘要明确标注非实时生成，不把时间邻近资料认定为涨跌原因；
10. 无合格资料时显示真实空状态，不使用 Mock 或无来源推断补位；
11. 申万三级板块数据没有可靠来源时显示"板块数据暂缺"；
12. 页面运行时不请求实时行情、新闻或 AI。

**可信度修复记录**：
1. 证监会"并购六条"使用 2024-09-24 中国证监会主站原始页面（http://www.csrc.gov.cn/csrc/c100028/c7508366/content.shtml）；
2. 所有资料的 `timeDistanceDays` 均根据发布时间和节点日期自动校验（UTC 日期逻辑）；
3. 事后发布资料不得显示为节点前资料；
4. 清理"政策驱动""情绪集中释放""获利了结压力"等确定性原因表达；
5. 无资料节点不再使用春节、市场情绪、资金或技术调整等无来源解释；
6. sourceList 与节点资料的标题、来源、发布时间和 URL 保持一致。

**最终质量**：
- `npm test -- --runInBand`：27 个测试套件通过，1001 项测试通过；
- `npm run lint`：0 errors / 0 warnings；
- `npm run build`：成功；
- 截图脚本：退出码 0；
- 正式截图：6 张（位于 `screenshots_phase15b1/`）；
- 体验入口：http://localhost:3000/demo/core-replay。

**阶段截图**：
- `screenshots_phase15b1/01-full-firstscreen.png` — 案例完整首屏
- `screenshots_phase15b1/02-node-with-materials.png` — 包含真实事件资料的节点
- `screenshots_phase15b1/03-material-detail-open.png` — 事件详情打开状态
- `screenshots_phase15b1/04-empty-materials.png` — 没有合格资料时的真实空状态
- `screenshots_phase15b1/05-sw-level3-missing.png` — 申万三级数据暂缺状态
- `screenshots_phase15b1/06-desktop-1440x900.png` — 1440×900 桌面截图

**冻结边界**（2026-07-14 封板通过后）：
1. 不修改本阶段静态行情快照；
2. 不修改已经核验的来源、发布时间和时间距离；
3. 不修改静态摘要的事实与推断分离规则；
4. 不把静态案例包装成实时 AI 归因；
5. 不补造申万三级板块数据；
6. 不在本次封板记录中开发复盘笔记、未来事件日历或其他公司案例；
7. 后续功能必须作为新阶段单独开发和验收。

---

## 当前冻结边界（适用全部后续工作）

- 不修改第九阶段已通过的关键节点识别规则；
- 不修改任意连续 60 日最多 8 个节点的规则；
- 不修改真实行情与 Mock 内容分离规则；
- 不将行情节点描述成已确认的涨跌原因；
- 不修改第八阶段已通过的日 K 查询能力；
- 不修改第七阶段 A 公告服务层；
- 第十阶段 A 已封板通过（2026-07-11），不修改已通过的新闻服务层、筛选规则、验证脚本、测试和截图；
- 第十阶段 B 已封板通过（2026-07-11），不修改已通过的 NodeEventDrawer 组件、nodeEvents 服务层、API 路由、日期窗口（±3 自然日）、Mock / real / fallback 边界、截图保护策略（临时目录+整体替换）、测试和截图；
- 第十一阶段 A 已封板通过（2026-07-12），不修改已通过的用户未来事件 CRUD、本地保存、链接校验、数据隔离和截图保护逻辑，不重新启用旧 Mock 未来事件日历，不接入外部公告、新闻、资金流、市场传闻、AI 归因或账户同步；
- 第十四阶段 A1 已封板通过（2026-07-14），不修改已经通过的真实行情查询链路、股票名称同步逻辑、错误状态和页脚判断，不恢复生产环境 Mock 降级，后续 UI 升级、事件归因和搜索接入必须作为新阶段单独开发验收；
- 第十五阶段 A 为历史 Mock 体验里程碑，已由第十五阶段 B1 替代当前 /demo/core-replay 用户入口；保留历史记录和截图，不恢复旧 Mock 页面，不把 Mock 候选描述为真实结果，不把 Mock 内容混入真实股票查询；
- 第十五阶段 B1 已封板通过（2026-07-14），不修改本阶段静态行情快照、已核验来源与时间距离、静态摘要的事实与推断分离规则，不把静态案例包装成实时 AI 归因，不补造申万三级板块数据，复盘笔记、未来事件日历、多公司案例必须作为新阶段单独开发和验收；
- 不做 AI 归因、摘要、情绪判断或影响评分；
- 不接公告、资金流、市场传闻、AI 归因、情绪判断、影响评分或投资建议；
- 不得将真实空状态描述为真实新闻候选；
- 后续如需提升历史新闻覆盖率，必须作为新阶段单独立项与验收；
- 后续事件接入必须作为新阶段单独开发和验收。

---

## 后续阶段交付要求

- 阶段性交付时必须提供“用户体验入口”（可视化体验页面或可操作的开发面板入口），便于直接验证功能效果，而非仅通过单元测试或 API 调用验证。
