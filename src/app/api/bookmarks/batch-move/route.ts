/**
 * 批量移动收藏到文件夹 API 路由
 * POST /api/bookmarks/batch-move - 批量移动收藏到指定文件夹
 */

import { createClient } from "@/lib/supabase/server";
import { batchMoveBookmarksSchema } from "@/lib/validation";
import {
  successResponse,
  handleValidationError,
  databaseError,
  notFoundError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { Notify } from "@/lib/notifications/server";
import { updateFolderProfilesOnBookmarkChange } from "@/lib/classification/server";
import { triggerMoveLearning } from "@/lib/classification/learning/trigger-move-learning";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * POST /api/bookmarks/batch-move
 * 批量移动收藏到指定文件夹（单次事务）
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  // 2. 解析并验证请求体
  const body = await request.json();
  const validation = batchMoveBookmarksSchema.safeParse(body);

  if (!validation.success) {
    return handleValidationError(validation.error);
  }

  const { ids, folderId } = validation.data;

  // 2.5 获取要移动的书签的当前文件夹和元数据（用于更新源文件夹 profile + 学习）
  const supabase = await createClient();
  // 类型断言: 手动维护类型文件时需要此断言
  const { data: bookmarksToMove } = (await supabase
    .from("bookmarks")
    .select("id, folder_id, ai_tags")
    .in("id", ids)
    .eq("user_id", userId)
    .is("deleted_at", null)) as unknown as {
    data:
      | {
          id: number;
          folder_id: number | null;
          ai_tags: string[] | null;
        }[]
      | null;
    error: unknown;
  };

  const sourceFolderIds =
    bookmarksToMove
      ?.map((b) => b.folder_id)
      .filter((id): id is number => id !== null) || [];

  // 3. 如果指定了文件夹，验证文件夹是否存在且属于当前用户
  let folderName = "待整理";
  if (folderId !== null) {
    const { data: folder, error: folderError } = (await supabase
      .from("folders")
      .select("id, name")
      .eq("id", folderId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single()) as unknown as {
      data: { id: number; name: string } | null;
      error: unknown;
    };

    if (folderError || !folder) {
      return notFoundError("文件夹不存在或无权访问");
    }
    folderName = folder.name;
  }

  // 4. 批量更新收藏的 folder_id

  const { data: movedBookmarks, error: moveError } = (await (
    supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase 类型推断限制
      .from("bookmarks") as any
  )
    .update({
      folder_id: folderId,
      updated_at: new Date().toISOString(),
    })
    .in("id", ids)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select("id")) as {
    data: { id: number }[] | null;
    error: { message: string } | null;
  };

  if (moveError) {
    return databaseError("批量移动收藏失败", moveError);
  }

  const movedCount = movedBookmarks?.length || 0;

  // 5. 发送批量移动消息通知（静默级别）
  if (movedCount > 0 && folderId !== null) {
    await Notify.batchMove(userId, movedCount, folderName).catch((err) => {
      logger.warn({ error: err }, "Failed to create batch move notification");
    });
  }

  // 5.5 异步更新源和目标文件夹的 profile（不阻塞响应）
  if (movedCount > 0) {
    updateFolderProfilesOnBookmarkChange(
      sourceFolderIds,
      folderId,
      userId,
    ).catch((err) => {
      logger.warn(
        { error: err },
        "Failed to update folder profiles after batch move",
      );
    });
  }

  // 6. 异步触发 AI 学习（不阻塞响应）
  if (movedCount > 0 && bookmarksToMove) {
    triggerMoveLearning({
      userId,
      bookmarks: bookmarksToMove,
      targetFolderId: folderId,
    }).catch((err) => {
      logger.warn({ error: err }, "Failed to trigger move learning");
    });
  }

  // 7. 返回移动结果
  return successResponse({
    movedCount,
    movedIds: movedBookmarks?.map((b) => b.id) || [],
    targetFolderId: folderId,
  });
});
