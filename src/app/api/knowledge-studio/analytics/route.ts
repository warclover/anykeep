/**
 * Knowledge Studio - Analytics API
 * @route GET /api/knowledge-studio/analytics
 * @description 获取知识工坊使用统计
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
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
export async function GET(request: NextRequest) {
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
      { userId: user.id, periodDays, includeDailyTrend, includeBlueprintStats },
      "Fetching KS analytics",
    );

    // 获取使用统计
    const tracker = createUsageTracker(supabase, user.id, {
      periodDays,
      includeDailyTrend,
      includeBlueprintStats,
    });

    const stats = await tracker.getUsageStats();

    return NextResponse.json({
      data: stats,
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Get analytics failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "获取使用统计失败" } },
      { status: 500 },
    );
  }
}
