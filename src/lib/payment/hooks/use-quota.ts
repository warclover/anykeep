/**
 * useQuota Hook - 配额使用情况
 * 客户端配额状态管理
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { QuotaUsage } from "../types";
import { useEntitlement } from "./use-entitlement";

// 获取当前计费月份
function getCurrentBillingMonth(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .slice(0, 7);
}

interface UseQuotaResult {
  quota: QuotaUsage | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  // 便捷属性
  aiRemaining: number;
  aiPercentUsed: number;
  storageRemaining: number;
  storagePercentUsed: number;
  isAIExhausted: boolean;
  isStorageFull: boolean;
}

export function useQuota(): UseQuotaResult {
  const { entitlement, isLoading: entitlementLoading } = useEntitlement();
  const [usage, setUsage] = useState<{
    aiCallsUsed: number;
    aiCallsToday: number;
    storageUsedMb: number;
    ttsSecondsUsed: number;
    synthesisCount: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUsage = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUsage(null);
        return;
      }

      const currentMonth = getCurrentBillingMonth();

      const { data, error: dbError } = await supabase
        .from("user_quota_usage")
        .select("*")
        .eq("user_id", user.id)
        .eq("month", currentMonth)
        .single();

      if (dbError && dbError.code !== "PGRST116") {
        throw new Error(dbError.message);
      }

      setUsage({
        aiCallsUsed: data?.ai_calls_used ?? 0,
        aiCallsToday: data?.ai_calls_today ?? 0,
        storageUsedMb: data?.storage_used_mb ?? 0,
        ttsSecondsUsed: data?.tts_seconds_used ?? 0,
        synthesisCount: data?.synthesis_count ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error("获取配额失败"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  // 组合权益和使用量
  const quota: QuotaUsage | null =
    entitlement && usage
      ? {
          aiCallsUsed: usage.aiCallsUsed,
          aiCallsLimit: entitlement.aiQuotaMonthly,
          aiCallsToday: usage.aiCallsToday,
          aiCallsDailyLimit: entitlement.aiQuotaDailyLimit,
          storageUsedMb: usage.storageUsedMb,
          storageLimitMb: entitlement.storageLimitMb,
          ttsSecondsUsed: usage.ttsSecondsUsed,
          ttsSecondsLimit: entitlement.ttsSecondsMonthly,
          synthesisCount: usage.synthesisCount,
          synthesisLimit: getSynthesisLimit(entitlement.planTier),
          isOverLimit: usage.aiCallsUsed >= entitlement.aiQuotaMonthly,
          isOverDailyLimit: usage.aiCallsToday >= entitlement.aiQuotaDailyLimit,
        }
      : null;

  // 便捷属性
  const aiRemaining = quota
    ? Math.max(0, quota.aiCallsLimit - quota.aiCallsUsed)
    : 0;
  const aiPercentUsed =
    quota && quota.aiCallsLimit > 0
      ? Math.min(100, (quota.aiCallsUsed / quota.aiCallsLimit) * 100)
      : 0;
  const storageRemaining = quota
    ? Math.max(0, quota.storageLimitMb - quota.storageUsedMb)
    : 0;
  const storagePercentUsed =
    quota && quota.storageLimitMb > 0
      ? Math.min(100, (quota.storageUsedMb / quota.storageLimitMb) * 100)
      : 0;

  return {
    quota,
    isLoading: isLoading || entitlementLoading,
    error,
    refetch: fetchUsage,
    aiRemaining,
    aiPercentUsed,
    storageRemaining,
    storagePercentUsed,
    isAIExhausted: quota?.isOverLimit ?? false,
    isStorageFull: storagePercentUsed >= 100,
  };
}

function getSynthesisLimit(planTier: string): number {
  const limits: Record<string, number> = {
    free: 0,
    pro: 10,
    pro_plus: -1,
    lifetime: 10,
  };
  return limits[planTier] ?? 0;
}

/**
 * 便捷 Hook：获取 AI 剩余次数
 */
export function useAIRemaining(): number {
  const { aiRemaining } = useQuota();
  return aiRemaining;
}

/**
 * 便捷 Hook：检查 AI 配额是否用完
 */
export function useIsAIExhausted(): boolean {
  const { isAIExhausted } = useQuota();
  return isAIExhausted;
}
