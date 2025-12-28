/**
 * 画像功能灰度发布工具
 *
 * 基于用户 ID 的稳定哈希实现灰度发布控制
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { FeatureFlags } from "./feature-flags";

// =============================================================================
// 灰度发布控制
// =============================================================================

/**
 * 计算用户 ID 的稳定哈希值
 *
 * 使用 djb2 算法生成 0-99 范围内的稳定哈希值
 * 相同用户 ID 始终返回相同的值，确保用户体验一致
 */
function hashUserId(userId: string): number {
  let hash = 5381;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) + hash) ^ char; // hash * 33 ^ char
  }
  return Math.abs(hash) % 100;
}

/**
 * 检查用户是否在画像功能灰度范围内
 *
 * @param userId - 用户 ID
 * @returns 是否在灰度范围内
 *
 * @example
 * ```ts
 * // 如果 PERSONA_ROLLOUT_PERCENTAGE=20
 * // 那么约 20% 的用户会返回 true
 * const canUsePersona = isUserInPersonaRollout('user-123');
 * ```
 */
export function isUserInPersonaRollout(userId: string): boolean {
  // 如果主开关关闭，直接返回 false
  if (!FeatureFlags.ENABLE_MULTI_PERSONA) {
    return false;
  }

  const percentage = FeatureFlags.PERSONA_ROLLOUT_PERCENTAGE;

  // 100% 时所有用户都启用
  if (percentage >= 100) {
    return true;
  }

  // 0% 时所有用户都禁用
  if (percentage <= 0) {
    return false;
  }

  // 基于用户 ID 哈希的稳定灰度
  const userHash = hashUserId(userId);
  return userHash < percentage;
}

/**
 * 检查画像功能是否对用户启用
 *
 * 综合考虑主开关、灰度百分比和子功能开关
 *
 * @param userId - 用户 ID
 * @param feature - 可选的子功能标识
 * @returns 功能是否启用
 */
export function isPersonaFeatureEnabled(
  userId: string,
  feature?: "inference" | "prompts" | "intentBoost" | "settingsUI",
): boolean {
  // 首先检查灰度
  if (!isUserInPersonaRollout(userId)) {
    return false;
  }

  // 如果未指定子功能，只检查灰度
  if (!feature) {
    return true;
  }

  // 检查子功能开关
  switch (feature) {
    case "inference":
      return FeatureFlags.ENABLE_PERSONA_INFERENCE;
    case "prompts":
      return FeatureFlags.ENABLE_PERSONA_PROMPTS;
    case "intentBoost":
      return FeatureFlags.ENABLE_PERSONA_INTENT_BOOST;
    case "settingsUI":
      return FeatureFlags.ENABLE_PERSONA_SETTINGS_UI;
    default:
      return true;
  }
}

/**
 * 获取当前灰度发布状态
 */
export function getPersonaRolloutStatus(): {
  enabled: boolean;
  percentage: number;
  features: {
    inference: boolean;
    prompts: boolean;
    intentBoost: boolean;
    settingsUI: boolean;
  };
} {
  return {
    enabled: FeatureFlags.ENABLE_MULTI_PERSONA,
    percentage: FeatureFlags.PERSONA_ROLLOUT_PERCENTAGE,
    features: {
      inference: FeatureFlags.ENABLE_PERSONA_INFERENCE,
      prompts: FeatureFlags.ENABLE_PERSONA_PROMPTS,
      intentBoost: FeatureFlags.ENABLE_PERSONA_INTENT_BOOST,
      settingsUI: FeatureFlags.ENABLE_PERSONA_SETTINGS_UI,
    },
  };
}
