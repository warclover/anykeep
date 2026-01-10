/**
 * HybridIntentClassifier 初始化模块
 *
 * 职责：
 * - 单例管理（懒加载）
 * - Embedding 预计算（应用启动时调用）
 * - Feature Flag 检查
 *
 * 使用方式：
 * 1. 应用启动时调用 initializeHybridClassifier() 预计算 Embedding
 * 2. 路由时调用 getHybridClassifier() 获取实例
 * 3. 检查 shouldUseHybridClassifier() 判断是否启用
 *
 * @version 2.0.0
 * @since 2026-01-09
 * @updated 2026-01-10 - 增强为单例管理模块 (P0-2)
 */

import { logger } from "@/lib/logger";
import { FeatureFlags } from "@/lib/ai-agent/config/feature-flags";
import { HybridIntentClassifier } from "./hybrid-intent-classifier";
import type { HybridIntentClassifierConfig } from "./hybrid-intent-classifier";
import type { IntentRule } from "./types";
import { DEFAULT_RULES } from "./intent-classifier";

// ============================================
// 单例管理
// ============================================

/**
 * 单例实例（懒加载）
 */
let hybridClassifierInstance: HybridIntentClassifier | null = null;

/**
 * 单例配置（延迟初始化）
 */
let singletonConfig: HybridIntentClassifierConfig | undefined = undefined;

/**
 * 是否已初始化（Embedding 预计算完成）
 */
let isInitialized = false;

/**
 * 初始化 Promise（防止重复初始化）
 */
let initializationPromise: Promise<void> | null = null;

// ============================================
// Feature Flag 检查
// ============================================

/**
 * 检查是否应该使用混合分类器
 *
 * 基于 Feature Flag 判断，支持运行时检查
 *
 * @returns 是否启用混合分类器
 */
export function shouldUseHybridClassifier(): boolean {
  return FeatureFlags.ENABLE_HYBRID_INTENT_CLASSIFIER;
}

// ============================================
// 单例获取
// ============================================

/**
 * 获取混合分类器单例
 *
 * 懒加载模式：首次访问时创建实例
 * 注意：此方法仅创建实例，不执行 Embedding 预计算
 * 如需预计算，请先调用 initializeHybridClassifier()
 *
 * @param config - 可选配置（仅首次调用生效）
 * @returns HybridIntentClassifier 实例，如果 Feature Flag 禁用则返回 null
 */
export function getHybridClassifier(
  config?: HybridIntentClassifierConfig,
): HybridIntentClassifier | null {
  // 检查 Feature Flag
  if (!shouldUseHybridClassifier()) {
    return null;
  }

  // 懒加载创建实例
  if (!hybridClassifierInstance) {
    const finalConfig = config || singletonConfig || {};
    hybridClassifierInstance = new HybridIntentClassifier({
      ...finalConfig,
      enableSemanticMatching: true,
      debug: process.env.NODE_ENV === "development",
    });
    logger.debug(
      { hasConfig: !!config || !!singletonConfig },
      "HybridIntentClassifier: Lazy singleton created",
    );
  }

  return hybridClassifierInstance;
}

/**
 * 配置混合分类器单例（在首次获取前调用）
 *
 * @param config - 单例配置
 */
export function configureHybridClassifier(
  config: HybridIntentClassifierConfig,
): void {
  if (hybridClassifierInstance) {
    logger.warn(
      "HybridIntentClassifier: configureHybridClassifier called after instance created",
    );
    // 已创建实例，无法更改配置，只能记录警告
  } else {
    singletonConfig = config;
  }
}

// ============================================
// 初始化（Embedding 预计算）
// ============================================

/**
 * 初始化混合分类器（Embedding 预计算）
 *
 * 应在应用启动时调用一次，预计算意图规则的 Embedding
 * 支持重复调用（会检查是否已初始化）
 *
 * @param config - 可选配置
 * @returns 初始化是否成功
 */
export async function initializeHybridClassifier(
  config?: HybridIntentClassifierConfig,
): Promise<boolean> {
  // 检查 Feature Flag
  if (!shouldUseHybridClassifier()) {
    logger.info(
      "HybridIntentClassifier: Skipping initialization (Feature Flag disabled)",
    );
    return false;
  }

  // 检查是否已初始化
  if (isInitialized) {
    logger.debug("HybridIntentClassifier: Already initialized");
    return true;
  }

  // 防止重复初始化
  if (initializationPromise) {
    logger.debug(
      "HybridIntentClassifier: Initialization in progress, waiting...",
    );
    await initializationPromise;
    return isInitialized;
  }

  // 执行初始化
  initializationPromise = (async () => {
    const startTime = performance.now();

    try {
      // 获取或创建实例
      const classifier = getHybridClassifier(config);
      if (!classifier) {
        logger.warn("HybridIntentClassifier: Failed to create instance");
        return;
      }

      // 预计算 Embedding
      await classifier.initialize(DEFAULT_RULES);

      // 标记为已初始化
      isInitialized = true;

      const durationMs = Math.round(performance.now() - startTime);
      const status = classifier.getSemanticMatcherStatus();

      logger.info(
        {
          durationMs,
          ruleCount: DEFAULT_RULES.length,
          intentCount: status.intentCount,
          semanticInitialized: status.initialized,
        },
        "HybridIntentClassifier: Initialization completed",
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "HybridIntentClassifier: Initialization failed",
      );
      // 不抛出错误，允许系统在没有语义匹配的情况下运行
    } finally {
      initializationPromise = null;
    }
  })();

  await initializationPromise;
  return isInitialized;
}

/**
 * 检查混合分类器是否已初始化（Embedding 预计算完成）
 *
 * @returns 是否已初始化
 */
export function isHybridClassifierInitialized(): boolean {
  return isInitialized;
}

/**
 * 获取混合分类器状态
 *
 * @returns 状态信息
 */
export function getHybridClassifierStatus(): {
  enabled: boolean;
  instanceCreated: boolean;
  initialized: boolean;
  semanticMatcher: {
    initialized: boolean;
    intentCount: number;
  };
} {
  const enabled = shouldUseHybridClassifier();
  const instanceCreated = hybridClassifierInstance !== null;

  if (!enabled || !hybridClassifierInstance) {
    return {
      enabled,
      instanceCreated,
      initialized: false,
      semanticMatcher: {
        initialized: false,
        intentCount: 0,
      },
    };
  }

  return {
    enabled,
    instanceCreated,
    initialized: isInitialized,
    semanticMatcher: hybridClassifierInstance.getSemanticMatcherStatus(),
  };
}

// ============================================
// 向后兼容
// ============================================

/**
 * 初始化 HybridIntentClassifier（向后兼容）
 *
 * @deprecated 请使用 initializeHybridClassifier() 替代
 *
 * @param rules - 意图规则列表（可选，默认使用 DEFAULT_RULES）
 * @returns 初始化后的分类器
 */
export async function initializeHybridIntentClassifier(
  rules?: IntentRule[],
): Promise<HybridIntentClassifier> {
  // 如果提供了自定义规则，使用自定义配置
  if (rules && rules.length > 0) {
    const classifier = new HybridIntentClassifier({
      enableSemanticMatching: true,
      debug: process.env.NODE_ENV === "development",
    });

    try {
      await classifier.initialize(rules);
      logger.info(
        {
          ruleCount: rules.length,
          semanticStatus: classifier.getSemanticMatcherStatus(),
        },
        "HybridIntentClassifier initialized successfully (legacy API)",
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "HybridIntentClassifier initialization failed (legacy API)",
      );
    }

    return classifier;
  }

  // 使用单例模式
  await initializeHybridClassifier();
  return getHybridClassifier() || new HybridIntentClassifier();
}

// ============================================
// 重置（仅用于测试）
// ============================================

/**
 * 重置混合分类器单例
 *
 * @internal 仅用于测试
 */
export function resetHybridClassifier(): void {
  hybridClassifierInstance = null;
  singletonConfig = undefined;
  isInitialized = false;
  initializationPromise = null;
  logger.debug("HybridIntentClassifier: Singleton reset");
}
