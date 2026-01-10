/**
 * count_by_folder Tool
 *
 * 统计某个文件夹的收藏数量，支持时间范围过滤
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
  folder_id: z.number().int().positive().describe("文件夹 ID"),
  timeRange: timeRangeSchema,
});

type CountByFolderParams = z.infer<typeof paramsSchema>;

// ============================================
// 结果类型
// ============================================

interface CountByFolderResult {
  folderName: string | null;
  count: number;
  timeRange: TimeRangeValue;
  timeRangeLabel: string;
}

// ============================================
// Tool 实现
// ============================================

export const countByFolderTool: Tool<CountByFolderParams, CountByFolderResult> =
  {
    definition: {
      name: "count_by_folder",
      description: QUERY_TOOL_DESCRIPTIONS.count_by_folder,
      parameters: paramsSchema,
      category: "query",
      requiresConfirmation: false,
      estimatedDurationMs: 300,
    },

    async execute(
      params: CountByFolderParams,
      context: ToolContext,
    ): Promise<ToolResult<CountByFolderResult>> {
      const startTime = performance.now();
      const supabase = await createClient();
      const { folder_id } = params;
      const timeRange = params.timeRange ?? "all";

      // 获取文件夹名称
      const { data: folder } = await supabase
        .from("folders")
        .select("name")
        .eq("id", folder_id)
        .eq("user_id", context.userId)
        .single();

      // 统计数量
      let query = supabase
        .from("bookmarks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .eq("folder_id", folder_id)
        .is("deleted_at", null);

      // 应用时间范围过滤
      query = applyTimeRangeFilter(query, timeRange);

      const { count, error } = await query;

      if (error) {
        logger.error(
          {
            toolName: "count_by_folder",
            userId: context.userId,
            folderId: folder_id,
            timeRange,
            error: error.message,
          },
          "count_by_folder: DB Error",
        );

        return {
          success: false,
          error: error.message,
          errorCode: "DB_ERROR",
        };
      }

      logger.info(
        {
          toolName: "count_by_folder",
          userId: context.userId,
          folderId: folder_id,
          folderName: folder?.name ?? null,
          timeRange,
          count: count ?? 0,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "count_by_folder: Success",
      );

      return {
        success: true,
        data: {
          folderName: folder?.name ?? null,
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
