/**
 * list_by_platform Tool
 *
 * 按平台获取书签，支持时间范围过滤
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
  platform: z
    .enum([
      "WECHAT",
      "BILIBILI",
      "XIAOHONGSHU",
      "ZHIHU",
      "WEIBO",
      "DOUYIN",
      "BROWSER_CHROME",
      "BROWSER_EDGE",
      "BROWSER_FIREFOX",
      "BROWSER_SAFARI",
      "OTHER",
    ])
    .describe("平台类型"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe("返回数量，默认 20"),
  timeRange: timeRangeSchema,
});

type ListByPlatformParams = z.infer<typeof paramsSchema>;

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

interface ListByPlatformResult {
  platform: string;
  bookmarks: BookmarkItem[];
  total: number;
  timeRange: TimeRangeValue;
  timeRangeLabel: string;
}

// ============================================
// Tool 实现
// ============================================

export const listByPlatformTool: Tool<
  ListByPlatformParams,
  ListByPlatformResult
> = {
  definition: {
    name: "list_by_platform",
    description: QUERY_TOOL_DESCRIPTIONS.list_by_platform,
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 500,
  },

  async execute(
    params: ListByPlatformParams,
    context: ToolContext,
  ): Promise<ToolResult<ListByPlatformResult>> {
    const startTime = performance.now();
    const supabase = await createClient();
    const { platform, limit = 20 } = params;
    const timeRange = params.timeRange ?? "all";

    let query = supabase
      .from("bookmarks")
      .select("id, title, url, platform, user_tags, created_at", {
        count: "exact",
      })
      .eq("user_id", context.userId)
      .eq("platform", platform)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    // 应用时间范围过滤
    query = applyTimeRangeFilter(query, timeRange);

    const { data, count, error } = await query;

    if (error) {
      logger.error(
        {
          toolName: "list_by_platform",
          userId: context.userId,
          platform,
          limit,
          timeRange,
          error: error.message,
        },
        "list_by_platform: DB Error",
      );

      return {
        success: false,
        error: error.message,
        errorCode: "DB_ERROR",
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bookmarks: BookmarkItem[] = (data || []).map((item: any) => ({
      id: item.id,
      title: item.title || "",
      url: item.url,
      platform: item.platform || "OTHER",
      tags: item.user_tags || [],
      createdAt: item.created_at,
    }));

    logger.info(
      {
        toolName: "list_by_platform",
        userId: context.userId,
        platform,
        limit,
        timeRange,
        resultCount: bookmarks.length,
        total: count ?? 0,
        executionTimeMs: Math.round(performance.now() - startTime),
      },
      "list_by_platform: Success",
    );

    return {
      success: true,
      data: {
        platform,
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
