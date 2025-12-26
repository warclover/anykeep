/**
 * 调整文件夹位置 Tool
 *
 * 调整文件夹在列表中的位置
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
  folderId: z.number().int().positive().describe("要移动的文件夹 ID"),
  direction: z
    .enum(["up", "down", "top", "bottom"])
    .describe(
      "移动方向：up-上移一位、down-下移一位、top-移到最前、bottom-移到最后",
    ),
});

type ReorderFolderParams = z.infer<typeof paramsSchema>;

interface ReorderFolderResult {
  folderId: number;
  folderName: string;
  direction: string;
  newSortOrder: number;
  message: string;
  /** 待确认操作（仅在需要确认时存在） */
  __pendingConfirmation?: PendingConfirmation;
}

// ============================================
// Tool 实现
// ============================================

export const reorderFolderTool: Tool<ReorderFolderParams, ReorderFolderResult> =
  {
    definition: {
      name: "reorder_folder",
      description: FOLDER_TOOL_DESCRIPTIONS.reorder_folder,
      parameters: paramsSchema,
      category: "action",
      requiresConfirmation: true,
      estimatedDurationMs: 300,
    },

    async execute(
      params: ReorderFolderParams,
      context: ToolContext,
    ): Promise<ToolResult<ReorderFolderResult>> {
      const startTime = performance.now();

      try {
        const supabase = await createClient();

        // 1. 获取文件夹信息并验证所有权
        const { data: folder, error: folderError } = await supabase
          .from("folders")
          .select("id, name, sort_order, is_system")
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
            error: "系统文件夹不能移动位置",
            errorCode: "SYSTEM_FOLDER",
          };
        }

        // 3. 获取所有文件夹用于计算新位置
        const { data: allFolders, error: listError } = await supabase
          .from("folders")
          .select("id, sort_order")
          .eq("user_id", context.userId)
          .is("deleted_at", null)
          .or("is_system.is.null,is_system.eq.false")
          .order("sort_order", { ascending: true });

        if (listError || !allFolders || allFolders.length === 0) {
          return {
            success: false,
            error: "获取文件夹列表失败",
            errorCode: "QUERY_ERROR",
          };
        }

        // 4. 计算新的排序位置
        const currentIndex = allFolders.findIndex((f) => f.id === folder.id);
        if (currentIndex === -1) {
          return {
            success: false,
            error: "文件夹位置计算失败",
            errorCode: "CALCULATION_ERROR",
          };
        }

        let newIndex: number;
        const directionMap: Record<string, string> = {
          up: "上移",
          down: "下移",
          top: "移到最前",
          bottom: "移到最后",
        };

        switch (params.direction) {
          case "up":
            if (currentIndex === 0) {
              return {
                success: false,
                error: "已在最前面，无法上移",
                errorCode: "ALREADY_TOP",
              };
            }
            newIndex = currentIndex - 1;
            break;
          case "down":
            if (currentIndex === allFolders.length - 1) {
              return {
                success: false,
                error: "已在最后面，无法下移",
                errorCode: "ALREADY_BOTTOM",
              };
            }
            newIndex = currentIndex + 1;
            break;
          case "top":
            if (currentIndex === 0) {
              return {
                success: false,
                error: "已在最前面",
                errorCode: "ALREADY_TOP",
              };
            }
            newIndex = 0;
            break;
          case "bottom":
            if (currentIndex === allFolders.length - 1) {
              return {
                success: false,
                error: "已在最后面",
                errorCode: "ALREADY_BOTTOM",
              };
            }
            newIndex = allFolders.length - 1;
            break;
          default:
            newIndex = currentIndex;
        }

        // 5. 如果需要确认且未确认，返回确认请求
        if (!context.confirmed) {
          const description = `将文件夹「${folder.name}」${directionMap[params.direction]}`;

          const confirmation: PendingConfirmation = {
            confirmationId: generateConfirmationId(),
            toolName: "reorder_folder",
            description,
            impactSummary: description,
            affectedItems: [{ id: folder.id, title: folder.name }],
            params,
            expiresAt: getConfirmationExpiryTime(),
            riskLevel: "low",
          };

          logger.info(
            {
              toolName: "reorder_folder",
              userId: context.userId,
              folderId: folder.id,
              direction: params.direction,
              confirmationId: confirmation.confirmationId,
            },
            "reorder_folder: Confirmation required",
          );

          return {
            success: true,
            data: {
              folderId: folder.id,
              folderName: folder.name,
              direction: params.direction,
              newSortOrder: newIndex,
              message: `待用户确认：${description}。界面上已显示确认对话框，用户点击"确认执行"按钮后将自动执行操作，你无需再次询问。`,
              __pendingConfirmation: confirmation,
            },
            metadata: {
              executionTimeMs: Math.round(performance.now() - startTime),
            },
          };
        }

        // 6. 已确认，执行重排序操作
        // 重新计算所有受影响文件夹的排序值
        const reorderedFolders = [...allFolders];
        const [movedFolder] = reorderedFolders.splice(currentIndex, 1);
        reorderedFolders.splice(newIndex, 0, movedFolder);

        // 批量更新排序值
        const updates = reorderedFolders.map((f, index) => ({
          id: f.id,
          sort_order: index + 1,
        }));

        // 使用 RPC 函数批量更新（如果存在），否则逐个更新
        for (const update of updates) {
          await supabase
            .from("folders")
            .update({ sort_order: update.sort_order })
            .eq("id", update.id)
            .eq("user_id", context.userId);
        }

        const message = `已将文件夹「${folder.name}」${directionMap[params.direction]}`;

        logger.info(
          {
            toolName: "reorder_folder",
            userId: context.userId,
            folderId: folder.id,
            direction: params.direction,
            newSortOrder: newIndex + 1,
            executionTimeMs: Math.round(performance.now() - startTime),
          },
          "reorder_folder: Success",
        );

        return {
          success: true,
          data: {
            folderId: folder.id,
            folderName: folder.name,
            direction: params.direction,
            newSortOrder: newIndex + 1,
            message,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
            affectedCount: updates.length,
          },
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        logger.error(
          {
            toolName: "reorder_folder",
            userId: context.userId,
            error: errorMessage,
          },
          "reorder_folder: Failed",
        );

        return {
          success: false,
          error: `调整文件夹位置失败: ${errorMessage}`,
          errorCode: "EXECUTION_ERROR",
        };
      }
    },
  };
