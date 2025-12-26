/**
 * 移动文件夹到分组 Tool
 *
 * 将文件夹移动到指定分组
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
// 常量定义
// ============================================

const GROUP_NAMES: Record<string, string> = {
  work: "工作",
  study: "学习",
  life: "生活",
  entertainment: "娱乐",
  other: "其他",
};

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  folderId: z.number().int().positive().describe("要移动的文件夹 ID"),
  group: z
    .enum(["work", "study", "life", "entertainment", "other"])
    .describe(
      "目标分组：work-工作、study-学习、life-生活、entertainment-娱乐、other-其他",
    ),
});

type MoveFolderToGroupParams = z.infer<typeof paramsSchema>;

interface MoveFolderToGroupResult {
  folderId: number;
  folderName: string;
  oldGroup: string | null;
  newGroup: string;
  message: string;
  /** 待确认操作（仅在需要确认时存在） */
  __pendingConfirmation?: PendingConfirmation;
}

// ============================================
// Tool 实现
// ============================================

export const moveFolderToGroupTool: Tool<
  MoveFolderToGroupParams,
  MoveFolderToGroupResult
> = {
  definition: {
    name: "move_folder_to_group",
    description: FOLDER_TOOL_DESCRIPTIONS.move_folder_to_group,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: true,
    estimatedDurationMs: 200,
  },

  async execute(
    params: MoveFolderToGroupParams,
    context: ToolContext,
  ): Promise<ToolResult<MoveFolderToGroupResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 获取文件夹信息并验证所有权
      const { data: folder, error: folderError } = await supabase
        .from("folders")
        .select("id, name, folder_group, is_system")
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
          error: "系统文件夹不能移动分组",
          errorCode: "SYSTEM_FOLDER",
        };
      }

      // 3. 检查是否已在目标分组
      if (folder.folder_group === params.group) {
        return {
          success: false,
          error: `文件夹已在「${GROUP_NAMES[params.group]}」分组中`,
          errorCode: "SAME_GROUP",
        };
      }

      const oldGroupName = folder.folder_group
        ? GROUP_NAMES[folder.folder_group]
        : "未分组";
      const newGroupName = GROUP_NAMES[params.group];

      // 4. 如果需要确认且未确认，返回确认请求
      if (!context.confirmed) {
        const description = `将文件夹「${folder.name}」从「${oldGroupName}」移动到「${newGroupName}」分组`;

        const confirmation: PendingConfirmation = {
          confirmationId: generateConfirmationId(),
          toolName: "move_folder_to_group",
          description,
          impactSummary: description,
          affectedItems: [{ id: folder.id, title: folder.name }],
          params,
          expiresAt: getConfirmationExpiryTime(),
          riskLevel: "low",
        };

        logger.info(
          {
            toolName: "move_folder_to_group",
            userId: context.userId,
            folderId: folder.id,
            oldGroup: folder.folder_group,
            newGroup: params.group,
            confirmationId: confirmation.confirmationId,
          },
          "move_folder_to_group: Confirmation required",
        );

        return {
          success: true,
          data: {
            folderId: folder.id,
            folderName: folder.name,
            oldGroup: folder.folder_group,
            newGroup: params.group,
            message: `待用户确认：${description}。界面上已显示确认对话框，用户点击"确认执行"按钮后将自动执行操作，你无需再次询问。`,
            __pendingConfirmation: confirmation,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 5. 已确认，执行移动分组操作
      const { error: updateError } = await supabase
        .from("folders")
        .update({
          folder_group: params.group,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.folderId)
        .eq("user_id", context.userId);

      if (updateError) {
        throw updateError;
      }

      const message = `已将文件夹「${folder.name}」移动到「${newGroupName}」分组`;

      logger.info(
        {
          toolName: "move_folder_to_group",
          userId: context.userId,
          folderId: folder.id,
          oldGroup: folder.folder_group,
          newGroup: params.group,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "move_folder_to_group: Success",
      );

      return {
        success: true,
        data: {
          folderId: folder.id,
          folderName: folder.name,
          oldGroup: folder.folder_group,
          newGroup: params.group,
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
          toolName: "move_folder_to_group",
          userId: context.userId,
          error: errorMessage,
        },
        "move_folder_to_group: Failed",
      );

      return {
        success: false,
        error: `移动文件夹分组失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
