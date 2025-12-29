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

/**
 * POST /api/v1/bookmarks/batch/move
 *
 * 批量移动书签到指定文件夹
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const body = await validateBody(request, BatchMoveSchema);

  const supabase = await createClient();
  const service = new BookmarkService(supabase, userId);
  const result = await service.batchMove(body.ids, body.folderId);

  return NextResponse.json({
    success: true,
    data: {
      affected: result.affected,
      targetFolderId: body.folderId,
      message: result.message,
    },
  });
});
