import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BatteryState, BatteryLevel } from "../../types";
import { logger } from "@/lib/logger";

const FREE_DAILY_LIMIT = 5;

export function useBattery() {
  const [state, setState] = useState<BatteryState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // 获取配额状态
  const fetchState = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setState(null);
        return;
      }

      // 检查是否为 Pro 用户
      const { data: entitlements } = await supabase
        .from("user_entitlements")
        .select("plan_tier, ai_quota_daily_limit")
        .eq("user_id", user.id)
        .single();

      const isPro = entitlements?.plan_tier !== "free";

      if (isPro) {
        setState({
          level: "full",
          remaining: -1,
          total: -1,
          resetAt: new Date(),
          isPro: true,
        });
        return;
      }

      // 获取今日使用量
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const { data: quota } = await supabase
        .from("user_quota_usage")
        .select("ai_calls_today, last_call_date")
        .eq("user_id", user.id)
        .eq("month", currentMonth)
        .single();

      const today = getLocalDateString();
      const lastCallDate = quota?.last_call_date;
      const dailyLimit = entitlements?.ai_quota_daily_limit || FREE_DAILY_LIMIT;

      // 如果日期变了，重置计数
      let todayUsed = quota?.ai_calls_today || 0;
      if (lastCallDate !== today) {
        todayUsed = 0;
      }

      const remaining = Math.max(0, dailyLimit - todayUsed);

      setState({
        level: calculateLevel(remaining, dailyLimit),
        remaining,
        total: dailyLimit,
        resetAt: getNextResetTime(),
        isPro: false,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch battery state"),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // 消耗一次配额
  const consume = useCallback(async (): Promise<boolean> => {
    if (!state) return false;
    if (state.isPro) return true;
    if (state.remaining <= 0) return false;

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;

      const today = getLocalDateString();
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

      await supabase.from("user_quota_usage").upsert(
        {
          user_id: user.id,
          month: currentMonth,
          ai_calls_today: state.total - state.remaining + 1,
          last_call_date: today,
        },
        { onConflict: "user_id,month" },
      );

      // 更新本地状态
      setState((prev) =>
        prev
          ? {
              ...prev,
              remaining: prev.remaining - 1,
              level: calculateLevel(prev.remaining - 1, prev.total),
            }
          : null,
      );

      return true;
    } catch (error) {
      logger.error({ error }, "[useBattery] Failed to consume quota:");
      return false;
    }
  }, [state]);

  // 初始化 - 仅在挂载时执行一次
  useEffect(() => {
    fetchState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    level: state?.level || "full",
    remaining: state?.remaining || 0,
    total: state?.total || FREE_DAILY_LIMIT,
    resetAt: state?.resetAt || new Date(),
    isPro: state?.isPro || false,
    loading,
    error,
    canUse: state ? state.isPro || state.remaining > 0 : true,
    consume,
    refresh: fetchState,
  };
}

function calculateLevel(remaining: number, total: number): BatteryLevel {
  if (remaining <= 0) return "empty";
  const ratio = remaining / total;
  if (ratio > 0.5) return "full";
  if (ratio > 0.2) return "medium";
  return "low";
}

function getLocalDateString(): string {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
}

function getNextResetTime(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}
