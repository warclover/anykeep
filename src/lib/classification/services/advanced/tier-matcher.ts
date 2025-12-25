/**
 * 分层匹配器执行逻辑
 *
 * 职责：
 * - 快速匹配器并行执行（带超时控制）
 * - 快速匹配综合得分计算
 * - AI 确认执行
 * - 快速匹配与 AI 结果综合
 * - 自动创建评估
 *
 * @module classification/advanced/tier-matcher
 * @version 4.2.5
 * @since 2025-12-25
 */

import type {
  IMatcher,
  IScoreAggregator,
} from "@/lib/classification/strategies/interfaces";
import type {
  ClassificationResult,
  BookmarkInput,
  MatcherContext,
  MatchResult,
} from "@/lib/classification/types";
import type {
  TieredClassificationConfig,
  MatcherGroups,
  FastScore,
  MatcherExecutionResult,
} from "./types";
import { logger } from "@/lib/logger";

// ============================================================================
// 匹配器分组
// ============================================================================

/**
 * 分组匹配器：快速匹配器 vs AI 匹配器
 */
export function groupMatchers(matchers: IMatcher[]): MatcherGroups {
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

// ============================================================================
// 快速匹配执行
// ============================================================================

/**
 * 运行快速匹配器（V4.0: 支持超时控制和错误隔离）
 */
export async function runFastMatchers(
  matcherGroups: MatcherGroups,
  context: MatcherContext,
  timeoutMs: number,
): Promise<Map<string, MatchResult[]>> {
  const results = new Map<string, MatchResult[]>();

  // 并行运行所有快速匹配器
  const matcherPromises = matcherGroups.fast.map(async (matcher) => {
    return runMatcherWithTimeout(matcher, context, timeoutMs);
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
export async function runMatcherWithTimeout(
  matcher: IMatcher,
  context: MatcherContext,
  timeoutMs: number,
): Promise<MatcherExecutionResult | null> {
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

// ============================================================================
// 得分计算
// ============================================================================

/**
 * 计算快速匹配综合得分
 */
export function calculateFastScore(
  results: Map<string, MatchResult[]>,
  matcherGroups: MatcherGroups,
  aggregator: IScoreAggregator,
): FastScore {
  // 使用现有聚合器计算得分（传入空的 AI 结果）
  const classification = aggregator.aggregate(results, matcherGroups.fast);

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

// ============================================================================
// AI 确认
// ============================================================================

/**
 * 运行 AI 确认
 */
export async function runAIConfirmation(
  matcherGroups: MatcherGroups,
  context: MatcherContext,
  fastScore: FastScore,
  aggregator: IScoreAggregator,
): Promise<ClassificationResult> {
  if (!matcherGroups.ai) {
    throw new Error("AI matcher not available");
  }

  const isAvailable = await matcherGroups.ai.isAvailable(context);
  if (!isAvailable) {
    throw new Error("AI matcher not available for this context");
  }

  const aiResults = await matcherGroups.ai.match(context);

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
  return aggregator.aggregate(resultsWithAI, [
    matcherGroups.ai,
    {
      name: "fast",
      weight: 0.4,
      match: async () => [],
      isAvailable: async () => true,
    },
  ]);
}

// ============================================================================
// 结果综合
// ============================================================================

/**
 * 综合快速匹配和 AI 结果
 *
 * V4.2 更新：更保守的综合策略
 * - 如果快速匹配和 AI 推荐同一文件夹 → 提高置信度
 * - 如果 AI 推荐不同文件夹 → 优先使用快速匹配（除非 AI 置信度明显更高）
 */
export function combineResults(
  fastScore: FastScore,
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

// ============================================================================
// 自动创建评估
// ============================================================================

/**
 * 评估自动创建文件夹
 */
export async function evaluateAutoCreate(
  _userId: string,
  _bookmark: BookmarkInput,
  _context: MatcherContext,
  fastResults: Map<string, MatchResult[]>,
  config: TieredClassificationConfig,
): Promise<ClassificationResult | null> {
  // 查找通用分类匹配结果
  const universalResults = fastResults.get("universal") || [];

  if (universalResults.length === 0) {
    return null;
  }

  const topUniversal = universalResults[0];

  // 检查是否满足自动创建条件
  if (topUniversal.score >= config.autoCreateConfidenceThreshold) {
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

// ============================================================================
// 传统分类
// ============================================================================

/**
 * 传统分类方式（不启用分层优化时使用）
 */
export async function classifyTraditional(
  matcherGroups: MatcherGroups,
  context: MatcherContext,
  aggregator: IScoreAggregator,
): Promise<ClassificationResult> {
  const allResults = new Map<string, MatchResult[]>();

  // 运行所有匹配器
  const allMatchers = [
    ...matcherGroups.fast,
    ...(matcherGroups.ai ? [matcherGroups.ai] : []),
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

  return aggregator.aggregate(allResults, allMatchers);
}
