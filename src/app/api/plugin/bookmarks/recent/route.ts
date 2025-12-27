/**
 * 插件专用 - 获取最近收藏
 *
 * GET /api/plugin/bookmarks/recent?limit=10
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
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 50);

    const serviceClient = await createServiceClient();

    // 获取最近收藏（简化查询，避免复杂关联）
    const { data: bookmarks, error: fetchError } = await serviceClient
      .from("bookmarks")
      .select("id, url, title, description, platform, created_at, updated_at")
      .eq("user_id", authResult.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (fetchError) {
      logger.error(
        { error: fetchError.message, userId: authResult.userId },
        "Plugin Bookmarks Recent: Failed to fetch",
      );
      return NextResponse.json(
        { error: "server_error", message: "Failed to fetch bookmarks" },
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
      count: formattedBookmarks.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, "Plugin Bookmarks Recent: Error");

    return NextResponse.json(
      { error: "server_error", message: "Internal server error" },
      { status: 500 },
    );
  }
}
