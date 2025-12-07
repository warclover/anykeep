/**
 * V3.0 动态权重调整服务
 *
 * 核心概念：基于用户反馈自动调整匹配器权重，实现个性化适配。
 *
 * 工作原理：
 * 1. 收集用户对分类结果的反馈（接受/拒绝/修改）
 * 2. 分析各匹配器在成功和失败案例中的表现
 * 3. 动态调整权重，提高准确率高的匹配器权重
 * 4. 提供个性化的匹配策略
 *
 * 调整策略：
 * - 用户接受 → 增加相关匹配器权重
 * - 用户拒绝 → 降低相关匹配器权重
 * - 用户修改 → 分析正确答案，调整权重
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { CLASSIFICATION_WEIGHTS } from "../../constants/limits";
import { logger } from "@/lib/logger";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 匹配器权重配置
 */
export interface MatcherWeights {
  /** 向量匹配权重 */
  vector: number;
  /** 历史匹配权重 */
  history: number;
  /** AI 推荐权重 */
  ai: number;
  /** 通用分类权重 */
  universal: number;
  /** 标签匹配权重 */
  tag: number;
  /** 指纹匹配权重 */
  fingerprint: number;
  /** k-NN 直接锁定权重 */
  knnDirect: number;
  /** Query Expansion 权重 */
  queryExpansion: number;
}

/**
 * 权重调整结果
 */
export interface WeightAdjustmentResult {
  /** 调整后的权重 */
  weights: MatcherWeights;
  /** 是否有足够数据进行调整 */
  dataSufficient: boolean;
  /** 样本数量 */
  sampleSize: number;
  /** 各匹配器准确率 */
  accuracy: Partial<Record<keyof MatcherWeights, number>>;
  /** 上次调整时间 */
  lastAdjustedAt: Date | null;
}

/**
 * 匹配器性能统计
 */
interface MatcherPerformance {
  matcher: string;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
}

/**
 * 服务配置
 */
export interface DynamicWeightsConfig {
  /** 最小样本数（低于此值使用默认权重） */
  minSampleSize: number;
  /** 权重调整幅度 */
  adjustmentRate: number;
  /** 最小权重 */
  minWeight: number;
  /** 最大权重 */
  maxWeight: number;
  /** 缓存时间（毫秒） */
  cacheTimeMs: number;
}

const DEFAULT_CONFIG: DynamicWeightsConfig = {
  minSampleSize: 20,
  adjustmentRate: 0.1,
  minWeight: 0.05,
  maxWeight: 0.5,
  cacheTimeMs: 10 * 60 * 1000, // 10 分钟
};

/**
 * 默认权重
 */
const DEFAULT_WEIGHTS: MatcherWeights = {
  vector: CLASSIFICATION_WEIGHTS.VECTOR,
  history: CLASSIFICATION_WEIGHTS.HISTORY,
  ai: CLASSIFICATION_WEIGHTS.AI,
  universal: 0.2,
  tag: 0.3,
  fingerprint: 0.25,
  knnDirect: 0.0, // k-NN 直接锁定不参与加权，单独处理
  queryExpansion: 0.25,
};

// ============================================================================
// 缓存
// ============================================================================

interface CacheEntry {
  result: WeightAdjustmentResult;
  cachedAt: number;
}

const weightsCache = new Map<string, CacheEntry>();

// ============================================================================
// 服务实现
// ============================================================================

/**
 * 动态权重调整服务
 */
export class DynamicWeightsService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private supabase: SupabaseClient<any>;
  private config: DynamicWeightsConfig;

  constructor(
    supabase: SupabaseClient<Database>,
    config?: Partial<DynamicWeightsConfig>,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.supabase = supabase as SupabaseClient<any>;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 获取用户的动态权重
   */
  async getWeights(userId: string): Promise<WeightAdjustmentResult> {
    // 检查缓存
    const cached = weightsCache.get(userId);
    if (cached && Date.now() - cached.cachedAt < this.config.cacheTimeMs) {
      return cached.result;
    }

    try {
      // 获取用户反馈数据
      const performance = await this.getMatcherPerformance(userId);

      if (
        performance.length === 0 ||
        this.getTotalSamples(performance) < this.config.minSampleSize
      ) {
        // 数据不足，返回默认权重
        const result: WeightAdjustmentResult = {
          weights: { ...DEFAULT_WEIGHTS },
          dataSufficient: false,
          sampleSize: this.getTotalSamples(performance),
          accuracy: {},
          lastAdjustedAt: null,
        };

        this.cacheResult(userId, result);
        return result;
      }

      // 计算调整后的权重
      const adjustedWeights = this.calculateAdjustedWeights(performance);
      const accuracy = this.buildAccuracyMap(performance);

      const result: WeightAdjustmentResult = {
        weights: adjustedWeights,
        dataSufficient: true,
        sampleSize: this.getTotalSamples(performance),
        accuracy,
        lastAdjustedAt: new Date(),
      };

      this.cacheResult(userId, result);

      logger.info(
        {
          userId,
          sampleSize: result.sampleSize,
          adjustedWeights,
        },
        "Dynamic weights calculated",
      );

      return result;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Failed to calculate dynamic weights",
      );

      // 出错时返回默认权重
      return {
        weights: { ...DEFAULT_WEIGHTS },
        dataSufficient: false,
        sampleSize: 0,
        accuracy: {},
        lastAdjustedAt: null,
      };
    }
  }

  /**
   * 获取各匹配器的性能统计
   */
  private async getMatcherPerformance(
    userId: string,
  ): Promise<MatcherPerformance[]> {
    // 查询分类决策记录
    const { data, error } = await this.supabase
      .from("classification_decisions")
      .select(
        "matcher_scores, user_action, final_folder_id, user_chosen_folder_id",
      )
      .eq("user_id", userId)
      .not("user_action", "is", null)
      .order("created_at", { ascending: false })
      .limit(200); // 最近 200 条

    if (error || !data) {
      return [];
    }

    // 统计各匹配器的表现
    const matcherStats = new Map<string, { total: number; correct: number }>();

    for (const decision of data) {
      const scores = decision.matcher_scores as Record<
        string,
        { score: number; topFolderId?: number }
      > | null;
      if (!scores) continue;

      const isAccepted = decision.user_action === "accepted";
      const _wasCorrect =
        isAccepted ||
        decision.final_folder_id === decision.user_chosen_folder_id;

      for (const [matcher, matcherData] of Object.entries(scores)) {
        if (typeof matcherData !== "object" || !matcherData) continue;

        const stats = matcherStats.get(matcher) || { total: 0, correct: 0 };
        stats.total += 1;

        // 判断该匹配器是否预测正确
        const topFolderId = matcherData.topFolderId;
        const targetFolderId = isAccepted
          ? decision.final_folder_id
          : decision.user_chosen_folder_id;

        if (topFolderId === targetFolderId) {
          stats.correct += 1;
        }

        matcherStats.set(matcher, stats);
      }
    }

    // 转换为数组
    const results: MatcherPerformance[] = [];
    for (const [matcher, stats] of matcherStats) {
      results.push({
        matcher,
        totalPredictions: stats.total,
        correctPredictions: stats.correct,
        accuracy: stats.total > 0 ? stats.correct / stats.total : 0,
      });
    }

    return results;
  }

  /**
   * 计算调整后的权重
   */
  private calculateAdjustedWeights(
    performance: MatcherPerformance[],
  ): MatcherWeights {
    const weights = { ...DEFAULT_WEIGHTS };

    // 计算总准确率（用于归一化）
    const totalAccuracy = performance.reduce((sum, p) => sum + p.accuracy, 0);
    if (totalAccuracy === 0) {
      return weights;
    }

    // 准确率映射到匹配器
    const accuracyMap = new Map<string, number>();
    for (const p of performance) {
      accuracyMap.set(p.matcher, p.accuracy);
    }

    // 调整权重
    const adjustableMatchers: (keyof MatcherWeights)[] = [
      "vector",
      "history",
      "ai",
      "universal",
      "tag",
      "fingerprint",
      "queryExpansion",
    ];

    for (const matcher of adjustableMatchers) {
      const accuracy = accuracyMap.get(matcher);
      if (accuracy !== undefined) {
        // 根据准确率调整权重
        // 准确率高于平均值 → 增加权重
        // 准确率低于平均值 → 降低权重
        const avgAccuracy = totalAccuracy / performance.length;
        const adjustment =
          (accuracy - avgAccuracy) * this.config.adjustmentRate;

        weights[matcher] = Math.max(
          this.config.minWeight,
          Math.min(this.config.maxWeight, weights[matcher] + adjustment),
        );
      }
    }

    // 归一化权重（确保总和为 1）
    const totalWeight = adjustableMatchers.reduce(
      (sum, m) => sum + weights[m],
      0,
    );
    if (totalWeight > 0) {
      for (const matcher of adjustableMatchers) {
        weights[matcher] = weights[matcher] / totalWeight;
      }
    }

    return weights;
  }

  /**
   * 获取总样本数
   */
  private getTotalSamples(performance: MatcherPerformance[]): number {
    if (performance.length === 0) return 0;
    return Math.max(...performance.map((p) => p.totalPredictions));
  }

  /**
   * 构建准确率映射
   */
  private buildAccuracyMap(
    performance: MatcherPerformance[],
  ): Partial<Record<keyof MatcherWeights, number>> {
    const map: Partial<Record<keyof MatcherWeights, number>> = {};

    for (const p of performance) {
      const key = p.matcher as keyof MatcherWeights;
      map[key] = Math.round(p.accuracy * 100);
    }

    return map;
  }

  /**
   * 缓存结果
   */
  private cacheResult(userId: string, result: WeightAdjustmentResult): void {
    weightsCache.set(userId, {
      result,
      cachedAt: Date.now(),
    });
  }

  /**
   * 清除用户缓存
   */
  static clearCache(userId: string): void {
    weightsCache.delete(userId);
  }

  /**
   * 清除所有缓存
   */
  static clearAllCache(): void {
    weightsCache.clear();
  }

  /**
   * 记录用户反馈（更新缓存）
   */
  async recordFeedback(userId: string): Promise<void> {
    // 清除缓存，下次获取时重新计算
    DynamicWeightsService.clearCache(userId);
  }
}

/**
 * 工厂函数
 */
export function createDynamicWeightsService(
  supabase: SupabaseClient<Database>,
  config?: Partial<DynamicWeightsConfig>,
): DynamicWeightsService {
  return new DynamicWeightsService(supabase, config);
}
