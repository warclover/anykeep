/**
 * Knowledge Studio - 使用量追踪服务
 * @module knowledge-studio/billing
 * @description Phase 3 存根 - 使用量追踪与配额管理
 * @version 0.1.0 (Stub)
 * @since 2025-01-02
 *
 * TODO Phase 3: 完整实现
 * - 使用量持久化
 * - 配额实时检查
 * - 使用量聚合统计
 * - 超额预警
 */

import { logger } from "@/lib/logger";
import type {
  IUsageTracker,
  UsageRecord,
  UsageStatistics,
  UsagePeriod,
  UsageType,
} from "./types";

// ============================================================================
// 存根实现
// ============================================================================

/**
 * 使用量追踪服务（Phase 3 存根）
 *
 * @example
 * ```typescript
 * const tracker = new UsageTrackerStub();
 *
 * // 记录使用量
 * await tracker.trackUsage({
 *   userId: 'user-123',
 *   type: 'generation',
 *   amount: 1,
 *   unit: 'report',
 *   timestamp: new Date(),
 * });
 *
 * // 检查配额
 * const quota = await tracker.checkQuota('user-123', 'generation');
 * if (quota.isExceeded) {
 *   console.log('配额已用尽');
 * }
 * ```
 */
export class UsageTrackerStub implements IUsageTracker {
  /**
   * 记录使用量
   * @stub 仅记录日志，Phase 3 实现持久化
   */
  async trackUsage(record: Omit<UsageRecord, "id">): Promise<void> {
    logger.info(
      `[UsageTracker] trackUsage - Phase 3 存根: ${record.type} x ${record.amount}`,
    );
  }

  /**
   * 获取使用统计
   * @stub 返回空统计，Phase 3 实现聚合查询
   */
  async getStatistics(
    userId: string,
    period: UsagePeriod,
  ): Promise<UsageStatistics> {
    logger.info(
      `[UsageTracker] getStatistics(${userId}, ${period}) - Phase 3 存根`,
    );

    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(
      now.getDate() - (period === "daily" ? 1 : period === "weekly" ? 7 : 30),
    );

    return {
      userId,
      period,
      periodStart,
      periodEnd: now,
      usageByType: {
        generation: 0,
        chat_edit: 0,
        ai_recommendation: 0,
        export: 0,
        storage: 0,
      },
      totalUsage: 0,
      quotaLimit: 100,
      usageRate: 0,
    };
  }

  /**
   * 获取使用历史
   * @stub 返回空数组，Phase 3 实现历史查询
   */
  async getHistory(
    userId: string,
    options?: {
      type?: UsageType;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    },
  ): Promise<UsageRecord[]> {
    logger.info(
      `[UsageTracker] getHistory(${userId}) - Phase 3 存根, options: ${JSON.stringify(options)}`,
    );
    return [];
  }

  /**
   * 检查配额
   * @stub 返回未超额，Phase 3 实现实时检查
   */
  async checkQuota(
    userId: string,
    type: UsageType,
  ): Promise<{
    remaining: number;
    limit: number;
    isExceeded: boolean;
  }> {
    logger.info(`[UsageTracker] checkQuota(${userId}, ${type}) - Phase 3 存根`);

    // Pro 用户无限制
    return {
      remaining: 100,
      limit: 100,
      isExceeded: false,
    };
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建使用量追踪服务实例
 * @stub Phase 3 实现完整服务
 */
export function createUsageTracker(): IUsageTracker {
  return new UsageTrackerStub();
}
