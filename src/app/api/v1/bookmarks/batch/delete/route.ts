/**
 * Bookmark Batch Delete API v1
 *
 * POST /api/v1/bookmarks/batch/delete - 批量删除书签（移到回收站）
 *
 * @module api/v1/bookmarks/batch/delete
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BookmarkService } from "@/services";
import { withAuthMiddleware, validateBody } from "@/lib/api/middleware";
import { BatchBookmarkIdsSchema } from "@/contracts";
import { checkRateLimit } from "@/lib/utils/rate-limiter";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api-v1-batch-delete");

/**
 * POST /api/v1/bookmarks/batch/delete
 *
 * 批量将书签移到回收站
 *
 * 速率限制：每小时 5 次（高风险操作）
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  // 速率限制检查（高风险操作）
  const rateLimitResult = checkRateLimit(
    userId,
    "/api/v1/bookmarks/batch/delete",
  );
  if (!rateLimitResult.allowed) {
    logger.warn(
      { userId, resetMs: rateLimitResult.resetMs },
      "Batch delete rate limited",
    );
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "操作过于频繁，请稍后再试",
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil(rateLimitResult.resetMs / 1000).toString(),
        },
      },
    );
  }

  const body = await validateBody(request, BatchBookmarkIdsSchema);

  const supabase = await createClient();
  const service = new BookmarkService(supabase, userId);
  const result = await service.batchDelete(body.ids);

  return NextResponse.json({
    success: true,
    data: {
      affected: result.affected,
      message: result.message,
    },
  });
});
