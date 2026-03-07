/**
 * Checkout API - 创建支付会话
 * POST /api/payment/checkout
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import type { Currency, PlanTier, PaymentProvider } from "@/lib/payment/types";
import { PRICING, ORDER_CONFIG } from "@/lib/payment/config";

interface CheckoutRequest {
  planTier: PlanTier;
  currency: Currency;
  interval?: "monthly" | "yearly";
}

export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId, user }) => {
    const supabase = await createClient();

    const body: CheckoutRequest = await request.json();
    const { planTier, currency, interval = "yearly" } = body;

    // 验证套餐
    if (!["pro", "pro_plus", "lifetime"].includes(planTier)) {
      return NextResponse.json(
        { error: { code: "INVALID_PLAN", message: "无效的套餐" } },
        { status: 400 },
      );
    }

    // 检查是否已有活跃订阅
    const { data: existingSub } = await supabase
      .from("user_subscriptions")
      .select("status, plan_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (existingSub) {
      return NextResponse.json(
        {
          error: { code: "DUPLICATE_SUBSCRIPTION", message: "您已有有效订阅" },
        },
        { status: 409 },
      );
    }

    // LTD 限量检查
    if (planTier === "lifetime") {
      const { count } = await supabase
        .from("user_entitlements")
        .select("*", { count: "exact", head: true })
        .eq("is_lifetime", true);

      if ((count ?? 0) >= PRICING.lifetime.limit) {
        return NextResponse.json(
          { error: { code: "LTD_SOLD_OUT", message: "终身版限量已售罄" } },
          { status: 410 },
        );
      }
    }

    // 计算价格
    const price = getPrice(planTier, interval, currency);

    // 确定支付渠道
    const provider: PaymentProvider =
      currency === "CNY" ? "yungouos" : "lemonsqueezy";

    // 生成订单号
    const orderNo = generateOrderNo();

    // 计算过期时间
    const expiresAt = new Date(
      Date.now() + ORDER_CONFIG.expiryMinutes * 60 * 1000,
    );

    // 创建待支付订单
    const { data: order, error: orderError } = await supabase
      .from("payment_orders")
      .insert({
        order_no: orderNo,
        user_id: userId,
        amount: price,
        currency,
        status: "pending",
        payment_provider: provider,
        expires_at: expiresAt.toISOString(),
        metadata: {
          plan_tier: planTier,
          interval,
          email: user?.email,
        },
      })
      .select()
      .single();

    if (orderError) {
      throw orderError;
    }

    // 返回订单信息（实际支付 URL 由 Provider 生成）
    // 这里返回骨架，实际对接时填充 checkoutUrl
    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderNo: order.order_no,
        amount: price,
        currency,
        provider,
        expiresAt: expiresAt.toISOString(),
        // checkoutUrl 由具体 Provider 生成
        // checkoutUrl: 'https://...',
        // qrCodeUrl: 'https://...',  // 国内支付二维码
      },
    });
  },
);

function getPrice(
  planTier: PlanTier,
  interval: "monthly" | "yearly",
  currency: Currency,
): number {
  const currencyKey = currency.toLowerCase() as "cny" | "usd";

  if (planTier === "lifetime") {
    return PRICING.lifetime.price[currencyKey];
  }

  const tierPricing = PRICING[planTier as "pro" | "pro_plus"];
  return tierPricing[interval][currencyKey];
}

function generateOrderNo(): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .slice(0, 14);
  const random = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, "0");
  return `AK${timestamp}${random}`;
}
