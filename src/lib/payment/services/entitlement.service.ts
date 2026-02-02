/**
 * Entitlement Service - 用户权益查询服务
 * 高性能权益检查，支持缓存
 */

import { createClient } from "@/lib/supabase/server";
import type { PlanTier, UserEntitlement, DbUserEntitlement } from "../types";
import { QUOTA_CONFIG } from "../config";

// 默认免费用户权益
const DEFAULT_FREE_ENTITLEMENT: UserEntitlement = {
  userId: "",
  planTier: "free",
  validUntil: undefined,
  aiQuotaMonthly: QUOTA_CONFIG.free.aiMonthly,
  aiQuotaDailyLimit: QUOTA_CONFIG.free.aiDaily,
  storageLimitMb: QUOTA_CONFIG.free.storageMb,
  ttsSecondsMonthly: 0,
  isLifetime: false,
  trialUsed: false,
  trialConverted: false,
  refundCount: 0,
};

/**
 * 转换数据库行到业务对象
 */
function mapDbToEntitlement(row: DbUserEntitlement): UserEntitlement {
  return {
    userId: row.user_id,
    planTier: row.plan_tier as PlanTier,
    validUntil: row.valid_until ? new Date(row.valid_until) : undefined,
    aiQuotaMonthly: row.ai_quota_monthly,
    aiQuotaDailyLimit: row.ai_quota_daily_limit,
    storageLimitMb: row.storage_limit_mb,
    ttsSecondsMonthly: row.tts_seconds_monthly,
    isLifetime: row.is_lifetime,
    trialStartedAt: row.trial_started_at
      ? new Date(row.trial_started_at)
      : undefined,
    trialEndsAt: row.trial_ends_at ? new Date(row.trial_ends_at) : undefined,
    trialUsed: row.trial_used,
    trialConverted: row.trial_converted,
    refundCount: row.refund_count,
    lastRefundedAt: row.last_refunded_at
      ? new Date(row.last_refunded_at)
      : undefined,
    refundReason: row.refund_reason ?? undefined,
  };
}

class EntitlementService {
  /**
   * 获取用户权益
   */
  async getEntitlement(userId: string): Promise<UserEntitlement> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("user_entitlements")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      // 返回默认免费权益
      return { ...DEFAULT_FREE_ENTITLEMENT, userId };
    }

    const entitlement = mapDbToEntitlement(data as DbUserEntitlement);

    // 检查是否过期（非终身用户）
    if (!entitlement.isLifetime && entitlement.validUntil) {
      if (new Date() > entitlement.validUntil) {
        // 已过期，检查是否在试用期
        if (entitlement.trialEndsAt && new Date() < entitlement.trialEndsAt) {
          // 仍在试用期
          return entitlement;
        }
        // 降级为免费
        return {
          ...DEFAULT_FREE_ENTITLEMENT,
          userId,
          trialUsed: entitlement.trialUsed,
        };
      }
    }

    // 检查试用期
    if (entitlement.trialEndsAt && !entitlement.validUntil) {
      if (new Date() > entitlement.trialEndsAt) {
        // 试用期已结束
        return { ...DEFAULT_FREE_ENTITLEMENT, userId, trialUsed: true };
      }
    }

    return entitlement;
  }

  /**
   * 获取有效的套餐等级
   */
  async getEffectivePlanTier(userId: string): Promise<PlanTier> {
    const entitlement = await this.getEntitlement(userId);
    return entitlement.planTier;
  }

  /**
   * 检查是否为付费用户
   */
  async isPaidUser(userId: string): Promise<boolean> {
    const tier = await this.getEffectivePlanTier(userId);
    return tier !== "free";
  }

  /**
   * ���查是否在试用期
   */
  async isInTrial(userId: string): Promise<boolean> {
    const entitlement = await this.getEntitlement(userId);
    if (!entitlement.trialEndsAt) return false;
    return new Date() < entitlement.trialEndsAt && !entitlement.validUntil;
  }

  /**
   * 创建或更新用户权益
   */
  async upsertEntitlement(
    userId: string,
    data: Partial<Omit<UserEntitlement, "userId">>,
  ): Promise<void> {
    const supabase = await createClient();

    // 构建类型安全的更新对象
    const updateData = {
      user_id: userId,
      plan_tier: data.planTier,
      valid_until: data.validUntil?.toISOString(),
      ai_quota_monthly: data.aiQuotaMonthly,
      ai_quota_daily_limit: data.aiQuotaDailyLimit,
      storage_limit_mb: data.storageLimitMb,
      tts_seconds_monthly: data.ttsSecondsMonthly,
      is_lifetime: data.isLifetime,
      trial_started_at: data.trialStartedAt?.toISOString(),
      trial_ends_at: data.trialEndsAt?.toISOString(),
      trial_used: data.trialUsed,
      trial_converted: data.trialConverted,
    };

    // 移除 undefined 的字段
    const cleanData = Object.fromEntries(
      Object.entries(updateData).filter(([, v]) => v !== undefined),
    ) as typeof updateData;

    await supabase
      .from("user_entitlements")
      .upsert(cleanData, { onConflict: "user_id" });
  }

  /**
   * 激活套餐
   */
  async activatePlan(
    userId: string,
    planTier: PlanTier,
    validUntil: Date,
    isLifetime: boolean = false,
  ): Promise<void> {
    const config = QUOTA_CONFIG[planTier];

    await this.upsertEntitlement(userId, {
      planTier,
      validUntil: isLifetime ? undefined : validUntil,
      aiQuotaMonthly: config.aiMonthly,
      aiQuotaDailyLimit: config.aiDaily,
      storageLimitMb: config.storageMb,
      ttsSecondsMonthly: config.ttsHours * 3600,
      isLifetime,
      trialConverted: true,
    });
  }

  /**
   * 降级到免费
   */
  async downgradeToFree(userId: string, reason?: string): Promise<void> {
    const supabase = await createClient();

    // 如果是退款，先获取当前 refund_count
    let refundCount: number | undefined;
    if (reason === "refunded") {
      const { data } = await supabase
        .from("user_entitlements")
        .select("refund_count")
        .eq("user_id", userId)
        .single();
      refundCount = (data?.refund_count ?? 0) + 1;
    }

    await supabase
      .from("user_entitlements")
      .update({
        plan_tier: "free",
        valid_until: new Date().toISOString(),
        ai_quota_monthly: QUOTA_CONFIG.free.aiMonthly,
        ai_quota_daily_limit: QUOTA_CONFIG.free.aiDaily,
        storage_limit_mb: QUOTA_CONFIG.free.storageMb,
        tts_seconds_monthly: 0,
        is_lifetime: false,
        refund_count: refundCount,
        last_refunded_at:
          reason === "refunded" ? new Date().toISOString() : undefined,
        refund_reason: reason,
      })
      .eq("user_id", userId);
  }
}

export const entitlementService = new EntitlementService();
