/**
 * Knowledge Link - Related Bookmarks API
 *
 * GET /api/knowledge-link/related/[bookmarkId]
 * 获取书签的相关内容
 *
 * @version 1.0.0
 * @since 2025-12-15
 */

import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { createClient } from "@/lib/supabase/server";
import { getLinkService } from "@/lib/knowledge-link";
import type { LinkType } from "@/lib/knowledge-link";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

interface GetRelatedResponse {
  success: boolean;
  data?: {
    related: Array<{
      bookmark: {
        id: number;
        title: string;
        url: string;
        platform?: string;
      };
      link: {
        type: LinkType;
        strength: number;
        sharedItems: string[];
      };
    }>;
    totalCount: number;
  };
  error?: string;
}

// ============================================================================
// GET Handler
// ============================================================================

/**
 * GET /api/knowledge-link/related/[bookmarkId]
 *
 * 获取书签的相关内容
 *
 * Query Parameters:
 * - limit: number (default: 10, max: 50)
 * - minStrength: number (default: 0.5, range: 0-1)
 * - types: string[] (comma-separated, e.g., "semantic,entity,tag")
 */
export const GET = withAuthMiddleware<{ bookmarkId: string }>(
  async (
    request,
    { userId, params },
  ): Promise<NextResponse<GetRelatedResponse>> => {
    const supabase = await createClient();

    // 2. 解析路由参数
    const { bookmarkId: bookmarkIdStr } = await params;
    const bookmarkId = parseInt(bookmarkIdStr, 10);

    if (isNaN(bookmarkId)) {
      return NextResponse.json(
        { success: false, error: "Invalid bookmark ID" },
        { status: 400 },
      );
    }

    // 3. 验证书签所有权
    // 类型断言: Supabase 表类型手动维护，需要 any 绕过
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const { data: bookmark, error: bookmarkError } = (await supabase
      .from("bookmarks")
      .select("id, user_id")
      .eq("id", bookmarkId)
      .single()) as any;
    /* eslint-enable @typescript-eslint/no-explicit-any */

    if (bookmarkError || !bookmark) {
      return NextResponse.json(
        { success: false, error: "Bookmark not found" },
        { status: 404 },
      );
    }

    if (bookmark.user_id !== userId) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    // 4. 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 50);
    const minStrength = Math.max(
      0,
      Math.min(1, parseFloat(searchParams.get("minStrength") || "0.5")),
    );
    const typesParam = searchParams.get("types");
    const types = typesParam
      ? (typesParam.split(",").filter(Boolean) as LinkType[])
      : undefined;

    // 5. 获取相关书签（传入服务端 supabase 以携带当前用户 session，否则 RLS 下无用户会返回空）
    const linkService = getLinkService(supabase);
    logger.info(
      { bookmarkId, userId, limit, minStrength, types },
      "[API] Getting related bookmarks",
    );
    const related = await linkService.getRelatedBookmarks(bookmarkId, userId, {
      limit,
      minStrength,
      types,
    });
    logger.info(
      { bookmarkId, resultCount: related.length },
      "[API] Related bookmarks result",
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          related,
          totalCount: related.length,
        },
      },
      {
        headers: {
          "Cache-Control": "private, max-age=120",
        },
      },
    );
  },
);
