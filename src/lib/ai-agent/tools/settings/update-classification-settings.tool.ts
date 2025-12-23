/**
 * UpdateClassificationSettings Tool - 更新分类设置
 *
 * 更新用户的 AI 分类配置
 *
 * @version 1.1.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { trustModeService } from "@/lib/trust-mode/trust-mode.service";
import { logger } from "@/lib/logger";
import type { TrustModeConfig } from "@/types/trust-mode";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  confirmationThreshold: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe("确认阈值（0-100），低于此置信度需要确认（仅 Semi Auto 模式）"),
  dailyCreateLimit: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe("每日自动创建文件夹上限"),
  learnFromManualMoves: z
    .boolean()
    .optional()
    .describe("是否从用户手动移动行为学习"),
  learnFromDeletions: z.boolean().optional().describe("是否从用户删除行为学习"),
});

type UpdateClassificationSettingsParams = z.infer<typeof paramsSchema>;

interface UpdateClassificationSettingsResult {
  updated: string[];
  newValues: Record<string, unknown>;
  message: string;
}

// ============================================
// Tool 实现
// ============================================

export const updateClassificationSettingsTool: Tool<
  UpdateClassificationSettingsParams,
  UpdateClassificationSettingsResult
> = {
  definition: {
    name: "update_classification_settings",
    description: `更新用户的 AI 分类配置。

使用场景：
- 用户要求 "把确认阈值调到 80%"
- 用户要求 "关闭从手动移动学习"
- 用户要求 "设置每日自动创建文件夹限制为 5"

可配置项：
- confirmationThreshold: 确认阈值（0-100），仅 Semi Auto 模式有效
- dailyCreateLimit: 每日自动创建文件夹上限
- learnFromManualMoves: 从移动学习
- learnFromDeletions: 从删除学习`,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: false,
    estimatedDurationMs: 200,
  },

  async execute(
    params: UpdateClassificationSettingsParams,
    context,
  ): Promise<ToolResult<UpdateClassificationSettingsResult>> {
    const startTime = performance.now();

    try {
      // 检查是否有任何参数
      const hasParams = Object.values(params).some((v) => v !== undefined);
      if (!hasParams) {
        return {
          success: false,
          error: "请至少指定一个要更新的设置项",
          errorCode: "INVALID_PARAMS",
        };
      }

      // 构建覆盖配置
      const overrides: Partial<TrustModeConfig> = {};
      const updated: string[] = [];
      const newValues: Record<string, unknown> = {};

      if (params.confirmationThreshold !== undefined) {
        overrides.classification = {
          ...overrides.classification,
          confirmationThreshold: params.confirmationThreshold,
        } as TrustModeConfig["classification"];
        updated.push("confirmationThreshold");
        newValues.confirmationThreshold = params.confirmationThreshold;
      }

      if (params.dailyCreateLimit !== undefined) {
        overrides.folderManagement = {
          ...overrides.folderManagement,
          dailyCreateLimit: params.dailyCreateLimit,
        } as TrustModeConfig["folderManagement"];
        updated.push("dailyCreateLimit");
        newValues.dailyCreateLimit = params.dailyCreateLimit;
      }

      if (params.learnFromManualMoves !== undefined) {
        overrides.learning = {
          ...overrides.learning,
          learnFromManualMoves: params.learnFromManualMoves,
        } as TrustModeConfig["learning"];
        updated.push("learnFromManualMoves");
        newValues.learnFromManualMoves = params.learnFromManualMoves;
      }

      if (params.learnFromDeletions !== undefined) {
        overrides.learning = {
          ...overrides.learning,
          learnFromDeletions: params.learnFromDeletions,
        } as TrustModeConfig["learning"];
        updated.push("learnFromDeletions");
        newValues.learnFromDeletions = params.learnFromDeletions;
      }

      // 更新覆盖配置
      await trustModeService.updateOverrides(context.userId, overrides);

      logger.info(
        {
          toolName: "update_classification_settings",
          userId: context.userId,
          updated,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "update_classification_settings: Success",
      );

      return {
        success: true,
        data: {
          updated,
          newValues,
          message: `已更新 ${updated.length} 项分类设置`,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: updated.length,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "update_classification_settings",
          userId: context.userId,
          error: errorMessage,
        },
        "update_classification_settings: Failed",
      );

      return {
        success: false,
        error: `更新分类设置失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
