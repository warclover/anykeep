/**
 * 插件专用 - 检查 URL 是否已保存
 *
 * GET /api/plugin/bookmarks/check?url=https://example.com
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
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        { error: "invalid_request", message: "url parameter is required" },
        { status: 400 },
      );
    }

    // 验证 URL 格式
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "invalid_request", message: "Invalid URL format" },
        { status: 400 },
      );
    }

    const serviceClient = await createServiceClient();

    // 查找收藏（简化查询）
    const { data: bookmark, error: fetchError } = await serviceClient
      .from("bookmarks")
      .select("id, url, title, description, platform, created_at")
      .eq("user_id", authResult.userId)
      .eq("url", url)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 = no rows returned
      logger.error(
        { error: fetchError.message, userId: authResult.userId },
        "Plugin Bookmarks Check: Failed to check",
      );
      return NextResponse.json(
        { error: "server_error", message: "Failed to check URL" },
        { status: 500 },
      );
    }

    if (!bookmark) {
      return NextResponse.json({
        saved: false,
      });
    }

    // 获取标签
    const { data: tagRelations } = await serviceClient
      .from("bookmark_tags")
      .select("tags(name)")
      .eq("bookmark_id", bookmark.id);

    const tags: string[] = [];
    if (tagRelations) {
      for (const rel of tagRelations) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tagName = (rel.tags as any)?.name;
        if (tagName) {
          tags.push(tagName);
        }
      }
    }

    return NextResponse.json({
      saved: true,
      bookmark: {
        id: bookmark.id,
        url: bookmark.url,
        title: bookmark.title,
        description: bookmark.description,
        platform: bookmark.platform,
        created_at: bookmark.created_at,
        tags,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, "Plugin Bookmarks Check: Error");

    return NextResponse.json(
      { error: "server_error", message: "Internal server error" },
      { status: 500 },
    );
  }
}
