/**
 * GetClassificationSettings Tool - 获取分类设置
 *
 * 获取用户的 AI 分类详细设置
 *
 * @version 1.1.0
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

type GetClassificationSettingsParams = z.infer<typeof paramsSchema>;

interface ClassificationSettingsResult {
  mode: string;
  modeLabel: string;
  classification: {
    autoClassify: boolean;
    requireConfirmation: boolean;
    confirmationThreshold: number | undefined;
    lowConfidenceAction: string;
  };
  folderManagement: {
    autoCreate: boolean;
    autoMerge: boolean;
    autoSplit: boolean;
    autoRename: boolean;
    dailyCreateLimit: number | undefined;
  };
  learning: {
    learnFromManualMoves: boolean;
    learnFromDeletions: boolean;
  };
  notification: {
    onClassification: boolean;
    onFolderCreate: boolean;
    onFolderSuggestion: boolean;
    onMajorReorganization: boolean;
  };
  message: string;
}

// ============================================
// 模式配置
// ============================================

const MODE_LABELS: Record<string, string> = {
  full_auto: "全自动模式",
  semi_auto: "半自动模式",
  manual: "手动模式",
};

// ============================================
// Tool 实现
// ============================================

export const getClassificationSettingsTool: Tool<
  GetClassificationSettingsParams,
  ClassificationSettingsResult
> = {
  definition: {
    name: "get_classification_settings",
    description: `获取用户的 AI 分类详细设置。

使用场景：
- 用户要求 "查看我的分类设置"
- 用户要求 "我的自动分类配置是什么"
- 用户要求 "显示文件夹自动创建设置"
- AI 需要了解分类行为偏好时

返回信息：
- classification: 分类相关配置（阈值、低置信度处理等）
- folderManagement: 文件夹管理配置（自动创建、合并、拆分等）
- learning: 学习配置（是否从用户行为学习）
- notification: 通知配置`,
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 100,
  },

  async execute(
    _params: GetClassificationSettingsParams,
    context,
  ): Promise<ToolResult<ClassificationSettingsResult>> {
    const startTime = performance.now();

    try {
      // 获取有效配置
      const effectiveConfig = await trustModeService.getEffectiveConfig(
        context.userId,
      );

      const { mode, config } = effectiveConfig;

      logger.info(
        {
          toolName: "get_classification_settings",
          userId: context.userId,
          mode,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "get_classification_settings: Success",
      );

      return {
        success: true,
        data: {
          mode,
          modeLabel: MODE_LABELS[mode] || mode,
          classification: {
            autoClassify: config.classification.autoClassify,
            requireConfirmation: config.classification.requireConfirmation,
            confirmationThreshold: config.classification.confirmationThreshold,
            lowConfidenceAction: config.classification.lowConfidenceAction,
          },
          folderManagement: {
            autoCreate: config.folderManagement.autoCreate,
            autoMerge: config.folderManagement.autoMerge,
            autoSplit: config.folderManagement.autoSplit,
            autoRename: config.folderManagement.autoRename,
            dailyCreateLimit: config.folderManagement.dailyCreateLimit,
          },
          learning: {
            learnFromManualMoves: config.learning.learnFromManualMoves,
            learnFromDeletions: config.learning.learnFromDeletions,
          },
          notification: {
            onClassification: config.notification.onClassification === true,
            onFolderCreate: config.notification.onFolderCreate === true,
            onFolderSuggestion: config.notification.onFolderSuggestion === true,
            onMajorReorganization:
              config.notification.onMajorReorganization === true,
          },
          message: `当前使用${MODE_LABELS[mode] || mode}`,
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
          toolName: "get_classification_settings",
          userId: context.userId,
          error: errorMessage,
        },
        "get_classification_settings: Failed",
      );

      return {
        success: false,
        error: `获取分类设置失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
