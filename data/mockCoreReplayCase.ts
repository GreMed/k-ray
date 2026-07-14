// 第十五阶段 A：Mock 核心复盘体验案例数据
//
// 严格隔离要求：
// - 使用稳定 ID，不依赖当前日期
// - 不发起网络请求
// - 不写入本地存储
// - 不影响真实行情页面
// - 所有字段显式标记 dataMode: 'mock'
// - 不提供看似真实的新闻链接
// - 所有内容均为演示数据，不代表真实市场事实
//
// 案例对象：宁德时代（300750）
// 设计了 3 个关键节点，每个节点包含 AI 复盘要点、事件候选、分析链路

import { KLineData, MockCoreReplayCase } from '@/types';

// ============================================================================
// Mock K 线数据：宁德时代 2024-09-23 至 2024-10-21（共 21 个交易日）
// 价格区间约 180~295 元，覆盖一次显著上涨、阶段高点、显著下跌
// 数据为设计数据，不代表真实行情
// ============================================================================

const STOCK_ID = 'mock-stock-sz-300750';
const STOCK_CODE = '300750';

const mockKlines: KLineData[] = [
  // 9月下旬：盘整阶段，价格在 180~190 区间
  { id: 'mock-kline-300750-001', stockId: STOCK_ID, date: '2024-09-23', open: 182.50, high: 185.20, low: 181.00, close: 184.30, volume: 28000000, changePercent: 0.82 },
  { id: 'mock-kline-300750-002', stockId: STOCK_ID, date: '2024-09-24', open: 185.00, high: 199.80, low: 184.50, close: 198.70, volume: 72000000, changePercent: 7.81 },  // ★ 节点1：单日显著上涨
  { id: 'mock-kline-300750-003', stockId: STOCK_ID, date: '2024-09-25', open: 200.00, high: 212.50, low: 198.00, close: 210.40, volume: 65000000, changePercent: 5.89 },
  { id: 'mock-kline-300750-004', stockId: STOCK_ID, date: '2024-09-26', open: 211.00, high: 218.00, low: 207.50, close: 215.60, volume: 52000000, changePercent: 2.47 },
  { id: 'mock-kline-300750-005', stockId: STOCK_ID, date: '2024-09-27', open: 216.00, high: 228.00, low: 214.00, close: 226.80, volume: 58000000, changePercent: 5.20 },
  { id: 'mock-kline-300750-006', stockId: STOCK_ID, date: '2024-09-30', open: 228.00, high: 245.00, low: 226.50, close: 243.50, volume: 61000000, changePercent: 7.36 },
  // 国庆假期后：10-08 小幅高开（涨幅 4.31% < 5%），盘中冲高 295 后回落收 254，仍为区间局部最高点（high=295）
  { id: 'mock-kline-300750-007', stockId: STOCK_ID, date: '2024-10-08', open: 250.00, high: 295.00, low: 248.00, close: 254.00, volume: 88000000, changePercent: 4.31 }, // ★ 节点2：阶段高点（当日涨幅 4.31% < 5%，high=295 为区间最高）
  { id: 'mock-kline-300750-008', stockId: STOCK_ID, date: '2024-10-09', open: 252.00, high: 258.00, low: 242.00, close: 245.00, volume: 75000000, changePercent: -3.54 },
  { id: 'mock-kline-300750-009', stockId: STOCK_ID, date: '2024-10-10', open: 244.00, high: 248.00, low: 238.00, close: 240.00, volume: 48000000, changePercent: -2.04 },
  { id: 'mock-kline-300750-010', stockId: STOCK_ID, date: '2024-10-11', open: 240.00, high: 243.00, low: 233.00, close: 235.00, volume: 42000000, changePercent: -2.08 },
  { id: 'mock-kline-300750-011', stockId: STOCK_ID, date: '2024-10-14', open: 234.00, high: 237.00, low: 227.00, close: 229.00, volume: 45000000, changePercent: -2.55 },
  { id: 'mock-kline-300750-012', stockId: STOCK_ID, date: '2024-10-15', open: 228.00, high: 231.00, low: 220.00, close: 222.00, volume: 50000000, changePercent: -3.06 },
  { id: 'mock-kline-300750-013', stockId: STOCK_ID, date: '2024-10-16', open: 220.00, high: 222.00, low: 208.00, close: 209.50, volume: 68000000, changePercent: -5.63 },  // ★ 节点3：单日显著下跌
  { id: 'mock-kline-300750-014', stockId: STOCK_ID, date: '2024-10-17', open: 210.00, high: 215.00, low: 205.00, close: 213.00, volume: 44000000, changePercent: 1.67 },
  { id: 'mock-kline-300750-015', stockId: STOCK_ID, date: '2024-10-18', open: 214.00, high: 219.00, low: 210.00, close: 217.50, volume: 41000000, changePercent: 2.11 },
  { id: 'mock-kline-300750-016', stockId: STOCK_ID, date: '2024-10-21', open: 218.00, high: 222.00, low: 214.00, close: 220.50, volume: 38000000, changePercent: 1.38 },
  { id: 'mock-kline-300750-017', stockId: STOCK_ID, date: '2024-10-22', open: 220.00, high: 223.00, low: 216.00, close: 217.00, volume: 32000000, changePercent: -1.59 },
  { id: 'mock-kline-300750-018', stockId: STOCK_ID, date: '2024-10-23', open: 217.00, high: 219.00, low: 212.00, close: 213.50, volume: 35000000, changePercent: -1.61 },
  { id: 'mock-kline-300750-019', stockId: STOCK_ID, date: '2024-10-24', open: 214.00, high: 216.00, low: 210.00, close: 211.00, volume: 30000000, changePercent: -1.17 },
  { id: 'mock-kline-300750-020', stockId: STOCK_ID, date: '2024-10-25', open: 212.00, high: 215.00, low: 208.00, close: 214.00, volume: 28000000, changePercent: 1.42 },
  { id: 'mock-kline-300750-021', stockId: STOCK_ID, date: '2024-10-28', open: 215.00, high: 218.00, low: 211.00, close: 216.00, volume: 26000000, changePercent: 0.93 },
];

// ============================================================================
// Mock 核心复盘案例
// ============================================================================

export const mockCoreReplayCase: MockCoreReplayCase = {
  id: 'mock-core-replay-300750-001',
  stockCode: STOCK_CODE,
  stockName: '宁德时代',
  market: 'SZ',
  sector: '新能源',
  description: '宁德时代（300750）2024年9月至10月行情复盘示例。本案例展示如何从关键股价节点出发，结合时间邻近的事件候选，理解行情波动可能相关的观察线索。所有数据和复盘内容均为 Mock 演示，不代表真实市场事实。',
  klines: mockKlines,
  dataMode: 'mock',
  nodes: [
    // ========================================================================
    // 节点 1：单日显著上涨（2024-09-24，+7.81%）
    // ========================================================================
    {
      id: 'mock-node-300750-significant_up-2024-09-24',
      date: '2024-09-24',
      close: 198.70,
      changePercent: 7.81,
      volume: 72000000,
      nodeType: 'significant_up',
      nodeTypeLabel: '单日显著上涨',
      dataMode: 'mock',
      aiReplaySummary: '9月24日宁德时代放量大涨7.81%，成交量较前日翻倍以上。当日宏观层面出现降准降息等宽松政策信号，新能源板块整体走强，板块情绪可能相关。个股层面未见当日公司公告，上涨可能更多受板块情绪带动，具体驱动需要结合更多资料核验。',
      marketFact: '收盘价 198.70 元，涨幅 +7.81%，成交量 7200 万股（约 72 万手），较前一交易日成交量放大约 157%。',
      observationClues: [
        '当日成交量显著放大，较前日翻倍以上，显示资金参与度明显提升',
        '同期新能源板块整体走强，多只成分股录得较大涨幅',
        '宏观政策面出现宽松信号，市场风险偏好可能回升',
      ],
      unconfirmedParts: [
        '无法确认资金流入的具体来源（机构/散户/北向等）',
        '个股层面无当日公司公告，上涨驱动力尚不明确',
        '板块联动是原因还是同步表现，需要结合更多资料核验',
      ],
      candidates: [
        {
          id: 'mock-candidate-300750-node1-001',
          title: '央行宣布降准0.5个百分点（Mock演示候选）',
          date: '2024-09-24',
          candidateType: 'market',
          candidateTypeLabel: '市场',
          timeDistanceDays: 0,
          timeDistanceLabel: '与节点同日',
          reasonForCandidate: '宏观宽松政策同日发布，可能提振市场整体风险偏好，与板块及个股上涨时间邻近。',
          verificationStatus: 'mock_unverified',
          verificationLabel: 'Mock待核验',
          dataMode: 'mock',
        },
        {
          id: 'mock-candidate-300750-node1-002',
          title: '新能源板块多只成分股同日大涨（Mock演示候选）',
          date: '2024-09-24',
          candidateType: 'industry',
          candidateTypeLabel: '行业',
          timeDistanceDays: 0,
          timeDistanceLabel: '与节点同日',
          reasonForCandidate: '板块联动现象明显，宁德时代作为权重股可能受板块情绪带动，时间高度邻近。',
          verificationStatus: 'mock_unverified',
          verificationLabel: 'Mock待核验',
          dataMode: 'mock',
        },
        {
          id: 'mock-candidate-300750-node1-003',
          title: '公司发布新一代电池技术进展（Mock演示候选）',
          date: '2024-09-20',
          candidateType: 'company',
          candidateTypeLabel: '公司',
          timeDistanceDays: -4,
          timeDistanceLabel: '节点前 4 天',
          reasonForCandidate: '节点前数日有公司技术相关消息，可能提前影响市场预期，但时间间隔较长，关联性需要结合更多资料核验。',
          verificationStatus: 'mock_unverified',
          verificationLabel: 'Mock待核验',
          dataMode: 'mock',
        },
      ],
    },

    // ========================================================================
    // 节点 2：阶段高点（2024-10-08，收盘 254.00，区间最高 295.00，当日涨幅 4.31%）
    // ========================================================================
    {
      id: 'mock-node-300750-local_high-2024-10-08',
      date: '2024-10-08',
      close: 254.00,
      changePercent: 4.31,
      volume: 88000000,
      nodeType: 'local_high',
      nodeTypeLabel: '阶段高点',
      dataMode: 'mock',
      aiReplaySummary: '10月8日为国庆假期后首个交易日，宁德时代高开后冲高，盘中最高触及295元，收盘254.00元，涨幅4.31%，成交量达区间峰值。假期期间港股新能源板块表现强势可能形成情绪传导。当日为本轮上涨的阶段高点，此后价格逐步回落，可能反映短期获利了结情绪。',
      marketFact: '收盘价 254.00 元，涨幅 +4.31%，盘中最高 295.00 元为区间最高价，成交量 8800 万股（约 88 万手），为整个区间最大成交量。',
      observationClues: [
        '国庆假期期间港股新能源板块表现强势，节后A股可能存在情绪传导',
        '成交量达区间峰值，显示当日多空分歧较大',
        '此后数日价格持续回落，可能反映短期获利了结',
      ],
      unconfirmedParts: [
        '假期情绪传导的具体幅度无法量化',
        '高点后的回落属于正常调整还是趋势反转，需要结合更多资料核验',
        '机构资金在节后首日的具体动向尚不明确',
      ],
      candidates: [
        {
          id: 'mock-candidate-300750-node2-001',
          title: '国庆假期港股新能源板块累计上涨（Mock演示候选）',
          date: '2024-10-01',
          candidateType: 'market',
          candidateTypeLabel: '市场',
          timeDistanceDays: -7,
          timeDistanceLabel: '节点前 7 天',
          reasonForCandidate: '假期期间外围市场新能源板块走强，可能通过情绪传导影响节后A股开盘定价，时间邻近。',
          verificationStatus: 'mock_unverified',
          verificationLabel: 'Mock待核验',
          dataMode: 'mock',
        },
        {
          id: 'mock-candidate-300750-node2-002',
          title: '行业分析师上调新能源车销量预期（Mock演示候选）',
          date: '2024-10-07',
          candidateType: 'industry',
          candidateTypeLabel: '行业',
          timeDistanceDays: -1,
          timeDistanceLabel: '节点前 1 天',
          reasonForCandidate: '节前有行业研究机构上调新能源车销量预期，可能影响节后市场对产业链的定价，时间邻近。',
          verificationStatus: 'mock_unverified',
          verificationLabel: 'Mock待核验',
          dataMode: 'mock',
        },
        {
          id: 'mock-candidate-300750-node2-003',
          title: '上游锂盐价格假期企稳（Mock演示候选）',
          date: '2024-10-05',
          candidateType: 'upstream',
          candidateTypeLabel: '上下游',
          timeDistanceDays: -3,
          timeDistanceLabel: '节点前 3 天',
          reasonForCandidate: '上游原材料价格企稳可能改善市场对电池企业毛利的预期，与节后冲高时间邻近，关联性需要结合更多资料核验。',
          verificationStatus: 'mock_unverified',
          verificationLabel: 'Mock待核验',
          dataMode: 'mock',
        },
        {
          id: 'mock-candidate-300750-node2-004',
          title: '公司三季报业绩预告窗口临近（Mock演示候选）',
          date: '2024-10-10',
          candidateType: 'company',
          candidateTypeLabel: '公司',
          timeDistanceDays: 2,
          timeDistanceLabel: '节点后 2 天',
          reasonForCandidate: '三季报预告披露窗口临近，市场可能提前交易业绩预期，与高点形成时间邻近，但方向性关联需要结合更多资料核验。',
          verificationStatus: 'mock_unverified',
          verificationLabel: 'Mock待核验',
          dataMode: 'mock',
        },
      ],
    },

    // ========================================================================
    // 节点 3：单日显著下跌（2024-10-16，-5.63%）
    // ========================================================================
    {
      id: 'mock-node-300750-significant_down-2024-10-16',
      date: '2024-10-16',
      close: 209.50,
      changePercent: -5.63,
      volume: 68000000,
      nodeType: 'significant_down',
      nodeTypeLabel: '单日显著下跌',
      dataMode: 'mock',
      aiReplaySummary: '10月16日宁德时代下跌5.63%，成交量较前日有所放大。此前自高点已连续回调数日，当日跌幅加速。同期有上游锂盐价格波动及部分行业研报调整评级的市场讨论，可能相关。个股层面无当日重大公告，下跌可能更多受前期涨幅较大后的获利了结及板块情绪影响，具体驱动需要结合更多资料核验。',
      marketFact: '收盘价 209.50 元，跌幅 -5.63%，成交量 6800 万股（约 68 万手），较前一交易日成交量放大约 36%。自 10 月 8 日高点 254.00 元已累计回调约 17.5%。',
      observationClues: [
        '自阶段高点已累计回调约17.5%，当日跌幅加速可能反映恐慌情绪',
        '成交量较前日放大，显示卖压有所增加',
        '同期有上游原材料价格波动及部分研报调整讨论',
        '前期涨幅较大，获利了结压力可能相关',
      ],
      unconfirmedParts: [
        '下跌是单纯技术性回调还是基本面预期变化，需要结合更多资料核验',
        '上游价格波动对电池企业盈利的实际影响方向尚不明确',
        '机构资金流向的具体数据未取得',
      ],
      candidates: [
        {
          id: 'mock-candidate-300750-node3-001',
          title: '上游锂盐价格出现波动（Mock演示候选）',
          date: '2024-10-15',
          candidateType: 'upstream',
          candidateTypeLabel: '上下游',
          timeDistanceDays: -1,
          timeDistanceLabel: '节点前 1 天',
          reasonForCandidate: '上游原材料价格波动可能影响市场对电池产业链盈利的预期，与次日下跌时间邻近，关联性需要结合更多资料核验。',
          verificationStatus: 'mock_unverified',
          verificationLabel: 'Mock待核验',
          dataMode: 'mock',
        },
        {
          id: 'mock-candidate-300750-node3-002',
          title: '部分券商调整新能源板块评级（Mock演示候选）',
          date: '2024-10-14',
          candidateType: 'industry',
          candidateTypeLabel: '行业',
          timeDistanceDays: -2,
          timeDistanceLabel: '节点前 2 天',
          reasonForCandidate: '节点前有行业研报调整评级的讨论，可能影响市场情绪，时间邻近。但研报观点与个股下跌的因果关系需要结合更多资料核验。',
          verificationStatus: 'mock_unverified',
          verificationLabel: 'Mock待核验',
          dataMode: 'mock',
        },
        {
          id: 'mock-candidate-300750-node3-003',
          title: '前期累计涨幅较大，获利了结压力（Mock演示候选）',
          date: '2024-10-16',
          candidateType: 'market',
          candidateTypeLabel: '市场',
          timeDistanceDays: 0,
          timeDistanceLabel: '与节点同日',
          reasonForCandidate: '自9月24日至10月8日高点累计涨幅较大，短期涨幅较大后获利了结是常见的市场行为，与下跌时间邻近。',
          verificationStatus: 'mock_unverified',
          verificationLabel: 'Mock待核验',
          dataMode: 'mock',
        },
      ],
    },
  ],
};
