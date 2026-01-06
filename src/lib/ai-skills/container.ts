/**
 * AI Skills 模块依赖容器
 *
 * 沿用 ClassificationContainer 模式，提供：
 * - 单例管理
 * - 延迟初始化
 * - 测试时依赖替换
 *
 * @example
 * ```typescript
 * // 初始化（通常在应用启动时）
 * const container = AISkillsContainer.initialize(supabase);
 *
 * // 获取服务
 * const registry = container.getSkillRegistry();
 * const engine = container.getOrchestrationEngine();
 * const router = container.getIntentRouter();
 *
 * // 测试时重置
 * AISkillsContainer.reset();
 * ```
 *
 * @version 1.0.0
 * @since 2026-01-06
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import type { SkillRegistry } from "./core/skill-registry";
import { createSkillRegistryInstance } from "./core/skill-registry";
import type { OrchestrationEngine } from "./engine/orchestration-engine";
import { createOrchestrationEngine } from "./engine/orchestration-engine";
import type { OrchestrationEngineConfig } from "./engine/types";
import type { IntentRouter } from "./router/intent-router";
import {
  createIntentRouter,
  type IntentRouterConfig,
} from "./router/intent-router";

// ============================================
// 类型定义
// ============================================

/**
 * 容器配置
 */
export interface AISkillsContainerConfig {
  /** 编排引擎配置 */
  orchestrationEngine?: OrchestrationEngineConfig;
  /** 意图路由器配置 */
  intentRouter?: IntentRouterConfig;
  /** 是否启用调试日志 */
  debug?: boolean;
}

/**
 * 服务覆盖（用于测试）
 */
export interface AISkillsContainerOverrides {
  skillRegistry?: SkillRegistry;
  orchestrationEngine?: OrchestrationEngine;
  intentRouter?: IntentRouter;
}

// ============================================
// 容器实现
// ============================================

/**
 * AI Skills 模块依赖容器
 *
 * 管理 AI Skills 模块的核心服务实例：
 * - SkillRegistry: Skills 注册中心
 * - OrchestrationEngine: 编排执行引擎
 * - IntentRouter: 意图路由器
 */
export class AISkillsContainer {
  private static instance: AISkillsContainer | null = null;

  // 配置
  private config: AISkillsContainerConfig;

  // 缓存的服务实例
  private _skillRegistry: SkillRegistry | null = null;
  private _orchestrationEngine: OrchestrationEngine | null = null;
  private _intentRouter: IntentRouter | null = null;

  // 服务覆盖（用于测试）
  private overrides: AISkillsContainerOverrides = {};

  /**
   * 私有构造函数
   */
  private constructor(
    private supabase: SupabaseClient,
    config: AISkillsContainerConfig = {},
  ) {
    this.config = {
      debug: false,
      ...config,
    };
  }

  // ============================================
  // 静态方法
  // ============================================

  /**
   * 初始化容器
   *
   * @param supabase - Supabase 客户端
   * @param config - 容器配置
   */
  static initialize(
    supabase: SupabaseClient,
    config?: AISkillsContainerConfig,
  ): AISkillsContainer {
    if (!AISkillsContainer.instance) {
      AISkillsContainer.instance = new AISkillsContainer(supabase, config);
      logger.info("AISkillsContainer: Initialized");
    } else {
      // 更新 Supabase 客户端和配置
      AISkillsContainer.instance.supabase = supabase;
      if (config) {
        AISkillsContainer.instance.config = {
          ...AISkillsContainer.instance.config,
          ...config,
        };
      }
      logger.debug("AISkillsContainer: Updated existing instance");
    }
    return AISkillsContainer.instance;
  }

  /**
   * 获取容器实例
   *
   * @throws Error 如果容器未初始化
   */
  static getInstance(): AISkillsContainer {
    if (!AISkillsContainer.instance) {
      throw new Error(
        "AISkillsContainer not initialized. Call initialize() first.",
      );
    }
    return AISkillsContainer.instance;
  }

  /**
   * 尝试获取容器实例（不抛出异常）
   */
  static tryGetInstance(): AISkillsContainer | null {
    return AISkillsContainer.instance;
  }

  /**
   * 检查容器是否已初始化
   */
  static isInitialized(): boolean {
    return AISkillsContainer.instance !== null;
  }

  /**
   * 重置容器（用于测试）
   */
  static reset(): void {
    if (AISkillsContainer.instance) {
      // 清空缓存的服务
      AISkillsContainer.instance._skillRegistry = null;
      AISkillsContainer.instance._orchestrationEngine = null;
      AISkillsContainer.instance._intentRouter = null;
      AISkillsContainer.instance.overrides = {};
      logger.debug("AISkillsContainer: Services cleared");
    }
    AISkillsContainer.instance = null;
    logger.info("AISkillsContainer: Reset completed");
  }

  // ============================================
  // 服务获取器
  // ============================================

  /**
   * 获取 SkillRegistry
   *
   * 延迟创建，首次调用时初始化
   */
  getSkillRegistry(): SkillRegistry {
    // 优先使用覆盖的实例
    if (this.overrides.skillRegistry) {
      return this.overrides.skillRegistry;
    }

    if (!this._skillRegistry) {
      this._skillRegistry = createSkillRegistryInstance();
      if (this.config.debug) {
        logger.debug("AISkillsContainer: SkillRegistry created");
      }
    }
    return this._skillRegistry;
  }

  /**
   * 获取 OrchestrationEngine
   *
   * 延迟创建，首次调用时初始化
   */
  getOrchestrationEngine(): OrchestrationEngine {
    // 优先使用覆盖的实例
    if (this.overrides.orchestrationEngine) {
      return this.overrides.orchestrationEngine;
    }

    if (!this._orchestrationEngine) {
      this._orchestrationEngine = createOrchestrationEngine(
        this.config.orchestrationEngine,
      );
      if (this.config.debug) {
        logger.debug("AISkillsContainer: OrchestrationEngine created");
      }
    }
    return this._orchestrationEngine;
  }

  /**
   * 获取 IntentRouter
   *
   * 延迟创建，首次调用时初始化
   */
  getIntentRouter(): IntentRouter {
    // 优先使用覆盖的实例
    if (this.overrides.intentRouter) {
      return this.overrides.intentRouter;
    }

    if (!this._intentRouter) {
      this._intentRouter = createIntentRouter(this.config.intentRouter);
      if (this.config.debug) {
        logger.debug("AISkillsContainer: IntentRouter created");
      }
    }
    return this._intentRouter;
  }

  /**
   * 获取 Supabase 客户端
   */
  getSupabase(): SupabaseClient {
    return this.supabase;
  }

  // ============================================
  // 测试支持
  // ============================================

  /**
   * 设置服务覆盖（用于测试）
   *
   * @example
   * ```typescript
   * // 在测试中
   * const mockRegistry = createMockSkillRegistry();
   * container.setOverrides({ skillRegistry: mockRegistry });
   *
   * // 测试完成后清除
   * container.clearOverrides();
   * ```
   */
  setOverrides(overrides: AISkillsContainerOverrides): void {
    this.overrides = { ...this.overrides, ...overrides };
    logger.debug(
      { overrideKeys: Object.keys(overrides) },
      "AISkillsContainer: Overrides set",
    );
  }

  /**
   * 清除服务覆盖
   */
  clearOverrides(): void {
    this.overrides = {};
    logger.debug("AISkillsContainer: Overrides cleared");
  }

  /**
   * 获取所有服务（便捷方法）
   */
  getAllServices(): {
    skillRegistry: SkillRegistry;
    orchestrationEngine: OrchestrationEngine;
    intentRouter: IntentRouter;
  } {
    return {
      skillRegistry: this.getSkillRegistry(),
      orchestrationEngine: this.getOrchestrationEngine(),
      intentRouter: this.getIntentRouter(),
    };
  }

  /**
   * 获取容器统计信息
   */
  getStats(): {
    initialized: boolean;
    servicesCreated: {
      skillRegistry: boolean;
      orchestrationEngine: boolean;
      intentRouter: boolean;
    };
    overridesSet: string[];
  } {
    return {
      initialized: AISkillsContainer.isInitialized(),
      servicesCreated: {
        skillRegistry: this._skillRegistry !== null,
        orchestrationEngine: this._orchestrationEngine !== null,
        intentRouter: this._intentRouter !== null,
      },
      overridesSet: Object.keys(this.overrides).filter(
        (key) =>
          this.overrides[key as keyof AISkillsContainerOverrides] !== undefined,
      ),
    };
  }
}

// ============================================
// 便捷函数
// ============================================

/**
 * 获取已初始化的容器实例
 *
 * @throws Error 如果容器未初始化
 */
export function getAISkillsContainer(): AISkillsContainer {
  return AISkillsContainer.getInstance();
}

/**
 * 尝试获取容器实例（不抛出异常）
 */
export function tryGetAISkillsContainer(): AISkillsContainer | null {
  return AISkillsContainer.tryGetInstance();
}
