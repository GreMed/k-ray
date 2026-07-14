// 第十六阶段里程碑三：移远通信（603236.SH）静态真实历史复盘案例
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
import { snapshot_603236_klines, snapshot_603236_meta } from './staticCase_603236_snapshot';
import { getCaseBuiltInEvents } from './staticCaseEvents';

// 申万三级数据暂缺（未取得可靠来源）
const SW_LEVEL3_MISSING = {
  industryName: null,
  indexCode: null,
  changePercent: null,
  sourceUrl: null,
  collectedAt: null,
};

export const staticCase_603236: StaticHistoricalCase = {
  id: 'static-case-603236-001',
  stockCode: snapshot_603236_meta.stockCode,
  stockName: snapshot_603236_meta.stockName,
  market: snapshot_603236_meta.market,
  description:
    '移远通信（603236.SH）2024年6月至2024年12月静态历史复盘案例。基于BaoStock真实前复权日线和可复核的公开资料制作，展示从关键股价节点出发结合时间邻近资料理解行情波动可能相关线索的产品价值。所有行情数字和事件资料均可追溯，非实时更新。',
  caseMode: 'static_historical',
  isRealTime: false,
  isMock: false,
  requestStartDate: snapshot_603236_meta.requestStartDate,
  requestEndDate: snapshot_603236_meta.requestEndDate,
  actualFirstDate: snapshot_603236_meta.actualFirstDate,
  actualLastDate: snapshot_603236_meta.actualLastDate,
  snapshotGeneratedAt: snapshot_603236_meta.snapshotGeneratedAt,
  adjustment: snapshot_603236_meta.adjustment,
  source: snapshot_603236_meta.source,
  klines: snapshot_603236_klines,
  nodes: [
    // ========================================================================
    // 节点 1：2024-09-30 单日显著上涨 +10.00%
    // 收盘 34.03，成交量 15572562 股
    // ========================================================================
    {
      id: 'significant_up:603236:2024-09-30',
      date: '2024-09-30',
      close: 34.03,
      changePercent: 10.00,
      volume: 15572562,
      nodeType: 'significant_up',
      nodeTypeLabel: '单日显著上涨',
      marketFact:
        '收盘价 34.03 元（前复权），涨幅 +10.00%，成交量 15572562 股（约 15.57 万手），为9月下旬行情中的显著放量上涨日。',
      observationClues: [
        '9月24日国新办发布会上央行、金融监管总局、证监会联合宣布金融支持政策，时间邻近',
        '9月26日中央政治局会议明确要努力提振资本市场，时间邻近',
        '当日成交量较前一交易日明显放大，显示资金参与度提升',
      ],
      unconfirmedParts: [
        '个股层面无当日公司公告，上涨驱动力尚不明确',
        '政策利好与个股上涨的时间邻近关系不等于因果关系',
        '资金流入的具体来源未取得',
      ],
      materials: [
        {
          id: 'mat-603236-node1-001',
          title: '国新办举行新闻发布会 介绍金融支持经济高质量发展有关情况',
          publishedAt: '2024-09-24',
          sourceName: '国务院新闻办公室',
          sourceUrl: 'http://www.scio.gov.cn/live/2024/34875/',
          collectedAt: '2026-07-14',
          stockCode: '603236',
          nodeDate: '2024-09-30',
          timeDistanceDays: -6,
          materialType: 'policy',
          materialTypeLabel: '政策',
          excerpt:
            '2024年9月24日上午9时，国务院新闻办公室举行新闻发布会，中国人民银行行长潘功胜、国家金融监督管理总局局长李云泽、中国证券监督管理委员会主席吴清介绍金融支持经济高质量发展有关情况，宣布降准、降息、降低存量房贷利率、创设资本市场支持工具等一系列政策。',
          relevanceNote:
            '此为市场层面政策，非公司专属事件。央行降准降息、证监会资本市场改革等政策与9月30日移远通信上涨时间邻近（相隔6天），可能提振了市场整体风险偏好，但与个股上涨不构成确定性因果关系。',
        },
        {
          id: 'mat-603236-node1-002',
          title: '中共中央政治局召开会议 分析研究当前经济形势和经济工作',
          publishedAt: '2024-09-26',
          sourceName: '最高人民法院转载新华社',
          sourceUrl: 'https://www.court.gov.cn/xinshidai/xiangqing/443931.html',
          collectedAt: '2026-07-14',
          stockCode: '603236',
          nodeDate: '2024-09-30',
          timeDistanceDays: -4,
          materialType: 'policy',
          materialTypeLabel: '政策',
          excerpt:
            '中共中央政治局9月26日召开会议，分析研究当前经济形势和经济工作。会议强调，要加大财政货币政策逆周期调节力度，保证必要的财政支出，要努力提振资本市场，大力引导中长期资金入市。',
          relevanceNote:
            '此为市场层面政策，非公司专属事件。政治局会议明确要努力提振资本市场，与9月30日移远通信上涨时间邻近（相隔4天），可能提振了市场情绪，但与个股上涨不构成确定性因果关系。',
        },
      ],
      replaySummary: {
        summary:
          '9月30日移远通信收盘34.03元（前复权），涨幅+10.00%，成交量15572562股。该交易日发生在多项宏观政策发布之后：9月24日国新办发布会上央行、金融监管总局、证监会联合宣布降准降息、创设资本市场支持工具等政策；9月26日中央政治局会议明确要努力提振资本市场。上述公开资料在时间上位于本节点之前6天至4天，与行情上涨可能相关，但尚不能确认政策与个股上涨之间存在因果关系。个股层面未取得当日公司公告，上涨驱动力需要更多资料验证。',
        referencedCandidateIds: ['mat-603236-node1-001', 'mat-603236-node1-002'],
        isRealTimeAI: false,
        generatedAt: '2026-07-14',
      },
      swLevel3: { ...SW_LEVEL3_MISSING },
    },

    // ========================================================================
    // 节点 2：2024-10-08 单日显著上涨 +9.98%
    // 收盘 37.43，成交量 18335726 股
    // 该节点未找到足够可信的时间邻近资料，展示真实空状态
    // ========================================================================
    {
      id: 'significant_up:603236:2024-10-08',
      date: '2024-10-08',
      close: 37.43,
      changePercent: 9.98,
      volume: 18335726,
      nodeType: 'significant_up',
      nodeTypeLabel: '单日显著上涨',
      marketFact:
        '收盘价 37.43 元（前复权），涨幅 +9.98%，成交量 18335726 股（约 18.34 万手）。前一交易日为9月30日，为国庆假期后首个交易日。',
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
    // 节点 3：2024-10-18 单日显著上涨 +8.19%
    // 收盘 39.36，成交量 20644441 股
    // ========================================================================
    {
      id: 'significant_up:603236:2024-10-18',
      date: '2024-10-18',
      close: 39.36,
      changePercent: 8.19,
      volume: 20644441,
      nodeType: 'significant_up',
      nodeTypeLabel: '单日显著上涨',
      marketFact:
        '收盘价 39.36 元（前复权），涨幅 +8.19%，成交量 20644441 股（约 20.64 万手），为10月中旬行情中的显著放量上涨日。',
      observationClues: [
        '10月21日公司披露三季报，前三季度营收同比增长32.9%，归母净利润扭亏为盈，时间邻近',
        '当日成交量较前一交易日明显放大，显示资金参与度提升',
      ],
      unconfirmedParts: [
        '三季报于节点后3天发布，业绩与节点日行情的时间邻近关系不等于因果关系',
        '个股层面未取得当日公司公告，上涨驱动力尚不明确',
        '资金流入的具体来源未取得',
      ],
      materials: [
        {
          id: 'mat-603236-node3-001',
          title: '移远通信2024年第三季度报告',
          publishedAt: '2024-10-21',
          sourceName: '新浪财经',
          sourceUrl: 'https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_BulletinSan/stockid/603236/page_type/sjdbg.phtml',
          collectedAt: '2026-07-14',
          stockCode: '603236',
          nodeDate: '2024-10-18',
          timeDistanceDays: 3,
          materialType: 'company',
          materialTypeLabel: '公司',
          excerpt:
            '移远通信2024年10月21日披露三季报，前三季度实现营业收入132.46亿元，同比增长32.9%；归母净利润3.57亿元，同比扭亏为盈；扣非归母净利润3.26亿元。第三季度营收49.97亿元，同比增长44.64%。',
          relevanceNote:
            '三季报于10月21日发布，与10月18日节点时间邻近（后3天），三季报业绩大幅增长、扭亏为盈可能反映了公司基本面改善，但与节点日的行情表现不构成确定性因果关系。',
        },
      ],
      replaySummary: {
        summary:
          '10月18日移远通信收盘39.36元（前复权），涨幅+8.19%，成交量20644441股。据新浪财经披露，移远通信于10月21日发布三季报，前三季度营收132.46亿元同比增长32.9%，归母净利润3.57亿元同比扭亏为盈，第三季度营收同比增长44.64%。三季报发布于节点之后3天，业绩大幅增长可能反映了公司基本面改善，但与节点日的行情表现不构成确定性因果关系。当日上涨的具体驱动尚需更多资料验证。',
        referencedCandidateIds: ['mat-603236-node3-001'],
        isRealTimeAI: false,
        generatedAt: '2026-07-14',
      },
      swLevel3: { ...SW_LEVEL3_MISSING },
    },

    // ========================================================================
    // 节点 4：2024-12-26 单日显著上涨 +10.00%
    // 收盘 51.44，成交量 24109606 股
    // 该节点未找到足够可信的时间邻近资料，展示真实空状态
    // ========================================================================
    {
      id: 'significant_up:603236:2024-12-26',
      date: '2024-12-26',
      close: 51.44,
      changePercent: 10.00,
      volume: 24109606,
      nodeType: 'significant_up',
      nodeTypeLabel: '单日显著上涨',
      marketFact:
        '收盘价 51.44 元（前复权），涨幅 +10.00%，成交量 24109606 股（约 24.11 万手），为12月下旬行情中的显著放量上涨日。',
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
      usedForNodeIds: ['significant_up:603236:2024-09-30'],
    },
    {
      id: 'src-002',
      title: '中共中央政治局召开会议 分析研究当前经济形势和经济工作',
      sourceName: '最高人民法院转载新华社',
      sourceUrl: 'https://www.court.gov.cn/xinshidai/xiangqing/443931.html',
      publishedAt: '2024-09-26',
      collectedAt: '2026-07-14',
      usedForNodeIds: ['significant_up:603236:2024-09-30'],
    },
    {
      id: 'src-003',
      title: '移远通信2024年第三季度报告',
      sourceName: '新浪财经',
      sourceUrl: 'https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_BulletinSan/stockid/603236/page_type/sjdbg.phtml',
      publishedAt: '2024-10-21',
      collectedAt: '2026-07-14',
      usedForNodeIds: ['significant_up:603236:2024-10-18'],
    },
  ],
  // 静态案例日历基准日（不依赖浏览器当天日期）
  calendarAsOfDate: '2026-07-14',
  // 案例内置未来事件：1 可核验 + 2 案例演示
  futureEvents: getCaseBuiltInEvents('603236'),
};
