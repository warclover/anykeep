/**
 * count_by_platform Tool
 *
 * 统计某个平台的收藏数量，支持时间范围过滤
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
  timeRange: timeRangeSchema,
});

type CountByPlatformParams = z.infer<typeof paramsSchema>;

// ============================================
// 结果类型
// ============================================

interface CountByPlatformResult {
  platform: string;
  count: number;
  timeRange: TimeRangeValue;
  timeRangeLabel: string;
}

// ============================================
// Tool 实现
// ============================================

export const countByPlatformTool: Tool<
  CountByPlatformParams,
  CountByPlatformResult
> = {
  definition: {
    name: "count_by_platform",
    description: QUERY_TOOL_DESCRIPTIONS.count_by_platform,
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 300,
  },

  async execute(
    params: CountByPlatformParams,
    context: ToolContext,
  ): Promise<ToolResult<CountByPlatformResult>> {
    const startTime = performance.now();
    const supabase = await createClient();
    const { platform } = params;
    const timeRange = params.timeRange ?? "all";

    let query = supabase
      .from("bookmarks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("platform", platform)
      .is("deleted_at", null);

    // 应用时间范围过滤
    query = applyTimeRangeFilter(query, timeRange);

    const { count, error } = await query;

    if (error) {
      logger.error(
        {
          toolName: "count_by_platform",
          userId: context.userId,
          platform,
          timeRange,
          error: error.message,
        },
        "count_by_platform: DB Error",
      );

      return {
        success: false,
        error: error.message,
        errorCode: "DB_ERROR",
      };
    }

    logger.info(
      {
        toolName: "count_by_platform",
        userId: context.userId,
        platform,
        timeRange,
        count: count ?? 0,
        executionTimeMs: Math.round(performance.now() - startTime),
      },
      "count_by_platform: Success",
    );

    return {
      success: true,
      data: {
        platform,
        count: count ?? 0,
        timeRange,
        timeRangeLabel: getTimeRangeLabel(timeRange),
      },
      metadata: {
        executionTimeMs: Math.round(performance.now() - startTime),
        affectedCount: count ?? 0,
      },
    };
  },
};
