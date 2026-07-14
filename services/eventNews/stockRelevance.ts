// K-Ray 第十阶段 A：股票相关性验证逻辑（封板修复版）
//
// verified 的产品含义：
//   "新闻标题已经能够确认目标公司是主要新闻主体。"
// 正文提及、股票列表出现、履历关系、指数代码或板块成分，只能视为候选线索，不能 verified。
//
// 判断顺序（必须严格按序）：
//   1. 缺少格式合格来源链接 → unverified, isRealEventCandidate=false
//   2. 标题属于汇总内容（榜单/资金流/板块/融资/大宗交易/ETF/指数/排行/"等N股"）→ unverified, isMultiStockSummary=true, isRealEventCandidate=false
//      （即使标题或正文出现目标代码、公司名称，也必须 unverified，该判断必须早于证券简称和代码 verified 判断）
//   3. 标题明确包含目标公司完整证券简称，并且不是汇总标题 → verified, isRealEventCandidate=true
//   4. 标题只出现股票代码：
//      - 000001 必须特别处理：只有出现"平安银行"、"000001.SZ"、"SZ000001"等明确身份时才能 verified
//      - "上证指数（000001）"必须 unverified
//      - 其他代码：只有能结合市场明确确认时才可以 verified
//   5. 目标公司或代码只出现在正文 → 一律 unverified，"仅正文提及，不能确认目标公司是新闻主体"
//   6. 标题属于其他公司，但正文提到目标公司的任职经历、合作方、同行对比或板块成分 → unverified
//
// verifyStockRelevance 需要接收目标 market，以区分 000001.SZ 与上证指数代码

// 已知股票完整证券简称映射（仅使用完整、明确的证券简称，不使用过宽简称）
const KNOWN_STOCK_NAMES: Record<string, string[]> = {
  '600519': ['贵州茅台'],
  '000001': ['平安银行'],
  '300750': ['宁德时代'],
  '688981': ['中芯国际'],
};

// 多股汇总类标题关键词（泛化榜单、资金流、融资、大宗交易、板块汇总、ETF、指数、排行等）
// 已删除无效字面关键词：等N股、等数股（改用正则识别）
const MULTI_STOCK_SUMMARY_KEYWORDS = [
  '榜单', '排行榜', '排名', '资金流', '资金流向', '流入', '流出',
  '融资', '融券', '大宗交易', '板块', '涨幅榜', '跌幅榜', '龙虎榜',
  '一览', '汇总', '概览', '多数', '多只', '个股', '集体', '纷纷',
  '主力', '净买入', '净卖出', '活跃股', '热门', '异动',
  'ETF', '指数', '排行', '撤离', '入场',
  '回购潮', '真金白银', '创历史新高',
];

// 多主体标题正则识别（等N股、等多股、多家公司、多只股票、多只个股）
const MULTI_SUBJECT_REGEX = [
  /等\s*\d+\s*股/,      // "等6股"、"等 12 股"
  /等多股/,
  /多家公司/,
  /多只股票/,
  /多只个股/,
];

// 上证指数相关关键词（000001 是上证指数代码，必须与平安银行区分）
const INDEX_KEYWORDS_FOR_000001 = [
  '上证指数', '上证综指', '上证综合', '大盘指数', '沪指',
];

// 明确身份标记（用于 000001 区分平安银行与上证指数）
const CLEAR_IDENTITY_MARKERS_000001 = [
  '平安银行', '000001.SZ', 'SZ000001', 'sz000001', '深市000001', '深000001',
];

// eventNews 服务内部的 A 股代码前缀（包含 301xxx 创业板，比第八阶段主行情更宽松）
// 不修改已冻结的 utils/stockCode.ts，在服务内部实现完整代码过滤
const EVENT_NEWS_SH_PREFIXES = ['600', '601', '603', '605', '688'];
const EVENT_NEWS_SZ_PREFIXES = ['000', '001', '002', '003', '300', '301'];

// eventNews 服务内部的 A 股代码校验（支持 301xxx 创业板前缀）
// 金额、指数编号和普通六位数字不能仅凭格式就认定为目标股票
export function isValidEventNewsAShareCode(code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const prefix = code.substring(0, 3);
  return EVENT_NEWS_SH_PREFIXES.includes(prefix) || EVENT_NEWS_SZ_PREFIXES.includes(prefix);
}

// 从文本中提取所有 6 位股票代码
// 必须再使用 isValidEventNewsAShareCode 过滤，确保只保留符合沪深 A 股代码前缀的数字
// 金额中的六位数字（如 142472）不符合 A 股代码前缀，不会被识别
export function extractStockCodes(text: string): string[] {
  const matches = text.match(/\b\d{6}\b/g) || [];
  // 过滤：必须是有效的沪深 A 股代码（包含 301xxx 创业板）
  const validCodes = matches.filter(code => isValidEventNewsAShareCode(code));
  return [...new Set(validCodes)];
}

// 检查文本中是否包含目标股票的完整证券简称
function containsStockName(text: string, stockCode: string): boolean {
  const names = KNOWN_STOCK_NAMES[stockCode];
  if (!names) return false;
  return names.some(name => text.includes(name));
}

// 判断标题是否为多股汇总类（泛化榜单、资金流、融资、大宗交易、板块汇总、ETF、指数、排行等）
// 同时使用正则识别多主体结构（等N股、等多股、多家公司、多只股票、多只个股）
function isMultiStockSummaryTitle(title: string): boolean {
  if (MULTI_STOCK_SUMMARY_KEYWORDS.some(keyword => title.includes(keyword))) {
    return true;
  }
  return MULTI_SUBJECT_REGEX.some(regex => regex.test(title));
}

// 判断文本中是否包含 000001 的上证指数语义
function isIndexContextFor000001(text: string): boolean {
  return INDEX_KEYWORDS_FOR_000001.some(keyword => text.includes(keyword));
}

// 判断文本中是否包含 000001 的明确平安银行身份标记
function hasClearIdentityFor000001(text: string): boolean {
  return CLEAR_IDENTITY_MARKERS_000001.some(marker => text.includes(marker));
}

// 股票相关性验证结果
export interface RelevanceVerification {
  status: 'verified' | 'unverified';
  matchedStockCodes: string[];
  reason: string;
  // 是否为多股汇总候选
  isMultiStockSummary: boolean;
}

// 验证单条新闻与目标股票的相关性
// 严格按序判断，verified 只表示"新闻标题已经能够确认目标公司是主要新闻主体"
export function verifyStockRelevance(
  title: string,
  content: string,
  targetStockCode: string,
  hasValidUrl: boolean,
  targetMarket?: 'SH' | 'SZ',
): RelevanceVerification {
  // 分别提取标题和正文中的股票代码
  // 禁止继续只使用 title.includes(targetStockCode) 判断代码主体，避免目标代码只是较长数字的一部分
  const titleStockCodes = extractStockCodes(title);
  const bodyStockCodes = extractStockCodes(content);
  const allCodes = [...new Set([...titleStockCodes, ...bodyStockCodes])];

  const titleNameMatch = containsStockName(title, targetStockCode);
  const titleCodeMatch = titleStockCodes.includes(targetStockCode);
  const bodyNameMention = containsStockName(content, targetStockCode);
  const bodyCodeMention = bodyStockCodes.includes(targetStockCode);
  // 标题中出现的其他有效股票代码（用于判断多主体结构）
  const otherTitleStockCodes = titleStockCodes.filter(c => c !== targetStockCode);
  const isSummaryTitle = isMultiStockSummaryTitle(title);

  // 1. 缺少格式合格来源链接 → unverified
  if (!hasValidUrl) {
    return {
      status: 'unverified',
      matchedStockCodes: allCodes,
      reason: '缺少格式合格来源链接，无法验证新闻真实性',
      isMultiStockSummary: false,
    };
  }

  // 2. 标题属于汇总内容或多主体结构 → unverified（即使标题或正文出现目标代码、公司名称，也必须 unverified）
  // 该判断必须早于证券简称和代码 verified 判断
  if (isSummaryTitle) {
    const matchedNames = KNOWN_STOCK_NAMES[targetStockCode]?.filter(n => `${title} ${content}`.includes(n)) || [];
    const mentionDetail = titleCodeMatch || bodyCodeMention || matchedNames.length > 0
      ? `（标题或正文提及目标 ${targetStockCode}${matchedNames.length > 0 ? `/${matchedNames.join('、')}` : ''}，但标题为汇总/多主体内容）`
      : '';
    return {
      status: 'unverified',
      matchedStockCodes: allCodes,
      reason: `多股汇总候选，不能确认目标股票是新闻主体（标题为榜单/资金流/板块/ETF/指数/排行/等N股等多主体内容）${mentionDetail}`,
      isMultiStockSummary: true,
    };
  }

  // 2.5 标题同时出现目标代码和其他有效股票代码 → 多主体结构，unverified
  // 即使不是汇总标题，标题同时包含多个股票代码也不能确认主体
  if (titleCodeMatch && otherTitleStockCodes.length > 0) {
    return {
      status: 'unverified',
      matchedStockCodes: allCodes,
      reason: `标题同时出现目标代码 ${targetStockCode} 和其他股票代码（${otherTitleStockCodes.join('、')}），为多主体结构，不能确认目标公司是新闻主体`,
      isMultiStockSummary: true,
    };
  }

  // 3. 标题明确包含目标公司完整证券简称，并且不是汇总/多主体标题 → verified
  if (titleNameMatch) {
    const matchedNames = KNOWN_STOCK_NAMES[targetStockCode]?.filter(n => title.includes(n)) || [];
    return {
      status: 'verified',
      matchedStockCodes: allCodes,
      reason: `标题明确包含目标公司完整证券简称（${matchedNames.join('、')}），可确认目标公司是新闻主体`,
      isMultiStockSummary: false,
    };
  }

  // 4. 标题只出现股票代码（没有完整证券简称）
  if (titleCodeMatch) {
    // 000001 必须特别处理：只有出现"平安银行"、"000001.SZ"、"SZ000001"等明确身份时才能 verified
    if (targetStockCode === '000001') {
      // "上证指数（000001）"必须 unverified（即使 targetMarket=SZ）
      if (isIndexContextFor000001(title)) {
        return {
          status: 'unverified',
          matchedStockCodes: allCodes,
          reason: '标题中的 000001 为上证指数代码，非平安银行股票代码',
          isMultiStockSummary: false,
        };
      }
      // 只有明确身份标记才能 verified
      if (hasClearIdentityFor000001(title)) {
        return {
          status: 'verified',
          matchedStockCodes: allCodes,
          reason: `标题中出现 000001 且有明确身份标记（平安银行/000001.SZ 等），结合目标市场 ${targetMarket || '未知'} 可确认目标公司是新闻主体`,
          isMultiStockSummary: false,
        };
      }
      // 标题只有 000001 但无明确身份 → unverified
      // 即使 targetMarket=SZ，也不能仅凭代码确认是平安银行
      return {
        status: 'unverified',
        matchedStockCodes: allCodes,
        reason: `标题中的 000001 无法确认是平安银行还是上证指数（目标市场 ${targetMarket || '未知'}），需要明确身份标记`,
        isMultiStockSummary: false,
      };
    }

    // 其他代码：标题仅出现目标代码（无其他股票代码，且不是汇总标题）→ verified
    // otherTitleStockCodes.length === 0 已在 2.5 判断中保证
    return {
      status: 'verified',
      matchedStockCodes: allCodes,
      reason: `标题明确包含目标股票代码 ${targetStockCode}，且无其他股票代码，可确认目标公司是新闻主体`,
      isMultiStockSummary: false,
    };
  }

  // 5. 目标公司或代码只出现在正文 → 一律 unverified
  if (bodyNameMention || bodyCodeMention) {
    return {
      status: 'unverified',
      matchedStockCodes: allCodes,
      reason: '仅正文提及，不能确认目标公司是新闻主体',
      isMultiStockSummary: false,
    };
  }

  // 6. 标题属于其他公司，但正文提到目标公司的任职经历、合作方、同行对比或板块成分
  // 不包含目标代码或简称 → unverified
  if (allCodes.length > 0) {
    return {
      status: 'unverified',
      matchedStockCodes: allCodes,
      reason: `标题或内容中不包含目标股票代码 ${targetStockCode} 或其证券简称，但包含其他股票代码（${allCodes.join('、')}），可能为其他公司新闻`,
      isMultiStockSummary: false,
    };
  }

  // 无法提取任何股票代码，也无法匹配证券简称
  return {
    status: 'unverified',
    matchedStockCodes: [],
    reason: `标题或内容中未识别到目标股票代码 ${targetStockCode} 或其证券简称，无法确认与目标股票的相关性`,
    isMultiStockSummary: false,
  };
}
