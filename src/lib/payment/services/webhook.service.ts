/**
 * Webhook Service - Webhook 处理服务
 * 幂等性保障 + 事件分发
 */

import { createClient } from "@/lib/supabase/server";
import type {
  WebhookEvent,
  WebhookProcessResult,
  PaymentProvider,
  PlanTier,
} from "../types";
import { subscriptionService } from "./subscription.service";
import { WebhookError } from "../errors";

// Provider 到 PlanTier 的映射（需要根据实际产品 ID 配置）
const VARIANT_TO_PLAN: Record<string, PlanTier> = {
  // Lemon Squeezy variants (配置后填充)
  // 'variant_123': 'pro',
  // 'variant_456': 'pro_plus',
  // 'variant_789': 'lifetime',
};

class WebhookService {
  /**
   * 处理 Webhook 事件（入口方法）
   */
  async handleWebhook(event: WebhookEvent): Promise<WebhookProcessResult> {
    try {
      // 1. 幂等性检查
      const isProcessed = await this.isEventProcessed(event.provider, event.id);
      if (isProcessed) {
        return {
          success: true,
          eventId: event.id,
          action: "skipped_duplicate",
        };
      }

      // 2. 记录原始事件
      await this.logEvent(event);

      // 3. 处理业务逻辑
      const action = await this.processEvent(event);

      // 4. 标记为已处理
      await this.markEventAsProcessed(event.provider, event.id);

      return {
        success: true,
        eventId: event.id,
        action,
      };
    } catch (error) {
      // 记录错误但不标记为已处理，允许重试
      await this.recordEventError(event.provider, event.id, error);

      return {
        success: false,
        eventId: event.id,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 检查事件是否已处理
   */
  private async isEventProcessed(
    provider: PaymentProvider,
    eventId: string,
  ): Promise<boolean> {
    const supabase = await createClient();

    const { data } = await supabase
      .from("payment_events")
      .select("processed")
      .eq("provider", provider)
      .eq("event_id", eventId)
      .single();

    return data?.processed === true;
  }

  /**
   * 记录原始事件
   */
  private async logEvent(event: WebhookEvent): Promise<void> {
    const supabase = await createClient();

    await supabase.from("payment_events").upsert(
      {
        provider: event.provider,
        event_id: event.id,
        event_type: event.type,
        payload: event.data,
        processed: false,
      },
      { onConflict: "provider,event_id" },
    );
  }

  /**
   * 处理具体事件
   */
  private async processEvent(event: WebhookEvent): Promise<string> {
    switch (event.type) {
      case "subscription.created":
      case "payment.succeeded":
        await this.handlePaymentSucceeded(event);
        return "subscription_activated";

      case "subscription.updated":
        await this.handleSubscriptionUpdated(event);
        return "subscription_updated";

      case "subscription.canceled":
        await this.handleSubscriptionCanceled(event);
        return "subscription_canceled";

      case "subscription.expired":
        await this.handleSubscriptionExpired(event);
        return "subscription_expired";

      case "payment.refunded":
        await this.handlePaymentRefunded(event);
        return "subscription_refunded";

      case "payment.failed":
        await this.handlePaymentFailed(event);
        return "payment_failed";

      default:
        return "unknown_event";
    }
  }

  /**
   * 处理支付成功
   */
  private async handlePaymentSucceeded(event: WebhookEvent): Promise<void> {
    const userId = this.extractUserId(event);
    const planInfo = this.extractPlanInfo(event);

    if (!userId || !planInfo) {
      throw new WebhookError(
        "Missing userId or planInfo",
        event.id,
        event.type,
      );
    }

    const { planTier, planId, isLifetime } = planInfo;
    const periodEnd = this.extractPeriodEnd(event, isLifetime);

    await subscriptionService.activateSubscription({
      userId,
      planId,
      planTier,
      provider: event.provider,
      providerSubscriptionId: event.data.subscription_id as string,
      providerCustomerId: event.data.customer_id as string,
      periodEnd,
      isLifetime,
    });
  }

  /**
   * 处理订阅更新（升级/降级）
   */
  private async handleSubscriptionUpdated(event: WebhookEvent): Promise<void> {
    const userId = this.extractUserId(event);
    const planInfo = this.extractPlanInfo(event);

    if (!userId || !planInfo) return;

    await subscriptionService.updatePlan(
      userId,
      planInfo.planId,
      planInfo.planTier,
    );
  }

  /**
   * 处理订阅取消
   */
  private async handleSubscriptionCanceled(event: WebhookEvent): Promise<void> {
    const userId = this.extractUserId(event);
    if (!userId) return;

    const reason =
      (event.data.cancellation_reason as string) || "user_requested";
    await subscriptionService.markCanceled(userId, reason);
  }

  /**
   * 处理订阅过期
   */
  private async handleSubscriptionExpired(event: WebhookEvent): Promise<void> {
    const userId = this.extractUserId(event);
    if (!userId) return;

    // 设置 7 天宽限期
    await subscriptionService.setGracePeriod(userId, 7);
  }

  /**
   * 处理退款 - 立即撤销权限
   */
  private async handlePaymentRefunded(event: WebhookEvent): Promise<void> {
    const userId = this.extractUserId(event);
    if (!userId) {
      throw new WebhookError(
        "Missing userId in refund event",
        event.id,
        event.type,
      );
    }

    await subscriptionService.revokeSubscription(userId, "refunded");

    // 更新支付记录
    const supabase = await createClient();
    await supabase
      .from("payment_records")
      .update({ status: "refunded" })
      .eq("provider_payment_id", event.data.payment_id as string);
  }

  /**
   * 处理支付失败
   */
  private async handlePaymentFailed(event: WebhookEvent): Promise<void> {
    const userId = this.extractUserId(event);
    if (!userId) return;

    await subscriptionService.markPastDue(userId);
  }

  /**
   * 标记事件为已处理
   */
  private async markEventAsProcessed(
    provider: PaymentProvider,
    eventId: string,
  ): Promise<void> {
    const supabase = await createClient();

    await supabase
      .from("payment_events")
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq("provider", provider)
      .eq("event_id", eventId);
  }

  /**
   * 记录事件处理错误
   */
  private async recordEventError(
    provider: PaymentProvider,
    eventId: string,
    error: unknown,
  ): Promise<void> {
    const supabase = await createClient();

    await supabase
      .from("payment_events")
      .update({
        error_message: error instanceof Error ? error.message : String(error),
        retry_count: supabase.sql`retry_count + 1`,
      })
      .eq("provider", provider)
      .eq("event_id", eventId);
  }

  /**
   * 从事件数据中提取用户 ID
   */
  private extractUserId(event: WebhookEvent): string | null {
    // Lemon Squeezy: meta.custom_data.user_id
    if (event.provider === "lemonsqueezy") {
      const meta = event.data.meta as Record<string, unknown> | undefined;
      const customData = meta?.custom_data as
        | Record<string, unknown>
        | undefined;
      return (customData?.user_id as string) || null;
    }

    // YunGouOS: attach (JSON string)
    if (event.provider === "yungouos") {
      try {
        const attach = JSON.parse(event.data.attach as string);
        return attach.user_id || null;
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * 从事件数据中提取套餐信息
   */
  private extractPlanInfo(
    event: WebhookEvent,
  ): { planTier: PlanTier; planId: string; isLifetime: boolean } | null {
    if (event.provider === "lemonsqueezy") {
      const variantId = String(event.data.variant_id || "");
      const planTier = VARIANT_TO_PLAN[variantId];

      if (!planTier) {
        // 从 custom_data 获取
        const meta = event.data.meta as Record<string, unknown> | undefined;
        const customData = meta?.custom_data as
          | Record<string, unknown>
          | undefined;
        const tier = customData?.plan_tier as PlanTier | undefined;

        if (tier) {
          return {
            planTier: tier,
            planId: variantId,
            isLifetime: tier === "lifetime",
          };
        }
        return null;
      }

      return {
        planTier,
        planId: variantId,
        isLifetime: planTier === "lifetime",
      };
    }

    if (event.provider === "yungouos") {
      try {
        const attach = JSON.parse(event.data.attach as string);
        const planTier = attach.plan_tier as PlanTier;
        return {
          planTier,
          planId: attach.plan_id || planTier,
          isLifetime: planTier === "lifetime",
        };
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * 计算订阅期结束时间
   */
  private extractPeriodEnd(event: WebhookEvent, isLifetime: boolean): Date {
    if (isLifetime) {
      // 终身版：设置为 2099 年
      return new Date("2099-12-31T23:59:59Z");
    }

    // 从事件数据获取
    const periodEnd = event.data.current_period_end || event.data.renews_at;
    if (periodEnd) {
      return new Date(periodEnd as string);
    }

    // 默认：一年后
    const end = new Date();
    end.setFullYear(end.getFullYear() + 1);
    return end;
  }
}

export const webhookService = new WebhookService();
