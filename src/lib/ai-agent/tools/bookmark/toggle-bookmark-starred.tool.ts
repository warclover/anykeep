/**
 * ToggleBookmarkStarred Tool - 切换书签星标状态
 *
 * 切换书签的星标状态，用于标记重要内容
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
  isStarred: z
    .boolean()
    .optional()
    .describe("目标状态：true-添加星标、false-取消星标。不传则切换当前状态"),
});

type ToggleBookmarkStarredParams = z.infer<typeof paramsSchema>;

interface ToggleBookmarkStarredResult {
  bookmarkId: number;
  bookmarkTitle: string;
  isStarred: boolean;
  message: string;
}

// ============================================
// Tool 实现
// ============================================

export const toggleBookmarkStarredTool: Tool<
  ToggleBookmarkStarredParams,
  ToggleBookmarkStarredResult
> = {
  definition: {
    name: "toggle_bookmark_starred",
    description: BOOKMARK_TOOL_DESCRIPTIONS.toggle_bookmark_starred,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: false,
    estimatedDurationMs: 100,
  },

  async execute(
    params: ToggleBookmarkStarredParams,
    context,
  ): Promise<ToolResult<ToggleBookmarkStarredResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 获取书签信息并验证所有权
      const { data: bookmark, error: fetchError } = await supabase
        .from("bookmarks")
        .select("id, title, is_starred")
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
      const targetState = params.isStarred ?? !bookmark.is_starred;

      // 3. 检查状态是否相同
      if (bookmark.is_starred === targetState) {
        const statusText = targetState ? "已添加星标" : "未添加星标";
        return {
          success: true,
          data: {
            bookmarkId: bookmark.id,
            bookmarkTitle: bookmark.title,
            isStarred: targetState,
            message: `书签「${bookmark.title}」${statusText}`,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 4. 更新状态
      const now = new Date().toISOString();
      const updateData: Record<string, unknown> = {
        is_starred: targetState,
        updated_at: now,
      };

      // 如果添加星标，记录星标时间
      if (targetState) {
        updateData.starred_at = now;
      } else {
        updateData.starred_at = null;
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
        ? `已为书签「${bookmark.title}」添加星标`
        : `已取消书签「${bookmark.title}」的星标`;

      logger.info(
        {
          toolName: "toggle_bookmark_starred",
          userId: context.userId,
          bookmarkId: bookmark.id,
          isStarred: targetState,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "toggle_bookmark_starred: Success",
      );

      return {
        success: true,
        data: {
          bookmarkId: bookmark.id,
          bookmarkTitle: bookmark.title,
          isStarred: targetState,
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
          toolName: "toggle_bookmark_starred",
          userId: context.userId,
          bookmarkId: params.bookmarkId,
          error: errorMessage,
        },
        "toggle_bookmark_starred: Failed",
      );

      return {
        success: false,
        error: `切换星标状态失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
