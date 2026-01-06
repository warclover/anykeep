/**
 * AI Agent 模块依赖容器
 *
 * 沿用 AISkillsContainer 模式，提供：
 * - 单例管理
 * - 延迟初始化
 * - 测试时依赖替换
 *
 * @example
 * ```typescript
 * // 初始化（通常在应用启动时）
 * const container = AIAgentContainer.initialize(supabase);
 *
 * // 获取服务
 * const preferencesService = container.getPreferencesService();
 * const learningService = container.getLearningService();
 * const errorRecoveryHandler = container.getErrorRecoveryHandler();
 *
 * // 测试时重置
 * AIAgentContainer.reset();
 * ```
 *
 * @version 1.0.0
 * @since 2026-01-06
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { PreferencesService } from "./preferences/preferences-service";
import { PreferenceLearningService } from "./preferences/learning-service";
import { ErrorRecoveryHandler } from "./error-recovery/error-recovery-handler";
import { EpisodicMemoryService } from "./memory/episodic-memory";
import { InteractionLogger } from "./memory/interaction-logger";

// ============================================
// 类型定义
// ============================================

/**
 * 容器配置
 */
export interface AIAgentContainerConfig {
  /** 是否启用调试日志 */
  debug?: boolean;
  /** 记忆服务配置 */
  memory?: {
    /** 是否启用情景记忆 */
    enableEpisodicMemory?: boolean;
    /** 是否启用交互日志 */
    enableInteractionLog?: boolean;
  };
}

/**
 * 服务覆盖（用于测试）
 */
export interface AIAgentContainerOverrides {
  preferencesService?: PreferencesService;
  learningService?: PreferenceLearningService;
  errorRecoveryHandler?: ErrorRecoveryHandler;
  episodicMemoryService?: EpisodicMemoryService;
  interactionLogger?: InteractionLogger;
}

// ============================================
// 容器实现
// ============================================

/**
 * AI Agent 模块依赖容器
 *
 * 管理 AI Agent 模块的核心服务实例：
 * - PreferencesService: 偏好服务
 * - PreferenceLearningService: 学习服务
 * - ErrorRecoveryHandler: 错误恢复处理器
 * - EpisodicMemoryService: 情景记忆服务
 * - InteractionLogger: 交互日志记录器
 */
export class AIAgentContainer {
  private static instance: AIAgentContainer | null = null;

  // 配置
  private config: AIAgentContainerConfig;

  // 缓存的服务实例
  private _preferencesService: PreferencesService | null = null;
  private _learningService: PreferenceLearningService | null = null;
  private _errorRecoveryHandler: ErrorRecoveryHandler | null = null;
  private _episodicMemoryService: EpisodicMemoryService | null = null;
  private _interactionLogger: InteractionLogger | null = null;

  // 服务覆盖（用于测试）
  private overrides: AIAgentContainerOverrides = {};

  /**
   * 私有构造函数
   */
  private constructor(
    private supabase: SupabaseClient,
    config: AIAgentContainerConfig = {},
  ) {
    this.config = {
      debug: false,
      memory: {
        enableEpisodicMemory: true,
        enableInteractionLog: true,
      },
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
    config?: AIAgentContainerConfig,
  ): AIAgentContainer {
    if (!AIAgentContainer.instance) {
      AIAgentContainer.instance = new AIAgentContainer(supabase, config);
      logger.info("AIAgentContainer: Initialized");
    } else {
      // 更新 Supabase 客户端和配置
      AIAgentContainer.instance.supabase = supabase;
      if (config) {
        AIAgentContainer.instance.config = {
          ...AIAgentContainer.instance.config,
          ...config,
        };
      }
      logger.debug("AIAgentContainer: Updated existing instance");
    }
    return AIAgentContainer.instance;
  }

  /**
   * 获取容器实例
   *
   * @throws Error 如果容器未初始化
   */
  static getInstance(): AIAgentContainer {
    if (!AIAgentContainer.instance) {
      throw new Error(
        "AIAgentContainer not initialized. Call initialize() first.",
      );
    }
    return AIAgentContainer.instance;
  }

  /**
   * 尝试获取容器实例（不抛出异常）
   */
  static tryGetInstance(): AIAgentContainer | null {
    return AIAgentContainer.instance;
  }

  /**
   * 检查容器是否已初始化
   */
  static isInitialized(): boolean {
    return AIAgentContainer.instance !== null;
  }

  /**
   * 重置容器（用于测试）
   */
  static reset(): void {
    if (AIAgentContainer.instance) {
      // 清空缓存的服务
      AIAgentContainer.instance._preferencesService = null;
      AIAgentContainer.instance._learningService = null;
      AIAgentContainer.instance._errorRecoveryHandler = null;
      AIAgentContainer.instance._episodicMemoryService = null;
      AIAgentContainer.instance._interactionLogger = null;
      AIAgentContainer.instance.overrides = {};
      logger.debug("AIAgentContainer: Services cleared");
    }
    AIAgentContainer.instance = null;
    logger.info("AIAgentContainer: Reset completed");
  }

  // ============================================
  // 服务获取器
  // ============================================

  /**
   * 获取 PreferencesService
   *
   * 延迟创建，首次调用时初始化
   */
  getPreferencesService(): PreferencesService {
    // 优先使用覆盖的实例
    if (this.overrides.preferencesService) {
      return this.overrides.preferencesService;
    }

    if (!this._preferencesService) {
      this._preferencesService = new PreferencesService();
      if (this.config.debug) {
        logger.debug("AIAgentContainer: PreferencesService created");
      }
    }
    return this._preferencesService;
  }

  /**
   * 获取 PreferenceLearningService
   *
   * 延迟创建，首次调用时初始化
   */
  getLearningService(): PreferenceLearningService {
    // 优先使用覆盖的实例
    if (this.overrides.learningService) {
      return this.overrides.learningService;
    }

    if (!this._learningService) {
      this._learningService = new PreferenceLearningService();
      if (this.config.debug) {
        logger.debug("AIAgentContainer: PreferenceLearningService created");
      }
    }
    return this._learningService;
  }

  /**
   * 获取 ErrorRecoveryHandler
   *
   * 延迟创建，首次调用时初始化
   */
  getErrorRecoveryHandler(): ErrorRecoveryHandler {
    // 优先使用覆盖的实例
    if (this.overrides.errorRecoveryHandler) {
      return this.overrides.errorRecoveryHandler;
    }

    if (!this._errorRecoveryHandler) {
      this._errorRecoveryHandler = new ErrorRecoveryHandler();
      if (this.config.debug) {
        logger.debug("AIAgentContainer: ErrorRecoveryHandler created");
      }
    }
    return this._errorRecoveryHandler;
  }

  /**
   * 获取 EpisodicMemoryService
   *
   * 延迟创建，首次调用时初始化
   */
  getEpisodicMemoryService(): EpisodicMemoryService {
    // 优先使用覆盖的实例
    if (this.overrides.episodicMemoryService) {
      return this.overrides.episodicMemoryService;
    }

    if (!this._episodicMemoryService) {
      this._episodicMemoryService = new EpisodicMemoryService();
      if (this.config.debug) {
        logger.debug("AIAgentContainer: EpisodicMemoryService created");
      }
    }
    return this._episodicMemoryService;
  }

  /**
   * 获取 InteractionLogger
   *
   * 延迟创建，首次调用时初始化
   */
  getInteractionLogger(): InteractionLogger {
    // 优先使用覆盖的实例
    if (this.overrides.interactionLogger) {
      return this.overrides.interactionLogger;
    }

    if (!this._interactionLogger) {
      this._interactionLogger = new InteractionLogger();
      if (this.config.debug) {
        logger.debug("AIAgentContainer: InteractionLogger created");
      }
    }
    return this._interactionLogger;
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
   * const mockPreferences = createMockPreferencesService();
   * container.setOverrides({ preferencesService: mockPreferences });
   *
   * // 测试完成后清除
   * container.clearOverrides();
   * ```
   */
  setOverrides(overrides: AIAgentContainerOverrides): void {
    this.overrides = { ...this.overrides, ...overrides };
    logger.debug(
      { overrideKeys: Object.keys(overrides) },
      "AIAgentContainer: Overrides set",
    );
  }

  /**
   * 清除服务覆盖
   */
  clearOverrides(): void {
    this.overrides = {};
    logger.debug("AIAgentContainer: Overrides cleared");
  }

  /**
   * 获取所有服务（便捷方法）
   */
  getAllServices(): {
    preferencesService: PreferencesService;
    learningService: PreferenceLearningService;
    errorRecoveryHandler: ErrorRecoveryHandler;
    episodicMemoryService: EpisodicMemoryService;
    interactionLogger: InteractionLogger;
  } {
    return {
      preferencesService: this.getPreferencesService(),
      learningService: this.getLearningService(),
      errorRecoveryHandler: this.getErrorRecoveryHandler(),
      episodicMemoryService: this.getEpisodicMemoryService(),
      interactionLogger: this.getInteractionLogger(),
    };
  }

  /**
   * 获取容器统计信息
   */
  getStats(): {
    initialized: boolean;
    servicesCreated: {
      preferencesService: boolean;
      learningService: boolean;
      errorRecoveryHandler: boolean;
      episodicMemoryService: boolean;
      interactionLogger: boolean;
    };
    overridesSet: string[];
  } {
    return {
      initialized: AIAgentContainer.isInitialized(),
      servicesCreated: {
        preferencesService: this._preferencesService !== null,
        learningService: this._learningService !== null,
        errorRecoveryHandler: this._errorRecoveryHandler !== null,
        episodicMemoryService: this._episodicMemoryService !== null,
        interactionLogger: this._interactionLogger !== null,
      },
      overridesSet: Object.keys(this.overrides).filter(
        (key) =>
          this.overrides[key as keyof AIAgentContainerOverrides] !== undefined,
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
export function getAIAgentContainer(): AIAgentContainer {
  return AIAgentContainer.getInstance();
}

/**
 * 尝试获取容器实例（不抛出异常）
 */
export function tryGetAIAgentContainer(): AIAgentContainer | null {
  return AIAgentContainer.tryGetInstance();
}
