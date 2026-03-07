/**
 * Knowledge Studio - Analytics API
 * @route GET /api/knowledge-studio/analytics
 * @description 获取知识工坊使用统计
 */

import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { createUsageTracker } from "@/lib/knowledge-studio";

const logger = createLogger("api:knowledge-studio:analytics");

/**
 * GET /api/knowledge-studio/analytics
 * 获取用户使用统计
 *
 * Query params:
 * - periodDays: 统计周期天数 (default: 30)
 * - includeDailyTrend: 是否包含每日趋势 (default: true)
 * - includeBlueprintStats: 是否包含蓝图统计 (default: true)
 */
export const GET = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();

  // 解析查询参数
  const { searchParams } = new URL(request.url);
  const periodDays = parseInt(searchParams.get("periodDays") || "30", 10);
  const includeDailyTrend = searchParams.get("includeDailyTrend") !== "false";
  const includeBlueprintStats =
    searchParams.get("includeBlueprintStats") !== "false";

  // 参数校验
  if (periodDays < 1 || periodDays > 365) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_PARAMS",
          message: "periodDays 须在 1-365 之间",
        },
      },
      { status: 400 },
    );
  }

  logger.info(
    { userId, periodDays, includeDailyTrend, includeBlueprintStats },
    "Fetching KS analytics",
  );

  // 获取使用统计
  const tracker = createUsageTracker(supabase, userId, {
    periodDays,
    includeDailyTrend,
    includeBlueprintStats,
  });

  const stats = await tracker.getUsageStats();

  return NextResponse.json({
    data: stats,
  });
});
