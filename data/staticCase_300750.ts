// 第十五阶段 B1：宁德时代（300750.SZ）静态真实历史复盘案例
//
// 本案例基于真实历史行情和真实公开资料制作，预先存储在项目中。
// - 行情数据：来自 BaoStock 前复权日线，一次获取后保存为静态快照
// - 事件资料：所有标题、发布时间、来源和链接均可复核
// - 复盘摘要：基于公开资料预生成，非实时 AI 生成
// - 申万三级数据：当前未取得可靠来源，全部为 null
//
// 严格边界：
// - 页面运行时不请求行情、新闻或 AI 接口
// - 不得将事件写成确定性因果关系
// - 不得使用 example.com 或虚构链接
// - 不标记为实时数据或 Mock 数据

import { StaticHistoricalCase } from '@/types';
import { snapshot_300750_klines, snapshot_300750_meta } from './staticCase_300750_snapshot';
import { getCaseBuiltInEvents } from './staticCaseEvents';

// 申万三级数据暂缺（未取得可靠来源）
const SW_LEVEL3_MISSING = {
  industryName: null,
  indexCode: null,
  changePercent: null,
  sourceUrl: null,
  collectedAt: null,
};

export const staticCase_300750: StaticHistoricalCase = {
  id: 'static-case-300750-001',
  stockCode: snapshot_300750_meta.stockCode,
  stockName: snapshot_300750_meta.stockName,
  market: snapshot_300750_meta.market,
  description:
    '宁德时代（300750.SZ）2024年9月至2025年2月静态历史复盘案例。基于BaoStock真实前复权日线和可复核的公开资料制作，展示从关键股价节点出发结合时间邻近资料理解行情波动可能相关线索的产品价值。所有行情数字和事件资料均可追溯，非实时更新。',
  caseMode: 'static_historical',
  isRealTime: false,
  isMock: false,
  requestStartDate: snapshot_300750_meta.requestStartDate,
  requestEndDate: snapshot_300750_meta.requestEndDate,
  actualFirstDate: snapshot_300750_meta.actualFirstDate,
  actualLastDate: snapshot_300750_meta.actualLastDate,
  snapshotGeneratedAt: snapshot_300750_meta.snapshotGeneratedAt,
  adjustment: snapshot_300750_meta.adjustment,
  source: snapshot_300750_meta.source,
  klines: snapshot_300750_klines,
  nodes: [
    // ========================================================================
    // 节点 1：2024-09-30 单日显著上涨 +11.06%
    // 收盘 241.10，成交量 91361145 股
    // ========================================================================
    {
      id: 'significant_up:300750:2024-09-30',
      date: '2024-09-30',
      close: 241.10,
      changePercent: 11.06,
      volume: 91361145,
      nodeType: 'significant_up',
      nodeTypeLabel: '单日显著上涨',
      marketFact:
        '收盘价 241.10 元（前复权），涨幅 +11.06%，成交量 91361145 股（约 91.36 万手），为9月下旬行情中的显著放量上涨日。',
      observationClues: [
        '9月24日国新办发布会上央行、金融监管总局、证监会联合宣布金融支持政策，时间邻近',
        '9月26日中央政治局会议部署经济工作，明确要努力提振资本市场，时间邻近',
        '当日成交量为区间内较高水平，显示资金参与度明显提升',
      ],
      unconfirmedParts: [
        '个股层面无当日公司公告，上涨驱动力尚不明确',
        '政策利好与个股上涨的时间邻近关系不等于因果关系',
        '资金流入的具体来源（机构/散户/北向等）未取得',
      ],
      materials: [
        {
          id: 'mat-300750-node1-001',
          title: '国新办举行新闻发布会 介绍金融支持经济高质量发展有关情况',
          publishedAt: '2024-09-24',
          sourceName: '国务院新闻办公室',
          sourceUrl: 'http://www.scio.gov.cn/live/2024/34875/',
          collectedAt: '2026-07-14',
          stockCode: '300750',
          nodeDate: '2024-09-30',
          timeDistanceDays: -6,
          materialType: 'policy',
          materialTypeLabel: '政策',
          excerpt:
            '2024年9月24日上午9时，国务院新闻办公室举行新闻发布会，中国人民银行行长潘功胜、国家金融监督管理总局局长李云泽、中国证券监督管理委员会主席吴清介绍金融支持经济高质量发展有关情况，宣布降准、降息、降低存量房贷利率、创设资本市场支持工具等一系列政策。',
          relevanceNote:
            '央行降准降息、证监会资本市场改革等政策与9月30日行情上涨时间邻近（相隔6天），可能提振了市场整体风险偏好，但与个股上涨不构成确定性因果关系。此为市场层面政策，非公司专属事件。',
        },
        {
          id: 'mat-300750-node1-002',
          title: '中共中央政治局召开会议 分析研究当前经济形势和经济工作',
          publishedAt: '2024-09-26',
          sourceName: '最高人民法院转载新华社',
          sourceUrl: 'https://www.court.gov.cn/xinshidai/xiangqing/443931.html',
          collectedAt: '2026-07-14',
          stockCode: '300750',
          nodeDate: '2024-09-30',
          timeDistanceDays: -4,
          materialType: 'policy',
          materialTypeLabel: '政策',
          excerpt:
            '新华社北京9月26日电 中共中央政治局9月26日召开会议，分析研究当前经济形势，部署下一步经济工作。会议强调要加大财政货币政策逆周期调节力度，要降低存款准备金率，实施有力度的降息。要努力提振资本市场，大力引导中长期资金入市。',
          relevanceNote:
            '中央政治局会议明确要努力提振资本市场，与9月30日行情上涨时间邻近（相隔4天），可能进一步强化了市场政策预期，但与个股上涨不构成确定性因果关系。此为市场层面政策，非公司专属事件。',
        },
        {
          id: 'mat-300750-node1-003',
          title: '证监会发布《关于深化上市公司并购重组市场改革的意见》',
          publishedAt: '2024-09-24',
          sourceName: '中国证券监督管理委员会',
          sourceUrl: 'http://www.csrc.gov.cn/csrc/c100028/c7508366/content.shtml',
          collectedAt: '2026-07-14',
          stockCode: '300750',
          nodeDate: '2024-09-30',
          timeDistanceDays: -6,
          materialType: 'policy',
          materialTypeLabel: '政策',
          excerpt:
            '2024年9月24日，证监会发布《关于深化上市公司并购重组市场改革的意见》（即"并购六条"），从支持向新质生产力方向转型升级、鼓励产业整合、提高监管包容度、提升重组市场交易效率、提升中介机构服务水平、依法加强监管六方面深化并购重组市场改革，并同步修订《上市公司重大资产重组管理办法》。',
          relevanceNote:
            '证监会"并购六条"于9月24日发布，与9月30日行情上涨时间邻近（节点前6天），可能影响了市场对资本市场改革的预期，但与个股上涨不构成确定性因果关系。此为市场层面政策，非公司专属事件。',
        },
      ],
      replaySummary: {
        summary:
          '9月30日宁德时代收盘241.10元，涨幅+11.06%，成交量91361145股。该交易日发生在多项资本市场政策发布之后：9月24日国新办发布会上央行、金融监管总局、证监会联合宣布金融支持政策；同日证监会发布"并购六条"；9月26日中央政治局会议部署经济工作。上述公开资料在时间上位于本节点之前6天至4天，与行情上涨可能相关，但尚不能确认政策与个股上涨之间存在因果关系。个股层面未取得当日公司公告，上涨驱动力需要更多资料验证。',
        referencedCandidateIds: ['mat-300750-node1-001', 'mat-300750-node1-002', 'mat-300750-node1-003'],
        isRealTimeAI: false,
        generatedAt: '2026-07-14',
      },
      swLevel3: { ...SW_LEVEL3_MISSING },
    },

    // ========================================================================
    // 节点 2：2024-10-08 单日显著上涨 +18.70%
    // 收盘 286.19，成交量 137646479 股（区间最大成交量）
    // ========================================================================
    {
      id: 'significant_up:300750:2024-10-08',
      date: '2024-10-08',
      close: 286.19,
      changePercent: 18.70,
      volume: 137646479,
      nodeType: 'significant_up',
      nodeTypeLabel: '单日显著上涨',
      marketFact:
        '收盘价 286.19 元（前复权），涨幅 +18.70%，成交量 137646479 股（约 137.65 万手），为整个区间的最大成交量日。注：前复权价格与当日实际交易价格（收盘299.00元）不同，涨跌幅一致。',
      observationClues: [
        '该节点为国庆假期后的首个交易日，成交量明显放大',
        '成交量为区间峰值，显示多空分歧巨大且资金参与度极高',
        '新浪证券报道当日发生3笔大宗交易，机构专用席位买入，显示机构资金参与',
        '证券日报同日发表"并购六条"政策解读文章',
      ],
      unconfirmedParts: [
        '假期前后市场表现与个股涨跌的关系尚不明确',
        '机构资金的具体动向和意图尚不明确',
        '大宗交易、政策解读与个股暴涨的时间邻近关系不等于因果关系',
      ],
      materials: [
        {
          id: 'mat-300750-node2-001',
          title: '宁德时代10月8日现3笔大宗交易 成交金额3.99亿元',
          publishedAt: '2024-10-08 17:00',
          sourceName: '新浪证券-红岸工作室',
          sourceUrl: 'https://finance.sina.cn/stock/ssgs/2024-10-08/detail-incrvsst3984515.d.html',
          collectedAt: '2026-07-14',
          stockCode: '300750',
          nodeDate: '2024-10-08',
          timeDistanceDays: 0,
          materialType: 'market',
          materialTypeLabel: '市场',
          excerpt:
            '10月8日，宁德时代收涨18.70%，收盘价为299.00元，发生3笔大宗交易，合计成交量135万股，成交金额3.99亿元。买方营业部为机构专用，卖方营业部为东海证券股份有限公司溧阳南大街证券营业部。该股近5个交易日累计上涨51.38%。',
          relevanceNote:
            '该报道记录了10月8日宁德时代的市场交易事实，包括涨幅、大宗交易和机构席位参与，与节点同日，为了解当日市场资金动向提供了可追溯的资料。',
        },
        {
          id: 'mat-300750-node2-002',
          title: '更好发挥资本市场主渠道作用 "并购六条"助力上市公司向"新"而行',
          publishedAt: '2024-10-08',
          sourceName: '证券日报（证监会山西监管局转载）',
          sourceUrl: 'http://www.csrc.gov.cn/shanxi/c106408/c7510272/content.shtml',
          collectedAt: '2026-07-14',
          stockCode: '300750',
          nodeDate: '2024-10-08',
          timeDistanceDays: 0,
          materialType: 'policy',
          materialTypeLabel: '政策',
          excerpt:
            '9月24日，证监会主席吴清在国新办新闻发布会上官宣后，证监会当日就发布《关于深化上市公司并购重组市场改革的意见》（即"并购六条"）。10月8日证券日报发表解读文章，分析"并购六条"从服务新质生产力发展、鼓励产业整合等六方面深化并购重组市场改革。',
          relevanceNote:
            '证监会"并购六条"政策解读于10月8日发表，与节点同日，可能持续影响市场对资本市场改革的预期，但与个股暴涨不构成确定性因果关系。此为市场层面政策，非公司专属事件。',
        },
      ],
      replaySummary: {
        summary:
          '10月8日为国庆假期后首个交易日，宁德时代收盘286.19元（前复权），涨幅+18.70%，成交量137646479股，为整个区间最大成交量日。据新浪证券报道，当日发生3笔大宗交易，机构专用席位买入，成交金额3.99亿元。同日证券日报发表"并购六条"政策解读文章。上述大宗交易报道与节点同日，政策解读文章也在时间上位于本节点当日。大宗交易和政策解读与行情上涨可能相关，但尚不能确认其与个股暴涨之间存在因果关系，具体驱动需要更多资料验证。',
        referencedCandidateIds: ['mat-300750-node2-001', 'mat-300750-node2-002'],
        isRealTimeAI: false,
        generatedAt: '2026-07-14',
      },
      swLevel3: { ...SW_LEVEL3_MISSING },
    },

    // ========================================================================
    // 节点 3：2024-10-09 单日显著下跌 -14.72%
    // 收盘 244.08，成交量 108691594 股
    // ========================================================================
    {
      id: 'significant_down:300750:2024-10-09',
      date: '2024-10-09',
      close: 244.08,
      changePercent: -14.72,
      volume: 108691594,
      nodeType: 'significant_down',
      nodeTypeLabel: '单日显著下跌',
      marketFact:
        '收盘价 244.08 元（前复权），跌幅 -14.72%，成交量 108691594 股（约 108.69 万手）。前一交易日收盘 286.19 元，单日回调幅度较大。',
      observationClues: [
        '前一交易日涨幅+18.70%，股价较前一交易日显著回落',
        '每日经济新闻报道指出新能源板块在经历6连阳后开盘走低',
        '成交量仍处于高位，显示多空分歧持续',
      ],
      unconfirmedParts: [
        '下跌的具体原因尚不能确认，需要更多资料验证',
        '机构资金流向的具体数据未取得',
        '板块联动是原因还是同步表现，尚不明确',
      ],
      materials: [
        {
          id: 'mat-300750-node3-001',
          title: '宁德时代大幅回调，新能源车ETF（515030）跌超3%，关注超跌板块反弹机遇',
          publishedAt: '2024-10-09 14:22',
          sourceName: '每日经济新闻（新浪财经转载）',
          sourceUrl: 'https://finance.sina.com.cn/roll/2024-10-09/doc-incrxvrw9459065.shtml',
          collectedAt: '2026-07-14',
          stockCode: '300750',
          nodeDate: '2024-10-09',
          timeDistanceDays: 0,
          materialType: 'market',
          materialTypeLabel: '市场',
          excerpt:
            '10月9日，A股市场大幅回调，前期超跌的新能源板块在经历6连阳后，今日开盘走低，行业龙头宁德时代盘中跌超11%。新能源车ETF（515030）跌幅3.11%。中证新能源车指数最新估值（PE-TTM）33.25倍，位于近10年34.33%中性偏低分位处。',
          relevanceNote:
            '该报道记录了10月9日宁德时代及新能源板块的回调事实，与节点同日，为了解当日市场表现提供了可追溯的资料。报道指出板块在6连阳后走低，前期涨幅与本次回落可能相关。',
        },
      ],
      replaySummary: {
        summary:
          '10月9日宁德时代收盘244.08元（前复权），跌幅-14.72%，前一交易日收盘286.19元，股价较前一交易日显著回落。据每日经济新闻报道，新能源板块在经历6连阳后开盘走低，宁德时代盘中跌超11%，新能源车ETF跌幅3.11%。该报道与节点同日，记录了当日市场表现。前一交易日涨幅较大与本次回落可能相关，但尚不能确认回落的具体原因，板块联动是原因还是同步表现也不明确，个股层面未取得当日重大公告，具体驱动需要更多资料验证。',
        referencedCandidateIds: ['mat-300750-node3-001'],
        isRealTimeAI: false,
        generatedAt: '2026-07-14',
      },
      swLevel3: { ...SW_LEVEL3_MISSING },
    },

    // ========================================================================
    // 节点 4：2025-02-11 阶段低点 -2.57%
    // 收盘 242.17，成交量 24791980 股
    // 该节点未找到足够可信的时间邻近资料，展示真实空状态
    // ========================================================================
    {
      id: 'local_low:300750:2025-02-11',
      date: '2025-02-11',
      close: 242.17,
      changePercent: -2.57,
      volume: 24791980,
      nodeType: 'local_low',
      nodeTypeLabel: '阶段低点',
      marketFact:
        '收盘价 242.17 元（前复权），跌幅 -2.57%，成交量 24791980 股（约 24.79 万手），为2025年2月区间内的阶段低点。',
      observationClues: [
        '该日期附近未找到足够可信的时间邻近公开资料',
      ],
      unconfirmedParts: [
        '该节点暂无可追溯的时间临近资料',
        '当前不能判断涨跌原因',
      ],
      materials: [],
      replaySummary: null,
      swLevel3: { ...SW_LEVEL3_MISSING },
    },
  ],
  sourceList: [
    {
      id: 'src-001',
      title: '国新办举行新闻发布会 介绍金融支持经济高质量发展有关情况',
      sourceName: '国务院新闻办公室',
      sourceUrl: 'http://www.scio.gov.cn/live/2024/34875/',
      publishedAt: '2024-09-24',
      collectedAt: '2026-07-14',
      usedForNodeIds: ['significant_up:300750:2024-09-30'],
    },
    {
      id: 'src-002',
      title: '中共中央政治局召开会议 分析研究当前经济形势和经济工作',
      sourceName: '最高人民法院转载新华社',
      sourceUrl: 'https://www.court.gov.cn/xinshidai/xiangqing/443931.html',
      publishedAt: '2024-09-26',
      collectedAt: '2026-07-14',
      usedForNodeIds: ['significant_up:300750:2024-09-30'],
    },
    {
      id: 'src-003',
      title: '证监会发布《关于深化上市公司并购重组市场改革的意见》',
      sourceName: '中国证券监督管理委员会',
      sourceUrl: 'http://www.csrc.gov.cn/csrc/c100028/c7508366/content.shtml',
      publishedAt: '2024-09-24',
      collectedAt: '2026-07-14',
      usedForNodeIds: ['significant_up:300750:2024-09-30'],
    },
    {
      id: 'src-003b',
      title: '更好发挥资本市场主渠道作用 "并购六条"助力上市公司向"新"而行',
      sourceName: '证券日报（证监会山西监管局转载）',
      sourceUrl: 'http://www.csrc.gov.cn/shanxi/c106408/c7510272/content.shtml',
      publishedAt: '2024-10-08',
      collectedAt: '2026-07-14',
      usedForNodeIds: ['significant_up:300750:2024-10-08'],
    },
    {
      id: 'src-004',
      title: '宁德时代10月8日现3笔大宗交易 成交金额3.99亿元',
      sourceName: '新浪证券-红岸工作室',
      sourceUrl: 'https://finance.sina.cn/stock/ssgs/2024-10-08/detail-incrvsst3984515.d.html',
      publishedAt: '2024-10-08 17:00',
      collectedAt: '2026-07-14',
      usedForNodeIds: ['significant_up:300750:2024-10-08'],
    },
    {
      id: 'src-005',
      title: '宁德时代大幅回调，新能源车ETF（515030）跌超3%，关注超跌板块反弹机遇',
      sourceName: '每日经济新闻（新浪财经转载）',
      sourceUrl: 'https://finance.sina.com.cn/roll/2024-10-09/doc-incrxvrw9459065.shtml',
      publishedAt: '2024-10-09 14:22',
      collectedAt: '2026-07-14',
      usedForNodeIds: ['significant_down:300750:2024-10-09'],
    },
  ],
  // 静态案例日历基准日（不依赖浏览器当天日期）
  calendarAsOfDate: '2026-07-14',
  // 案例内置未来事件：1 可核验 + 2 案例演示
  futureEvents: getCaseBuiltInEvents('300750'),
};
