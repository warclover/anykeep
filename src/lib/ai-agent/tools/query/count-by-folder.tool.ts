/**
 * count_by_folder Tool
 *
 * 统计某个文件夹的收藏数量
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
// 参数定义（简化）
// ============================================

const paramsSchema = z.object({
  folder_id: z.number().int().positive().describe("文件夹 ID"),
});

type CountByFolderParams = z.infer<typeof paramsSchema>;

// ============================================
// 结果类型
// ============================================

interface CountByFolderResult {
  folderName: string | null;
  count: number;
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

      // 获取文件夹名称
      const { data: folder } = await supabase
        .from("folders")
        .select("name")
        .eq("id", folder_id)
        .eq("user_id", context.userId)
        .single();

      // 统计数量
      const { count, error } = await supabase
        .from("bookmarks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .eq("folder_id", folder_id)
        .is("deleted_at", null);

      if (error) {
        logger.error(
          {
            toolName: "count_by_folder",
            userId: context.userId,
            folderId: folder_id,
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
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: count ?? 0,
        },
      };
    },
  };
