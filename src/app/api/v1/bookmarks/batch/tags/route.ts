/**
 * Bookmark Batch Tags API v1
 *
 * POST /api/v1/bookmarks/batch/tags - 批量添加或移除书签标签
 *
 * @module api/v1/bookmarks/batch/tags
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { BookmarkService } from "@/services";
import { withAuthMiddleware, validateBody } from "@/lib/api/middleware";

/**
 * 批量标签操作 Schema
 */
const BatchTagsSchema = z.object({
  action: z.enum(["add", "remove"]),
  ids: z.array(z.number().int().positive()).min(1).max(200),
  tags: z.array(z.string().max(50)).min(1).max(20),
});

/**
 * POST /api/v1/bookmarks/batch/tags
 *
 * 批量添加或移除书签标签
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const body = await validateBody(request, BatchTagsSchema);

  const supabase = await createClient();
  const service = new BookmarkService(supabase, userId);

  const result =
    body.action === "add"
      ? await service.batchAddTags(body.ids, body.tags)
      : await service.batchRemoveTags(body.ids, body.tags);

  return NextResponse.json({
    success: true,
    data: {
      action: body.action,
      affected: result.affected,
      tags: body.tags,
      message: result.message,
    },
  });
});
