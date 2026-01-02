/**
import { logger } from "@/lib/logger";
 * Knowledge Studio - 转化分析服务
 * @module knowledge-studio/conversion
 * @description Phase 3 存根 - 转化漏斗分析与用户洞察
 * @version 0.1.0 (Stub)
 * @since 2025-01-02
 *
 * TODO Phase 3: 完整实现
 * - 漏斗指标计算
 * - ML 转化预测模型
 * - 实时仪表盘数据
 * - A/B 测试分析
 */

import type {
  IConversionAnalytics,
  ConversionFunnelMetrics,
  UserConversionInsight,
  UserTrialState,
  ConversionStage,
  ConversionTrigger,
} from "./types";

// ============================================================================
// 存根实现
// ============================================================================

/**
 * 转化分析服务（Phase 3 存根）
 *
 * @example
 * ```typescript
 * const analytics = new ConversionAnalyticsStub();
 *
 * // 获取转化漏斗指标
 * const metrics = await analytics.getFunnelMetrics(startDate, endDate);
 * console.log(`总体转化率: ${metrics.overallConversionRate}%`);
 *
 * // 获取高价值待转化用户
 * const prospects = await analytics.getHighValueProspects(10);
 * for (const user of prospects) {
 *   console.log(`用户 ${user.userId} 转化概率: ${user.conversionProbability}%`);
 * }
 * ```
 */
export class ConversionAnalyticsStub implements IConversionAnalytics {
  /**
   * 获取转化漏斗指标
   * @stub 返回空指标，Phase 3 实现真实计算
   */
  async getFunnelMetrics(
    startDate: Date,
    endDate: Date,
  ): Promise<ConversionFunnelMetrics> {
    logger.info(
      `[ConversionAnalytics] getFunnelMetrics(${startDate.toISOString()}, ${endDate.toISOString()}) - Phase 3 存根`,
    );

    const emptyStages: Record<ConversionStage, number> = {
      awareness: 0,
      activation: 0,
      engagement: 0,
      consideration: 0,
      conversion: 0,
      retention: 0,
    };

    const emptyTriggers: Record<ConversionTrigger, number> = {
      quota_exhausted: 0,
      feature_locked: 0,
      trial_ending: 0,
      trial_expired: 0,
      manual_upgrade: 0,
      promo_offer: 0,
    };

    return {
      period: { start: startDate, end: endDate },
      stageCounts: emptyStages,
      stageConversionRates: emptyStages,
      overallConversionRate: 0,
      averageConversionDays: 0,
      triggerDistribution: emptyTriggers,
    };
  }

  /**
   * 获取用户转化洞察
   * @stub 返回默认洞察，Phase 3 实现 ML 预测
   */
  async getUserInsight(userId: string): Promise<UserConversionInsight> {
    logger.info(
      `[ConversionAnalytics] getUserInsight(${userId}) - Phase 3 存根`,
    );

    return {
      userId,
      conversionProbability: 0,
      recommendedTrigger: "feature_locked",
      recommendedPromptType: "modal",
      valueScore: 0,
      churnRisk: "medium",
    };
  }

  /**
   * 获取即将过期的试用用户
   * @stub 返回空数组，Phase 3 实现数据库查询
   */
  async getExpiringTrials(withinDays: number): Promise<UserTrialState[]> {
    logger.info(
      `[ConversionAnalytics] getExpiringTrials(${withinDays}) - Phase 3 存根`,
    );
    return [];
  }

  /**
   * 获取高价值待转化用户
   * @stub 返回空数组，Phase 3 实现排序查询
   */
  async getHighValueProspects(limit: number): Promise<UserConversionInsight[]> {
    logger.info(
      `[ConversionAnalytics] getHighValueProspects(${limit}) - Phase 3 存根`,
    );
    return [];
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建转化分析服务实例
 * @stub Phase 3 实现完整服务
 */
export function createConversionAnalytics(): IConversionAnalytics {
  return new ConversionAnalyticsStub();
}

// ============================================================================
// 转化概率计算（Phase 3 预留算法骨架）
// ============================================================================

/**
 * 转化概率计算因素
 */
export interface ConversionProbabilityFactors {
  /** 试用剩余天数 */
  remainingDays: number;
  /** 已使用生成次数 */
  generationsUsed: number;
  /** 已体验 Pro 功能数 */
  featuresExperiencedCount: number;
  /** 活跃天数 */
  activeDays: number;
  /** 最后活跃距今天数 */
  daysSinceLastActive: number;
  /** 历史升级提示次数 */
  promptsShown: number;
  /** 历史提示点击率 */
  promptClickRate: number;
}

/**
 * 计算转化概率（Phase 3 预留）
 * @stub 返回 0，Phase 3 实现 ML 模型
 *
 * TODO Phase 3: 实现基于以下因素的预测模型
 * - 功能使用深度
 * - 活跃频率
 * - 提示响应行为
 * - 用户画像
 * - 历史转化数据
 */
export function calculateConversionProbability(
  factors: ConversionProbabilityFactors,
): number {
  logger.info(
    "[ConversionAnalytics] calculateConversionProbability - Phase 3 存根",
  );

  // Phase 3 实现：基于机器学习模型的转化预测
  // 当前返回简单的启发式计算作为占位
  const {
    remainingDays,
    generationsUsed,
    featuresExperiencedCount,
    activeDays,
    daysSinceLastActive,
  } = factors;

  // 简单启发式（仅用于演示，Phase 3 替换为 ML 模型）
  let score = 0;

  // 使用次数越多，转化概率越高
  score += Math.min(generationsUsed * 10, 30);

  // 体验功能越多，转化概率越高
  score += Math.min(featuresExperiencedCount * 15, 30);

  // 活跃天数越多，转化概率越高
  score += Math.min(activeDays * 5, 20);

  // 临近过期，转化概率提升
  if (remainingDays <= 2 && remainingDays > 0) {
    score += 10;
  }

  // 最近不活跃，转化概率降低
  if (daysSinceLastActive > 3) {
    score -= 20;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * 评估流失风险（Phase 3 预留）
 * @stub 返回 medium，Phase 3 实现完整评估
 */
export function evaluateChurnRisk(
  factors: Partial<ConversionProbabilityFactors>,
): "low" | "medium" | "high" {
  logger.info("[ConversionAnalytics] evaluateChurnRisk - Phase 3 存根");

  const { daysSinceLastActive = 0, generationsUsed = 0 } = factors;

  // 简单启发式
  if (daysSinceLastActive > 5) return "high";
  if (daysSinceLastActive > 2 && generationsUsed < 2) return "high";
  if (generationsUsed >= 3) return "low";

  return "medium";
}
