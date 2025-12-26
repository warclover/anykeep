/**
 * 获取文件夹详情 Tool
 *
 * 获取单个文件夹的详细信息，包括 profile 数据
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import type { Folder, FolderProfile } from "@/types/supabase";
import type { FolderDetail } from "./types";
import { FOLDER_TOOL_DESCRIPTIONS } from "../tool-description-templates";

const paramsSchema = z.object({
  folderId: z.number().describe("文件夹 ID"),
  includeTopTags: z
    .boolean()
    .optional()
    .default(true)
    .describe("是否包含热门标签，默认 true"),
  includeRecentTitles: z
    .boolean()
    .optional()
    .default(true)
    .describe("是否包含最近书签标题，默认 true"),
});

type GetFolderDetailParams = z.infer<typeof paramsSchema>;

/**
 * 获取文件夹详情 Tool
 */
export const getFolderDetailTool: Tool<GetFolderDetailParams, FolderDetail> = {
  definition: {
    name: "get_folder_detail",
    description: FOLDER_TOOL_DESCRIPTIONS.get_folder_detail,
    parameters: paramsSchema,
    category: "query",
  },

  async execute(
    params: GetFolderDetailParams,
    context: ToolContext,
  ): Promise<ToolResult<FolderDetail>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 获取文件夹基本信息
      const { data: folder, error: folderError } = await supabase
        .from("folders")
        .select("*")
        .eq("id", params.folderId)
        .eq("user_id", context.userId)
        .is("deleted_at", null)
        .single();

      if (folderError || !folder) {
        return {
          success: false,
          error: folderError?.message || "文件夹不存在",
          errorCode: "NOT_FOUND",
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      const typedFolder = folder as Folder;

      // 获取文件夹 profile
      const { data: profile } = await supabase
        .from("folder_profiles")
        .select("*")
        .eq("folder_id", params.folderId)
        .single();

      const typedProfile = profile as FolderProfile | null;

      // 获取书签数量
      const { count: bookmarkCount } = await supabase
        .from("bookmarks")
        .select("*", { count: "exact", head: true })
        .eq("folder_id", params.folderId)
        .is("deleted_at", null);

      // 获取热门标签（如果需要）
      let topTags: string[] = [];
      if (params.includeTopTags) {
        const { data: bookmarksWithTags } = await supabase
          .from("bookmarks")
          .select("ai_tags, user_tags")
          .eq("folder_id", params.folderId)
          .is("deleted_at", null)
          .limit(100);

        if (bookmarksWithTags) {
          // 统计标签频率
          const tagCounts: Record<string, number> = {};
          for (const bookmark of bookmarksWithTags) {
            const allTags = [
              ...(bookmark.ai_tags || []),
              ...(bookmark.user_tags || []),
            ];
            for (const tag of allTags) {
              tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            }
          }
          // 排序取前 10
          topTags = Object.entries(tagCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([tag]) => tag);
        }
      }

      // 获取最近书签标题（如果需要）
      let recentTitles: string[] = [];
      if (params.includeRecentTitles) {
        const { data: recentBookmarks } = await supabase
          .from("bookmarks")
          .select("title")
          .eq("folder_id", params.folderId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(5);

        if (recentBookmarks) {
          recentTitles = recentBookmarks.map((b) => b.title);
        }
      }

      // 构建详情
      const detail: FolderDetail = {
        id: typedFolder.id,
        name: typedFolder.name,
        parentId: typedFolder.parent_id,
        group: typedFolder.folder_group,
        isArchived: typedFolder.is_archived,
        isSystem: typedFolder.is_system || false,
        systemType: typedFolder.system_type,
        sortOrder: typedFolder.sort_order,
        bookmarkCount: bookmarkCount || 0,
        createdAt: typedFolder.created_at,
        // Profile 信息
        heatScore: typedProfile?.heat_score || null,
        internalSimilarity: typedProfile?.internal_similarity || null,
        boundaryClarity: typedProfile?.boundary_clarity || null,
        isAiRenamable: typedProfile?.is_ai_renamable || false,
        isMergeCandidate: typedProfile?.is_merge_candidate || false,
        isSplitCandidate: typedProfile?.is_split_candidate || false,
        isSystemLocked: typedProfile?.is_system_locked || false,
        lastBookmarkAt: typedProfile?.last_bookmark_at || null,
        profileComputedAt: typedProfile?.computed_at || null,
        coreCount: typedProfile?.core_count || null,
        edgeCount: typedProfile?.edge_count || null,
        topTags,
        recentTitles,
      };

      return {
        success: true,
        data: detail,
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "获取文件夹详情失败",
        errorCode: "EXECUTION_ERROR",
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    }
  },
};
