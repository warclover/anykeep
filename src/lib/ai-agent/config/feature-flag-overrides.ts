/**
 * Feature Flag 运行时覆盖支持
 *
 * 职责：
 * - 解析调试 Cookie 中的覆盖配置
 * - 提供带覆盖的 Feature Flag 读取函数
 * - 与现有 FeatureFlags 系统兼容
 *
 * @version 1.0.0
 * @since 2026-01-11
 */

import { FeatureFlags } from "./feature-flags";
import type { AIDebugFeatureFlags } from "@/lib/ai-debug/types";

// ============================================
// 类型定义
// ============================================

/**
 * 调试覆盖配置（从 Cookie 解析）
 */
export interface DebugOverrideConfig {
  /** 是否启用覆盖 */
  enabled: boolean;
  /** Feature Flag 覆盖值 */
  featureFlags: Partial<AIDebugFeatureFlags>;
}

/**
 * Feature Flag 键到环境变量映射
 */
const FLAG_KEY_MAPPING: Record<
  keyof AIDebugFeatureFlags,
  keyof typeof FeatureFlags | null
> = {
  ENABLE_HYBRID_INTENT_CLASSIFIER: "ENABLE_HYBRID_INTENT_CLASSIFIER",
  ENABLE_QUERY_REWRITE: "ENABLE_QUERY_REWRITE",
  ENABLE_RERANK: "ENABLE_RERANK",
  ENABLE_SYSTEM_REMINDER: "ENABLE_SYSTEM_REMINDER",
  ENABLE_MEMORY_PROMPT: "ENABLE_MEMORY_PROMPT",
  ENABLE_WORKFLOW_CONVERSATION_TRIGGER: "ENABLE_WORKFLOW_CONVERSATION_TRIGGER",
  ENABLE_RAG_MONITORING: "ENABLE_RAG_MONITORING",
  ENABLE_CITATION_TRACKING: "ENABLE_CITATION_TRACKING",
  INCLUDE_ROUTING_INFO: null, // 特殊处理，不是 FeatureFlags 的一部分
  DEBUG_MODE: null, // 特殊处理
};

// ============================================
// Cookie 解析
// ============================================

const COOKIE_NAME = "ai-debug-config";

/**
 * 从请求中解析调试覆盖配置
 *
 * @param request - Next.js 请求对象
 * @returns 覆盖配置，如果无效则返回 null
 */
export function parseDebugOverrides(
  request: Request,
): DebugOverrideConfig | null {
  try {
    const cookieHeader = request.headers.get("cookie");
    if (!cookieHeader) {
      return null;
    }

    // 解析 Cookie
    const cookies = parseCookies(cookieHeader);
    const configValue = cookies[COOKIE_NAME];

    if (!configValue) {
      return null;
    }

    // 解码并解析 JSON
    const decoded = decodeURIComponent(configValue);
    const parsed = JSON.parse(decoded);

    // 验证结构
    if (typeof parsed.enabled !== "boolean") {
      return null;
    }

    return {
      enabled: parsed.enabled,
      featureFlags: parsed.ff || {},
    };
  } catch {
    // 解析失败，返回 null
    return null;
  }
}

/**
 * 简单的 Cookie 解析
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split("=");
    if (name) {
      cookies[name] = rest.join("=");
    }
  });

  return cookies;
}

// ============================================
// Feature Flag 读取（带覆盖）
// ============================================

/**
 * 获取 Feature Flag 值（考虑覆盖）
 *
 * 优先级：覆盖配置 > 环境变量
 *
 * @param flagKey - Feature Flag 键
 * @param overrides - 覆盖配置
 * @returns Feature Flag 值
 */
export function getFeatureFlagWithOverride(
  flagKey: keyof AIDebugFeatureFlags,
  overrides: DebugOverrideConfig | null,
): boolean {
  // 获取环境变量默认值
  const envKey = FLAG_KEY_MAPPING[flagKey];
  const envDefault = envKey ? (FeatureFlags[envKey] as boolean) : false;

  // 如果没有覆盖配置或未启用，返回环境变量值
  if (!overrides || !overrides.enabled) {
    return envDefault;
  }

  // 检查覆盖值
  const overrideValue = overrides.featureFlags[flagKey];

  // 如果覆盖值为 null 或 undefined，返回环境变量值
  if (overrideValue === null || overrideValue === undefined) {
    return envDefault;
  }

  return overrideValue;
}

/**
 * 批量获取 Feature Flags（考虑覆盖）
 *
 * @param overrides - 覆盖配置
 * @returns 所有 Feature Flag 的当前值
 */
export function getAllFeatureFlagsWithOverrides(
  overrides: DebugOverrideConfig | null,
): Record<keyof AIDebugFeatureFlags, boolean> {
  return {
    ENABLE_HYBRID_INTENT_CLASSIFIER: getFeatureFlagWithOverride(
      "ENABLE_HYBRID_INTENT_CLASSIFIER",
      overrides,
    ),
    ENABLE_QUERY_REWRITE: getFeatureFlagWithOverride(
      "ENABLE_QUERY_REWRITE",
      overrides,
    ),
    ENABLE_RERANK: getFeatureFlagWithOverride("ENABLE_RERANK", overrides),
    ENABLE_SYSTEM_REMINDER: getFeatureFlagWithOverride(
      "ENABLE_SYSTEM_REMINDER",
      overrides,
    ),
    ENABLE_MEMORY_PROMPT: getFeatureFlagWithOverride(
      "ENABLE_MEMORY_PROMPT",
      overrides,
    ),
    ENABLE_WORKFLOW_CONVERSATION_TRIGGER: getFeatureFlagWithOverride(
      "ENABLE_WORKFLOW_CONVERSATION_TRIGGER",
      overrides,
    ),
    ENABLE_RAG_MONITORING: getFeatureFlagWithOverride(
      "ENABLE_RAG_MONITORING",
      overrides,
    ),
    ENABLE_CITATION_TRACKING: getFeatureFlagWithOverride(
      "ENABLE_CITATION_TRACKING",
      overrides,
    ),
    INCLUDE_ROUTING_INFO: getFeatureFlagWithOverride(
      "INCLUDE_ROUTING_INFO",
      overrides,
    ),
    DEBUG_MODE: getFeatureFlagWithOverride("DEBUG_MODE", overrides),
  };
}

/**
 * 检查是否有任何覆盖生效
 *
 * @param overrides - 覆盖配置
 * @returns 是否有覆盖生效
 */
export function hasActiveOverrides(
  overrides: DebugOverrideConfig | null,
): boolean {
  if (!overrides || !overrides.enabled) {
    return false;
  }

  return Object.values(overrides.featureFlags).some(
    (v) => v !== null && v !== undefined,
  );
}

/**
 * 获取覆盖摘要（用于日志）
 *
 * @param overrides - 覆盖配置
 * @returns 摘要字符串
 */
export function getOverridesSummary(
  overrides: DebugOverrideConfig | null,
): string {
  if (!overrides || !overrides.enabled) {
    return "no overrides";
  }

  const active = Object.entries(overrides.featureFlags)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");

  return active || "no overrides";
}

// ============================================
// 常用 Feature Flag 快捷检查函数
// ============================================

/**
 * 检查工作流对话触发是否启用（考虑覆盖）
 */
export function isWorkflowTriggerEnabled(
  overrides: DebugOverrideConfig | null,
): boolean {
  return getFeatureFlagWithOverride(
    "ENABLE_WORKFLOW_CONVERSATION_TRIGGER",
    overrides,
  );
}

/**
 * 检查混合意图分类器是否启用（考虑覆盖）
 */
export function isHybridClassifierEnabled(
  overrides: DebugOverrideConfig | null,
): boolean {
  return getFeatureFlagWithOverride(
    "ENABLE_HYBRID_INTENT_CLASSIFIER",
    overrides,
  );
}

/**
 * 检查 LLM 查询改写是否启用（考虑覆盖）
 */
export function isQueryRewriteEnabled(
  overrides: DebugOverrideConfig | null,
): boolean {
  return getFeatureFlagWithOverride("ENABLE_QUERY_REWRITE", overrides);
}

/**
 * 检查 Rerank 是否启用（考虑覆盖）
 */
export function isRerankEnabled(
  overrides: DebugOverrideConfig | null,
): boolean {
  return getFeatureFlagWithOverride("ENABLE_RERANK", overrides);
}

/**
 * 检查 System-Reminder 是否启用（考虑覆盖）
 */
export function isSystemReminderEnabled(
  overrides: DebugOverrideConfig | null,
): boolean {
  return getFeatureFlagWithOverride("ENABLE_SYSTEM_REMINDER", overrides);
}

/**
 * 检查情景记忆 Prompt 是否启用（考虑覆盖）
 */
export function isMemoryPromptEnabled(
  overrides: DebugOverrideConfig | null,
): boolean {
  return getFeatureFlagWithOverride("ENABLE_MEMORY_PROMPT", overrides);
}

/**
 * 检查 RAG 监控是否启用（考虑覆盖）
 */
export function isRagMonitoringEnabled(
  overrides: DebugOverrideConfig | null,
): boolean {
  return getFeatureFlagWithOverride("ENABLE_RAG_MONITORING", overrides);
}

/**
 * 检查引用追踪是否启用（考虑覆盖）
 */
export function isCitationTrackingEnabled(
  overrides: DebugOverrideConfig | null,
): boolean {
  return getFeatureFlagWithOverride("ENABLE_CITATION_TRACKING", overrides);
}

/**
 * 检查路由信息是否应该包含（考虑覆盖）
 */
export function shouldIncludeRoutingInfo(
  overrides: DebugOverrideConfig | null,
): boolean {
  return getFeatureFlagWithOverride("INCLUDE_ROUTING_INFO", overrides);
}

/**
 * 检查调试模式是否启用（考虑覆盖）
 */
export function isDebugModeEnabled(
  overrides: DebugOverrideConfig | null,
): boolean {
  return getFeatureFlagWithOverride("DEBUG_MODE", overrides);
}
