/**
 * Folder Batch Sort API v1
 *
 * POST /api/v1/folders/batch-sort - 批量更新文件夹排序
 *
 * @module api/v1/folders/batch-sort
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FolderService } from "@/services";
import { withAuthMiddleware, validateBody } from "@/lib/api/middleware";
import { BatchSortFoldersSchema } from "@/contracts";

/**
 * POST /api/v1/folders/batch-sort
 *
 * 批量更新文件夹排序顺序
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const body = await validateBody(request, BatchSortFoldersSchema);

  const supabase = await createClient();
  const service = new FolderService(supabase, userId);
  await service.batchSort(body.orderings);

  return NextResponse.json({
    success: true,
    data: {
      affected: body.orderings.length,
      message: `Updated sort order for ${body.orderings.length} folder(s)`,
    },
  });
});
