import type { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  successResponse,
  badRequestError,
  unauthorizedError,
  databaseError,
} from "@/lib/api/response";

/**
 * POST /api/bookmarks/batch-restore
 * 批量从垃圾箱恢复收藏
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookmarkIds } = body;

    logger.debug(
      {
        bookmarkIds,
        count: bookmarkIds?.length,
        action: "batch_restore_start",
      },
      "POST: Batch restore bookmarks",
    );

    // 1. 验证请求参数
    if (
      !bookmarkIds ||
      !Array.isArray(bookmarkIds) ||
      bookmarkIds.length === 0
    ) {
      return badRequestError("bookmarkIds 参数必须是非空数组");
    }

    if (bookmarkIds.length > 100) {
      return badRequestError("一次最多恢复 100 个收藏");
    }

    // 2. 验证用户身份
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
      "POST: User authentication",
    );

    if (authError || !user) {
      return unauthorizedError();
    }

    // 3. 批量恢复（仅恢复属于当前用户且在垃圾箱中的收藏）
    const serviceClient = await createServiceClient();
    const { data: restoredBookmarks, error: restoreError } = await serviceClient
      .from("bookmarks")
      .update({
        is_in_trash: false,
        trashed_at: null,
      })
      .in("id", bookmarkIds)
      .eq("user_id", user.id)
      .eq("is_in_trash", true)
      .is("deleted_at", null)
      .select("id");

    logger.debug(
      {
        restoredCount: restoredBookmarks?.length,
        restoreError: restoreError?.message,
        action: "batch_restore",
      },
      "POST: Batch restore operation",
    );

    if (restoreError) {
      return databaseError("批量恢复失败", restoreError);
    }

    const restoredCount = restoredBookmarks?.length || 0;
    const restoredIds = restoredBookmarks?.map((b) => b.id) || [];

    // 4. 返回成功响应
    logger.info(
      {
        restoredCount,
        requestedCount: bookmarkIds.length,
        action: "batch_restore_success",
      },
      "POST: Batch restore successfully",
    );

    return successResponse({
      restored: restoredCount,
      total: bookmarkIds.length,
      ids: restoredIds,
      message: `成功恢复 ${restoredCount} 个收藏`,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "batch_restore_bookmarks",
      },
      "POST /api/bookmarks/batch-restore error",
    );
    return databaseError("批量恢复失败", error);
  }
}
