import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  successResponse,
  notFoundError,
  forbiddenError,
  databaseError,
} from "@/lib/utils/api-response";
import { AUTH, BOOKMARK } from "@/lib/constants/error-messages";
import { checkRateLimit } from "@/lib/utils/rate-limiter";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * DELETE /api/bookmarks/[id]/permanent
 * 永久删除收藏（仅限垃圾箱中的收藏）
 */
export const DELETE = withAuthMiddleware<{ id: string }>(
  async (_request, { userId, params }) => {
    const { id } = await params;
    const bookmarkId = parseInt(id);

    logger.debug(
      {
        bookmarkId,
        action: "permanent_delete_start",
      },
      "DELETE: Permanent delete bookmark ID",
    );

    if (isNaN(bookmarkId)) {
      return notFoundError(BOOKMARK.NOT_FOUND);
    }

    // 1.5 速率限制检查（高风险操作：每小时 2 次）
    const rateLimitResult = checkRateLimit(userId, "/api/bookmarks/permanent");
    if (!rateLimitResult.allowed) {
      logger.warn(
        { userId, bookmarkId, resetMs: rateLimitResult.resetMs },
        "Permanent delete rate limited",
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

    // 2. 检查收藏是否存在于垃圾箱中
    const supabase = await createClient();
    // 类型断言: 手动维护类型文件时需要此断言
    const { data: existingBookmark, error: checkError } = (await supabase
      .from("bookmarks")
      .select("id, user_id, is_in_trash, is_locked")
      .eq("id", bookmarkId)
      .is("deleted_at", null)
      .single()) as unknown as {
      data: {
        id: number;
        user_id: string;
        is_in_trash: boolean;
        is_locked: boolean;
      } | null;
      error: { code?: string; message: string } | null;
    };

    logger.debug(
      {
        existingBookmark,
        checkError: checkError?.message,
        action: "bookmark_check",
      },
      "DELETE: Existing bookmark",
    );

    if (checkError) {
      if (checkError.code === "PGRST116") {
        return notFoundError(BOOKMARK.NOT_FOUND);
      }
      return databaseError(BOOKMARK.LOAD_ERROR, checkError);
    }

    if (!existingBookmark) {
      return notFoundError(BOOKMARK.NOT_FOUND);
    }

    if (existingBookmark.user_id !== userId) {
      return forbiddenError(AUTH.FORBIDDEN);
    }

    // 3. 验证收藏是否在垃圾箱中
    if (!existingBookmark.is_in_trash) {
      return forbiddenError("只能永久删除垃圾箱中的收藏");
    }

    // 注意：即使收藏被锁定，也允许从垃圾箱永久删除
    // 因为用户已经明确执行了删除操作（移入垃圾箱）

    // 4. 永久删除（设置 deleted_at）
    const serviceClient = await createServiceClient();
    const { error: deleteError } = (await serviceClient
      .from("bookmarks")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", bookmarkId)) as { error: { message: string } | null };

    logger.debug(
      {
        deleteError: deleteError?.message,
        action: "permanent_delete",
      },
      "DELETE: Permanent delete operation",
    );

    if (deleteError) {
      return databaseError(BOOKMARK.DELETE_ERROR(1), deleteError);
    }

    // 5. 减少用户存储计数
    const { error: decrementError } = (await serviceClient.rpc(
      "decrement_storage_used",
      {
        target_user_id: userId,
      },
    )) as { error: { message: string } | null };

    logger.debug(
      {
        decrementError: decrementError?.message,
        action: "decrement_storage",
      },
      "DELETE: Decrement storage",
    );

    if (decrementError) {
      // 存储计数更新失败，但收藏已删除，记录错误但不影响返回
      logger.error(
        {
          error: decrementError,
          userId,
          operation: "decrement_storage",
        },
        "Failed to decrement storage count",
      );
    }

    // 6. 返回成功响应
    logger.info(
      {
        bookmarkId,
        action: "permanent_delete_success",
      },
      "DELETE: Permanently deleted successfully",
    );

    return successResponse({
      id: bookmarkId,
      deleted: true,
      permanent: true,
      message: "已永久删除",
    });
  },
);
