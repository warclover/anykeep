/**
 * Subscription Service - 订阅管理服务
 * 处理订阅创建、更新、取消、退款
 */

import { createClient } from "@/lib/supabase/server";
import type {
  UserSubscription,
  PaymentProvider,
  SubscriptionStatus,
  PlanTier,
  CancelSubscriptionResult,
} from "../types";
import { entitlementService } from "./entitlement.service";
import { QUOTA_CONFIG, GRACE_PERIOD } from "../config";
import {
  InvalidSubscriptionError,
  DuplicateSubscriptionError,
} from "../errors";

interface ActivateSubscriptionParams {
  userId: string;
  planId: string;
  planTier: PlanTier;
  provider: PaymentProvider;
  providerSubscriptionId?: string;
  providerCustomerId?: string;
  periodEnd: Date;
  isLifetime?: boolean;
}

class SubscriptionService {
  /**
   * 获取用户订阅
   */
  async getSubscription(userId: string): Promise<UserSubscription | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("user_subscriptions")
      .select(
        `
        *,
        plan:subscription_plans(*)
      `,
      )
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToSubscription(data);
  }

  /**
   * 激活订阅
   */
  async activateSubscription(
    params: ActivateSubscriptionParams,
  ): Promise<void> {
    const supabase = await createClient();

    // 检查是否已有活跃订阅
    const existing = await this.getSubscription(params.userId);
    if (existing && existing.status === "active" && !params.isLifetime) {
      throw new DuplicateSubscriptionError(
        existing.plan?.displayName || existing.planId,
      );
    }

    const now = new Date();

    // 创建或更新订阅记录
    await supabase.from("user_subscriptions").upsert(
      {
        user_id: params.userId,
        plan_id: params.planId,
        status: "active",
        payment_provider: params.provider,
        provider_subscription_id: params.providerSubscriptionId,
        provider_customer_id: params.providerCustomerId,
        current_period_start: now.toISOString(),
        current_period_end: params.periodEnd.toISOString(),
        cancel_at_period_end: false,
        canceled_at: null,
      },
      { onConflict: "user_id" },
    );

    // 同步权益表
    await entitlementService.activatePlan(
      params.userId,
      params.planTier,
      params.periodEnd,
      params.isLifetime,
    );
  }

  /**
   * 取消订阅（期末生效）
   */
  async cancelSubscription(
    userId: string,
    reason?: string,
  ): Promise<CancelSubscriptionResult> {
    const supabase = await createClient();

    const subscription = await this.getSubscription(userId);
    if (!subscription) {
      return { success: false, error: "未找到订阅" };
    }

    if (subscription.status !== "active") {
      return { success: false, error: "订阅状态无效" };
    }

    const now = new Date();

    await supabase
      .from("user_subscriptions")
      .update({
        cancel_at_period_end: true,
        canceled_at: now.toISOString(),
        cancellation_reason: reason,
      })
      .eq("user_id", userId);

    return {
      success: true,
      canceledAt: now,
      effectiveAt: subscription.currentPeriodEnd,
    };
  }

  /**
   * 立即撤销订阅（用于退款）
   */
  async revokeSubscription(userId: string, reason: string): Promise<void> {
    const supabase = await createClient();

    await supabase
      .from("user_subscriptions")
      .update({
        status: "refunded",
        canceled_at: new Date().toISOString(),
        cancellation_reason: reason,
      })
      .eq("user_id", userId);

    // 降级权益
    await entitlementService.downgradeToFree(userId, reason);
  }

  /**
   * 标记为取消状态
   */
  async markCanceled(userId: string, reason?: string): Promise<void> {
    const supabase = await createClient();

    await supabase
      .from("user_subscriptions")
      .update({
        status: "canceled",
        canceled_at: new Date().toISOString(),
        cancellation_reason: reason,
      })
      .eq("user_id", userId);
  }

  /**
   * 标记为欠费状态
   */
  async markPastDue(userId: string): Promise<void> {
    const supabase = await createClient();

    await supabase
      .from("user_subscriptions")
      .update({ status: "past_due" })
      .eq("user_id", userId);
  }

  /**
   * 设置宽限期
   */
  async setGracePeriod(
    userId: string,
    days: number = GRACE_PERIOD.daysAfterExpiry,
  ): Promise<void> {
    const supabase = await createClient();

    const graceEnd = new Date();
    graceEnd.setDate(graceEnd.getDate() + days);

    await supabase
      .from("user_subscriptions")
      .update({
        status: "expired",
        grace_period_end: graceEnd.toISOString(),
      })
      .eq("user_id", userId);
  }

  /**
   * 更新套餐
   */
  async updatePlan(
    userId: string,
    newPlanId: string,
    newPlanTier: PlanTier,
  ): Promise<void> {
    const supabase = await createClient();

    const subscription = await this.getSubscription(userId);
    if (!subscription) {
      throw new InvalidSubscriptionError("未找到订阅", undefined);
    }

    await supabase
      .from("user_subscriptions")
      .update({ plan_id: newPlanId })
      .eq("user_id", userId);

    // 更新权益
    const config = QUOTA_CONFIG[newPlanTier];
    await entitlementService.upsertEntitlement(userId, {
      planTier: newPlanTier,
      aiQuotaMonthly: config.aiMonthly,
      aiQuotaDailyLimit: config.aiDaily,
      storageLimitMb: config.storageMb,
      ttsSecondsMonthly: config.ttsHours * 3600,
    });
  }

  /**
   * 恢复订阅（取消取消）
   */
  async resumeSubscription(userId: string): Promise<boolean> {
    const supabase = await createClient();

    const subscription = await this.getSubscription(userId);
    if (!subscription || !subscription.cancelAtPeriodEnd) {
      return false;
    }

    // 只有在当期结束前才能恢复
    if (new Date() > subscription.currentPeriodEnd) {
      return false;
    }

    await supabase
      .from("user_subscriptions")
      .update({
        cancel_at_period_end: false,
        canceled_at: null,
        cancellation_reason: null,
      })
      .eq("user_id", userId);

    return true;
  }

  /**
   * 处理过期订阅（由定时任务调用）
   */
  async processExpiredSubscriptions(): Promise<number> {
    const supabase = await createClient();
    const now = new Date();

    // 查��已过期且宽限期也结束的订阅
    const { data: expired } = await supabase
      .from("user_subscriptions")
      .select("user_id")
      .eq("status", "expired")
      .lt("grace_period_end", now.toISOString());

    if (!expired?.length) return 0;

    // 批量降级
    for (const sub of expired) {
      if (sub.user_id) {
        await entitlementService.downgradeToFree(sub.user_id, "expired");
      }
    }

    // 更新状态
    await supabase
      .from("user_subscriptions")
      .update({ status: "canceled" })
      .in(
        "user_id",
        expired.map((s) => s.user_id),
      );

    return expired.length;
  }

  /**
   * 数据库行转业务对象
   */
  private mapDbToSubscription(row: Record<string, unknown>): UserSubscription {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      planId: row.plan_id as string,
      status: row.status as SubscriptionStatus,
      paymentProvider: row.payment_provider as PaymentProvider,
      providerSubscriptionId: row.provider_subscription_id as
        | string
        | undefined,
      providerCustomerId: row.provider_customer_id as string | undefined,
      currentPeriodStart: new Date(row.current_period_start as string),
      currentPeriodEnd: new Date(row.current_period_end as string),
      trialEnd: row.trial_end ? new Date(row.trial_end as string) : undefined,
      gracePeriodEnd: row.grace_period_end
        ? new Date(row.grace_period_end as string)
        : undefined,
      cancelAtPeriodEnd: row.cancel_at_period_end as boolean,
      canceledAt: row.canceled_at
        ? new Date(row.canceled_at as string)
        : undefined,
      cancellationReason: row.cancellation_reason as string | undefined,
      plan: row.plan as UserSubscription["plan"],
      metadata: row.metadata as Record<string, unknown>,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

export const subscriptionService = new SubscriptionService();
