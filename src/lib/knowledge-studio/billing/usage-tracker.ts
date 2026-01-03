/**
 * Knowledge Studio - 使用量追踪服务
 * @module knowledge-studio/billing
 * @description P4 实现 - 使用量追踪与配额管理
 * @version 1.0.0
 * @since 2026-01-02
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  IUsageTracker,
  UsageRecord,
  UsageStatistics,
  UsagePeriod,
  UsageType,
} from "./types";

// ============================================================================
// 配额配置
// ============================================================================

/** 会员配额限制 */
const QUOTA_LIMITS: Record<string, Record<UsageType, number>> = {
  free: {
    generation: 3,
    chat_edit: 0,
    ai_recommendation: 5,
    export: 10,
    storage: 100, // MB
  },
  pro: {
    generation: -1, // 无限
    chat_edit: 50,
    ai_recommendation: -1,
    export: -1,
    storage: 10000, // MB
  },
};

// ============================================================================
// 使用量追踪服务实现
// ============================================================================

/**
 * 使用量追踪服务
 *
 * @example
 * ```typescript
 * const tracker = new UsageTracker();
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
export class UsageTracker implements IUsageTracker {
  /**
   * 记录使用量
   */
  async trackUsage(record: Omit<UsageRecord, "id">): Promise<void> {
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("ks_usage_records") as any).insert({
      user_id: record.userId,
      usage_type: record.type,
      amount: record.amount,
      unit: record.unit,
      resource_id: record.resourceId,
      metadata: record.metadata ?? {},
      created_at: record.timestamp.toISOString(),
    });

    if (error) {
      logger.error({ error: error.message }, "Failed to track usage");
      throw new Error(`记录使用量失败: ${error.message}`);
    }

    logger.info(
      { userId: record.userId, type: record.type, amount: record.amount },
      "Usage tracked",
    );
  }

  /**
   * 获取使用统计
   */
  async getStatistics(
    userId: string,
    period: UsagePeriod,
  ): Promise<UsageStatistics> {
    const supabase = await createClient();

    // 调用 RPC 函数
    // 类型断言: 手动维护类型文件时需要此断言
    type UsageStatsRpcResult = {
      usageByType?: Record<string, number>;
      totalUsage?: number;
      periodStart?: string;
      periodEnd?: string;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)("get_user_usage_stats", {
      p_user_id: userId,
      p_period: period,
    }) as { data: UsageStatsRpcResult | null; error: { message: string } | null };

    if (error) {
      logger.error({ error: error.message }, "Failed to get usage stats");
      throw new Error(`获取使用统计失败: ${error.message}`);
    }

    // 获取用户会员类型
    // 类型断言: 手动维护类型文件时需要此断言
    type ProfileMembershipType = { membership_type: string | null };
    const { data: profile } = await supabase
      .from("profiles")
      .select("membership_type")
      .eq("id", userId)
      .single() as unknown as { data: ProfileMembershipType | null };

    const membershipType = profile?.membership_type ?? "free";
    const quotaLimits = QUOTA_LIMITS[membershipType] ?? QUOTA_LIMITS.free;

    // 计算总配额
    const totalQuota = Object.values(quotaLimits).reduce(
      (sum, val) => (val === -1 ? sum : sum + val),
      0,
    );

    const usageByType: Record<UsageType, number> = {
      generation: data?.usageByType?.generation ?? 0,
      chat_edit: data?.usageByType?.chat_edit ?? 0,
      ai_recommendation: data?.usageByType?.ai_recommendation ?? 0,
      export: data?.usageByType?.export ?? 0,
      storage: data?.usageByType?.storage ?? 0,
    };

    const totalUsage = data?.totalUsage ?? 0;

    return {
      userId,
      period,
      periodStart: new Date(data?.periodStart ?? new Date()),
      periodEnd: new Date(data?.periodEnd ?? new Date()),
      usageByType,
      totalUsage,
      quotaLimit: totalQuota,
      usageRate: totalQuota > 0 ? (totalUsage / totalQuota) * 100 : 0,
    };
  }

  /**
   * 获取使用历史
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
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from("ks_usage_records") as any)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (options?.type) {
      query = query.eq("usage_type", options.type);
    }

    if (options?.startDate) {
      query = query.gte("created_at", options.startDate.toISOString());
    }

    if (options?.endDate) {
      query = query.lte("created_at", options.endDate.toISOString());
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      logger.error({ error: error.message }, "Failed to get usage history");
      throw new Error(`获取使用历史失败: ${error.message}`);
    }

    // 类型断言: 手动维护类型文件时需要此断言
    type UsageRecordRow = {
      id: string;
      user_id: string;
      usage_type: string;
      amount: number;
      unit: string;
      created_at: string;
      resource_id?: string;
      metadata?: Record<string, unknown>;
    };
    return ((data ?? []) as UsageRecordRow[]).map((row) => ({
      id: row.id,
      userId: row.user_id,
      type: row.usage_type as UsageType,
      amount: row.amount,
      unit: row.unit,
      timestamp: new Date(row.created_at),
      resourceId: row.resource_id,
      metadata: row.metadata as Record<string, unknown>,
    }));
  }

  /**
   * 检查配额
   */
  async checkQuota(
    userId: string,
    type: UsageType,
  ): Promise<{
    remaining: number;
    limit: number;
    isExceeded: boolean;
  }> {
    const supabase = await createClient();

    // 获取用户会员类型
    // 类型断言: 手动维护类型文件时需要此断言
    type ProfileMembershipType2 = { membership_type: string | null };
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("membership_type")
      .eq("id", userId)
      .single() as unknown as { data: ProfileMembershipType2 | null; error: { message: string } | null };

    if (profileError) {
      logger.error(
        { error: profileError.message, userId },
        "Failed to get user membership for quota check",
      );
      // Fail-secure: 无法验证会员状态时，默认拒绝
      return { remaining: 0, limit: 0, isExceeded: true };
    }

    const membershipType = profile?.membership_type ?? "free";
    const quotaLimits = QUOTA_LIMITS[membershipType] ?? QUOTA_LIMITS.free;
    const limit = quotaLimits[type] ?? 0;

    // 无限配额
    if (limit === -1) {
      return {
        remaining: 999999,
        limit: -1,
        isExceeded: false,
      };
    }

    // 获取本月使用量
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 类型断言: 手动维护类型文件时需要此断言
    type UsageAmountRow = { amount: number };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("ks_usage_records") as any)
      .select("amount")
      .eq("user_id", userId)
      .eq("usage_type", type)
      .gte("created_at", startOfMonth.toISOString()) as { data: UsageAmountRow[] | null; error: { message: string } | null };

    if (error) {
      logger.error(
        { error: error.message, userId, type },
        "Failed to check quota",
      );
      // Fail-secure: 无法验证配额时，默认拒绝以防止滥用
      return { remaining: 0, limit, isExceeded: true };
    }

    const used = (data ?? []).reduce((sum, row) => sum + row.amount, 0);
    const remaining = Math.max(0, limit - used);

    return {
      remaining,
      limit,
      isExceeded: remaining <= 0,
    };
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建使用量追踪服务实例
 */
export function createUsageTracker(): IUsageTracker {
  return new UsageTracker();
}
