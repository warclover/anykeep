/**
 * Bookmark Stats API v1
 *
 * GET /api/v1/bookmarks/stats - 获取书签统计
 *
 * @module api/v1/bookmarks/stats
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BookmarkService } from "@/services";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * GET /api/v1/bookmarks/stats
 *
 * 获取书签统计数据
 */
export const GET = withAuthMiddleware(async (_request, { userId }) => {
  const supabase = await createClient();
  const service = new BookmarkService(supabase, userId);
  const stats = await service.getStats();

  return NextResponse.json(
    {
      success: true,
      data: stats,
    },
    {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    },
  );
});
