/**
 * 获取文件夹内书签 Tool
 *
 * 获取指定文件夹内的书签列表，支持分页和排序
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import type { BookmarkInFolderSummary, FolderBookmarksResult } from "./types";
import { FOLDER_TOOL_DESCRIPTIONS } from "../tool-description-templates";

const paramsSchema = z.object({
  folderId: z.number().describe("文件夹 ID"),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe("返回数量，默认 20，最大 100"),
  offset: z.number().min(0).optional().default(0).describe("偏移量，用于分页"),
  sortBy: z
    .enum(["created_at", "title", "rating"])
    .optional()
    .default("created_at")
    .describe("排序字段：created_at-创建时间、title-标题、rating-评分"),
  sortOrder: z
    .enum(["asc", "desc"])
    .optional()
    .default("desc")
    .describe("排序顺序：asc-升序、desc-降序"),
  starredOnly: z
    .boolean()
    .optional()
    .default(false)
    .describe("是否只返回收藏的书签"),
  unreadOnly: z
    .boolean()
    .optional()
    .default(false)
    .describe("是否只返回未读书签"),
});

type GetFolderBookmarksParams = z.infer<typeof paramsSchema>;

/**
 * 获取文件夹内书签 Tool
 */
export const getFolderBookmarksTool: Tool<
  GetFolderBookmarksParams,
  FolderBookmarksResult
> = {
  definition: {
    name: "get_folder_bookmarks",
    description: FOLDER_TOOL_DESCRIPTIONS.get_folder_bookmarks,
    parameters: paramsSchema,
    category: "query",
  },

  async execute(
    params: GetFolderBookmarksParams,
    context: ToolContext,
  ): Promise<ToolResult<FolderBookmarksResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 先验证文件夹存在且属于用户
      const { data: folder, error: folderError } = await supabase
        .from("folders")
        .select("id, name")
        .eq("id", params.folderId)
        .eq("user_id", context.userId)
        .is("deleted_at", null)
        .single();

      if (folderError || !folder) {
        return {
          success: false,
          error: "文件夹不存在或无权访问",
          errorCode: "NOT_FOUND",
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 构建书签查询
      let query = supabase
        .from("bookmarks")
        .select(
          "id, title, url, platform, description, ai_summary, ai_tags, user_tags, rating, is_read, is_starred, created_at",
        )
        .eq("folder_id", params.folderId)
        .is("deleted_at", null);

      // 筛选条件
      if (params.starredOnly) {
        query = query.eq("is_starred", true);
      }
      if (params.unreadOnly) {
        query = query.eq("is_read", false);
      }

      // 排序
      const ascending = params.sortOrder === "asc";
      query = query.order(params.sortBy, {
        ascending,
        nullsFirst: false,
      });

      // 分页
      query = query.range(params.offset, params.offset + params.limit - 1);

      const { data: bookmarks, error: bookmarksError } = await query;

      if (bookmarksError) {
        return {
          success: false,
          error: `查询书签失败: ${bookmarksError.message}`,
          errorCode: "QUERY_ERROR",
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 获取总数
      let countQuery = supabase
        .from("bookmarks")
        .select("*", { count: "exact", head: true })
        .eq("folder_id", params.folderId)
        .is("deleted_at", null);

      if (params.starredOnly) {
        countQuery = countQuery.eq("is_starred", true);
      }
      if (params.unreadOnly) {
        countQuery = countQuery.eq("is_read", false);
      }

      const { count: totalCount } = await countQuery;

      // 转换为摘要格式
      const items: BookmarkInFolderSummary[] = (bookmarks || []).map(
        (bookmark) => ({
          id: bookmark.id,
          title: bookmark.title,
          url: bookmark.url,
          platform: bookmark.platform,
          description: bookmark.description,
          aiSummary: bookmark.ai_summary,
          aiTags: bookmark.ai_tags,
          userTags: bookmark.user_tags,
          rating: bookmark.rating,
          isRead: bookmark.is_read ?? false,
          isStarred: bookmark.is_starred ?? false,
          createdAt: bookmark.created_at,
        }),
      );

      const total = totalCount || 0;
      const hasMore = params.offset + items.length < total;

      return {
        success: true,
        data: {
          folderName: folder.name,
          folderId: folder.id,
          items,
          total,
          hasMore,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: items.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "获取书签失败",
        errorCode: "EXECUTION_ERROR",
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    }
  },
};
