/**
 * Classification Configuration Service
 * 集中管理分类模块的所有配置项
 *
 * @version 1.0.0
 * @since 2026-01-27
 *
 * 解决问题：
 * - 环境变量分散在多处使用 process.env
 * - 缺乏类型安全和默认值管理
 * - 难以进行配置变更追踪
 */

import { logger } from "@/lib/logger";

/**
 * 分类系统版本
 */
export type ClassificationVersion = "v4.1" | "v5.0";

/**
 * V5 灰度发布阶段
 */
export type RolloutStage =
  | "disabled"
  | "canary"
  | "early"
  | "majority"
  | "full";

/**
 * 分类配置接口
 */
export interface ClassificationConfig {
  /** 分类系统版本 */
  version: ClassificationVersion;
  /** V5 是否启用 */
  v5Enabled: boolean;
  /** V5 灰度发布阶段 */
  v5RolloutStage: RolloutStage;
  /** V5 透传模式（不进行置信度重映射） */
  v5PassthroughMode: boolean;
  /** V2 分类系统是否启用 */
  v2Enabled: boolean;
  /** 自动分类置信度阈值 */
  autoClassifyThreshold: number;
  /** 建议分类置信度阈值 */
  suggestThreshold: number;
}

/**
 * 灰度阶段对应的发布百分比
 */
const STAGE_PERCENTAGES: Record<RolloutStage, number> = {
  disabled: 0,
  canary: 5,
  early: 20,
  majority: 50,
  full: 100,
};

/**
 * 默认配置
 */
const DEFAULT_CONFIG: ClassificationConfig = {
  version: "v5.0",
  v5Enabled: true,
  v5RolloutStage: "full",
  v5PassthroughMode: true,
  v2Enabled: true,
  autoClassifyThreshold: 80,
  suggestThreshold: 60,
};

/**
 * 分类配置服务（单例）
 */
class ClassificationConfigService {
  private config: ClassificationConfig;
  private initialized = false;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * 初始化配置（从环境变量加载）
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.config = {
      version: this.parseVersion(),
      v5Enabled: this.parseV5Enabled(),
      v5RolloutStage: this.parseRolloutStage(),
      v5PassthroughMode: this.parsePassthroughMode(),
      v2Enabled: this.parseV2Enabled(),
      autoClassifyThreshold: this.parseThreshold(
        "AUTO_CLASSIFY_THRESHOLD",
        DEFAULT_CONFIG.autoClassifyThreshold,
      ),
      suggestThreshold: this.parseThreshold(
        "SUGGEST_THRESHOLD",
        DEFAULT_CONFIG.suggestThreshold,
      ),
    };

    this.initialized = true;

    logger.info(
      { config: this.getSafeConfigForLogging() },
      "Classification config initialized",
    );
  }

  /**
   * 获取当前配置
   */
  getConfig(): Readonly<ClassificationConfig> {
    if (!this.initialized) {
      this.initialize();
    }
    return Object.freeze({ ...this.config });
  }

  /**
   * 获取分类版本
   */
  get version(): ClassificationVersion {
    return this.getConfig().version;
  }

  /**
   * V5 是否启用
   */
  get v5Enabled(): boolean {
    return this.getConfig().v5Enabled;
  }

  /**
   * V5 灰度发布阶段
   */
  get v5RolloutStage(): RolloutStage {
    return this.getConfig().v5RolloutStage;
  }

  /**
   * V5 灰度发布百分比
   */
  get v5RolloutPercentage(): number {
    return STAGE_PERCENTAGES[this.v5RolloutStage];
  }

  /**
   * V5 透传模式
   */
  get v5PassthroughMode(): boolean {
    return this.getConfig().v5PassthroughMode;
  }

  /**
   * V2 是否启用
   */
  get v2Enabled(): boolean {
    return this.getConfig().v2Enabled;
  }

  /**
   * 自动分类阈值
   */
  get autoClassifyThreshold(): number {
    return this.getConfig().autoClassifyThreshold;
  }

  /**
   * 建议分类阈值
   */
  get suggestThreshold(): number {
    return this.getConfig().suggestThreshold;
  }

  /**
   * 检查用户是否在 V5 灰度范围内
   */
  isUserInV5Rollout(userId: string): boolean {
    if (!this.v5Enabled) {
      return false;
    }

    const percentage = this.v5RolloutPercentage;
    if (percentage >= 100) {
      return true;
    }
    if (percentage <= 0) {
      return false;
    }

    // 基于 userId 的哈希值决定是否在灰度范围内
    const hash = this.hashUserId(userId);
    return hash < percentage;
  }

  /**
   * 重置配置（用于测试）
   */
  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.initialized = false;
  }

  /**
   * 覆盖配置（用于测试）
   */
  override(overrides: Partial<ClassificationConfig>): void {
    this.config = { ...this.config, ...overrides };
    this.initialized = true;
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  private parseVersion(): ClassificationVersion {
    const version = process.env.CLASSIFICATION_VERSION;
    if (version === "v4.1") {
      return "v4.1";
    }
    if (version === "v3") {
      logger.warn(
        { requestedVersion: "v3" },
        "Classification V3 is deprecated. Falling back to V5.0",
      );
    }
    return "v5.0";
  }

  private parseV5Enabled(): boolean {
    // 只有显式设置为 false 才禁用
    return process.env.CLASSIFICATION_V5_ENABLED !== "false";
  }

  private parseRolloutStage(): RolloutStage {
    const stage = (process.env.CLASSIFICATION_V5_STAGE || "full").toLowerCase();
    const validStages: RolloutStage[] = [
      "disabled",
      "canary",
      "early",
      "majority",
      "full",
    ];
    if (validStages.includes(stage as RolloutStage)) {
      return stage as RolloutStage;
    }
    return "full";
  }

  private parsePassthroughMode(): boolean {
    return process.env.V5_PASSTHROUGH_MODE !== "false";
  }

  private parseV2Enabled(): boolean {
    return process.env.CLASSIFICATION_V2_ENABLED !== "false";
  }

  private parseThreshold(envKey: string, defaultValue: number): number {
    const value = process.env[envKey];
    if (value) {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
        return parsed;
      }
    }
    return defaultValue;
  }

  private hashUserId(userId: string): number {
    // 简单的哈希算法，将 userId 映射到 0-99
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100;
  }

  private getSafeConfigForLogging(): Record<string, unknown> {
    return {
      version: this.config.version,
      v5Enabled: this.config.v5Enabled,
      v5RolloutStage: this.config.v5RolloutStage,
      v5PassthroughMode: this.config.v5PassthroughMode,
      v2Enabled: this.config.v2Enabled,
      autoClassifyThreshold: this.config.autoClassifyThreshold,
      suggestThreshold: this.config.suggestThreshold,
    };
  }
}

/**
 * 导出单例实例
 */
export const classificationConfig = new ClassificationConfigService();

/**
 * 便捷函数：获取分类版本
 * @deprecated 请使用 classificationConfig.version
 */
export function getClassificationVersion(): ClassificationVersion {
  return classificationConfig.version;
}

/**
 * 便捷函数：检查是否使用 V2 分类
 * @deprecated 请使用 classificationConfig.v2Enabled
 */
export function shouldUseV2Classification(): boolean {
  return classificationConfig.v2Enabled;
}
