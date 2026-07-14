'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * 第十三阶段 B0：个人搜索服务设置入口
 *
 * 本阶段为未来"用户自带 API Key"预留入口，当前仍为 Mock-only。
 * 绝不接入真实 AI、搜索 API、网络请求。
 *
 * 安全边界：
 * - Key 只保存到 sessionStorage（关闭浏览器后清除）
 * - 不上传到服务器、不写入项目文件、不写入环境变量
 * - 页面只显示脱敏状态，绝不回显完整 Key
 * - 不新增"检索""调用 AI""验证 Key"等会触发网络请求的按钮
 */

// ============================================================================
// sessionStorage 工具函数
// ============================================================================

const SESSION_STORAGE_KEYS = {
  PROVIDER: 'k-ray:personal-search:provider',
  API_KEY: 'k-ray:personal-search:api-key',
} as const;

/**
 * 从 sessionStorage 读取已配置的 provider（脱敏判断用）
 */
function readStoredProvider(): string {
  if (typeof window === 'undefined') return '';
  try {
    return sessionStorage.getItem(SESSION_STORAGE_KEYS.PROVIDER) || '';
  } catch {
    return '';
  }
}

/**
 * 从 sessionStorage 读取 API Key 是否存在（不返回 Key 本身，只返回 boolean）
 */
function hasStoredApiKey(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const key = sessionStorage.getItem(SESSION_STORAGE_KEYS.API_KEY);
    return !!key && key.length > 0;
  } catch {
    return false;
  }
}

/**
 * 保存 provider 到 sessionStorage
 * 空字符串表示清除 provider（但不清除 Key，Key 清除由 clearSessionStorage 负责）
 */
function saveProviderToSessionStorage(provider: string): void {
  try {
    if (provider) {
      sessionStorage.setItem(SESSION_STORAGE_KEYS.PROVIDER, provider);
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_KEYS.PROVIDER);
    }
  } catch {
    // sessionStorage 不可用时静默失败
  }
}

/**
 * 保存 API Key 到 sessionStorage
 * 仅在传入非空 Key 时写入（替换旧 Key）；传入空字符串时不做任何操作（保留已有 Key）。
 * 清除 Key 必须通过 clearSessionStorage，避免误删。
 */
function saveApiKeyToSessionStorage(apiKey: string): void {
  if (!apiKey) return; // 空字符串不删除已有 Key
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEYS.API_KEY, apiKey);
  } catch {
    // sessionStorage 不可用时静默失败
  }
}

/**
 * 清除 sessionStorage 中的配置
 */
function clearSessionStorage(): void {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEYS.PROVIDER);
    sessionStorage.removeItem(SESSION_STORAGE_KEYS.API_KEY);
  } catch {
    // 静默失败
  }
}

// ============================================================================
// 脱敏显示辅助函数
// ============================================================================

/**
 * 生成脱敏状态文本（绝不回显完整 Key）
 *
 * isOrphaned 表示异常历史状态：sessionStorage 中有 Key 但无 provider。
 * 此状态下不显示正常的"已配置 Key"，改为提示用户清除后重新设置。
 */
function getMaskedStatus(provider: string, hasKey: boolean, isOrphaned: boolean): string {
  if (isOrphaned) return '配置异常，请清除后重新设置';
  if (!provider && !hasKey) return '未配置';
  if (provider && hasKey) return `已在当前会话中配置 Key（服务商：${provider}）`;
  if (provider) return `已选择服务商：${provider}（未填写 Key）`;
  return '已在当前会话中配置 Key';
}

// ============================================================================
// 组件 Props
// ============================================================================

interface PersonalSearchSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

// ============================================================================
// 主组件
// ============================================================================

export default function PersonalSearchSettings({ isOpen, onClose }: PersonalSearchSettingsProps) {
  // 使用惰性初始化从 sessionStorage 读取已配置状态
  // 组件由 Header 通过 key={openCounter} 重新挂载，确保每次打开时重新读取
  const [selectedProvider, setSelectedProvider] = useState<string>(() => readStoredProvider());
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [configuredProvider, setConfiguredProvider] = useState<string>(() => readStoredProvider());
  const [hasApiKey, setHasApiKey] = useState<boolean>(() => hasStoredApiKey());
  // 异常历史状态：打开弹窗时 sessionStorage 有 Key 但无 provider。
  // 此状态下不显示正常的"已配置 Key"，改为提示"配置异常，请清除后重新设置"。
  // 用户可选择服务商保存（保留原 Key）恢复正常，或点击清除配置恢复未配置状态。
  const [isOrphanedKeyState, setIsOrphanedKeyState] = useState<boolean>(() => {
    return hasStoredApiKey() && !readStoredProvider();
  });
  // 保存校验错误提示（如"请先选择服务商"）
  const [saveError, setSaveError] = useState<string>('');

  // ESC 键关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleSave = useCallback(() => {
    // 校验 1：当前会话已存在 Key，但用户将服务商选回空 → 不允许保存（防止孤立 Key）
    // 不得修改 sessionStorage 中原有的 provider 和 Key
    if (hasApiKey && !selectedProvider) {
      setSaveError('已配置 Key 时必须保留一个服务商；如需删除配置，请点击清除配置');
      return;
    }

    // 校验 2：填写了新 Key 但未选择服务商 → 不允许保存，显示提示
    if (apiKeyInput && !selectedProvider) {
      setSaveError('请先选择服务商');
      return;
    }

    setSaveError('');

    // 1. 保存 provider（空字符串会清除 provider，但仅在没有 Key 时允许）
    saveProviderToSessionStorage(selectedProvider);
    setConfiguredProvider(selectedProvider);

    // 2. 保存 Key：仅在用户输入新 Key 时写入（替换旧 Key）
    //    未输入新 Key 时保留已有 Key，不修改 sessionStorage
    if (apiKeyInput) {
      saveApiKeyToSessionStorage(apiKeyInput);
      setHasApiKey(true);
    }
    // 注意：无新 Key 输入时 hasApiKey 保持不变，sessionStorage 中的 Key 也保留

    // 3. 选择了非空服务商后保存，退出孤立状态（恢复正常配置显示）
    if (selectedProvider) {
      setIsOrphanedKeyState(false);
    }

    setApiKeyInput('');
  }, [selectedProvider, apiKeyInput, hasApiKey]);

  const handleClear = useCallback(() => {
    clearSessionStorage();
    setConfiguredProvider('');
    setHasApiKey(false);
    setSelectedProvider('');
    setApiKeyInput('');
    setSaveError('');
    setIsOrphanedKeyState(false);
  }, []);

  if (!isOpen) return null;

  const maskedStatus = getMaskedStatus(configuredProvider, hasApiKey, isOrphanedKeyState);

  return (
    <>
      {/* 遮罩层 */}
      <div
        data-testid="personal-search-settings-overlay"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          zIndex: 50,
        }}
      />

      {/* 弹窗主体 */}
      <div
        data-testid="personal-search-settings-modal"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: 480,
          maxHeight: '85vh',
          overflowY: 'auto',
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
          zIndex: 51,
          padding: 24,
        }}
      >
        {/* 头部 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#172033', margin: 0 }}>
            个人搜索服务设置
          </h2>
          <button
            data-testid="personal-search-settings-close"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              color: '#667085',
              cursor: 'pointer',
              padding: 4,
              lineHeight: 1,
            }}
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {/* Mock-only 状态提示 */}
        <div
          data-testid="personal-search-mock-only-notice"
          style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 4 }}>
            当前版本仅支持 Mock 演示候选，尚未接入真实搜索。
          </div>
          <div style={{ fontSize: 12, color: '#a16207' }}>
            填写或保存 Key 后，节点新闻候选仍显示 Mock 演示状态。真实搜索尚未在当前版本开放。
          </div>
        </div>

        {/* 当前配置状态（脱敏） */}
        <div
          data-testid="personal-search-config-status"
          style={{
            background: '#f7fafc',
            border: '1px solid #d9e2ef',
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 12, color: '#667085', marginBottom: 4 }}>当前会话配置状态</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#172033' }} data-testid="personal-search-masked-status">
            {maskedStatus}
          </div>
        </div>

        {/* 服务商选择 */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#172033', marginBottom: 6 }}>
            搜索服务商（未来可连接，本版均未启用）
          </label>
          <select
            data-testid="personal-search-provider-select"
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            style={{
              width: '100%',
              height: 40,
              padding: '0 12px',
              border: '1px solid #d9e2ef',
              borderRadius: 8,
              fontSize: 14,
              color: '#172033',
              background: '#ffffff',
              outline: 'none',
            }}
          >
            <option value="">请选择服务商</option>
            <option value="openai">OpenAI（未来可连接，本版未启用）</option>
            <option value="anthropic">Anthropic（未来可连接，本版未启用）</option>
            <option value="custom">Custom 自定义（未来可连接，本版未启用）</option>
          </select>
        </div>

        {/* API Key 输入框（密码类型） */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#172033', marginBottom: 6 }}>
            API Key
          </label>
          <input
            type="password"
            data-testid="personal-search-api-key-input"
            value={apiKeyInput}
            onChange={(e) => {
              setApiKeyInput(e.target.value);
              // 用户修改输入时清除错误提示
              if (saveError) setSaveError('');
            }}
            placeholder="输入 API Key（仅保存在当前浏览器会话中）"
            autoComplete="off"
            style={{
              width: '100%',
              height: 40,
              padding: '0 12px',
              border: '1px solid #d9e2ef',
              borderRadius: 8,
              fontSize: 14,
              color: '#172033',
              background: '#ffffff',
              outline: 'none',
            }}
          />
          {/* 保存校验错误提示 */}
          {saveError && (
            <p data-testid="personal-search-save-error" style={{ marginTop: 6, fontSize: 12, color: '#e65353', fontWeight: 600 }}>
              {saveError}
            </p>
          )}
        </div>

        {/* 安全说明 */}
        <div
          data-testid="personal-search-safety-notice"
          style={{
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 12, color: '#0369a1', lineHeight: 1.6 }}>
            Key 仅保存在当前浏览器会话中，不上传到 K-Ray 服务器，不写入项目文件；关闭浏览器后需要重新输入。
          </div>
        </div>

        {/* 按钮区 */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            data-testid="personal-search-clear-btn"
            onClick={handleClear}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: '#e65353',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            清除配置
          </button>
          <button
            data-testid="personal-search-save-btn"
            onClick={handleSave}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: '#ffffff',
              background: '#2864e6',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            保存配置
          </button>
        </div>

        {/* 页脚说明 */}
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #d9e2ef' }}>
          <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
            本阶段不提供真实搜索功能。Key 已保存，但真实搜索尚未在当前版本开放。
            节点新闻候选仍为 Mock 演示数据。
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// 导出工具函数（供测试使用）
// ============================================================================

/**
 * 检查当前会话是否已配置 API Key（只返回 boolean，不返回 Key 本身）
 */
export function isPersonalSearchConfigured(): boolean {
  return hasStoredApiKey();
}

/**
 * 获取已配置的服务商名称（脱敏，不含 Key）
 */
export function getConfiguredProvider(): string {
  return readStoredProvider();
}

/**
 * 清除当前会话的搜索服务配置
 */
export function clearPersonalSearchConfig(): void {
  clearSessionStorage();
}
