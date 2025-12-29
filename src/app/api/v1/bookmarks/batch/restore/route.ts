/**
 * Bookmark Batch Restore API v1
 *
 * POST /api/v1/bookmarks/batch/restore - 批量从回收站恢复书签
 *
 * @module api/v1/bookmarks/batch/restore
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BookmarkService } from "@/services";
import { withAuthMiddleware, validateBody } from "@/lib/api/middleware";
import { BatchBookmarkIdsSchema } from "@/contracts";

/**
 * POST /api/v1/bookmarks/batch/restore
 *
 * 批量从回收站恢复书签
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const body = await validateBody(request, BatchBookmarkIdsSchema);

  const supabase = await createClient();
  const service = new BookmarkService(supabase, userId);
  const result = await service.batchRestore(body.ids);

  return NextResponse.json({
    success: true,
    data: {
      affected: result.affected,
      message: result.message,
    },
  });
});
