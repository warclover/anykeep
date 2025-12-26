/**
 * 移动单个书签到文件夹 Tool
 *
 * 将单个书签移动到指定文件夹
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
  bookmarkId: z.number().int().positive().describe("要移动的书签 ID"),
  targetFolderId: z
    .number()
    .int()
    .positive()
    .nullable()
    .describe("目标文件夹 ID，null 表示移出文件夹（根目录）"),
});

type MoveBookmarkParams = z.infer<typeof paramsSchema>;

interface MoveBookmarkResult {
  bookmarkId: number;
  bookmarkTitle: string;
  sourceFolderId: number | null;
  sourceFolderName: string | null;
  targetFolderId: number | null;
  targetFolderName: string | null;
  message: string;
  /** 待确认操作（仅在需要确认时存在） */
  __pendingConfirmation?: PendingConfirmation;
}

// ============================================
// Tool 实现
// ============================================

export const moveBookmarkToFolderTool: Tool<
  MoveBookmarkParams,
  MoveBookmarkResult
> = {
  definition: {
    name: "move_bookmark_to_folder",
    description: FOLDER_TOOL_DESCRIPTIONS.move_bookmark,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: true,
    estimatedDurationMs: 200,
  },

  async execute(
    params: MoveBookmarkParams,
    context: ToolContext,
  ): Promise<ToolResult<MoveBookmarkResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 获取书签信息并验证所有权
      const { data: bookmark, error: bookmarkError } = await supabase
        .from("bookmarks")
        .select("id, title, folder_id, folders(id, name)")
        .eq("id", params.bookmarkId)
        .eq("user_id", context.userId)
        .is("deleted_at", null)
        .single();

      if (bookmarkError || !bookmark) {
        return {
          success: false,
          error: "书签不存在或无权操作",
          errorCode: "NOT_FOUND",
        };
      }

      const sourceFolderId = bookmark.folder_id;
      const sourceFolderName =
        (bookmark.folders as { name: string } | null)?.name ?? null;

      // 2. 检查是否移动到相同位置
      if (sourceFolderId === params.targetFolderId) {
        return {
          success: false,
          error: "书签已在目标文件夹中",
          errorCode: "SAME_FOLDER",
        };
      }

      // 3. 验证目标文件夹（如果指定了文件夹）
      let targetFolderName: string | null = null;

      if (params.targetFolderId !== null) {
        const { data: targetFolder, error: folderError } = await supabase
          .from("folders")
          .select("id, name")
          .eq("id", params.targetFolderId)
          .eq("user_id", context.userId)
          .is("deleted_at", null)
          .single();

        if (folderError || !targetFolder) {
          return {
            success: false,
            error: "目标文件夹不存在或无权访问",
            errorCode: "FOLDER_NOT_FOUND",
          };
        }

        targetFolderName = targetFolder.name;
      }

      // 4. 如果需要确认且未确认，返回确认请求
      if (!context.confirmed) {
        const sourceDesc = sourceFolderName
          ? `「${sourceFolderName}」`
          : "根目录";
        const targetDesc = targetFolderName
          ? `「${targetFolderName}」`
          : "根目录";
        const description = `将「${bookmark.title}」从${sourceDesc}移动到${targetDesc}`;

        const confirmation: PendingConfirmation = {
          confirmationId: generateConfirmationId(),
          toolName: "move_bookmark_to_folder",
          description,
          impactSummary: description,
          affectedItems: [{ id: bookmark.id, title: bookmark.title }],
          params,
          expiresAt: getConfirmationExpiryTime(),
          riskLevel: "low",
        };

        logger.info(
          {
            toolName: "move_bookmark_to_folder",
            userId: context.userId,
            bookmarkId: bookmark.id,
            sourceFolderId,
            targetFolderId: params.targetFolderId,
            confirmationId: confirmation.confirmationId,
          },
          "move_bookmark_to_folder: Confirmation required",
        );

        return {
          success: true,
          data: {
            bookmarkId: bookmark.id,
            bookmarkTitle: bookmark.title,
            sourceFolderId,
            sourceFolderName,
            targetFolderId: params.targetFolderId,
            targetFolderName,
            message: `待用户确认：${description}。界面上已显示确认对话框，用户点击"确认执行"按钮后将自动执行操作，你无需再次询问。`,
            __pendingConfirmation: confirmation,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 5. 已确认，执行移动操作
      const { error: updateError } = await supabase
        .from("bookmarks")
        .update({
          folder_id: params.targetFolderId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.bookmarkId)
        .eq("user_id", context.userId);

      if (updateError) {
        throw updateError;
      }

      const targetDesc = targetFolderName
        ? `「${targetFolderName}」`
        : "根目录";
      const message = `已将「${bookmark.title}」移动到${targetDesc}`;

      logger.info(
        {
          toolName: "move_bookmark_to_folder",
          userId: context.userId,
          bookmarkId: bookmark.id,
          sourceFolderId,
          targetFolderId: params.targetFolderId,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "move_bookmark_to_folder: Success",
      );

      return {
        success: true,
        data: {
          bookmarkId: bookmark.id,
          bookmarkTitle: bookmark.title,
          sourceFolderId,
          sourceFolderName,
          targetFolderId: params.targetFolderId,
          targetFolderName,
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
          toolName: "move_bookmark_to_folder",
          userId: context.userId,
          error: errorMessage,
        },
        "move_bookmark_to_folder: Failed",
      );

      return {
        success: false,
        error: `移动书签失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
