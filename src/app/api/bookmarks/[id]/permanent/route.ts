import type { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  successResponse,
  notFoundError,
  unauthorizedError,
  forbiddenError,
  databaseError,
} from "@/lib/utils/api-response";
import { AUTH, BOOKMARK } from "@/lib/constants/error-messages";
import { checkRateLimit } from "@/lib/utils/rate-limiter";

/**
 * DELETE /api/bookmarks/[id]/permanent
 * 永久删除收藏（仅限垃圾箱中的收藏）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
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

    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    logger.debug(
      {
        userId: user?.id,
        authError: authError?.message,
        action: "auth_check",
      },
      "DELETE: User authentication",
    );

    if (authError || !user) {
      return unauthorizedError();
    }

    // 1.5 速率限制检查（高风险操作：每小时 2 次）
    const rateLimitResult = checkRateLimit(user.id, "/api/bookmarks/permanent");
    if (!rateLimitResult.allowed) {
      logger.warn(
        { userId: user.id, bookmarkId, resetMs: rateLimitResult.resetMs },
        "Permanent delete rate limited",
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: "操作过于频繁，请稍后再试",
          retryAfter: Math.ceil(rateLimitResult.resetMs / 1000),
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": "0",
            "Retry-After": Math.ceil(rateLimitResult.resetMs / 1000).toString(),
          },
        },
      );
    }

    // 2. 检查收藏是否存在于垃圾箱中
    const { data: existingBookmark, error: checkError } = await supabase
      .from("bookmarks")
      .select("id, user_id, is_in_trash, is_locked")
      .eq("id", bookmarkId)
      .is("deleted_at", null)
      .single();

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

    if (existingBookmark.user_id !== user.id) {
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
    const { error: deleteError } = await serviceClient
      .from("bookmarks")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", bookmarkId);

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
    const { error: decrementError } = await serviceClient.rpc(
      "decrement_storage_used",
      {
        target_user_id: user.id,
      },
    );

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
          userId: user.id,
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
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "permanent_delete_bookmark",
      },
      "DELETE /api/bookmarks/[id]/permanent error",
    );
    return databaseError(BOOKMARK.DELETE_ERROR(1), error);
  }
}
