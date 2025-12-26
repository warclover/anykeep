/**
 * 创建文件夹 Tool
 *
 * 创建新的文件夹
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
  name: z
    .string()
    .min(1, "文件夹名称不能为空")
    .max(50, "文件夹名称最长 50 个字符")
    .describe("文件夹名称"),
  parentId: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .describe("父文件夹 ID，不指定则创建在根目录"),
  group: z
    .enum(["work", "study", "life", "entertainment", "other"])
    .optional()
    .describe(
      "文件夹分组：work-工作、study-学习、life-生活、entertainment-娱乐、other-其他",
    ),
});

type CreateFolderParams = z.infer<typeof paramsSchema>;

interface CreateFolderResult {
  folderId: number | null;
  folderName: string;
  message: string;
  /** 待确认操作（仅在需要确认时存在） */
  __pendingConfirmation?: PendingConfirmation;
}

// ============================================
// Tool 实现
// ============================================

export const createFolderTool: Tool<CreateFolderParams, CreateFolderResult> = {
  definition: {
    name: "create_folder",
    description: FOLDER_TOOL_DESCRIPTIONS.create_folder,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: true,
    estimatedDurationMs: 200,
  },

  async execute(
    params: CreateFolderParams,
    context: ToolContext,
  ): Promise<ToolResult<CreateFolderResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 检查是否有同名文件夹
      const { data: existing } = await supabase
        .from("folders")
        .select("id")
        .eq("user_id", context.userId)
        .eq("name", params.name)
        .is("deleted_at", null)
        .single();

      if (existing) {
        return {
          success: false,
          error: `已存在同名文件夹「${params.name}」`,
          errorCode: "DUPLICATE_NAME",
        };
      }

      // 2. 如果指定了父文件夹，验证其存在
      if (params.parentId) {
        const { data: parentFolder } = await supabase
          .from("folders")
          .select("id, name")
          .eq("id", params.parentId)
          .eq("user_id", context.userId)
          .is("deleted_at", null)
          .single();

        if (!parentFolder) {
          return {
            success: false,
            error: "指定的父文件夹不存在",
            errorCode: "PARENT_NOT_FOUND",
          };
        }
      }

      // 3. 如果需要确认且未确认，返回确认请求
      if (!context.confirmed) {
        let description = `创建文件夹「${params.name}」`;
        if (params.group) {
          const groupNames: Record<string, string> = {
            work: "工作",
            study: "学习",
            life: "生活",
            entertainment: "娱乐",
            other: "其他",
          };
          description += `（${groupNames[params.group]}分组）`;
        }

        const confirmation: PendingConfirmation = {
          confirmationId: generateConfirmationId(),
          toolName: "create_folder",
          description,
          impactSummary: description,
          params,
          expiresAt: getConfirmationExpiryTime(),
          riskLevel: "low",
        };

        logger.info(
          {
            toolName: "create_folder",
            userId: context.userId,
            folderName: params.name,
            confirmationId: confirmation.confirmationId,
          },
          "create_folder: Confirmation required",
        );

        return {
          success: true,
          data: {
            folderId: null,
            folderName: params.name,
            message: `待用户确认：${description}。界面上已显示确认对话框，用户点击"确认执行"按钮后将自动执行操作，你无需再次询问。`,
            __pendingConfirmation: confirmation,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 4. 已确认，执行创建操作
      // 获取最大排序值
      const { data: maxSort } = await supabase
        .from("folders")
        .select("sort_order")
        .eq("user_id", context.userId)
        .is("deleted_at", null)
        .order("sort_order", { ascending: false })
        .limit(1)
        .single();

      const newSortOrder = (maxSort?.sort_order ?? 0) + 1;

      const { data: newFolder, error: insertError } = await supabase
        .from("folders")
        .insert({
          user_id: context.userId,
          name: params.name,
          parent_id: params.parentId ?? null,
          folder_group: params.group ?? null,
          sort_order: newSortOrder,
          is_archived: false,
        })
        .select("id, name")
        .single();

      if (insertError || !newFolder) {
        throw insertError || new Error("创建文件夹失败");
      }

      const message = `已创建文件夹「${newFolder.name}」`;

      logger.info(
        {
          toolName: "create_folder",
          userId: context.userId,
          folderId: newFolder.id,
          folderName: newFolder.name,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "create_folder: Success",
      );

      return {
        success: true,
        data: {
          folderId: newFolder.id,
          folderName: newFolder.name,
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
          toolName: "create_folder",
          userId: context.userId,
          error: errorMessage,
        },
        "create_folder: Failed",
      );

      return {
        success: false,
        error: `创建文件夹失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
