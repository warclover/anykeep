/**
 * 画像功能灰度发布工具
 *
 * 基于用户 ID 的稳定哈希实现灰度发布控制
 * 支持阶段化发布、回滚和监控
 *
 * @version 2.0.0
 * @since 2025-12-28
 * @updated 2025-12-28 添加阶段管理和回滚配置
 */

import { FeatureFlags } from "./feature-flags";
import { logger } from "@/lib/logger";

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 发布阶段
 */
export type PersonaRolloutStage =
  | "disabled" // 完全禁用
  | "internal" // 内测：仅内部用户
  | "beta" // 公测：小部分用户
  | "canary" // 金丝雀：扩大测试
  | "production"; // 全量：所有用户

/**
 * 阶段配置
 */
export interface PersonaStageConfig {
  /** 流量百分比 (0-100) */
  trafficPercentage: number;
  /** 白名单用户 ID */
  whitelistUserIds: string[];
  /** 黑名单用户 ID */
  blacklistUserIds: string[];
  /** 子功能开关覆盖 */
  featureOverrides: Partial<{
    inference: boolean;
    prompts: boolean;
    intentBoost: boolean;
    settingsUI: boolean;
  }>;
}

/**
 * 回滚配置
 */
export interface PersonaRollbackConfig {
  /** 启用自动回滚 */
  autoRollbackEnabled: boolean;
  /** 错误率阈值（触发回滚） */
  errorRateThreshold: number;
  /** 推断失败率阈值 */
  inferenceFailureThreshold: number;
  /** 观察窗口（分钟） */
  observationWindowMinutes: number;
  /** 回滚目标阶段 */
  rollbackTarget: PersonaRolloutStage;
}

/**
 * 完整灰度配置
 */
export interface PersonaRolloutConfig {
  /** 当前阶段 */
  currentStage: PersonaRolloutStage;
  /** 阶段配置 */
  stageConfigs: Record<PersonaRolloutStage, PersonaStageConfig>;
  /** 回滚配置 */
  rollbackConfig: PersonaRollbackConfig;
}

// =============================================================================
// 默认配置
// =============================================================================

/**
 * 各阶段默认配置
 */
export const DEFAULT_STAGE_CONFIGS: Record<
  PersonaRolloutStage,
  PersonaStageConfig
> = {
  disabled: {
    trafficPercentage: 0,
    whitelistUserIds: [],
    blacklistUserIds: [],
    featureOverrides: {
      inference: false,
      prompts: false,
      intentBoost: false,
      settingsUI: false,
    },
  },
  internal: {
    trafficPercentage: 100, // 内测阶段白名单 100%
    whitelistUserIds: [], // 在此添加内部测试用户 ID
    blacklistUserIds: [],
    featureOverrides: {},
  },
  beta: {
    trafficPercentage: 5,
    whitelistUserIds: [],
    blacklistUserIds: [],
    featureOverrides: {
      settingsUI: false, // Beta 阶段不开放设置 UI
    },
  },
  canary: {
    trafficPercentage: 20,
    whitelistUserIds: [],
    blacklistUserIds: [],
    featureOverrides: {},
  },
  production: {
    trafficPercentage: 100,
    whitelistUserIds: [],
    blacklistUserIds: [],
    featureOverrides: {},
  },
};

/**
 * 默认回滚配置
 */
export const DEFAULT_ROLLBACK_CONFIG: PersonaRollbackConfig = {
  autoRollbackEnabled: true,
  errorRateThreshold: 0.05, // 5% 错误率
  inferenceFailureThreshold: 0.1, // 10% 推断失败率
  observationWindowMinutes: 15, // 15 分钟观察窗口
  rollbackTarget: "internal", // 回滚到内测阶段
};

/**
 * 默认灰度配置
 */
export const DEFAULT_PERSONA_ROLLOUT_CONFIG: PersonaRolloutConfig = {
  currentStage: "disabled",
  stageConfigs: DEFAULT_STAGE_CONFIGS,
  rollbackConfig: DEFAULT_ROLLBACK_CONFIG,
};

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
 * 获取当前发布阶段
 */
export function getCurrentPersonaStage(): PersonaRolloutStage {
  const envStage = process.env.PERSONA_ROLLOUT_STAGE as
    | PersonaRolloutStage
    | undefined;

  // 如果主开关关闭，始终返回 disabled
  if (!FeatureFlags.ENABLE_MULTI_PERSONA) {
    return "disabled";
  }

  // 如果环境变量指定了阶段，使用它
  if (
    envStage &&
    ["disabled", "internal", "beta", "canary", "production"].includes(envStage)
  ) {
    return envStage;
  }

  // 根据百分比推断阶段
  const percentage = FeatureFlags.PERSONA_ROLLOUT_PERCENTAGE;
  if (percentage === 0) return "disabled";
  if (percentage <= 5) return "beta";
  if (percentage <= 20) return "canary";
  return "production";
}

/**
 * 检查用户是否在画像功能灰度范围内
 *
 * 支持阶段化发布：白名单 → 百分比 → 黑名单
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
  const stage = getCurrentPersonaStage();

  // disabled 阶段：所有用户禁用
  if (stage === "disabled") {
    return false;
  }

  const stageConfig = DEFAULT_STAGE_CONFIGS[stage];

  // 检查黑名单（优先级最高）
  if (stageConfig.blacklistUserIds.includes(userId)) {
    return false;
  }

  // 检查白名单（internal 阶段仅白名单）
  if (stage === "internal") {
    return stageConfig.whitelistUserIds.includes(userId);
  }

  // 白名单用户直接通过
  if (stageConfig.whitelistUserIds.includes(userId)) {
    return true;
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

  // 获取阶段配置
  const stage = getCurrentPersonaStage();
  const stageConfig = DEFAULT_STAGE_CONFIGS[stage];

  // 检查阶段级别的功能覆盖
  const stageOverride = stageConfig.featureOverrides[feature];
  if (stageOverride !== undefined) {
    return stageOverride;
  }

  // 检查全局子功能开关
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
  stage: PersonaRolloutStage;
  percentage: number;
  features: {
    inference: boolean;
    prompts: boolean;
    intentBoost: boolean;
    settingsUI: boolean;
  };
  rollbackConfig: PersonaRollbackConfig;
} {
  return {
    enabled: FeatureFlags.ENABLE_MULTI_PERSONA,
    stage: getCurrentPersonaStage(),
    percentage: FeatureFlags.PERSONA_ROLLOUT_PERCENTAGE,
    features: {
      inference: FeatureFlags.ENABLE_PERSONA_INFERENCE,
      prompts: FeatureFlags.ENABLE_PERSONA_PROMPTS,
      intentBoost: FeatureFlags.ENABLE_PERSONA_INTENT_BOOST,
      settingsUI: FeatureFlags.ENABLE_PERSONA_SETTINGS_UI,
    },
    rollbackConfig: DEFAULT_ROLLBACK_CONFIG,
  };
}

// =============================================================================
// 回滚机制
// =============================================================================

/**
 * 回滚监控状态
 */
interface RollbackMonitorState {
  /** 观察窗口内的错误计数 */
  errorCount: number;
  /** 观察窗口内的推断失败计数 */
  inferenceFailureCount: number;
  /** 观察窗口内的总请求数 */
  totalRequests: number;
  /** 观察窗口开始时间 */
  windowStartTime: number;
  /** 上次回滚时间 */
  lastRollbackTime: number | null;
  /** 当前是否处于回滚状态 */
  isRolledBack: boolean;
}

// 内存中的回滚监控状态
let rollbackState: RollbackMonitorState = {
  errorCount: 0,
  inferenceFailureCount: 0,
  totalRequests: 0,
  windowStartTime: Date.now(),
  lastRollbackTime: null,
  isRolledBack: false,
};

/**
 * 重置观察窗口
 */
function resetObservationWindow(): void {
  rollbackState = {
    ...rollbackState,
    errorCount: 0,
    inferenceFailureCount: 0,
    totalRequests: 0,
    windowStartTime: Date.now(),
  };
}

/**
 * 检查是否需要重置观察窗口
 */
function checkWindowExpiry(): void {
  const now = Date.now();
  const windowMs = DEFAULT_ROLLBACK_CONFIG.observationWindowMinutes * 60 * 1000;

  if (now - rollbackState.windowStartTime > windowMs) {
    resetObservationWindow();
  }
}

/**
 * 记录画像请求
 *
 * 用于回滚监控
 */
export function recordPersonaRequest(): void {
  checkWindowExpiry();
  rollbackState.totalRequests++;
}

/**
 * 记录画像错误
 *
 * 用于回滚监控
 */
export function recordPersonaError(): void {
  checkWindowExpiry();
  rollbackState.errorCount++;
}

/**
 * 记录推断失败
 *
 * 用于回滚监控
 */
export function recordInferenceFailure(): void {
  checkWindowExpiry();
  rollbackState.inferenceFailureCount++;
}

/**
 * 检查是否应该触发回滚
 *
 * @returns 是否应该回滚及原因
 */
export function shouldTriggerRollback(): {
  shouldRollback: boolean;
  reason?: string;
  metrics?: {
    errorRate: number;
    inferenceFailureRate: number;
    totalRequests: number;
  };
} {
  // 如果回滚未启用，不检查
  if (!DEFAULT_ROLLBACK_CONFIG.autoRollbackEnabled) {
    return { shouldRollback: false };
  }

  // 如果已经回滚，不重复触发
  if (rollbackState.isRolledBack) {
    return { shouldRollback: false };
  }

  checkWindowExpiry();

  // 需要足够的样本量
  const minSampleSize = 10;
  if (rollbackState.totalRequests < minSampleSize) {
    return { shouldRollback: false };
  }

  const errorRate = rollbackState.errorCount / rollbackState.totalRequests;
  const inferenceFailureRate =
    rollbackState.inferenceFailureCount / rollbackState.totalRequests;

  const metrics = {
    errorRate,
    inferenceFailureRate,
    totalRequests: rollbackState.totalRequests,
  };

  // 检查错误率阈值
  if (errorRate > DEFAULT_ROLLBACK_CONFIG.errorRateThreshold) {
    return {
      shouldRollback: true,
      reason: `Error rate ${(errorRate * 100).toFixed(1)}% exceeds threshold ${(DEFAULT_ROLLBACK_CONFIG.errorRateThreshold * 100).toFixed(1)}%`,
      metrics,
    };
  }

  // 检查推断失败率阈值
  if (
    inferenceFailureRate > DEFAULT_ROLLBACK_CONFIG.inferenceFailureThreshold
  ) {
    return {
      shouldRollback: true,
      reason: `Inference failure rate ${(inferenceFailureRate * 100).toFixed(1)}% exceeds threshold ${(DEFAULT_ROLLBACK_CONFIG.inferenceFailureThreshold * 100).toFixed(1)}%`,
      metrics,
    };
  }

  return { shouldRollback: false, metrics };
}

/**
 * 执行回滚
 *
 * 注意：此函数不会真正修改环境变量，
 * 而是设置内存标记并记录日志，需要运维手动介入
 */
export function executeRollback(reason: string): void {
  rollbackState.isRolledBack = true;
  rollbackState.lastRollbackTime = Date.now();

  logger.error(
    {
      reason,
      currentStage: getCurrentPersonaStage(),
      targetStage: DEFAULT_ROLLBACK_CONFIG.rollbackTarget,
      metrics: {
        errorCount: rollbackState.errorCount,
        inferenceFailureCount: rollbackState.inferenceFailureCount,
        totalRequests: rollbackState.totalRequests,
      },
    },
    "[PersonaRollback] Auto-rollback triggered! Manual intervention required.",
  );
}

/**
 * 获取回滚监控状态
 */
export function getRollbackMonitorState(): RollbackMonitorState {
  checkWindowExpiry();
  return { ...rollbackState };
}

/**
 * 重置回滚状态（用于恢复后）
 */
export function resetRollbackState(): void {
  rollbackState = {
    errorCount: 0,
    inferenceFailureCount: 0,
    totalRequests: 0,
    windowStartTime: Date.now(),
    lastRollbackTime: null,
    isRolledBack: false,
  };

  logger.info("[PersonaRollback] Rollback state reset");
}

/**
 * 检查是否处于回滚状态
 */
export function isInRollbackState(): boolean {
  return rollbackState.isRolledBack;
}
