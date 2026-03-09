/**
 * CascadeRanker - 级联排序引擎
 *
 * 整个分类系统的核心调度器。
 * 按 tier（instant → fast → slow）分组执行 Scorer，
 * 每个 tier 完成后检查置信度，高置信度提前终止。
 *
 * 一个 class 替代了旧系统的：
 * - StrategyResolver（5 层灰度决策）
 * - ClassicAdapter / ModernAdapter
 * - L0RuleMatcher / T0Generator / T1Corrector
 * - ScoreAggregator
 *
 * @version 2.0.0
 * @since 2026-03-09
 */

import { logger } from "@/lib/logger";
import type {
  Score,
  Scorer,
  ScorerTier,
  BookmarkContext,
  FolderContext,
  UserContext,
  MergedScore,
  RankEntry,
  CascadeConfig,
  ScorerDetail,
  ClassifyTiming,
} from "../types";
import { mergeScores, getTopK, normalizeMergedScores } from "./score-merger";
import { CLASSIFICATION_CONFIG } from "../config";

/** Tier 执行顺序 */
const TIER_ORDER: ScorerTier[] = ["instant", "fast", "slow"];

/** CascadeRanker 执行结果（内部） */
export interface CascadeResult {
  /** 排序后的候选列表 */
  entries: RankEntry[];
  /** 各 Scorer 执行摘要 */
  scorerDetails: ScorerDetail[];
  /** 性能指标 */
  timing: ClassifyTiming;
  /** 融合后的全量分数（供后续使用） */
  mergedScores: Map<number, MergedScore>;
}

export class CascadeRanker {
  private config: CascadeConfig;

  constructor(config?: Partial<CascadeConfig>) {
    this.config = {
      earlyExitThresholds: {
        instant:
          config?.earlyExitThresholds?.instant ??
          CLASSIFICATION_CONFIG.earlyExit.afterInstant,
        fast:
          config?.earlyExitThresholds?.fast ??
          CLASSIFICATION_CONFIG.earlyExit.afterFast,
      },
      actionThresholds: {
        autoClassify:
          config?.actionThresholds?.autoClassify ??
          CLASSIFICATION_CONFIG.action.autoClassify,
        suggest:
          config?.actionThresholds?.suggest ??
          CLASSIFICATION_CONFIG.action.suggest,
      },
      topK: config?.topK ?? CLASSIFICATION_CONFIG.ranker.topK,
    };
  }

  /**
   * 执行级联排序
   *
   * @param scorers - 所有注册的 Scorer
   * @param bookmark - 书签上下文
   * @param candidates - 候选文件夹
   * @param userCtx - 用户上下文
   * @returns 排序结果
   */
  async rank(
    scorers: Scorer[],
    bookmark: BookmarkContext,
    candidates: FolderContext[],
    userCtx: UserContext,
  ): Promise<CascadeResult> {
    const totalStart = Date.now();
    const accumulated = new Map<number, MergedScore>();
    const allDetails: ScorerDetail[] = [];
    const tierMs: Partial<Record<ScorerTier, number>> = {};
    let earlyExitTier: ScorerTier | undefined;

    // 按 tier 分组
    const tierGroups = groupByTier(scorers);

    // 构建权重 Map（用户覆盖 > 默认）
    const weights = buildWeightMap(scorers, userCtx);

    for (const tier of TIER_ORDER) {
      const tierScorers = tierGroups.get(tier);
      if (!tierScorers || tierScorers.length === 0) continue;

      const tierStart = Date.now();

      // 过滤掉不应执行的 Scorer
      const runnableScorers = tierScorers.filter((s) => {
        if (s.shouldRun && !s.shouldRun(bookmark, userCtx)) {
          allDetails.push(createSkippedDetail(s, tier, weights));
          return false;
        }
        return true;
      });

      if (runnableScorers.length === 0) {
        tierMs[tier] = Date.now() - tierStart;
        continue;
      }

      // 同 tier 内并行执行
      const results = await Promise.allSettled(
        runnableScorers.map(async (scorer) => {
          const start = Date.now();
          try {
            const scores = await scorer.score(
              bookmark,
              candidates,
              userCtx,
              accumulated.size > 0 ? accumulated : undefined,
            );
            return {
              name: scorer.name,
              scores,
              durationMs: Date.now() - start,
              error: undefined,
            };
          } catch (error) {
            logger.error(
              { scorer: scorer.name, error },
              "Scorer execution failed",
            );
            return {
              name: scorer.name,
              scores: new Map(),
              durationMs: Date.now() - start,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }),
      );

      // 收集本 tier 的结果
      const tierResults: Array<{ name: string; scores: Map<number, Score> }> =
        [];

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const scorer = runnableScorers[i];
        const weight = weights.get(scorer.name) ?? scorer.defaultWeight;

        if (result.status === "fulfilled") {
          const { name, scores, durationMs, error } = result.value;

          tierResults.push({ name, scores });

          allDetails.push({
            scorer: name,
            tier,
            weight,
            topFolderId: getTopFolderId(scores),
            topScore: getTopScore(scores),
            executed: true,
            skippedReason: error ? `Error: ${error}` : undefined,
            durationMs,
          });
        } else {
          allDetails.push({
            scorer: scorer.name,
            tier,
            weight,
            topFolderId: null,
            topScore: 0,
            executed: true,
            skippedReason: `Rejected: ${result.reason}`,
            durationMs: 0,
          });
        }
      }

      // 融合本 tier 的分数到 accumulated
      mergeScores(accumulated, tierResults, weights, candidates);

      tierMs[tier] = Date.now() - tierStart;

      // 检查是否可以提前终止
      if (tier !== "slow" && accumulated.size > 0) {
        const threshold = this.getEarlyExitThreshold(tier);
        const topResult = getTopK(accumulated, 1)[0];

        if (topResult && topResult.value >= threshold) {
          earlyExitTier = tier;
          logger.debug(
            {
              tier,
              topFolder: topResult.folderName,
              score: topResult.value,
              threshold,
            },
            "CascadeRanker: Early exit",
          );
          break;
        }
      }
    }

    // 归一化分数
    normalizeMergedScores(accumulated);

    // 构建最终排序结果
    const topK = getTopK(accumulated, this.config.topK);
    const decidedTier = earlyExitTier ?? "slow";

    const entries: RankEntry[] = topK.map((ms) => ({
      folderId: ms.folderId,
      folderName: ms.folderName,
      mergedScore: ms,
      decidedAtTier: decidedTier,
    }));

    return {
      entries,
      scorerDetails: allDetails,
      timing: {
        totalMs: Date.now() - totalStart,
        tierMs,
        earlyExitTier,
      },
      mergedScores: accumulated,
    };
  }

  private getEarlyExitThreshold(tier: ScorerTier): number {
    switch (tier) {
      case "instant":
        return this.config.earlyExitThresholds.instant;
      case "fast":
        return this.config.earlyExitThresholds.fast;
      default:
        return 1.0; // slow tier 不提前终止
    }
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

function groupByTier(scorers: Scorer[]): Map<ScorerTier, Scorer[]> {
  const groups = new Map<ScorerTier, Scorer[]>();
  for (const scorer of scorers) {
    const list = groups.get(scorer.tier) ?? [];
    list.push(scorer);
    groups.set(scorer.tier, list);
  }
  return groups;
}

function buildWeightMap(
  scorers: Scorer[],
  userCtx: UserContext,
): Map<string, number> {
  const weights = new Map<string, number>();
  for (const scorer of scorers) {
    // 用户覆盖优先
    const userWeight = userCtx.weights[scorer.name];
    weights.set(scorer.name, userWeight ?? scorer.defaultWeight);
  }
  return weights;
}

function createSkippedDetail(
  scorer: Scorer,
  tier: ScorerTier,
  weights: Map<string, number>,
): ScorerDetail {
  return {
    scorer: scorer.name,
    tier,
    weight: weights.get(scorer.name) ?? scorer.defaultWeight,
    topFolderId: null,
    topScore: 0,
    executed: false,
    skippedReason: "shouldRun returned false",
    durationMs: 0,
  };
}

function getTopFolderId(scores: Map<number, Score>): number | null {
  let topId: number | null = null;
  let topValue = -1;
  for (const [folderId, score] of scores) {
    if (score.value > topValue) {
      topValue = score.value;
      topId = folderId;
    }
  }
  return topId;
}

function getTopScore(scores: Map<number, Score>): number {
  let topValue = 0;
  for (const score of scores.values()) {
    if (score.value > topValue) topValue = score.value;
  }
  return topValue;
}
