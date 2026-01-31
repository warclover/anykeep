/**
 * Trial Service - 试用期管理服务
 * 7 天免费 Pro 试用
 */

import { createClient } from "@/lib/supabase/server";
import type { TrialResult } from "../types";
import { TRIAL_CONFIG, QUOTA_CONFIG } from "../config";

class TrialService {
  /**
   * 开启试用期
   */
  async startTrial(userId: string): Promise<TrialResult> {
    const supabase = await createClient();

    // 检查是否已使用试用
    const { data: existing } = await supabase
      .from("user_entitlements")
      .select("trial_used, plan_tier")
      .eq("user_id", userId)
      .single();

    if (existing?.trial_used) {
      return { success: false, reason: "TRIAL_ALREADY_USED" };
    }

    // 如果已经是付费用户，不需要试用
    if (existing?.plan_tier && existing.plan_tier !== "free") {
      return { success: false, reason: "TRIAL_ALREADY_USED" };
    }

    const trialTier = TRIAL_CONFIG.trialTier;
    const config = QUOTA_CONFIG[trialTier];
    const now = new Date();
    const trialEndsAt = new Date(
      now.getTime() + TRIAL_CONFIG.durationDays * 24 * 60 * 60 * 1000,
    );

    await supabase.from("user_entitlements").upsert(
      {
        user_id: userId,
        plan_tier: trialTier,
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEndsAt.toISOString(),
        trial_used: true,
        ai_quota_monthly: config.aiMonthly,
        ai_quota_daily_limit: config.aiDaily,
        storage_limit_mb: config.storageMb,
        tts_seconds_monthly: config.ttsHours * 3600,
      },
      { onConflict: "user_id" },
    );

    return { success: true, trialEndsAt };
  }

  /**
   * 检查用户是否在试用期
   */
  async isInTrial(userId: string): Promise<boolean> {
    const supabase = await createClient();

    const { data } = await supabase
      .from("user_entitlements")
      .select("trial_ends_at, valid_until")
      .eq("user_id", userId)
      .single();

    if (!data?.trial_ends_at) return false;
    if (data.valid_until) return false; // 已付费

    return new Date() < new Date(data.trial_ends_at);
  }

  /**
   * 获取试用期剩余天数
   */
  async getTrialDaysRemaining(userId: string): Promise<number | null> {
    const supabase = await createClient();

    const { data } = await supabase
      .from("user_entitlements")
      .select("trial_ends_at, valid_until")
      .eq("user_id", userId)
      .single();

    if (!data?.trial_ends_at) return null;
    if (data.valid_until) return null;

    const trialEnd = new Date(data.trial_ends_at);
    const now = new Date();

    if (now >= trialEnd) return 0;

    const diffMs = trialEnd.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * 检查是否可以开始试用
   */
  async canStartTrial(userId: string): Promise<boolean> {
    const supabase = await createClient();

    const { data } = await supabase
      .from("user_entitlements")
      .select("trial_used, plan_tier")
      .eq("user_id", userId)
      .single();

    // 未使用过试用 且 是免费用户
    if (!data) return true;
    if (data.trial_used) return false;
    if (data.plan_tier !== "free") return false;

    return true;
  }

  /**
   * 处理过期试用用户（批量降级）
   * 由定时任务调用
   */
  async processExpiredTrials(): Promise<number> {
    const supabase = await createClient();
    const now = new Date();
    const freeConfig = QUOTA_CONFIG.free;

    // 查找已过期的试用用户（没有 valid_until 说明没付费）
    const { data: expiredUsers, error } = await supabase
      .from("user_entitlements")
      .select("user_id")
      .lt("trial_ends_at", now.toISOString())
      .is("valid_until", null)
      .neq("plan_tier", "free");

    if (error || !expiredUsers?.length) return 0;

    const userIds = expiredUsers.map((u) => u.user_id);

    // 批量降级
    await supabase
      .from("user_entitlements")
      .update({
        plan_tier: "free",
        ai_quota_monthly: freeConfig.aiMonthly,
        ai_quota_daily_limit: freeConfig.aiDaily,
        storage_limit_mb: freeConfig.storageMb,
        tts_seconds_monthly: 0,
      })
      .in("user_id", userIds);

    return userIds.length;
  }

  /**
   * 标记试用转化（用户付费后调用）
   */
  async markTrialConverted(userId: string): Promise<void> {
    const supabase = await createClient();

    await supabase
      .from("user_entitlements")
      .update({ trial_converted: true })
      .eq("user_id", userId);
  }

  /**
   * 新用户注册时自动开启试用
   */
  async onUserCreated(userId: string): Promise<void> {
    // 自动开启试用
    await this.startTrial(userId);
  }
}

export const trialService = new TrialService();
