// 第十六阶段里程碑三：贵州茅台（600519.SH）静态真实历史复盘案例
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
import { snapshot_600519_klines, snapshot_600519_meta } from './staticCase_600519_snapshot';
import { getCaseBuiltInEvents } from './staticCaseEvents';

// 申万三级数据暂缺（未取得可靠来源）
const SW_LEVEL3_MISSING = {
  industryName: null,
  indexCode: null,
  changePercent: null,
  sourceUrl: null,
  collectedAt: null,
};

export const staticCase_600519: StaticHistoricalCase = {
  id: 'static-case-600519-001',
  stockCode: snapshot_600519_meta.stockCode,
  stockName: snapshot_600519_meta.stockName,
  market: snapshot_600519_meta.market,
  description:
    '贵州茅台（600519.SH）2024年6月至2024年12月静态历史复盘案例。基于BaoStock真实前复权日线和可复核的公开资料制作，展示从关键股价节点出发结合时间邻近资料理解行情波动可能相关线索的产品价值。所有行情数字和事件资料均可追溯，非实时更新。',
  caseMode: 'static_historical',
  isRealTime: false,
  isMock: false,
  requestStartDate: snapshot_600519_meta.requestStartDate,
  requestEndDate: snapshot_600519_meta.requestEndDate,
  actualFirstDate: snapshot_600519_meta.actualFirstDate,
  actualLastDate: snapshot_600519_meta.actualLastDate,
  snapshotGeneratedAt: snapshot_600519_meta.snapshotGeneratedAt,
  adjustment: snapshot_600519_meta.adjustment,
  source: snapshot_600519_meta.source,
  klines: snapshot_600519_klines,
  nodes: [
    // ========================================================================
    // 节点 1：2024-09-24 单日显著上涨 +8.80%
    // 收盘 1273.17，成交量 10041281 股
    // ========================================================================
    {
      id: 'significant_up:600519:2024-09-24',
      date: '2024-09-24',
      close: 1273.17,
      changePercent: 8.80,
      volume: 10041281,
      nodeType: 'significant_up',
      nodeTypeLabel: '单日显著上涨',
      marketFact:
        '收盘价 1273.17 元（前复权），涨幅 +8.80%，成交量 10041281 股（约 10.04 万手），为9月下旬行情中的显著放量上涨日。',
      observationClues: [
        '9月24日国新办发布会上央行、金融监管总局、证监会联合宣布金融支持政策，与节点同日',
        '当日成交量较前一交易日明显放大，显示资金参与度提升',
        '当日开盘价 1192.00 元，盘中最高 1273.54 元，振幅较大',
      ],
      unconfirmedParts: [
        '个股层面无当日公司公告，上涨驱动力尚不明确',
        '政策利好与个股上涨的时间同日关系不等于因果关系',
        '资金流入的具体来源（机构/散户/北向等）未取得',
      ],
      materials: [
        {
          id: 'mat-600519-node1-001',
          title: '国新办举行新闻发布会 介绍金融支持经济高质量发展有关情况',
          publishedAt: '2024-09-24',
          sourceName: '国务院新闻办公室',
          sourceUrl: 'http://www.scio.gov.cn/live/2024/34875/',
          collectedAt: '2026-07-14',
          stockCode: '600519',
          nodeDate: '2024-09-24',
          timeDistanceDays: 0,
          materialType: 'policy',
          materialTypeLabel: '政策',
          excerpt:
            '2024年9月24日上午9时，国务院新闻办公室举行新闻发布会，中国人民银行行长潘功胜、国家金融监督管理总局局长李云泽、中国证券监督管理委员会主席吴清介绍金融支持经济高质量发展有关情况，宣布降准、降息、降低存量房贷利率、创设资本市场支持工具等一系列政策。',
          relevanceNote:
            '此为市场层面政策，非公司专属事件。央行降准降息、证监会资本市场改革等政策与9月24日贵州茅台上涨时间同日，可能提振了市场整体风险偏好，但与个股上涨不构成确定性因果关系。',
        },
      ],
      replaySummary: {
        summary:
          '9月24日贵州茅台收盘1273.17元（前复权），涨幅+8.80%，成交量10041281股，为9月下旬行情中的显著放量上涨日。据国务院新闻办公室消息，当日央行、金融监管总局、证监会联合介绍金融支持经济高质量发展有关情况，宣布降准、降息、降低存量房贷利率、创设资本市场支持工具等一系列政策。上述政策发布与节点同日，可能提振了市场整体风险偏好，但与个股上涨不构成确定性因果关系。个股层面未取得当日公司公告，上涨驱动力需要更多资料验证。',
        referencedCandidateIds: ['mat-600519-node1-001'],
        isRealTimeAI: false,
        generatedAt: '2026-07-14',
      },
      swLevel3: { ...SW_LEVEL3_MISSING },
    },

    // ========================================================================
    // 节点 2：2024-09-30 单日显著上涨 +7.29%
    // 收盘 1621.37，成交量 15729341 股
    // ========================================================================
    {
      id: 'significant_up:600519:2024-09-30',
      date: '2024-09-30',
      close: 1621.37,
      changePercent: 7.29,
      volume: 15729341,
      nodeType: 'significant_up',
      nodeTypeLabel: '单日显著上涨',
      marketFact:
        '收盘价 1621.37 元（前复权），涨幅 +7.29%，成交量 15729341 股（约 15.73 万手），为9月行情中显著放量上涨日，成交量较9月24日进一步放大。',
      observationClues: [
        '9月26日中央政治局会议部署经济工作，明确要努力提振资本市场，与节点时间邻近',
        '当日成交量为区间内较高水平，显示资金参与度明显提升',
        '9月下旬行情连续上涨，9月24日至9月30日区间累计涨幅较大',
      ],
      unconfirmedParts: [
        '个股层面无当日公司公告，上涨驱动力尚不明确',
        '政治局会议与个股上涨的时间邻近关系不等于因果关系',
        '资金流入的具体来源（机构/散户/北向等）未取得',
      ],
      materials: [
        {
          id: 'mat-600519-node2-001',
          title: '中共中央政治局召开会议 分析研究当前经济形势和经济工作',
          publishedAt: '2024-09-26',
          sourceName: '最高人民法院转载新华社',
          sourceUrl: 'https://www.court.gov.cn/xinshidai/xiangqing/443931.html',
          collectedAt: '2026-07-14',
          stockCode: '600519',
          nodeDate: '2024-09-30',
          timeDistanceDays: -4,
          materialType: 'policy',
          materialTypeLabel: '政策',
          excerpt:
            '中共中央政治局9月26日召开会议，分析研究当前经济形势和经济工作。会议强调，要加大财政货币政策逆周期调节力度，保证必要的财政支出，要努力提振资本市场，大力引导中长期资金入市。',
          relevanceNote:
            '此为市场层面政策，非公司专属事件。政治局会议明确要努力提振资本市场，与9月30日贵州茅台上涨时间邻近（相隔4天），可能提振了市场情绪，但与个股上涨不构成确定性因果关系。',
        },
      ],
      replaySummary: {
        summary:
          '9月30日贵州茅台收盘1621.37元（前复权），涨幅+7.29%，成交量15729341股，为9月行情中显著放量上涨日。据最高人民法院转载新华社报道，9月26日中共中央政治局召开会议，分析研究当前经济形势和经济工作，强调要加大财政货币政策逆周期调节力度，要努力提振资本市场，大力引导中长期资金入市。上述政治局会议与节点时间邻近（节点前4天），可能提振了市场情绪，但与个股上涨不构成确定性因果关系。个股层面未取得当日公司公告，上涨驱动力需要更多资料验证。',
        referencedCandidateIds: ['mat-600519-node2-001'],
        isRealTimeAI: false,
        generatedAt: '2026-07-14',
      },
      swLevel3: { ...SW_LEVEL3_MISSING },
    },

    // ========================================================================
    // 节点 3：2024-10-09 单日显著下跌 -7.42%
    // 收盘 1479.6，成交量 12019684 股
    // 该节点未找到足够可信的时间邻近资料，展示真实空状态
    // ========================================================================
    {
      id: 'significant_down:600519:2024-10-09',
      date: '2024-10-09',
      close: 1479.6,
      changePercent: -7.42,
      volume: 12019684,
      nodeType: 'significant_down',
      nodeTypeLabel: '单日显著下跌',
      marketFact:
        '收盘价 1479.6 元（前复权），跌幅 -7.42%，成交量 12019684 股（约 12.02 万手）。前一交易日收盘 1598.18 元，单日回调幅度较大。',
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

    // ========================================================================
    // 节点 4：2024-10-31 阶段低点 -0.27%
    // 收盘 1417.12，成交量 2995735 股
    // ========================================================================
    {
      id: 'local_low:600519:2024-10-31',
      date: '2024-10-31',
      close: 1417.12,
      changePercent: -0.27,
      volume: 2995735,
      nodeType: 'local_low',
      nodeTypeLabel: '阶段低点',
      marketFact:
        '收盘价 1417.12 元（前复权），跌幅 -0.27%，成交量 2995735 股（约 3.00 万手），为2024年10月下旬区间内的阶段低点。',
      observationClues: [
        '贵州茅台于10月25日披露2024年三季报，时间邻近节点',
        '三季报业绩稳健增长，可能影响市场预期',
        '节点日成交量处于区间偏低水平，显示多空分歧减弱',
      ],
      unconfirmedParts: [
        '三季报与节点日行情表现的时间邻近关系不等于因果关系',
        '阶段低点的形成原因尚不能确认，需要更多资料验证',
        '机构资金流向的具体数据未取得',
      ],
      materials: [
        {
          id: 'mat-600519-node4-001',
          title: '贵州茅台2024年第三季度报告',
          publishedAt: '2024-10-25',
          sourceName: '东方财富网',
          sourceUrl: 'https://data.eastmoney.com/notices/detail/600519/AN202410251640509293.html',
          collectedAt: '2026-07-14',
          stockCode: '600519',
          nodeDate: '2024-10-31',
          timeDistanceDays: -6,
          materialType: 'company',
          materialTypeLabel: '公司',
          excerpt:
            '贵州茅台2024年10月25日披露三季报，前三季度实现营业收入1207.76亿元，同比增长16.95%；归母净利润608.28亿元，同比增长15.04%；基本每股收益48.42元。',
          relevanceNote:
            '三季报于10月25日发布，与10月31日节点时间邻近（前6天），三季报业绩稳健增长可能影响了市场预期，但与节点日的行情表现不构成确定性因果关系。',
        },
      ],
      replaySummary: {
        summary:
          '10月31日贵州茅台收盘1417.12元（前复权），跌幅-0.27%，成交量2995735股，为10月下旬区间阶段低点。据东方财富网，贵州茅台于10月25日披露2024年三季报，前三季度实现营业收入1207.76亿元，同比增长16.95%；归母净利润608.28亿元，同比增长15.04%；基本每股收益48.42元。三季报业绩稳健增长，与节点时间邻近（节点前6天），可能影响了市场预期，但与节点日行情表现不构成确定性因果关系。个股层面未取得节点日其他公告，具体驱动需要更多资料验证。',
        referencedCandidateIds: ['mat-600519-node4-001'],
        isRealTimeAI: false,
        generatedAt: '2026-07-14',
      },
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
      usedForNodeIds: ['significant_up:600519:2024-09-24'],
    },
    {
      id: 'src-002',
      title: '中共中央政治局召开会议 分析研究当前经济形势和经济工作',
      sourceName: '最高人民法院转载新华社',
      sourceUrl: 'https://www.court.gov.cn/xinshidai/xiangqing/443931.html',
      publishedAt: '2024-09-26',
      collectedAt: '2026-07-14',
      usedForNodeIds: ['significant_up:600519:2024-09-30'],
    },
    {
      id: 'src-003',
      title: '贵州茅台2024年第三季度报告',
      sourceName: '东方财富网',
      sourceUrl: 'https://data.eastmoney.com/notices/detail/600519/AN202410251640509293.html',
      publishedAt: '2024-10-25',
      collectedAt: '2026-07-14',
      usedForNodeIds: ['local_low:600519:2024-10-31'],
    },
  ],
  // 静态案例日历基准日（不依赖浏览器当天日期）
  calendarAsOfDate: '2026-07-14',
  // 案例内置未来事件：1 可核验 + 2 案例演示
  futureEvents: getCaseBuiltInEvents('600519'),
};
