/**
 * Trial API - 试用期管理
 * POST /api/payment/trial - 开启试用
 * GET /api/payment/trial - 查询试用状态
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { trialService } from "@/lib/payment/services/trial.service";

/**
 * POST - 开启 7 天免费试用
 */
export const POST = withAuthMiddleware(
  async (_request: NextRequest, { userId }) => {
    const result = await trialService.startTrial(userId);

    if (!result.success) {
      const message =
        result.reason === "TRIAL_ALREADY_USED"
          ? "您已使用过免费试用"
          : "无法开启试用";

      return NextResponse.json(
        { error: { code: result.reason, message } },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        trialEndsAt: result.trialEndsAt,
        message: "已开启 7 天 Pro 试用！",
      },
    });
  },
);

/**
 * GET - 查询试用状态
 */
export const GET = withAuthMiddleware(
  async (_request: NextRequest, { userId }) => {
    const [isInTrial, daysRemaining, canStart] = await Promise.all([
      trialService.isInTrial(userId),
      trialService.getTrialDaysRemaining(userId),
      trialService.canStartTrial(userId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        isInTrial,
        daysRemaining,
        canStartTrial: canStart,
      },
    });
  },
);
