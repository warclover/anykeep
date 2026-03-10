/**
 * Lemon Squeezy Webhook API
 * POST /api/payment/webhook/lemonsqueezy
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { webhookService } from "@/lib/payment/services/webhook.service";
import type { WebhookEvent, WebhookEventType } from "@/lib/payment/types";
import { PAYMENT_CONFIG } from "@/lib/payment/config";
import { logger } from "@/lib/logger";

// Lemon Squeezy 事件类型映射
const LS_EVENT_MAP: Record<string, WebhookEventType> = {
  subscription_created: "subscription.created",
  subscription_updated: "subscription.updated",
  subscription_cancelled: "subscription.canceled",
  subscription_expired: "subscription.expired",
  subscription_payment_success: "payment.succeeded",
  subscription_payment_failed: "payment.failed",
  subscription_payment_refunded: "payment.refunded",
  order_created: "payment.succeeded",
  order_refunded: "payment.refunded",
};

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-signature");

    // 验证签名
    if (!verifySignature(rawBody, signature)) {
      logger.error("[LS Webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const eventName = payload.meta?.event_name;

    // 映射事件类型
    const eventType = LS_EVENT_MAP[eventName];
    if (!eventType) {
      logger.info({ eventName }, "[LS Webhook] Unknown event");
      return NextResponse.json({ received: true, skipped: true });
    }

    // 构造统一事件格式
    const event: WebhookEvent = {
      id: payload.meta?.webhook_id || crypto.randomUUID(),
      type: eventType,
      provider: "lemonsqueezy",
      data: {
        ...payload.data?.attributes,
        meta: payload.meta,
        subscription_id: payload.data?.id,
        customer_id: payload.data?.attributes?.customer_id,
        variant_id: payload.data?.attributes?.variant_id,
        current_period_end: payload.data?.attributes?.renews_at,
      },
      receivedAt: new Date(),
    };

    // 处理事件
    const result = await webhookService.handleWebhook(event);

    if (!result.success) {
      logger.error({ error: result.error }, "[LS Webhook] Processing failed");
      // 返回 500 让 LS 重试
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      received: true,
      eventId: result.eventId,
      action: result.action,
    });
  } catch (error) {
    logger.error({ error }, "[LS Webhook] Error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;

  const secret = PAYMENT_CONFIG.lemonsqueezy.webhookSecret;
  if (!secret) {
    logger.error(
      "[LS Webhook] LEMONSQUEEZY_WEBHOOK_SECRET not configured, rejecting request",
    );
    return false; // fail-safe：未配置密钥时拒绝所有请求
  }

  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(rawBody).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch {
    // Buffer 长度不一致时 timingSafeEqual 会抛异常
    return false;
  }
}
