/**
 * 智能分类 v5.0 - Feature Flag 系统
 *
 * 功能：
 * 1. 百分比灰度发布（0% → 5% → 20% → 50% → 100%）
 * 2. 白名单/黑名单控制
 * 3. 用户分桶（基于 user_id hash）
 * 4. 实时开关切换
 */

import { createHash } from "crypto";

/**
 * 发布阶段
 */
export enum RolloutStage {
  DISABLED = "disabled", // 0% - 完全禁用
  CANARY = "canary", // 5% - 金丝雀测试
  EARLY = "early", // 20% - 早期采用者
  MAJORITY = "majority", // 50% - 大多数用户
  FULL = "full", // 100% - 全量发布
}

/**
 * Feature Flag 配置
 */
export interface FeatureFlagConfig {
  /** 当前发布阶段 */
  stage: RolloutStage;
  /** 发布百分比（0-100） */
  percentage: number;
  /** 白名单用户 ID */
  whitelist: string[];
  /** 黑名单用户 ID */
  blacklist: string[];
  /** 是否启用（总开关） */
  enabled: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: FeatureFlagConfig = {
  stage: RolloutStage.DISABLED,
  percentage: 0,
  whitelist: [],
  blacklist: [],
  enabled: false,
};

/**
 * 阶段对应的百分比
 */
const STAGE_PERCENTAGES: Record<RolloutStage, number> = {
  [RolloutStage.DISABLED]: 0,
  [RolloutStage.CANARY]: 5,
  [RolloutStage.EARLY]: 20,
  [RolloutStage.MAJORITY]: 50,
  [RolloutStage.FULL]: 100,
};

/**
 * Feature Flag 服务
 */
export class FeatureFlagService {
  private config: FeatureFlagConfig;

  constructor(config?: Partial<FeatureFlagConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      // 深拷贝数组，避免共享引用导致的状态污染
      whitelist: [...(config?.whitelist ?? DEFAULT_CONFIG.whitelist)],
      blacklist: [...(config?.blacklist ?? DEFAULT_CONFIG.blacklist)],
    };
  }

  /**
   * 检查用户是否启用 v5 分类
   */
  isEnabledForUser(userId: string): boolean {
    // 1. 检查总开关
    if (!this.config.enabled) {
      return false;
    }

    // 2. 检查黑名单
    if (this.config.blacklist.includes(userId)) {
      return false;
    }

    // 3. 检查白名单
    if (this.config.whitelist.includes(userId)) {
      return true;
    }

    // 4. 检查百分比分桶
    const userBucket = this.getUserBucket(userId);
    return userBucket < this.config.percentage;
  }

  /**
   * 获取用户分桶（0-99）
   *
   * 使用 user_id 的 hash 值确保：
   * - 同一用户始终在同一桶
   * - 用户均匀分布在 100 个桶中
   */
  private getUserBucket(userId: string): number {
    const hash = createHash("md5").update(userId).digest("hex");
    const hashInt = parseInt(hash.substring(0, 8), 16);
    return hashInt % 100;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<FeatureFlagConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * 设置发布阶段
   */
  setStage(stage: RolloutStage): void {
    this.config.stage = stage;
    this.config.percentage = STAGE_PERCENTAGES[stage];
  }

  /**
   * 添加白名单用户
   */
  addToWhitelist(userId: string): void {
    if (!this.config.whitelist.includes(userId)) {
      this.config.whitelist.push(userId);
    }
  }

  /**
   * 移除白名单用户
   */
  removeFromWhitelist(userId: string): void {
    this.config.whitelist = this.config.whitelist.filter((id) => id !== userId);
  }

  /**
   * 添加黑名单用户
   */
  addToBlacklist(userId: string): void {
    if (!this.config.blacklist.includes(userId)) {
      this.config.blacklist.push(userId);
    }
  }

  /**
   * 移除黑名单用户
   */
  removeFromBlacklist(userId: string): void {
    this.config.blacklist = this.config.blacklist.filter((id) => id !== userId);
  }

  /**
   * 获取当前配置
   */
  getConfig(): FeatureFlagConfig {
    return {
      ...this.config,
      whitelist: [...this.config.whitelist],
      blacklist: [...this.config.blacklist],
    };
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    stage: RolloutStage;
    percentage: number;
    whitelistCount: number;
    blacklistCount: number;
    enabled: boolean;
  } {
    return {
      stage: this.config.stage,
      percentage: this.config.percentage,
      whitelistCount: this.config.whitelist.length,
      blacklistCount: this.config.blacklist.length,
      enabled: this.config.enabled,
    };
  }
}

/**
 * 全局单例（从环境变量或数据库加载）
 */
let globalFeatureFlag: FeatureFlagService | null = null;

/**
 * 获取全局 Feature Flag 实例
 */
export function getFeatureFlag(): FeatureFlagService {
  if (!globalFeatureFlag) {
    // 从环境变量加载配置
    const stage =
      (process.env.CLASSIFICATION_V5_STAGE as RolloutStage) ||
      RolloutStage.DISABLED;
    const enabled = process.env.CLASSIFICATION_V5_ENABLED === "true";

    globalFeatureFlag = new FeatureFlagService({
      stage,
      percentage: STAGE_PERCENTAGES[stage],
      enabled,
      whitelist: [],
      blacklist: [],
    });
  }

  return globalFeatureFlag;
}

/**
 * 重置全局实例（用于测试）
 */
export function resetFeatureFlag(): void {
  globalFeatureFlag = null;
}
