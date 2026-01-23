/**
 * list_recent Tool
 *
 * 获取书签列表，支持时间范围过滤
 *
 * @version 1.2.0 - 添加 timeRange 参数支持
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { QUERY_TOOL_DESCRIPTIONS } from "../tool-description-templates";
import {
  timeRangeSchema,
  applyTimeRangeFilter,
  getTimeRangeLabel,
  type TimeRangeValue,
} from "../shared/time-range.utils";

// ============================================
// 参数定义
// ============================================

const paramsSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe("返回数量，默认 10，最大 50"),
  timeRange: timeRangeSchema,
});

type ListRecentParams = z.infer<typeof paramsSchema>;

// ============================================
// 结果类型
// ============================================

interface BookmarkItem {
  id: number;
  title: string;
  url: string;
  platform: string;
  tags: string[];
  createdAt: string;
}

interface ListRecentResult {
  bookmarks: BookmarkItem[];
  total: number;
  timeRange: TimeRangeValue;
  timeRangeLabel: string;
}

// 本地类型定义 - Supabase 查询结果
interface BookmarkQueryRow {
  id: number;
  title: string | null;
  url: string;
  platform: string | null;
  user_tags: string[] | null;
  created_at: string;
}

// ============================================
// Tool 实现
// ============================================

export const listRecentTool: Tool<ListRecentParams, ListRecentResult> = {
  definition: {
    name: "list_recent",
    description: QUERY_TOOL_DESCRIPTIONS.list_recent,
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 500,
  },

  async execute(
    params: ListRecentParams,
    context: ToolContext,
  ): Promise<ToolResult<ListRecentResult>> {
    const startTime = performance.now();
    const supabase = await createClient();
    const limit = params.limit ?? 10;
    const timeRange = params.timeRange ?? "all";

    let query = supabase
      .from("bookmarks")
      .select("id, title, url, platform, user_tags, created_at", {
        count: "exact",
      })
      .eq("user_id", context.userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    // 应用时间范围过滤
    query = applyTimeRangeFilter(query, timeRange);

    const { data, count, error } = await query;

    if (error) {
      logger.error(
        {
          toolName: "list_recent",
          userId: context.userId,
          limit,
          timeRange,
          error: error.message,
        },
        "list_recent: DB Error",
      );

      return {
        success: false,
        error: error.message,
        errorCode: "DB_ERROR",
      };
    }

    const bookmarks: BookmarkItem[] = (data || []).map(
      (item: BookmarkQueryRow) => ({
        id: item.id,
        title: item.title || "",
        url: item.url,
        platform: item.platform || "OTHER",
        tags: item.user_tags || [],
        createdAt: item.created_at,
      }),
    );

    logger.info(
      {
        toolName: "list_recent",
        userId: context.userId,
        limit,
        timeRange,
        resultCount: bookmarks.length,
        total: count ?? 0,
        executionTimeMs: Math.round(performance.now() - startTime),
      },
      "list_recent: Success",
    );

    return {
      success: true,
      data: {
        bookmarks,
        total: count ?? 0,
        timeRange,
        timeRangeLabel: getTimeRangeLabel(timeRange),
      },
      metadata: {
        executionTimeMs: Math.round(performance.now() - startTime),
        affectedCount: bookmarks.length,
      },
    };
  },
};
