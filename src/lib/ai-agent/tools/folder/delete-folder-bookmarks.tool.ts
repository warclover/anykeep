/**
 * 删除文件夹内所有书签 Tool
 *
 * 删除指定文件夹内的所有书签
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type {
  Tool,
  ToolContext,
  ToolResult,
  PendingConfirmation,
} from "../types";
import {
  generateConfirmationId,
  getConfirmationExpiryTime,
  getBookmarkTitles,
} from "../utils";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { FOLDER_TOOL_DESCRIPTIONS } from "../tool-description-templates";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  folderId: z.number().int().positive().describe("要清空书签的文件夹 ID"),
});

type DeleteFolderBookmarksParams = z.infer<typeof paramsSchema>;

interface DeleteFolderBookmarksResult {
  folderId: number;
  folderName: string;
  deletedCount: number;
  message: string;
  /** 待确认操作（仅在需要确认时存在） */
  __pendingConfirmation?: PendingConfirmation;
}

// ============================================
// Tool 实现
// ============================================

export const deleteFolderBookmarksTool: Tool<
  DeleteFolderBookmarksParams,
  DeleteFolderBookmarksResult
> = {
  definition: {
    name: "delete_folder_bookmarks",
    description: FOLDER_TOOL_DESCRIPTIONS.delete_folder_bookmarks,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: true,
    estimatedDurationMs: 500,
  },

  async execute(
    params: DeleteFolderBookmarksParams,
    context: ToolContext,
  ): Promise<ToolResult<DeleteFolderBookmarksResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 获取文件夹信息
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
          error: "文件夹不存在或无权操作",
          errorCode: "NOT_FOUND",
        };
      }

      // 2. 获取文件夹内书签数量
      const { data: bookmarks, count: bookmarkCount } = await supabase
        .from("bookmarks")
        .select("id", { count: "exact" })
        .eq("folder_id", params.folderId)
        .is("deleted_at", null);

      const currentBookmarkCount = bookmarkCount || 0;

      // 3. 检查是否有书签
      if (currentBookmarkCount === 0) {
        return {
          success: false,
          error: "文件夹内没有书签",
          errorCode: "EMPTY_FOLDER",
        };
      }

      // 4. 如果需要确认且未确认，返回确认请求
      if (!context.confirmed) {
        const bookmarkIds = bookmarks?.map((b) => b.id) || [];
        const affectedItems = await getBookmarkTitles(
          context.userId,
          bookmarkIds.slice(0, 10), // 只显示前 10 个
        );

        const description = `清空文件夹「${folder.name}」`;
        const impactSummary = `删除文件夹「${folder.name}」中的 ${currentBookmarkCount} 个书签`;

        const confirmation: PendingConfirmation = {
          confirmationId: generateConfirmationId(),
          toolName: "delete_folder_bookmarks",
          description,
          impactSummary,
          affectedItems,
          params,
          expiresAt: getConfirmationExpiryTime(),
          riskLevel: "high",
        };

        logger.info(
          {
            toolName: "delete_folder_bookmarks",
            userId: context.userId,
            folderId: folder.id,
            bookmarkCount: currentBookmarkCount,
            confirmationId: confirmation.confirmationId,
          },
          "delete_folder_bookmarks: Confirmation required",
        );

        return {
          success: true,
          data: {
            folderId: folder.id,
            folderName: folder.name,
            deletedCount: 0,
            message: `待用户确认：${impactSummary}。界面上已显示确认对话框，用户点击"确认执行"按钮后将自动执行操作，你无需再次询问。`,
            __pendingConfirmation: confirmation,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 5. 已确认，执行删除操作
      const { error: deleteError } = await supabase
        .from("bookmarks")
        .update({
          deleted_at: new Date().toISOString(),
        })
        .eq("folder_id", params.folderId)
        .eq("user_id", context.userId)
        .is("deleted_at", null);

      if (deleteError) {
        throw deleteError;
      }

      const message = `已删除文件夹「${folder.name}」中的 ${currentBookmarkCount} 个书签`;

      logger.info(
        {
          toolName: "delete_folder_bookmarks",
          userId: context.userId,
          folderId: folder.id,
          deletedCount: currentBookmarkCount,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "delete_folder_bookmarks: Success",
      );

      return {
        success: true,
        data: {
          folderId: folder.id,
          folderName: folder.name,
          deletedCount: currentBookmarkCount,
          message,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: currentBookmarkCount,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "delete_folder_bookmarks",
          userId: context.userId,
          error: errorMessage,
        },
        "delete_folder_bookmarks: Failed",
      );

      return {
        success: false,
        error: `删除文件夹书签失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
