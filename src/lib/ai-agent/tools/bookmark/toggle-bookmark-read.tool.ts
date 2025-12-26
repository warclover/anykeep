/**
 * ToggleBookmarkRead Tool - 切换书签已读状态
 *
 * 切换书签的已读/未读状态，支持明确指定目标状态或自动切换
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
  bookmarkId: z.number().int().positive().describe("要操作的书签 ID"),
  isRead: z
    .boolean()
    .optional()
    .describe("目标状态：true-已读、false-未读。不传则切换当前状态"),
});

type ToggleBookmarkReadParams = z.infer<typeof paramsSchema>;

interface ToggleBookmarkReadResult {
  bookmarkId: number;
  bookmarkTitle: string;
  isRead: boolean;
  message: string;
}

// ============================================
// Tool 实现
// ============================================

export const toggleBookmarkReadTool: Tool<
  ToggleBookmarkReadParams,
  ToggleBookmarkReadResult
> = {
  definition: {
    name: "toggle_bookmark_read",
    description: BOOKMARK_TOOL_DESCRIPTIONS.toggle_bookmark_read,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: false,
    estimatedDurationMs: 100,
  },

  async execute(
    params: ToggleBookmarkReadParams,
    context,
  ): Promise<ToolResult<ToggleBookmarkReadResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 获取书签信息并验证所有权
      const { data: bookmark, error: fetchError } = await supabase
        .from("bookmarks")
        .select("id, title, is_read")
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

      // 2. 计算目标状态
      const targetState = params.isRead ?? !bookmark.is_read;

      // 3. 检查状态是否相同
      if (bookmark.is_read === targetState) {
        const statusText = targetState ? "已读" : "未读";
        return {
          success: true,
          data: {
            bookmarkId: bookmark.id,
            bookmarkTitle: bookmark.title,
            isRead: targetState,
            message: `书签「${bookmark.title}」已是${statusText}状态`,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 4. 更新状态
      const now = new Date().toISOString();
      const updateData: Record<string, unknown> = {
        is_read: targetState,
        updated_at: now,
      };

      // 如果标记为已读，记录阅读时间
      if (targetState) {
        updateData.read_at = now;
      }

      const { error: updateError } = await supabase
        .from("bookmarks")
        .update(updateData)
        .eq("id", params.bookmarkId)
        .eq("user_id", context.userId);

      if (updateError) {
        throw updateError;
      }

      const message = targetState
        ? `已将书签「${bookmark.title}」标记为已读`
        : `已将书签「${bookmark.title}」标记为未读`;

      logger.info(
        {
          toolName: "toggle_bookmark_read",
          userId: context.userId,
          bookmarkId: bookmark.id,
          isRead: targetState,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "toggle_bookmark_read: Success",
      );

      return {
        success: true,
        data: {
          bookmarkId: bookmark.id,
          bookmarkTitle: bookmark.title,
          isRead: targetState,
          message,
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
          toolName: "toggle_bookmark_read",
          userId: context.userId,
          bookmarkId: params.bookmarkId,
          error: errorMessage,
        },
        "toggle_bookmark_read: Failed",
      );

      return {
        success: false,
        error: `切换已读状态失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
