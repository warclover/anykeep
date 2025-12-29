/**
 * Bookmark Tags API v1
 *
 * GET /api/v1/bookmarks/tags - 获取用户所有标签
 *
 * @module api/v1/bookmarks/tags
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BookmarkService } from "@/services";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * GET /api/v1/bookmarks/tags
 *
 * 获取用户所有标签列表
 */
export const GET = withAuthMiddleware(async (_request, { userId }) => {
  const supabase = await createClient();
  const service = new BookmarkService(supabase, userId);
  const tags = await service.getAllTags();

  return NextResponse.json(
    {
      success: true,
      data: {
        tags,
        total: tags.length,
      },
    },
    {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    },
  );
});
