/**
 * 插件专用 - 搜索收藏
 *
 * GET /api/plugin/bookmarks/search?q=keyword&limit=20&offset=0
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  verifyPluginAuth,
  createUnauthorizedResponse,
  hasScope,
} from "@/lib/auth/plugin-middleware";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  // 验证认证
  const authResult = await verifyPluginAuth(request);

  if (!authResult.success) {
    return createUnauthorizedResponse(authResult.error);
  }

  // 检查权限
  if (!hasScope(authResult, "bookmarks:read")) {
    return NextResponse.json(
      {
        error: "forbidden",
        message: "Insufficient scope: bookmarks:read required",
      },
      { status: 403 },
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "20", 10),
      100,
    );
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "invalid_request", message: "Search query (q) is required" },
        { status: 400 },
      );
    }

    const serviceClient = await createServiceClient();
    const searchTerm = query.trim();

    // 全文搜索（简化查询）
    const {
      data: bookmarks,
      error: fetchError,
      count,
    } = await serviceClient
      .from("bookmarks")
      .select("id, url, title, description, platform, created_at, updated_at", {
        count: "exact",
      })
      .eq("user_id", authResult.userId)
      .or(
        `title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,url.ilike.%${searchTerm}%`,
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (fetchError) {
      logger.error(
        {
          error: fetchError.message,
          userId: authResult.userId,
          query: searchTerm,
        },
        "Plugin Bookmarks Search: Failed to search",
      );
      return NextResponse.json(
        { error: "server_error", message: "Failed to search bookmarks" },
        { status: 500 },
      );
    }

    // 批量获取标签
    const bookmarkIds = bookmarks.map((b) => b.id);
    const { data: tagRelations } = await serviceClient
      .from("bookmark_tags")
      .select("bookmark_id, tags(name)")
      .in("bookmark_id", bookmarkIds);

    // 构建书签ID到标签的映射
    const tagMap = new Map<number, string[]>();
    if (tagRelations) {
      for (const rel of tagRelations) {
        const tags = tagMap.get(rel.bookmark_id) || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tagName = (rel.tags as any)?.name;
        if (tagName) {
          tags.push(tagName);
        }
        tagMap.set(rel.bookmark_id, tags);
      }
    }

    // 格式化响应
    const formattedBookmarks = bookmarks.map((bookmark) => ({
      id: bookmark.id,
      url: bookmark.url,
      title: bookmark.title,
      description: bookmark.description,
      platform: bookmark.platform,
      created_at: bookmark.created_at,
      updated_at: bookmark.updated_at,
      tags: tagMap.get(bookmark.id) || [],
    }));

    return NextResponse.json({
      bookmarks: formattedBookmarks,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, "Plugin Bookmarks Search: Error");

    return NextResponse.json(
      { error: "server_error", message: "Internal server error" },
      { status: 500 },
    );
  }
}
