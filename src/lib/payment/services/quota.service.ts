/**
 * Quota Service - 配额管理服务
 * 负责配额检查、消耗、熔断
 */

import { createClient } from "@/lib/supabase/server";
import type { QuotaUsage, QuotaCheckResult, PlanTier } from "../types";
import { entitlementService } from "./entitlement.service";
import { getCurrentBillingMonth } from "../config";
import { QuotaExceededError } from "../errors";

export type QuotaType = "ai" | "ai_daily" | "storage" | "tts" | "synthesis";

class QuotaService {
  /**
   * 获取用户配额使用情况
   */
  async getQuotaUsage(userId: string): Promise<QuotaUsage> {
    const supabase = await createClient();
    const currentMonth = getCurrentBillingMonth();

    // 并行获取权益和使用量
    const [entitlement, usageResult] = await Promise.all([
      entitlementService.getEntitlement(userId),
      supabase
        .from("user_quota_usage")
        .select("*")
        .eq("user_id", userId)
        .eq("month", currentMonth)
        .single(),
    ]);

    const usage = usageResult.data;

    // 计算限制
    const aiLimit = entitlement.aiQuotaMonthly;
    const aiDailyLimit = entitlement.aiQuotaDailyLimit;
    const storageLimit = entitlement.storageLimitMb;
    const ttsLimit = entitlement.ttsSecondsMonthly;
    const synthesisLimit = this.getSynthesisLimit(entitlement.planTier);

    // 计算使用量
    const aiUsed = usage?.ai_calls_used ?? 0;
    const aiToday = usage?.ai_calls_today ?? 0;
    const storageUsed = usage?.storage_used_mb ?? 0;
    const ttsUsed = usage?.tts_seconds_used ?? 0;
    const synthesisUsed = usage?.synthesis_count ?? 0;

    return {
      aiCallsUsed: aiUsed,
      aiCallsLimit: aiLimit,
      aiCallsToday: aiToday,
      aiCallsDailyLimit: aiDailyLimit,
      storageUsedMb: storageUsed,
      storageLimitMb: storageLimit,
      ttsSecondsUsed: ttsUsed,
      ttsSecondsLimit: ttsLimit,
      synthesisCount: synthesisUsed,
      synthesisLimit: synthesisLimit,
      isOverLimit: aiUsed >= aiLimit || storageUsed >= storageLimit,
      isOverDailyLimit: aiToday >= aiDailyLimit,
    };
  }

  /**
   * 检查配额
   */
  async checkQuota(
    userId: string,
    type: QuotaType,
    amount: number = 1,
  ): Promise<QuotaCheckResult> {
    const usage = await this.getQuotaUsage(userId);

    switch (type) {
      case "ai": {
        const remaining = usage.aiCallsLimit - usage.aiCallsUsed;
        if (remaining < amount) {
          return {
            allowed: false,
            remaining: Math.max(0, remaining),
            reason:
              usage.aiCallsLimit <= 20
                ? "免费配额已用完，升级 Pro 获取更多 AI 能力"
                : "本月 AI 配额已用完，下月自动重置",
            upgradeRequired: usage.aiCallsLimit <= 20,
          };
        }
        return { allowed: true, remaining };
      }

      case "ai_daily": {
        const remaining = usage.aiCallsDailyLimit - usage.aiCallsToday;
        if (remaining < amount) {
          return {
            allowed: false,
            remaining: 0,
            reason: "已触发单日熔断限制，请明天再试",
            upgradeRequired: false,
          };
        }
        return { allowed: true, remaining };
      }

      case "storage": {
        const remaining = usage.storageLimitMb - usage.storageUsedMb;
        if (remaining < amount) {
          return {
            allowed: false,
            remaining: Math.max(0, remaining),
            reason:
              usage.storageLimitMb <= 100
                ? "免费存储空间已满，升级获取更多空间"
                : "存储空间已满，请清理或升级套餐",
            upgradeRequired: usage.storageLimitMb <= 100,
          };
        }
        return { allowed: true, remaining };
      }

      case "tts": {
        const remaining = usage.ttsSecondsLimit - usage.ttsSecondsUsed;
        if (remaining < amount) {
          return {
            allowed: false,
            remaining: Math.max(0, remaining),
            reason: "本月 TTS 配额已用完",
            upgradeRequired: usage.ttsSecondsLimit === 0,
          };
        }
        return { allowed: true, remaining };
      }

      case "synthesis": {
        if (usage.synthesisLimit === -1) {
          return { allowed: true, remaining: Infinity };
        }
        const remaining = usage.synthesisLimit - usage.synthesisCount;
        if (remaining < amount) {
          return {
            allowed: false,
            remaining: Math.max(0, remaining),
            reason: "本月主题合成次数已用完",
            upgradeRequired: usage.synthesisLimit === 0,
          };
        }
        return { allowed: true, remaining };
      }

      default:
        return { allowed: true, remaining: Infinity };
    }
  }

  /**
   * 消耗配额（带检查）
   */
  async consumeQuota(
    userId: string,
    type: QuotaType,
    amount: number = 1,
  ): Promise<void> {
    // 先检查
    const check = await this.checkQuota(userId, type, amount);
    if (!check.allowed) {
      throw new QuotaExceededError(type, 0, 0, check.reason);
    }

    const supabase = await createClient();
    const currentMonth = getCurrentBillingMonth();

    // 映射字段
    const fieldMap: Record<QuotaType, string> = {
      ai: "ai_calls_used",
      ai_daily: "ai_calls_today",
      storage: "storage_used_mb",
      tts: "tts_seconds_used",
      synthesis: "synthesis_count",
    };

    const field = fieldMap[type];

    // 使用数据库函数增量更新
    await supabase.rpc("increment_quota_usage", {
      p_user_id: userId,
      p_month: currentMonth,
      p_field: field,
      p_amount: amount,
    });

    // AI 调用同时增加每日计数
    if (type === "ai") {
      await supabase.rpc("increment_daily_ai_calls", {
        p_user_id: userId,
        p_month: currentMonth,
      });
    }
  }

  /**
   * 检查并消耗 AI 配额（常用快捷方法）
   */
  async consumeAIQuota(
    userId: string,
    count: number = 1,
  ): Promise<QuotaCheckResult> {
    // 同时检查月配额和日配额
    const [monthCheck, dailyCheck] = await Promise.all([
      this.checkQuota(userId, "ai", count),
      this.checkQuota(userId, "ai_daily", count),
    ]);

    if (!monthCheck.allowed) {
      return monthCheck;
    }
    if (!dailyCheck.allowed) {
      return dailyCheck;
    }

    await this.consumeQuota(userId, "ai", count);
    return { allowed: true, remaining: monthCheck.remaining - count };
  }

  /**
   * 获取主题合成限制
   */
  private getSynthesisLimit(planTier: PlanTier): number {
    const limits: Record<PlanTier, number> = {
      free: 0,
      pro: 10,
      pro_plus: -1, // 无限
      lifetime: 10,
    };
    return limits[planTier];
  }

  /**
   * 重置月度配额（由定时任务调用）
   */
  async resetMonthlyQuota(userId: string): Promise<void> {
    const supabase = await createClient();
    const currentMonth = getCurrentBillingMonth();

    await supabase.from("user_quota_usage").upsert(
      {
        user_id: userId,
        month: currentMonth,
        ai_calls_used: 0,
        ai_calls_today: 0,
        tts_seconds_used: 0,
        synthesis_count: 0,
        // storage_used_mb 不重置
      },
      { onConflict: "user_id,month" },
    );
  }
}

export const quotaService = new QuotaService();
