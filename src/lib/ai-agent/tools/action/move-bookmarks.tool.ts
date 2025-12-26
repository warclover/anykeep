/**
 * move_bookmarks Tool
 *
 * 批量移动书签到指定文件夹
 * 这是一个需要用户确认的危险操作
 *
 * @version 1.1.0
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
  getBookmarkTitles,
  getFolderName,
  validateBookmarkOwnership,
  getConfirmationExpiryTime,
  determineRiskLevel,
  BATCH_LIMITS,
} from "../utils";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { ACTION_TOOL_DESCRIPTIONS } from "../tool-description-templates";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  bookmark_ids: z
    .array(z.number().int().positive())
    .min(1, "至少选择一个书签")
    .max(
      BATCH_LIMITS.MAX_BOOKMARKS_FOR_MOVE,
      `单次最多移动${BATCH_LIMITS.MAX_BOOKMARKS_FOR_MOVE}个书签`,
    )
    .describe("要移动的书签 ID 列表"),
  target_folder_id: z
    .number()
    .int()
    .positive()
    .nullable()
    .describe("目标文件夹 ID，null 表示移动到根目录（无文件夹）"),
});

type MoveBookmarksParams = z.infer<typeof paramsSchema>;

interface MoveBookmarksResult {
  movedCount: number;
  movedIds: number[];
  targetFolderId: number | null;
  targetFolderName: string | null;
  message: string;
  /** 待确认操作（仅在需要确认时存在） */
  __pendingConfirmation?: PendingConfirmation;
}

// ============================================
// Tool 实现
// ============================================

export const moveBookmarksTool: Tool<MoveBookmarksParams, MoveBookmarksResult> =
  {
    definition: {
      name: "move_bookmarks",
      description: ACTION_TOOL_DESCRIPTIONS.move_bookmarks,
      parameters: paramsSchema,
      category: "action",
      requiresConfirmation: true,
      estimatedDurationMs: 500,
    },

    async execute(
      params: MoveBookmarksParams,
      context: ToolContext,
    ): Promise<ToolResult<MoveBookmarksResult>> {
      const startTime = performance.now();

      try {
        const supabase = await createClient();

        // 1. 验证书签所有权
        const { valid, ownedCount } = await validateBookmarkOwnership(
          context.userId,
          params.bookmark_ids,
        );

        if (!valid) {
          return {
            success: false,
            error: `部分书签不存在或无权操作（请求 ${params.bookmark_ids.length} 个，有效 ${ownedCount} 个）`,
            errorCode: "UNAUTHORIZED",
          };
        }

        // 2. 验证目标文件夹（如果指定了文件夹）
        let targetFolderName: string | null = null;

        if (params.target_folder_id !== null) {
          const { data: folder, error: folderError } = await supabase
            .from("folders")
            .select("id, name")
            .eq("id", params.target_folder_id)
            .eq("user_id", context.userId)
            .single();

          if (folderError || !folder) {
            return {
              success: false,
              error: `目标文件夹不存在或无权访问`,
              errorCode: "FOLDER_NOT_FOUND",
            };
          }

          targetFolderName = folder.name;
        }

        // 3. 如果需要确认且未确认，返回确认请求
        if (!context.confirmed) {
          const affectedItems = await getBookmarkTitles(
            context.userId,
            params.bookmark_ids,
          );

          const targetDesc =
            params.target_folder_id === null
              ? "根目录（无文件夹）"
              : `「${targetFolderName}」`;

          const confirmation: PendingConfirmation = {
            confirmationId: generateConfirmationId(),
            toolName: "move_bookmarks",
            description: `移动到${targetDesc}`,
            impactSummary: `将 ${params.bookmark_ids.length} 个书签移动到${targetDesc}`,
            affectedItems,
            params,
            expiresAt: getConfirmationExpiryTime(),
            riskLevel: determineRiskLevel(params.bookmark_ids.length),
          };

          logger.info(
            {
              toolName: "move_bookmarks",
              userId: context.userId,
              bookmarkCount: params.bookmark_ids.length,
              targetFolderId: params.target_folder_id,
              confirmationId: confirmation.confirmationId,
            },
            "move_bookmarks: Confirmation required",
          );

          // 返回带确认信息的结果
          return {
            success: true,
            data: {
              movedCount: 0,
              movedIds: [],
              targetFolderId: params.target_folder_id,
              targetFolderName,
              message: `待用户确认：${confirmation.impactSummary}。界面上已显示确认对话框，用户点击"确认执行"按钮后将自动执行操作，你无需再次询问。`,
              __pendingConfirmation: confirmation,
            },
            metadata: {
              executionTimeMs: Math.round(performance.now() - startTime),
            },
          };
        }

        // 4. 已确认，执行移动操作
        const { data: updatedBookmarks, error: updateError } = await supabase
          .from("bookmarks")
          .update({
            folder_id: params.target_folder_id,
            updated_at: new Date().toISOString(),
          })
          .in("id", params.bookmark_ids)
          .eq("user_id", context.userId)
          .is("deleted_at", null)
          .select("id");

        if (updateError) {
          throw updateError;
        }

        const movedIds = updatedBookmarks?.map((b) => b.id) || [];
        const movedCount = movedIds.length;

        // 获取文件夹名称（如果之前没有获取）
        if (!targetFolderName && params.target_folder_id !== null) {
          targetFolderName = await getFolderName(
            context.userId,
            params.target_folder_id,
          );
        }

        const targetDesc =
          params.target_folder_id === null
            ? "根目录"
            : `「${targetFolderName}」`;
        const message = `已将 ${movedCount} 个书签移动到${targetDesc}`;

        logger.info(
          {
            toolName: "move_bookmarks",
            userId: context.userId,
            bookmarkCount: params.bookmark_ids.length,
            movedCount,
            targetFolderId: params.target_folder_id,
            executionTimeMs: Math.round(performance.now() - startTime),
          },
          "move_bookmarks: Success",
        );

        return {
          success: true,
          data: {
            movedCount,
            movedIds,
            targetFolderId: params.target_folder_id,
            targetFolderName,
            message,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
            affectedCount: movedCount,
          },
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        logger.error(
          {
            toolName: "move_bookmarks",
            userId: context.userId,
            error: errorMessage,
          },
          "move_bookmarks: Failed",
        );

        return {
          success: false,
          error: `移动书签失败: ${errorMessage}`,
          errorCode: "EXECUTION_ERROR",
        };
      }
    },
  };
