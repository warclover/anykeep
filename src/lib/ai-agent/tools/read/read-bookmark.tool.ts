/**
 * read_bookmark Tool
 *
 * 读取单个书签的完整详情
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  bookmark_id: z.number().int().positive().describe("书签 ID，必须是正整数"),
  include_content: z
    .boolean()
    .optional()
    .default(true)
    .describe("是否包含完整内容（AI 摘要、描述等），默认 true"),
  include_metadata: z
    .boolean()
    .optional()
    .default(true)
    .describe("是否包含元数据（创建时间、更新时间等），默认 true"),
});

type ReadParams = z.infer<typeof paramsSchema>;

interface BookmarkDetail {
  id: number;
  title: string;
  url: string;
  platform: string;
  // 内容相关
  description: string | null;
  aiSummary: string | null;
  notes: string | null;
  author: string | null;
  // 分类相关
  folderId: number | null;
  folderName: string | null;
  aiTags: string[] | null;
  userTags: string[] | null;
  // 状态
  isStarred: boolean;
  isRead: boolean;
  rating: number | null;
  // 元数据
  coverUrl: string | null;
  publishTime: string | null;
  wordCount: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface ReadResult {
  bookmark: BookmarkDetail;
  hasContent: boolean;
}

// ============================================
// Tool 实现
// ============================================

export const readBookmarkTool: Tool<ReadParams, ReadResult> = {
  definition: {
    name: "read_bookmark",
    description: `读取单个书签的完整详情。

使用场景：
- 用户询问某个特定书签的内容："帮我看看 ID 123 的书签"
- 用户需要书签的详细信息："这篇文章讲了什么"
- 为后续操作获取书签数据

返回信息：
- 基本信息：标题、URL、平台、作者
- 内容：描述、AI 摘要、用户笔记
- 分类：文件夹、AI 标签、用户标签
- 状态：是否收藏、是否已读、评分
- 元数据：发布时间、字数、创建/更新时间`,
    parameters: paramsSchema,
    category: "read",
    estimatedDurationMs: 200,
  },

  async execute(
    params: ReadParams,
    context: ToolContext,
  ): Promise<ToolResult<ReadResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 查询书签，同时获取文件夹信息
      const { data: bookmark, error } = await supabase
        .from("bookmarks")
        .select(
          `
          id,
          title,
          url,
          platform,
          description,
          ai_summary,
          notes,
          author,
          folder_id,
          folders:folder_id (name),
          ai_tags,
          user_tags,
          is_starred,
          is_read,
          rating,
          cover_url,
          publish_time,
          word_count,
          created_at,
          updated_at
        `,
        )
        .eq("id", params.bookmark_id)
        .eq("user_id", context.userId)
        .is("deleted_at", null)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // 未找到记录
          logger.warn(
            {
              toolName: "read_bookmark",
              userId: context.userId,
              bookmarkId: params.bookmark_id,
            },
            "Bookmark not found",
          );

          return {
            success: false,
            error: `未找到 ID 为 ${params.bookmark_id} 的书签，请确认书签 ID 是否正确`,
            errorCode: "NOT_FOUND",
          };
        }

        throw error;
      }

      // 转换为输出格式
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const folderData = bookmark.folders as any;
      const result: BookmarkDetail = {
        id: bookmark.id,
        title: bookmark.title,
        url: bookmark.url,
        platform: bookmark.platform,
        // 内容
        description: params.include_content ? bookmark.description : null,
        aiSummary: params.include_content ? bookmark.ai_summary : null,
        notes: params.include_content ? bookmark.notes : null,
        author: bookmark.author,
        // 分类
        folderId: bookmark.folder_id,
        folderName: folderData?.name || null,
        aiTags: bookmark.ai_tags,
        userTags: bookmark.user_tags,
        // 状态
        isStarred: bookmark.is_starred,
        isRead: bookmark.is_read ?? false,
        rating: bookmark.rating,
        // 元数据
        coverUrl: params.include_metadata ? bookmark.cover_url : null,
        publishTime: params.include_metadata ? bookmark.publish_time : null,
        wordCount: params.include_metadata ? bookmark.word_count : null,
        createdAt: params.include_metadata ? bookmark.created_at : null,
        updatedAt: params.include_metadata ? bookmark.updated_at : null,
      };

      // 判断是否有内容
      const hasContent = !!(
        bookmark.description ||
        bookmark.ai_summary ||
        bookmark.notes
      );

      logger.info(
        {
          toolName: "read_bookmark",
          userId: context.userId,
          bookmarkId: params.bookmark_id,
          hasContent,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "read_bookmark: Success",
      );

      return {
        success: true,
        data: {
          bookmark: result,
          hasContent,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "read_bookmark",
          userId: context.userId,
          bookmarkId: params.bookmark_id,
          error: errorMessage,
        },
        "read_bookmark: Failed",
      );

      return {
        success: false,
        error: `读取书签失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
