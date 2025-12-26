/**
 * AI 锁定/解锁文件夹 Tool
 *
 * 切换文件夹的 AI 锁定状态，锁定后 AI 不会自动修改该文件夹
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
  folderId: z.number().int().positive().describe("要操作的文件夹 ID"),
  locked: z
    .boolean()
    .describe("true-锁定（禁止 AI 自动管理）、false-解锁（允许 AI 管理）"),
});

type ToggleFolderLockParams = z.infer<typeof paramsSchema>;

interface ToggleFolderLockResult {
  folderId: number;
  folderName: string;
  isLocked: boolean;
  message: string;
  /** 待确认操作（仅在需要确认时存在） */
  __pendingConfirmation?: PendingConfirmation;
}

// ============================================
// Tool 实现
// ============================================

export const toggleFolderLockTool: Tool<
  ToggleFolderLockParams,
  ToggleFolderLockResult
> = {
  definition: {
    name: "toggle_folder_lock",
    description: FOLDER_TOOL_DESCRIPTIONS.toggle_folder_lock,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: true,
    estimatedDurationMs: 200,
  },

  async execute(
    params: ToggleFolderLockParams,
    context: ToolContext,
  ): Promise<ToolResult<ToggleFolderLockResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 获取文件夹信息并验证所有权
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

      // 2. 系统文件夹默认锁定，不能解锁
      if (folder.is_system && !params.locked) {
        return {
          success: false,
          error: "系统文件夹不能解锁",
          errorCode: "SYSTEM_FOLDER",
        };
      }

      // 3. 获取当前锁定状态
      const { data: profile } = await supabase
        .from("folder_profiles")
        .select("is_system_locked")
        .eq("folder_id", params.folderId)
        .single();

      const currentLocked = profile?.is_system_locked ?? false;

      // 4. 检查状态是否相同
      if (currentLocked === params.locked) {
        const statusText = params.locked ? "已锁定" : "未锁定";
        return {
          success: false,
          error: `文件夹已是${statusText}状态`,
          errorCode: "SAME_STATUS",
        };
      }

      const actionText = params.locked ? "锁定" : "解锁";

      // 5. 如果需要确认且未确认，返回确认请求
      if (!context.confirmed) {
        const description = `${actionText}文件夹「${folder.name}」的 AI 自动管理`;
        const impactSummary = params.locked
          ? `锁定后，AI 将不会自动修改「${folder.name}」文件夹`
          : `解锁后，AI 可以自动管理「${folder.name}」文件夹`;

        const confirmation: PendingConfirmation = {
          confirmationId: generateConfirmationId(),
          toolName: "toggle_folder_lock",
          description,
          impactSummary,
          affectedItems: [{ id: folder.id, title: folder.name }],
          params,
          expiresAt: getConfirmationExpiryTime(),
          riskLevel: "medium",
        };

        logger.info(
          {
            toolName: "toggle_folder_lock",
            userId: context.userId,
            folderId: folder.id,
            locked: params.locked,
            confirmationId: confirmation.confirmationId,
          },
          "toggle_folder_lock: Confirmation required",
        );

        return {
          success: true,
          data: {
            folderId: folder.id,
            folderName: folder.name,
            isLocked: params.locked,
            message: `待用户确认：${impactSummary}。界面上已显示确认对话框，用户点击"确认执行"按钮后将自动执行操作，你无需再次询问。`,
            __pendingConfirmation: confirmation,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 6. 已确认，执行锁定/解锁操作
      // 使用 upsert 更新 folder_profiles
      const { error: upsertError } = await supabase
        .from("folder_profiles")
        .upsert(
          {
            user_id: context.userId,
            folder_id: params.folderId,
            is_system_locked: params.locked,
          },
          {
            onConflict: "folder_id",
          },
        );

      if (upsertError) {
        throw upsertError;
      }

      const message = `已${actionText}文件夹「${folder.name}」的 AI 自动管理`;

      logger.info(
        {
          toolName: "toggle_folder_lock",
          userId: context.userId,
          folderId: folder.id,
          locked: params.locked,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "toggle_folder_lock: Success",
      );

      return {
        success: true,
        data: {
          folderId: folder.id,
          folderName: folder.name,
          isLocked: params.locked,
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
          toolName: "toggle_folder_lock",
          userId: context.userId,
          error: errorMessage,
        },
        "toggle_folder_lock: Failed",
      );

      return {
        success: false,
        error: `${params.locked ? "锁定" : "解锁"}文件夹失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
