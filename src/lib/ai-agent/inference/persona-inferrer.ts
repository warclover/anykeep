/**
 * 画像推断引擎主入口
 *
 * 整合平台匹配、标签匹配、信号融合，提供画像推断服务
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type {
  PersonaInferenceResult,
  PersonaInferenceConfig,
  UserBookmarkStats,
} from "./types";
import { DEFAULT_INFERENCE_CONFIG } from "./types";
import { platformMatcher } from "./platform-matcher";
import { tagMatcher } from "./tag-matcher";
import { signalFusion } from "./signal-fusion";
import { personaCache } from "./persona-cache";
import { FeatureFlags } from "../config/feature-flags";
import { logger } from "@/lib/logger";

// =============================================================================
// 画像推断引擎
// =============================================================================

/**
 * 画像推断引擎
 */
export class PersonaInferrer {
  private config: PersonaInferenceConfig;

  constructor(config: Partial<PersonaInferenceConfig> = {}) {
    this.config = { ...DEFAULT_INFERENCE_CONFIG, ...config };
  }

  /**
   * 推断用户画像
   *
   * @param stats 用户收藏统计数据
   * @param forceRefresh 强制刷新（跳过缓存）
   */
  async infer(
    stats: UserBookmarkStats,
    forceRefresh = false,
  ): Promise<PersonaInferenceResult> {
    // 检查 Feature Flag
    if (!FeatureFlags.ENABLE_PERSONA_INFERENCE) {
      return this.getDefaultResult(stats.userId);
    }

    // 检查缓存
    if (!forceRefresh) {
      const cached = personaCache.get(stats.userId);
      if (cached) {
        logger.debug(
          { userId: this.maskUserId(stats.userId) },
          "Persona inference cache hit",
        );
        return cached;
      }
    }

    // 检查最小样本量
    if (stats.totalBookmarks < this.config.minSampleSize) {
      logger.debug(
        {
          userId: this.maskUserId(stats.userId),
          totalBookmarks: stats.totalBookmarks,
          minRequired: this.config.minSampleSize,
        },
        "Insufficient sample size for inference",
      );
      return this.getDefaultResult(stats.userId, stats.totalBookmarks);
    }

    try {
      // 收集信号
      const signals = [
        ...platformMatcher.match(
          stats.platformDistribution,
          stats.totalBookmarks,
        ),
        ...tagMatcher.match(stats.tagFrequency, stats.totalBookmarks),
      ];

      // 融合信号生成结果
      const result = signalFusion.generateResult(signals, stats.totalBookmarks);

      // 置信度检查
      if (result.confidence < this.config.minConfidenceThreshold) {
        logger.debug(
          {
            userId: this.maskUserId(stats.userId),
            confidence: result.confidence,
            threshold: this.config.minConfidenceThreshold,
          },
          "Low confidence inference, falling back to general",
        );
        return this.getDefaultResult(
          stats.userId,
          stats.totalBookmarks,
          signals,
        );
      }

      // 缓存结果
      personaCache.set(stats.userId, result, this.config.cacheTTL);

      logger.info(
        {
          userId: this.maskUserId(stats.userId),
          persona: result.primaryPersona,
          confidence: result.confidence,
          signalCount: signals.length,
        },
        "Persona inferred successfully",
      );

      return result;
    } catch (error) {
      logger.error(
        {
          userId: this.maskUserId(stats.userId),
          error: error instanceof Error ? error.message : String(error),
        },
        "Persona inference failed",
      );
      return this.getDefaultResult(stats.userId, stats.totalBookmarks);
    }
  }

  /**
   * 获取默认结果（general 画像）
   */
  private getDefaultResult(
    userId: string,
    sampleSize = 0,
    signals: Parameters<typeof signalFusion.generateResult>[0] = [],
  ): PersonaInferenceResult {
    return {
      primaryPersona: "general",
      group: "general",
      confidence: 0, // 默认画像置信度为 0
      alternatives: [],
      signals,
      inferredAt: new Date().toISOString(),
      sampleSize,
    };
  }

  /**
   * 清除用户缓存（用户行为变化时调用）
   */
  invalidateCache(userId: string): void {
    personaCache.delete(userId);
    logger.debug(
      { userId: this.maskUserId(userId) },
      "Persona cache invalidated",
    );
  }

  /**
   * 清除所有缓存
   */
  clearAllCache(): void {
    personaCache.clear();
    logger.info("All persona cache cleared");
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): ReturnType<typeof personaCache.getStats> {
    return personaCache.getStats();
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<PersonaInferenceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): PersonaInferenceConfig {
    return { ...this.config };
  }

  /**
   * 脱敏用户 ID
   */
  private maskUserId(userId: string): string {
    return userId.slice(0, 8) + "...";
  }
}

/**
 * 单例实例
 */
export const personaInferrer = new PersonaInferrer();

/**
 * 创建新的推断引擎实例（用于测试）
 */
export function createPersonaInferrer(
  config?: Partial<PersonaInferenceConfig>,
): PersonaInferrer {
  return new PersonaInferrer(config);
}
