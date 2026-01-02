/**
 * Knowledge Studio - 转化分析服务
 * @module knowledge-studio/conversion
 * @description P4 实现 - 转化漏斗分析与用户洞察
 * @version 1.0.0
 * @since 2026-01-02
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  IConversionAnalytics,
  ConversionFunnelMetrics,
  UserConversionInsight,
  UserTrialState,
  ConversionStage,
  ConversionTrigger,
  UpgradePromptType,
} from "./types";

// ============================================================================
// 数据库行类型
// ============================================================================

interface TrialStateRow {
  id: string;
  user_id: string;
  status: "active" | "expired" | "converted" | "cancelled";
  started_at: string;
  expires_at: string;
  generations_used: number;
  features_experienced: string[];
  conversion_stage: ConversionStage;
  last_active_at: string;
  converted_at: string | null;
  metadata: Record<string, unknown>;
}

// ============================================================================
// 类型转换工具
// ============================================================================

function rowToTrialState(row: TrialStateRow): UserTrialState {
  return {
    userId: row.user_id,
    status: row.status,
    startedAt: new Date(row.started_at),
    expiresAt: new Date(row.expires_at),
    generationsUsed: row.generations_used,
    featuresExperienced: row.features_experienced ?? [],
    conversionStage: row.conversion_stage,
    lastActiveAt: new Date(row.last_active_at),
    metadata: row.metadata,
  };
}

// ============================================================================
// 转化分析服务实现
// ============================================================================

/**
 * 转化分析服务
 *
 * @example
 * ```typescript
 * const analytics = new ConversionAnalytics();
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
export class ConversionAnalytics implements IConversionAnalytics {
  /**
   * 获取转化漏斗指标
   */
  async getFunnelMetrics(
    startDate: Date,
    endDate: Date,
  ): Promise<ConversionFunnelMetrics> {
    const supabase = await createClient();

    // 调用 RPC 函数获取指标 (RPC 尚未在生成的类型中)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc(
      "get_conversion_funnel_metrics",
      {
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
      },
    );

    if (error) {
      // 如果 RPC 不存在，返回空指标
      if (error.code === "42883") {
        logger.warn(
          "get_conversion_funnel_metrics RPC not found, returning empty metrics",
        );
        return this.getEmptyMetrics(startDate, endDate);
      }
      logger.error({ error: error.message }, "Failed to get funnel metrics");
      return this.getEmptyMetrics(startDate, endDate);
    }

    // 解析 RPC 返回的 JSONB 数据
    const metrics = data as {
      period: { start: string; end: string };
      stageCounts: Record<ConversionStage, number>;
      triggerDistribution: Record<ConversionTrigger, number>;
      totalTrials: number;
      totalConverted: number;
      overallConversionRate: number;
      averageConversionDays: number;
    };

    // 计算各阶段转化率
    const stageConversionRates = this.calculateStageConversionRates(
      metrics.stageCounts,
      metrics.totalTrials,
    );

    logger.info(
      { startDate, endDate, totalTrials: metrics.totalTrials },
      "Funnel metrics retrieved",
    );

    return {
      period: { start: startDate, end: endDate },
      stageCounts: metrics.stageCounts || this.getEmptyStageCounts(),
      stageConversionRates,
      overallConversionRate: metrics.overallConversionRate || 0,
      averageConversionDays: metrics.averageConversionDays || 0,
      triggerDistribution:
        metrics.triggerDistribution || this.getEmptyTriggerCounts(),
    };
  }

  /**
   * 获取用户转化洞察
   */
  async getUserInsight(userId: string): Promise<UserConversionInsight> {
    const supabase = await createClient();

    // 获取用户试用状态 (表尚未在生成的类型中)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: trialData, error: trialError } = await (supabase as any)
      .from("ks_user_trial_states")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (trialError || !trialData) {
      logger.warn({ userId }, "Trial state not found for user insight");
      return this.getDefaultInsight(userId);
    }

    const trial = trialData as TrialStateRow;

    // 获取用户提示统计
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: promptStats } = await (supabase as any)
      .from("ks_upgrade_prompts")
      .select("prompt_type, response")
      .eq("user_id", userId);

    // 计算提示点击率
    let promptsShown = 0;
    let promptsClicked = 0;
    if (promptStats) {
      promptsShown = (
        promptStats as { prompt_type: string; response: string | null }[]
      ).length;
      promptsClicked = (
        promptStats as { prompt_type: string; response: string | null }[]
      ).filter(
        (p) => p.response === "clicked" || p.response === "converted",
      ).length;
    }

    // 计算活跃天数
    const startedAt = new Date(trial.started_at);
    const lastActiveAt = new Date(trial.last_active_at);
    const now = new Date();
    const activeDays = Math.ceil(
      (lastActiveAt.getTime() - startedAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    const daysSinceLastActive = Math.ceil(
      (now.getTime() - lastActiveAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    const remainingDays = Math.ceil(
      (new Date(trial.expires_at).getTime() - now.getTime()) /
        (1000 * 60 * 60 * 24),
    );

    // 计算转化概率
    const factors: ConversionProbabilityFactors = {
      remainingDays: Math.max(0, remainingDays),
      generationsUsed: trial.generations_used,
      featuresExperiencedCount: trial.features_experienced?.length || 0,
      activeDays: Math.max(1, activeDays),
      daysSinceLastActive,
      promptsShown,
      promptClickRate: promptsShown > 0 ? promptsClicked / promptsShown : 0,
    };

    const conversionProbability = calculateConversionProbability(factors);
    const churnRisk = evaluateChurnRisk(factors);

    // 推荐触发器和提示类型
    const { trigger, promptType } = this.recommendTriggerAndPrompt(
      trial,
      factors,
      churnRisk,
    );

    // 计算价值评分
    const valueScore = this.calculateValueScore(trial, factors);

    logger.info(
      { userId, conversionProbability, churnRisk, valueScore },
      "User insight calculated",
    );

    return {
      userId,
      conversionProbability,
      recommendedTrigger: trigger,
      recommendedPromptType: promptType,
      valueScore,
      churnRisk,
    };
  }

  /**
   * 获取即将过期的试用用户
   */
  async getExpiringTrials(withinDays: number): Promise<UserTrialState[]> {
    const supabase = await createClient();

    // 调用 RPC 函数 (RPC 尚未在生成的类型中)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_expiring_trials", {
      p_within_days: withinDays,
    });

    if (error) {
      // 如果 RPC 不存在，使用直接查询
      if (error.code === "42883") {
        return this.queryExpiringTrialsDirect(withinDays);
      }
      logger.error({ error: error.message }, "Failed to get expiring trials");
      return [];
    }

    const rows = data as TrialStateRow[];
    logger.info(
      { withinDays, count: rows.length },
      "Expiring trials retrieved",
    );

    return rows.map(rowToTrialState);
  }

  /**
   * 获取高价值待转化用户
   */
  async getHighValueProspects(limit: number): Promise<UserConversionInsight[]> {
    const supabase = await createClient();

    // 获取所有活跃试用用户 (表尚未在生成的类型中)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("ks_user_trial_states")
      .select("*")
      .eq("status", "active")
      .order("generations_used", { ascending: false })
      .limit(limit * 2); // 获取更多以便筛选

    if (error) {
      if (error.code === "42P01") {
        logger.warn("Trial states table not found");
        return [];
      }
      logger.error(
        { error: error.message },
        "Failed to get high value prospects",
      );
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // 计算每个用户的洞察
    const insights: UserConversionInsight[] = [];
    for (const row of data as TrialStateRow[]) {
      const insight = await this.getUserInsight(row.user_id);
      insights.push(insight);
    }

    // 按价值评分排序并取前 limit 个
    insights.sort((a, b) => b.valueScore - a.valueScore);
    const topProspects = insights.slice(0, limit);

    logger.info(
      { limit, returned: topProspects.length },
      "High value prospects retrieved",
    );

    return topProspects;
  }

  // ============================================================================
  // 私有辅助方法
  // ============================================================================

  /**
   * 直接查询即将过期的试用
   */
  private async queryExpiringTrialsDirect(
    withinDays: number,
  ): Promise<UserTrialState[]> {
    const supabase = await createClient();
    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + withinDays);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("ks_user_trial_states")
      .select("*")
      .eq("status", "active")
      .gt("expires_at", now.toISOString())
      .lte("expires_at", futureDate.toISOString())
      .order("expires_at", { ascending: true });

    if (error) {
      logger.error({ error: error.message }, "Failed to query expiring trials");
      return [];
    }

    return (data as TrialStateRow[]).map(rowToTrialState);
  }

  /**
   * 计算各阶段转化率
   */
  private calculateStageConversionRates(
    stageCounts: Record<ConversionStage, number>,
    totalTrials: number,
  ): Record<ConversionStage, number> {
    if (totalTrials === 0) {
      return this.getEmptyStageCounts();
    }

    const stages: ConversionStage[] = [
      "awareness",
      "activation",
      "engagement",
      "consideration",
      "conversion",
      "retention",
    ];

    const rates: Record<ConversionStage, number> = {} as Record<
      ConversionStage,
      number
    >;
    let previousCount = totalTrials;

    for (const stage of stages) {
      const count = stageCounts[stage] || 0;
      rates[stage] =
        previousCount > 0 ? Math.round((count / previousCount) * 100) : 0;
      previousCount = count || previousCount;
    }

    return rates;
  }

  /**
   * 推荐触发器和提示类型
   */
  private recommendTriggerAndPrompt(
    trial: TrialStateRow,
    factors: ConversionProbabilityFactors,
    churnRisk: "low" | "medium" | "high",
  ): { trigger: ConversionTrigger; promptType: UpgradePromptType } {
    // 基于剩余天数
    if (factors.remainingDays <= 1) {
      return { trigger: "trial_ending", promptType: "modal" };
    }
    if (factors.remainingDays <= 3) {
      return { trigger: "trial_ending", promptType: "banner" };
    }

    // 基于使用情况
    if (trial.generations_used === 0) {
      return { trigger: "feature_locked", promptType: "tooltip" };
    }

    // 基于流失风险
    if (churnRisk === "high") {
      return { trigger: "promo_offer", promptType: "modal" };
    }

    // 默认推荐
    if (factors.featuresExperiencedCount >= 3) {
      return { trigger: "manual_upgrade", promptType: "inline" };
    }

    return { trigger: "feature_locked", promptType: "tooltip" };
  }

  /**
   * 计算价值评分
   */
  private calculateValueScore(
    trial: TrialStateRow,
    factors: ConversionProbabilityFactors,
  ): number {
    let score = 0;

    // 使用次数（权重 30%）
    score += Math.min(factors.generationsUsed * 5, 30);

    // 功能体验数（权重 25%）
    score += Math.min(factors.featuresExperiencedCount * 5, 25);

    // 活跃天数（权重 20%）
    score += Math.min(factors.activeDays * 3, 20);

    // 提示点击率（权重 15%）
    score += factors.promptClickRate * 15;

    // 阶段进度（权重 10%）
    const stageScores: Record<ConversionStage, number> = {
      awareness: 2,
      activation: 4,
      engagement: 6,
      consideration: 8,
      conversion: 10,
      retention: 10,
    };
    score += stageScores[trial.conversion_stage] || 0;

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * 获取空指标
   */
  private getEmptyMetrics(
    startDate: Date,
    endDate: Date,
  ): ConversionFunnelMetrics {
    return {
      period: { start: startDate, end: endDate },
      stageCounts: this.getEmptyStageCounts(),
      stageConversionRates: this.getEmptyStageCounts(),
      overallConversionRate: 0,
      averageConversionDays: 0,
      triggerDistribution: this.getEmptyTriggerCounts(),
    };
  }

  /**
   * 获取空阶段计数
   */
  private getEmptyStageCounts(): Record<ConversionStage, number> {
    return {
      awareness: 0,
      activation: 0,
      engagement: 0,
      consideration: 0,
      conversion: 0,
      retention: 0,
    };
  }

  /**
   * 获取空触发器计数
   */
  private getEmptyTriggerCounts(): Record<ConversionTrigger, number> {
    return {
      quota_exhausted: 0,
      feature_locked: 0,
      trial_ending: 0,
      trial_expired: 0,
      manual_upgrade: 0,
      promo_offer: 0,
    };
  }

  /**
   * 获取默认洞察
   */
  private getDefaultInsight(userId: string): UserConversionInsight {
    return {
      userId,
      conversionProbability: 0,
      recommendedTrigger: "feature_locked",
      recommendedPromptType: "tooltip",
      valueScore: 0,
      churnRisk: "medium",
    };
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建转化分析服务实例
 */
export function createConversionAnalytics(): IConversionAnalytics {
  return new ConversionAnalytics();
}

// 保留旧名称以兼容
export { ConversionAnalytics as ConversionAnalyticsStub };

// ============================================================================
// 转化概率计算
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
 * 计算转化概率
 *
 * 基于多因素加权模型：
 * - 使用深度（30%）
 * - 功能体验（25%）
 * - 活跃度（20%）
 * - 时间紧迫度（15%）
 * - 历史行为（10%）
 */
export function calculateConversionProbability(
  factors: ConversionProbabilityFactors,
): number {
  const {
    remainingDays,
    generationsUsed,
    featuresExperiencedCount,
    activeDays,
    daysSinceLastActive,
    promptClickRate,
  } = factors;

  let score = 0;

  // 使用深度（权重 30%）
  // 使用次数越多，转化概率越高
  score += Math.min(generationsUsed * 6, 30);

  // 功能体验（权重 25%）
  // 体验功能越多，转化概率越高
  score += Math.min(featuresExperiencedCount * 5, 25);

  // 活跃度（权重 20%）
  // 活跃天数越多，转化概率越高
  score += Math.min(activeDays * 3, 15);
  // 最近不活跃会降低概率
  if (daysSinceLastActive > 3) {
    score -= Math.min(daysSinceLastActive * 2, 15);
  }

  // 时间紧迫度（权重 15%）
  // 临近过期时，转化概率有波动
  if (remainingDays <= 1 && remainingDays > 0) {
    score += 15; // 最后一天，紧迫感最强
  } else if (remainingDays <= 3) {
    score += 10;
  } else if (remainingDays <= 0) {
    score -= 5; // 已过期，概率下降
  }

  // 历史行为（权重 10%）
  // 提示点击率反映付费意愿
  score += promptClickRate * 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * 评估流失风险
 *
 * 基于活跃度和使用深度判断：
 * - high: 高流失风险（长时间不活跃或几乎不使用）
 * - medium: 中等风险（偶尔使用）
 * - low: 低风险（活跃用户）
 */
export function evaluateChurnRisk(
  factors: Partial<ConversionProbabilityFactors>,
): "low" | "medium" | "high" {
  const {
    daysSinceLastActive = 0,
    generationsUsed = 0,
    featuresExperiencedCount = 0,
    activeDays = 0,
  } = factors;

  // 高风险条件
  if (daysSinceLastActive > 5) return "high";
  if (daysSinceLastActive > 2 && generationsUsed < 2) return "high";
  if (generationsUsed === 0 && activeDays > 3) return "high";

  // 低风险条件
  if (generationsUsed >= 5 && daysSinceLastActive <= 1) return "low";
  if (featuresExperiencedCount >= 3 && activeDays >= 4) return "low";

  return "medium";
}
