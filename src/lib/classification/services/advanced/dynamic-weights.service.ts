/**
 * V4.0 动态权重调整服务
 *
 * 核心概念：基于用户场景和反馈自动调整匹配器权重，实现个性化适配。
 *
 * 工作原理：
 * 1. 检测用户场景（cold_start / learning / mature）
 * 2. 从数据库加载场景对应的基准权重
 * 3. 基于用户反馈进行微调
 * 4. 支持 A/B 测试对比不同配置
 *
 * V4.0 新增：
 * - 场景化权重配置（从数据库加载）
 * - A/B 测试支持
 * - 场景阈值自动应用
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { CLASSIFICATION_WEIGHTS } from "@/lib/classification/constants/limits";
import { logger } from "@/lib/logger";
import {
  UserScenarioDetectorService,
  type UserScenario,
  type ScenarioDetectionResult,
} from "./user-scenario-detector.service";

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
 * 阈值配置
 */
export interface ThresholdConfig {
  /** 高置信度阈值 */
  highConfidence: number;
  /** 中置信度阈值 */
  mediumConfidence: number;
  /** 自动创建阈值 */
  autoCreate: number;
  /** k-NN 直接锁定阈值 */
  knnDirect: number;
}

/**
 * 权重调整结果
 */
export interface WeightAdjustmentResult {
  /** 调整后的权重 */
  weights: MatcherWeights;

  /** 阈值配置 */
  thresholds: ThresholdConfig;

  /** 是否有足够数据进行调整 */
  dataSufficient: boolean;

  /** 样本数量 */
  sampleSize: number;

  /** 各匹配器准确率 */
  accuracy: Partial<Record<keyof MatcherWeights, number>>;

  /** 上次调整时间 */
  lastAdjustedAt: Date | null;

  /** V4.0: 用户场景 */
  scenario: UserScenario;

  /** V4.0: 场景检测结果 */
  scenarioResult: ScenarioDetectionResult;

  /** V4.0: A/B 测试变体 */
  abTestVariant: string | null;

  /** V4.0: 权重来源 (scenario | feedback | default) */
  source: "scenario" | "feedback" | "default";
}

/**
 * 数据库场景配置
 */
interface ScenarioWeightConfig {
  scenario: string;
  weights: Record<string, number>;
  thresholds: Record<string, number>;
  ab_test_variant: string | null;
  is_active: boolean;
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
  /** 最小样本数（低于此值不进行反馈调整） */
  minSampleSize: number;
  /** 权重调整幅度 */
  adjustmentRate: number;
  /** 最小权重 */
  minWeight: number;
  /** 最大权重 */
  maxWeight: number;
  /** 缓存时间（毫秒） */
  cacheTimeMs: number;
  /** 场景配置缓存时间（毫秒） */
  scenarioConfigCacheTimeMs: number;
  /** 是否启用 A/B 测试 */
  abTestEnabled: boolean;
}

const DEFAULT_CONFIG: DynamicWeightsConfig = {
  minSampleSize: 20,
  adjustmentRate: 0.1,
  minWeight: 0.02,
  maxWeight: 0.5,
  cacheTimeMs: 10 * 60 * 1000, // 10 分钟
  scenarioConfigCacheTimeMs: 30 * 60 * 1000, // 30 分钟
  abTestEnabled: false,
};

/**
 * 默认权重（兜底配置）
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

/**
 * 默认阈值
 */
const DEFAULT_THRESHOLDS: ThresholdConfig = {
  highConfidence: 80,
  mediumConfidence: 60,
  autoCreate: 50,
  knnDirect: 0.85,
};

// ============================================================================
// 缓存
// ============================================================================

interface CacheEntry {
  result: WeightAdjustmentResult;
  cachedAt: number;
}

interface ScenarioConfigCache {
  configs: Map<UserScenario, ScenarioWeightConfig>;
  cachedAt: number;
}

const weightsCache = new Map<string, CacheEntry>();
let scenarioConfigCache: ScenarioConfigCache | null = null;

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
  private scenarioDetector: UserScenarioDetectorService;

  constructor(
    supabase: SupabaseClient<Database>,
    config?: Partial<DynamicWeightsConfig>,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.supabase = supabase as SupabaseClient<any>;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.scenarioDetector = new UserScenarioDetectorService(supabase);
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
      // 1. 检测用户场景
      const scenarioResult = await this.scenarioDetector.detectScenario(userId);

      // 2. 加载场景配置
      const scenarioConfig = await this.loadScenarioConfig(
        scenarioResult.scenario,
      );

      // 3. 获取 A/B 测试变体（如果启用）
      const abTestVariant = this.config.abTestEnabled
        ? await this.getABTestVariant(userId, "weights_v4")
        : null;

      // 4. 获取用户反馈数据
      const performance = await this.getMatcherPerformance(userId);
      const sampleSize = this.getTotalSamples(performance);

      // 5. 计算最终权重
      let weights: MatcherWeights;
      let thresholds: ThresholdConfig;
      let source: "scenario" | "feedback" | "default";

      if (scenarioConfig) {
        // 使用场景配置
        weights = this.parseWeights(scenarioConfig.weights);
        thresholds = this.parseThresholds(scenarioConfig.thresholds);
        source = "scenario";

        // 如果有足够的反馈数据，进行微调
        if (sampleSize >= this.config.minSampleSize) {
          weights = this.applyFeedbackAdjustments(weights, performance);
          source = "feedback";
        }
      } else {
        // 使用默认配置
        weights = { ...DEFAULT_WEIGHTS };
        thresholds = { ...DEFAULT_THRESHOLDS };
        source = "default";

        // 如果有足够的反馈数据，进行调整
        if (sampleSize >= this.config.minSampleSize) {
          weights = this.calculateAdjustedWeights(performance);
          source = "feedback";
        }
      }

      const accuracy = this.buildAccuracyMap(performance);

      const result: WeightAdjustmentResult = {
        weights,
        thresholds,
        dataSufficient: sampleSize >= this.config.minSampleSize,
        sampleSize,
        accuracy,
        lastAdjustedAt: sampleSize > 0 ? new Date() : null,
        scenario: scenarioResult.scenario,
        scenarioResult,
        abTestVariant,
        source,
      };

      this.cacheResult(userId, result);

      logger.info(
        {
          userId,
          scenario: result.scenario,
          sampleSize,
          source,
          abTestVariant,
        },
        "Dynamic weights calculated",
      );

      return result;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Failed to calculate dynamic weights",
      );

      // 出错时返回默认配置
      return this.getDefaultResult();
    }
  }

  /**
   * 加载场景配置
   */
  private async loadScenarioConfig(
    scenario: UserScenario,
  ): Promise<ScenarioWeightConfig | null> {
    // 检查缓存
    if (
      scenarioConfigCache &&
      Date.now() - scenarioConfigCache.cachedAt <
        this.config.scenarioConfigCacheTimeMs
    ) {
      return scenarioConfigCache.configs.get(scenario) || null;
    }

    try {
      // 从数据库加载所有场景配置
      const { data, error } = await this.supabase
        .from("scenario_weight_configs")
        .select("scenario, weights, thresholds, ab_test_variant, is_active")
        .eq("is_active", true);

      if (error) {
        logger.warn(
          { error: error.message },
          "Failed to load scenario configs, using defaults",
        );
        return null;
      }

      // 缓存配置
      const configs = new Map<UserScenario, ScenarioWeightConfig>();
      for (const config of data || []) {
        configs.set(config.scenario as UserScenario, config);
      }

      scenarioConfigCache = {
        configs,
        cachedAt: Date.now(),
      };

      return configs.get(scenario) || null;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Error loading scenario configs",
      );
      return null;
    }
  }

  /**
   * 获取 A/B 测试变体
   */
  private async getABTestVariant(
    userId: string,
    testName: string,
  ): Promise<string | null> {
    try {
      // 检查是否已有分配
      const { data: existing } = await this.supabase
        .from("ab_test_assignments")
        .select("variant")
        .eq("user_id", userId)
        .eq("test_name", testName)
        .single();

      if (existing) {
        return existing.variant;
      }

      // 随机分配（50/50）
      const variant = Math.random() < 0.5 ? "control" : "treatment";

      // 保存分配
      await this.supabase.from("ab_test_assignments").insert({
        user_id: userId,
        test_name: testName,
        variant,
        expires_at: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(), // 30 天后过期
      });

      return variant;
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        "Failed to get AB test variant",
      );
      return null;
    }
  }

  /**
   * 解析权重配置
   */
  private parseWeights(weights: Record<string, number>): MatcherWeights {
    return {
      vector: weights.vector ?? DEFAULT_WEIGHTS.vector,
      history: weights.history ?? DEFAULT_WEIGHTS.history,
      ai: weights.ai ?? DEFAULT_WEIGHTS.ai,
      universal: weights.universal ?? DEFAULT_WEIGHTS.universal,
      tag: weights.tag ?? DEFAULT_WEIGHTS.tag,
      fingerprint: weights.fingerprint ?? DEFAULT_WEIGHTS.fingerprint,
      knnDirect: weights.knnDirect ?? DEFAULT_WEIGHTS.knnDirect,
      queryExpansion: weights.queryExpansion ?? DEFAULT_WEIGHTS.queryExpansion,
    };
  }

  /**
   * 解析阈值配置
   */
  private parseThresholds(thresholds: Record<string, number>): ThresholdConfig {
    return {
      highConfidence:
        thresholds.highConfidence ?? DEFAULT_THRESHOLDS.highConfidence,
      mediumConfidence:
        thresholds.mediumConfidence ?? DEFAULT_THRESHOLDS.mediumConfidence,
      autoCreate: thresholds.autoCreate ?? DEFAULT_THRESHOLDS.autoCreate,
      knnDirect: thresholds.knnDirect ?? DEFAULT_THRESHOLDS.knnDirect,
    };
  }

  /**
   * 应用反馈调整
   */
  private applyFeedbackAdjustments(
    baseWeights: MatcherWeights,
    performance: MatcherPerformance[],
  ): MatcherWeights {
    const weights = { ...baseWeights };

    // 计算总准确率（用于归一化）
    const totalAccuracy = performance.reduce((sum, p) => sum + p.accuracy, 0);
    if (totalAccuracy === 0 || performance.length === 0) {
      return weights;
    }

    // 准确率映射
    const accuracyMap = new Map<string, number>();
    for (const p of performance) {
      accuracyMap.set(p.matcher, p.accuracy);
    }

    // 根据准确率微调权重（调整幅度较小）
    const adjustableMatchers: (keyof MatcherWeights)[] = [
      "vector",
      "history",
      "ai",
      "universal",
      "tag",
      "fingerprint",
      "queryExpansion",
    ];

    const avgAccuracy = totalAccuracy / performance.length;

    for (const matcher of adjustableMatchers) {
      const accuracy = accuracyMap.get(matcher);
      if (accuracy !== undefined) {
        // 微调幅度：基于与平均准确率的偏差
        const adjustment =
          (accuracy - avgAccuracy) * (this.config.adjustmentRate * 0.5); // 减半调整幅度

        weights[matcher] = Math.max(
          this.config.minWeight,
          Math.min(this.config.maxWeight, weights[matcher] + adjustment),
        );
      }
    }

    // 归一化权重
    return this.normalizeWeights(weights);
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
   * 计算调整后的权重（纯反馈驱动）
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
        const avgAccuracy = totalAccuracy / performance.length;
        const adjustment =
          (accuracy - avgAccuracy) * this.config.adjustmentRate;

        weights[matcher] = Math.max(
          this.config.minWeight,
          Math.min(this.config.maxWeight, weights[matcher] + adjustment),
        );
      }
    }

    return this.normalizeWeights(weights);
  }

  /**
   * 归一化权重
   */
  private normalizeWeights(weights: MatcherWeights): MatcherWeights {
    const adjustableMatchers: (keyof MatcherWeights)[] = [
      "vector",
      "history",
      "ai",
      "universal",
      "tag",
      "fingerprint",
      "queryExpansion",
    ];

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
   *
   * V4.2.5 修复：Math.max(...[]) 返回 -Infinity，需要显式处理空数组
   */
  private getTotalSamples(performance: MatcherPerformance[]): number {
    if (performance.length === 0) return 0;
    const predictions = performance.map((p) => p.totalPredictions);
    // V4.2.5: 显式处理空数组，避免 Math.max() 返回 -Infinity
    return predictions.length > 0 ? Math.max(...predictions) : 0;
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
   * 获取默认结果
   */
  private getDefaultResult(): WeightAdjustmentResult {
    return {
      weights: { ...DEFAULT_WEIGHTS },
      thresholds: { ...DEFAULT_THRESHOLDS },
      dataSufficient: false,
      sampleSize: 0,
      accuracy: {},
      lastAdjustedAt: null,
      scenario: "cold_start",
      scenarioResult: {
        scenario: "cold_start",
        stats: {
          bookmarkCount: 0,
          folderCount: 0,
          feedbackCount: 0,
          feedbackAcceptanceRate: 0,
          accountAgeDays: 0,
          recentBookmarkCount: 0,
          foldersWithProfile: 0,
        },
        reason: "使用默认配置",
        detectedAt: new Date(),
        confidence: 0,
      },
      abTestVariant: null,
      source: "default",
    };
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
    UserScenarioDetectorService.clearCache(userId);
  }

  /**
   * 清除所有缓存
   */
  static clearAllCache(): void {
    weightsCache.clear();
    scenarioConfigCache = null;
    UserScenarioDetectorService.clearAllCache();
  }

  /**
   * 记录用户反馈（更新缓存）
   */
  async recordFeedback(userId: string): Promise<void> {
    // 清除缓存，下次获取时重新计算
    DynamicWeightsService.clearCache(userId);
  }

  /**
   * 获取场景检测器实例
   */
  getScenarioDetector(): UserScenarioDetectorService {
    return this.scenarioDetector;
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
