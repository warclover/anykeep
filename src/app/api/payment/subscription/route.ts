/**
 * Subscription API - 订阅查询与管理
 * GET /api/payment/subscription - 查询订阅
 * DELETE /api/payment/subscription - 取消订阅
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { subscriptionService } from "@/lib/payment/services/subscription.service";
import { entitlementService } from "@/lib/payment/services/entitlement.service";

/**
 * GET - 获取当前用户订阅状态
 */
export const GET = withAuthMiddleware(
  async (_request: NextRequest, { userId }) => {
    const [subscription, entitlement] = await Promise.all([
      subscriptionService.getSubscription(userId),
      entitlementService.getEntitlement(userId),
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
  },
);

/**
 * DELETE - 取消订阅（期末生效）
 */
export const DELETE = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const body = await request.json().catch(() => ({}));
    const reason = body.reason || "user_requested";

    const result = await subscriptionService.cancelSubscription(userId, reason);

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
  },
);

/**
 * PATCH - 恢复已取消的订阅
 */
export const PATCH = withAuthMiddleware(
  async (_request: NextRequest, { userId }) => {
    const success = await subscriptionService.resumeSubscription(userId);

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
  },
);
