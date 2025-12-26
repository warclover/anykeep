/**
 * 合并文件夹 Tool
 *
 * 将一个文件夹合并到另一个文件夹
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
  sourceFolderId: z
    .number()
    .int()
    .positive()
    .describe("源文件夹 ID（将被合并的文件夹）"),
  targetFolderId: z
    .number()
    .int()
    .positive()
    .describe("目标文件夹 ID（合并到的文件夹）"),
  deleteSourceFolder: z
    .boolean()
    .optional()
    .default(true)
    .describe("合并后是否删除源文件夹，默认 true"),
});

type MergeFoldersParams = z.infer<typeof paramsSchema>;

interface MergeFoldersResult {
  sourceFolderId: number;
  sourceFolderName: string;
  targetFolderId: number;
  targetFolderName: string;
  movedBookmarkCount: number;
  sourceDeleted: boolean;
  message: string;
  /** 待确认操作（仅在需要确认时存在） */
  __pendingConfirmation?: PendingConfirmation;
}

// ============================================
// Tool 实现
// ============================================

export const mergeFoldersTool: Tool<MergeFoldersParams, MergeFoldersResult> = {
  definition: {
    name: "merge_folders",
    description: FOLDER_TOOL_DESCRIPTIONS.merge_folders,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: true,
    estimatedDurationMs: 1000,
  },

  async execute(
    params: MergeFoldersParams,
    context: ToolContext,
  ): Promise<ToolResult<MergeFoldersResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 验证源文件夹
      const { data: sourceFolder, error: sourceError } = await supabase
        .from("folders")
        .select("id, name, is_system")
        .eq("id", params.sourceFolderId)
        .eq("user_id", context.userId)
        .is("deleted_at", null)
        .single();

      if (sourceError || !sourceFolder) {
        return {
          success: false,
          error: "源文件夹不存在或无权操作",
          errorCode: "SOURCE_NOT_FOUND",
        };
      }

      if (sourceFolder.is_system) {
        return {
          success: false,
          error: "系统文件夹不能被合并",
          errorCode: "SYSTEM_FOLDER",
        };
      }

      // 2. 验证目标文件夹
      const { data: targetFolder, error: targetError } = await supabase
        .from("folders")
        .select("id, name, is_system")
        .eq("id", params.targetFolderId)
        .eq("user_id", context.userId)
        .is("deleted_at", null)
        .single();

      if (targetError || !targetFolder) {
        return {
          success: false,
          error: "目标文件夹不存在或无权操作",
          errorCode: "TARGET_NOT_FOUND",
        };
      }

      // 3. 检查是否为同一文件夹
      if (params.sourceFolderId === params.targetFolderId) {
        return {
          success: false,
          error: "源文件夹和目标文件夹不能相同",
          errorCode: "SAME_FOLDER",
        };
      }

      // 4. 获取源文件夹书签数量
      const { count: bookmarkCount } = await supabase
        .from("bookmarks")
        .select("*", { count: "exact", head: true })
        .eq("folder_id", params.sourceFolderId)
        .is("deleted_at", null);

      const sourceBookmarkCount = bookmarkCount || 0;

      // 5. 如果需要确认且未确认，返回确认请求
      if (!context.confirmed) {
        const description = `将「${sourceFolder.name}」合并到「${targetFolder.name}」`;
        let impactSummary = `将「${sourceFolder.name}」（${sourceBookmarkCount} 个书签）合并到「${targetFolder.name}」`;
        if (params.deleteSourceFolder) {
          impactSummary += `，合并后删除「${sourceFolder.name}」`;
        }

        const confirmation: PendingConfirmation = {
          confirmationId: generateConfirmationId(),
          toolName: "merge_folders",
          description,
          impactSummary,
          affectedItems: [
            { id: sourceFolder.id, title: `${sourceFolder.name}（源）` },
            { id: targetFolder.id, title: `${targetFolder.name}（目标）` },
          ],
          params,
          expiresAt: getConfirmationExpiryTime(),
          riskLevel: "high",
        };

        logger.info(
          {
            toolName: "merge_folders",
            userId: context.userId,
            sourceFolderId: sourceFolder.id,
            targetFolderId: targetFolder.id,
            bookmarkCount: sourceBookmarkCount,
            confirmationId: confirmation.confirmationId,
          },
          "merge_folders: Confirmation required",
        );

        return {
          success: true,
          data: {
            sourceFolderId: sourceFolder.id,
            sourceFolderName: sourceFolder.name,
            targetFolderId: targetFolder.id,
            targetFolderName: targetFolder.name,
            movedBookmarkCount: 0,
            sourceDeleted: false,
            message: `待用户确认：${impactSummary}。界面上已显示确认对话框，用户点击"确认执行"按钮后将自动执行操作，你无需再次询问。`,
            __pendingConfirmation: confirmation,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 6. 已确认，执行合并操作
      // 6.1 移动所有书签到目标文件夹
      const { error: moveError } = await supabase
        .from("bookmarks")
        .update({
          folder_id: params.targetFolderId,
          updated_at: new Date().toISOString(),
        })
        .eq("folder_id", params.sourceFolderId)
        .eq("user_id", context.userId)
        .is("deleted_at", null);

      if (moveError) {
        throw moveError;
      }

      // 6.2 删除源文件夹（如果需要）
      let sourceDeleted = false;
      if (params.deleteSourceFolder) {
        const { error: deleteError } = await supabase
          .from("folders")
          .update({
            deleted_at: new Date().toISOString(),
          })
          .eq("id", params.sourceFolderId)
          .eq("user_id", context.userId);

        if (deleteError) {
          logger.warn(
            {
              toolName: "merge_folders",
              userId: context.userId,
              sourceFolderId: params.sourceFolderId,
              error: deleteError.message,
            },
            "merge_folders: Failed to delete source folder",
          );
        } else {
          sourceDeleted = true;
        }
      }

      let message = `已将「${sourceFolder.name}」的 ${sourceBookmarkCount} 个书签合并到「${targetFolder.name}」`;
      if (sourceDeleted) {
        message += `，源文件夹已删除`;
      }

      logger.info(
        {
          toolName: "merge_folders",
          userId: context.userId,
          sourceFolderId: sourceFolder.id,
          targetFolderId: targetFolder.id,
          movedBookmarkCount: sourceBookmarkCount,
          sourceDeleted,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "merge_folders: Success",
      );

      return {
        success: true,
        data: {
          sourceFolderId: sourceFolder.id,
          sourceFolderName: sourceFolder.name,
          targetFolderId: targetFolder.id,
          targetFolderName: targetFolder.name,
          movedBookmarkCount: sourceBookmarkCount,
          sourceDeleted,
          message,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: sourceBookmarkCount + (sourceDeleted ? 1 : 0),
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "merge_folders",
          userId: context.userId,
          error: errorMessage,
        },
        "merge_folders: Failed",
      );

      return {
        success: false,
        error: `合并文件夹失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
