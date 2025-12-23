/**
 * DeleteSmartList Tool - 删除智能列表
 *
 * 删除用户自定义的智能列表（需要确认）
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolResult, PendingConfirmation } from "../types";
import { generateConfirmationId, getConfirmationExpiryTime } from "../utils";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  smartListId: z.number().int().positive().describe("智能列表 ID"),
});

type DeleteSmartListParams = z.infer<typeof paramsSchema>;

interface DeleteSmartListResult {
  smartListId: number;
  name: string;
  deleted: boolean;
  message: string;
  /** 待确认操作（仅在需要确认时存在） */
  __pendingConfirmation?: PendingConfirmation;
}

// ============================================
// Tool 实现
// ============================================

export const deleteSmartListTool: Tool<
  DeleteSmartListParams,
  DeleteSmartListResult
> = {
  definition: {
    name: "delete_smart_list",
    description: `删除用户自定义的智能列表。

使用场景：
- 用户要求 "删除这个智能列表"
- 用户要求 "移除这个筛选条件"

注意事项：
- 预设智能列表不能删除
- 删除为软删除，数据可恢复
- 这是危险操作，需要用户确认`,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: true,
    estimatedDurationMs: 200,
  },

  async execute(
    params: DeleteSmartListParams,
    context,
  ): Promise<ToolResult<DeleteSmartListResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 获取智能列表信息
      const { data: smartList, error: fetchError } = await supabase
        .from("smart_lists")
        .select("id, name, is_preset")
        .eq("id", params.smartListId)
        .eq("user_id", context.userId)
        .is("deleted_at", null)
        .single();

      if (fetchError || !smartList) {
        return {
          success: false,
          error: "智能列表不存在或无权访问",
          errorCode: "NOT_FOUND",
        };
      }

      // 2. 检查是否为预设列表
      if (smartList.is_preset) {
        return {
          success: false,
          error: "预设智能列表不能删除",
          errorCode: "PRESET_READONLY",
        };
      }

      // 3. 如果需要确认且未确认，返回确认请求
      if (!context.confirmed) {
        const description = `删除智能列表「${smartList.name}」`;
        const impactSummary = "删除后可在回收站恢复";

        const confirmation: PendingConfirmation = {
          confirmationId: generateConfirmationId(),
          toolName: "delete_smart_list",
          description,
          impactSummary,
          affectedItems: [{ id: smartList.id, title: smartList.name }],
          params,
          expiresAt: getConfirmationExpiryTime(),
          riskLevel: "medium",
        };

        logger.info(
          {
            toolName: "delete_smart_list",
            userId: context.userId,
            smartListId: params.smartListId,
            name: smartList.name,
            confirmationId: confirmation.confirmationId,
          },
          "delete_smart_list: Confirmation required",
        );

        return {
          success: true,
          data: {
            smartListId: smartList.id,
            name: smartList.name,
            deleted: false,
            message: `待用户确认：${impactSummary}。界面上已显示确认对话框，用户点击"确认执行"按钮后将自动执行操作，你无需再次询问。`,
            __pendingConfirmation: confirmation,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 4. 已确认，执行软删除
      const { error: deleteError } = await supabase
        .from("smart_lists")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", params.smartListId)
        .eq("user_id", context.userId);

      if (deleteError) {
        throw deleteError;
      }

      logger.info(
        {
          toolName: "delete_smart_list",
          userId: context.userId,
          smartListId: params.smartListId,
          name: smartList.name,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "delete_smart_list: Success",
      );

      return {
        success: true,
        data: {
          smartListId: smartList.id,
          name: smartList.name,
          deleted: true,
          message: `已删除智能列表「${smartList.name}」`,
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
          toolName: "delete_smart_list",
          userId: context.userId,
          smartListId: params.smartListId,
          error: errorMessage,
        },
        "delete_smart_list: Failed",
      );

      return {
        success: false,
        error: `删除智能列表失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
