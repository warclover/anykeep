/**
 * 批量移动书签到文件夹 Tool
 *
 * 将多个书签批量移动到指定文件夹
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
  validateBookmarkOwnership,
  determineRiskLevel,
  BATCH_LIMITS,
} from "../utils";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  bookmarkIds: z
    .array(z.number().int().positive())
    .min(1, "至少选择一个书签")
    .max(
      BATCH_LIMITS.MAX_BOOKMARKS_FOR_MOVE,
      `单次最多移动 ${BATCH_LIMITS.MAX_BOOKMARKS_FOR_MOVE} 个书签`,
    )
    .describe("要移动的书签 ID 列表"),
  targetFolderId: z
    .number()
    .int()
    .positive()
    .nullable()
    .describe("目标文件夹 ID，null 表示移出文件夹（根目录）"),
});

type MoveBookmarksBatchParams = z.infer<typeof paramsSchema>;

interface MoveBookmarksBatchResult {
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

export const moveBookmarksBatchTool: Tool<
  MoveBookmarksBatchParams,
  MoveBookmarksBatchResult
> = {
  definition: {
    name: "move_bookmarks_batch",
    description: `批量移动多个书签到指定文件夹。

使用场景：
- 用户要求 "把这几篇文章都移到'技术'文件夹"
- 用户要求 "把最近收藏的 5 篇都移到学习资料里"
- 用户要求 "把选中的书签移出当前文件夹"

注意事项：
- 单次最多移动 ${BATCH_LIMITS.MAX_BOOKMARKS_FOR_MOVE} 个书签
- 会覆盖书签原有的文件夹设置
- 移动数量较多时风险等级会提升`,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: true,
    estimatedDurationMs: 500,
  },

  async execute(
    params: MoveBookmarksBatchParams,
    context: ToolContext,
  ): Promise<ToolResult<MoveBookmarksBatchResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 验证书签所有权
      const { valid, ownedCount } = await validateBookmarkOwnership(
        context.userId,
        params.bookmarkIds,
      );

      if (!valid) {
        return {
          success: false,
          error: `部分书签不存在或无权操作（请求 ${params.bookmarkIds.length} 个，有效 ${ownedCount} 个）`,
          errorCode: "UNAUTHORIZED",
        };
      }

      // 2. 验证目标文件夹（如果指定了文件夹）
      let targetFolderName: string | null = null;

      if (params.targetFolderId !== null) {
        const { data: folder, error: folderError } = await supabase
          .from("folders")
          .select("id, name")
          .eq("id", params.targetFolderId)
          .eq("user_id", context.userId)
          .is("deleted_at", null)
          .single();

        if (folderError || !folder) {
          return {
            success: false,
            error: "目标文件夹不存在或无权访问",
            errorCode: "FOLDER_NOT_FOUND",
          };
        }

        targetFolderName = folder.name;
      }

      // 3. 如果需要确认且未确认，返回确认请求
      if (!context.confirmed) {
        const affectedItems = await getBookmarkTitles(
          context.userId,
          params.bookmarkIds,
        );

        const targetDesc =
          params.targetFolderId === null
            ? "根目录（无文件夹）"
            : `「${targetFolderName}」`;

        const confirmation: PendingConfirmation = {
          confirmationId: generateConfirmationId(),
          toolName: "move_bookmarks_batch",
          description: `批量移动到${targetDesc}`,
          impactSummary: `将 ${params.bookmarkIds.length} 个书签移动到${targetDesc}`,
          affectedItems,
          params,
          expiresAt: getConfirmationExpiryTime(),
          riskLevel: determineRiskLevel(params.bookmarkIds.length),
        };

        logger.info(
          {
            toolName: "move_bookmarks_batch",
            userId: context.userId,
            bookmarkCount: params.bookmarkIds.length,
            targetFolderId: params.targetFolderId,
            confirmationId: confirmation.confirmationId,
          },
          "move_bookmarks_batch: Confirmation required",
        );

        return {
          success: true,
          data: {
            movedCount: 0,
            movedIds: [],
            targetFolderId: params.targetFolderId,
            targetFolderName,
            message: `待用户确认：${confirmation.impactSummary}。界面上已显示确认对话框，用户点击"确认执行"按钮后将自动执行操作，你无需再次询问。`,
            __pendingConfirmation: confirmation,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 4. 已确认，执行批量移动操作
      const { data: updatedBookmarks, error: updateError } = await supabase
        .from("bookmarks")
        .update({
          folder_id: params.targetFolderId,
          updated_at: new Date().toISOString(),
        })
        .in("id", params.bookmarkIds)
        .eq("user_id", context.userId)
        .is("deleted_at", null)
        .select("id");

      if (updateError) {
        throw updateError;
      }

      const movedIds = updatedBookmarks?.map((b) => b.id) || [];
      const movedCount = movedIds.length;

      const targetDesc =
        params.targetFolderId === null ? "根目录" : `「${targetFolderName}」`;
      const message = `已将 ${movedCount} 个书签移动到${targetDesc}`;

      logger.info(
        {
          toolName: "move_bookmarks_batch",
          userId: context.userId,
          bookmarkCount: params.bookmarkIds.length,
          movedCount,
          targetFolderId: params.targetFolderId,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "move_bookmarks_batch: Success",
      );

      return {
        success: true,
        data: {
          movedCount,
          movedIds,
          targetFolderId: params.targetFolderId,
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
          toolName: "move_bookmarks_batch",
          userId: context.userId,
          error: errorMessage,
        },
        "move_bookmarks_batch: Failed",
      );

      return {
        success: false,
        error: `批量移动书签失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
