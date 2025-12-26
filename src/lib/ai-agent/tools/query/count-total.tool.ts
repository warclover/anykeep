/**
 * count_total Tool
 *
 * 统计收藏总数（极简版）
 * 无参数，直接返回总数
 *
 * @version 1.1.0 - 增强描述，提升 LLM 工具选择准确性
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { QUERY_TOOL_DESCRIPTIONS } from "../tool-description-templates";

// ============================================
// 参数定义（无参数）
// ============================================

const paramsSchema = z.object({});

type CountTotalParams = z.infer<typeof paramsSchema>;

// ============================================
// 结果类型
// ============================================

interface CountTotalResult {
  total: number;
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
    _params: CountTotalParams,
    context: ToolContext,
  ): Promise<ToolResult<CountTotalResult>> {
    const startTime = performance.now();
    const supabase = await createClient();

    const { count, error } = await supabase
      .from("bookmarks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .is("deleted_at", null);

    if (error) {
      logger.error(
        {
          toolName: "count_total",
          userId: context.userId,
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
        total: count ?? 0,
        executionTimeMs: Math.round(performance.now() - startTime),
      },
      "count_total: Success",
    );

    return {
      success: true,
      data: {
        total: count ?? 0,
      },
      metadata: {
        executionTimeMs: Math.round(performance.now() - startTime),
        affectedCount: count ?? 0,
      },
    };
  },
};
