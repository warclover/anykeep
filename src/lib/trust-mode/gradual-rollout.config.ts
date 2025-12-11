/**
 * Trust Mode Gradual Rollout Configuration
 * V4.2 托管模式灰度发布配置
 *
 * @description 控制托管模式功能的渐进式发布
 * - 用户分群
 * - 流量控制
 * - 功能开关
 * - 回滚配置
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 发布阶段
 */
export type RolloutStage =
  | "internal"     // 内测：仅内部用户
  | "beta"         // 公测：小部分用户
  | "canary"       // 金丝雀：扩大测试
  | "production";  // 全量：所有用户

/**
 * 功能标志
 */
export interface FeatureFlags {
  /** 启用托管模式选择 */
  enableTrustModeSelection: boolean;
  /** 启用待确认消息 */
  enablePendingConfirmations: boolean;
  /** 启用智能提示 */
  enableSmartPrompts: boolean;
  /** 启用批量操作 */
  enableBatchOperations: boolean;
  /** 启用偏好学习 */
  enablePreferenceLearning: boolean;
  /** 启用分类理由展示 */
  enableClassificationReason: boolean;
  /** 启用模式切换引导 */
  enableModeGuide: boolean;
  /** 启用统计面板 */
  enableStatsPanel: boolean;
}

/**
 * 灰度规则
 */
export interface RolloutRule {
  /** 规则 ID */
  id: string;
  /** 规则名称 */
  name: string;
  /** 规则描述 */
  description: string;
  /** 是否启用 */
  enabled: boolean;
  /** 匹配条件 */
  conditions: RolloutCondition[];
  /** 应用的功能标志 */
  featureFlags: Partial<FeatureFlags>;
}

/**
 * 匹配条件
 */
export interface RolloutCondition {
  /** 条件类型 */
  type: "user_id" | "user_percentage" | "registration_date" | "bookmark_count" | "user_tag";
  /** 操作符 */
  operator: "in" | "not_in" | "equals" | "gt" | "lt" | "gte" | "lte" | "between";
  /** 条件值 */
  value: string | number | string[] | number[] | [number, number];
}

/**
 * 灰度配置
 */
export interface RolloutConfig {
  /** 当前阶段 */
  currentStage: RolloutStage;
  /** 全局功能开关 */
  globalFlags: FeatureFlags;
  /** 阶段特定配置 */
  stageConfigs: Record<RolloutStage, StageConfig>;
  /** 自定义规则 */
  customRules: RolloutRule[];
  /** 回滚配置 */
  rollbackConfig: RollbackConfig;
}

/**
 * 阶段配置
 */
export interface StageConfig {
  /** 流量百分比 (0-100) */
  trafficPercentage: number;
  /** 功能标志覆盖 */
  featureFlagsOverride?: Partial<FeatureFlags>;
  /** 白名单用户 */
  whitelistUserIds?: string[];
  /** 黑名单用户 */
  blacklistUserIds?: string[];
}

/**
 * 回滚配置
 */
export interface RollbackConfig {
  /** 启用自动回滚 */
  autoRollbackEnabled: boolean;
  /** 错误率阈值（触发回滚） */
  errorRateThreshold: number;
  /** 延迟阈值（P99，毫秒） */
  latencyThresholdMs: number;
  /** 观察窗口（分钟） */
  observationWindowMinutes: number;
  /** 回滚目标阶段 */
  rollbackTarget: RolloutStage;
}

// ============================================================================
// 默认配置
// ============================================================================

/**
 * 默认功能标志
 */
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  enableTrustModeSelection: true,
  enablePendingConfirmations: true,
  enableSmartPrompts: true,
  enableBatchOperations: true,
  enablePreferenceLearning: true,
  enableClassificationReason: true,
  enableModeGuide: true,
  enableStatsPanel: true,
};

/**
 * 各阶段默认配置
 */
export const DEFAULT_STAGE_CONFIGS: Record<RolloutStage, StageConfig> = {
  internal: {
    trafficPercentage: 100,
    featureFlagsOverride: {
      // 内测阶段启用所有功能
    },
    whitelistUserIds: [
      // 添加内部测试用户 ID
    ],
  },
  beta: {
    trafficPercentage: 5,
    featureFlagsOverride: {
      // Beta 阶段可能禁用部分实验性功能
      enableSmartPrompts: false,
    },
  },
  canary: {
    trafficPercentage: 20,
    featureFlagsOverride: {
      // Canary 阶段启用更多功能
    },
  },
  production: {
    trafficPercentage: 100,
    featureFlagsOverride: {
      // 全量阶段使用默认配置
    },
  },
};

/**
 * 默认回滚配置
 */
export const DEFAULT_ROLLBACK_CONFIG: RollbackConfig = {
  autoRollbackEnabled: true,
  errorRateThreshold: 0.05,       // 5% 错误率
  latencyThresholdMs: 5000,       // P99 5秒
  observationWindowMinutes: 15,   // 15分钟观察窗口
  rollbackTarget: "internal",     // 回滚到内测阶段
};

/**
 * 默认灰度配置
 */
export const DEFAULT_ROLLOUT_CONFIG: RolloutConfig = {
  currentStage: "internal",
  globalFlags: DEFAULT_FEATURE_FLAGS,
  stageConfigs: DEFAULT_STAGE_CONFIGS,
  customRules: [],
  rollbackConfig: DEFAULT_ROLLBACK_CONFIG,
};

// ============================================================================
// 运行时配置（从环境变量读取）
// ============================================================================

/**
 * 获取当前灰度配置
 */
export function getCurrentRolloutConfig(): RolloutConfig {
  const stage = (process.env.TRUST_MODE_ROLLOUT_STAGE as RolloutStage) || "internal";

  return {
    ...DEFAULT_ROLLOUT_CONFIG,
    currentStage: stage,
  };
}

/**
 * 获取当前阶段配置
 */
export function getCurrentStageConfig(): StageConfig {
  const config = getCurrentRolloutConfig();
  return config.stageConfigs[config.currentStage];
}

// ============================================================================
// 用户资格检查
// ============================================================================

/**
 * 用户上下文
 */
export interface UserContext {
  userId: string;
  registrationDate?: Date;
  bookmarkCount?: number;
  tags?: string[];
}

/**
 * 检查用户是否符合灰度发布条件
 */
export function isUserEligibleForRollout(
  userContext: UserContext,
  config: RolloutConfig = getCurrentRolloutConfig()
): boolean {
  const stageConfig = config.stageConfigs[config.currentStage];

  // 检查黑名单
  if (stageConfig.blacklistUserIds?.includes(userContext.userId)) {
    return false;
  }

  // 检查白名单（如果有白名单，只允许白名单用户）
  if (stageConfig.whitelistUserIds && stageConfig.whitelistUserIds.length > 0) {
    return stageConfig.whitelistUserIds.includes(userContext.userId);
  }

  // 检查流量百分比
  if (stageConfig.trafficPercentage < 100) {
    const hash = simpleHash(userContext.userId);
    const bucket = hash % 100;
    if (bucket >= stageConfig.trafficPercentage) {
      return false;
    }
  }

  // 检查自定义规则
  for (const rule of config.customRules) {
    if (!rule.enabled) continue;

    const matches = evaluateConditions(rule.conditions, userContext);
    if (!matches) {
      return false;
    }
  }

  return true;
}

/**
 * 获取用户的功能标志
 */
export function getUserFeatureFlags(
  userContext: UserContext,
  config: RolloutConfig = getCurrentRolloutConfig()
): FeatureFlags {
  // 如果用户不符合灰度条件，返回全部禁用
  if (!isUserEligibleForRollout(userContext, config)) {
    return {
      enableTrustModeSelection: false,
      enablePendingConfirmations: false,
      enableSmartPrompts: false,
      enableBatchOperations: false,
      enablePreferenceLearning: false,
      enableClassificationReason: false,
      enableModeGuide: false,
      enableStatsPanel: false,
    };
  }

  // 合并全局标志和阶段覆盖
  const stageConfig = config.stageConfigs[config.currentStage];
  const flags = {
    ...config.globalFlags,
    ...(stageConfig.featureFlagsOverride || {}),
  };

  // 应用自定义规则覆盖
  for (const rule of config.customRules) {
    if (!rule.enabled) continue;

    const matches = evaluateConditions(rule.conditions, userContext);
    if (matches) {
      Object.assign(flags, rule.featureFlags);
    }
  }

  return flags;
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 评估条件列表（AND 逻辑）
 */
function evaluateConditions(
  conditions: RolloutCondition[],
  userContext: UserContext
): boolean {
  return conditions.every((condition) => evaluateCondition(condition, userContext));
}

/**
 * 评估单个条件
 */
function evaluateCondition(
  condition: RolloutCondition,
  userContext: UserContext
): boolean {
  switch (condition.type) {
    case "user_id":
      return evaluateOperator(
        condition.operator,
        userContext.userId,
        condition.value
      );

    case "user_percentage": {
      const hash = simpleHash(userContext.userId);
      const bucket = hash % 100;
      return evaluateOperator(condition.operator, bucket, condition.value);
    }

    case "registration_date":
      if (!userContext.registrationDate) return true;
      return evaluateOperator(
        condition.operator,
        userContext.registrationDate.getTime(),
        condition.value
      );

    case "bookmark_count":
      if (userContext.bookmarkCount === undefined) return true;
      return evaluateOperator(
        condition.operator,
        userContext.bookmarkCount,
        condition.value
      );

    case "user_tag":
      if (!userContext.tags) return true;
      if (condition.operator === "in") {
        const tags = Array.isArray(condition.value) ? condition.value : [condition.value];
        return userContext.tags.some((tag) => tags.includes(tag));
      }
      return true;

    default:
      return true;
  }
}

/**
 * 评估操作符
 */
function evaluateOperator(
  operator: RolloutCondition["operator"],
  actual: string | number,
  expected: RolloutCondition["value"]
): boolean {
  switch (operator) {
    case "equals":
      return actual === expected;

    case "in":
      return Array.isArray(expected) && expected.includes(actual as never);

    case "not_in":
      return Array.isArray(expected) && !expected.includes(actual as never);

    case "gt":
      return typeof actual === "number" &&
        typeof expected === "number" &&
        actual > expected;

    case "lt":
      return typeof actual === "number" &&
        typeof expected === "number" &&
        actual < expected;

    case "gte":
      return typeof actual === "number" &&
        typeof expected === "number" &&
        actual >= expected;

    case "lte":
      return typeof actual === "number" &&
        typeof expected === "number" &&
        actual <= expected;

    case "between":
      return typeof actual === "number" &&
        Array.isArray(expected) &&
        expected.length === 2 &&
        typeof expected[0] === "number" &&
        typeof expected[1] === "number" &&
        actual >= expected[0] &&
        actual <= expected[1];

    default:
      return true;
  }
}

/**
 * 简单哈希函数
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// ============================================================================
// 导出
// ============================================================================

export {
  simpleHash,
  evaluateConditions,
  evaluateCondition,
  evaluateOperator,
};
