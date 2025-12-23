/**
 * ToggleSmartListPin Tool - 切换智能列表置顶状态
 *
 * 将智能列表置顶或取消置顶
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  smartListId: z.number().int().positive().describe("智能列表 ID"),
  isPinned: z.boolean().optional().describe("目标状态，不传则切换"),
});

type ToggleSmartListPinParams = z.infer<typeof paramsSchema>;

interface ToggleSmartListPinResult {
  smartListId: number;
  name: string;
  isPinned: boolean;
  message: string;
}

// ============================================
// Tool 实现
// ============================================

export const toggleSmartListPinTool: Tool<
  ToggleSmartListPinParams,
  ToggleSmartListPinResult
> = {
  definition: {
    name: "toggle_smart_list_pin",
    description: `切换智能列表的置顶状态。

使用场景：
- 用户要求 "把这个智能列表置顶"
- 用户要求 "取消智能列表置顶"
- 用户要求 "固定这个筛选条件"

参数说明：
- smartListId: 智能列表 ID
- isPinned: 目标状态（不传则切换当前状态）`,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: false,
    estimatedDurationMs: 150,
  },

  async execute(
    params: ToggleSmartListPinParams,
    context,
  ): Promise<ToolResult<ToggleSmartListPinResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 获取当前状态
      const { data: smartList, error: fetchError } = await supabase
        .from("smart_lists")
        .select("id, name, is_pinned")
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

      // 2. 确定新状态
      const newIsPinned = params.isPinned ?? !smartList.is_pinned;

      // 如果状态相同，直接返回
      if (newIsPinned === smartList.is_pinned) {
        return {
          success: true,
          data: {
            smartListId: smartList.id,
            name: smartList.name,
            isPinned: smartList.is_pinned,
            message: smartList.is_pinned
              ? "已经是置顶状态"
              : "已经是非置顶状态",
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 3. 更新状态
      const { error: updateError } = await supabase
        .from("smart_lists")
        .update({ is_pinned: newIsPinned })
        .eq("id", params.smartListId)
        .eq("user_id", context.userId);

      if (updateError) {
        throw updateError;
      }

      logger.info(
        {
          toolName: "toggle_smart_list_pin",
          userId: context.userId,
          smartListId: params.smartListId,
          isPinned: newIsPinned,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "toggle_smart_list_pin: Success",
      );

      return {
        success: true,
        data: {
          smartListId: smartList.id,
          name: smartList.name,
          isPinned: newIsPinned,
          message: newIsPinned ? "已置顶" : "已取消置顶",
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "toggle_smart_list_pin",
          userId: context.userId,
          smartListId: params.smartListId,
          error: errorMessage,
        },
        "toggle_smart_list_pin: Failed",
      );

      return {
        success: false,
        error: `切换置顶状态失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
