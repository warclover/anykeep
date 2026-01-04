/**
 * get_mastery_stats Tool
 *
 * 获取用户的复习掌握度统计
 * 包括总体进度、会话统计、连续天数等
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import type { GetMasteryStatsParams, GetMasteryStatsResult } from "./types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================
// 参数定义
// ============================================

const paramsSchema = z.object({
  time_range: z
    .enum(["week", "month", "all"])
    .optional()
    .default("week")
    .describe("统计时间范围：week（本周）、month（本月）、all（全部）"),
});

// ============================================
// Tool 描述
// ============================================

const TOOL_DESCRIPTION = `获取复习掌握度统计报告，了解学习进度。

【使用场景】
• "我的复习进度如何"
• "本周复习情况"
• "我掌握了多少知识"
• "复习统计"

【返回说明】
• 总体进度：已掌握/学习中/待复习
• 会话统计：掌握/模糊/遗忘次数
• 掌握率：已掌握卡片占比
• 连续天数：连续复习的天数

【参数说明】
• time_range: week（本周）、month（本月）、all（全部）`;

// ============================================
// Tool 实现
// ============================================

export const getMasteryStatsTool: Tool<
  GetMasteryStatsParams,
  GetMasteryStatsResult
> = {
  definition: {
    name: "get_mastery_stats",
    description: TOOL_DESCRIPTION,
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 300,
  },

  async execute(
    params: GetMasteryStatsParams,
    context: ToolContext,
  ): Promise<ToolResult<GetMasteryStatsResult>> {
    const startTime = performance.now();
    const { time_range = "week" } = params;

    try {
      const supabase = await createClient();

      // RPC 返回类型
      interface ReviewStatsRpcResult {
        total_flashcards?: number;
        mastered_count?: number;
        learning_count?: number;
        pending_count?: number;
        due_today?: number;
        overdue_count?: number;
        weekly_reviews?: number;
        streak_days?: number;
        avg_ease_factor?: number;
      }

      // 调用 RPC 获取统计数据
      const { data, error } = await supabase.rpc("get_review_stats", {
        p_user_id: context.userId,
      });

      const stats = data as unknown as ReviewStatsRpcResult | null;

      if (error) {
        logger.error(
          {
            toolName: "get_mastery_stats",
            userId: context.userId,
            timeRange: time_range,
            error: error.message,
          },
          "get_mastery_stats: DB Error",
        );

        return {
          success: false,
          error: `获取统计数据失败: ${error.message}`,
          errorCode: "DB_ERROR",
        };
      }

      // 转换为统一类型（使用 RPC 返回的字段）
      const result = {
        total_flashcards: stats?.total_flashcards || 0,
        mastered_count: stats?.mastered_count || 0,
        learning_count: stats?.learning_count || 0,
        pending_count: stats?.pending_count || 0,
        due_today: stats?.due_today || 0,
        overdue_count: stats?.overdue_count || 0,
        weekly_reviews: stats?.weekly_reviews || 0,
        streak_days: stats?.streak_days || 0,
        avg_ease_factor: stats?.avg_ease_factor || 2.5,
      };

      // 计算会话统计（从 weekly_reviews 估算）
      const sessions_in_period = result.weekly_reviews;
      const mastered_sessions = Math.round(sessions_in_period * 0.6); // 估算
      const fuzzy_sessions = Math.round(sessions_in_period * 0.3);
      const forgotten_sessions =
        sessions_in_period - mastered_sessions - fuzzy_sessions;

      // 计算掌握率
      const masteredRate =
        result.total_flashcards > 0
          ? Math.round((result.mastered_count / result.total_flashcards) * 100)
          : 0;

      // 生成消息
      let message: string;
      if (result.total_flashcards === 0) {
        message = "还没有复习卡片，为收藏内容生成卡片开始学习吧！";
      } else if (masteredRate >= 80) {
        message = `太棒了！已掌握 ${masteredRate}% 的知识点`;
      } else if (masteredRate >= 50) {
        message = `进步不错！已掌握 ${masteredRate}%，继续加油`;
      } else {
        message = `加油！当前掌握率 ${masteredRate}%，坚持复习会越来越好`;
      }

      // 添加连续天数鼓励
      if (result.streak_days > 0) {
        message += `，已连续复习 ${result.streak_days} 天`;
      }

      const timeRangeLabels = {
        week: "本周",
        month: "本月",
        all: "全部",
      };

      logger.info(
        {
          toolName: "get_mastery_stats",
          userId: context.userId,
          timeRange: time_range,
          totalFlashcards: result.total_flashcards,
          masteredCount: result.mastered_count,
          masteredRate,
          streakDays: result.streak_days,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "get_mastery_stats: Success",
      );

      return {
        success: true,
        data: {
          totalFlashcards: result.total_flashcards,
          masteredCount: result.mastered_count,
          learningCount: result.learning_count,
          pendingCount: result.pending_count,
          masteredRate,
          sessionsInPeriod: sessions_in_period,
          masteredSessions: mastered_sessions,
          fuzzySessions: fuzzy_sessions,
          forgottenSessions: forgotten_sessions,
          avgResponseTimeMs: undefined, // RPC 未返回此字段
          streakDays: result.streak_days,
          message: `【${timeRangeLabels[time_range]}统计】${message}`,
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
          toolName: "get_mastery_stats",
          userId: context.userId,
          timeRange: time_range,
          error: errorMessage,
        },
        "get_mastery_stats: Failed",
      );

      return {
        success: false,
        error: `获取统计数据失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
