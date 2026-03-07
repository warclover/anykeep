/**
 * 标签列表 API 路由
 * GET /api/tags - 获取用户的标签列表（含使用计数）
 *
 * 查询参数：
 * - limit: 返回标签数量上限（默认 100，最大 500）
 * - sort: 排序方式 - 'count'(使用频率) | 'name'(字母) | 'recent'(最近使用)
 * - type: 标签类型 - 'all' | 'user' | 'ai'（默认 'all'）
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { logger } from "@/lib/logger";

interface TagInfo {
  name: string;
  count: number;
  type: "user" | "ai" | "mixed";
}

// 响应类型定义（供文档参考）
interface _TagsResponse {
  success: boolean;
  data: {
    tags: TagInfo[];
    total: number;
  };
}

/**
 * GET /api/tags
 * 获取用户的所有标签及其使用计数
 */
export const GET = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    // 1. 解析查询参数
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "100", 10), 1),
      500,
    );
    const sort = searchParams.get("sort") || "count";
    const type = searchParams.get("type") || "all";

    // 2. 查询标签数据
    const supabase = await createClient();

    // 构建查询 - 获取用户的书签中所有标签
    // 类型断言: 手动维护类型文件时需要此断言
    type BookmarkTagsRow = {
      user_tags: string[] | null;
      ai_tags: string[] | null;
    };
    const { data: bookmarks, error: queryError } = (await supabase
      .from("bookmarks")
      .select("user_tags, ai_tags")
      .eq("user_id", userId)
      .eq("is_deleted", false)) as {
      data: BookmarkTagsRow[] | null;
      error: { message: string } | null;
    };

    if (queryError) {
      logger.error({ error: queryError.message }, "Failed to fetch tags");
      return NextResponse.json(
        { error: "Failed to fetch tags" },
        { status: 500 },
      );
    }

    // 3. 统计标签使用频率
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

    // 4. 合并并分类标签
    const tagMap = new Map<string, TagInfo>();

    // 根据 type 过滤
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
        // 已存在的标签，累加计数
        const existing = tagMap.get(name);
        if (existing) {
          existing.count += count;
          existing.type = "mixed";
        } else {
          tagMap.set(name, { name, count, type: "ai" });
        }
      }
    }

    // 5. 排序
    let tags = Array.from(tagMap.values());

    switch (sort) {
      case "name":
        tags.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
        break;
      case "count":
      default:
        tags.sort((a, b) => b.count - a.count);
        break;
    }

    // 6. 应用限制
    const total = tags.length;
    tags = tags.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        tags,
        total,
      },
    });
  },
);
