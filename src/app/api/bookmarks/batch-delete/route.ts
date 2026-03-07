/**
 * 批量删除收藏 API 路由
 * POST /api/bookmarks/batch-delete - 批量软删除收藏
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { batchDeleteBookmarksSchema } from "@/lib/validation";
import {
  successResponse,
  handleValidationError,
  databaseError,
} from "@/lib/utils/api-response";
import { checkRateLimit } from "@/lib/utils/rate-limiter";
import { logger } from "@/lib/logger";
import { Notify } from "@/lib/notifications/server";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * POST /api/bookmarks/batch-delete
 * 批量软删除收藏（单次事务）
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  // 1.5 速率限制检查（高风险操作：每小时 2 次）
  const rateLimitResult = checkRateLimit(userId, "/api/bookmarks/batch-delete");
  if (!rateLimitResult.allowed) {
    logger.warn(
      { userId, resetMs: rateLimitResult.resetMs },
      "Batch delete rate limited",
    );
    return NextResponse.json(
      {
        success: false,
        error: "操作过于频繁，请稍后再试",
        retryAfter: Math.ceil(rateLimitResult.resetMs / 1000),
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": rateLimitResult.limit.toString(),
          "X-RateLimit-Remaining": "0",
          "Retry-After": Math.ceil(rateLimitResult.resetMs / 1000).toString(),
        },
      },
    );
  }

  // 2. 解析并验证请求体
  const body = await request.json();
  const validation = batchDeleteBookmarksSchema.safeParse(body);

  if (!validation.success) {
    return handleValidationError(validation.error);
  }

  const { ids } = validation.data;

  // 3. 批量软删除收藏（单次事务）
  const supabase = await createClient();

  const { data: deletedBookmarks, error: deleteError } = (await (
    supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase 类型推断限制
      .from("bookmarks") as any
  )
    .update({ deleted_at: new Date().toISOString() })
    .in("id", ids)
    .eq("user_id", userId)
    .is("deleted_at", null) // 只删除未删除的记录
    .select("id")) as {
    data: { id: number }[] | null;
    error: { message: string } | null;
  };

  if (deleteError) {
    return databaseError("批量删除收藏失败", deleteError);
  }

  const deletedCount = deletedBookmarks?.length || 0;

  // 4. 批量减少用户存储计数
  if (deletedCount > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: decrementError } = (await (supabase.rpc as any)(
      "decrement_storage_used",
      {
        target_user_id: userId,
        decrement_by: deletedCount,
      },
    )) as { error: { message: string } | null };

    if (decrementError) {
      // 存储计数更新失败，但收藏已删除，记录错误但不影响返回
      logger.error(
        {
          userId,
          deletedCount,
          error: decrementError,
        },
        "Failed to decrement storage count",
      );
    }
  }

  // 5. 发送批量删除消息通知（静默级别）
  if (deletedCount > 0) {
    await Notify.batchDelete(userId, deletedCount).catch((err) => {
      logger.warn({ error: err }, "Failed to create batch delete notification");
    });
  }

  // 6. 返回删除结果
  return successResponse({
    deletedCount,
    deletedIds: deletedBookmarks?.map((b) => b.id) || [],
  });
});
