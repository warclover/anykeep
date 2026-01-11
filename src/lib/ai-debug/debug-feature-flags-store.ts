/**
 * AI 调试 Feature Flags 存储管理
 *
 * 职责：
 * - localStorage 存储和读取
 * - Cookie 同步（用于 API 请求）
 * - 配置版本迁移
 * - 事件广播
 *
 * @version 1.0.0
 * @since 2026-01-11
 */

import type { AIDebugConfig, AIDebugFeatureFlags } from "./types";
import { DEFAULT_AI_DEBUG_CONFIG, FASTEST_MODE_PRESET } from "./types";

// ============================================
// 常量
// ============================================

const STORAGE_KEY = "ai-debug-config";
const COOKIE_NAME = "ai-debug-config";
const CURRENT_VERSION = 1;

/** 配置变更事件名 */
export const AI_DEBUG_CONFIG_CHANGED = "ai-debug-config-changed";

// ============================================
// 存储操作
// ============================================

/**
 * 获取调试配置
 */
export function getAIDebugConfig(): AIDebugConfig {
  if (typeof window === "undefined") {
    return DEFAULT_AI_DEBUG_CONFIG;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_AI_DEBUG_CONFIG;
    }

    const parsed = JSON.parse(stored) as AIDebugConfig;

    // 版本迁移
    if (parsed.version < CURRENT_VERSION) {
      return migrateConfig(parsed);
    }

    // 合并默认值（处理新增字段）
    return {
      ...DEFAULT_AI_DEBUG_CONFIG,
      ...parsed,
      featureFlags: {
        ...DEFAULT_AI_DEBUG_CONFIG.featureFlags,
        ...parsed.featureFlags,
      },
    };
  } catch (error) {
    console.error("[AIDebugStore] Failed to parse config:", error);
    return DEFAULT_AI_DEBUG_CONFIG;
  }
}

/**
 * 保存调试配置
 */
export function setAIDebugConfig(
  updates:
    | Partial<AIDebugConfig>
    | { featureFlags: Partial<AIDebugFeatureFlags> },
): void {
  if (typeof window === "undefined") {
    return;
  }

  const current = getAIDebugConfig();

  const newConfig: AIDebugConfig = {
    ...current,
    ...updates,
    featureFlags: {
      ...current.featureFlags,
      ...(updates as { featureFlags?: Partial<AIDebugFeatureFlags> })
        .featureFlags,
    },
    updatedAt: Date.now(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    syncToCookie(newConfig);
    broadcastChange(newConfig);
  } catch (error) {
    console.error("[AIDebugStore] Failed to save config:", error);
  }
}

/**
 * 更新单个 Feature Flag
 */
export function updateFeatureFlag(
  key: keyof AIDebugFeatureFlags,
  value: boolean | null,
): void {
  const current = getAIDebugConfig();
  setAIDebugConfig({
    featureFlags: {
      ...current.featureFlags,
      [key]: value,
    },
  });
}

/**
 * 重置为默认配置
 */
export function resetAIDebugConfig(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
    clearCookie();
    broadcastChange(DEFAULT_AI_DEBUG_CONFIG);
  } catch (error) {
    console.error("[AIDebugStore] Failed to reset config:", error);
  }
}

/**
 * 应用最快模式预设
 */
export function applyFastestMode(): void {
  setAIDebugConfig({
    enabled: true,
    featureFlags: {
      ...DEFAULT_AI_DEBUG_CONFIG.featureFlags,
      ...FASTEST_MODE_PRESET,
    },
  });
}

/**
 * 启用/禁用调试模式
 */
export function setDebugEnabled(enabled: boolean): void {
  const current = getAIDebugConfig();
  setAIDebugConfig({
    ...current,
    enabled,
  });
}

/**
 * 检查调试模式是否启用
 */
export function isDebugEnabled(): boolean {
  return getAIDebugConfig().enabled;
}

// ============================================
// Cookie 同步
// ============================================

/**
 * 同步配置到 Cookie（供 API 请求使用）
 */
function syncToCookie(config: AIDebugConfig): void {
  if (typeof document === "undefined") {
    return;
  }

  // 只同步启用状态和 Feature Flags
  const cookieValue = JSON.stringify({
    enabled: config.enabled,
    ff: config.featureFlags,
  });

  // 设置 Cookie，7 天过期
  const expires = new Date();
  expires.setDate(expires.getDate() + 7);

  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(cookieValue)}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`;
}

/**
 * 清除 Cookie
 */
function clearCookie(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/**
 * 从 Cookie 解析配置（服务端使用）
 */
export function parseDebugCookieValue(
  cookieValue: string | undefined,
): { enabled: boolean; ff: Partial<AIDebugFeatureFlags> } | null {
  if (!cookieValue) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(cookieValue);
    const parsed = JSON.parse(decoded);

    if (typeof parsed.enabled !== "boolean") {
      return null;
    }

    return {
      enabled: parsed.enabled,
      ff: parsed.ff || {},
    };
  } catch {
    return null;
  }
}

// ============================================
// 配置迁移
// ============================================

/**
 * 配置版本迁移
 */
function migrateConfig(oldConfig: AIDebugConfig): AIDebugConfig {
  // 目前只有 v1，无需迁移
  return {
    ...DEFAULT_AI_DEBUG_CONFIG,
    ...oldConfig,
    version: CURRENT_VERSION,
    featureFlags: {
      ...DEFAULT_AI_DEBUG_CONFIG.featureFlags,
      ...oldConfig.featureFlags,
    },
  };
}

// ============================================
// 事件广播
// ============================================

/**
 * 广播配置变更事件
 */
function broadcastChange(config: AIDebugConfig): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(AI_DEBUG_CONFIG_CHANGED, {
      detail: config,
    }),
  );
}

// ============================================
// 导入/导出
// ============================================

/**
 * 导出配置为 JSON 字符串
 */
export function exportConfigAsJson(): string {
  const config = getAIDebugConfig();
  return JSON.stringify(config, null, 2);
}

/**
 * 从 JSON 字符串导入配置
 */
export function importConfigFromJson(json: string): boolean {
  try {
    const parsed = JSON.parse(json) as AIDebugConfig;

    // 验证必要字段
    if (typeof parsed.version !== "number" || !parsed.featureFlags) {
      throw new Error("Invalid config format");
    }

    setAIDebugConfig(parsed);
    return true;
  } catch (error) {
    console.error("[AIDebugStore] Failed to import config:", error);
    return false;
  }
}

// ============================================
// 工具函数
// ============================================

/**
 * 获取有效的 Feature Flag 值（考虑覆盖）
 *
 * @param key - Feature Flag 键
 * @param envDefault - 环境变量默认值
 * @returns 最终值
 */
export function getEffectiveValue(
  key: keyof AIDebugFeatureFlags,
  envDefault: boolean,
): boolean {
  const config = getAIDebugConfig();

  // 如果调试模式未启用，返回环境变量默认值
  if (!config.enabled) {
    return envDefault;
  }

  const override = config.featureFlags[key];

  // 如果覆盖值为 null，返回环境变量默认值
  if (override === null || override === undefined) {
    return envDefault;
  }

  return override;
}

/**
 * 获取所有非 null 的覆盖值
 */
export function getActiveOverrides(): Partial<
  Record<keyof AIDebugFeatureFlags, boolean>
> {
  const config = getAIDebugConfig();

  if (!config.enabled) {
    return {};
  }

  const overrides: Partial<Record<keyof AIDebugFeatureFlags, boolean>> = {};

  for (const [key, value] of Object.entries(config.featureFlags)) {
    if (value !== null && value !== undefined) {
      overrides[key as keyof AIDebugFeatureFlags] = value;
    }
  }

  return overrides;
}
