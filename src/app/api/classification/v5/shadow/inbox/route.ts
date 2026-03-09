/**
 * 智能分类 v5.0 - Shadow Sorting Inbox API
 * GET /api/classification/v5/shadow/inbox
 *
 * @deprecated 旧分类系统 V5 功能，classification-v2 不使用。计划在后续版本删除。
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ShadowSortingService } from "@/lib/classification/strategies/modern/shadow-sorting";
import { createLogger } from "@/lib/classification/infrastructure/shared-services/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * GET /api/classification/v5/shadow/inbox
 * 获取待处理的影子分拣列表
 */
export const GET = withAuthMiddleware(async (request, { userId }) => {
  const logger = createLogger("ShadowInboxAPI");

  const supabase = await createClient();

  // 3. 解析查询参数
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  // 4. 验证参数范围
  if (limit < 1 || limit > 100) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid limit. Must be between 1 and 100",
      },
      { status: 400 },
    );
  }

  // 5. 获取待处理列表和统计
  const shadowService = new ShadowSortingService(supabase, logger);
  const [pendingList, stats] = await Promise.all([
    shadowService.getPendingList(userId, limit, offset),
    shadowService.getStats(userId),
  ]);

  // 6. 返回结果
  return NextResponse.json({
    success: true,
    data: {
      bookmarks: pendingList,
      stats,
      pagination: {
        limit,
        offset,
        hasMore: pendingList.length === limit,
      },
    },
  });
});
