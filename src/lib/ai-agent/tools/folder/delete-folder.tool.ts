/**
 * 删除文件夹 Tool
 *
 * 删除指定文件夹
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
import { generateConfirmationId, getConfirmationExpiryTime } from "../utils";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { FOLDER_TOOL_DESCRIPTIONS } from "../tool-description-templates";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  folderId: z.number().int().positive().describe("要删除的文件夹 ID"),
  deleteBookmarks: z
    .boolean()
    .optional()
    .default(false)
    .describe("是否同时删除文件夹内的书签，默认 false（书签移到根目录）"),
});

type DeleteFolderParams = z.infer<typeof paramsSchema>;

interface DeleteFolderResult {
  folderId: number;
  folderName: string;
  deletedBookmarkCount: number;
  movedBookmarkCount: number;
  message: string;
  /** 待确认操作（仅在需要确认时存在） */
  __pendingConfirmation?: PendingConfirmation;
}

// ============================================
// Tool 实现
// ============================================

export const deleteFolderTool: Tool<DeleteFolderParams, DeleteFolderResult> = {
  definition: {
    name: "delete_folder",
    description: FOLDER_TOOL_DESCRIPTIONS.delete_folder,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: true,
    estimatedDurationMs: 500,
  },

  async execute(
    params: DeleteFolderParams,
    context: ToolContext,
  ): Promise<ToolResult<DeleteFolderResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 获取文件夹信息
      const { data: folder, error: folderError } = await supabase
        .from("folders")
        .select("id, name, is_system")
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

      // 2. 检查是否为系统文件夹
      if (folder.is_system) {
        return {
          success: false,
          error: "系统文件夹不能删除",
          errorCode: "SYSTEM_FOLDER",
        };
      }

      // 3. 获取文件夹内书签数量
      const { count: bookmarkCount } = await supabase
        .from("bookmarks")
        .select("*", { count: "exact", head: true })
        .eq("folder_id", params.folderId)
        .is("deleted_at", null);

      const currentBookmarkCount = bookmarkCount || 0;

      // 4. 如果需要确认且未确认，返回确认请求
      if (!context.confirmed) {
        const description = `删除文件夹「${folder.name}」`;
        let impactSummary = `删除文件夹「${folder.name}」`;

        if (currentBookmarkCount > 0) {
          if (params.deleteBookmarks) {
            impactSummary += `，同时删除其中的 ${currentBookmarkCount} 个书签`;
          } else {
            impactSummary += `，其中 ${currentBookmarkCount} 个书签将移到根目录`;
          }
        }

        const confirmation: PendingConfirmation = {
          confirmationId: generateConfirmationId(),
          toolName: "delete_folder",
          description,
          impactSummary,
          affectedItems: [{ id: folder.id, title: folder.name }],
          params,
          expiresAt: getConfirmationExpiryTime(),
          riskLevel: "high",
        };

        logger.info(
          {
            toolName: "delete_folder",
            userId: context.userId,
            folderId: folder.id,
            bookmarkCount: currentBookmarkCount,
            deleteBookmarks: params.deleteBookmarks,
            confirmationId: confirmation.confirmationId,
          },
          "delete_folder: Confirmation required",
        );

        return {
          success: true,
          data: {
            folderId: folder.id,
            folderName: folder.name,
            deletedBookmarkCount: 0,
            movedBookmarkCount: 0,
            message: `待用户确认：${impactSummary}。界面上已显示确认对话框，用户点击"确认执行"按钮后将自动执行操作，你无需再次询问。`,
            __pendingConfirmation: confirmation,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 5. 已确认，执行删除操作
      let deletedBookmarkCount = 0;
      let movedBookmarkCount = 0;

      if (currentBookmarkCount > 0) {
        if (params.deleteBookmarks) {
          // 软删除书签
          const { error: deleteBookmarksError } = await supabase
            .from("bookmarks")
            .update({
              deleted_at: new Date().toISOString(),
            })
            .eq("folder_id", params.folderId)
            .eq("user_id", context.userId)
            .is("deleted_at", null);

          if (deleteBookmarksError) {
            throw deleteBookmarksError;
          }
          deletedBookmarkCount = currentBookmarkCount;
        } else {
          // 移动书签到根目录
          const { error: moveBookmarksError } = await supabase
            .from("bookmarks")
            .update({
              folder_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq("folder_id", params.folderId)
            .eq("user_id", context.userId)
            .is("deleted_at", null);

          if (moveBookmarksError) {
            throw moveBookmarksError;
          }
          movedBookmarkCount = currentBookmarkCount;
        }
      }

      // 6. 软删除文件夹
      const { error: deleteFolderError } = await supabase
        .from("folders")
        .update({
          deleted_at: new Date().toISOString(),
        })
        .eq("id", params.folderId)
        .eq("user_id", context.userId);

      if (deleteFolderError) {
        throw deleteFolderError;
      }

      let message = `已删除文件夹「${folder.name}」`;
      if (deletedBookmarkCount > 0) {
        message += `，同时删除了 ${deletedBookmarkCount} 个书签`;
      } else if (movedBookmarkCount > 0) {
        message += `，${movedBookmarkCount} 个书签已移到根目录`;
      }

      logger.info(
        {
          toolName: "delete_folder",
          userId: context.userId,
          folderId: folder.id,
          deletedBookmarkCount,
          movedBookmarkCount,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "delete_folder: Success",
      );

      return {
        success: true,
        data: {
          folderId: folder.id,
          folderName: folder.name,
          deletedBookmarkCount,
          movedBookmarkCount,
          message,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: 1 + deletedBookmarkCount,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "delete_folder",
          userId: context.userId,
          error: errorMessage,
        },
        "delete_folder: Failed",
      );

      return {
        success: false,
        error: `删除文件夹失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
