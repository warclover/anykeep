/**
 * update_review_preferences Tool
 *
 * 更新用户的复习偏好设置
 * 包括启用状态、首选时间、每周上限、通知渠道等
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import type {
  UpdateReviewPreferencesParams,
  UpdateReviewPreferencesResult,
} from "./types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  PreferredDay,
  NotificationChannel,
} from "@/lib/ai-skills/shared/review/types";

// ============================================
// 参数定义
// ============================================

const paramsSchema = z.object({
  enabled: z.boolean().optional().describe("是否启用主动复习功能"),
  preferred_day: z
    .enum([
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ])
    .optional()
    .describe("首选复习日（每周固定复习日）"),
  preferred_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "时间格式应为 HH:MM")
    .optional()
    .describe("首选复习时间（24小时制，如 09:00）"),
  weekly_limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe("每周复习上限（1-50）"),
  notification_channel: z
    .enum(["sidebar", "push", "both", "none"])
    .optional()
    .describe(
      "通知渠道：sidebar（侧边栏）、push（推送）、both（两者）、none（关闭）",
    ),
});

// ============================================
// Tool 描述
// ============================================

const TOOL_DESCRIPTION = `更新主动复习功能的偏好设置。

【使用场景】
• "开启主动复习"
• "关闭复习提醒"
• "设置每周复习上限为 20"
• "把复习时间改到晚上 8 点"
• "每周六提醒我复习"

【参数说明】
• enabled: 是否启用（true/false）
• preferred_day: 首选复习日（monday-sunday）
• preferred_time: 首选时间（HH:MM 格式）
• weekly_limit: 每周上限（1-50）
• notification_channel: 通知渠道（sidebar/push/both/none）

【注意事项】
• 至少需要提供一个参数
• 首选时间按本地时区计算`;

// ============================================
// Tool 实现
// ============================================

export const updateReviewPreferencesTool: Tool<
  UpdateReviewPreferencesParams,
  UpdateReviewPreferencesResult
> = {
  definition: {
    name: "update_review_preferences",
    description: TOOL_DESCRIPTION,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: false,
    estimatedDurationMs: 200,
  },

  async execute(
    params: UpdateReviewPreferencesParams,
    context: ToolContext,
  ): Promise<ToolResult<UpdateReviewPreferencesResult>> {
    const startTime = performance.now();
    const {
      enabled,
      preferred_day,
      preferred_time,
      weekly_limit,
      notification_channel,
    } = params;

    // 检查是否有任何参数
    if (
      enabled === undefined &&
      preferred_day === undefined &&
      preferred_time === undefined &&
      weekly_limit === undefined &&
      notification_channel === undefined
    ) {
      return {
        success: false,
        error: "至少需要提供一个设置参数",
        errorCode: "VALIDATION_ERROR",
      };
    }

    try {
      const supabase = await createClient();

      // 1. 获取或创建当前偏好
      // RPC 返回类型定义
      interface ReviewPreferencesResult {
        enabled?: boolean;
        preferred_day?: string;
        preferred_time?: string;
        weekly_limit?: number;
        notification_channel?: string;
      }
      const { data: rawPrefs, error: getError } = await supabase.rpc(
        "get_or_create_review_preferences",
        { p_user_id: context.userId },
      );
      const currentPrefs = rawPrefs as ReviewPreferencesResult | null;

      if (getError) {
        logger.error(
          {
            toolName: "update_review_preferences",
            userId: context.userId,
            error: getError.message,
          },
          "update_review_preferences: Get preferences failed",
        );

        return {
          success: false,
          error: `获取偏好设置失败: ${getError.message}`,
          errorCode: "DB_ERROR",
        };
      }

      // 确保 currentPrefs 存在
      if (!currentPrefs) {
        return {
          success: false,
          error: "无法获取或创建偏好设置",
          errorCode: "DB_ERROR",
        };
      }

      // 2. 合并更新（添加默认值确保类型安全）
      const updatedPrefs = {
        enabled: enabled ?? currentPrefs.enabled ?? true,
        preferred_day: preferred_day ?? currentPrefs.preferred_day ?? "monday",
        preferred_time:
          preferred_time ?? currentPrefs.preferred_time ?? "09:00",
        weekly_limit: weekly_limit ?? currentPrefs.weekly_limit ?? 10,
        notification_channel:
          notification_channel ??
          currentPrefs.notification_channel ??
          "sidebar",
        updated_at: new Date().toISOString(),
      };

      // 3. 更新数据库
      const { error: updateError } = await supabase
        .from("review_preferences")
        .update(updatedPrefs)
        .eq("user_id", context.userId);

      if (updateError) {
        logger.error(
          {
            toolName: "update_review_preferences",
            userId: context.userId,
            error: updateError.message,
          },
          "update_review_preferences: Update failed",
        );

        return {
          success: false,
          error: `更新偏好设置失败: ${updateError.message}`,
          errorCode: "DB_ERROR",
        };
      }

      // 4. 生成消息
      const changes: string[] = [];
      if (enabled !== undefined) {
        changes.push(enabled ? "已开启主动复习" : "已关闭主动复习");
      }
      if (preferred_day !== undefined) {
        const dayNames: Record<string, string> = {
          monday: "周一",
          tuesday: "周二",
          wednesday: "周三",
          thursday: "周四",
          friday: "周五",
          saturday: "周六",
          sunday: "周日",
        };
        changes.push(`首选复习日设为${dayNames[preferred_day]}`);
      }
      if (preferred_time !== undefined) {
        changes.push(`首选时间设为 ${preferred_time}`);
      }
      if (weekly_limit !== undefined) {
        changes.push(`每周上限设为 ${weekly_limit} 张`);
      }
      if (notification_channel !== undefined) {
        const channelNames: Record<string, string> = {
          sidebar: "侧边栏提醒",
          push: "推送通知",
          both: "侧边栏+推送",
          none: "关闭通知",
        };
        changes.push(`通知方式设为${channelNames[notification_channel]}`);
      }

      const message = changes.join("，");

      logger.info(
        {
          toolName: "update_review_preferences",
          userId: context.userId,
          changes: params,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "update_review_preferences: Success",
      );

      return {
        success: true,
        data: {
          success: true,
          preferences: {
            enabled: updatedPrefs.enabled,
            preferredDay: updatedPrefs.preferred_day as PreferredDay,
            preferredTime: updatedPrefs.preferred_time,
            weeklyLimit: updatedPrefs.weekly_limit,
            notificationChannel:
              updatedPrefs.notification_channel as NotificationChannel,
          },
          message: `设置已更新：${message}`,
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
          toolName: "update_review_preferences",
          userId: context.userId,
          error: errorMessage,
        },
        "update_review_preferences: Failed",
      );

      return {
        success: false,
        error: `更新偏好设置失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
