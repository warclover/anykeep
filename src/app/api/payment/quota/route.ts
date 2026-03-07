/**
 * Quota API - 配额查询
 * GET /api/payment/quota - 查询当前配额使用情况
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { quotaService } from "@/lib/payment/services/quota.service";

/**
 * GET - 获取当前用户配额使用情况
 */
export const GET = withAuthMiddleware(
  async (_request: NextRequest, { userId }) => {
    const quota = await quotaService.getQuotaUsage(userId);

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
  },
);
