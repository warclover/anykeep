/**
 * submit_review_response Tool
 *
 * 提交复习反馈，更新 Flashcard 的 SM-2 参数
 * 支持三种反馈：mastered（掌握）、fuzzy（模糊）、forgotten（遗忘）
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import type {
  SubmitReviewResponseParams,
  SubmitReviewResponseResult,
} from "./types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================
// 参数定义
// ============================================

const paramsSchema = z.object({
  flashcard_id: z.number().int().positive().describe("Flashcard ID"),
  response: z
    .enum(["mastered", "fuzzy", "forgotten"])
    .describe(
      "复习反馈：mastered（完全掌握）、fuzzy（模糊记忆）、forgotten（完全遗忘）",
    ),
  response_time_ms: z
    .number()
    .int()
    .min(0)
    .max(300000)
    .optional()
    .describe("回答用时（毫秒，可选）"),
});

// ============================================
// Tool 描述
// ============================================

const TOOL_DESCRIPTION = `提交 Flashcard 复习反馈，系统会根据 SM-2 算法计算下次复习时间。

【使用场景】
• "我记住了这个"
• "这个有点模糊"
• "这个完全忘了"
• "标记为已掌握"

【反馈说明】
• mastered: 完全掌握，间隔会显著增加
• fuzzy: 模糊记忆，间隔小幅增加
• forgotten: 完全遗忘，重置为第二天复习

【注意事项】
• 反馈会影响后续复习调度
• 诚实反馈能获得最佳复习效果`;

// ============================================
// Tool 实现
// ============================================

export const submitReviewResponseTool: Tool<
  SubmitReviewResponseParams,
  SubmitReviewResponseResult
> = {
  definition: {
    name: "submit_review_response",
    description: TOOL_DESCRIPTION,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: false,
    estimatedDurationMs: 200,
  },

  async execute(
    params: SubmitReviewResponseParams,
    context: ToolContext,
  ): Promise<ToolResult<SubmitReviewResponseResult>> {
    const startTime = performance.now();
    const { flashcard_id, response, response_time_ms } = params;

    try {
      const supabase = await createClient();

      // 调用 RPC 更新 Flashcard 复习状态
      const { data, error } = await supabase.rpc("update_flashcard_review", {
        p_user_id: context.userId,
        p_flashcard_id: flashcard_id,
        p_response: response,
        p_response_time_ms: response_time_ms,
      });

      if (error) {
        // 检查是否是权限错误
        if (
          error.message.includes("not found") ||
          error.message.includes("unauthorized")
        ) {
          return {
            success: false,
            error: `Flashcard 不存在或无权访问: ${flashcard_id}`,
            errorCode: "NOT_FOUND",
          };
        }

        logger.error(
          {
            toolName: "submit_review_response",
            userId: context.userId,
            flashcardId: flashcard_id,
            response,
            error: error.message,
          },
          "submit_review_response: DB Error",
        );

        return {
          success: false,
          error: `提交复习反馈失败: ${error.message}`,
          errorCode: "DB_ERROR",
        };
      }

      // 转换结果类型
      // 注意：RPC 不返回 previous_interval，使用 new_interval 估算
      const newInterval = data?.new_interval || 1;
      const result = {
        prev_interval: Math.max(1, Math.floor(newInterval / 2)), // 估算上一次间隔
        new_interval: newInterval,
        next_review_at: data?.next_review_at || new Date().toISOString(),
      };

      // 生成用户友好的消息
      let message: string;
      const responseMessages = {
        mastered: "太棒了！下次复习时间已延长",
        fuzzy: "继续加油！下次复习时间已调整",
        forgotten: "没关系！明天会再次复习",
      };
      message = responseMessages[response];

      // 添加下次复习时间说明
      const nextReviewDate = new Date(result.next_review_at);
      const daysUntil = Math.ceil(
        (nextReviewDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      if (daysUntil === 0) {
        message += "（今天稍后）";
      } else if (daysUntil === 1) {
        message += "（明天）";
      } else {
        message += `（${daysUntil} 天后）`;
      }

      logger.info(
        {
          toolName: "submit_review_response",
          userId: context.userId,
          flashcardId: flashcard_id,
          response,
          prevInterval: result.prev_interval,
          newInterval: result.new_interval,
          responseTimeMs: response_time_ms,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "submit_review_response: Success",
      );

      return {
        success: true,
        data: {
          success: true,
          flashcardId: flashcard_id,
          previousInterval: result.prev_interval,
          newInterval: result.new_interval,
          nextReviewAt: result.next_review_at,
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
          toolName: "submit_review_response",
          userId: context.userId,
          flashcardId: flashcard_id,
          response,
          error: errorMessage,
        },
        "submit_review_response: Failed",
      );

      return {
        success: false,
        error: `提交复习反馈失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
