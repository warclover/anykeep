/**
 * Knowledge Studio - 配额 API
 * @route GET /api/knowledge-studio/quota
 * @description 查询用户配额使用情况
 */

import { NextResponse } from "next/server";
import { quotaManager } from "@/lib/knowledge-studio";

import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * GET /api/knowledge-studio/quota
 * 获取用户配额信息
 */
export const GET = withAuthMiddleware(async (_request, { userId }) => {
  // 获取用户配额信息
  const quotaInfo = await quotaManager.getUserQuotaInfo(userId);
  const usageSummary = await quotaManager.getUsageSummary(userId);

  // 计算重置时间（下月1日）
  const now = new Date();
  const resetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return NextResponse.json({
    data: {
      // 配额信息
      totalQuota: quotaInfo.totalQuota,
      usedQuota: quotaInfo.usedQuota,
      pendingQuota: quotaInfo.pendingQuota,
      availableQuota: quotaInfo.availableQuota,
      membershipType: quotaInfo.membershipType,

      // 使用统计
      usage: {
        totalConsumed: usageSummary.totalConsumed,
        totalPending: usageSummary.totalPending,
        totalRefunded: usageSummary.totalRefunded,
        operationCount: usageSummary.operationCount,
      },

      // 重置时间
      resetAt: resetAt.toISOString(),

      // 各操作成本
      operationCosts: {
        blueprint_generation: quotaManager.getOperationCost(
          "blueprint_generation",
        ),
        chat_edit: quotaManager.getOperationCost("chat_edit"),
      },
    },
  });
});
