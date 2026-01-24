/**
 * Classification Strategy Resolver
 * 策略解析器 - 根据用户和配置选择分类策略
 *
 * @version 1.1.0
 * @since 2026-01-24 Phase 2
 * @updated 2026-01-24 Phase 4.5: 集成增强容器
 */

import { createHash } from "crypto";
import { logger } from "@/lib/logger";
import type {
  IClassificationStrategy,
  IStrategyResolver,
  ClassificationFeatureFlags,
} from "./core";
import { DEFAULT_FEATURE_FLAGS } from "./core";
import type { EnhancedContainer } from "./infrastructure/container";
import { SERVICE_TYPES } from "./infrastructure/container";

/**
 * 策略解析器配置
 */
export interface StrategyResolverConfig {
  featureFlags?: Partial<ClassificationFeatureFlags>;
  /** 增强容器实例（用于获取策略） */
  container?: EnhancedContainer;
}

/**
 * 策略解析器
 *
 * 职责：
 * 1. 根据环境变量选择策略
 * 2. 根据灰度配置选择策略
 * 3. 支持白名单/黑名单用户
 * 4. 从容器获取策略实例（Phase 4.5）
 */
export class StrategyResolver implements IStrategyResolver {
  private config: ClassificationFeatureFlags;
  private container: EnhancedContainer | null = null;
  private classicStrategy: IClassificationStrategy | null = null;
  private modernStrategy: IClassificationStrategy | null = null;

  constructor(config?: StrategyResolverConfig) {
    this.config = {
      ...DEFAULT_FEATURE_FLAGS,
      ...config?.featureFlags,
    };
    this.container = config?.container ?? null;
  }

  /**
   * 设置容器实例
   * Phase 4.5: 允许延迟注入容器
   */
  setContainer(container: EnhancedContainer): void {
    this.container = container;
    // 清除缓存的策略，下次获取时会从容器重新创建
    this.classicStrategy = null;
    this.modernStrategy = null;
  }

  /**
   * 根据用户 ID 解析策略
   */
  async resolve(userId: string): Promise<IClassificationStrategy> {
    // 1. 检查环境变量强制指定
    const envVersion = process.env.CLASSIFICATION_VERSION;
    if (envVersion === "v4.1") {
      logger.debug({ userId, reason: "env_v4.1" }, "Using Classic strategy");
      return this.getClassicStrategy();
    }

    // 2. 检查黑名单
    if (this.config.userBlacklist.includes(userId)) {
      logger.debug({ userId, reason: "blacklist" }, "Using Classic strategy");
      return this.getClassicStrategy();
    }

    // 3. 检查白名单
    if (this.config.userWhitelist.includes(userId)) {
      logger.debug({ userId, reason: "whitelist" }, "Using Modern strategy");
      return this.getModernStrategy();
    }

    // 4. 检查灰度发布
    if (!this.isEnabledForUser(userId)) {
      logger.debug({ userId, reason: "rollout" }, "Using Classic strategy");
      return this.getClassicStrategy();
    }

    // 5. 默认使用配置的策略
    if (this.config.defaultStrategy === "classic") {
      return this.getClassicStrategy();
    }

    return this.getModernStrategy();
  }

  /**
   * 检查灰度是否对用户启用
   */
  private isEnabledForUser(userId: string): boolean {
    const bucket = this.getUserBucket(userId);
    return bucket < this.config.rolloutStage;
  }

  /**
   * 计算用户分桶 (0-99)
   */
  private getUserBucket(userId: string): number {
    const hash = createHash("md5").update(userId).digest("hex");
    return parseInt(hash.slice(0, 8), 16) % 100;
  }

  /**
   * 获取 Classic 策略实例
   */
  private getClassicStrategy(): IClassificationStrategy {
    if (!this.classicStrategy) {
      // 延迟加载，避免循环依赖
      this.classicStrategy = this.createClassicStrategy();
    }
    return this.classicStrategy;
  }

  /**
   * 获取 Modern 策略实例
   */
  private getModernStrategy(): IClassificationStrategy {
    if (!this.modernStrategy) {
      // 延迟加载，避免循环依赖
      this.modernStrategy = this.createModernStrategy();
    }
    return this.modernStrategy;
  }

  /**
   * 创建 Classic 策略
   * Phase 4.5: 优先从容器获取
   */
  private createClassicStrategy(): IClassificationStrategy {
    // 尝试从容器获取
    if (this.container) {
      try {
        return this.container.get<IClassificationStrategy>(
          SERVICE_TYPES.ClassicStrategy,
        );
      } catch {
        logger.debug(
          "ClassicStrategy not registered in container, using fallback",
        );
      }
    }

    // 降级：返回占位策略
    return {
      name: "classic",
      classify: async () => {
        throw new Error("ClassicStrategy not yet migrated");
      },
    };
  }

  /**
   * 创建 Modern 策略
   * Phase 4.5: 优先从容器获取
   */
  private createModernStrategy(): IClassificationStrategy {
    // 尝试从容器获取
    if (this.container) {
      try {
        return this.container.get<IClassificationStrategy>(
          SERVICE_TYPES.ModernStrategy,
        );
      } catch {
        logger.debug(
          "ModernStrategy not registered in container, using fallback",
        );
      }
    }

    // 降级：返回占位策略
    return {
      name: "modern",
      classify: async () => {
        throw new Error("ModernStrategy not yet migrated");
      },
    };
  }

  /**
   * 获取当前配置
   */
  getConfig(): ClassificationFeatureFlags {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<ClassificationFeatureFlags>): void {
    this.config = { ...this.config, ...updates };
  }
}

/**
 * 单例实例
 */
let resolverInstance: StrategyResolver | null = null;

/**
 * 获取策略解析器单例
 */
export function getStrategyResolver(
  config?: StrategyResolverConfig,
): StrategyResolver {
  if (!resolverInstance) {
    resolverInstance = new StrategyResolver(config);
  }
  return resolverInstance;
}

/**
 * 重置策略解析器（用于测试）
 */
export function resetStrategyResolver(): void {
  resolverInstance = null;
}
