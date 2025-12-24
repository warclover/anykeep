/**
 * 列出文件夹 Tool
 *
 * 获取用户的所有文件夹，支持分组筛选和归档状态筛选
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import type { Folder } from "@/types/supabase";
import type { FolderSummary } from "./types";

const paramsSchema = z.object({
  group: z
    .enum(["work", "study", "life", "entertainment", "other"])
    .optional()
    .describe(
      "按分组筛选：work-工作、study-学习、life-生活、entertainment-娱乐、other-其他",
    ),
  includeArchived: z
    .boolean()
    .optional()
    .default(false)
    .describe("是否包含已归档文件夹，默认 false"),
  includeSystem: z
    .boolean()
    .optional()
    .default(false)
    .describe("是否包含系统文件夹（如 INBOX），默认 false"),
  parentId: z.number().optional().describe("父文件夹 ID，用于获取子文件夹"),
});

type ListFoldersParams = z.infer<typeof paramsSchema>;

/**
 * 列出文件夹 Tool
 */
export const listFoldersTool: Tool<ListFoldersParams, FolderSummary[]> = {
  definition: {
    name: "list_folders",
    description: `获取用户的所有文件夹列表。用于回答：
- "我有哪些文件夹"
- "查看我的收藏夹"
- "列出所有文件夹"
- "显示工作相关的文件夹"
返回文件夹名称、分组、书签数量等信息。`,
    parameters: paramsSchema,
    category: "query",
  },

  async execute(
    params: ListFoldersParams,
    context: ToolContext,
  ): Promise<ToolResult<FolderSummary[]>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 构建查询
      let query = supabase
        .from("folders")
        .select("*")
        .eq("user_id", context.userId)
        .is("deleted_at", null);

      // 是否包含归档
      if (!params.includeArchived) {
        query = query.eq("is_archived", false);
      }

      // 是否包含系统文件夹
      if (!params.includeSystem) {
        query = query.or("is_system.is.null,is_system.eq.false");
      }

      // 按分组筛选
      if (params.group) {
        query = query.eq("folder_group", params.group);
      }

      // 按父文件夹筛选
      if (params.parentId !== undefined) {
        query = query.eq("parent_id", params.parentId);
      }

      // 排序：按排序顺序，然后按名称
      query = query
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });

      const { data: folders, error } = await query;

      if (error) {
        return {
          success: false,
          error: `查询文件夹失败: ${error.message}`,
          errorCode: "QUERY_ERROR",
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 获取书签数量
      const folderIds = (folders as Folder[])?.map((f) => f.id) || [];

      let bookmarkCounts: Record<number, number> = {};

      if (folderIds.length > 0) {
        const { data: counts } = await supabase
          .from("bookmarks")
          .select("folder_id")
          .in("folder_id", folderIds)
          .is("deleted_at", null);

        // 统计每个文件夹的书签数
        if (counts) {
          bookmarkCounts = counts.reduce(
            (acc, item) => {
              const folderId = item.folder_id as number;
              acc[folderId] = (acc[folderId] || 0) + 1;
              return acc;
            },
            {} as Record<number, number>,
          );
        }
      }

      // 转换为摘要格式
      const summaries: FolderSummary[] = ((folders as Folder[]) || []).map(
        (folder) => ({
          id: folder.id,
          name: folder.name,
          parentId: folder.parent_id,
          group: folder.folder_group,
          isArchived: folder.is_archived,
          isSystem: folder.is_system || false,
          systemType: folder.system_type,
          sortOrder: folder.sort_order,
          bookmarkCount: bookmarkCounts[folder.id] || 0,
          createdAt: folder.created_at,
        }),
      );

      return {
        success: true,
        data: summaries,
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: summaries.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "获取文件夹失败",
        errorCode: "EXECUTION_ERROR",
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    }
  },
};
