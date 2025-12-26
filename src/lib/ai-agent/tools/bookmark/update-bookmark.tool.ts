/**
 * UpdateBookmark Tool - 更新书签信息
 *
 * 更新书签的标题、描述、标签等元信息
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { BOOKMARK_TOOL_DESCRIPTIONS } from "../tool-description-templates";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  bookmarkId: z.number().int().positive().describe("要更新的书签 ID"),
  title: z.string().min(1).max(500).optional().describe("新标题"),
  description: z.string().max(2000).optional().describe("新描述"),
  tags: z
    .array(z.string().max(50))
    .max(20)
    .optional()
    .describe("新标签列表（将替换现有标签）"),
  folderId: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .describe("新文件夹 ID（传 null 移出文件夹）"),
  notes: z.string().max(5000).optional().describe("用户笔记"),
});

type UpdateBookmarkParams = z.infer<typeof paramsSchema>;

interface UpdateBookmarkResult {
  bookmarkId: number;
  title: string;
  updatedFields: string[];
  message: string;
}

// ============================================
// Tool 实现
// ============================================

export const updateBookmarkTool: Tool<
  UpdateBookmarkParams,
  UpdateBookmarkResult
> = {
  definition: {
    name: "update_bookmark",
    description: BOOKMARK_TOOL_DESCRIPTIONS.update_bookmark,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: false,
    estimatedDurationMs: 150,
  },

  async execute(
    params: UpdateBookmarkParams,
    context,
  ): Promise<ToolResult<UpdateBookmarkResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 获取书签信息并验证所有权
      const { data: bookmark, error: fetchError } = await supabase
        .from("bookmarks")
        .select("id, title, folder_id")
        .eq("id", params.bookmarkId)
        .eq("user_id", context.userId)
        .is("deleted_at", null)
        .single();

      if (fetchError || !bookmark) {
        return {
          success: false,
          error: "书签不存在或无权访问",
          errorCode: "NOT_FOUND",
        };
      }

      // 2. 如果指定了新文件夹，验证文件夹存在
      if (params.folderId !== undefined && params.folderId !== null) {
        const { data: folder, error: folderError } = await supabase
          .from("folders")
          .select("id")
          .eq("id", params.folderId)
          .eq("user_id", context.userId)
          .is("deleted_at", null)
          .single();

        if (folderError || !folder) {
          return {
            success: false,
            error: "指定的文件夹不存在",
            errorCode: "FOLDER_NOT_FOUND",
          };
        }
      }

      // 3. 构建更新数据
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      const updatedFields: string[] = [];

      if (params.title !== undefined) {
        updateData.title = params.title;
        updatedFields.push("标题");
      }
      if (params.description !== undefined) {
        updateData.description = params.description;
        updatedFields.push("描述");
      }
      if (params.tags !== undefined) {
        updateData.user_tags = params.tags;
        updatedFields.push("标签");
      }
      if (params.folderId !== undefined) {
        updateData.folder_id = params.folderId;
        updatedFields.push("文件夹");
      }
      if (params.notes !== undefined) {
        updateData.notes = params.notes;
        updatedFields.push("笔记");
      }

      // 4. 如果没有要更新的字段
      if (updatedFields.length === 0) {
        return {
          success: true,
          data: {
            bookmarkId: bookmark.id,
            title: bookmark.title,
            updatedFields: [],
            message: "没有需要更新的字段",
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 5. 执行更新
      const { error: updateError } = await supabase
        .from("bookmarks")
        .update(updateData)
        .eq("id", params.bookmarkId)
        .eq("user_id", context.userId);

      if (updateError) {
        throw updateError;
      }

      const newTitle = params.title || bookmark.title;

      logger.info(
        {
          toolName: "update_bookmark",
          userId: context.userId,
          bookmarkId: bookmark.id,
          updatedFields,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "update_bookmark: Success",
      );

      return {
        success: true,
        data: {
          bookmarkId: bookmark.id,
          title: newTitle,
          updatedFields,
          message: `已更新书签「${newTitle}」的${updatedFields.join("、")}`,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: 1,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "update_bookmark",
          userId: context.userId,
          bookmarkId: params.bookmarkId,
          error: errorMessage,
        },
        "update_bookmark: Failed",
      );

      return {
        success: false,
        error: `更新书签失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
