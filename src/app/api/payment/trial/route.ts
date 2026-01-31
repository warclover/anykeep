/**
 * Trial API - 试用期管理
 * POST /api/payment/trial - 开启试用
 * GET /api/payment/trial - 查询试用状态
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { trialService } from "@/lib/payment/services/trial.service";

/**
 * POST - 开启 7 天免费试用
 */
export async function POST() {
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

    const result = await trialService.startTrial(user.id);

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
  } catch (error) {
    console.error("[Trial POST] Error:", error);
    return NextResponse.json(
      { error: { code: "TRIAL_FAILED", message: "开启试用失败" } },
      { status: 500 },
    );
  }
}

/**
 * GET - 查询试用状态
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

    const [isInTrial, daysRemaining, canStart] = await Promise.all([
      trialService.isInTrial(user.id),
      trialService.getTrialDaysRemaining(user.id),
      trialService.canStartTrial(user.id),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        isInTrial,
        daysRemaining,
        canStartTrial: canStart,
      },
    });
  } catch (error) {
    console.error("[Trial GET] Error:", error);
    return NextResponse.json(
      { error: { code: "FETCH_FAILED", message: "获取试用状态失败" } },
      { status: 500 },
    );
  }
}
