/**
 * Knowledge Studio - 配额 API
 * @route GET /api/knowledge-studio/quota
 * @description 查询用户配额使用情况
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { quotaManager } from "@/lib/knowledge-studio";

const logger = createLogger("api:knowledge-studio:quota");

/**
 * GET /api/knowledge-studio/quota
 * 获取用户配额信息
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 },
      );
    }

    // 获取用户配额信息
    const quotaInfo = await quotaManager.getUserQuotaInfo(user.id);
    const usageSummary = await quotaManager.getUsageSummary(user.id);

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
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Get quota failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "获取配额信息失败" } },
      { status: 500 },
    );
  }
}
