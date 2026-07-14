// 第十六阶段里程碑三：比亚迪（002594.SZ）静态真实历史复盘案例
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
import { snapshot_002594_klines, snapshot_002594_meta } from './staticCase_002594_snapshot';
import { getCaseBuiltInEvents } from './staticCaseEvents';

// 申万三级数据暂缺（未取得可靠来源）
const SW_LEVEL3_MISSING = {
  industryName: null,
  indexCode: null,
  changePercent: null,
  sourceUrl: null,
  collectedAt: null,
};

export const staticCase_002594: StaticHistoricalCase = {
  id: 'static-case-002594-001',
  stockCode: snapshot_002594_meta.stockCode,
  stockName: snapshot_002594_meta.stockName,
  market: snapshot_002594_meta.market,
  description:
    '比亚迪（002594.SZ）2024年6月至2024年12月静态历史复盘案例。基于BaoStock真实前复权日线和可复核的公开资料制作，展示从关键股价节点出发结合时间邻近资料理解行情波动可能相关线索的产品价值。所有行情数字和事件资料均可追溯，非实时更新。',
  caseMode: 'static_historical',
  isRealTime: false,
  isMock: false,
  requestStartDate: snapshot_002594_meta.requestStartDate,
  requestEndDate: snapshot_002594_meta.requestEndDate,
  actualFirstDate: snapshot_002594_meta.actualFirstDate,
  actualLastDate: snapshot_002594_meta.actualLastDate,
  snapshotGeneratedAt: snapshot_002594_meta.snapshotGeneratedAt,
  adjustment: snapshot_002594_meta.adjustment,
  source: snapshot_002594_meta.source,
  klines: snapshot_002594_klines,
  nodes: [
    // ========================================================================
    // 节点 1：2024-09-27 单日显著上涨 +5.33%
    // 收盘 93.55，成交量 30992240 股
    // ========================================================================
    {
      id: 'significant_up:002594:2024-09-27',
      date: '2024-09-27',
      close: 93.55,
      changePercent: 5.33,
      volume: 30992240,
      nodeType: 'significant_up',
      nodeTypeLabel: '单日显著上涨',
      marketFact:
        '收盘价 93.55 元（前复权），涨幅 +5.33%，成交量 30992240 股（约 30.99 万手），为9月下旬行情中的显著放量上涨日。',
      observationClues: [
        '9月24日国新办发布会上央行、金融监管总局、证监会联合宣布金融支持政策，时间邻近',
        '当日成交量较前一交易日（14906641股）明显放大，显示资金参与度提升',
        '9月下旬股价连续上行，9月25日至9月27日累计涨幅较大',
      ],
      unconfirmedParts: [
        '个股层面无当日公司公告，上涨驱动力尚不明确',
        '政策利好与个股上涨的时间邻近关系不等于因果关系',
        '资金流入的具体来源（机构/散户/北向等）未取得',
      ],
      materials: [
        {
          id: 'mat-002594-node1-001',
          title: '国新办举行新闻发布会 介绍金融支持经济高质量发展有关情况',
          publishedAt: '2024-09-24',
          sourceName: '国务院新闻办公室',
          sourceUrl: 'http://www.scio.gov.cn/live/2024/34875/',
          collectedAt: '2026-07-14',
          stockCode: '002594',
          nodeDate: '2024-09-27',
          timeDistanceDays: -3,
          materialType: 'policy',
          materialTypeLabel: '政策',
          excerpt:
            '2024年9月24日上午9时，国务院新闻办公室举行新闻发布会，中国人民银行行长潘功胜、国家金融监督管理总局局长李云泽、中国证券监督管理委员会主席吴清介绍金融支持经济高质量发展有关情况，宣布降准、降息、降低存量房贷利率、创设资本市场支持工具等一系列政策。',
          relevanceNote:
            '此为市场层面政策，非公司专属事件。央行降准降息、证监会资本市场改革等政策与9月27日比亚迪上涨时间邻近（相隔3天），可能提振了市场整体风险偏好，但与个股上涨不构成确定性因果关系。',
        },
      ],
      replaySummary: {
        summary:
          '9月27日比亚迪收盘93.55元（前复权），涨幅+5.33%，成交量30992240股。该交易日发生在多项金融支持政策发布之后：9月24日国新办发布会上央行、金融监管总局、证监会联合宣布降准降息、创设资本市场支持工具等政策。上述公开资料在时间上位于本节点之前3天，与行情上涨可能相关，但尚不能确认政策与个股上涨之间存在因果关系。个股层面未取得当日公司公告，上涨驱动力需要更多资料验证。',
        referencedCandidateIds: ['mat-002594-node1-001'],
        isRealTimeAI: false,
        generatedAt: '2026-07-14',
      },
      swLevel3: { ...SW_LEVEL3_MISSING },
    },

    // ========================================================================
    // 节点 2：2024-09-30 单日显著上涨 +8.21%
    // 收盘 101.23，成交量 38880459 股
    // ========================================================================
    {
      id: 'significant_up:002594:2024-09-30',
      date: '2024-09-30',
      close: 101.23,
      changePercent: 8.21,
      volume: 38880459,
      nodeType: 'significant_up',
      nodeTypeLabel: '单日显著上涨',
      marketFact:
        '收盘价 101.23 元（前复权），涨幅 +8.21%，成交量 38880459 股（约 38.88 万手），为9月行情中的显著放量上涨日。',
      observationClues: [
        '9月26日中央政治局会议部署经济工作，明确要努力提振资本市场，时间邻近',
        '当日成交量进一步放大，为9月区间内较高水平',
        '9月下旬股价持续上行，市场情绪明显回暖',
      ],
      unconfirmedParts: [
        '个股层面无当日公司公告，上涨驱动力尚不明确',
        '政治局会议与个股上涨的时间邻近关系不等于因果关系',
        '资金流入的具体来源（机构/散户/北向等）未取得',
      ],
      materials: [
        {
          id: 'mat-002594-node2-001',
          title: '中共中央政治局召开会议 分析研究当前经济形势和经济工作',
          publishedAt: '2024-09-26',
          sourceName: '最高人民法院转载新华社',
          sourceUrl: 'https://www.court.gov.cn/xinshidai/xiangqing/443931.html',
          collectedAt: '2026-07-14',
          stockCode: '002594',
          nodeDate: '2024-09-30',
          timeDistanceDays: -4,
          materialType: 'policy',
          materialTypeLabel: '政策',
          excerpt:
            '中共中央政治局9月26日召开会议，分析研究当前经济形势和经济工作。会议强调，要加大财政货币政策逆周期调节力度，保证必要的财政支出，要努力提振资本市场，大力引导中长期资金入市。',
          relevanceNote:
            '此为市场层面政策，非公司专属事件。政治局会议明确要努力提振资本市场，与9月30日比亚迪上涨时间邻近（相隔4天），可能提振了市场情绪，但与个股上涨不构成确定性因果关系。',
        },
      ],
      replaySummary: {
        summary:
          '9月30日比亚迪收盘101.23元（前复权），涨幅+8.21%，成交量38880459股，为9月下旬行情中的显著放量上涨日。该交易日发生在9月26日中央政治局会议之后，会议强调要加大财政货币政策逆周期调节力度，努力提振资本市场，大力引导中长期资金入市。上述公开资料在时间上位于本节点之前4天，与行情上涨可能相关，但尚不能确认政策与个股上涨之间存在因果关系。个股层面未取得当日公司公告，上涨驱动力需要更多资料验证。',
        referencedCandidateIds: ['mat-002594-node2-001'],
        isRealTimeAI: false,
        generatedAt: '2026-07-14',
      },
      swLevel3: { ...SW_LEVEL3_MISSING },
    },

    // ========================================================================
    // 节点 3：2024-10-09 单日显著下跌 -6.63%
    // 收盘 100.70，成交量 32591858 股
    // 该节点未找到足够可信的时间邻近资料，展示真实空状态
    // ========================================================================
    {
      id: 'significant_down:002594:2024-10-09',
      date: '2024-10-09',
      close: 100.70,
      changePercent: -6.63,
      volume: 32591858,
      nodeType: 'significant_down',
      nodeTypeLabel: '单日显著下跌',
      marketFact:
        '收盘价 100.70 元（前复权），跌幅 -6.63%，成交量 32591858 股（约 32.59 万手）。前一交易日收盘 107.84 元，单日回调幅度较大。',
      observationClues: [
        '前一交易日（10月8日）收盘107.84元，本日股价较前一交易日显著回落',
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
    // 节点 4：2024-11-04 单日显著上涨 +5.74%
    // 收盘 101.12，成交量 21731889 股
    // ========================================================================
    {
      id: 'significant_up:002594:2024-11-04',
      date: '2024-11-04',
      close: 101.12,
      changePercent: 5.74,
      volume: 21731889,
      nodeType: 'significant_up',
      nodeTypeLabel: '单日显著上涨',
      marketFact:
        '收盘价 101.12 元（前复权），涨幅 +5.74%，成交量 21731889 股（约 21.73 万手），为11月初行情中的显著上涨日。',
      observationClues: [
        '比亚迪于10月30日披露三季报，前三季度营收和净利润同比双增长，时间邻近',
        '当日成交量较前一交易日放大，显示资金参与度提升',
        '前三季度营收5022.5亿元同比增长18.9%，业绩稳健增长可能影响市场预期',
      ],
      unconfirmedParts: [
        '三季报业绩与节点日行情表现的时间邻近关系不等于因果关系',
        '个股层面未取得当日其他重大公告，上涨驱动力尚不明确',
        '资金流入的具体来源（机构/散户/北向等）未取得',
      ],
      materials: [
        {
          id: 'mat-002594-node4-001',
          title: '比亚迪2024年第三季度报告',
          publishedAt: '2024-10-30',
          sourceName: '新浪财经',
          sourceUrl: 'https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_BulletinSan/stockid/002594/page_type/sjdbg.phtml',
          collectedAt: '2026-07-14',
          stockCode: '002594',
          nodeDate: '2024-11-04',
          timeDistanceDays: -5,
          materialType: 'company',
          materialTypeLabel: '公司',
          excerpt:
            '比亚迪2024年10月30日披露三季报，前三季度实现营业收入5022.5亿元，同比增长18.9%；归母净利润252.4亿元，同比增长18.1%。第三季度营收2011.25亿元，同比增长24.04%；归母净利润116.07亿元，同比增长11.47%。',
          relevanceNote:
            '三季报于10月30日发布，与11月4日节点时间邻近（前5天），三季报业绩稳健增长可能影响了市场预期，但与节点日的行情表现不构成确定性因果关系。',
        },
      ],
      replaySummary: {
        summary:
          '11月4日比亚迪收盘101.12元（前复权），涨幅+5.74%，成交量21731889股。据公开资料，比亚迪于10月30日披露三季报，前三季度营收5022.5亿元同比增长18.9%，归母净利润252.4亿元同比增长18.1%，第三季度营收2011.25亿元同比增长24.04%。三季报业绩稳健增长，与本节点时间邻近（节点前5天），可能影响了市场对公司的业绩预期，但与节点日的行情表现不构成确定性因果关系，具体驱动需要更多资料验证。',
        referencedCandidateIds: ['mat-002594-node4-001'],
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
      usedForNodeIds: ['significant_up:002594:2024-09-27'],
    },
    {
      id: 'src-002',
      title: '中共中央政治局召开会议 分析研究当前经济形势和经济工作',
      sourceName: '最高人民法院转载新华社',
      sourceUrl: 'https://www.court.gov.cn/xinshidai/xiangqing/443931.html',
      publishedAt: '2024-09-26',
      collectedAt: '2026-07-14',
      usedForNodeIds: ['significant_up:002594:2024-09-30'],
    },
    {
      id: 'src-003',
      title: '比亚迪2024年第三季度报告',
      sourceName: '新浪财经',
      sourceUrl: 'https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_BulletinSan/stockid/002594/page_type/sjdbg.phtml',
      publishedAt: '2024-10-30',
      collectedAt: '2026-07-14',
      usedForNodeIds: ['significant_up:002594:2024-11-04'],
    },
  ],
  // 静态案例日历基准日（不依赖浏览器当天日期）
  calendarAsOfDate: '2026-07-14',
  // 案例内置未来事件：1 可核验 + 2 案例演示
  futureEvents: getCaseBuiltInEvents('002594'),
};
