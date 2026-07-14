// K-Ray Mock 数据 - 仅用于演示
// 注意:所有数据均为演示数据,不代表真实市场情况

import { Stock, KLineData, KeyNode, HistoricalEvent, EventSource, FutureEvent, ReplayResult } from '@/types';

// 演示股票数据
export const mockStocks: Stock[] = [
  {
    id: 'stock-sh-600519',
    code: '600519',
    name: '贵州茅台',
    market: 'SH',
    sector: '白酒'
  },
  {
    id: 'stock-sz-000001',
    code: '000001',
    name: '平安银行',
    market: 'SZ',
    sector: '银行'
  },
  {
    id: 'stock-sz-300750',
    code: '300750',
    name: '宁德时代',
    market: 'SZ',
    sector: '新能源'
  },
  {
    id: 'stock-us-nvda',
    code: 'NVDA',
    name: 'NVIDIA',
    market: 'US',
    sector: 'AI芯片'
  }
];

// 生成连续的K线演示数据 (2024-01-01 到 2024-03-31)
function generateKLines(): KLineData[] {
  const klines: KLineData[] = [];
  let basePrice = 1688;
  
  // 2024年1月1日到3月31日的交易日(简化版)
  const dates = [
    '2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05', '2024-01-08',
    '2024-01-09', '2024-01-10', '2024-01-11', '2024-01-12', '2024-01-15',
    '2024-01-16', '2024-01-17', '2024-01-18', '2024-01-19', '2024-01-22',
    '2024-01-23', '2024-01-24', '2024-01-25', '2024-01-26', '2024-01-29',
    '2024-01-30', '2024-01-31',
    '2024-02-01', '2024-02-02', '2024-02-05', '2024-02-06', '2024-02-07',
    '2024-02-08', '2024-02-19', '2024-02-20', '2024-02-21', '2024-02-22',
    '2024-02-23', '2024-02-26', '2024-02-27', '2024-02-28', '2024-02-29',
    '2024-03-01', '2024-03-04', '2024-03-05', '2024-03-06', '2024-03-07',
    '2024-03-08', '2024-03-11', '2024-03-12', '2024-03-13', '2024-03-14',
    '2024-03-15', '2024-03-18', '2024-03-19', '2024-03-20', '2024-03-21',
    '2024-03-22', '2024-03-25', '2024-03-26', '2024-03-27', '2024-03-28',
    '2024-03-29'
  ];
  
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const id = `kline-600519-${String(i + 1).padStart(3, '0')}`;
    
    // 模拟价格变化
    const change = (Math.sin(i * 0.3) + Math.cos(i * 0.5) * 0.5) * 8;
    const changePercent = Number((change / basePrice * 100).toFixed(2));
    
    const open = basePrice;
    const close = basePrice + change;
    const high = Math.max(open, close) + Math.abs(change) * 0.3;
    const low = Math.min(open, close) - Math.abs(change) * 0.3;
    const volume = Math.floor(4000000 + Math.random() * 8000000);
    
    klines.push({
      id,
      stockId: 'stock-sh-600519',
      date,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
      changePercent
    });
    
    basePrice = close;
  }
  
  return klines;
}

export const mockKLines600519: KLineData[] = generateKLines();

// 演示关键节点数据
export const mockKeyNodes: KeyNode[] = [
  {
    id: 'node-600519-001',
    stockId: 'stock-sh-600519',
    date: '2024-01-08',
    nodeType: 'breakout',
    priceChange: 3.5,
    significance: 'high',
    description: '突破前期高点,成交量放大'
  },
  {
    id: 'node-600519-002',
    stockId: 'stock-sh-600519',
    date: '2024-01-17',
    nodeType: 'peak',
    priceChange: 5.2,
    significance: 'high',
    description: '阶段性高点,市场情绪高涨'
  },
  {
    id: 'node-600519-003',
    stockId: 'stock-sh-600519',
    date: '2024-01-24',
    nodeType: 'breakout',
    priceChange: 6.8,
    significance: 'high',
    description: '重大突破,成交量显著放大'
  },
  {
    id: 'node-600519-004',
    stockId: 'stock-sh-600519',
    date: '2024-02-15',
    nodeType: 'bottom',
    priceChange: -4.2,
    significance: 'medium',
    description: '阶段低点,出现反弹信号'
  },
  {
    id: 'node-600519-005',
    stockId: 'stock-sh-600519',
    date: '2024-03-10',
    nodeType: 'turn',
    priceChange: 2.8,
    significance: 'medium',
    description: '趋势拐点,从下跌转为震荡'
  }
];

// 演示事件来源数据 - 每条来源通过 eventId 关联事件
export const mockSources: EventSource[] = [
  // event-600519-001 的来源（多来源：公司公告 + 财经新闻）
  {
    id: 'source-001',
    name: '公司公告',
    type: 'announcement',
    title: '贵州茅台2023年度业绩预告公告',
    publishTime: '2024-01-08 09:30',
    publisher: '贵州茅台股份有限公司',
    excerpt: '公司预计2023年度实现归属于上市公司股东的净利润同比增长约15%左右。本预告数据为公司初步核算，未经审计，具体数据以正式年报为准。',
    url: 'https://example.com/announcement/600519-20240108',
    isDemo: true,
    eventId: 'event-600519-001'
  },
  {
    id: 'source-001b',
    name: '演示财经媒体',
    type: 'news',
    title: '茅台业绩预告超预期，净利润预增约15%',
    publishTime: '2024-01-08 12:00',
    publisher: '演示财经观察网',
    excerpt: '贵州茅台今日发布业绩预告，预计2023年净利润同比增长约15%，超出市场此前10%-12%的一致预期。分析人士认为产品结构优化和渠道改革是主要驱动因素。',
    url: 'https://example.com/news/600519-earnings-preview',
    isDemo: true,
    eventId: 'event-600519-001'
  },
  // event-600519-002 的来源（单来源：监管文件）
  {
    id: 'source-004',
    name: '演示监管信息',
    type: 'regulatory',
    title: '关于白酒行业税收政策调整征求意见的通知',
    publishTime: '2024-01-10 18:00',
    publisher: '演示监管信息平台',
    excerpt: '为促进行业规范发展，现就白酒行业税收优惠政策调整公开征求意见。意见稿强调品质提升和品牌建设方向，具体实施细则另行通知。',
    url: 'https://example.com/regulatory/policy-20240110',
    isDemo: true,
    eventId: 'event-600519-002'
  },
  // event-600519-003 的来源（单来源：券商观点）
  {
    id: 'source-002',
    name: '演示证券研究部',
    type: 'research',
    title: '贵州茅台盈利预测更新报告',
    publishTime: '2024-01-17 10:15',
    publisher: '演示证券研究部',
    excerpt: '基于最新业绩预告数据，我们更新公司盈利预测，上调2024年目标价区间。维持"买入"评级。本报告仅为研究人员判断，不构成投资建议。',
    url: 'https://example.com/research/600519-analysis',
    isDemo: true,
    eventId: 'event-600519-003'
  },
  // event-600519-004 的来源（单来源：公司公告）
  {
    id: 'source-003',
    name: '公司公告',
    type: 'announcement',
    title: '贵州茅台数字化转型战略规划公告',
    publishTime: '2024-01-24 14:00',
    publisher: '贵州茅台股份有限公司',
    excerpt: '公司将推进数字化转型战略，加大线上渠道投入，优化产品供应链体系。本规划不涉及重大资产重组，实施周期预计2-3年。',
    url: 'https://example.com/research/600519-digital-strategy',
    isDemo: true,
    eventId: 'event-600519-004'
  },
  // event-600519-005 的来源（多来源：公开新闻 + 行业信息）
  {
    id: 'source-005',
    name: '演示财经媒体',
    type: 'news',
    title: '春节后白酒行业终端动销跟踪报道',
    publishTime: '2024-02-15 11:30',
    publisher: '演示每日财经',
    excerpt: '据记者走访调研，春节后部分白酒渠道库存有所增加，终端动销环比放缓。业内人士指出，这属于往年正常的季节性波动，无需过度解读。',
    url: 'https://example.com/news/600519-feb2024',
    isDemo: true,
    eventId: 'event-600519-005'
  },
  {
    id: 'source-005b',
    name: '演示行业协会',
    type: 'industry',
    title: '白酒行业春节后动销数据汇总',
    publishTime: '2024-02-16 09:00',
    publisher: '演示行业协会',
    excerpt: '据演示行业协会不完全统计，春节后两周白酒终端动销环比有所放缓，渠道库存略增。此为阶段性数据，不代表全年趋势。',
    url: 'https://example.com/industry/report-feb2024',
    isDemo: true,
    eventId: 'event-600519-005'
  },
  // event-600519-004 的补充来源（财务报告类型覆盖）
  {
    id: 'source-003b',
    name: '演示财务数据库',
    type: 'financial',
    title: '贵州茅台2023年三季报财务数据摘要',
    publishTime: '2024-01-24 16:00',
    publisher: '演示财务数据库',
    excerpt: '根据公司2023年三季报，前三季度营收同比增长约17%，毛利率维持在91%左右。以上为演示财务数据，不代表真实财务信息。',
    url: 'https://example.com/financial/600519-2023q3',
    isDemo: true,
    eventId: 'event-600519-004'
  },
  // event-600519-006 暂时没有来源（无来源场景演示）
];

// 演示历史事件数据 - 采用审慎表达
export const mockHistoricalEvents: HistoricalEvent[] = [
  {
    id: 'event-600519-001',
    stockId: 'stock-sh-600519',
    eventType: 'performance',
    title: '2023年度业绩预告超预期',
    summary: '公司发布2023年度业绩预告,预计净利润同比增长约15%,市场此前预期约为10%-12%。公告提及产品结构优化和渠道改革是主要驱动因素。',
    occurTime: '2024-01-08',
    sourceIds: ['source-001', 'source-001b'],
    influenceLogic: '业绩预告超出部分机构预期,可能影响市场情绪和投资者预期。该阶段股价出现上行,但走势受多重因素共同影响,不能单独归因于业绩预告。',
    uncertaintyNote: '业绩预告与最终财报可能存在差异,实际业绩需等待年报披露确认。股价波动是多因素共同作用的结果,业绩仅为可能的影响因素之一。',
    relatedNodeId: 'node-600519-001'
  },
  {
    id: 'event-600519-002',
    stockId: 'stock-sh-600519',
    eventType: 'policy',
    title: '白酒行业政策调整信息',
    summary: '监管部门发布白酒行业新政策征求意见稿,涉及税收优惠政策调整和行业规范发展。政策强调品质提升和品牌建设方向。',
    occurTime: '2024-01-10',
    sourceIds: ['source-004'],
    influenceLogic: '行业政策变化可能影响市场对行业整体盈利预期的判断。不同市场参与者对政策解读存在分歧,对龙头企业的影响判断也不一致。',
    uncertaintyNote: '政策仍处于征求意见阶段,实施细节和最终影响尚待观察。股价短期波动受市场情绪影响较大,与政策的相关性需要更长周期验证。',
  },
  {
    id: 'event-600519-003',
    stockId: 'stock-sh-600519',
    eventType: 'expectation',
    title: '多家券商更新研究观点',
    summary: '基于最新业绩预告和行业数据,多家券商发布研究报告更新对公司的盈利预测,部分机构上调目标价区间。报告普遍维持正面评级。',
    occurTime: '2024-01-17',
    sourceIds: ['source-002'],
    influenceLogic: '机构研究观点的集中更新可能影响部分投资者的决策参考。该阶段股价处于相对高位,但高点形成是市场多空博弈的结果,与研报发布不存在确定的因果关系。',
    uncertaintyNote: '券商目标价和评级仅为研究人员的个人或机构判断,不代表实际股价走势。投资者需结合自身风险偏好和判断做出决策。',
    relatedNodeId: 'node-600519-002'
  },
  {
    id: 'event-600519-004',
    stockId: 'stock-sh-600519',
    eventType: 'announcement',
    title: '公司发布战略转型规划',
    summary: '公司公告称将推进数字化转型战略,加大线上渠道投入,优化产品供应链体系。公告提及此举旨在提升运营效率和用户体验,不涉及重大资产重组。',
    occurTime: '2024-01-24',
    sourceIds: ['source-003', 'source-003b'],
    influenceLogic: '战略规划公告可能影响市场对公司长期发展潜力的预期判断。该阶段股价出现突破走势,但突破是技术面和资金面共同作用的结果,战略公告仅为可能的影响线索之一。',
    uncertaintyNote: '战略转型成效需要时间验证,实施过程中可能面临市场环境变化和执行层面的挑战。股价走势受多重因素影响,不能简单归因于单一事件。',
    relatedNodeId: 'node-600519-003'
  },
  {
    id: 'event-600519-005',
    stockId: 'stock-sh-600519',
    eventType: 'risk',
    title: '行业短期需求波动报道',
    summary: '媒体报道称春节后行业终端动销放缓,部分渠道库存有所增加。报道同时提到这属于往年正常季节性波动,无需过度解读。',
    occurTime: '2024-02-15',
    sourceIds: ['source-005', 'source-005b'],
    influenceLogic: '需求波动的相关报道可能短期影响市场情绪。该阶段股价处于相对低位,但低点形成是多种因素共同作用的结果,与该报道不存在确定的因果对应关系。',
    uncertaintyNote: '媒体报道信息来源多样,数据准确性可能存在差异。行业季节性波动属于正常现象,是否构成趋势性变化需要更多数据验证。',
    relatedNodeId: 'node-600519-004'
  },
  {
    id: 'event-600519-006',
    stockId: 'stock-sh-600519',
    eventType: 'sector',
    title: '行业协会发布春季数据',
    summary: '行业协会发布一季度行业运行数据,整体保持平稳增长。数据显示头部企业市场份额持续提升,行业集中度进一步提高。',
    occurTime: '2024-03-10',
    sourceIds: [],
    influenceLogic: '行业数据发布可能为市场参与者提供新的参考信息。该阶段股价出现企稳迹象,但趋势变化是市场多因素积累的结果,行业数据仅为辅助参考线索之一。',
    uncertaintyNote: '行业协会数据通常基于样本统计,与全行业实际情况可能存在偏差。股价趋势转变需要更长时间的确认,单一数据点不足以作为判断依据。',
    relatedNodeId: 'node-600519-005'
  }
];

// 演示未来事件数据 - 使用新结构（eventId、attentionReason、sourceNote、isDemo）
export const mockFutureEvents: FutureEvent[] = [
  {
    eventId: 'future-600519-001',
    stockId: 'stock-sh-600519',
    title: '2024年一季度财报披露',
    eventType: 'performance',
    scheduledDate: '2024-04-25',
    dateCertainty: 'confirmed',
    description: '公司已公告将于4月25日披露2024年第一季度财务报告，市场关注业绩表现及增长趋势。',
    attentionReason: '季度财报是评估公司经营状况的重要节点，可能影响市场对公司增长预期的判断。',
    sourceNote: '依据演示公司公告披露日程，日期已确认。',
    isDemo: true
  },
  {
    eventId: 'future-600519-002',
    stockId: 'stock-sh-600519',
    title: '年度股东大会',
    eventType: 'capital',
    scheduledDate: '2024-05-15',
    dateCertainty: 'confirmed',
    description: '年度股东大会将审议年度报告、分红方案及其他重要议案。',
    attentionReason: '股东大会可能涉及分红方案、治理结构等重要决策，对投资者有参考价值。',
    sourceNote: '依据演示公司董事会通知，日期已确认。',
    isDemo: true
  },
  {
    eventId: 'future-600519-003',
    stockId: 'stock-sh-600519',
    title: '新品系列发布活动',
    eventType: 'announcement',
    scheduledDate: '2024-06-20',
    dateCertainty: 'estimated',
    description: '市场预期公司可能在年中发布新产品系列，具体时间和产品定位尚未正式公告。',
    attentionReason: '新品发布可能影响市场对公司增长潜力和产品竞争力的预期。',
    sourceNote: '依据演示信息平台行业分析预测，日期为预计。',
    isDemo: true
  },
  {
    eventId: 'future-600519-004',
    stockId: 'stock-sh-600519',
    title: '行业新政策实施',
    eventType: 'policy',
    scheduledDate: null,
    dateCertainty: 'tentative',
    description: '监管部门此前征求意见的新政策预计可能于年中正式实施，具体日期尚未确认。',
    attentionReason: '行业政策变化可能影响整体行业估值和公司经营环境。',
    sourceNote: '依据演示信息平台政策跟踪，实施时间待定。',
    isDemo: true
  }
];

// 完整的演示复盘结果
export const mockReplayResult: ReplayResult = {
  stock: mockStocks[0],
  klines: mockKLines600519,
  keyNodes: mockKeyNodes,
  historicalEvents: mockHistoricalEvents,
  sources: mockSources,
  futureEvents: mockFutureEvents
};

// 按日期范围过滤数据的工具函数
export function filterReplayResultByDateRange(
  result: ReplayResult,
  startDate: string,
  endDate: string
): ReplayResult {
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();
  
  const filteredKlines = result.klines.filter(k => {
    const kMs = new Date(k.date).getTime();
    return kMs >= startMs && kMs <= endMs;
  });
  
  const filteredKeyNodes = result.keyNodes.filter(n => {
    const nMs = new Date(n.date).getTime();
    return nMs >= startMs && nMs <= endMs;
  });
  
  const filteredEvents = result.historicalEvents.filter(e => {
    const eMs = new Date(e.occurTime).getTime();
    return eMs >= startMs && eMs <= endMs;
  });
  
  const filteredSourceIds = new Set(filteredEvents.flatMap(e => e.sourceIds));
  const filteredSources = result.sources.filter(s => filteredSourceIds.has(s.id));

  // 未来事件过滤：
  // confirmed/estimated：必须有 scheduledDate，且必须晚于复盘结束日期
  // tentative：不使用日期过滤，始终保留
  const filteredFutureEvents = result.futureEvents.filter(f => {
    if (f.dateCertainty === 'tentative') {
      return true;
    }
    if (!f.scheduledDate) {
      return false;
    }
    const fMs = new Date(f.scheduledDate).getTime();
    return fMs > endMs;
  });

  return {
    ...result,
    klines: filteredKlines,
    keyNodes: filteredKeyNodes,
    historicalEvents: filteredEvents,
    sources: filteredSources,
    futureEvents: filteredFutureEvents
  };
}

// 根据股票ID获取复盘结果(模拟API)
export function getMockReplayResult(stockId: string, startDate?: string, endDate?: string): ReplayResult | null {
  if (stockId === 'stock-sh-600519') {
    let result = { ...mockReplayResult };
    if (startDate && endDate) {
      result = filterReplayResultByDateRange(result, startDate, endDate);
    }
    return result;
  }
  return null;
}

// 模拟搜索股票
export function searchMockStocks(keyword: string): Stock[] {
  const lowerKeyword = keyword.toLowerCase();
  return mockStocks.filter(stock =>
    stock.code.toLowerCase().includes(lowerKeyword) ||
    stock.name.toLowerCase().includes(lowerKeyword)
  );
}

// 以下工具函数已迁移到 utils/eventAggregation.ts，此处仅做兼容re-export
// 推荐直接从 utils/eventAggregation.ts 导入
export {
  filterKLinesByDate,
  filterNodesByDate,
  filterEventsByDate,
  aggregateEventsUnified as aggregateEvents,
  type AggregatedEventGroup,
} from '@/utils/eventAggregation';
