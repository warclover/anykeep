/**
 * 智能分类 v5.0 - Shadow Sorting Reject API
 * POST /api/classification/v5/shadow/reject
 *
 * @deprecated 旧分类系统 V5 功能，classification-v2 不使用。计划在后续版本删除。
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ShadowSortingService } from "@/lib/classification/strategies/modern/shadow-sorting";
import { createLogger } from "@/lib/classification/infrastructure/shared-services/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * 批量拒绝请求体
 */
interface RejectRequest {
  bookmarkIds: number[];
}

/**
 * POST /api/classification/v5/shadow/reject
 * 批量拒绝影子分拣建议（清除 shadow_* 字段，不移动书签）
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const logger = createLogger("ShadowRejectAPI");

  // 1. 解析请求体
  const body = (await request.json()) as RejectRequest;

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
        error: "Cannot reject more than 100 bookmarks at once",
      },
      { status: 400 },
    );
  }

  // 4. 创建 Supabase 客户端
  const supabase = await createClient();

  // 6. 批量拒绝
  const shadowService = new ShadowSortingService(supabase, logger);
  const results = await shadowService.batchReject(userId, body.bookmarkIds);

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
});
