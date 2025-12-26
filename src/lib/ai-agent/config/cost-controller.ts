/**
 * 成本控制器
 *
 * 管理 Token 预算和使用统计
 *
 * @version 1.1.0
 * @since 2025-12-26
 *
 * v1.1.0 更新:
 * - 添加数据库持久化支持
 * - 内存缓存作为写入缓冲区
 * - 异步批量写入优化性能
 */

import { createClient } from "@/lib/supabase/server";
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
// 写入缓冲区配置
// =============================================================================

/** 写入缓冲区刷新间隔（毫秒） */
const FLUSH_INTERVAL_MS = 5000; // 5 秒

/** 写入缓冲区最大大小 */
const MAX_BUFFER_SIZE = 20;

/** 统计数据缓存 TTL（毫秒） */
const STATS_CACHE_TTL = 30000; // 30 秒

// =============================================================================
// 成本控制器类
// =============================================================================

/**
 * 成本控制器
 *
 * 管理 Token 使用预算和统计，支持数据库持久化
 */
export class CostController {
  /** 待写入数据库的记录缓冲区 */
  private writeBuffer: TokenUsageRecord[] = [];

  /** 内存缓存（用于快速统计查询） */
  private memoryCache: TokenUsageRecord[] = [];

  /** 统计数据缓存 */
  private statsCache = new Map<string, { data: UsageStats; expiry: number }>();

  /** 预算配置 */
  private budgetConfig: TokenBudgetConfig;

  /** 刷新定时器 */
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  /** 是否启用数据库持久化 */
  private enablePersistence: boolean;

  constructor(
    config?: Partial<TokenBudgetConfig> & { enablePersistence?: boolean },
  ) {
    this.budgetConfig = {
      ...DEFAULT_TOKEN_BUDGET,
      ...config,
    };
    this.enablePersistence = config?.enablePersistence ?? true;
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
   *
   * 记录会先写入内存缓冲区，然后异步批量持久化到数据库
   */
  recordUsage(record: Omit<TokenUsageRecord, "cost" | "timestamp">): void {
    const costFactor = MODEL_COST_FACTORS[record.model] ?? 1;
    const cost = record.totalTokens * costFactor;

    const fullRecord: TokenUsageRecord = {
      ...record,
      cost,
      timestamp: new Date(),
    };

    // 添加到内存缓存（用于即时统计）
    this.memoryCache.push(fullRecord);

    // 添加到写入缓冲区
    this.writeBuffer.push(fullRecord);

    // 清除该用户的统计缓存
    this.statsCache.delete(record.userId);

    logger.debug(
      {
        userId: record.userId,
        model: record.model,
        tierId: record.tierId,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        totalTokens: record.totalTokens,
        cost,
        bufferSize: this.writeBuffer.length,
      },
      "CostController: Token usage recorded",
    );

    // 检查是否需要立即刷新
    if (this.writeBuffer.length >= MAX_BUFFER_SIZE) {
      this.flushToDatabase();
    } else {
      // 启动延迟刷新定时器
      this.scheduleFlush();
    }

    // 清理内存缓存中的过期记录
    this.cleanupMemoryCache();
  }

  /**
   * 获取使用统计
   *
   * 优先从缓存获取，缓存未命中时从内存记录计算
   * 注意：数据库查询是异步的，这里只使用内存数据保证同步返回
   */
  getUsageStats(userId: string): UsageStats {
    // 检查缓存
    const cached = this.statsCache.get(userId);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    // 从内存缓存计算
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const userRecords = this.memoryCache.filter((r) => r.userId === userId);

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

    const stats: UsageStats = {
      todayTokens: todayRecords.reduce((sum, r) => sum + r.totalTokens, 0),
      monthTokens: monthRecords.reduce((sum, r) => sum + r.totalTokens, 0),
      todayRequests: todayRecords.length,
      tierDistribution,
      todayCost: todayRecords.reduce((sum, r) => sum + r.cost, 0),
      monthCost: monthRecords.reduce((sum, r) => sum + r.cost, 0),
    };

    // 写入缓存
    this.statsCache.set(userId, {
      data: stats,
      expiry: Date.now() + STATS_CACHE_TTL,
    });

    return stats;
  }

  /**
   * 异步获取使用统计（从数据库）
   *
   * 用于需要精确数据的场景（如计费、报告）
   */
  async getUsageStatsAsync(userId: string): Promise<UsageStats> {
    if (!this.enablePersistence) {
      return this.getUsageStats(userId);
    }

    try {
      const supabase = await createClient();

      const { data, error } = await supabase.rpc("get_user_token_stats", {
        p_user_id: userId,
      });

      if (error) {
        logger.warn(
          { userId, error: error.message },
          "CostController: Failed to get stats from DB, using memory cache",
        );
        return this.getUsageStats(userId);
      }

      const dbStats = data as {
        todayTokens: number;
        monthTokens: number;
        todayRequests: number;
        todayCost: number;
        monthCost: number;
        tierDistribution: Record<ModelTierId, number>;
      };

      // 合并内存缓冲区中尚未持久化的数据
      const memoryStats = this.getUsageStats(userId);

      return {
        todayTokens: dbStats.todayTokens + memoryStats.todayTokens,
        monthTokens: dbStats.monthTokens + memoryStats.monthTokens,
        todayRequests: dbStats.todayRequests + memoryStats.todayRequests,
        tierDistribution: {
          fast:
            dbStats.tierDistribution.fast + memoryStats.tierDistribution.fast,
          standard:
            dbStats.tierDistribution.standard +
            memoryStats.tierDistribution.standard,
          deep:
            dbStats.tierDistribution.deep + memoryStats.tierDistribution.deep,
        },
        todayCost: dbStats.todayCost + memoryStats.todayCost,
        monthCost: dbStats.monthCost + memoryStats.monthCost,
      };
    } catch (error) {
      logger.error(
        { userId, error },
        "CostController: Exception getting stats from DB",
      );
      return this.getUsageStats(userId);
    }
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
   * 立即刷新缓冲区到数据库
   */
  async flushToDatabase(): Promise<void> {
    if (this.writeBuffer.length === 0 || !this.enablePersistence) {
      return;
    }

    // 取出当前缓冲区内容
    const recordsToWrite = [...this.writeBuffer];
    this.writeBuffer = [];

    // 清除定时器
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    try {
      const supabase = await createClient();

      // 批量插入
      const { error } = await supabase.from("token_usage_logs").insert(
        recordsToWrite.map((r) => ({
          user_id: r.userId,
          request_id: r.requestId,
          model: r.model,
          tier_id: r.tierId,
          input_tokens: r.inputTokens,
          output_tokens: r.outputTokens,
          total_tokens: r.totalTokens,
          cost: r.cost,
          created_at: r.timestamp.toISOString(),
        })),
      );

      if (error) {
        logger.error(
          { error: error.message, recordCount: recordsToWrite.length },
          "CostController: Failed to persist records to DB",
        );
        // 失败时将记录放回缓冲区
        this.writeBuffer.unshift(...recordsToWrite);
      } else {
        logger.info(
          { recordCount: recordsToWrite.length },
          "CostController: Records persisted to DB",
        );
        // 成功后清理内存缓存中已持久化的记录
        this.cleanupMemoryCache();
      }
    } catch (error) {
      logger.error(
        { error, recordCount: recordsToWrite.length },
        "CostController: Exception persisting records to DB",
      );
      // 异常时将记录放回缓冲区
      this.writeBuffer.unshift(...recordsToWrite);
    }
  }

  /**
   * 调度延迟刷新
   */
  private scheduleFlush(): void {
    if (this.flushTimer || !this.enablePersistence) {
      return;
    }

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushToDatabase();
    }, FLUSH_INTERVAL_MS);
  }

  /**
   * 清理内存缓存中的过期记录（保留最近 1 天）
   */
  private cleanupMemoryCache(): void {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    this.memoryCache = this.memoryCache.filter((r) => r.timestamp >= oneDayAgo);
  }

  /**
   * 重置统计（仅用于测试）
   */
  _resetForTesting(): void {
    this.memoryCache = [];
    this.writeBuffer = [];
    this.statsCache.clear();
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * 销毁控制器（清理定时器）
   */
  destroy(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    // 尝试最后一次刷新
    this.flushToDatabase();
  }
}

// =============================================================================
// 单例导出
// =============================================================================

/**
 * 全局成本控制器实例
 *
 * 注意：生产环境下 enablePersistence 应为 true
 * 但需要确保数据库迁移已执行
 */
export const costController = new CostController({
  // 默认禁用持久化，等数据库迁移完成后可启用
  // 或通过环境变量控制
  enablePersistence: process.env.ENABLE_TOKEN_PERSISTENCE === "true",
});

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
