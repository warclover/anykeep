/**
 * Bookmark Batch Move API v1
 *
 * POST /api/v1/bookmarks/batch/move - 批量移动书签到文件夹
 *
 * @module api/v1/bookmarks/batch/move
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BookmarkService } from "@/services";
import { withAuthMiddleware, validateBody } from "@/lib/api/middleware";
import { BatchMoveSchema } from "@/contracts";
import { triggerMoveLearning } from "@/lib/classification-learning/trigger-move-learning";
import { logger } from "@/lib/logger";

/**
 * POST /api/v1/bookmarks/batch/move
 *
 * 批量移动书签到指定文件夹
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const body = await validateBody(request, BatchMoveSchema);

  const supabase = await createClient();

  // 移动前查询书签元数据（用于学习）
  const { data: bookmarksToLearn } = (await supabase
    .from("bookmarks")
    .select("id, folder_id, ai_tags")
    .in("id", body.ids)
    .eq("user_id", userId)
    .is("deleted_at", null)) as unknown as {
    data:
      | { id: number; folder_id: number | null; ai_tags: string[] | null }[]
      | null;
    error: unknown;
  };

  const service = new BookmarkService(supabase, userId);
  const result = await service.batchMove(body.ids, body.folderId);

  // 异步触发 AI 学习（不阻塞响应）
  if (result.affected > 0 && bookmarksToLearn) {
    triggerMoveLearning({
      userId,
      bookmarks: bookmarksToLearn,
      targetFolderId: body.folderId,
    }).catch((err) => {
      logger.warn({ error: err }, "Failed to trigger move learning (v1)");
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      affected: result.affected,
      targetFolderId: body.folderId,
      message: result.message,
    },
  });
});
