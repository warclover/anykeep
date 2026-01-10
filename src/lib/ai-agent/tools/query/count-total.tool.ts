/**
 * count_total Tool
 *
 * 统计收藏总数，支持时间范围过滤
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
  timeRange: timeRangeSchema,
});

type CountTotalParams = z.infer<typeof paramsSchema>;

// ============================================
// 结果类型
// ============================================

interface CountTotalResult {
  total: number;
  timeRange: TimeRangeValue;
  timeRangeLabel: string;
}

// ============================================
// Tool 实现
// ============================================

export const countTotalTool: Tool<CountTotalParams, CountTotalResult> = {
  definition: {
    name: "count_total",
    description: QUERY_TOOL_DESCRIPTIONS.count_total,
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 300,
  },

  async execute(
    params: CountTotalParams,
    context: ToolContext,
  ): Promise<ToolResult<CountTotalResult>> {
    const startTime = performance.now();
    const supabase = await createClient();
    const timeRange = params.timeRange ?? "all";

    let query = supabase
      .from("bookmarks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .is("deleted_at", null);

    // 应用时间范围过滤
    query = applyTimeRangeFilter(query, timeRange);

    const { count, error } = await query;

    if (error) {
      logger.error(
        {
          toolName: "count_total",
          userId: context.userId,
          timeRange,
          error: error.message,
        },
        "count_total: DB Error",
      );

      return {
        success: false,
        error: error.message,
        errorCode: "DB_ERROR",
      };
    }

    logger.info(
      {
        toolName: "count_total",
        userId: context.userId,
        timeRange,
        total: count ?? 0,
        executionTimeMs: Math.round(performance.now() - startTime),
      },
      "count_total: Success",
    );

    return {
      success: true,
      data: {
        total: count ?? 0,
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
