/**
 * 插件专用 - 创建收藏
 *
 * POST /api/plugin/bookmarks
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  verifyPluginAuth,
  createUnauthorizedResponse,
  hasScope,
} from "@/lib/auth/plugin-middleware";
import { logger } from "@/lib/logger";
import type { BookmarkRow } from "@/types/domain";

interface CreateBookmarkRequest {
  url: string;
  title: string;
  description?: string;
  tags?: string[];
  folder_id?: number | string; // 支持 number 或 string（会转换为 number）
}

export async function POST(request: NextRequest) {
  // 验证认证
  const authResult = await verifyPluginAuth(request);

  if (!authResult.success) {
    return createUnauthorizedResponse(authResult.error);
  }

  // 检查权限
  if (!hasScope(authResult, "bookmarks:write")) {
    return NextResponse.json(
      {
        error: "forbidden",
        message: "Insufficient scope: bookmarks:write required",
      },
      { status: 403 },
    );
  }

  try {
    const body: CreateBookmarkRequest = await request.json();
    const { url, title, description, tags, folder_id } = body;

    // 验证必需字段
    if (!url || !title) {
      return NextResponse.json(
        { error: "invalid_request", message: "url and title are required" },
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

    // 类型断言: 手动维护类型文件时需要此断言
    type BookmarkIdRow = { id: number };

    // 检查是否已存在
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = (await (serviceClient.from("bookmarks") as any)
      .select("id")
      .eq("user_id", authResult.userId)
      .eq("url", url)
      .single()) as { data: BookmarkIdRow | null };

    if (existing) {
      return NextResponse.json(
        {
          error: "already_exists",
          message: "This URL is already saved",
          bookmark: { id: existing.id },
        },
        { status: 409 },
      );
    }

    // 创建收藏
    // 处理 folder_id：转换为 number 或 null
    const parsedFolderId =
      folder_id != null
        ? typeof folder_id === "number"
          ? folder_id
          : parseInt(String(folder_id), 10)
        : null;
    const validFolderId =
      parsedFolderId && !isNaN(parsedFolderId) ? parsedFolderId : null;

    // 类型断言: 手动维护类型文件时需要此断言
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bookmark, error: insertError } = (await (
      serviceClient.from("bookmarks") as any
    )
      .insert({
        user_id: authResult.userId,
        url,
        title: title.substring(0, 500), // 限制长度
        description: description?.substring(0, 2000),
        platform: "browser_extension",
        folder_id: validFolderId,
      })
      .select()
      .single()) as {
      data: BookmarkRow | null;
      error: { message: string } | null;
    };

    if (insertError || !bookmark) {
      logger.error(
        { error: insertError?.message, userId: authResult.userId },
        "Plugin Bookmarks: Failed to create bookmark",
      );
      return NextResponse.json(
        { error: "server_error", message: "Failed to create bookmark" },
        { status: 500 },
      );
    }

    // 添加标签（如果有）
    if (tags && tags.length > 0 && bookmark) {
      const validTags = tags
        .slice(0, 20) // 最多 20 个标签
        .map((t) => t.trim().substring(0, 50)) // 每个标签最多 50 字符
        .filter(Boolean);

      if (validTags.length > 0) {
        // 类型断言: 手动维护类型文件时需要此断言
        type TagIdRow = { id: number };

        // 获取或创建标签
        for (const tagName of validTags) {
          // 查找现有标签
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let { data: tag } = (await (serviceClient.from("tags") as any)
            .select("id")
            .eq("user_id", authResult.userId)
            .eq("name", tagName)
            .single()) as { data: TagIdRow | null };

          // 如果不存在，创建新标签
          if (!tag) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: newTag } = (await (serviceClient.from("tags") as any)
              .insert({ user_id: authResult.userId, name: tagName })
              .select("id")
              .single()) as { data: TagIdRow | null };
            tag = newTag;
          }

          // 关联标签到收藏
          if (tag) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (serviceClient.from("bookmark_tags") as any).insert({
              bookmark_id: bookmark.id,
              tag_id: tag.id,
            });
          }
        }
      }
    }

    logger.info(
      { userId: authResult.userId, bookmarkId: bookmark.id, url },
      "Plugin Bookmarks: Bookmark created",
    );

    return NextResponse.json({
      success: true,
      bookmark: {
        id: bookmark.id,
        url: bookmark.url,
        title: bookmark.title,
        description: bookmark.description,
        platform: bookmark.platform,
        created_at: bookmark.created_at,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, "Plugin Bookmarks: Create error");

    return NextResponse.json(
      { error: "server_error", message: "Internal server error" },
      { status: 500 },
    );
  }
}
