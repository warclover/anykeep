/**
 * list_by_folder Tool
 *
 * 按文件夹获取书签，支持时间范围过滤
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

type ListByFolderParams = z.infer<typeof paramsSchema>;

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

interface ListByFolderResult {
  folderName: string | null;
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
  created_at: string | null;
}

// ============================================
// Tool 实现
// ============================================

export const listByFolderTool: Tool<ListByFolderParams, ListByFolderResult> = {
  definition: {
    name: "list_by_folder",
    description: QUERY_TOOL_DESCRIPTIONS.list_by_folder,
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 500,
  },

  async execute(
    params: ListByFolderParams,
    context: ToolContext,
  ): Promise<ToolResult<ListByFolderResult>> {
    const startTime = performance.now();
    const supabase = await createClient();
    const { folder_id, limit = 20 } = params;
    const timeRange = params.timeRange ?? "all";

    // 先获取文件夹名称
    const { data: folder } = await supabase
      .from("folders")
      .select("name")
      .eq("id", folder_id)
      .eq("user_id", context.userId)
      .single();

    // 获取书签列表
    let query = supabase
      .from("bookmarks")
      .select("id, title, url, platform, user_tags, created_at", {
        count: "exact",
      })
      .eq("user_id", context.userId)
      .eq("folder_id", folder_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    // 应用时间范围过滤
    query = applyTimeRangeFilter(query, timeRange);

    const { data, count, error } = await query;

    if (error) {
      logger.error(
        {
          toolName: "list_by_folder",
          userId: context.userId,
          folderId: folder_id,
          limit,
          timeRange,
          error: error.message,
        },
        "list_by_folder: DB Error",
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
        createdAt: item.created_at || new Date().toISOString(),
      }),
    );

    logger.info(
      {
        toolName: "list_by_folder",
        userId: context.userId,
        folderId: folder_id,
        folderName: folder?.name ?? null,
        limit,
        timeRange,
        resultCount: bookmarks.length,
        total: count ?? 0,
        executionTimeMs: Math.round(performance.now() - startTime),
      },
      "list_by_folder: Success",
    );

    return {
      success: true,
      data: {
        folderName: folder?.name ?? null,
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
