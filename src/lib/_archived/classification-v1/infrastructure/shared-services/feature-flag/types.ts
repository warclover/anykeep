/**
 * 智能分类 v5.0 - FeatureFlag Service 类型定义
 */

/**
 * 灰度发布阶段枚举
 */
export enum RolloutStage {
  DISABLED = "disabled",
  CANARY = "canary",
  EARLY = "early",
  MAJORITY = "majority",
  FULL = "full",
}

/**
 * Feature Flag 配置
 */
export interface FeatureFlagConfig {
  /** 是否启用 v5.0 */
  enabled: boolean;
  /** 灰度发布百分比 (0-100) */
  rolloutPercentage: number;
  /** 白名单用户 ID 列表 */
  whitelist: string[];
  /** 黑名单用户 ID 列表 */
  blacklist: string[];
}

/**
 * Feature Flag 检查结果
 */
export interface FeatureFlagResult {
  /** 是否启用 v5.0 */
  enabled: boolean;
  /** 启用原因 */
  reason:
    | "disabled"
    | "blacklisted"
    | "whitelisted"
    | "rollout"
    | "not_in_rollout";
  /** 用户哈希值（用于灰度） */
  userHash?: number;
}

/**
 * Feature Flag 错误
 */
export class FeatureFlagError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "FeatureFlagError";
  }
}
