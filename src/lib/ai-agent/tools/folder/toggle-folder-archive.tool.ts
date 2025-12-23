/**
 * 归档/取消归档文件夹 Tool
 *
 * 切换文件夹的归档状态
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

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  folderId: z.number().int().positive().describe("要操作的文件夹 ID"),
  archived: z.boolean().describe("true-归档、false-取消归档"),
});

type ToggleFolderArchiveParams = z.infer<typeof paramsSchema>;

interface ToggleFolderArchiveResult {
  folderId: number;
  folderName: string;
  isArchived: boolean;
  bookmarkCount: number;
  message: string;
  /** 待确认操作（仅在需要确认时存在） */
  __pendingConfirmation?: PendingConfirmation;
}

// ============================================
// Tool 实现
// ============================================

export const toggleFolderArchiveTool: Tool<
  ToggleFolderArchiveParams,
  ToggleFolderArchiveResult
> = {
  definition: {
    name: "toggle_folder_archive",
    description: `归档或取消归档文件夹。

使用场景：
- 用户要求 "归档'旧项目'文件夹"
- 用户要求 "把'历史资料'文件夹停用"
- 用户要求 "恢复被归档的文件夹"
- 用户要求 "把这个文件夹取消归档"

注意事项：
- 归档后文件夹仍存在，只是默认不显示
- 文件夹内的书签不受影响
- 系统文件夹不能归档`,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: true,
    estimatedDurationMs: 200,
  },

  async execute(
    params: ToggleFolderArchiveParams,
    context: ToolContext,
  ): Promise<ToolResult<ToggleFolderArchiveResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 获取文件夹信息并验证所有权
      const { data: folder, error: folderError } = await supabase
        .from("folders")
        .select("id, name, is_archived, is_system")
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
          error: "系统文件夹不能归档",
          errorCode: "SYSTEM_FOLDER",
        };
      }

      // 3. 检查当前状态是否与目标状态相同
      if (folder.is_archived === params.archived) {
        const statusText = params.archived ? "已归档" : "未归档";
        return {
          success: false,
          error: `文件夹已是${statusText}状态`,
          errorCode: "SAME_STATUS",
        };
      }

      // 4. 获取文件夹内书签数量
      const { count: bookmarkCount } = await supabase
        .from("bookmarks")
        .select("*", { count: "exact", head: true })
        .eq("folder_id", params.folderId)
        .is("deleted_at", null);

      const actionText = params.archived ? "归档" : "取消归档";

      // 5. 如果需要确认且未确认，返回确认请求
      if (!context.confirmed) {
        const description = `${actionText}文件夹「${folder.name}」`;
        let impactSummary = description;
        if (bookmarkCount && bookmarkCount > 0) {
          impactSummary += `（包含 ${bookmarkCount} 个书签）`;
        }

        const confirmation: PendingConfirmation = {
          confirmationId: generateConfirmationId(),
          toolName: "toggle_folder_archive",
          description,
          impactSummary,
          affectedItems: [{ id: folder.id, title: folder.name }],
          params,
          expiresAt: getConfirmationExpiryTime(),
          riskLevel: "low",
        };

        logger.info(
          {
            toolName: "toggle_folder_archive",
            userId: context.userId,
            folderId: folder.id,
            archived: params.archived,
            bookmarkCount,
            confirmationId: confirmation.confirmationId,
          },
          "toggle_folder_archive: Confirmation required",
        );

        return {
          success: true,
          data: {
            folderId: folder.id,
            folderName: folder.name,
            isArchived: params.archived,
            bookmarkCount: bookmarkCount || 0,
            message: `待用户确认：${impactSummary}。界面上已显示确认对话框，用户点击"确认执行"按钮后将自动执行操作，你无需再次询问。`,
            __pendingConfirmation: confirmation,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 6. 已确认，执行归档/取消归档操作
      const { error: updateError } = await supabase
        .from("folders")
        .update({
          is_archived: params.archived,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.folderId)
        .eq("user_id", context.userId);

      if (updateError) {
        throw updateError;
      }

      const message = `已${actionText}文件夹「${folder.name}」`;

      logger.info(
        {
          toolName: "toggle_folder_archive",
          userId: context.userId,
          folderId: folder.id,
          archived: params.archived,
          bookmarkCount,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "toggle_folder_archive: Success",
      );

      return {
        success: true,
        data: {
          folderId: folder.id,
          folderName: folder.name,
          isArchived: params.archived,
          bookmarkCount: bookmarkCount || 0,
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
          toolName: "toggle_folder_archive",
          userId: context.userId,
          error: errorMessage,
        },
        "toggle_folder_archive: Failed",
      );

      return {
        success: false,
        error: `${params.archived ? "归档" : "取消归档"}文件夹失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
