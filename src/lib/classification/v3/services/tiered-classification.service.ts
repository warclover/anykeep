/**
 * V4.0 分层分类编排服务
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
  MatcherScoreDetail,
  DecisionReason,
} from "../../types";
import { generateTraceId } from "../../types";
import { logger } from "@/lib/logger";
import { getCorrectionCache } from "./correction-cache.service";

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

  /** V4.0: 是否启用全链路追踪 */
  tracingEnabled: boolean;

  /** V4.0: 是否返回完整决策路径（用于调试模式） */
  includeDecisionPath: boolean;

  /** V4.0: 是否启用实时纠错缓存 (Tier 0) */
  correctionCacheEnabled: boolean;

  /** V4.0: 纠错缓存命中的最低置信度阈值 */
  correctionCacheMinConfidence: number;

  /** V4.0: 单个匹配器最大执行时间 (ms) */
  matcherTimeoutMs: number;
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
    tier0: number; // V4.0: 纠错缓存命中
    tier1: number;
    tier2: number;
    tier3: number;
    inbox: number;
  };

  /** V4.0: 匹配器超时次数 */
  matcherTimeoutCount: number;

  /** V4.0: 匹配器错误次数 */
  matcherErrorCount: number;

  /** 指标开始时间 */
  startedAt: number;

  /** 上次重置时间 */
  lastResetAt: number;
}

/**
 * V4.2.5: 指标采样策略说明
 *
 * 设计原则：
 * - 平衡详细度与性能开销
 * - 防止内存无限增长
 * - 提供足够的统计样本量
 *
 * 采样策略：
 * 1. 内存指标（TieredMetrics）：
 *    - 每次分类都更新计数器（轻量级操作）
 *    - 每 100 次分类记录一次详细日志（采样率 1%）
 *    - 达到 10000 次后自动重置（防止内存溢出）
 *
 * 2. 日志采样（logMetrics）：
 *    - 采样率：1/100 = 1%
 *    - 原因：减少日志存储成本，同时保持统计有效性
 *    - 统计学依据：根据大数定律，1% 采样率在 10000 次操作中
 *      可提供约 100 个样本点，足以估计真实分布（误差 < 10%）
 *
 * 3. 持久化指标（ClassificationMetricsService）：
 *    - 所有分类都记录到数据库（完整记录）
 *    - 通过 RPC 函数批量写入优化性能
 *    - 每日聚合视图（classification_metrics_daily）减少查询开销
 *
 * 阈值来源：
 * - 10000 次重置阈值：假设单用户每天最多 1000 次分类，
 *   10000 次覆盖约 10 天数据，足够分析短期趋势
 * - 100 次日志间隔：平衡日志可读性与信息密度
 */
const METRICS_AUTO_RESET_THRESHOLD = 10000;

/** V4.2.5: 日志采样间隔（每 N 次分类记录一次详细日志） */
const METRICS_LOG_INTERVAL = 100;

/**
 * 分层结果
 */
export interface TieredResult {
  /** 最终分类结果 */
  result: ClassificationResult;

  /** 使用的层级 (0 = inbox fallback) */
  tier: 1 | 2 | 3 | 0;

  /** 是否调用了 AI */
  aiCalled: boolean;

  /** V4.0: 是否命中纠错缓存 */
  cacheHit: boolean;

  /** 各层耗时 */
  timings: {
    tier0Ms?: number; // V4.0: 纠错缓存查询耗时
    tier1Ms?: number;
    tier2Ms?: number;
    tier3Ms?: number;
  };

  /** V4.0 追踪信息 */
  traceId: string;
  matcherScores: MatcherScoreDetail[];
}

const DEFAULT_CONFIG: TieredClassificationConfig = {
  highConfidenceThreshold: 80,
  mediumConfidenceThreshold: 50,
  autoCreateConfidenceThreshold: 75,
  tieredOptimizationEnabled: true,
  metricsEnabled: true,
  tracingEnabled: true, // V4.0: 默认启用追踪
  includeDecisionPath: false, // V4.0: 默认不返回完整路径（节省带宽）
  correctionCacheEnabled: true, // V4.0: 默认启用纠错缓存
  correctionCacheMinConfidence: 60, // V4.0: 相似匹配最低 60% 置信度
  matcherTimeoutMs: 500, // V4.0: 单个匹配器最大 500ms
};

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
   * 分层分类入口（返回完整结果）
   *
   * 与 classify() 相同逻辑，但返回完整的 TieredResult，包括：
   * - cacheHit: 是否命中纠错缓存
   * - tier: 实际使用的分层 (0/1/2/3)
   * - aiCalled: 是否调用了 AI
   * - timings: 各层耗时
   *
   * 用于调试模式和需要完整分类信息的场景
   */
  async classifyWithDetails(
    userId: string,
    bookmark: BookmarkInput,
    context: MatcherContext,
  ): Promise<TieredResult> {
    if (!this.config.tieredOptimizationEnabled) {
      // 未启用分层优化，使用传统方式
      const result = await this.classifyTraditional(context);
      return {
        result,
        tier: 0,
        aiCalled: true, // 传统模式会调用所有匹配器
        cacheHit: false,
        timings: {},
        traceId: generateTraceId(),
        matcherScores: [],
      };
    }

    const tieredResult = await this.classifyTiered(userId, bookmark, context);

    // 更新指标
    if (this.config.metricsEnabled) {
      this.updateMetrics(tieredResult);
    }

    return tieredResult;
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
    // Tier 0: 纠错缓存查询 (V4.0)
    // ═══════════════════════════════════════════════════════════════════════
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
            url: bookmark.url,
            folderId: cacheResult.folderId,
            folderName: cacheResult.folderName,
            confidence: cacheResult.confidence,
            tier: 0,
            cacheHit: true,
          },
          "TieredClassification: Tier 0 correction cache hit - AI skipped",
        );

        return {
          result: {
            folderId: cacheResult.folderId,
            folderName: cacheResult.folderName,
            confidence: cacheResult.confidence,
            reason: `纠错缓存命中 (${cacheResult.confidence}%)`,
            action: "classify",
            scores: {
              vectorScore: 0,
              historyScore: 0,
              aiScore: 0,
            },
          },
          tier: 1, // 使用 tier 1 表示直接分类（跳过 AI）
          cacheHit: true,
          aiCalled: false,
          timings,
          traceId: generateTraceId(),
          matcherScores: [
            {
              matcherName: "correction-cache",
              available: true,
              durationMs: timings.tier0Ms,
              topCandidate: {
                folderId: cacheResult.folderId,
                folderName: cacheResult.folderName,
                score: cacheResult.confidence,
              },
              candidates: [
                {
                  folderId: cacheResult.folderId,
                  folderName: cacheResult.folderName,
                  score: cacheResult.confidence,
                  reason: "用户历史纠正",
                },
              ],
            },
          ],
        };
      }
    }

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
        cacheHit: false,
        timings,
        traceId: generateTraceId(),
        matcherScores: [],
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
          cacheHit: false,
          timings,
          traceId: generateTraceId(),
          matcherScores: [],
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
          cacheHit: false,
          timings,
          traceId: generateTraceId(),
          matcherScores: [],
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
        cacheHit: false,
        timings,
        traceId: generateTraceId(),
        matcherScores: [],
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
      cacheHit: false,
      timings,
      traceId: generateTraceId(),
      matcherScores: [],
    };
  }

  /**
   * 运行快速匹配器（V4.0: 支持超时控制和错误隔离）
   */
  private async runFastMatchers(
    context: MatcherContext,
  ): Promise<Map<string, MatchResult[]>> {
    const results = new Map<string, MatchResult[]>();
    const timeoutMs = this.config.matcherTimeoutMs;

    // 并行运行所有快速匹配器
    const matcherPromises = this.matcherGroups.fast.map(async (matcher) => {
      return this.runMatcherWithTimeout(matcher, context, timeoutMs);
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
   * V4.0: 运行单个匹配器（带超时和错误隔离）
   */
  private async runMatcherWithTimeout(
    matcher: IMatcher,
    context: MatcherContext,
    timeoutMs: number,
  ): Promise<{
    name: string;
    results: MatchResult[];
    durationMs: number;
  } | null> {
    const startTime = performance.now();

    // 创建超时 Promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(`Matcher ${matcher.name} timed out after ${timeoutMs}ms`),
        );
      }, timeoutMs);
    });

    // 创建匹配器执行 Promise
    const matcherPromise = (async () => {
      const isAvailable = await matcher.isAvailable(context);
      if (!isAvailable) {
        return null;
      }

      const matchResults = await matcher.match(context);
      const durationMs = Math.round(performance.now() - startTime);

      return {
        name: matcher.name,
        results: matchResults,
        durationMs,
      };
    })();

    try {
      // 竞速：匹配器执行 vs 超时
      const result = await Promise.race([matcherPromise, timeoutPromise]);
      return result;
    } catch (error) {
      const durationMs = Math.round(performance.now() - startTime);
      const isTimeout =
        error instanceof Error && error.message.includes("timed out");

      logger.warn(
        {
          matcher: matcher.name,
          durationMs,
          isTimeout,
          error: error instanceof Error ? error.message : String(error),
        },
        isTimeout ? "Matcher timed out, skipping" : "Matcher failed, skipping",
      );

      // 返回 null，不影响其他匹配器
      return null;
    }
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
   *
   * V4.2 更新：更保守的综合策略
   * - 如果快速匹配和 AI 推荐同一文件夹 → 提高置信度
   * - 如果 AI 推荐不同文件夹 → 优先使用快速匹配（除非 AI 置信度明显更高）
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
    const sameFolder = fastScore.folderId === aiResult.folderId;

    // 情况 1: 快速匹配和 AI 推荐同一文件夹 → 提高置信度
    if (sameFolder && fastScore.folderId !== null) {
      const boostedConfidence = Math.min(
        Math.max(fastScore.score, aiResult.confidence) + 5,
        100,
      );
      return {
        ...aiResult,
        confidence: boostedConfidence,
        scores: {
          vectorScore: fastScore.scores.vectorScore,
          historyScore: fastScore.scores.historyScore,
          aiScore: aiResult.confidence,
        },
        reason: `快速匹配与 AI 一致确认 (${boostedConfidence}%)`,
      };
    }

    // 情况 2: AI 推荐不同文件夹
    // V4.2: 更保守 - 只有当 AI 置信度比快速匹配高 10% 以上才采用 AI 结果
    const aiAdvantage = aiResult.confidence - fastScore.score;

    if (aiAdvantage > 10 && aiResult.folderId !== null) {
      // AI 明显更有信心，使用 AI 结果
      return {
        ...aiResult,
        scores: {
          vectorScore: fastScore.scores.vectorScore,
          historyScore: fastScore.scores.historyScore,
          aiScore: aiResult.confidence,
        },
        reason: `AI 调整 (${aiResult.confidence}% > 快速匹配 ${fastScore.score}%)`,
      };
    }

    // 默认: 优先使用快速匹配结果（基于向量相似度和历史记录更可靠）
    return {
      folderId: fastScore.folderId,
      folderName: fastScore.folderName || aiResult.folderName,
      confidence: fastScore.score,
      action: fastScore.folderId ? "classify" : aiResult.action,
      scores: {
        vectorScore: fastScore.scores.vectorScore,
        historyScore: fastScore.scores.historyScore,
        aiScore: aiResult.confidence,
      },
      reason: `快速匹配优先 (${fastScore.score}%)，AI 参考 (${aiResult.confidence}%)`,
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
        tier0: 0, // V4.0: 纠错缓存命中
        tier1: 0,
        tier2: 0,
        tier3: 0,
        inbox: 0,
      },
      matcherTimeoutCount: 0, // V4.0
      matcherErrorCount: 0, // V4.0
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
    // V4.0: 纠错缓存命中单独统计
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

    // 计算 AI 节省率
    this.metrics.aiSavingsRate =
      this.metrics.totalClassifications > 0
        ? Math.round(
            (this.metrics.aiSkippedCount / this.metrics.totalClassifications) *
              100,
          )
        : 0;

    // V4.2.5: 定期记录指标（采样策略：每 N 次记录一次）
    if (this.metrics.totalClassifications % METRICS_LOG_INTERVAL === 0) {
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

  // ============================================================================
  // V4.0 乐观 UI 支持
  // ============================================================================

  /**
   * 快速分类（仅 Tier 0 + Tier 1）
   * 用于乐观 UI，立即返回结果，不调用 AI
   *
   * @returns QuickClassificationResult 包含分类结果和是否需要深度验证
   */
  async classifyQuick(
    userId: string,
    bookmark: BookmarkInput,
    context: MatcherContext,
  ): Promise<QuickClassificationResult> {
    const timings: TieredResult["timings"] = {};
    const traceId = generateTraceId();

    // ═══════════════════════════════════════════════════════════════════════
    // Tier 0: 纠错缓存查询
    // ═══════════════════════════════════════════════════════════════════════
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
            traceId,
            userId,
            title: bookmark.title,
            url: bookmark.url,
            folderId: cacheResult.folderId,
            folderName: cacheResult.folderName,
            confidence: cacheResult.confidence,
            tier: 0,
            mode: "quick",
          },
          "QuickClassification: Tier 0 cache hit",
        );

        return {
          result: {
            folderId: cacheResult.folderId,
            folderName: cacheResult.folderName,
            confidence: cacheResult.confidence,
            reason: `纠错缓存命中 (${cacheResult.confidence}%)`,
            action: "classify",
            scores: {
              vectorScore: 0,
              historyScore: 0,
              aiScore: 0,
            },
          },
          tier: 0,
          needsDeepValidation: false, // 缓存命中，无需深度验证
          traceId,
          timings,
          decisionReason: generateDecisionReason(
            0,
            cacheResult.confidence,
            cacheResult.folderName,
            "classify",
            { cacheHit: true },
          ),
        };
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Tier 1: 快速匹配（无 AI 成本）
    // ═══════════════════════════════════════════════════════════════════════
    const tier1Start = performance.now();
    const fastResults = await this.runFastMatchers(context);
    const fastScore = this.calculateFastScore(fastResults);
    timings.tier1Ms = performance.now() - tier1Start;

    logger.debug(
      {
        traceId,
        userId,
        title: bookmark.title,
        fastScore: fastScore.score,
        fastFolderId: fastScore.folderId,
        tier: 1,
        mode: "quick",
      },
      "QuickClassification: Tier 1 fast matching complete",
    );

    // 高置信度 → 直接分类，无需深度验证
    if (fastScore.score >= this.config.highConfidenceThreshold) {
      logger.info(
        {
          traceId,
          userId,
          title: bookmark.title,
          folderId: fastScore.folderId,
          folderName: fastScore.folderName,
          confidence: fastScore.score,
          tier: 1,
          mode: "quick",
          needsDeep: false,
        },
        "QuickClassification: High confidence - no deep validation needed",
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
        needsDeepValidation: false,
        traceId,
        timings,
        decisionReason: generateDecisionReason(
          1,
          fastScore.score,
          fastScore.folderName,
          "classify",
        ),
      };
    }

    // 中置信度 → 先返回快速结果，建议深度验证
    if (fastScore.score >= this.config.mediumConfidenceThreshold) {
      logger.info(
        {
          traceId,
          userId,
          title: bookmark.title,
          folderId: fastScore.folderId,
          folderName: fastScore.folderName,
          confidence: fastScore.score,
          tier: 1,
          mode: "quick",
          needsDeep: true,
        },
        "QuickClassification: Medium confidence - deep validation recommended",
      );

      return {
        result: {
          folderId: fastScore.folderId,
          folderName: fastScore.folderName || "未知文件夹",
          confidence: fastScore.score,
          reason: `快速匹配中置信度 (${fastScore.score}%)，建议深度验证`,
          action: "classify",
          scores: fastScore.scores,
        },
        tier: 1,
        needsDeepValidation: true, // 建议深度验证
        traceId,
        timings,
        decisionReason: generateDecisionReason(
          1,
          fastScore.score,
          fastScore.folderName,
          "classify",
          { matcherInfo: "等待 AI 确认以提高准确度" },
        ),
      };
    }

    // 低置信度 → 送入待整理，建议深度验证
    logger.info(
      {
        traceId,
        userId,
        title: bookmark.title,
        fastScore: fastScore.score,
        tier: 1,
        mode: "quick",
        needsDeep: true,
      },
      "QuickClassification: Low confidence - deep validation required",
    );

    return {
      result: {
        folderId: null,
        folderName: "待整理",
        confidence: fastScore.score,
        reason: "置信度不足，等待深度验证",
        action: "inbox",
        scores: fastScore.scores,
      },
      tier: 1,
      needsDeepValidation: true, // 需要深度验证
      traceId,
      timings,
      decisionReason: generateDecisionReason(1, fastScore.score, null, "inbox"),
    };
  }

  /**
   * 深度验证（Tier 2 + Tier 3）
   * 用于后台异步执行，可能调用 AI
   *
   * @param quickResult 快速分类的结果（用于比较和优化）
   * @returns 深度验证结果，可能与快速结果相同或不同
   */
  async classifyDeep(
    userId: string,
    bookmark: BookmarkInput,
    context: MatcherContext,
    quickResult: QuickClassificationResult,
  ): Promise<DeepClassificationResult> {
    const timings: TieredResult["timings"] = { ...quickResult.timings };
    const traceId = quickResult.traceId;

    // 如果快速分类已经确认无需深度验证，直接返回
    if (!quickResult.needsDeepValidation) {
      return {
        result: quickResult.result,
        changed: false,
        tier: quickResult.tier,
        aiCalled: false,
        traceId,
        timings,
        decisionReason: quickResult.decisionReason,
      };
    }

    // 获取快速匹配结果用于 AI 确认
    const fastScore = {
      folderId: quickResult.result.folderId,
      folderName: quickResult.result.folderName,
      score: quickResult.result.confidence,
      scores: quickResult.result.scores || {
        vectorScore: 0,
        historyScore: 0,
        aiScore: 0,
      },
    };

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

        // 判断是否发生变化
        const changed =
          finalResult.folderId !== quickResult.result.folderId ||
          finalResult.confidence !== quickResult.result.confidence;

        logger.info(
          {
            traceId,
            userId,
            title: bookmark.title,
            originalFolderId: quickResult.result.folderId,
            finalFolderId: finalResult.folderId,
            changed,
            tier: 2,
            mode: "deep",
          },
          "DeepClassification: Tier 2 AI confirmation complete",
        );

        return {
          result: finalResult,
          changed,
          tier: 2,
          aiCalled: true,
          traceId,
          timings,
          decisionReason: generateDecisionReason(
            2,
            finalResult.confidence,
            finalResult.folderName,
            finalResult.action,
            { aiCalled: true, changed },
          ),
        };
      } catch (error) {
        // AI 失败，使用快速匹配结果
        timings.tier2Ms = performance.now() - tier2Start;
        logger.warn(
          {
            traceId,
            error: error instanceof Error ? error.message : String(error),
          },
          "DeepClassification: AI confirmation failed, using quick result",
        );

        return {
          result: quickResult.result,
          changed: false,
          tier: 2,
          aiCalled: true,
          traceId,
          timings,
          error: error instanceof Error ? error.message : "AI 确认失败",
          decisionReason: generateDecisionReason(
            2,
            quickResult.result.confidence,
            quickResult.result.folderName,
            quickResult.result.action,
            {
              aiCalled: true,
              changed: false,
              matcherInfo: "AI 确认失败，使用快速匹配结果",
            },
          ),
        };
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Tier 3: 自动创建评估（低置信度情况）
    // ═══════════════════════════════════════════════════════════════════════
    const tier3Start = performance.now();
    const fastResults = await this.runFastMatchers(context); // 重新运行获取通用分类结果
    const autoCreateResult = await this.evaluateAutoCreate(
      userId,
      bookmark,
      context,
      fastResults,
    );
    timings.tier3Ms = performance.now() - tier3Start;

    if (autoCreateResult) {
      const changed =
        autoCreateResult.folderId !== quickResult.result.folderId ||
        autoCreateResult.action !== quickResult.result.action;

      logger.info(
        {
          traceId,
          userId,
          title: bookmark.title,
          action: autoCreateResult.action,
          changed,
          tier: 3,
          mode: "deep",
        },
        "DeepClassification: Tier 3 auto-create evaluation",
      );

      return {
        result: autoCreateResult,
        changed,
        tier: 3,
        aiCalled: false,
        traceId,
        timings,
        decisionReason: generateDecisionReason(
          3,
          autoCreateResult.confidence,
          autoCreateResult.folderName,
          autoCreateResult.action,
        ),
      };
    }

    // 仍然没有好的结果，维持待整理
    logger.info(
      {
        traceId,
        userId,
        title: bookmark.title,
        tier: 0,
        mode: "deep",
      },
      "DeepClassification: Fallback to inbox",
    );

    return {
      result: {
        folderId: null,
        folderName: "待整理",
        confidence: fastScore.score,
        reason: "深度验证后仍无法分类",
        action: "inbox",
        scores: fastScore.scores,
      },
      changed: quickResult.result.action !== "inbox",
      tier: 0,
      aiCalled: false,
      traceId,
      timings,
      decisionReason: generateDecisionReason(0, fastScore.score, null, "inbox"),
    };
  }
}

// ============================================================================
// V4.0 乐观 UI 类型定义
// ============================================================================

/**
 * 快速分类结果（用于乐观 UI）
 */
export interface QuickClassificationResult {
  /** 分类结果 */
  result: ClassificationResult;
  /** 使用的层级 (0 = cache, 1 = fast matchers) */
  tier: 0 | 1;
  /** 是否需要深度验证 */
  needsDeepValidation: boolean;
  /** 追踪 ID（用于关联深度验证） */
  traceId: string;
  /** 耗时统计 */
  timings: {
    tier0Ms?: number;
    tier1Ms?: number;
  };
  /** 用户可读的决策理由 (V4.0) */
  decisionReason: DecisionReason;
}

/**
 * 深度验证结果
 */
export interface DeepClassificationResult {
  /** 最终分类结果 */
  result: ClassificationResult;
  /** 结果是否与快速分类不同 */
  changed: boolean;
  /** 使用的层级 */
  tier: 0 | 1 | 2 | 3;
  /** 是否调用了 AI */
  aiCalled: boolean;
  /** 追踪 ID */
  traceId: string;
  /** 耗时统计 */
  timings: {
    tier0Ms?: number;
    tier1Ms?: number;
    tier2Ms?: number;
    tier3Ms?: number;
  };
  /** 错误信息（如果有） */
  error?: string;
  /** 用户可读的决策理由 (V4.0) */
  decisionReason: DecisionReason;
}

// ============================================================================
// V4.0 决策理由生成器
// ============================================================================

/**
 * 生成用户可读的决策理由
 */
function generateDecisionReason(
  tier: 0 | 1 | 2 | 3,
  confidence: number,
  folderName: string | null,
  action: string,
  options: {
    cacheHit?: boolean;
    aiCalled?: boolean;
    changed?: boolean;
    matcherInfo?: string;
  } = {},
): DecisionReason {
  const { cacheHit, aiCalled, changed, matcherInfo } = options;

  // 置信度说明
  let confidenceExplanation: string;
  if (confidence >= 90) {
    confidenceExplanation = "极高置信度，匹配非常精准";
  } else if (confidence >= 80) {
    confidenceExplanation = "高置信度，匹配结果可靠";
  } else if (confidence >= 60) {
    confidenceExplanation = "中等置信度，可能需要确认";
  } else if (confidence >= 40) {
    confidenceExplanation = "较低置信度，建议人工检查";
  } else {
    confidenceExplanation = "置信度不足，无法自动分类";
  }

  // 主要原因
  let primary: string;
  let secondary: string | undefined;

  if (action === "inbox") {
    primary = "未找到匹配的文件夹，暂存待整理";
    secondary = "可以手动选择文件夹或稍后整理";
  } else if (cacheHit) {
    primary = `根据您之前的选择，自动归入「${folderName}」`;
    secondary = "基于历史纠正记录快速匹配";
  } else if (tier === 1 && confidence >= 80) {
    primary = `与「${folderName}」高度相似，直接归类`;
    secondary = matcherInfo || "通过向量相似度和标签匹配确定";
  } else if (tier === 2 && aiCalled) {
    if (changed) {
      primary = `AI 建议调整至「${folderName}」`;
      secondary = "AI 分析后认为此分类更准确";
    } else {
      primary = `AI 确认归入「${folderName}」`;
      secondary = "AI 验证了快速匹配的结果";
    }
  } else if (tier === 3) {
    if (action === "suggest_create") {
      primary = `建议创建新文件夹「${folderName}」`;
      secondary = "当前没有合适的现有文件夹";
    } else {
      primary = `归入「${folderName}」`;
      secondary = "通过通用分类体系匹配";
    }
  } else {
    primary = `归入「${folderName}」`;
    secondary = matcherInfo || `置信度 ${confidence}%`;
  }

  return {
    primary,
    secondary,
    confidenceExplanation,
  };
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
