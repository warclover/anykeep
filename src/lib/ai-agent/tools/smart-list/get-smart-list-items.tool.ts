/**
 * 获取智能列表内容 Tool
 *
 * 获取智能列表中的书签内容
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tool, ToolContext, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import type {
  SmartList,
  SmartListFilters,
  SmartListSortBy,
} from "@/types/smart-list";
import type { SmartListQueryResult, BookmarkSummary } from "./types";

const paramsSchema = z.object({
  smartListId: z.number().describe("智能列表 ID"),
  limit: z.number().min(1).max(50).default(10).describe("返回数量，默认 10"),
  offset: z.number().default(0).describe("偏移量，默认 0"),
});

type GetSmartListItemsParams = z.infer<typeof paramsSchema>;

/**
 * 根据筛选条件构建书签查询（复用 API route 逻辑）
 */
function buildFilterQuery(
  supabase: SupabaseClient,
  filters: SmartListFilters,
  userId: string,
) {
  let query = supabase
    .from("bookmarks")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .is("deleted_at", null)
    .eq("is_in_trash", false);

  // 平台筛选
  if (filters.platform) {
    if (filters.platform === "browser") {
      query = query.in("platform", [
        "BROWSER_CHROME",
        "BROWSER_EDGE",
        "BROWSER_FIREFOX",
        "BROWSER_SAFARI",
      ]);
    } else if (Array.isArray(filters.platform)) {
      query = query.in("platform", filters.platform);
    } else {
      query = query.eq("platform", filters.platform);
    }
  }

  // 排除平台
  if (filters.excludePlatforms && filters.excludePlatforms.length > 0) {
    query = query.not(
      "platform",
      "in",
      `(${filters.excludePlatforms.map((p) => `"${p}"`).join(",")})`,
    );
  }

  // 文件夹筛选
  if (filters.folderId !== undefined) {
    if (filters.folderId === "uncategorized") {
      query = query.is("folder_id", null);
    } else {
      query = query.eq("folder_id", filters.folderId);
    }
  }

  // 用途标签筛选
  if (filters.usageTags && filters.usageTags.length > 0) {
    query = query.overlaps("user_tags", filters.usageTags);
  }

  // AI 标签筛选
  if (filters.aiTags && filters.aiTags.length > 0) {
    query = query.overlaps("ai_tags", filters.aiTags);
  }

  // 时间范围筛选
  if (filters.dateRange) {
    if (
      filters.dateRange.type === "relative" &&
      filters.dateRange.value &&
      filters.dateRange.unit
    ) {
      const now = new Date();
      const from = new Date(now);
      const { value, unit } = filters.dateRange;

      switch (unit) {
        case "day":
          from.setDate(from.getDate() - value);
          break;
        case "week":
          from.setDate(from.getDate() - value * 7);
          break;
        case "month":
          from.setMonth(from.getMonth() - value);
          break;
        case "year":
          from.setFullYear(from.getFullYear() - value);
          break;
      }

      query = query.gte("created_at", from.toISOString());
    } else if (filters.dateRange.type === "absolute") {
      if (filters.dateRange.from) {
        query = query.gte("created_at", filters.dateRange.from);
      }
      if (filters.dateRange.to) {
        query = query.lte("created_at", filters.dateRange.to);
      }
    }
  }

  // 阅读状态
  if (filters.isRead !== undefined) {
    query = query.eq("is_read", filters.isRead);
  }

  // 星标状态
  if (filters.isStarred !== undefined) {
    query = query.eq("is_starred", filters.isStarred);
  }

  // 有效性状态
  if (filters.isInvalid !== undefined) {
    query = query.eq("is_invalid", filters.isInvalid);
  }

  // 高价值（rating = 5）
  if (filters.isHighValue === true) {
    query = query.eq("rating", 5);
  }

  // 评级范围
  if (filters.rating) {
    if (filters.rating.min !== undefined) {
      query = query.gte("rating", filters.rating.min);
    }
    if (filters.rating.max !== undefined) {
      query = query.lte("rating", filters.rating.max);
    }
  }

  // 关键词搜索
  if (filters.keyword) {
    query = query.or(
      `title.ilike.%${filters.keyword}%,description.ilike.%${filters.keyword}%`,
    );
  }

  // 来源名称
  if (filters.sourceName) {
    query = query.ilike("source_name", `%${filters.sourceName}%`);
  }

  return query;
}

/**
 * 应用排序
 */
function applySorting(
  query: ReturnType<typeof buildFilterQuery>,
  sortBy: SmartListSortBy,
) {
  switch (sortBy) {
    case "created_desc":
      return query.order("created_at", { ascending: false });
    case "created_asc":
      return query.order("created_at", { ascending: true });
    case "title_asc":
      return query.order("title", { ascending: true });
    case "title_desc":
      return query.order("title", { ascending: false });
    case "rating_desc":
      return query.order("rating", { ascending: false, nullsFirst: false });
    case "publish_time_desc":
      return query.order("publish_time", {
        ascending: false,
        nullsFirst: false,
      });
    default:
      return query.order("created_at", { ascending: false });
  }
}

/**
 * 获取智能列表内容 Tool
 */
export const getSmartListItemsTool: Tool<
  GetSmartListItemsParams,
  SmartListQueryResult
> = {
  definition: {
    name: "get_smart_list_items",
    description: `获取智能列表中的书签内容。用于回答：
- "看看我的待阅读"
- "最近一周收藏了什么"
- "查看高价值内容"
返回书签标题、摘要、标签等信息。`,
    parameters: paramsSchema,
    category: "query",
  },

  async execute(
    params: GetSmartListItemsParams,
    context: ToolContext,
  ): Promise<ToolResult<SmartListQueryResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 获取智能列表配置
      const { data: smartList, error: listError } = await supabase
        .from("smart_lists")
        .select("*")
        .eq("id", params.smartListId)
        .eq("user_id", context.userId)
        .is("deleted_at", null)
        .single();

      if (listError || !smartList) {
        return {
          success: false,
          error: "智能列表不存在或无权限访问",
          errorCode: "NOT_FOUND",
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      const list = smartList as SmartList;
      const filters = list.filters as SmartListFilters;

      // 2. 构建并执行查询
      let query = buildFilterQuery(supabase, filters, context.userId);
      query = applySorting(query, list.sort_by);

      // 分页
      const {
        data: bookmarks,
        count,
        error: queryError,
      } = await query.range(params.offset, params.offset + params.limit - 1);

      if (queryError) {
        return {
          success: false,
          error: `查询书签失败: ${queryError.message}`,
          errorCode: "QUERY_ERROR",
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 3. 转换为摘要格式
      const items: BookmarkSummary[] = (bookmarks || []).map((b) => ({
        id: b.id,
        title: b.title,
        url: b.url,
        platform: b.platform,
        description: b.description,
        aiSummary: b.ai_summary,
        aiTags: b.ai_tags,
        userTags: b.user_tags,
        rating: b.rating,
        isRead: b.is_read,
        isStarred: b.is_starred,
        createdAt: b.created_at,
      }));

      const total = count || 0;

      return {
        success: true,
        data: {
          listName: list.name,
          listIcon: list.icon,
          items,
          total,
          hasMore: total > params.offset + params.limit,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: items.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "获取列表内容失败",
        errorCode: "EXECUTION_ERROR",
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    }
  },
};
