/**
 * WeightOptimizer - 动态权重调优器
 *
 * 基于用户反馈自动调整规则权重，提升意图识别准确率
 *
 * 调优策略:
 * - 低准确率规则（<70%）：降权 -10
 * - 高准确率且高频规则（>95%，>50次）：提权 +5
 * - 样本不足（<20次）：保持不变
 *
 * @version 1.0.0
 * @since 2026-01-11
 */

import { createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================
// 类型定义
// ============================================

/**
 * 规则表现统计
 */
export interface RuleStats {
  /** 意图键 (type:subtype) */
  intentKey: string;
  /** 触发次数 */
  triggerCount: number;
  /** 正确次数（用户接受） */
  correctCount: number;
  /** 错误次数（用户纠正或放弃） */
  wrongCount: number;
  /** 准确率 */
  accuracy: number;
  /** 当前权重 */
  currentWeight: number;
}

/**
 * 权重更新建议
 */
export interface WeightUpdate {
  /** 意图键 */
  intentKey: string;
  /** 权重变化量 */
  delta: number;
  /** 新权重 */
  newWeight: number;
  /** 更新原因 */
  reason: string;
  /** 统计数据 */
  stats: RuleStats;
  /** 置信度 */
  confidence: number;
}

/**
 * 调优配置
 */
export interface WeightOptimizerConfig {
  /** 低准确率阈值 */
  lowAccuracyThreshold: number;
  /** 高准确率阈值 */
  highAccuracyThreshold: number;
  /** 最小样本数 */
  minSampleCount: number;
  /** 高频阈值 */
  highFrequencyThreshold: number;
  /** 低准确率降权幅度 */
  lowAccuracyDelta: number;
  /** 高准确率提权幅度 */
  highAccuracyDelta: number;
  /** 回溯天数 */
  lookbackDays: number;
  /** 最小权重 */
  minWeight: number;
  /** 最大权重 */
  maxWeight: number;
}

/**
 * 调优统计
 */
export interface OptimizerStats {
  /** 分析的规则数 */
  rulesAnalyzed: number;
  /** 生成的更新建议数 */
  updatesGenerated: number;
  /** 应用的更新数 */
  updatesApplied: number;
  /** 最后调优时间 */
  lastOptimizationAt: number | null;
}

// ============================================
// 默认配置
// ============================================

export const DEFAULT_WEIGHT_OPTIMIZER_CONFIG: WeightOptimizerConfig = {
  lowAccuracyThreshold: 0.7,
  highAccuracyThreshold: 0.95,
  minSampleCount: 20,
  highFrequencyThreshold: 50,
  lowAccuracyDelta: -10,
  highAccuracyDelta: 5,
  lookbackDays: 30,
  minWeight: 10,
  maxWeight: 100,
};

// ============================================
// WeightOptimizer 类
// ============================================

/**
 * 动态权重调优器
 *
 * @example
 * ```typescript
 * const optimizer = new WeightOptimizer();
 *
 * // 生成调优建议
 * const updates = await optimizer.generateWeightUpdates();
 *
 * // 审核后应用
 * for (const update of updates) {
 *   if (shouldApply(update)) {
 *     await optimizer.applyUpdate(update);
 *   }
 * }
 * ```
 */
export class WeightOptimizer {
  private config: WeightOptimizerConfig;
  private stats: OptimizerStats;

  constructor(config?: Partial<WeightOptimizerConfig>) {
    this.config = { ...DEFAULT_WEIGHT_OPTIMIZER_CONFIG, ...config };
    this.stats = {
      rulesAnalyzed: 0,
      updatesGenerated: 0,
      updatesApplied: 0,
      lastOptimizationAt: null,
    };

    logger.debug({ config: this.config }, "WeightOptimizer: Initialized");
  }

  /**
   * 计算规则表现统计
   */
  async calculateRuleStats(): Promise<Map<string, RuleStats>> {
    const supabase = await createServiceClient();

    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - this.config.lookbackDays);

    // 查询反馈数据
    const { data, error } = await supabase
      .from("ai_intent_feedback")
      .select("predicted_type, predicted_subtype, actual_behavior")
      .gte("created_at", lookbackDate.toISOString());

    if (error) {
      logger.error(
        { error: error.message },
        "WeightOptimizer: Failed to fetch feedback data",
      );
      return new Map();
    }

    // 统计每个意图的表现
    const stats = new Map<string, RuleStats>();

    for (const feedback of data ?? []) {
      const key = `${feedback.predicted_type}:${feedback.predicted_subtype ?? ""}`;

      if (!stats.has(key)) {
        stats.set(key, {
          intentKey: key,
          triggerCount: 0,
          correctCount: 0,
          wrongCount: 0,
          accuracy: 0,
          currentWeight: 50, // 默认权重
        });
      }

      const s = stats.get(key);
      if (!s) continue; // Should never happen since we just set it
      s.triggerCount++;

      if (feedback.actual_behavior === "accepted") {
        s.correctCount++;
      } else if (
        feedback.actual_behavior === "corrected" ||
        feedback.actual_behavior === "abandoned"
      ) {
        s.wrongCount++;
      }
    }

    // 计算准确率
    for (const s of stats.values()) {
      s.accuracy = s.triggerCount > 0 ? s.correctCount / s.triggerCount : 0;
    }

    this.stats.rulesAnalyzed = stats.size;
    return stats;
  }

  /**
   * 生成权重调优建议
   */
  async generateWeightUpdates(): Promise<WeightUpdate[]> {
    const ruleStats = await this.calculateRuleStats();
    const updates: WeightUpdate[] = [];

    // 尝试获取当前规则权重
    const currentWeights = await this.getCurrentWeights();

    for (const [intentKey, s] of ruleStats) {
      // 样本不足，跳过
      if (s.triggerCount < this.config.minSampleCount) {
        continue;
      }

      // 更新当前权重
      if (currentWeights.has(intentKey)) {
        s.currentWeight = currentWeights.get(intentKey) ?? s.currentWeight;
      }

      // 低准确率：降权
      if (s.accuracy < this.config.lowAccuracyThreshold) {
        const newWeight = Math.max(
          this.config.minWeight,
          s.currentWeight + this.config.lowAccuracyDelta,
        );

        if (newWeight !== s.currentWeight) {
          updates.push({
            intentKey,
            delta: this.config.lowAccuracyDelta,
            newWeight,
            reason: `low_accuracy (${(s.accuracy * 100).toFixed(1)}% < ${this.config.lowAccuracyThreshold * 100}%)`,
            stats: s,
            confidence: this.calculateUpdateConfidence(s, "low_accuracy"),
          });
        }
      }
      // 高准确率 + 高频：提权
      else if (
        s.accuracy > this.config.highAccuracyThreshold &&
        s.triggerCount > this.config.highFrequencyThreshold
      ) {
        const newWeight = Math.min(
          this.config.maxWeight,
          s.currentWeight + this.config.highAccuracyDelta,
        );

        if (newWeight !== s.currentWeight) {
          updates.push({
            intentKey,
            delta: this.config.highAccuracyDelta,
            newWeight,
            reason: `high_accuracy (${(s.accuracy * 100).toFixed(1)}% > ${this.config.highAccuracyThreshold * 100}%, ${s.triggerCount} triggers)`,
            stats: s,
            confidence: this.calculateUpdateConfidence(s, "high_accuracy"),
          });
        }
      }
    }

    // 按置信度排序
    updates.sort((a, b) => b.confidence - a.confidence);

    this.stats.updatesGenerated = updates.length;
    this.stats.lastOptimizationAt = Date.now();

    logger.info(
      {
        rulesAnalyzed: this.stats.rulesAnalyzed,
        updatesGenerated: updates.length,
      },
      "WeightOptimizer: Weight updates generated",
    );

    return updates;
  }

  /**
   * 应用权重更新
   */
  async applyUpdate(update: WeightUpdate): Promise<boolean> {
    try {
      // 存储权重更新到数据库
      const supabase = await createServiceClient();

      const [intentType, intentSubtype] = update.intentKey.split(":");

      // 记录权重变更历史
      const { error } = await supabase.from("ai_weight_history").insert({
        intent_type: intentType,
        intent_subtype: intentSubtype || null,
        old_weight: update.stats.currentWeight,
        new_weight: update.newWeight,
        delta: update.delta,
        reason: update.reason,
        confidence: update.confidence,
        trigger_count: update.stats.triggerCount,
        accuracy: update.stats.accuracy,
      });

      if (error) {
        // 表可能不存在，记录日志但不失败
        logger.warn(
          { error: error.message, intentKey: update.intentKey },
          "WeightOptimizer: Failed to log weight history (table may not exist)",
        );
      }

      this.stats.updatesApplied++;

      logger.info(
        {
          intentKey: update.intentKey,
          oldWeight: update.stats.currentWeight,
          newWeight: update.newWeight,
          delta: update.delta,
          reason: update.reason,
        },
        "WeightOptimizer: Weight update applied",
      );

      return true;
    } catch (err) {
      logger.error(
        {
          error: err instanceof Error ? err.message : String(err),
          intentKey: update.intentKey,
        },
        "WeightOptimizer: Failed to apply weight update",
      );
      return false;
    }
  }

  /**
   * 批量应用权重更新
   */
  async applyUpdates(
    updates: WeightUpdate[],
    options?: { minConfidence?: number },
  ): Promise<{ applied: number; skipped: number; failed: number }> {
    const minConfidence = options?.minConfidence ?? 0.7;
    let applied = 0;
    let skipped = 0;
    let failed = 0;

    for (const update of updates) {
      // 置信度过低，跳过
      if (update.confidence < minConfidence) {
        skipped++;
        continue;
      }

      const success = await this.applyUpdate(update);
      if (success) {
        applied++;
      } else {
        failed++;
      }
    }

    logger.info(
      { applied, skipped, failed },
      "WeightOptimizer: Batch updates completed",
    );

    return { applied, skipped, failed };
  }

  /**
   * 获取调优统计
   */
  getStats(): OptimizerStats {
    return { ...this.stats };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      rulesAnalyzed: 0,
      updatesGenerated: 0,
      updatesApplied: 0,
      lastOptimizationAt: null,
    };
  }

  /**
   * 获取优化报告
   */
  async getOptimizationReport(): Promise<{
    summary: {
      totalRules: number;
      lowAccuracyRules: number;
      highAccuracyRules: number;
      averageAccuracy: number;
    };
    recommendations: WeightUpdate[];
  }> {
    const ruleStats = await this.calculateRuleStats();
    const updates = await this.generateWeightUpdates();

    let totalAccuracy = 0;
    let lowAccuracyCount = 0;
    let highAccuracyCount = 0;

    for (const s of ruleStats.values()) {
      totalAccuracy += s.accuracy;
      if (s.accuracy < this.config.lowAccuracyThreshold) {
        lowAccuracyCount++;
      } else if (s.accuracy > this.config.highAccuracyThreshold) {
        highAccuracyCount++;
      }
    }

    return {
      summary: {
        totalRules: ruleStats.size,
        lowAccuracyRules: lowAccuracyCount,
        highAccuracyRules: highAccuracyCount,
        averageAccuracy:
          ruleStats.size > 0 ? totalAccuracy / ruleStats.size : 0,
      },
      recommendations: updates,
    };
  }

  // ============================================
  // 私有辅助方法
  // ============================================

  /**
   * 获取当前规则权重
   */
  private async getCurrentWeights(): Promise<Map<string, number>> {
    const weights = new Map<string, number>();

    try {
      const supabase = await createServiceClient();

      // 从模式建议表获取已批准规则的权重
      const { data, error } = await supabase
        .from("ai_intent_pattern_suggestions")
        .select("type, subtype, weight")
        .eq("status", "approved");

      if (error) {
        logger.warn(
          { error: error.message },
          "WeightOptimizer: Failed to fetch current weights",
        );
        return weights;
      }

      for (const row of data ?? []) {
        const key = `${row.type}:${row.subtype ?? ""}`;
        weights.set(key, row.weight);
      }
    } catch (err) {
      logger.warn(
        { error: err instanceof Error ? err.message : String(err) },
        "WeightOptimizer: Error fetching current weights",
      );
    }

    return weights;
  }

  /**
   * 计算更新置信度
   */
  private calculateUpdateConfidence(
    stats: RuleStats,
    updateType: "low_accuracy" | "high_accuracy",
  ): number {
    // 基础置信度
    let confidence = 0.5;

    // 样本量因子（样本越多，置信度越高）
    const sampleFactor = Math.min(stats.triggerCount / 100, 1);
    confidence += sampleFactor * 0.3;

    // 准确率偏离因子
    if (updateType === "low_accuracy") {
      // 准确率越低，降权置信度越高
      const deviation = this.config.lowAccuracyThreshold - stats.accuracy;
      confidence += Math.min(deviation, 0.3) * 0.3;
    } else {
      // 准确率越高，提权置信度越高
      const deviation = stats.accuracy - this.config.highAccuracyThreshold;
      confidence += Math.min(deviation, 0.05) * 0.3;
    }

    return Math.min(confidence, 1);
  }
}

// ============================================
// 单例管理
// ============================================

let weightOptimizerInstance: WeightOptimizer | null = null;

/**
 * 获取 WeightOptimizer 单例
 */
export function getWeightOptimizer(
  config?: Partial<WeightOptimizerConfig>,
): WeightOptimizer {
  if (!weightOptimizerInstance) {
    weightOptimizerInstance = new WeightOptimizer(config);
    logger.debug("WeightOptimizer: Singleton created");
  }
  return weightOptimizerInstance;
}

/**
 * 重置 WeightOptimizer 单例
 * @internal 仅用于测试
 */
export function resetWeightOptimizer(): void {
  weightOptimizerInstance = null;
  logger.debug("WeightOptimizer: Singleton reset");
}
