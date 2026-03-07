import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  successResponse,
  notFoundError,
  forbiddenError,
  databaseError,
} from "@/lib/utils/api-response";
import { AUTH, BOOKMARK } from "@/lib/constants/error-messages";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * POST /api/bookmarks/[id]/restore
 * 从垃圾箱恢复收藏
 */
export const POST = withAuthMiddleware<{ id: string }>(
  async (_request, { userId, params }) => {
    const { id } = await params;
    const bookmarkId = parseInt(id);

    logger.debug(
      {
        bookmarkId,
        action: "restore_start",
      },
      "POST: Restore bookmark ID",
    );

    if (isNaN(bookmarkId)) {
      return notFoundError(BOOKMARK.NOT_FOUND);
    }

    // 2. 检查收藏是否存在于垃圾箱中
    const supabase = await createClient();
    // 类型断言: 手动维护类型文件时需要此断言
    const { data: existingBookmark, error: checkError } = (await supabase
      .from("bookmarks")
      .select("id, user_id, is_in_trash, trashed_at")
      .eq("id", bookmarkId)
      .is("deleted_at", null)
      .single()) as unknown as {
      data: {
        id: number;
        user_id: string;
        is_in_trash: boolean;
        trashed_at: string | null;
      } | null;
      error: { code?: string; message: string } | null;
    };

    logger.debug(
      {
        existingBookmark,
        checkError: checkError?.message,
        action: "bookmark_check",
      },
      "POST: Existing bookmark",
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
      return forbiddenError("收藏不在垃圾箱中");
    }

    // 4. 从垃圾箱恢复
    const serviceClient = await createServiceClient();
    const { data: restoredBookmark, error: restoreError } = (await (
      serviceClient.from(
        "bookmarks",
      ) /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any
    )
      .update({
        is_in_trash: false,
        trashed_at: null,
      })
      .eq("id", bookmarkId)
      .select()
      .single()) as { data: unknown; error: { message: string } | null };

    logger.debug(
      {
        restoreError: restoreError?.message,
        action: "restore_operation",
      },
      "POST: Restore operation",
    );

    if (restoreError) {
      return databaseError("恢复收藏失败", restoreError);
    }

    // 5. 返回成功响应
    logger.info(
      {
        bookmarkId,
        action: "restore_success",
      },
      "POST: Restored from trash successfully",
    );

    return successResponse({
      id: bookmarkId,
      restored: true,
      data: restoredBookmark,
      message: "已从垃圾箱恢复",
    });
  },
);
