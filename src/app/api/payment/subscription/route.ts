/**
 * Subscription API - 订阅查询与管理
 * GET /api/payment/subscription - 查询订阅
 * DELETE /api/payment/subscription - 取消订阅
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { subscriptionService } from "@/lib/payment/services/subscription.service";
import { entitlementService } from "@/lib/payment/services/entitlement.service";
import { logger } from "@/lib/logger";

/**
 * GET - 获取当前用户订阅状态
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 },
      );
    }

    const [subscription, entitlement] = await Promise.all([
      subscriptionService.getSubscription(user.id),
      entitlementService.getEntitlement(user.id),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        subscription: subscription
          ? {
              id: subscription.id,
              status: subscription.status,
              planId: subscription.planId,
              currentPeriodEnd: subscription.currentPeriodEnd,
              cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
              canceledAt: subscription.canceledAt,
            }
          : null,
        entitlement: {
          planTier: entitlement.planTier,
          validUntil: entitlement.validUntil,
          isLifetime: entitlement.isLifetime,
          aiQuotaMonthly: entitlement.aiQuotaMonthly,
          storageLimitMb: entitlement.storageLimitMb,
          trialEndsAt: entitlement.trialEndsAt,
          isInTrial:
            entitlement.trialEndsAt && !entitlement.validUntil
              ? new Date() < entitlement.trialEndsAt
              : false,
        },
      },
    });
  } catch (error) {
    logger.error({ error }, "[Subscription GET] Error");
    return NextResponse.json(
      { error: { code: "FETCH_FAILED", message: "获取订阅信息失败" } },
      { status: 500 },
    );
  }
}

/**
 * DELETE - 取消订阅（期末生效）
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const reason = body.reason || "user_requested";

    const result = await subscriptionService.cancelSubscription(
      user.id,
      reason,
    );

    if (!result.success) {
      return NextResponse.json(
        { error: { code: "CANCEL_FAILED", message: result.error } },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        canceledAt: result.canceledAt,
        effectiveAt: result.effectiveAt,
        message: "订阅已取消，将在当前计费周期结束后生效",
      },
    });
  } catch (error) {
    logger.error({ error }, "[Subscription DELETE] Error");
    return NextResponse.json(
      { error: { code: "CANCEL_FAILED", message: "取消订阅失败" } },
      { status: 500 },
    );
  }
}

/**
 * PATCH - 恢复已取消的订阅
 */
export async function PATCH() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 },
      );
    }

    const success = await subscriptionService.resumeSubscription(user.id);

    if (!success) {
      return NextResponse.json(
        { error: { code: "RESUME_FAILED", message: "无法恢复订阅" } },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        message: "订阅已恢复",
      },
    });
  } catch (error) {
    logger.error({ error }, "[Subscription PATCH] Error");
    return NextResponse.json(
      { error: { code: "RESUME_FAILED", message: "恢复订阅失败" } },
      { status: 500 },
    );
  }
}
