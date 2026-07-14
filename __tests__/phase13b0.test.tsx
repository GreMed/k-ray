/**
 * 第十三阶段 B0：个人搜索服务设置入口 — 验收测试
 *
 * 覆盖 8 个场景：
 * 1. 普通用户页面可找到并打开"个人搜索服务设置"
 * 2. 默认状态明确为 Mock-only / 未接入真实搜索
 * 3. Key 输入框为密码类型
 * 4. 保存后只显示脱敏配置状态，页面中不存在完整 Key
 * 5. 刷新页面后当前会话内仍能读取脱敏状态
 * 6. 清除后状态恢复为未配置
 * 7. 测试中断言本阶段没有 fetch、没有 API 请求、没有真实搜索调用
 * 8. Mock 新闻候选不会因配置 Key 而被改标为真实候选
 *
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import Header from '@/components/Header';
import {
  isPersonalSearchConfigured,
  getConfiguredProvider,
  clearPersonalSearchConfig,
} from '@/components/PersonalSearchSettings';

// ============================================================================
// Mock global fetch — 用于断言本阶段不发起任何网络请求
// ============================================================================

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch as unknown as typeof fetch;

// ============================================================================
// 测试套件
// ============================================================================

describe('第十三阶段 B0：个人搜索服务设置入口', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
    // 清理 sessionStorage
    sessionStorage.clear();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    sessionStorage.clear();
  });

  // ========== 场景 1：普通用户页面可找到并打开设置 ==========

  describe('场景 1：普通用户页面可找到并打开"个人搜索服务设置"', () => {
    test('Header 中存在"个人搜索服务设置"入口按钮', () => {
      render(<Header />);
      expect(screen.getByTestId('personal-search-settings-entry')).toBeInTheDocument();
      expect(screen.getByText('个人搜索服务设置')).toBeInTheDocument();
    });

    test('点击入口按钮打开设置弹窗', () => {
      render(<Header />);
      const entryBtn = screen.getByTestId('personal-search-settings-entry');

      act(() => {
        fireEvent.click(entryBtn);
      });

      expect(screen.getByTestId('personal-search-settings-modal')).toBeInTheDocument();
    });

    test('点击关闭按钮关闭弹窗', () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-close'));
      });

      expect(screen.queryByTestId('personal-search-settings-modal')).not.toBeInTheDocument();
    });

    test('点击遮罩层关闭弹窗', () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-overlay'));
      });

      expect(screen.queryByTestId('personal-search-settings-modal')).not.toBeInTheDocument();
    });
  });

  // ========== 场景 2：默认状态明确为 Mock-only ==========

  describe('场景 2：默认状态明确为 Mock-only / 未接入真实搜索', () => {
    test('弹窗显示"当前版本仅支持 Mock 演示候选，尚未接入真实搜索"', () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      expect(screen.getByTestId('personal-search-mock-only-notice')).toBeInTheDocument();
      expect(screen.getByText(/当前版本仅支持 Mock 演示候选/)).toBeInTheDocument();
    });

    test('弹窗显示"真实搜索尚未在当前版本开放"', () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      const modal = screen.getByTestId('personal-search-settings-modal');
      expect(modal.textContent).toContain('真实搜索尚未在当前版本开放');
    });

    test('服务商选项标注"未来可连接，本版未启用"', () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      const select = screen.getByTestId('personal-search-provider-select');
      const options = select.querySelectorAll('option');
      expect(options.length).toBe(4); // 空选项 + 3 个服务商

      // 每个服务商选项都标注"未启用"
      const optionTexts = Array.from(options).map((o) => o.textContent);
      expect(optionTexts.some((t) => t?.includes('OpenAI') && t?.includes('未启用'))).toBe(true);
      expect(optionTexts.some((t) => t?.includes('Anthropic') && t?.includes('未启用'))).toBe(true);
      expect(optionTexts.some((t) => t?.includes('Custom') && t?.includes('未启用'))).toBe(true);
    });

    test('初始配置状态为"未配置"', async () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('personal-search-masked-status').textContent).toBe('未配置');
      });
    });
  });

  // ========== 场景 3：Key 输入框为密码类型 ==========

  describe('场景 3：Key 输入框为密码类型', () => {
    test('API Key 输入框 type 为 password', () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      const input = screen.getByTestId('personal-search-api-key-input') as HTMLInputElement;
      expect(input.type).toBe('password');
    });
  });

  // ========== 场景 4：保存后只显示脱敏状态 ==========

  describe('场景 4：保存后只显示脱敏配置状态，页面不存在完整 Key', () => {
    test('保存后显示"已在当前会话中配置 Key"，不显示完整 Key', async () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      // 选择服务商
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-provider-select'), {
          target: { value: 'openai' },
        });
      });

      // 输入 API Key
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-api-key-input'), {
          target: { value: 'sk-test-secret-key-123456789' },
        });
      });

      // 保存
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      // 脱敏状态应包含"已在当前会话中配置 Key"
      await waitFor(() => {
        const status = screen.getByTestId('personal-search-masked-status').textContent;
        expect(status).toContain('已在当前会话中配置 Key');
        expect(status).toContain('openai');
      });

      // 页面中不应出现完整 Key
      const modalText = screen.getByTestId('personal-search-settings-modal').textContent || '';
      expect(modalText).not.toContain('sk-test-secret-key-123456789');
    });

    test('保存后输入框被清空', async () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-provider-select'), {
          target: { value: 'anthropic' },
        });
      });

      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-api-key-input'), {
          target: { value: 'sk-another-secret-key' },
        });
      });

      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      await waitFor(() => {
        const input = screen.getByTestId('personal-search-api-key-input') as HTMLInputElement;
        expect(input.value).toBe('');
      });
    });
  });

  // ========== 场景 5：刷新页面后会话内仍能读取脱敏状态 ==========

  describe('场景 5：刷新页面后当前会话内仍能读取脱敏状态', () => {
    test('保存后关闭弹窗再打开，仍显示已配置状态', async () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-provider-select'), {
          target: { value: 'openai' },
        });
      });

      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-api-key-input'), {
          target: { value: 'sk-persist-test-key' },
        });
      });

      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      // 关闭弹窗
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-close'));
      });

      // 重新打开弹窗，应读取 sessionStorage 中的配置状态
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      await waitFor(() => {
        const status = screen.getByTestId('personal-search-masked-status').textContent;
        expect(status).toContain('已在当前会话中配置 Key');
        expect(status).toContain('openai');
      });

      // 仍不应显示完整 Key
      const modalText = screen.getByTestId('personal-search-settings-modal').textContent || '';
      expect(modalText).not.toContain('sk-persist-test-key');
    });

    test('isPersonalSearchConfigured 返回 true', async () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      // 新校验：有 Key 无服务商不允许保存，因此必须先选择服务商
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-provider-select'), {
          target: { value: 'openai' },
        });
      });

      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-api-key-input'), {
          target: { value: 'sk-configured-key' },
        });
      });

      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      expect(isPersonalSearchConfigured()).toBe(true);
      expect(getConfiguredProvider()).toBe('openai');
    });
  });

  // ========== 场景 6：清除后状态恢复为未配置 ==========

  describe('场景 6：清除后状态恢复为未配置', () => {
    test('点击清除按钮后状态恢复为"未配置"', async () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      // 先配置
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-provider-select'), {
          target: { value: 'openai' },
        });
      });

      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-api-key-input'), {
          target: { value: 'sk-to-be-cleared' },
        });
      });

      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('personal-search-masked-status').textContent).toContain('已在当前会话中配置 Key');
      });

      // 清除
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-clear-btn'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('personal-search-masked-status').textContent).toBe('未配置');
      });

      expect(isPersonalSearchConfigured()).toBe(false);
      expect(getConfiguredProvider()).toBe('');
    });

    test('清除后 sessionStorage 中的 Key 被删除', async () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      // 先选择服务商（新校验：有 Key 无服务商不允许保存）
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-provider-select'), {
          target: { value: 'openai' },
        });
      });

      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-api-key-input'), {
          target: { value: 'sk-clear-session' },
        });
      });

      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      expect(sessionStorage.getItem('k-ray:personal-search:api-key')).toBe('sk-clear-session');

      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-clear-btn'));
      });

      expect(sessionStorage.getItem('k-ray:personal-search:api-key')).toBeNull();
    });
  });

  // ========== 场景 7：断言本阶段没有 fetch / API 请求 / 真实搜索调用 ==========

  describe('场景 7：断言本阶段没有 fetch、API 请求、真实搜索调用', () => {
    test('打开弹窗、保存、清除全程不调用 fetch', () => {
      render(<Header />);

      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-provider-select'), {
          target: { value: 'openai' },
        });
      });

      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-api-key-input'), {
          target: { value: 'sk-no-fetch-key' },
        });
      });

      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-clear-btn'));
      });

      // 全程不调用 fetch
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('弹窗中不包含"检索""调用 AI""验证 Key"等会触发网络请求的按钮', () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      const modalText = screen.getByTestId('personal-search-settings-modal').textContent || '';
      // 不应包含会触发网络请求的操作按钮文案
      expect(modalText).not.toContain('检索');
      expect(modalText).not.toContain('调用 AI');
      expect(modalText).not.toContain('验证 Key');
      expect(modalText).not.toContain('连接搜索');
      expect(modalText).not.toContain('开始搜索');
    });

    test('弹窗只有保存、清除、关闭三个操作按钮', () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      const buttons = screen.getByTestId('personal-search-settings-modal').querySelectorAll('button');
      // 关闭按钮 + 清除按钮 + 保存按钮 = 3 个
      expect(buttons.length).toBe(3);
    });
  });

  // ========== 场景 8：Mock 新闻候选不会因配置 Key 而被改标为真实候选 ==========

  describe('场景 8：Mock 新闻候选不会因配置 Key 而被改标为真实候选', () => {
    test('配置 Key 后弹窗仍明确标注 Mock-only', async () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      // 配置 Key
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-provider-select'), {
          target: { value: 'openai' },
        });
      });

      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-api-key-input'), {
          target: { value: 'sk-mock-still-key' },
        });
      });

      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      // 配置后仍显示 Mock-only 提示
      expect(screen.getByTestId('personal-search-mock-only-notice')).toBeInTheDocument();
      expect(screen.getByText(/当前版本仅支持 Mock 演示候选/)).toBeInTheDocument();

      // 配置后仍说明"真实搜索尚未在当前版本开放"
      const modalText = screen.getByTestId('personal-search-settings-modal').textContent || '';
      expect(modalText).toContain('真实搜索尚未在当前版本开放');
      expect(modalText).toContain('节点新闻候选仍为 Mock 演示数据');
    });

    test('配置 Key 后页面不出现"AI 已开启""智能复盘"等夸大文案', async () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      // 先选择服务商（新校验：有 Key 无服务商不允许保存）
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-provider-select'), {
          target: { value: 'openai' },
        });
      });

      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-api-key-input'), {
          target: { value: 'sk-no-exaggeration' },
        });
      });

      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      const pageText = document.body.textContent || '';
      expect(pageText).not.toContain('AI 已开启');
      expect(pageText).not.toContain('智能复盘');
      expect(pageText).not.toContain('真实搜索已开启');
      expect(pageText).not.toContain('已启用真实搜索');
    });

    test('配置 Key 后脱敏状态不暗示真实搜索已生效', async () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-provider-select'), {
          target: { value: 'openai' },
        });
      });

      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-api-key-input'), {
          target: { value: 'sk-no-imply-real' },
        });
      });

      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      await waitFor(() => {
        const status = screen.getByTestId('personal-search-masked-status').textContent || '';
        // 脱敏状态只说"已在当前会话中配置 Key"，不暗示真实搜索已生效
        expect(status).toContain('已在当前会话中配置 Key');
        expect(status).not.toContain('真实搜索已生效');
        expect(status).not.toContain('已启用');
      });
    });
  });

  // ========== 补充：安全说明展示 ==========

  describe('安全说明展示', () => {
    test('弹窗显示"Key 仅保存在当前浏览器会话中"安全说明', () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      expect(screen.getByTestId('personal-search-safety-notice')).toBeInTheDocument();
      const safetyText = screen.getByTestId('personal-search-safety-notice').textContent || '';
      expect(safetyText).toContain('Key 仅保存在当前浏览器会话中');
      expect(safetyText).toContain('不上传到 K-Ray 服务器');
      expect(safetyText).toContain('不写入项目文件');
      expect(safetyText).toContain('关闭浏览器后需要重新输入');
    });
  });

  // ========== 补充：工具函数测试 ==========

  describe('工具函数', () => {
    test('clearPersonalSearchConfig 清除后 isPersonalSearchConfigured 返回 false', () => {
      sessionStorage.setItem('k-ray:personal-search:api-key', 'sk-test');
      expect(isPersonalSearchConfigured()).toBe(true);

      clearPersonalSearchConfig();
      expect(isPersonalSearchConfigured()).toBe(false);
    });

    test('getConfiguredProvider 返回已配置的服务商', () => {
      sessionStorage.setItem('k-ray:personal-search:provider', 'anthropic');
      expect(getConfiguredProvider()).toBe('anthropic');
    });
  });

  // ========== 场景 9：保存一致性修复（sessionStorage 与页面状态一致） ==========

  describe('场景 9：保存一致性修复', () => {
    test('先保存 provider+Key，再只修改 provider 保存，Key 仍存在', async () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      // 第一次保存：provider=openai + Key
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-provider-select'), {
          target: { value: 'openai' },
        });
      });
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-api-key-input'), {
          target: { value: 'sk-original-key-12345' },
        });
      });
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      // 确认 sessionStorage 中有 Key
      expect(sessionStorage.getItem('k-ray:personal-search:api-key')).toBe('sk-original-key-12345');
      expect(sessionStorage.getItem('k-ray:personal-search:provider')).toBe('openai');

      // 第二次保存：只切换服务商，不重新填写 Key
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-provider-select'), {
          target: { value: 'anthropic' },
        });
      });
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      // sessionStorage 中的 Key 必须仍然存在（未被删除）
      expect(sessionStorage.getItem('k-ray:personal-search:api-key')).toBe('sk-original-key-12345');
      // provider 已更新
      expect(sessionStorage.getItem('k-ray:personal-search:provider')).toBe('anthropic');

      // 页面状态与 sessionStorage 一致：显示"已在当前会话中配置 Key"
      await waitFor(() => {
        const status = screen.getByTestId('personal-search-masked-status').textContent || '';
        expect(status).toContain('已在当前会话中配置 Key');
        expect(status).toContain('anthropic');
      });

      // 页面不出现完整 Key
      const modalText = screen.getByTestId('personal-search-settings-modal').textContent || '';
      expect(modalText).not.toContain('sk-original-key-12345');
    });

    test('保存新 Key 会替换旧 Key', async () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      // 第一次保存：Key = sk-old-key
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-provider-select'), {
          target: { value: 'openai' },
        });
      });
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-api-key-input'), {
          target: { value: 'sk-old-key-99999' },
        });
      });
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      expect(sessionStorage.getItem('k-ray:personal-search:api-key')).toBe('sk-old-key-99999');

      // 第二次保存：输入新 Key = sk-new-key
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-api-key-input'), {
          target: { value: 'sk-new-key-88888' },
        });
      });
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      // sessionStorage 中的 Key 应被替换
      expect(sessionStorage.getItem('k-ray:personal-search:api-key')).toBe('sk-new-key-88888');
      expect(sessionStorage.getItem('k-ray:personal-search:api-key')).not.toBe('sk-old-key-99999');

      // 页面不出现任何完整 Key
      const modalText = screen.getByTestId('personal-search-settings-modal').textContent || '';
      expect(modalText).not.toContain('sk-old-key-99999');
      expect(modalText).not.toContain('sk-new-key-88888');
    });

    test('只有清除按钮会删除 Key（保存按钮不会删除）', async () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      // 保存 provider + Key
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-provider-select'), {
          target: { value: 'openai' },
        });
      });
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-api-key-input'), {
          target: { value: 'sk-persist-key-777' },
        });
      });
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      expect(sessionStorage.getItem('k-ray:personal-search:api-key')).toBe('sk-persist-key-777');

      // 多次点击保存（不输入新 Key），Key 仍存在
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });
      expect(sessionStorage.getItem('k-ray:personal-search:api-key')).toBe('sk-persist-key-777');

      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });
      expect(sessionStorage.getItem('k-ray:personal-search:api-key')).toBe('sk-persist-key-777');

      // 只有点击"清除配置"才会删除 Key
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-clear-btn'));
      });
      expect(sessionStorage.getItem('k-ray:personal-search:api-key')).toBeNull();
      expect(sessionStorage.getItem('k-ray:personal-search:provider')).toBeNull();

      // 页面状态恢复为"未配置"
      await waitFor(() => {
        expect(screen.getByTestId('personal-search-masked-status').textContent).toBe('未配置');
      });
    });

    test('无服务商时不能保存 Key，显示"请先选择服务商"提示', async () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      // 不选择服务商，直接输入 Key
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-api-key-input'), {
          target: { value: 'sk-no-provider-key' },
        });
      });

      // 点击保存
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      // 应显示"请先选择服务商"提示
      expect(screen.getByTestId('personal-search-save-error')).toBeInTheDocument();
      expect(screen.getByTestId('personal-search-save-error').textContent).toContain('请先选择服务商');

      // sessionStorage 中不应保存 Key
      expect(sessionStorage.getItem('k-ray:personal-search:api-key')).toBeNull();

      // 页面状态仍为"未配置"
      expect(screen.getByTestId('personal-search-masked-status').textContent).toBe('未配置');

      // 页面不出现完整 Key
      const modalText = screen.getByTestId('personal-search-settings-modal').textContent || '';
      expect(modalText).not.toContain('sk-no-provider-key');
    });

    test('只选择服务商未填写 Key，状态明确为"已选择服务商，未填写 Key"', async () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      // 只选择服务商，不填写 Key
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-provider-select'), {
          target: { value: 'custom' },
        });
      });

      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      // sessionStorage 中只有 provider，没有 Key
      expect(sessionStorage.getItem('k-ray:personal-search:provider')).toBe('custom');
      expect(sessionStorage.getItem('k-ray:personal-search:api-key')).toBeNull();

      // 页面状态显示"已选择服务商"
      await waitFor(() => {
        const status = screen.getByTestId('personal-search-masked-status').textContent || '';
        expect(status).toContain('已选择服务商');
        expect(status).toContain('custom');
        expect(status).toContain('未填写 Key');
      });
    });

    test('全程不出现完整 Key 文本', async () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-provider-select'), {
          target: { value: 'openai' },
        });
      });
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-api-key-input'), {
          target: { value: 'sk-full-leak-test-key-555' },
        });
      });
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      // 保存后输入框被清空
      const input = screen.getByTestId('personal-search-api-key-input') as HTMLInputElement;
      expect(input.value).toBe('');

      // 整个弹窗文本不含完整 Key
      const modalText = screen.getByTestId('personal-search-settings-modal').textContent || '';
      expect(modalText).not.toContain('sk-full-leak-test-key-555');

      // 整个页面文本不含完整 Key
      const pageText = document.body.textContent || '';
      expect(pageText).not.toContain('sk-full-leak-test-key-555');
    });

    test('保存一致性全程不调用 fetch 或其他网络请求', () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      // 保存 provider + Key
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-provider-select'), {
          target: { value: 'openai' },
        });
      });
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-api-key-input'), {
          target: { value: 'sk-no-fetch-consistency' },
        });
      });
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      // 只切换 provider 不输入新 Key
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-provider-select'), {
          target: { value: 'anthropic' },
        });
      });
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      // 输入新 Key 替换旧 Key
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-api-key-input'), {
          target: { value: 'sk-replacement-key' },
        });
      });
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      // 清除
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-clear-btn'));
      });

      // 全程不调用 fetch
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ========== 场景 10：孤立 Key 边界防御（已有 Key + 选回空服务商） ==========

  describe('场景 10：孤立 Key 边界防御', () => {
    test('已有 Key 时将服务商选回空保存，显示提示且不修改 sessionStorage', async () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      // 保存 OpenAI + Key
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-provider-select'), {
          target: { value: 'openai' },
        });
      });
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-api-key-input'), {
          target: { value: 'sk-original-key-999' },
        });
      });
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      // 确认 sessionStorage 已写入
      expect(sessionStorage.getItem('k-ray:personal-search:provider')).toBe('openai');
      expect(sessionStorage.getItem('k-ray:personal-search:api-key')).toBe('sk-original-key-999');

      // 将服务商选回"请选择服务商"（空）
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-provider-select'), {
          target: { value: '' },
        });
      });

      // 点击保存
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      // 断言出现提示
      expect(screen.getByTestId('personal-search-save-error')).toBeInTheDocument();
      expect(screen.getByTestId('personal-search-save-error').textContent).toContain(
        '已配置 Key 时必须保留一个服务商'
      );
      expect(screen.getByTestId('personal-search-save-error').textContent).toContain('清除配置');

      // 断言 sessionStorage 中原 provider 和 Key 均未改变
      expect(sessionStorage.getItem('k-ray:personal-search:provider')).toBe('openai');
      expect(sessionStorage.getItem('k-ray:personal-search:api-key')).toBe('sk-original-key-999');

      // 断言页面仍显示原服务商的已配置状态
      await waitFor(() => {
        const status = screen.getByTestId('personal-search-masked-status').textContent || '';
        expect(status).toContain('已在当前会话中配置 Key');
        expect(status).toContain('openai');
      });

      // 页面不出现完整 Key
      const modalText = screen.getByTestId('personal-search-settings-modal').textContent || '';
      expect(modalText).not.toContain('sk-original-key-999');
    });

    test('已有 Key 时将服务商选回空并输入新 Key 保存，仍被拦截', async () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      // 保存 OpenAI + Key
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-provider-select'), {
          target: { value: 'openai' },
        });
      });
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-api-key-input'), {
          target: { value: 'sk-first-key' },
        });
      });
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      // 选回空服务商 + 输入新 Key
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-provider-select'), {
          target: { value: '' },
        });
      });
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-api-key-input'), {
          target: { value: 'sk-attempt-replace' },
        });
      });
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      // 仍被校验 1 拦截（已有 Key + 空服务商）
      expect(screen.getByTestId('personal-search-save-error').textContent).toContain(
        '已配置 Key 时必须保留一个服务商'
      );

      // sessionStorage 中原 provider 和 Key 均未改变
      expect(sessionStorage.getItem('k-ray:personal-search:provider')).toBe('openai');
      expect(sessionStorage.getItem('k-ray:personal-search:api-key')).toBe('sk-first-key');

      // 新 Key 未被保存
      expect(sessionStorage.getItem('k-ray:personal-search:api-key')).not.toBe('sk-attempt-replace');

      // 页面不出现任何完整 Key
      const modalText = screen.getByTestId('personal-search-settings-modal').textContent || '';
      expect(modalText).not.toContain('sk-first-key');
      expect(modalText).not.toContain('sk-attempt-replace');
    });

    test('已有 Key 时切换到另一个服务商（非空）保存，正常更新且 Key 保留', async () => {
      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      // 保存 OpenAI + Key
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-provider-select'), {
          target: { value: 'openai' },
        });
      });
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-api-key-input'), {
          target: { value: 'sk-keep-key' },
        });
      });
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      // 切换到 anthropic（非空），不输入新 Key
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-provider-select'), {
          target: { value: 'anthropic' },
        });
      });
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      // provider 更新为 anthropic，Key 保留
      expect(sessionStorage.getItem('k-ray:personal-search:provider')).toBe('anthropic');
      expect(sessionStorage.getItem('k-ray:personal-search:api-key')).toBe('sk-keep-key');

      // 无错误提示
      expect(screen.queryByTestId('personal-search-save-error')).not.toBeInTheDocument();

      // 页面显示新服务商的已配置状态
      await waitFor(() => {
        const status = screen.getByTestId('personal-search-masked-status').textContent || '';
        expect(status).toContain('已在当前会话中配置 Key');
        expect(status).toContain('anthropic');
      });
    });

    test('历史孤立 Key 状态：打开弹窗时 sessionStorage 有 Key 无 provider，显示"配置异常"', async () => {
      // 预设异常历史状态：有 Key 无 provider
      sessionStorage.setItem('k-ray:personal-search:api-key', 'sk-orphaned-history-key');

      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      // 应显示"配置异常，请清除后重新设置"
      await waitFor(() => {
        const status = screen.getByTestId('personal-search-masked-status').textContent || '';
        expect(status).toBe('配置异常，请清除后重新设置');
      });

      // 不显示正常的"已配置 Key"
      const status = screen.getByTestId('personal-search-masked-status').textContent || '';
      expect(status).not.toContain('已在当前会话中配置 Key');

      // 不回显完整 Key
      const modalText = screen.getByTestId('personal-search-settings-modal').textContent || '';
      expect(modalText).not.toContain('sk-orphaned-history-key');

      // 清除按钮应可用
      expect(screen.getByTestId('personal-search-clear-btn')).toBeInTheDocument();
    });

    test('历史孤立 Key 状态下点击清除，恢复正常未配置状态', async () => {
      sessionStorage.setItem('k-ray:personal-search:api-key', 'sk-orphaned-to-clear');

      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('personal-search-masked-status').textContent).toBe(
          '配置异常，请清除后重新设置'
        );
      });

      // 点击清除
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-clear-btn'));
      });

      // 恢复未配置状态
      await waitFor(() => {
        expect(screen.getByTestId('personal-search-masked-status').textContent).toBe('未配置');
      });

      // sessionStorage 清空
      expect(sessionStorage.getItem('k-ray:personal-search:api-key')).toBeNull();
      expect(sessionStorage.getItem('k-ray:personal-search:provider')).toBeNull();

      // 不回显完整 Key
      const modalText = screen.getByTestId('personal-search-settings-modal').textContent || '';
      expect(modalText).not.toContain('sk-orphaned-to-clear');
    });

    test('历史孤立 Key 状态下选择服务商并保存，恢复正常配置且 Key 保留', async () => {
      sessionStorage.setItem('k-ray:personal-search:api-key', 'sk-orphaned-recover');

      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('personal-search-masked-status').textContent).toBe(
          '配置异常，请清除后重新设置'
        );
      });

      // 选择服务商（不输入新 Key，保留原 Key）
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-provider-select'), {
          target: { value: 'anthropic' },
        });
      });
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      // 状态恢复正常
      await waitFor(() => {
        const status = screen.getByTestId('personal-search-masked-status').textContent || '';
        expect(status).toContain('已在当前会话中配置 Key');
        expect(status).toContain('anthropic');
      });

      // sessionStorage 中 Key 保留，provider 写入
      expect(sessionStorage.getItem('k-ray:personal-search:api-key')).toBe('sk-orphaned-recover');
      expect(sessionStorage.getItem('k-ray:personal-search:provider')).toBe('anthropic');

      // 不回显完整 Key
      const modalText = screen.getByTestId('personal-search-settings-modal').textContent || '';
      expect(modalText).not.toContain('sk-orphaned-recover');
    });

    test('历史孤立 Key 状态下不选服务商直接保存，显示提示且不修改配置', async () => {
      sessionStorage.setItem('k-ray:personal-search:api-key', 'sk-orphaned-block');

      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('personal-search-masked-status').textContent).toBe(
          '配置异常，请清除后重新设置'
        );
      });

      // 不选服务商直接点击保存
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      // 显示"已配置 Key 时必须保留一个服务商"提示
      expect(screen.getByTestId('personal-search-save-error').textContent).toContain(
        '已配置 Key 时必须保留一个服务商'
      );

      // sessionStorage 未被修改
      expect(sessionStorage.getItem('k-ray:personal-search:api-key')).toBe('sk-orphaned-block');
      expect(sessionStorage.getItem('k-ray:personal-search:provider')).toBeNull();

      // 仍显示"配置异常"
      expect(screen.getByTestId('personal-search-masked-status').textContent).toBe(
        '配置异常，请清除后重新设置'
      );
    });

    test('孤立 Key 边界防御全程不调用 fetch', () => {
      sessionStorage.setItem('k-ray:personal-search:api-key', 'sk-orphaned-no-fetch');

      render(<Header />);
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-settings-entry'));
      });

      // 尝试保存（被拦截）
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      // 选择服务商保存（恢复）
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-provider-select'), {
          target: { value: 'openai' },
        });
      });
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      // 选回空服务商保存（被拦截）
      act(() => {
        fireEvent.change(screen.getByTestId('personal-search-provider-select'), {
          target: { value: '' },
        });
      });
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-save-btn'));
      });

      // 清除
      act(() => {
        fireEvent.click(screen.getByTestId('personal-search-clear-btn'));
      });

      // 全程不调用 fetch
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
