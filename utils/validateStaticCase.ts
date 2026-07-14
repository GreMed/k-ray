// 第十五阶段 B1：静态案例数据校验工具
//
// 纯校验逻辑，不发起网络请求，不修改数据
// 用于测试和运行时校验静态案例数据的完整性

import { StaticHistoricalCase, KLineData } from '@/types';

export interface ValidationIssue {
  rule: string;
  message: string;
  nodeId?: string;
  materialId?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

// URL 校验：必须是 http/https 开头，不得是 example.com
function isValidRealUrl(url: string): boolean {
  if (!url) return false;
  if (!/^https?:\/\//i.test(url)) return false;
  if (/example\.com/i.test(url)) return false;
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(url)) return false;
  return true;
}

// 校验静态案例数据
export function validateStaticCase(caseData: StaticHistoricalCase): ValidationResult {
  const issues: ValidationIssue[] = [];

  // 1. K 线日期升序且不重复
  const dates = caseData.klines.map((k) => k.date);
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] <= dates[i - 1]) {
      issues.push({
        rule: 'kline_date_ascending',
        message: `K线日期不是升序或存在重复：${dates[i - 1]} -> ${dates[i]}`,
      });
    }
  }

  // 2. OHLCV 均为有效数字
  caseData.klines.forEach((k: KLineData) => {
    const { open, high, low, close, volume } = k;
    if (
      typeof open !== 'number' || !isFinite(open) || open <= 0 ||
      typeof high !== 'number' || !isFinite(high) || high <= 0 ||
      typeof low !== 'number' || !isFinite(low) || low <= 0 ||
      typeof close !== 'number' || !isFinite(close) || close <= 0 ||
      typeof volume !== 'number' || !isFinite(volume) || volume < 0
    ) {
      issues.push({
        rule: 'kline_ohlcv_valid',
        message: `K线 OHLCV 无效：${k.date}`,
      });
    }
    if (high < Math.max(open, close, low) || low > Math.min(open, close, high)) {
      issues.push({
        rule: 'kline_ohlcv_consistent',
        message: `K线 OHLC 关系不一致：${k.date} (O=${open}, H=${high}, L=${low}, C=${close})`,
      });
    }
  });

  // 3. 节点日期一定存在于 K 线数据中
  caseData.nodes.forEach((node) => {
    if (!dates.includes(node.date)) {
      issues.push({
        rule: 'node_date_in_klines',
        message: `节点日期 ${node.date} 不存在于K线数据中`,
        nodeId: node.id,
      });
    }
  });

  // 4. 节点涨跌幅与 K 线计算结果一致
  caseData.nodes.forEach((node) => {
    const klineIdx = dates.indexOf(node.date);
    if (klineIdx > 0) {
      const prevClose = caseData.klines[klineIdx - 1].close;
      const currClose = caseData.klines[klineIdx].close;
      const calculated = ((currClose - prevClose) / prevClose) * 100;
      if (Math.abs(calculated - node.changePercent) > 0.1) {
        issues.push({
          rule: 'node_changepercent_consistent',
          message: `节点 ${node.id} 涨跌幅 ${node.changePercent} 与K线计算 ${calculated.toFixed(2)} 不一致`,
          nodeId: node.id,
        });
      }
    }
  });

  // 5. 每条事件都有真实 http/https 链接和来源
  caseData.nodes.forEach((node) => {
    node.materials.forEach((mat) => {
      if (!mat.title || !mat.publishedAt || !mat.sourceName || !mat.sourceUrl) {
        issues.push({
          rule: 'material_fields_complete',
          message: `资料 ${mat.id} 缺少必填字段`,
          materialId: mat.id,
        });
      }
      if (!isValidRealUrl(mat.sourceUrl)) {
        issues.push({
          rule: 'material_url_real',
          message: `资料 ${mat.id} 链接无效或为 example.com：${mat.sourceUrl}`,
          materialId: mat.id,
        });
      }
    });
  });

  // 5b. 自动校验 timeDistanceDays：从 publishedAt 提取 YYYY-MM-DD，重新计算自然日差值
  // 使用 UTC 日期逻辑避免本地时区产生一天偏差
  caseData.nodes.forEach((node) => {
    node.materials.forEach((mat) => {
      // 从 publishedAt 提取 YYYY-MM-DD（可能带时分，只取日期部分）
      const publishedDateStr = mat.publishedAt.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(publishedDateStr)) {
        issues.push({
          rule: 'material_publishedAt_format',
          message: `资料 ${mat.id} publishedAt 格式无效：${mat.publishedAt}`,
          materialId: mat.id,
        });
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(mat.nodeDate)) {
        issues.push({
          rule: 'material_nodeDate_format',
          message: `资料 ${mat.id} nodeDate 格式无效：${mat.nodeDate}`,
          materialId: mat.id,
        });
        return;
      }
      // 使用 UTC 日期计算，避免本地时区偏差
      const publishedMs = Date.UTC(
        parseInt(publishedDateStr.slice(0, 4), 10),
        parseInt(publishedDateStr.slice(5, 7), 10) - 1,
        parseInt(publishedDateStr.slice(8, 10), 10),
      );
      const nodeMs = Date.UTC(
        parseInt(mat.nodeDate.slice(0, 4), 10),
        parseInt(mat.nodeDate.slice(5, 7), 10) - 1,
        parseInt(mat.nodeDate.slice(8, 10), 10),
      );
      const dayMs = 24 * 60 * 60 * 1000;
      const calculated = Math.round((nodeMs - publishedMs) / dayMs);
      // calculated > 0 表示发布在节点之前（节点前 X 天，timeDistanceDays 应为负数）
      // calculated < 0 表示发布在节点之后（节点后 X 天，timeDistanceDays 应为正数）
      // calculated === 0 表示同日，timeDistanceDays 应为 0
      const expectedTimeDistance = -calculated;
      if (mat.timeDistanceDays !== expectedTimeDistance) {
        issues.push({
          rule: 'material_time_distance_consistent',
          message: `资料 ${mat.id} 时间距离不一致：publishedAt=${publishedDateStr}, nodeDate=${mat.nodeDate}, 声明值=${mat.timeDistanceDays}, 计算值=${expectedTimeDistance}`,
          materialId: mat.id,
        });
      }
    });
  });

  // 6. AI 摘要引用的 candidateId 必须真实存在
  caseData.nodes.forEach((node) => {
    if (node.replaySummary) {
      node.replaySummary.referencedCandidateIds.forEach((cid) => {
        const found = node.materials.find((m) => m.id === cid);
        if (!found) {
          issues.push({
            rule: 'summary_candidate_exists',
            message: `节点 ${node.id} 摘要引用了不存在的 candidateId：${cid}`,
            nodeId: node.id,
          });
        }
      });
    }
  });

  // 7. 案例不得标记为实时数据或 Mock 数据
  if (caseData.isRealTime !== false) {
    issues.push({ rule: 'not_realtime', message: '案例不得标记为实时数据' });
  }
  if (caseData.isMock !== false) {
    issues.push({ rule: 'not_mock', message: '案例不得标记为 Mock 数据' });
  }
  if (caseData.caseMode !== 'static_historical') {
    issues.push({ rule: 'case_mode', message: '案例模式必须为 static_historical' });
  }

  // 8. 页面不得出现 example.com（检查所有 URL 字段）
  const allUrls: string[] = [];
  caseData.nodes.forEach((n) => {
    n.materials.forEach((m) => allUrls.push(m.sourceUrl));
    if (n.swLevel3.sourceUrl) allUrls.push(n.swLevel3.sourceUrl);
  });
  caseData.sourceList.forEach((s) => allUrls.push(s.sourceUrl));
  allUrls.forEach((url) => {
    if (/example\.com/i.test(url)) {
      issues.push({ rule: 'no_example_com', message: `发现 example.com 链接：${url}` });
    }
  });

  // 9. 申万三级涨跌幅缺少可靠来源时必须为空状态
  caseData.nodes.forEach((node) => {
    const sw = node.swLevel3;
    const hasPartial =
      (sw.industryName && !sw.sourceUrl) ||
      (sw.changePercent !== null && !sw.sourceUrl) ||
      (sw.indexCode && !sw.collectedAt);
    if (hasPartial) {
      issues.push({
        rule: 'sw_level3_consistent',
        message: `节点 ${node.id} 申万三级数据不完整：有值但缺少来源链接或采集时间`,
        nodeId: node.id,
      });
    }
  });

  return {
    valid: issues.length === 0,
    issues,
  };
}
