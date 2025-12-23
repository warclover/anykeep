/**
 * GetMdCollection Tool - 获取 MD 收藏详情
 *
 * 获取单条 Markdown 收藏的完整信息
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  id: z.number().int().positive().describe("MD 收藏 ID"),
  includeContent: z
    .boolean()
    .optional()
    .default(false)
    .describe("是否包含原始内容（较大，默认不包含）"),
});

type GetMdCollectionParams = z.infer<typeof paramsSchema>;

interface MdCollectionDetail {
  id: number;
  title: string;
  rawContent?: string; // 仅当 includeContent=true 时返回
  contentPreview: string; // 内容预览（前 500 字符）
  wordCount: number;
  codeBlockCount: number;
  readingTimeMinutes: number;
  contentType: string | null;
  contentTypeConfidence: number | null;
  aiSummary: string | null;
  aiTags: string[] | null;
  userTags: string[] | null;
  notes: string | null;
  folderId: number | null;
  folderName: string | null;
  sourceType: string | null;
  sourceFilename: string | null;
  isRead: boolean;
  isStarred: boolean;
  processingStatus: string;
  processingError: string | null;
  readAt: string | null;
  starredAt: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface GetMdCollectionResult {
  collection: MdCollectionDetail;
  message: string;
}

// ============================================
// Tool 实现
// ============================================

export const getMdCollectionTool: Tool<
  GetMdCollectionParams,
  GetMdCollectionResult
> = {
  definition: {
    name: "get_md_collection",
    description: `获取单条 Markdown 收藏的完整详情。

使用场景：
- 用户要求 "查看这条 MD 收藏的详情"
- 用户要求 "显示 ID 为 123 的 MD 文档"
- 用户要求 "读取这篇 MD 收藏的内容"

返回信息：
- 基本信息：标题、字数、代码块数、阅读时间
- AI 处理结果：摘要、标签、内容类型分类
- 用户数据：用户标签、笔记、文件夹
- 状态信息：已读、星标、处理状态
- 来源信息：上传/粘贴/API、原始文件名

注意事项：
- 默认不返回原始内容以减少数据量
- 设置 includeContent=true 可获取完整内容`,
    parameters: paramsSchema,
    category: "read",
    requiresConfirmation: false,
    estimatedDurationMs: 100,
  },

  async execute(
    params: GetMdCollectionParams,
    context,
  ): Promise<ToolResult<GetMdCollectionResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 查询 MD 收藏详情
      const { data: collection, error: fetchError } = await supabase
        .from("md_collections")
        .select(
          `
          id,
          title,
          raw_content,
          word_count,
          code_block_count,
          reading_time_minutes,
          content_type,
          content_type_confidence,
          ai_summary,
          ai_tags,
          user_tags,
          notes,
          folder_id,
          source_type,
          source_filename,
          is_read,
          is_starred,
          processing_status,
          processing_error,
          read_at,
          starred_at,
          processed_at,
          created_at,
          updated_at
        `,
        )
        .eq("id", params.id)
        .eq("user_id", context.userId)
        .is("deleted_at", null)
        .single();

      if (fetchError || !collection) {
        return {
          success: false,
          error: "MD 收藏不存在或无权访问",
          errorCode: "NOT_FOUND",
        };
      }

      // 2. 如果有文件夹，获取文件夹名称
      let folderName: string | null = null;
      if (collection.folder_id) {
        const { data: folder } = await supabase
          .from("folders")
          .select("name")
          .eq("id", collection.folder_id)
          .single();
        folderName = folder?.name || null;
      }

      // 3. 构建内容预览
      const contentPreview = collection.raw_content
        ? collection.raw_content.substring(0, 500) +
          (collection.raw_content.length > 500 ? "..." : "")
        : "";

      // 4. 格式化结果
      const detail: MdCollectionDetail = {
        id: collection.id,
        title: collection.title,
        contentPreview,
        wordCount: collection.word_count,
        codeBlockCount: collection.code_block_count,
        readingTimeMinutes: collection.reading_time_minutes,
        contentType: collection.content_type,
        contentTypeConfidence: collection.content_type_confidence,
        aiSummary: collection.ai_summary,
        aiTags: collection.ai_tags,
        userTags: collection.user_tags,
        notes: collection.notes,
        folderId: collection.folder_id,
        folderName,
        sourceType: collection.source_type,
        sourceFilename: collection.source_filename,
        isRead: collection.is_read,
        isStarred: collection.is_starred,
        processingStatus: collection.processing_status,
        processingError: collection.processing_error,
        readAt: collection.read_at,
        starredAt: collection.starred_at,
        processedAt: collection.processed_at,
        createdAt: collection.created_at,
        updatedAt: collection.updated_at,
      };

      // 5. 如果需要完整内容
      if (params.includeContent) {
        detail.rawContent = collection.raw_content;
      }

      logger.info(
        {
          toolName: "get_md_collection",
          userId: context.userId,
          collectionId: collection.id,
          includeContent: params.includeContent,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "get_md_collection: Success",
      );

      return {
        success: true,
        data: {
          collection: detail,
          message: `已获取 MD 收藏「${collection.title}」的详情`,
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
          toolName: "get_md_collection",
          userId: context.userId,
          collectionId: params.id,
          error: errorMessage,
        },
        "get_md_collection: Failed",
      );

      return {
        success: false,
        error: `获取 MD 收藏详情失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
