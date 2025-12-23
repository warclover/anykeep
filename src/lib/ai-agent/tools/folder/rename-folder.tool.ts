/**
 * 重命名文件夹 Tool
 *
 * 重命名指定文件夹
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
  folderId: z.number().int().positive().describe("要重命名的文件夹 ID"),
  newName: z
    .string()
    .min(1, "新名称不能为空")
    .max(50, "文件夹名称最长 50 个字符")
    .describe("新的文件夹名称"),
});

type RenameFolderParams = z.infer<typeof paramsSchema>;

interface RenameFolderResult {
  folderId: number;
  oldName: string;
  newName: string;
  message: string;
  /** 待确认操作（仅在需要确认时存在） */
  __pendingConfirmation?: PendingConfirmation;
}

// ============================================
// Tool 实现
// ============================================

export const renameFolderTool: Tool<RenameFolderParams, RenameFolderResult> = {
  definition: {
    name: "rename_folder",
    description: `重命名指定文件夹。

使用场景：
- 用户要求 "把'技术'文件夹改名为'技术分享'"
- 用户要求 "重命名学习资料文件夹"

注意事项：
- 系统文件夹（如 INBOX）不能重命名
- 新名称不能与现有文件夹重复
- 文件夹名称不能超过 50 个字符`,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: true,
    estimatedDurationMs: 200,
  },

  async execute(
    params: RenameFolderParams,
    context: ToolContext,
  ): Promise<ToolResult<RenameFolderResult>> {
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

      // 2. 检查是否为系统文件夹
      if (folder.is_system) {
        return {
          success: false,
          error: "系统文件夹不能重命名",
          errorCode: "SYSTEM_FOLDER",
        };
      }

      // 3. 检查新名称是否与旧名称相同
      if (folder.name === params.newName) {
        return {
          success: false,
          error: "新名称与原名称相同",
          errorCode: "SAME_NAME",
        };
      }

      // 4. 检查是否有同名文件夹
      const { data: existing } = await supabase
        .from("folders")
        .select("id")
        .eq("user_id", context.userId)
        .eq("name", params.newName)
        .is("deleted_at", null)
        .neq("id", params.folderId)
        .single();

      if (existing) {
        return {
          success: false,
          error: `已存在同名文件夹「${params.newName}」`,
          errorCode: "DUPLICATE_NAME",
        };
      }

      // 5. 如果需要确认且未确认，返回确认请求
      if (!context.confirmed) {
        const description = `将文件夹「${folder.name}」重命名为「${params.newName}」`;

        const confirmation: PendingConfirmation = {
          confirmationId: generateConfirmationId(),
          toolName: "rename_folder",
          description,
          impactSummary: description,
          affectedItems: [{ id: folder.id, title: folder.name }],
          params,
          expiresAt: getConfirmationExpiryTime(),
          riskLevel: "low",
        };

        logger.info(
          {
            toolName: "rename_folder",
            userId: context.userId,
            folderId: folder.id,
            oldName: folder.name,
            newName: params.newName,
            confirmationId: confirmation.confirmationId,
          },
          "rename_folder: Confirmation required",
        );

        return {
          success: true,
          data: {
            folderId: folder.id,
            oldName: folder.name,
            newName: params.newName,
            message: `待用户确认：${description}。界面上已显示确认对话框，用户点击"确认执行"按钮后将自动执行操作，你无需再次询问。`,
            __pendingConfirmation: confirmation,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 6. 已确认，执行重命名操作
      const { error: updateError } = await supabase
        .from("folders")
        .update({
          name: params.newName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.folderId)
        .eq("user_id", context.userId);

      if (updateError) {
        throw updateError;
      }

      const message = `已将文件夹「${folder.name}」重命名为「${params.newName}」`;

      logger.info(
        {
          toolName: "rename_folder",
          userId: context.userId,
          folderId: folder.id,
          oldName: folder.name,
          newName: params.newName,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "rename_folder: Success",
      );

      return {
        success: true,
        data: {
          folderId: folder.id,
          oldName: folder.name,
          newName: params.newName,
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
          toolName: "rename_folder",
          userId: context.userId,
          error: errorMessage,
        },
        "rename_folder: Failed",
      );

      return {
        success: false,
        error: `重命名文件夹失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
