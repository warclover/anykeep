/**
 * UpdateSmartList Tool - 更新智能列表
 *
 * 更新智能列表的名称、图标、筛选条件等
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
  name: z.string().min(1).max(100).optional().describe("新名称"),
  description: z.string().max(500).optional().describe("新描述"),
  icon: z.string().max(10).optional().describe("新图标（emoji）"),
  color: z
    .enum([
      "default",
      "blue",
      "green",
      "orange",
      "purple",
      "red",
      "cyan",
      "pink",
      "amber",
      "emerald",
    ])
    .optional()
    .describe("新颜色主题"),
  sortBy: z
    .enum([
      "created_desc",
      "created_asc",
      "title_asc",
      "title_desc",
      "rating_desc",
      "publish_time_desc",
    ])
    .optional()
    .describe("排序方式"),
  viewMode: z
    .enum(["inherit", "card", "list", "compact"])
    .optional()
    .describe("视图模式"),
});

type UpdateSmartListParams = z.infer<typeof paramsSchema>;

interface UpdateSmartListResult {
  smartListId: number;
  name: string;
  updated: string[];
  message: string;
}

// ============================================
// Tool 实现
// ============================================

export const updateSmartListTool: Tool<
  UpdateSmartListParams,
  UpdateSmartListResult
> = {
  definition: {
    name: "update_smart_list",
    description: `更新智能列表的配置。

使用场景：
- 用户要求 "修改智能列表名称"
- 用户要求 "更改智能列表图标"
- 用户要求 "切换智能列表排序方式"
- 用户要求 "更改视图模式"

可更新字段：
- name: 名称
- description: 描述
- icon: 图标（emoji）
- color: 颜色主题
- sortBy: 排序方式
- viewMode: 视图模式

注意：预设智能列表只能修改置顶状态，无法修改其他配置`,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: false,
    estimatedDurationMs: 200,
  },

  async execute(
    params: UpdateSmartListParams,
    context,
  ): Promise<ToolResult<UpdateSmartListResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 验证智能列表存在
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
          error: "预设智能列表不能修改，仅支持修改置顶状态",
          errorCode: "PRESET_READONLY",
        };
      }

      // 3. 检查是否有更新内容
      const hasUpdates =
        params.name !== undefined ||
        params.description !== undefined ||
        params.icon !== undefined ||
        params.color !== undefined ||
        params.sortBy !== undefined ||
        params.viewMode !== undefined;

      if (!hasUpdates) {
        return {
          success: false,
          error: "请至少指定一个要更新的字段",
          errorCode: "INVALID_PARAMS",
        };
      }

      // 4. 如果修改名称，检查是否重名
      if (params.name) {
        const { data: nameExists } = await supabase
          .from("smart_lists")
          .select("id")
          .eq("user_id", context.userId)
          .eq("name", params.name)
          .neq("id", params.smartListId)
          .is("deleted_at", null)
          .single();

        if (nameExists) {
          return {
            success: false,
            error: "智能列表名称已存在",
            errorCode: "NAME_EXISTS",
          };
        }
      }

      // 5. 构建更新对象
      const updateData: Record<string, unknown> = {};
      const updated: string[] = [];

      if (params.name !== undefined) {
        updateData.name = params.name;
        updated.push("name");
      }

      if (params.description !== undefined) {
        updateData.description = params.description;
        updated.push("description");
      }

      if (params.icon !== undefined) {
        updateData.icon = params.icon;
        updated.push("icon");
      }

      if (params.color !== undefined) {
        updateData.color = params.color;
        updated.push("color");
      }

      if (params.sortBy !== undefined) {
        updateData.sort_by = params.sortBy;
        updated.push("sortBy");
      }

      if (params.viewMode !== undefined) {
        updateData.view_mode = params.viewMode;
        updated.push("viewMode");
      }

      // 6. 执行更新
      const { error: updateError } = await supabase
        .from("smart_lists")
        .update(updateData)
        .eq("id", params.smartListId)
        .eq("user_id", context.userId);

      if (updateError) {
        throw updateError;
      }

      const newName = params.name || smartList.name;

      logger.info(
        {
          toolName: "update_smart_list",
          userId: context.userId,
          smartListId: params.smartListId,
          updated,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "update_smart_list: Success",
      );

      return {
        success: true,
        data: {
          smartListId: smartList.id,
          name: newName,
          updated,
          message: `已更新 ${updated.join("、")}`,
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
          toolName: "update_smart_list",
          userId: context.userId,
          smartListId: params.smartListId,
          error: errorMessage,
        },
        "update_smart_list: Failed",
      );

      return {
        success: false,
        error: `更新智能列表失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
