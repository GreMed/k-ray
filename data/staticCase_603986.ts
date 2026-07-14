// 第十六阶段里程碑三：兆易创新（603986.SH）静态真实历史复盘案例
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
import { snapshot_603986_klines, snapshot_603986_meta } from './staticCase_603986_snapshot';
import { getCaseBuiltInEvents } from './staticCaseEvents';

// 申万三级数据暂缺（未取得可靠来源）
const SW_LEVEL3_MISSING = {
  industryName: null,
  indexCode: null,
  changePercent: null,
  sourceUrl: null,
  collectedAt: null,
};

export const staticCase_603986: StaticHistoricalCase = {
  id: 'static-case-603986-001',
  stockCode: snapshot_603986_meta.stockCode,
  stockName: snapshot_603986_meta.stockName,
  market: snapshot_603986_meta.market,
  description:
    '兆易创新（603986.SH）2024年6月至2024年12月静态历史复盘案例。基于BaoStock真实前复权日线和可复核的公开资料制作，展示从关键股价节点出发结合时间邻近资料理解行情波动可能相关线索的产品价值。所有行情数字和事件资料均可追溯，非实时更新。',
  caseMode: 'static_historical',
  isRealTime: false,
  isMock: false,
  requestStartDate: snapshot_603986_meta.requestStartDate,
  requestEndDate: snapshot_603986_meta.requestEndDate,
  actualFirstDate: snapshot_603986_meta.actualFirstDate,
  actualLastDate: snapshot_603986_meta.actualLastDate,
  snapshotGeneratedAt: snapshot_603986_meta.snapshotGeneratedAt,
  adjustment: snapshot_603986_meta.adjustment,
  source: snapshot_603986_meta.source,
  klines: snapshot_603986_klines,
  nodes: [
    // ========================================================================
    // 节点 1：2024-09-26 单日显著上涨 +8.38%
    // 收盘 74.95，成交量 28858952 股
    // ========================================================================
    {
      id: 'significant_up:603986:2024-09-26',
      date: '2024-09-26',
      close: 74.95,
      changePercent: 8.38,
      volume: 28858952,
      nodeType: 'significant_up',
      nodeTypeLabel: '单日显著上涨',
      marketFact:
        '收盘价 74.95 元（前复权），涨幅 +8.38%，成交量 28858952 股（约 28.86 万手），为9月下旬行情中的显著放量上涨日。',
      observationClues: [
        '9月24日国新办发布会上央行、金融监管总局、证监会联合宣布金融支持政策，时间邻近',
        '当日成交量为区间内较高水平，显示资金参与度明显提升',
      ],
      unconfirmedParts: [
        '个股层面无当日公司公告，上涨驱动力尚不明确',
        '政策利好与个股上涨的时间邻近关系不等于因果关系',
        '资金流入的具体来源未取得',
      ],
      materials: [
        {
          id: 'mat-603986-node1-001',
          title: '国新办举行新闻发布会 介绍金融支持经济高质量发展有关情况',
          publishedAt: '2024-09-24',
          sourceName: '国务院新闻办公室',
          sourceUrl: 'http://www.scio.gov.cn/live/2024/34875/',
          collectedAt: '2026-07-14',
          stockCode: '603986',
          nodeDate: '2024-09-26',
          timeDistanceDays: -2,
          materialType: 'policy',
          materialTypeLabel: '政策',
          excerpt:
            '2024年9月24日上午9时，国务院新闻办公室举行新闻发布会，中国人民银行行长潘功胜、国家金融监督管理总局局长李云泽、中国证券监督管理委员会主席吴清介绍金融支持经济高质量发展有关情况，宣布降准、降息、降低存量房贷利率、创设资本市场支持工具等一系列政策。',
          relevanceNote:
            '此为市场层面政策，非公司专属事件。央行降准降息、证监会资本市场改革等政策与9月26日兆易创新上涨时间邻近（相隔2天），可能提振了市场整体风险偏好，但与个股上涨不构成确定性因果关系。',
        },
      ],
      replaySummary: {
        summary:
          '9月26日兆易创新收盘74.95元（前复权），涨幅+8.38%，成交量28858952股，为9月下旬行情中的显著放量上涨日。据公开资料，9月24日国新办举行新闻发布会，央行、金融监管总局、证监会联合宣布降准降息、创设资本市场支持工具等一系列金融支持政策。该政策发布与本节点时间邻近（相隔2天），可能提振了市场整体风险偏好，但与个股上涨不构成确定性因果关系。个股层面未取得当日公司公告，上涨驱动力需要更多资料验证。',
        referencedCandidateIds: ['mat-603986-node1-001'],
        isRealTimeAI: false,
        generatedAt: '2026-07-14',
      },
      swLevel3: { ...SW_LEVEL3_MISSING },
    },

    // ========================================================================
    // 节点 2：2024-09-30 单日显著上涨 +9.91%
    // 收盘 87.99，成交量 41920744 股
    // ========================================================================
    {
      id: 'significant_up:603986:2024-09-30',
      date: '2024-09-30',
      close: 87.99,
      changePercent: 9.91,
      volume: 41920744,
      nodeType: 'significant_up',
      nodeTypeLabel: '单日显著上涨',
      marketFact:
        '收盘价 87.99 元（前复权），涨幅 +9.91%，成交量 41920744 股（约 41.92 万手），为9月行情中的显著放量上涨日。',
      observationClues: [
        '9月26日中央政治局会议部署经济工作，明确要努力提振资本市场，时间邻近',
        '当日成交量为区间内较高水平，显示资金参与度明显提升',
      ],
      unconfirmedParts: [
        '个股层面无当日公司公告，上涨驱动力尚不明确',
        '政策利好与个股上涨的时间邻近关系不等于因果关系',
        '资金流入的具体来源未取得',
      ],
      materials: [
        {
          id: 'mat-603986-node2-001',
          title: '中共中央政治局召开会议 分析研究当前经济形势和经济工作',
          publishedAt: '2024-09-26',
          sourceName: '最高人民法院转载新华社',
          sourceUrl: 'https://www.court.gov.cn/xinshidai/xiangqing/443931.html',
          collectedAt: '2026-07-14',
          stockCode: '603986',
          nodeDate: '2024-09-30',
          timeDistanceDays: -4,
          materialType: 'policy',
          materialTypeLabel: '政策',
          excerpt:
            '中共中央政治局9月26日召开会议，分析研究当前经济形势和经济工作。会议强调，要加大财政货币政策逆周期调节力度，保证必要的财政支出，要努力提振资本市场，大力引导中长期资金入市。',
          relevanceNote:
            '此为市场层面政策，非公司专属事件。政治局会议明确要努力提振资本市场，与9月30日兆易创新上涨时间邻近（相隔4天），可能提振了市场情绪，但与个股上涨不构成确定性因果关系。',
        },
      ],
      replaySummary: {
        summary:
          '9月30日兆易创新收盘87.99元（前复权），涨幅+9.91%，成交量41920744股，为9月行情中的显著放量上涨日。据公开资料，9月26日中共中央政治局召开会议，强调要加大财政货币政策逆周期调节力度，努力提振资本市场，大力引导中长期资金入市。该会议与本节点时间邻近（相隔4天），可能进一步强化了市场政策预期，但与个股上涨不构成确定性因果关系。个股层面未取得当日公司公告，具体驱动需要更多资料验证。',
        referencedCandidateIds: ['mat-603986-node2-001'],
        isRealTimeAI: false,
        generatedAt: '2026-07-14',
      },
      swLevel3: { ...SW_LEVEL3_MISSING },
    },

    // ========================================================================
    // 节点 3：2024-10-08 单日显著上涨 +10.00%
    // 收盘 96.80，成交量 42265565 股
    // 该节点未找到足够可信的时间邻近资料，展示真实空状态
    // ========================================================================
    {
      id: 'significant_up:603986:2024-10-08',
      date: '2024-10-08',
      close: 96.8,
      changePercent: 10.0,
      volume: 42265565,
      nodeType: 'significant_up',
      nodeTypeLabel: '单日显著上涨',
      marketFact:
        '收盘价 96.80 元（前复权），涨幅 +10.00%（涨停），成交量 42265565 股（约 42.27 万手），为国庆假期后首个交易日的涨停日。',
      observationClues: [
        '该节点为国庆假期后首个交易日，涨幅达涨停板+10.00%',
        '当日成交量为区间内较高水平，显示资金参与度明显提升',
        '该日期附近未找到足够可信的时间邻近公开资料',
      ],
      unconfirmedParts: [
        '该节点暂无可追溯的时间临近资料',
        '当前不能判断涨跌原因',
        '假期前后市场情绪变化与个股涨停的关系尚不明确',
      ],
      materials: [],
      replaySummary: null,
      swLevel3: { ...SW_LEVEL3_MISSING },
    },

    // ========================================================================
    // 节点 4：2024-10-18 单日显著上涨 +6.49%
    // 收盘 87.37，成交量 36143165 股
    // ========================================================================
    {
      id: 'significant_up:603986:2024-10-18',
      date: '2024-10-18',
      close: 87.37,
      changePercent: 6.49,
      volume: 36143165,
      nodeType: 'significant_up',
      nodeTypeLabel: '单日显著上涨',
      marketFact:
        '收盘价 87.37 元（前复权），涨幅 +6.49%，成交量 36143165 股（约 36.14 万手），为10月中旬行情中的显著放量上涨日。',
      observationClues: [
        '10月25日兆易创新披露2024年三季报，业绩大幅增长，时间邻近',
        '前三季度归母净利润同比增长91.87%，第三季度净利润同比增长222.55%',
        '当日成交量为区间内较高水平，显示资金参与度明显提升',
      ],
      unconfirmedParts: [
        '三季报于节点之后7天发布，时间顺序上行情先于财报披露',
        '业绩增长与节点日行情表现不构成确定性因果关系',
        '个股层面未取得当日公司公告，上涨驱动力尚不明确',
      ],
      materials: [
        {
          id: 'mat-603986-node4-001',
          title: '兆易创新2024年第三季度报告',
          publishedAt: '2024-10-25',
          sourceName: '新浪财经',
          sourceUrl: 'https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_BulletinSan/stockid/603986/page_type/sjdbg.phtml',
          collectedAt: '2026-07-14',
          stockCode: '603986',
          nodeDate: '2024-10-18',
          timeDistanceDays: 7,
          materialType: 'company',
          materialTypeLabel: '公司',
          excerpt:
            '兆易创新2024年10月25日披露三季报，前三季度实现营业收入56.5亿元，同比增长28.56%；归母净利润8.32亿元，同比增长91.87%；基本每股收益1.26元。其中第三季度净利润3.15亿元，同比增长222.55%。',
          relevanceNote:
            '三季报于10月25日发布，与10月18日节点时间邻近（后7天），三季报业绩大幅增长可能反映了公司基本面改善，但与节点日的行情表现不构成确定性因果关系。',
        },
      ],
      replaySummary: {
        summary:
          '10月18日兆易创新收盘87.37元（前复权），涨幅+6.49%，成交量36143165股，为10月中旬行情中的显著放量上涨日。据公开资料，兆易创新于10月25日披露2024年三季报，前三季度营业收入同比增长28.56%，归母净利润同比增长91.87%，其中第三季度净利润同比增长222.55%。三季报发布于本节点之后7天，业绩大幅增长可能反映了公司基本面改善，但与节点日的行情表现不构成确定性因果关系，时间顺序上行情先于财报披露。',
        referencedCandidateIds: ['mat-603986-node4-001'],
        isRealTimeAI: false,
        generatedAt: '2026-07-14',
      },
      swLevel3: { ...SW_LEVEL3_MISSING },
    },

    // ========================================================================
    // 节点 5：2024-12-31 单日显著下跌 -6.17%
    // 收盘 106.34，成交量 36654416 股
    // 该节点未找到足够可信的时间邻近资料，展示真实空状态
    // ========================================================================
    {
      id: 'significant_down:603986:2024-12-31',
      date: '2024-12-31',
      close: 106.34,
      changePercent: -6.17,
      volume: 36654416,
      nodeType: 'significant_down',
      nodeTypeLabel: '单日显著下跌',
      marketFact:
        '收盘价 106.34 元（前复权），跌幅 -6.17%，成交量 36654416 股（约 36.65 万手），为2024年最后一个交易日的显著下跌日。',
      observationClues: [
        '该节点为2024年最后一个交易日，跌幅较大',
        '当日成交量为区间内较高水平，显示资金参与度明显提升',
        '该日期附近未找到足够可信的时间邻近公开资料',
      ],
      unconfirmedParts: [
        '该节点暂无可追溯的时间临近资料',
        '当前不能判断跌原因',
        '年末资金动向与个股下跌的关系尚不明确',
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
      usedForNodeIds: ['significant_up:603986:2024-09-26'],
    },
    {
      id: 'src-002',
      title: '中共中央政治局召开会议 分析研究当前经济形势和经济工作',
      sourceName: '最高人民法院转载新华社',
      sourceUrl: 'https://www.court.gov.cn/xinshidai/xiangqing/443931.html',
      publishedAt: '2024-09-26',
      collectedAt: '2026-07-14',
      usedForNodeIds: ['significant_up:603986:2024-09-30'],
    },
    {
      id: 'src-003',
      title: '兆易创新2024年第三季度报告',
      sourceName: '新浪财经',
      sourceUrl: 'https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_BulletinSan/stockid/603986/page_type/sjdbg.phtml',
      publishedAt: '2024-10-25',
      collectedAt: '2026-07-14',
      usedForNodeIds: ['significant_up:603986:2024-10-18'],
    },
  ],
  // 静态案例日历基准日（不依赖浏览器当天日期）
  calendarAsOfDate: '2026-07-14',
  // 案例内置未来事件：1 可核验 + 2 案例演示
  futureEvents: getCaseBuiltInEvents('603986'),
};
