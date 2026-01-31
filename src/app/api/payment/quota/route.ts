/**
 * Quota API - 配额查询
 * GET /api/payment/quota - 查询当前配额使用情况
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { quotaService } from "@/lib/payment/services/quota.service";

/**
 * GET - 获取当前用户配额使用情况
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

    const quota = await quotaService.getQuotaUsage(user.id);

    return NextResponse.json({
      success: true,
      data: {
        ai: {
          used: quota.aiCallsUsed,
          limit: quota.aiCallsLimit,
          remaining: Math.max(0, quota.aiCallsLimit - quota.aiCallsUsed),
          percentUsed:
            quota.aiCallsLimit > 0
              ? Math.round((quota.aiCallsUsed / quota.aiCallsLimit) * 100)
              : 0,
        },
        aiDaily: {
          used: quota.aiCallsToday,
          limit: quota.aiCallsDailyLimit,
          isOverLimit: quota.isOverDailyLimit,
        },
        storage: {
          usedMb: Math.round(quota.storageUsedMb * 100) / 100,
          limitMb: quota.storageLimitMb,
          remainingMb: Math.max(0, quota.storageLimitMb - quota.storageUsedMb),
          percentUsed:
            quota.storageLimitMb > 0
              ? Math.round((quota.storageUsedMb / quota.storageLimitMb) * 100)
              : 0,
        },
        tts: {
          usedSeconds: quota.ttsSecondsUsed,
          limitSeconds: quota.ttsSecondsLimit,
          usedHours: Math.round((quota.ttsSecondsUsed / 3600) * 10) / 10,
          limitHours: Math.round(quota.ttsSecondsLimit / 3600),
        },
        synthesis: {
          used: quota.synthesisCount,
          limit: quota.synthesisLimit,
          isUnlimited: quota.synthesisLimit === -1,
        },
        isOverLimit: quota.isOverLimit,
      },
    });
  } catch (error) {
    console.error("[Quota GET] Error:", error);
    return NextResponse.json(
      { error: { code: "FETCH_FAILED", message: "获取配额信息失败" } },
      { status: 500 },
    );
  }
}
