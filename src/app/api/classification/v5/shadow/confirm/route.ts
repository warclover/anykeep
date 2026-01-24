/**
 * 智能分类 v5.0 - Shadow Sorting Confirm API
 * POST /api/classification/v5/shadow/confirm
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ShadowSortingService } from "@/lib/classification/strategies/modern/shadow-sorting";
import { createLogger } from "@/lib/classification/infrastructure/shared-services/logger";

/**
 * 批量确认请求体
 */
interface ConfirmRequest {
  bookmarkIds: number[];
}

/**
 * POST /api/classification/v5/shadow/confirm
 * 批量确认影子分拣建议
 */
export async function POST(request: NextRequest) {
  const logger = createLogger("ShadowConfirmAPI");

  try {
    // 1. 解析请求体
    const body = (await request.json()) as ConfirmRequest;

    // 2. 验证必需字段
    if (!body.bookmarkIds || !Array.isArray(body.bookmarkIds)) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing or invalid bookmarkIds array",
        },
        { status: 400 },
      );
    }

    // 3. 验证数组长度
    if (body.bookmarkIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "bookmarkIds array cannot be empty",
        },
        { status: 400 },
      );
    }

    if (body.bookmarkIds.length > 100) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot confirm more than 100 bookmarks at once",
        },
        { status: 400 },
      );
    }

    // 4. 创建 Supabase 客户端
    const supabase = await createClient();

    // 5. 验证用户认证
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

    // 6. 批量确认
    const shadowService = new ShadowSortingService(supabase, logger);
    const results = await shadowService.batchConfirm(user.id, body.bookmarkIds);

    // 7. 统计结果
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.length - successCount;

    // 8. 返回结果
    return NextResponse.json({
      success: true,
      data: {
        results,
        summary: {
          total: results.length,
          success: successCount,
          failure: failureCount,
        },
      },
    });
  } catch (error) {
    logger.error(
      "Shadow confirm API error",
      error instanceof Error ? error : new Error(String(error)),
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
