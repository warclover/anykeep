/**
 * 智能分类 v5.0 - Shadow Sorting Inbox API
 * GET /api/classification/v5/shadow/inbox
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ShadowSortingService } from "@/lib/classification/v5/shadow-sorting";
import { createLogger } from "@/lib/classification/v5/shared/logger";

/**
 * GET /api/classification/v5/shadow/inbox
 * 获取待处理的影子分拣列表
 */
export async function GET(request: NextRequest) {
  const logger = createLogger("ShadowInboxAPI");

  try {
    // 1. 创建 Supabase 客户端
    const supabase = await createClient();

    // 2. 验证用户认证
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

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
      shadowService.getPendingList(user.id, limit, offset),
      shadowService.getStats(user.id),
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
  } catch (error) {
    logger.error(
      "Shadow inbox API error",
      error instanceof Error ? error : new Error(String(error))
    );

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
