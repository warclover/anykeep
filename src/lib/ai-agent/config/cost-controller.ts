/**
 * 成本控制器
 *
 * 管理 Token 预算和使用统计
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { logger } from "@/lib/logger";
import type { ModelTierId } from "@/lib/ai-providers/model-tier-config";
import { MODEL_TIER_CONFIG } from "@/lib/ai-providers/model-tier-config";

// =============================================================================
// 配置常量
// =============================================================================

/**
 * 默认 Token 预算配置
 */
export const DEFAULT_TOKEN_BUDGET = {
  /** 每次对话最大 Token */
  maxTokensPerConversation: 8000,
  /** 每日 Token 预算 */
  dailyBudget: 100000,
  /** 每月 Token 预算 */
  monthlyBudget: 3000000,
  /** 预警阈值（达到预算的百分比时预警） */
  warningThreshold: 0.8,
} as const;

/**
 * 模型成本系数（相对于基准）
 */
export const MODEL_COST_FACTORS: Record<string, number> = {
  "deepseek-chat": 1,
  "deepseek-reasoner": 4,
  "gpt-4o": 10,
  "gpt-4o-mini": 2,
  "claude-3-5-sonnet": 8,
  "claude-3-haiku": 1.5,
};

// =============================================================================
// 类型定义
// =============================================================================

/**
 * Token 使用记录
 */
export interface TokenUsageRecord {
  /** 请求 ID */
  requestId: string;
  /** 用户 ID */
  userId: string;
  /** 使用的模型 */
  model: string;
  /** 模型层级 */
  tierId: ModelTierId;
  /** 输入 Token 数 */
  inputTokens: number;
  /** 输出 Token 数 */
  outputTokens: number;
  /** 总 Token 数 */
  totalTokens: number;
  /** 计算成本（相对值） */
  cost: number;
  /** 时间戳 */
  timestamp: Date;
}

/**
 * 使用统计
 */
export interface UsageStats {
  /** 今日使用 Token */
  todayTokens: number;
  /** 本月使用 Token */
  monthTokens: number;
  /** 今日请求数 */
  todayRequests: number;
  /** 各层级使用分布 */
  tierDistribution: Record<ModelTierId, number>;
  /** 今日成本（相对值） */
  todayCost: number;
  /** 本月成本（相对值） */
  monthCost: number;
}

/**
 * 预算检查结果
 */
export interface BudgetCheckResult {
  /** 是否允许请求 */
  allowed: boolean;
  /** 原因 */
  reason?: string;
  /** 剩余预算 */
  remaining: {
    daily: number;
    monthly: number;
  };
  /** 是否接近预算上限 */
  nearLimit: boolean;
  /** 建议 */
  suggestion?: string;
}

/**
 * Token 预算配置
 */
export interface TokenBudgetConfig {
  maxTokensPerConversation: number;
  dailyBudget: number;
  monthlyBudget: number;
  warningThreshold: number;
}

// =============================================================================
// 成本控制器类
// =============================================================================

/**
 * 成本控制器
 *
 * 管理 Token 使用预算和统计
 */
export class CostController {
  /** 使用记录（内存缓存，生产环境应持久化） */
  private usageRecords: TokenUsageRecord[] = [];

  /** 预算配置 */
  private budgetConfig: TokenBudgetConfig;

  constructor(config?: Partial<TokenBudgetConfig>) {
    this.budgetConfig = {
      ...DEFAULT_TOKEN_BUDGET,
      ...config,
    };
  }

  /**
   * 检查预算
   *
   * @param userId - 用户 ID
   * @param estimatedTokens - 预估 Token 数
   * @returns 预算检查结果
   */
  checkBudget(userId: string, estimatedTokens: number): BudgetCheckResult {
    const stats = this.getUsageStats(userId);

    const dailyRemaining = this.budgetConfig.dailyBudget - stats.todayTokens;
    const monthlyRemaining =
      this.budgetConfig.monthlyBudget - stats.monthTokens;

    // 检查是否超过日预算
    if (stats.todayTokens + estimatedTokens > this.budgetConfig.dailyBudget) {
      return {
        allowed: false,
        reason: "daily_budget_exceeded",
        remaining: {
          daily: Math.max(0, dailyRemaining),
          monthly: monthlyRemaining,
        },
        nearLimit: true,
        suggestion: "今日 Token 预算已用尽，请明天再试或升级配额。",
      };
    }

    // 检查是否超过月预算
    if (stats.monthTokens + estimatedTokens > this.budgetConfig.monthlyBudget) {
      return {
        allowed: false,
        reason: "monthly_budget_exceeded",
        remaining: {
          daily: dailyRemaining,
          monthly: Math.max(0, monthlyRemaining),
        },
        nearLimit: true,
        suggestion: "本月 Token 预算已用尽，请下月再试或升级配额。",
      };
    }

    // 检查是否接近预算上限
    const nearDailyLimit =
      stats.todayTokens >
      this.budgetConfig.dailyBudget * this.budgetConfig.warningThreshold;
    const nearMonthlyLimit =
      stats.monthTokens >
      this.budgetConfig.monthlyBudget * this.budgetConfig.warningThreshold;

    return {
      allowed: true,
      remaining: { daily: dailyRemaining, monthly: monthlyRemaining },
      nearLimit: nearDailyLimit || nearMonthlyLimit,
      suggestion: nearDailyLimit
        ? "接近今日预算上限，建议节省使用。"
        : undefined,
    };
  }

  /**
   * 记录 Token 使用
   */
  recordUsage(record: Omit<TokenUsageRecord, "cost" | "timestamp">): void {
    const costFactor = MODEL_COST_FACTORS[record.model] ?? 1;
    const cost = record.totalTokens * costFactor;

    const fullRecord: TokenUsageRecord = {
      ...record,
      cost,
      timestamp: new Date(),
    };

    this.usageRecords.push(fullRecord);

    logger.debug(
      {
        userId: record.userId,
        model: record.model,
        tierId: record.tierId,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        totalTokens: record.totalTokens,
        cost,
      },
      "CostController: Token usage recorded",
    );

    // 清理过期记录（保留最近 30 天）
    this.cleanupOldRecords();
  }

  /**
   * 获取使用统计
   */
  getUsageStats(userId: string): UsageStats {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const userRecords = this.usageRecords.filter((r) => r.userId === userId);

    const todayRecords = userRecords.filter((r) => r.timestamp >= todayStart);
    const monthRecords = userRecords.filter((r) => r.timestamp >= monthStart);

    const tierDistribution: Record<ModelTierId, number> = {
      fast: 0,
      standard: 0,
      deep: 0,
    };

    for (const record of todayRecords) {
      tierDistribution[record.tierId] += record.totalTokens;
    }

    return {
      todayTokens: todayRecords.reduce((sum, r) => sum + r.totalTokens, 0),
      monthTokens: monthRecords.reduce((sum, r) => sum + r.totalTokens, 0),
      todayRequests: todayRecords.length,
      tierDistribution,
      todayCost: todayRecords.reduce((sum, r) => sum + r.cost, 0),
      monthCost: monthRecords.reduce((sum, r) => sum + r.cost, 0),
    };
  }

  /**
   * 估算请求成本
   */
  estimateCost(tierId: ModelTierId, estimatedTokens: number): number {
    const tierConfig = MODEL_TIER_CONFIG[tierId];
    const model = tierConfig.provider.model;
    const costFactor = MODEL_COST_FACTORS[model] ?? 1;
    return estimatedTokens * costFactor;
  }

  /**
   * 建议最优层级（考虑成本）
   */
  suggestTier(
    userId: string,
    preferredTier: ModelTierId,
  ): { tierId: ModelTierId; reason?: string } {
    const _stats = this.getUsageStats(userId); // 预留用于未来扩展
    const budgetCheck = this.checkBudget(userId, 1000); // 估算 1000 token

    // 如果接近预算上限，建议降级
    if (budgetCheck.nearLimit && preferredTier !== "fast") {
      return {
        tierId: "fast",
        reason: "接近预算上限，建议使用快速层节省成本",
      };
    }

    return { tierId: preferredTier };
  }

  /**
   * 获取今日剩余预算
   */
  getDailyRemaining(userId: string): number {
    const stats = this.getUsageStats(userId);
    return Math.max(0, this.budgetConfig.dailyBudget - stats.todayTokens);
  }

  /**
   * 获取本月剩余预算
   */
  getMonthlyRemaining(userId: string): number {
    const stats = this.getUsageStats(userId);
    return Math.max(0, this.budgetConfig.monthlyBudget - stats.monthTokens);
  }

  /**
   * 清理过期记录
   */
  private cleanupOldRecords(): void {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    this.usageRecords = this.usageRecords.filter(
      (r) => r.timestamp >= thirtyDaysAgo,
    );
  }

  /**
   * 重置统计（仅用于测试）
   */
  _resetForTesting(): void {
    this.usageRecords = [];
  }
}

// =============================================================================
// 单例导出
// =============================================================================

/**
 * 全局成本控制器实例
 */
export const costController = new CostController();

/**
 * 便捷函数：检查预算
 */
export function checkTokenBudget(
  userId: string,
  estimatedTokens: number,
): BudgetCheckResult {
  return costController.checkBudget(userId, estimatedTokens);
}

/**
 * 便捷函数：记录使用
 */
export function recordTokenUsage(
  record: Omit<TokenUsageRecord, "cost" | "timestamp">,
): void {
  costController.recordUsage(record);
}

/**
 * 便捷函数：获取统计
 */
export function getTokenUsageStats(userId: string): UsageStats {
  return costController.getUsageStats(userId);
}
