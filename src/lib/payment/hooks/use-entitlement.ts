/**
 * useEntitlement Hook - 用户权益查询
 * 客户端权益状态管理
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PlanTier, UserEntitlement } from "../types";
import { QUOTA_CONFIG } from "../config";

// 默认免费权益
const DEFAULT_ENTITLEMENT: Omit<UserEntitlement, "userId"> = {
  planTier: "free",
  aiQuotaMonthly: QUOTA_CONFIG.free.aiMonthly,
  aiQuotaDailyLimit: QUOTA_CONFIG.free.aiDaily,
  storageLimitMb: QUOTA_CONFIG.free.storageMb,
  ttsSecondsMonthly: 0,
  isLifetime: false,
  trialUsed: false,
  trialConverted: false,
  refundCount: 0,
};

interface UseEntitlementResult {
  entitlement: UserEntitlement | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  // 便捷属性
  planTier: PlanTier;
  isPaid: boolean;
  isLifetime: boolean;
  isInTrial: boolean;
  trialDaysLeft: number | null;
}

export function useEntitlement(): UseEntitlementResult {
  const [entitlement, setEntitlement] = useState<UserEntitlement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEntitlement = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setEntitlement(null);
        return;
      }

      const { data, error: dbError } = await supabase
        .from("user_entitlements")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (dbError && dbError.code !== "PGRST116") {
        throw new Error(dbError.message);
      }

      if (!data) {
        // 返回默认免费权益
        setEntitlement({
          userId: user.id,
          ...DEFAULT_ENTITLEMENT,
        });
        return;
      }

      // 转换数据
      const ent: UserEntitlement = {
        userId: data.user_id,
        planTier: data.plan_tier as PlanTier,
        validUntil: data.valid_until ? new Date(data.valid_until) : undefined,
        aiQuotaMonthly: data.ai_quota_monthly,
        aiQuotaDailyLimit: data.ai_quota_daily_limit,
        storageLimitMb: data.storage_limit_mb,
        ttsSecondsMonthly: data.tts_seconds_monthly,
        isLifetime: data.is_lifetime,
        trialStartedAt: data.trial_started_at
          ? new Date(data.trial_started_at)
          : undefined,
        trialEndsAt: data.trial_ends_at
          ? new Date(data.trial_ends_at)
          : undefined,
        trialUsed: data.trial_used,
        trialConverted: data.trial_converted,
        refundCount: data.refund_count,
        lastRefundedAt: data.last_refunded_at
          ? new Date(data.last_refunded_at)
          : undefined,
        refundReason: data.refund_reason ?? undefined,
      };

      setEntitlement(ent);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("获取权益失败"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntitlement();
  }, [fetchEntitlement]);

  // 计算便捷属性
  const planTier = entitlement?.planTier ?? "free";
  const isPaid = planTier !== "free";
  const isLifetime = entitlement?.isLifetime ?? false;

  // 试用期计算
  const isInTrial = (() => {
    if (!entitlement?.trialEndsAt) return false;
    if (entitlement.validUntil) return false; // 已付费
    return new Date() < entitlement.trialEndsAt;
  })();

  const trialDaysLeft = (() => {
    if (!isInTrial || !entitlement?.trialEndsAt) return null;
    const diff = entitlement.trialEndsAt.getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  })();

  return {
    entitlement,
    isLoading,
    error,
    refetch: fetchEntitlement,
    planTier,
    isPaid,
    isLifetime,
    isInTrial,
    trialDaysLeft,
  };
}

/**
 * 便捷 Hook：检查是否为付费用户
 */
export function useIsPaidUser(): boolean {
  const { isPaid } = useEntitlement();
  return isPaid;
}

/**
 * 便捷 Hook：获取当前套餐等级
 */
export function usePlanTier(): PlanTier {
  const { planTier } = useEntitlement();
  return planTier;
}
