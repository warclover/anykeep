/**
 * 获取智能列表计数 Tool
 *
 * 快速获取智能列表的书签数量（不返回内容）
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tool, ToolContext, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import type { SmartList, SmartListFilters } from "@/types/smart-list";

const paramsSchema = z.object({
  smartListId: z.number().describe("智能列表 ID"),
});

type GetSmartListCountParams = z.infer<typeof paramsSchema>;

interface SmartListCountResult {
  listName: string;
  listIcon: string;
  count: number;
}

/**
 * 根据筛选条件构建计数查询
 */
function buildCountQuery(
  supabase: SupabaseClient,
  filters: SmartListFilters,
  userId: string,
) {
  let query = supabase
    .from("bookmarks")
    .select("id", { count: "exact", head: true })
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
 * 获取智能列表计数 Tool
 */
export const getSmartListCountTool: Tool<
  GetSmartListCountParams,
  SmartListCountResult
> = {
  definition: {
    name: "get_smart_list_count",
    description: `快速获取智能列表的书签数量。用于回答：
- "待阅读有多少"
- "高价值内容数量"
- "最近一周收藏了几条"
只返回数量，不返回内容，速度更快。`,
    parameters: paramsSchema,
    category: "query",
    estimatedDurationMs: 200,
  },

  async execute(
    params: GetSmartListCountParams,
    context: ToolContext,
  ): Promise<ToolResult<SmartListCountResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 获取智能列表配置
      const { data: smartList, error: listError } = await supabase
        .from("smart_lists")
        .select("id, name, icon, filters")
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

      const list = smartList as Pick<
        SmartList,
        "id" | "name" | "icon" | "filters"
      >;
      const filters = list.filters as SmartListFilters;

      // 2. 执行计数查询
      const { count, error: countError } = await buildCountQuery(
        supabase,
        filters,
        context.userId,
      );

      if (countError) {
        return {
          success: false,
          error: `计数查询失败: ${countError.message}`,
          errorCode: "QUERY_ERROR",
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      return {
        success: true,
        data: {
          listName: list.name,
          listIcon: list.icon,
          count: count || 0,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "获取计数失败",
        errorCode: "EXECUTION_ERROR",
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    }
  },
};
