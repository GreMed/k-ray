/**
 * 第十三阶段 A：AI 辅助事件检索 — 验收页面渲染测试
 *
 * 验证开发验收页面的静态结构和状态展示。
 * 不测试真实 API，不依赖网络请求。
 *
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import DevAIEventRetrievalPage from '@/app/dev-ai-event-retrieval/page';
import { AI_EVENT_SAFETY_MESSAGES } from '@/services/aiEventRetrieval/types';

describe('第十三阶段 A：AI 辅助事件检索验收页面', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========== 1. 页面基本结构 ==========

  describe('页面基本结构', () => {
    test('页面标题包含"AI 辅助事件检索"', () => {
      render(<DevAIEventRetrievalPage />);
      expect(screen.getByText(/AI 辅助事件检索 · 开发验收/)).toBeInTheDocument();
    });

    test('页面标注"第十三阶段 A"', () => {
      render(<DevAIEventRetrievalPage />);
      expect(screen.getAllByText(/第十三阶段 A/).length).toBeGreaterThan(0);
    });

    test('页面标注"未接入真实搜索服务"', () => {
      render(<DevAIEventRetrievalPage />);
      expect(screen.getAllByText(/未接入真实搜索服务/).length).toBeGreaterThan(0);
    });

    test('页面包含 6 个主要区块', () => {
      render(<DevAIEventRetrievalPage />);
      expect(screen.getByTestId('section-overview')).toBeInTheDocument();
      expect(screen.getByTestId('section-types')).toBeInTheDocument();
      expect(screen.getByTestId('section-ux-flow')).toBeInTheDocument();
      expect(screen.getByTestId('section-config')).toBeInTheDocument();
      expect(screen.getByTestId('section-safety')).toBeInTheDocument();
      expect(screen.getByTestId('section-acceptance')).toBeInTheDocument();
    });

    test('页面包含静态状态展示区块', () => {
      render(<DevAIEventRetrievalPage />);
      expect(screen.getByTestId('section-static-states')).toBeInTheDocument();
    });
  });

  // ========== 2. 醒目提示区 ==========

  describe('醒目提示区', () => {
    test('包含实验性提示', () => {
      render(<DevAIEventRetrievalPage />);
      expect(screen.getByTestId('warning-block')).toBeInTheDocument();
      expect(screen.getAllByText(new RegExp(AI_EVENT_SAFETY_MESSAGES.EXPERIMENTAL_WARNING.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).length).toBeGreaterThan(0);
    });

    test('包含核心免责声明', () => {
      render(<DevAIEventRetrievalPage />);
      expect(screen.getAllByText(new RegExp(AI_EVENT_SAFETY_MESSAGES.NOT_CAUSE_WARNING.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).length).toBeGreaterThan(0);
    });

    test('包含 AI 能力边界说明', () => {
      render(<DevAIEventRetrievalPage />);
      expect(screen.getAllByText(/AI 只能做检索词生成/).length).toBeGreaterThan(0);
    });

    test('包含不存储全文提示', () => {
      render(<DevAIEventRetrievalPage />);
      expect(screen.getAllByText(/不抓取.*长期存储/).length).toBeGreaterThan(0);
    });
  });

  // ========== 3. 类型契约展示 ==========

  describe('类型契约展示', () => {
    test('展示 AIEventRetrievalMode 枚举', () => {
      render(<DevAIEventRetrievalPage />);
      expect(screen.getAllByText(/AIEventRetrievalMode/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/disabled.*mock.*real/).length).toBeGreaterThan(0);
    });

    test('展示 AICandidateSource 枚举', () => {
      render(<DevAIEventRetrievalPage />);
      expect(screen.getAllByText(/AICandidateSource/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/ai_retrieved.*user_added.*mock_sample/).length).toBeGreaterThan(0);
    });

    test('展示 AIEventCandidate 必填字段说明', () => {
      render(<DevAIEventRetrievalPage />);
      expect(screen.getAllByText(/AIEventCandidate/).length).toBeGreaterThan(0);
      // 必填字段说明在一行文本中
      const allText = document.body.textContent || '';
      expect(allText).toContain('标题');
      expect(allText).toContain('发布时间');
      expect(allText).toContain('来源名称');
      expect(allText).toContain('原文链接');
      expect(allText).toContain('检索时间');
      expect(allText).toContain('查询词');
      expect(allText).toContain('数据模式');
    });

    test('展示 Provider 接口定义', () => {
      render(<DevAIEventRetrievalPage />);
      expect(screen.getAllByText(/AIEventRetrievalDataProvider/).length).toBeGreaterThan(0);
      const allText = document.body.textContent || '';
      expect(allText).toContain('isConfigured');
      expect(allText).toContain('fetchCandidates');
    });
  });

  // ========== 4. 用户体验流程展示 ==========

  describe('用户体验流程展示', () => {
    test('展示 7 个步骤', () => {
      render(<DevAIEventRetrievalPage />);
      expect(screen.getByText(/步骤 1.*点击节点/)).toBeInTheDocument();
      expect(screen.getByText(/步骤 2.*发起检索/)).toBeInTheDocument();
      expect(screen.getByText(/步骤 3.*候选列表/)).toBeInTheDocument();
      expect(screen.getByText(/步骤 4.*打开原文/)).toBeInTheDocument();
      expect(screen.getByText(/步骤 5a.*无结果状态/)).toBeInTheDocument();
      expect(screen.getByText(/步骤 5b.*失败状态/)).toBeInTheDocument();
      expect(screen.getByText(/步骤 5c.*未开通状态/)).toBeInTheDocument();
    });

    test('空结果状态说明不使用 Mock 补位', () => {
      render(<DevAIEventRetrievalPage />);
      const emptyStep = screen.getByText(/步骤 5a.*无结果状态/).closest('div');
      expect(emptyStep?.textContent).toContain('不得使用 Mock 补位');
    });
  });

  // ========== 5. 配置清单展示 ==========

  describe('配置清单展示', () => {
    test('展示 8 个配置项', () => {
      render(<DevAIEventRetrievalPage />);
      expect(screen.getByText('搜索服务 Provider')).toBeInTheDocument();
      expect(screen.getByText('API Key')).toBeInTheDocument();
      expect(screen.getByText('AI 模型')).toBeInTheDocument();
      expect(screen.getByText('请求超时')).toBeInTheDocument();
      expect(screen.getByText('限流间隔')).toBeInTheDocument();
      expect(screen.getByText('成本上限')).toBeInTheDocument();
      expect(screen.getByText('缓存 TTL')).toBeInTheDocument();
      expect(screen.getByText('窗口天数')).toBeInTheDocument();
    });

    test('API Key 环境变量名为 AI_EVENT_SEARCH_API_KEY', () => {
      render(<DevAIEventRetrievalPage />);
      expect(screen.getByText('AI_EVENT_SEARCH_API_KEY')).toBeInTheDocument();
    });

    test('标注不硬编码 API Key', () => {
      render(<DevAIEventRetrievalPage />);
      expect(screen.getByText(/不硬编码/)).toBeInTheDocument();
    });
  });

  // ========== 6. 安全文案清单 ==========

  describe('安全文案清单', () => {
    test('包含 9 条安全文案', () => {
      render(<DevAIEventRetrievalPage />);
      expect(screen.getAllByText(/核心免责/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/实验性提示/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/不可用提示/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/空状态/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Mock 标签/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/真实标签/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/用户添加标签/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/不存储全文/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/AI 能力边界/).length).toBeGreaterThan(0);
    });

    test('包含禁止因果表述清单', () => {
      render(<DevAIEventRetrievalPage />);
      expect(screen.getByTestId('safety-no-causation-checklist')).toBeInTheDocument();
      const checklistText = screen.getByTestId('safety-no-causation-checklist').textContent || '';
      expect(checklistText).toContain('导致上涨');
      expect(checklistText).toContain('目标价');
      expect(checklistText).toContain('买入');
      expect(checklistText).toContain('卖出');
    });
  });

  // ========== 7. 验收标准与测试矩阵 ==========

  describe('验收标准与测试矩阵', () => {
    test('包含 8 个测试场景', () => {
      render(<DevAIEventRetrievalPage />);
      expect(screen.getByTestId('test-matrix')).toBeInTheDocument();
      expect(screen.getAllByText('类型契约完整性').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Mock 标记').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Disabled 标记').length).toBeGreaterThan(0);
      expect(screen.getAllByText('因果隔离').length).toBeGreaterThan(0);
      expect(screen.getAllByText('来源区分').length).toBeGreaterThan(0);
      expect(screen.getAllByText('空状态').length).toBeGreaterThan(0);
      expect(screen.getAllByText('URL 校验').length).toBeGreaterThan(0);
      expect(screen.getAllByText('验收页面渲染').length).toBeGreaterThan(0);
    });
  });

  // ========== 8. 静态状态展示 ==========

  describe('静态状态展示', () => {
    test('展示 Disabled 未开通状态', () => {
      render(<DevAIEventRetrievalPage />);
      expect(screen.getByTestId('state-disabled')).toBeInTheDocument();
      expect(screen.getByText(/状态：未开通/)).toBeInTheDocument();
    });

    test('展示 Mock 开发样本状态', () => {
      render(<DevAIEventRetrievalPage />);
      expect(screen.getByTestId('state-mock')).toBeInTheDocument();
      expect(screen.getByText(/状态：开发样本/)).toBeInTheDocument();
    });

    test('Mock 候选标注为非真实', () => {
      render(<DevAIEventRetrievalPage />);
      // 页面中有多条 [开发样本] 文本，使用 getAllByText 验证至少存在一条
      const mockElements = screen.getAllByText(/\[开发样本\]/);
      expect(mockElements.length).toBeGreaterThan(0);
    });

    test('展示 Real 静态展示状态', () => {
      render(<DevAIEventRetrievalPage />);
      expect(screen.getByTestId('state-real-static')).toBeInTheDocument();
      expect(screen.getByText(/状态：未来真实结果 UI 示例/)).toBeInTheDocument();
    });

    test('Real 状态标注为静态展示非真实检索', () => {
      render(<DevAIEventRetrievalPage />);
      const realSection = screen.getByTestId('state-real-static');
      expect(realSection.textContent).toContain('非真实检索');
      expect(realSection.textContent).toContain('静态 UI 示例');
    });

    test('Real 静态样例不使用绿色 Real 徽标', () => {
      render(<DevAIEventRetrievalPage />);
      const realSection = screen.getByTestId('state-real-static');
      // 不应包含 "Real 真实检索" 文本
      expect(realSection.textContent).not.toContain('Real 真实检索');
    });

    test('Real 静态样例链接文字为"示例原文链接"', () => {
      render(<DevAIEventRetrievalPage />);
      expect(screen.getByText(/示例原文链接.*不可代表真实来源/)).toBeInTheDocument();
    });

    test('Real 静态样例每张卡片标注"静态 UI 示例"', () => {
      render(<DevAIEventRetrievalPage />);
      const labels = screen.getAllByText('静态 UI 示例，非真实检索结果');
      expect(labels.length).toBeGreaterThan(0);
    });

    test('展示空结果状态', () => {
      render(<DevAIEventRetrievalPage />);
      expect(screen.getByTestId('state-empty')).toBeInTheDocument();
      expect(screen.getByText('未检索到候选')).toBeInTheDocument();
    });

    test('空状态说明不使用 Mock 补位', () => {
      render(<DevAIEventRetrievalPage />);
      const emptyState = screen.getByTestId('state-empty');
      expect(emptyState.textContent).toContain('不使用 Mock 补位');
    });

    test('展示错误状态', () => {
      render(<DevAIEventRetrievalPage />);
      expect(screen.getByTestId('state-error')).toBeInTheDocument();
      expect(screen.getByText('检索失败')).toBeInTheDocument();
    });

    test('错误状态说明不使用 Mock 补位', () => {
      render(<DevAIEventRetrievalPage />);
      const errorState = screen.getByTestId('state-error');
      expect(errorState.textContent).toContain('不使用 Mock 补位');
    });

    test('展示加载中状态', () => {
      render(<DevAIEventRetrievalPage />);
      expect(screen.getByTestId('state-loading')).toBeInTheDocument();
      expect(screen.getByText('AI 检索中...')).toBeInTheDocument();
    });

    test('Mock 候选包含原文链接', () => {
      render(<DevAIEventRetrievalPage />);
      const mockCandidate = screen.getByTestId('mock-candidate-0');
      const link = mockCandidate.querySelector('a[href^="https://"]');
      expect(link).not.toBeNull();
    });

    test('Mock 候选包含检索词', () => {
      render(<DevAIEventRetrievalPage />);
      const mockCandidate = screen.getByTestId('mock-candidate-0');
      expect(mockCandidate.textContent).toContain('检索词');
    });

    test('Mock 候选包含关联理由', () => {
      render(<DevAIEventRetrievalPage />);
      const mockCandidate = screen.getByTestId('mock-candidate-0');
      expect(mockCandidate.textContent).toContain('关联理由');
    });
  });

  // ========== 9. 因果隔离验证 ==========

  describe('因果隔离', () => {
    const FORBIDDEN_TERMS = ['导致上涨', '导致下跌', '利好推动', '利空打压', '目标价', '买入', '卖出'];

    test('页面不包含因果表述（禁止清单和测试矩阵除外）', () => {
      render(<DevAIEventRetrievalPage />);
      const pageText = document.body.textContent || '';
      // 定位禁止清单区块的文本
      const checklistElement = screen.getByTestId('safety-no-causation-checklist');
      const checklistText = checklistElement.textContent || '';
      // 测试矩阵区块也可能引用这些词（如"无「导致上涨」"）
      const matrixElement = screen.getByTestId('test-matrix');
      const matrixText = matrixElement.textContent || '';
      const allowedText = checklistText + matrixText;

      for (const term of FORBIDDEN_TERMS) {
        // 全页面中该词出现的次数
        const totalCount = (pageText.match(new RegExp(term, 'g')) || []).length;
        // 允许区域（禁止清单 + 测试矩阵）中该词出现的次数
        const allowedCount = (allowedText.match(new RegExp(term, 'g')) || []).length;
        // 禁止因果表述只能出现在允许区域中
        expect(totalCount).toBeLessThanOrEqual(allowedCount);
      }
    });
  });

  // ========== 10. 页脚 ==========

  describe('页脚', () => {
    test('包含阶段标识', () => {
      render(<DevAIEventRetrievalPage />);
      expect(screen.getByTestId('page-footer')).toBeInTheDocument();
      expect(screen.getByText(/K-Ray 第十三阶段 A/)).toBeInTheDocument();
    });

    test('包含核心免责声明', () => {
      render(<DevAIEventRetrievalPage />);
      const footer = screen.getByTestId('page-footer');
      expect(footer.textContent).toContain('不构成股价涨跌原因');
    });
  });
});
