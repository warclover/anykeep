/**
 * 乐观 UI 分类支持
 *
 * 职责：
 * - 快速分类（仅 Tier 0 + Tier 1）用于乐观 UI
 * - 深度验证（Tier 2 + Tier 3）用于后台异步执行
 * - 决策理由生成
 *
 * @module classification/advanced/optimistic-classification
 * @version 4.2.5
 * @since 2025-12-25
 */

import type { IScoreAggregator } from "@/lib/classification/strategies/classic/interfaces";
import type {
  BookmarkInput,
  MatcherContext,
  DecisionReason,
} from "@/lib/classification/types";
import { generateTraceId } from "@/lib/classification/types";
import type {
  TieredClassificationConfig,
  MatcherGroups,
  TieredTimings,
  QuickClassificationResult,
  DeepClassificationResult,
  DecisionReasonOptions,
} from "./types";
import {
  runFastMatchers,
  calculateFastScore,
  runAIConfirmation,
  combineResults,
  evaluateAutoCreate,
} from "./tier-matcher";
import { getCorrectionCache } from "./correction-cache.service";
import { logger } from "@/lib/logger";

// ============================================================================
// 快速分类（乐观 UI）
// ============================================================================

/**
 * 快速分类（仅 Tier 0 + Tier 1）
 * 用于乐观 UI，立即返回结果，不调用 AI
 *
 * @returns QuickClassificationResult 包含分类结果和是否需要深度验证
 */
export async function classifyQuick(
  userId: string,
  bookmark: BookmarkInput,
  context: MatcherContext,
  config: TieredClassificationConfig,
  matcherGroups: MatcherGroups,
  aggregator: IScoreAggregator,
): Promise<QuickClassificationResult> {
  const timings: TieredTimings = {};
  const traceId = generateTraceId();

  // ═══════════════════════════════════════════════════════════════════════
  // Tier 0: 纠错缓存查询
  // ═══════════════════════════════════════════════════════════════════════
  if (config.correctionCacheEnabled && bookmark.url) {
    const tier0Start = performance.now();
    const correctionCache = getCorrectionCache();
    const cacheResult = correctionCache.get(userId, bookmark.url);
    timings.tier0Ms = performance.now() - tier0Start;

    if (
      cacheResult &&
      cacheResult.confidence >= config.correctionCacheMinConfidence
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
  const fastResults = await runFastMatchers(
    matcherGroups,
    context,
    config.matcherTimeoutMs,
  );
  const fastScore = calculateFastScore(fastResults, matcherGroups, aggregator);
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
  if (fastScore.score >= config.highConfidenceThreshold) {
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
  if (fastScore.score >= config.mediumConfidenceThreshold) {
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

// ============================================================================
// 深度验证
// ============================================================================

/**
 * 深度验证（Tier 2 + Tier 3）
 * 用于后台异步执行，可能调用 AI
 *
 * @param quickResult 快速分类的结果（用于比较和优化）
 * @returns 深度验证结果，可能与快速结果相同或不同
 */
export async function classifyDeep(
  userId: string,
  bookmark: BookmarkInput,
  context: MatcherContext,
  quickResult: QuickClassificationResult,
  config: TieredClassificationConfig,
  matcherGroups: MatcherGroups,
  aggregator: IScoreAggregator,
): Promise<DeepClassificationResult> {
  const timings: TieredTimings = { ...quickResult.timings };
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
  if (fastScore.score >= config.mediumConfidenceThreshold && matcherGroups.ai) {
    const tier2Start = performance.now();

    try {
      const aiResult = await runAIConfirmation(
        matcherGroups,
        context,
        fastScore,
        aggregator,
      );
      timings.tier2Ms = performance.now() - tier2Start;

      // 综合快速匹配和 AI 结果
      const finalResult = combineResults(fastScore, aiResult);

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
  const fastResults = await runFastMatchers(
    matcherGroups,
    context,
    config.matcherTimeoutMs,
  ); // 重新运行获取通用分类结果
  const autoCreateResult = await evaluateAutoCreate(
    userId,
    bookmark,
    context,
    fastResults,
    config,
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

// ============================================================================
// 决策理由生成
// ============================================================================

/**
 * 生成用户可读的决策理由
 */
export function generateDecisionReason(
  tier: 0 | 1 | 2 | 3,
  confidence: number,
  folderName: string | null,
  action: string,
  options: DecisionReasonOptions = {},
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
