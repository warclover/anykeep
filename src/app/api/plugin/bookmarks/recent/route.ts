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

    // 类型断言: 手动维护类型文件时需要此断言
    type BookmarkRecentRow = {
      id: number;
      url: string;
      title: string;
      description: string | null;
      platform: string;
      created_at: string;
      updated_at: string;
    };

    // 获取最近收藏（简化查询，避免复杂关联）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bookmarks, error: fetchError } = await (serviceClient.from("bookmarks") as any)
      .select("id, url, title, description, platform, created_at, updated_at")
      .eq("user_id", authResult.userId)
      .order("created_at", { ascending: false })
      .limit(limit) as { data: BookmarkRecentRow[] | null; error: { message: string } | null };

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

    const bookmarkList = bookmarks ?? [];

    // 批量获取标签
    const bookmarkIds = bookmarkList.map((b) => b.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tagRelations } = await (serviceClient.from("bookmark_tags") as any)
      .select("bookmark_id, tags(name)")
      .in("bookmark_id", bookmarkIds) as { data: Array<{ bookmark_id: number; tags: { name: string } | null }> | null };

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
    const formattedBookmarks = bookmarkList.map((bookmark) => ({
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
