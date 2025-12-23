/**
 * GetUserSettings Tool - 获取用户设置
 *
 * 获取用户的 AI 相关设置信息
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { trustModeService } from "@/lib/trust-mode/trust-mode.service";
import { logger } from "@/lib/logger";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({});

type GetUserSettingsParams = z.infer<typeof paramsSchema>;

interface UserSettingsResult {
  trustMode: {
    mode: string;
    label: string;
    description: string;
  };
  classification: {
    autoClassify: boolean;
    confirmationThreshold: number | undefined;
    lowConfidenceAction: string;
  };
  folderManagement: {
    autoCreate: boolean;
    dailyCreateLimit: number | undefined;
  };
  stats: {
    autoDecisions: number;
    userCorrections: number;
    pendingConfirmations: number;
    correctionRate: number;
  };
  message: string;
}

// ============================================
// 模式配置
// ============================================

const MODE_LABELS: Record<string, { label: string; description: string }> = {
  full_auto: {
    label: "全自动模式",
    description: "AI 全权处理所有分类",
  },
  semi_auto: {
    label: "半自动模式",
    description: "高置信度自动处理，低置信度需确认",
  },
  manual: {
    label: "手动模式",
    description: "仅整理到待整理，不自动分类",
  },
};

// ============================================
// Tool 实现
// ============================================

export const getUserSettingsTool: Tool<
  GetUserSettingsParams,
  UserSettingsResult
> = {
  definition: {
    name: "get_user_settings",
    description: `获取用户的 AI 相关设置信息。

使用场景：
- 用户要求 "查看我的 AI 设置"
- 用户要求 "我的自动分类是什么模式"
- 用户要求 "显示当前设置"
- AI 需要了解用户偏好时

返回信息：
- trustMode: 托管模式设置
- classification: 分类相关设置
- folder: 文件夹相关设置
- stats: 使用统计数据`,
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 100,
  },

  async execute(
    _params: GetUserSettingsParams,
    context,
  ): Promise<ToolResult<UserSettingsResult>> {
    const startTime = performance.now();

    try {
      // 获取有效配置
      const effectiveConfig = await trustModeService.getEffectiveConfig(
        context.userId,
      );

      const modeInfo =
        MODE_LABELS[effectiveConfig.mode] || MODE_LABELS.full_auto;

      logger.info(
        {
          toolName: "get_user_settings",
          userId: context.userId,
          mode: effectiveConfig.mode,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "get_user_settings: Success",
      );

      return {
        success: true,
        data: {
          trustMode: {
            mode: effectiveConfig.mode,
            label: modeInfo.label,
            description: modeInfo.description,
          },
          classification: {
            autoClassify: effectiveConfig.config.classification.autoClassify,
            confirmationThreshold:
              effectiveConfig.config.classification.confirmationThreshold,
            lowConfidenceAction:
              effectiveConfig.config.classification.lowConfidenceAction,
          },
          folderManagement: {
            autoCreate: effectiveConfig.config.folderManagement.autoCreate,
            dailyCreateLimit:
              effectiveConfig.config.folderManagement.dailyCreateLimit,
          },
          stats: effectiveConfig.stats,
          message: `当前使用${modeInfo.label}`,
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
          toolName: "get_user_settings",
          userId: context.userId,
          error: errorMessage,
        },
        "get_user_settings: Failed",
      );

      return {
        success: false,
        error: `获取用户设置失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
