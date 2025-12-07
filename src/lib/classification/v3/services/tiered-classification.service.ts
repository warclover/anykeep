/**
 * V3.0 分层分类编排服务
 *
 * 核心优化目标：减少 70% AI API 调用成本
 *
 * 分层策略：
 * - Tier 1: 快速匹配（无 API 成本）
 *   - 向量相似度匹配
 *   - 历史行为匹配
 *   - 通用分类匹配
 *   - 如果置信度 >= 80%，直接分类，跳过 AI
 *
 * - Tier 2: AI 确认（中等成本）
 *   - 如果置信度 >= 50%，调用 AI 确认/调整
 *   - 综合快速匹配结果和 AI 决策
 *
 * - Tier 3: 自动创建评估（仅在需要时）
 *   - 如果置信度 < 50%，评估是否自动创建文件夹
 *   - 利用通用分类体系进行智能判断
 *
 * - 兜底: 送入待整理
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { IMatcher, IScoreAggregator } from "../../strategies/interfaces";
import type {
  ClassificationResult,
  BookmarkInput,
  MatcherContext,
  MatchResult,
} from "../../types";
import { logger } from "@/lib/logger";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 分层配置
 */
export interface TieredClassificationConfig {
  /** 高置信度阈值 - 达到则跳过 AI */
  highConfidenceThreshold: number;

  /** 中置信度阈值 - 达到则调用 AI 确认 */
  mediumConfidenceThreshold: number;

  /** 自动创建置信度阈值 */
  autoCreateConfidenceThreshold: number;

  /** 是否启用分层优化 */
  tieredOptimizationEnabled: boolean;

  /** 是否记录优化指标 */
  metricsEnabled: boolean;
}

/**
 * 分层匹配器分组
 */
interface MatcherGroups {
  /** 快速匹配器（无 AI 成本） */
  fast: IMatcher[];

  /** AI 匹配器 */
  ai: IMatcher | null;
}

/**
 * 优化指标
 */
export interface TieredMetrics {
  /** 总分类次数 */
  totalClassifications: number;

  /** AI 调用次数 */
  aiCallCount: number;

  /** AI 跳过次数（通过 Tier 1 直接分类） */
  aiSkippedCount: number;

  /** AI 节省率 */
  aiSavingsRate: number;

  /** 各层分类次数 */
  tierCounts: {
    tier1: number;
    tier2: number;
    tier3: number;
    inbox: number;
  };

  /** 指标开始时间 */
  startedAt: number;

  /** 上次重置时间 */
  lastResetAt: number;
}

/** 指标自动重置阈值（防止内存溢出） */
const METRICS_AUTO_RESET_THRESHOLD = 10000;

/**
 * 分层结果
 */
interface TieredResult {
  /** 最终分类结果 */
  result: ClassificationResult;

  /** 使用的层级 */
  tier: 1 | 2 | 3 | 0;

  /** 是否调用了 AI */
  aiCalled: boolean;

  /** 各层耗时 */
  timings: {
    tier1Ms?: number;
    tier2Ms?: number;
    tier3Ms?: number;
  };
}

const DEFAULT_CONFIG: TieredClassificationConfig = {
  highConfidenceThreshold: 80,
  mediumConfidenceThreshold: 50,
  autoCreateConfidenceThreshold: 75,
  tieredOptimizationEnabled: true,
  metricsEnabled: true,
};

// ============================================================================
// 服务实现
// ============================================================================

/**
 * 分层分类编排服务
 */
export class TieredClassificationService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private supabase: SupabaseClient<any>;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.supabase = supabase as SupabaseClient<any>;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.aggregator = aggregator;

    // 分组匹配器
    this.matcherGroups = this.groupMatchers(matchers);
  }

  /**
   * 分组匹配器：快速匹配器 vs AI 匹配器
   */
  private groupMatchers(matchers: IMatcher[]): MatcherGroups {
    const fast: IMatcher[] = [];
    let ai: IMatcher | null = null;

    for (const matcher of matchers) {
      if (matcher.name === "ai") {
        ai = matcher;
      } else {
        fast.push(matcher);
      }
    }

    return { fast, ai };
  }

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
      return this.classifyTraditional(context);
    }

    const tieredResult = await this.classifyTiered(userId, bookmark, context);

    // 更新指标
    if (this.config.metricsEnabled) {
      this.updateMetrics(tieredResult);
    }

    return tieredResult.result;
  }

  /**
   * 分层分类核心逻辑
   */
  private async classifyTiered(
    userId: string,
    bookmark: BookmarkInput,
    context: MatcherContext,
  ): Promise<TieredResult> {
    const timings: TieredResult["timings"] = {};

    // ═══════════════════════════════════════════════════════════════════════
    // Tier 1: 快速匹配（无 AI 成本）
    // ═══════════════════════════════════════════════════════════════════════
    const tier1Start = performance.now();
    const fastResults = await this.runFastMatchers(context);
    const fastScore = this.calculateFastScore(fastResults);
    timings.tier1Ms = performance.now() - tier1Start;

    logger.debug(
      {
        userId,
        title: bookmark.title,
        fastScore: fastScore.score,
        fastFolderId: fastScore.folderId,
        tier: 1,
      },
      "TieredClassification: Tier 1 fast matching complete",
    );

    // 高置信度 → 直接分类，跳过 AI
    if (fastScore.score >= this.config.highConfidenceThreshold) {
      logger.info(
        {
          userId,
          title: bookmark.title,
          folderId: fastScore.folderId,
          folderName: fastScore.folderName,
          confidence: fastScore.score,
          tier: 1,
          aiSkipped: true,
        },
        "TieredClassification: Tier 1 high confidence - AI skipped",
      );

      return {
        result: {
          folderId: fastScore.folderId,
          folderName: fastScore.folderName || "未知文件夹",
          confidence: fastScore.score,
          reason: `快速匹配高置信度 (${fastScore.score}%)，跳过 AI`,
          action: "classify",
          scores: fastScore.scores,
        },
        tier: 1,
        aiCalled: false,
        timings,
      };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Tier 2: AI 确认（中置信度情况）
    // ═══════════════════════════════════════════════════════════════════════
    if (
      fastScore.score >= this.config.mediumConfidenceThreshold &&
      this.matcherGroups.ai
    ) {
      const tier2Start = performance.now();

      try {
        const aiResult = await this.runAIConfirmation(context, fastScore);
        timings.tier2Ms = performance.now() - tier2Start;

        // 综合快速匹配和 AI 结果
        const finalResult = this.combineResults(fastScore, aiResult);

        logger.info(
          {
            userId,
            title: bookmark.title,
            folderId: finalResult.folderId,
            folderName: finalResult.folderName,
            confidence: finalResult.confidence,
            tier: 2,
          },
          "TieredClassification: Tier 2 AI confirmation complete",
        );

        return {
          result: finalResult,
          tier: 2,
          aiCalled: true,
          timings,
        };
      } catch (error) {
        // AI 失败，使用快速匹配结果
        timings.tier2Ms = performance.now() - tier2Start;
        logger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
          },
          "TieredClassification: AI confirmation failed, using fast result",
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
          timings,
        };
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Tier 3: 自动创建评估（低置信度情况）
    // ═══════════════════════════════════════════════════════════════════════
    const tier3Start = performance.now();
    const autoCreateResult = await this.evaluateAutoCreate(
      userId,
      bookmark,
      context,
      fastResults,
    );
    timings.tier3Ms = performance.now() - tier3Start;

    if (autoCreateResult) {
      logger.info(
        {
          userId,
          title: bookmark.title,
          action: autoCreateResult.action,
          tier: 3,
        },
        "TieredClassification: Tier 3 auto-create evaluation",
      );

      return {
        result: autoCreateResult,
        tier: 3,
        aiCalled: false,
        timings,
      };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 兜底: 送入待整理
    // ═══════════════════════════════════════════════════════════════════════
    logger.info(
      {
        userId,
        title: bookmark.title,
        fastScore: fastScore.score,
        tier: 0,
      },
      "TieredClassification: Fallback to inbox",
    );

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
      timings,
    };
  }

  /**
   * 运行快速匹配器
   */
  private async runFastMatchers(
    context: MatcherContext,
  ): Promise<Map<string, MatchResult[]>> {
    const results = new Map<string, MatchResult[]>();

    // 并行运行所有快速匹配器
    const matcherPromises = this.matcherGroups.fast.map(async (matcher) => {
      try {
        const isAvailable = await matcher.isAvailable(context);
        if (!isAvailable) return null;

        const matchResults = await matcher.match(context);
        return { name: matcher.name, results: matchResults };
      } catch (error) {
        logger.warn(
          {
            matcher: matcher.name,
            error: error instanceof Error ? error.message : String(error),
          },
          "Fast matcher failed",
        );
        return null;
      }
    });

    const matcherResults = await Promise.all(matcherPromises);

    for (const result of matcherResults) {
      if (result) {
        results.set(result.name, result.results);
      }
    }

    return results;
  }

  /**
   * 计算快速匹配综合得分
   */
  private calculateFastScore(results: Map<string, MatchResult[]>): {
    folderId: number | null;
    folderName: string | null;
    score: number;
    scores: { vectorScore: number; historyScore: number; aiScore: number };
  } {
    // 使用现有聚合器计算得分（传入空的 AI 结果）
    const classification = this.aggregator.aggregate(
      results,
      this.matcherGroups.fast,
    );

    return {
      folderId: classification.folderId,
      folderName: classification.folderName,
      score: classification.confidence,
      scores: {
        vectorScore: classification.scores?.vectorScore || 0,
        historyScore: classification.scores?.historyScore || 0,
        aiScore: 0,
      },
    };
  }

  /**
   * 运行 AI 确认
   */
  private async runAIConfirmation(
    context: MatcherContext,
    fastScore: {
      folderId: number | null;
      folderName: string | null;
      score: number;
    },
  ): Promise<ClassificationResult> {
    if (!this.matcherGroups.ai) {
      throw new Error("AI matcher not available");
    }

    const isAvailable = await this.matcherGroups.ai.isAvailable(context);
    if (!isAvailable) {
      throw new Error("AI matcher not available for this context");
    }

    const aiResults = await this.matcherGroups.ai.match(context);

    // 创建包含 AI 结果的 Map
    const resultsWithAI = new Map<string, MatchResult[]>();
    resultsWithAI.set("ai", aiResults);

    // 如果有快速匹配的最佳文件夹，也加入
    if (fastScore.folderId && fastScore.folderName) {
      resultsWithAI.set("fast", [
        {
          folderId: fastScore.folderId,
          folderName: fastScore.folderName,
          score: fastScore.score,
          confidence: fastScore.score,
          reason: "快速匹配结果",
        },
      ]);
    }

    // 使用聚合器综合判断
    return this.aggregator.aggregate(resultsWithAI, [
      this.matcherGroups.ai,
      {
        name: "fast",
        weight: 0.4,
        match: async () => [],
        isAvailable: async () => true,
      },
    ]);
  }

  /**
   * 综合快速匹配和 AI 结果
   */
  private combineResults(
    fastScore: {
      folderId: number | null;
      folderName: string | null;
      score: number;
      scores: { vectorScore: number; historyScore: number; aiScore: number };
    },
    aiResult: ClassificationResult,
  ): ClassificationResult {
    // AI 结果优先，但保留快速匹配的分数信息
    return {
      ...aiResult,
      scores: {
        vectorScore: fastScore.scores.vectorScore,
        historyScore: fastScore.scores.historyScore,
        aiScore: aiResult.confidence,
      },
      reason: `AI 确认 (${aiResult.confidence}%)，快速匹配 (${fastScore.score}%)`,
    };
  }

  /**
   * 评估自动创建文件夹
   */
  private async evaluateAutoCreate(
    userId: string,
    bookmark: BookmarkInput,
    context: MatcherContext,
    fastResults: Map<string, MatchResult[]>,
  ): Promise<ClassificationResult | null> {
    // 查找通用分类匹配结果
    const universalResults = fastResults.get("universal") || [];

    if (universalResults.length === 0) {
      return null;
    }

    const topUniversal = universalResults[0];

    // 检查是否满足自动创建条件
    if (topUniversal.score >= this.config.autoCreateConfidenceThreshold) {
      // 这里可以进一步调用 AutoCreateEvaluatorService
      // 简化版本：返回建议创建
      return {
        folderId: null,
        folderName: topUniversal.folderName || "新文件夹",
        confidence: topUniversal.score,
        reason: `建议创建「${topUniversal.folderName}」文件夹`,
        action: "suggest_create",
        scores: {
          vectorScore: 0,
          historyScore: 0,
          aiScore: 0,
        },
      };
    }

    return null;
  }

  /**
   * 传统分类方式（不启用分层优化时使用）
   */
  private async classifyTraditional(
    context: MatcherContext,
  ): Promise<ClassificationResult> {
    const allResults = new Map<string, MatchResult[]>();

    // 运行所有匹配器
    const allMatchers = [
      ...this.matcherGroups.fast,
      ...(this.matcherGroups.ai ? [this.matcherGroups.ai] : []),
    ];

    for (const matcher of allMatchers) {
      try {
        const isAvailable = await matcher.isAvailable(context);
        if (!isAvailable) continue;

        const results = await matcher.match(context);
        allResults.set(matcher.name, results);
      } catch (error) {
        logger.warn(
          {
            matcher: matcher.name,
            error: error instanceof Error ? error.message : String(error),
          },
          "Matcher failed in traditional mode",
        );
      }
    }

    return this.aggregator.aggregate(allResults, allMatchers);
  }

  /**
   * 创建空的指标对象
   */
  private createEmptyMetrics(): TieredMetrics {
    const now = Date.now();
    return {
      totalClassifications: 0,
      aiCallCount: 0,
      aiSkippedCount: 0,
      aiSavingsRate: 0,
      tierCounts: {
        tier1: 0,
        tier2: 0,
        tier3: 0,
        inbox: 0,
      },
      startedAt: now,
      lastResetAt: now,
    };
  }

  /**
   * 重置指标（公开方法，可供外部调用）
   */
  resetMetrics(): TieredMetrics {
    // 记录重置前的指标
    const previousMetrics = { ...this.metrics };
    logger.info(
      {
        metrics: previousMetrics,
        action: "tiered_metrics_reset",
        reason: "manual_or_threshold",
      },
      "TieredClassification: Metrics reset",
    );

    // 创建新的空指标
    this.metrics = this.createEmptyMetrics();
    return previousMetrics;
  }

  /**
   * 更新优化指标
   */
  private updateMetrics(tieredResult: TieredResult): void {
    // 检查是否需要自动重置（防止内存溢出）
    if (this.metrics.totalClassifications >= METRICS_AUTO_RESET_THRESHOLD) {
      logger.warn(
        {
          threshold: METRICS_AUTO_RESET_THRESHOLD,
          action: "tiered_metrics_auto_reset",
        },
        "TieredClassification: Auto-resetting metrics due to threshold",
      );
      this.resetMetrics();
    }

    this.metrics.totalClassifications++;

    if (tieredResult.aiCalled) {
      this.metrics.aiCallCount++;
    } else {
      this.metrics.aiSkippedCount++;
    }

    // 更新层级统计
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

    // 计算 AI 节省率
    this.metrics.aiSavingsRate =
      this.metrics.totalClassifications > 0
        ? Math.round(
            (this.metrics.aiSkippedCount / this.metrics.totalClassifications) *
              100,
          )
        : 0;

    // 定期记录指标
    if (this.metrics.totalClassifications % 100 === 0) {
      this.logMetrics();
    }
  }

  /**
   * 记录优化指标
   */
  private logMetrics(): void {
    logger.info(
      {
        metrics: this.metrics,
        action: "tiered_classification_metrics",
      },
      `TieredClassification: AI savings rate ${this.metrics.aiSavingsRate}%`,
    );
  }

  /**
   * 获取当前优化指标
   */
  getMetrics(): TieredMetrics {
    return { ...this.metrics };
  }

  // resetMetrics() 已在上方定义（包含完整字段和日志记录）

  /**
   * 更新配置
   */
  updateConfig(config: Partial<TieredClassificationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): TieredClassificationConfig {
    return { ...this.config };
  }
}

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
