/**
 * V4.0 分层分类编排服务（协调器）
 *
 * @deprecated 自 V4.1 起，推荐使用 SimpleClassificationService 替代
 * @see src/lib/classification/services/simple-classification.service.ts
 *
 * 此服务仍可用于：
 * - 需要分层编排（Tier 0-3）的复杂场景
 * - 需要纠错缓存功能的场景
 * - 调试工具中的 V4 对比测试
 *
 * 核心优化目标：减少 70% AI API 调用成本
 *
 * 分层策略：
 * - Tier 0: 纠错缓存（V4.0 新增）
 * - Tier 1: 快速匹配（无 API 成本）
 * - Tier 2: AI 确认（中等成本）
 * - Tier 3: 自动创建评估（仅在需要时）
 * - 兜底: 送入待整理
 *
 * @module classification/advanced/tiered-classification
 * @version 4.2.6
 * @since 2025-12-25 - Refactored into coordinator pattern
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type {
  IMatcher,
  IScoreAggregator,
} from "@/lib/classification/strategies/interfaces";
import type {
  ClassificationResult,
  BookmarkInput,
  MatcherContext,
} from "@/lib/classification/types";
import { generateTraceId } from "@/lib/classification/types";
import { logger } from "@/lib/logger";

// Import from submodules
import type {
  TieredClassificationConfig,
  MatcherGroups,
  TieredMetrics,
  TieredResult,
  QuickClassificationResult,
  DeepClassificationResult,
} from "./types";
import {
  DEFAULT_CONFIG,
  METRICS_AUTO_RESET_THRESHOLD,
  METRICS_LOG_INTERVAL,
} from "./types";
import {
  groupMatchers,
  runFastMatchers,
  calculateFastScore,
  runAIConfirmation,
  combineResults,
  evaluateAutoCreate,
  classifyTraditional,
} from "./tier-matcher";
import {
  classifyQuick as quickClassify,
  classifyDeep as deepClassify,
} from "./optimistic-classification";
import { getCorrectionCache } from "./correction-cache.service";

// Re-export types for public API
export type {
  TieredClassificationConfig,
  TieredMetrics,
  TieredResult,
  QuickClassificationResult,
  DeepClassificationResult,
} from "./types";

// ============================================================================
// 服务实现
// ============================================================================

/**
 * 分层分类编排服务
 */
export class TieredClassificationService {
  private supabase: SupabaseClient<Database>;
  private config: TieredClassificationConfig;
  private matcherGroups: MatcherGroups;
  private aggregator: IScoreAggregator;

  // 内存中的优化指标（带自动重置机制防止内存溢出）
  private metrics: TieredMetrics = this.createEmptyMetrics();

  constructor(
    supabase: SupabaseClient<Database>,
    matchers: IMatcher[],
    aggregator: IScoreAggregator,
    config?: Partial<TieredClassificationConfig>,
  ) {
    this.supabase = supabase;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.aggregator = aggregator;

    // 分组匹配器
    this.matcherGroups = groupMatchers(matchers);
  }

  // ============================================================================
  // 公共 API
  // ============================================================================

  /**
   * 分层分类入口
   */
  async classify(
    userId: string,
    bookmark: BookmarkInput,
    context: MatcherContext,
  ): Promise<ClassificationResult> {
    if (!this.config.tieredOptimizationEnabled) {
      // 未启用分层优化，使用传统方式
      return classifyTraditional(this.matcherGroups, context, this.aggregator);
    }

    const tieredResult = await this.classifyTiered(userId, bookmark, context);

    // 更新指标
    if (this.config.metricsEnabled) {
      this.updateMetrics(tieredResult);
    }

    return tieredResult.result;
  }

  /**
   * 分层分类入口（返回完整结果）
   */
  async classifyWithDetails(
    userId: string,
    bookmark: BookmarkInput,
    context: MatcherContext,
  ): Promise<TieredResult> {
    if (!this.config.tieredOptimizationEnabled) {
      const result = await classifyTraditional(
        this.matcherGroups,
        context,
        this.aggregator,
      );
      return {
        result,
        tier: 0,
        aiCalled: true,
        cacheHit: false,
        timings: {},
        traceId: generateTraceId(),
        matcherScores: [],
      };
    }

    const tieredResult = await this.classifyTiered(userId, bookmark, context);

    if (this.config.metricsEnabled) {
      this.updateMetrics(tieredResult);
    }

    return tieredResult;
  }

  /**
   * 快速分类（仅 Tier 0 + Tier 1）
   * 用于乐观 UI，立即返回结果，不调用 AI
   */
  async classifyQuick(
    userId: string,
    bookmark: BookmarkInput,
    context: MatcherContext,
  ): Promise<QuickClassificationResult> {
    return quickClassify(
      userId,
      bookmark,
      context,
      this.config,
      this.matcherGroups,
      this.aggregator,
    );
  }

  /**
   * 深度验证（Tier 2 + Tier 3）
   * 用于后台异步执行，可能调用 AI
   */
  async classifyDeep(
    userId: string,
    bookmark: BookmarkInput,
    context: MatcherContext,
    quickResult: QuickClassificationResult,
  ): Promise<DeepClassificationResult> {
    return deepClassify(
      userId,
      bookmark,
      context,
      quickResult,
      this.config,
      this.matcherGroups,
      this.aggregator,
    );
  }

  // ============================================================================
  // 核心分层逻辑
  // ============================================================================

  /**
   * 分层分类核心逻辑
   */
  private async classifyTiered(
    userId: string,
    bookmark: BookmarkInput,
    context: MatcherContext,
  ): Promise<TieredResult> {
    const timings: TieredResult["timings"] = {};

    // Tier 0: 纠错缓存查询
    if (this.config.correctionCacheEnabled && bookmark.url) {
      const tier0Start = performance.now();
      const correctionCache = getCorrectionCache();
      const cacheResult = correctionCache.get(userId, bookmark.url);
      timings.tier0Ms = performance.now() - tier0Start;

      if (
        cacheResult &&
        cacheResult.confidence >= this.config.correctionCacheMinConfidence
      ) {
        logger.info(
          {
            userId,
            title: bookmark.title,
            folderId: cacheResult.folderId,
            tier: 0,
            cacheHit: true,
          },
          "TieredClassification: Tier 0 correction cache hit",
        );

        return {
          result: {
            folderId: cacheResult.folderId,
            folderName: cacheResult.folderName,
            confidence: cacheResult.confidence,
            reason: `纠错缓存命中 (${cacheResult.confidence}%)`,
            action: "classify",
            scores: { vectorScore: 0, historyScore: 0, aiScore: 0 },
          },
          tier: 1,
          cacheHit: true,
          aiCalled: false,
          timings,
          traceId: generateTraceId(),
          matcherScores: [],
        };
      }
    }

    // Tier 1: 快速匹配
    const tier1Start = performance.now();
    const fastResults = await runFastMatchers(
      this.matcherGroups,
      context,
      this.config.matcherTimeoutMs,
    );
    const fastScore = calculateFastScore(
      fastResults,
      this.matcherGroups,
      this.aggregator,
    );
    timings.tier1Ms = performance.now() - tier1Start;

    // 高置信度 → 跳过 AI
    if (fastScore.score >= this.config.highConfidenceThreshold) {
      logger.info(
        {
          userId,
          title: bookmark.title,
          folderId: fastScore.folderId,
          confidence: fastScore.score,
          tier: 1,
        },
        "TieredClassification: Tier 1 high confidence - AI skipped",
      );

      return {
        result: {
          folderId: fastScore.folderId,
          folderName: fastScore.folderName || "未知文件夹",
          confidence: fastScore.score,
          reason: `快速匹配高置信度 (${fastScore.score}%)`,
          action: "classify",
          scores: fastScore.scores,
        },
        tier: 1,
        aiCalled: false,
        cacheHit: false,
        timings,
        traceId: generateTraceId(),
        matcherScores: [],
      };
    }

    // Tier 2: AI 确认
    if (
      fastScore.score >= this.config.mediumConfidenceThreshold &&
      this.matcherGroups.ai
    ) {
      const tier2Start = performance.now();

      try {
        const aiResult = await runAIConfirmation(
          this.matcherGroups,
          context,
          fastScore,
          this.aggregator,
        );
        timings.tier2Ms = performance.now() - tier2Start;

        const finalResult = combineResults(fastScore, aiResult);

        return {
          result: finalResult,
          tier: 2,
          aiCalled: true,
          cacheHit: false,
          timings,
          traceId: generateTraceId(),
          matcherScores: [],
        };
      } catch (error) {
        timings.tier2Ms = performance.now() - tier2Start;
        logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          "TieredClassification: AI confirmation failed",
        );

        return {
          result: {
            folderId: fastScore.folderId,
            folderName: fastScore.folderName || "未知文件夹",
            confidence: fastScore.score,
            reason: "AI 确认失败，使用快速匹配结果",
            action: fastScore.score >= 50 ? "classify" : "inbox",
            scores: fastScore.scores,
          },
          tier: 2,
          aiCalled: true,
          cacheHit: false,
          timings,
          traceId: generateTraceId(),
          matcherScores: [],
        };
      }
    }

    // Tier 3: 自动创建评估
    const tier3Start = performance.now();
    const autoCreateResult = await evaluateAutoCreate(
      userId,
      bookmark,
      context,
      fastResults,
      this.config,
    );
    timings.tier3Ms = performance.now() - tier3Start;

    if (autoCreateResult) {
      return {
        result: autoCreateResult,
        tier: 3,
        aiCalled: false,
        cacheHit: false,
        timings,
        traceId: generateTraceId(),
        matcherScores: [],
      };
    }

    // 兜底: 送入待整理
    return {
      result: {
        folderId: null,
        folderName: "待整理",
        confidence: fastScore.score,
        reason: "置信度不足，送入待整理",
        action: "inbox",
        scores: fastScore.scores,
      },
      tier: 0,
      aiCalled: false,
      cacheHit: false,
      timings,
      traceId: generateTraceId(),
      matcherScores: [],
    };
  }

  // ============================================================================
  // 指标管理
  // ============================================================================

  private createEmptyMetrics(): TieredMetrics {
    const now = Date.now();
    return {
      totalClassifications: 0,
      aiCallCount: 0,
      aiSkippedCount: 0,
      aiSavingsRate: 0,
      tierCounts: { tier0: 0, tier1: 0, tier2: 0, tier3: 0, inbox: 0 },
      matcherTimeoutCount: 0,
      matcherErrorCount: 0,
      startedAt: now,
      lastResetAt: now,
    };
  }

  resetMetrics(): TieredMetrics {
    const previousMetrics = { ...this.metrics };
    logger.info(
      { metrics: previousMetrics, action: "tiered_metrics_reset" },
      "TieredClassification: Metrics reset",
    );
    this.metrics = this.createEmptyMetrics();
    return previousMetrics;
  }

  private updateMetrics(tieredResult: TieredResult): void {
    if (this.metrics.totalClassifications >= METRICS_AUTO_RESET_THRESHOLD) {
      this.resetMetrics();
    }

    this.metrics.totalClassifications++;

    if (tieredResult.aiCalled) {
      this.metrics.aiCallCount++;
    } else {
      this.metrics.aiSkippedCount++;
    }

    if (tieredResult.cacheHit) {
      this.metrics.tierCounts.tier0++;
    } else {
      switch (tieredResult.tier) {
        case 1:
          this.metrics.tierCounts.tier1++;
          break;
        case 2:
          this.metrics.tierCounts.tier2++;
          break;
        case 3:
          this.metrics.tierCounts.tier3++;
          break;
        case 0:
          this.metrics.tierCounts.inbox++;
          break;
      }
    }

    this.metrics.aiSavingsRate =
      this.metrics.totalClassifications > 0
        ? Math.round(
            (this.metrics.aiSkippedCount / this.metrics.totalClassifications) *
              100,
          )
        : 0;

    if (this.metrics.totalClassifications % METRICS_LOG_INTERVAL === 0) {
      logger.info(
        { metrics: this.metrics, action: "tiered_classification_metrics" },
        `TieredClassification: AI savings rate ${this.metrics.aiSavingsRate}%`,
      );
    }
  }

  getMetrics(): TieredMetrics {
    return { ...this.metrics };
  }

  // ============================================================================
  // 配置管理
  // ============================================================================

  updateConfig(config: Partial<TieredClassificationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): TieredClassificationConfig {
    return { ...this.config };
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建分层分类服务
 */
export function createTieredClassificationService(
  supabase: SupabaseClient<Database>,
  matchers: IMatcher[],
  aggregator: IScoreAggregator,
  config?: Partial<TieredClassificationConfig>,
): TieredClassificationService {
  return new TieredClassificationService(
    supabase,
    matchers,
    aggregator,
    config,
  );
}
