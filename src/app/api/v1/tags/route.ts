/**
 * Tags API v1
 *
 * GET  /api/v1/tags - 获取标签列表
 * POST /api/v1/tags - 创建/合并标签
 *
 * @module api/v1/tags
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";

interface TagInfo {
  name: string;
  count: number;
  type: "user" | "ai" | "mixed";
}

// 查询参数 Schema
const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  sort: z.enum(["count", "name", "recent"]).default("count"),
  type: z.enum(["all", "user", "ai"]).default("all"),
  search: z.string().max(100).optional(),
});

// 创建/合并标签 Schema
const CreateTagSchema = z.object({
  action: z.enum(["merge", "rename"]),
  sourceTags: z.array(z.string().max(50)).min(1).max(20),
  targetTag: z.string().max(50),
});

/**
 * GET /api/v1/tags
 * 获取标签列表
 */
export const GET = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const params = QuerySchema.safeParse({
      limit: searchParams.get("limit") || 100,
      sort: searchParams.get("sort") || "count",
      type: searchParams.get("type") || "all",
      search: searchParams.get("search") || undefined,
    });

    if (!params.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "查询参数验证失败",
            details: params.error.flatten().fieldErrors,
          },
        },
        { status: 400 },
      );
    }

    const { limit, sort, type, search } = params.data;

    // 查询用户书签中的标签
    // 类型断言: 手动维护类型文件时需要此断言
    type BookmarkTagsRow = { user_tags: string[] | null; ai_tags: string[] | null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bookmarks, error } = await (supabase.from("bookmarks") as any)
      .select("user_tags, ai_tags")
      .eq("user_id", userId)
      .eq("is_deleted", false) as { data: BookmarkTagsRow[] | null; error: { message: string } | null };

    if (error) {
      logger.error(
        { error: error.message, userId },
        "[v1] Failed to fetch tags",
      );
      return NextResponse.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "获取标签失败" },
        },
        { status: 500 },
      );
    }

    // 统计标签使用频率
    const userTagCounts = new Map<string, number>();
    const aiTagCounts = new Map<string, number>();

    for (const bookmark of bookmarks || []) {
      // 统计用户标签
      if (bookmark.user_tags && Array.isArray(bookmark.user_tags)) {
        for (const tag of bookmark.user_tags) {
          if (typeof tag === "string" && tag.trim()) {
            const normalizedTag = tag.trim().toLowerCase();
            userTagCounts.set(
              normalizedTag,
              (userTagCounts.get(normalizedTag) || 0) + 1,
            );
          }
        }
      }

      // 统计 AI 标签
      if (bookmark.ai_tags && Array.isArray(bookmark.ai_tags)) {
        for (const tag of bookmark.ai_tags) {
          if (typeof tag === "string" && tag.trim()) {
            const normalizedTag = tag.trim().toLowerCase();
            aiTagCounts.set(
              normalizedTag,
              (aiTagCounts.get(normalizedTag) || 0) + 1,
            );
          }
        }
      }
    }

    // 合并并分类标签
    const tagMap = new Map<string, TagInfo>();

    if (type === "all" || type === "user") {
      for (const [name, count] of userTagCounts) {
        tagMap.set(name, {
          name,
          count,
          type: aiTagCounts.has(name) ? "mixed" : "user",
        });
      }
    }

    if (type === "all" || type === "ai") {
      for (const [name, count] of aiTagCounts) {
        const existing = tagMap.get(name);
        if (existing) {
          existing.count += count;
          existing.type = "mixed";
        } else {
          tagMap.set(name, { name, count, type: "ai" });
        }
      }
    }

    // 过滤搜索
    let tags = Array.from(tagMap.values());
    if (search) {
      const searchLower = search.toLowerCase();
      tags = tags.filter((t) => t.name.includes(searchLower));
    }

    // 排序
    switch (sort) {
      case "name":
        tags.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
        break;
      case "count":
      default:
        tags.sort((a, b) => b.count - a.count);
        break;
    }

    // 应用限制
    const total = tags.length;
    tags = tags.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        items: tags,
        total,
        limit,
      },
    });
  },
);

/**
 * POST /api/v1/tags
 * 创建/合并/重命名标签
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();

    // 解析请求体
    const body = await request.json();
    const validation = CreateTagSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "请求参数验证失败",
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 },
      );
    }

    const { action, sourceTags, targetTag } = validation.data;

    // 获取包含源标签的书签
    // 类型断言: 手动维护类型文件时需要此断言
    type BookmarkUserTagsRow = { id: number; user_tags: string[] | null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bookmarks, error: fetchError } = await (supabase.from("bookmarks") as any)
      .select("id, user_tags")
      .eq("user_id", userId)
      .eq("is_deleted", false) as { data: BookmarkUserTagsRow[] | null; error: { message: string } | null };

    if (fetchError) {
      logger.error(
        { error: fetchError.message },
        "[v1] Failed to fetch bookmarks for tag operation",
      );
      return NextResponse.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "获取书签失败" },
        },
        { status: 500 },
      );
    }

    const sourceTagsLower = sourceTags.map((t) => t.toLowerCase());
    const targetTagLower = targetTag.toLowerCase();
    let updatedCount = 0;

    for (const bookmark of bookmarks || []) {
      const currentTags: string[] = bookmark.user_tags || [];
      const currentTagsLower = currentTags.map((t) => t.toLowerCase());

      // 检查是否包含任何源标签
      const hasSourceTag = sourceTagsLower.some((st) =>
        currentTagsLower.includes(st),
      );
      if (!hasSourceTag) continue;

      // 构建新标签列表
      let newTags: string[];

      if (action === "merge" || action === "rename") {
        // 移除源标签，添加目标标签
        newTags = currentTags.filter(
          (t) => !sourceTagsLower.includes(t.toLowerCase()),
        );
        if (!newTags.map((t) => t.toLowerCase()).includes(targetTagLower)) {
          newTags.push(targetTag);
        }
      } else {
        continue;
      }

      // 更新书签
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase.from("bookmarks") as any)
        .update({ user_tags: newTags, updated_at: new Date().toISOString() })
        .eq("id", bookmark.id)
        .eq("user_id", userId);

      if (!updateError) {
        updatedCount++;
      }
    }

    logger.info(
      {
        userId,
        action,
        sourceTags,
        targetTag,
        updatedCount,
      },
      "[v1] Tag operation completed",
    );

    const message =
      action === "merge"
        ? `已将 ${sourceTags.length} 个标签合并到"${targetTag}"，影响 ${updatedCount} 个书签`
        : `已将标签重命名为"${targetTag}"，影响 ${updatedCount} 个书签`;

    return NextResponse.json({
      success: true,
      data: {
        action,
        sourceTags,
        targetTag,
        updatedCount,
        message,
      },
    });
  },
);
