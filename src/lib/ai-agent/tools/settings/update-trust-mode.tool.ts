/**
 * UpdateTrustMode Tool - 更新 AI 信任模式
 *
 * 更新 AI 智能分类的托管模式
 *
 * @version 1.1.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { trustModeService } from "@/lib/trust-mode/trust-mode.service";
import { logger } from "@/lib/logger";
import type { TrustMode } from "@/types/trust-mode";

// ============================================
// 参数和结果类型定义
// ============================================

const trustModeSchema = z.enum(["full_auto", "semi_auto", "manual"]);

const paramsSchema = z.object({
  mode: trustModeSchema.describe(
    "信任模式：full_auto（全自动-AI全权处理）、semi_auto（半自动-低置信度需确认）、manual（手动-仅整理到待整理）",
  ),
});

type UpdateTrustModeParams = z.infer<typeof paramsSchema>;

interface UpdateTrustModeResult {
  previousMode: TrustMode;
  currentMode: TrustMode;
  modeLabel: string;
  modeDescription: string;
  message: string;
}

// ============================================
// 模式配置
// ============================================

const MODE_CONFIG: Record<TrustMode, { label: string; description: string }> = {
  full_auto: {
    label: "全自动模式",
    description: "AI 全权处理所有分类，低置信度内容进入待整理聚类",
  },
  semi_auto: {
    label: "半自动模式",
    description: "高置信度自动处理，低置信度发送确认消息等待用户决定",
  },
  manual: {
    label: "手动模式",
    description: "仅整理到待整理，不自动分类，适合喜欢完全掌控的用户",
  },
};

// ============================================
// Tool 实现
// ============================================

export const updateTrustModeTool: Tool<
  UpdateTrustModeParams,
  UpdateTrustModeResult
> = {
  definition: {
    name: "update_trust_mode",
    description: `更新 AI 智能分类的托管模式。

可用模式：
- full_auto（全自动）：AI 全权处理所有分类，适合信任 AI 决策的用户
- semi_auto（半自动）：高置信度自动处理，低置信度需要用户确认
- manual（手动）：仅整理到待整理，不自动分类，适合喜欢完全掌控的用户

使用场景：
- 用户要求 "把 AI 设置为全自动模式"
- 用户要求 "切换到半自动模式"
- 用户要求 "我要自己管理分类，关闭自动分类"
- 用户要求 "让 AI 帮我自动整理"

注意事项：
- 此设置影响新收藏的自动分类行为
- 不需要用户确认，为设置类操作`,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: false,
    estimatedDurationMs: 150,
  },

  async execute(
    params: UpdateTrustModeParams,
    context,
  ): Promise<ToolResult<UpdateTrustModeResult>> {
    const startTime = performance.now();

    try {
      // 1. 获取当前设置
      const currentEffectiveConfig = await trustModeService.getEffectiveConfig(
        context.userId,
      );
      const previousMode: TrustMode = currentEffectiveConfig.mode;

      // 2. 检查是否为相同状态
      if (previousMode === params.mode) {
        const config = MODE_CONFIG[params.mode];
        return {
          success: true,
          data: {
            previousMode,
            currentMode: params.mode,
            modeLabel: config.label,
            modeDescription: config.description,
            message: `当前已是${config.label}`,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 3. 使用服务更新信任模式
      await trustModeService.updateTrustMode(context.userId, params.mode);

      const newConfig = MODE_CONFIG[params.mode];
      const prevConfig = MODE_CONFIG[previousMode];

      logger.info(
        {
          toolName: "update_trust_mode",
          userId: context.userId,
          previousMode,
          currentMode: params.mode,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "update_trust_mode: Success",
      );

      return {
        success: true,
        data: {
          previousMode,
          currentMode: params.mode,
          modeLabel: newConfig.label,
          modeDescription: newConfig.description,
          message: `已从「${prevConfig.label}」切换到「${newConfig.label}」`,
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
          toolName: "update_trust_mode",
          userId: context.userId,
          targetMode: params.mode,
          error: errorMessage,
        },
        "update_trust_mode: Failed",
      );

      return {
        success: false,
        error: `更新信任模式失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
