import { createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { Notify } from "@/lib/notifications/server";
import {
  successResponse,
  badRequestError,
  databaseError,
} from "@/lib/utils/api-response";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * POST /api/bookmarks/batch-restore
 * 批量从垃圾箱恢复收藏
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
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
  if (!bookmarkIds || !Array.isArray(bookmarkIds) || bookmarkIds.length === 0) {
    return badRequestError("bookmarkIds 参数必须是非空数组");
  }

  if (bookmarkIds.length > 100) {
    return badRequestError("一次最多恢复 100 个收藏");
  }

  // 3. 批量恢复（仅恢复属于当前用户且在垃圾箱中的收藏）
  const serviceClient = await createServiceClient();

  const { data: restoredBookmarks, error: restoreError } = (await (
    serviceClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase 类型推断限制
      .from("bookmarks") as any
  )
    .update({
      is_in_trash: false,
      trashed_at: null,
    })
    .in("id", bookmarkIds)
    .eq("user_id", userId)
    .eq("is_in_trash", true)
    .is("deleted_at", null)
    .select("id")) as {
    data: { id: number }[] | null;
    error: { message: string } | null;
  };

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

  // 4. 发送批量恢复消息通知（静默级别）
  if (restoredCount > 0) {
    await Notify.batchRestore(userId, restoredCount).catch((err) => {
      logger.warn(
        { error: err },
        "Failed to create batch restore notification",
      );
    });
  }

  // 5. 返回成功响应
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
});
