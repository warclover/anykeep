/**
 * list_by_folder Tool
 *
 * 按文件夹获取书签（简化版）
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================
// 参数定义（简化）
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
}

// ============================================
// Tool 实现
// ============================================

export const listByFolderTool: Tool<ListByFolderParams, ListByFolderResult> = {
  definition: {
    name: "list_by_folder",
    description:
      "获取某个文件夹下的书签。用于回答「学习文件夹里有什么」「某个分类的内容」等问题。",
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

    // 先获取文件夹名称
    const { data: folder } = await supabase
      .from("folders")
      .select("name")
      .eq("id", folder_id)
      .eq("user_id", context.userId)
      .single();

    // 获取书签列表
    const { data, count, error } = await supabase
      .from("bookmarks")
      .select("id, title, url, platform, user_tags, created_at", {
        count: "exact",
      })
      .eq("user_id", context.userId)
      .eq("folder_id", folder_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      logger.error(
        {
          toolName: "list_by_folder",
          userId: context.userId,
          folderId: folder_id,
          limit,
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
        toolName: "list_by_folder",
        userId: context.userId,
        folderId: folder_id,
        folderName: folder?.name ?? null,
        limit,
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
      },
      metadata: {
        executionTimeMs: Math.round(performance.now() - startTime),
        affectedCount: bookmarks.length,
      },
    };
  },
};
