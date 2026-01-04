/**
 * get_review_queue Tool
 *
 * 获取用户的待复习队列
 * 支持按状态筛选：逾期、本周到期、即将到期
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import type {
  GetReviewQueueParams,
  GetReviewQueueResult,
  ReviewQueueItemResult,
} from "./types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  calculatePriority,
  sortByPriority,
} from "@/lib/ai-skills/shared/review";
import type {
  ReviewQueueItem,
  FlashcardStatus,
} from "@/lib/ai-skills/shared/review/types";

// ============================================
// 参数定义
// ============================================

const paramsSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe("返回数量（1-50，默认 10）"),
  include_overdue: z
    .boolean()
    .optional()
    .default(true)
    .describe("是否包含逾期项目"),
  include_due_this_week: z
    .boolean()
    .optional()
    .default(true)
    .describe("是否包含本周到期项目"),
  include_upcoming: z
    .boolean()
    .optional()
    .default(false)
    .describe("是否包含未来即将到期项目"),
});

// ============================================
// Tool 描述
// ============================================

const TOOL_DESCRIPTION = `获取待复习的 Flashcard 队列，按优先级排序。

【使用场景】
• "我该复习什么"
• "有哪些待复习的卡片"
• "显示我的复习队列"
• "今天需要复习哪些内容"

【参数说明】
• limit: 返回数量 1-50（默认 10）
• include_overdue: 包含逾期项目（默认 true）
• include_due_this_week: 包含本周到期（默认 true）
• include_upcoming: 包含未来项目（默认 false）

【返回说明】
• 按优先级排序：逾期 > 本周到期 > 难度高
• 每个卡片包含：问题、答案、逾期天数、优先级分数`;

// ============================================
// Tool 实现
// ============================================

export const getReviewQueueTool: Tool<
  GetReviewQueueParams,
  GetReviewQueueResult
> = {
  definition: {
    name: "get_review_queue",
    description: TOOL_DESCRIPTION,
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 500,
  },

  async execute(
    params: GetReviewQueueParams,
    context: ToolContext,
  ): Promise<ToolResult<GetReviewQueueResult>> {
    const startTime = performance.now();
    const {
      limit = 10,
      include_overdue = true,
      include_due_this_week = true,
      include_upcoming = false,
    } = params;

    try {
      const supabase = await createClient();

      // 调用 RPC 获取待复习的 Flashcards
      const { data: pendingFlashcards, error } = await supabase.rpc(
        "get_pending_flashcards",
        {
          p_user_id: context.userId,
          p_limit: 100, // 获取更多以便筛选和排序
        },
      );

      if (error) {
        logger.error(
          {
            toolName: "get_review_queue",
            userId: context.userId,
            error: error.message,
          },
          "get_review_queue: DB Error",
        );

        return {
          success: false,
          error: `获取复习队列失败: ${error.message}`,
          errorCode: "DB_ERROR",
        };
      }

      const now = new Date();

      // 转换为 ReviewQueueItem 格式并计算优先级
      const queueItems: ReviewQueueItem[] = (pendingFlashcards || []).map(
        (fc) => {
          const nextReviewAt = fc.next_review_at
            ? new Date(fc.next_review_at)
            : null;
          const daysOverdue = nextReviewAt
            ? Math.floor(
                (now.getTime() - nextReviewAt.getTime()) /
                  (1000 * 60 * 60 * 24),
              )
            : 0;

          return {
            flashcardId: fc.flashcard_id,
            bookmarkId: fc.bookmark_id,
            bookmarkTitle: fc.bookmark_title,
            bookmarkUrl: fc.bookmark_url,
            question: fc.question,
            answer: fc.answer,
            sourceParagraph: fc.source_paragraph || undefined,
            status: fc.status as FlashcardStatus,
            easeFactor: fc.ease_factor,
            intervalDays: fc.interval_days,
            repetitions: fc.repetitions,
            nextReviewAt,
            daysOverdue,
            priorityScore: 0, // 稍后计算
          };
        },
      );

      // 计算优先级
      queueItems.forEach((item) => {
        item.priorityScore = calculatePriority(item);
      });

      // 筛选
      let filteredItems = queueItems;

      if (!include_overdue && !include_due_this_week && !include_upcoming) {
        // 如果所有选项都关闭，返回空
        filteredItems = [];
      } else {
        filteredItems = queueItems.filter((item) => {
          if (item.daysOverdue > 0) {
            return include_overdue;
          } else if (item.daysOverdue >= -7 && item.daysOverdue <= 0) {
            return include_due_this_week;
          } else {
            return include_upcoming;
          }
        });
      }

      // 排序并限制数量
      const sortedItems = sortByPriority(filteredItems).slice(0, limit);

      // 统计
      const overdueCount = queueItems.filter((i) => i.daysOverdue > 0).length;
      const dueThisWeekCount = queueItems.filter(
        (i) => i.daysOverdue >= -7 && i.daysOverdue <= 0,
      ).length;

      // 转换结果
      const resultItems: ReviewQueueItemResult[] = sortedItems.map((item) => ({
        flashcardId: item.flashcardId,
        bookmarkId: item.bookmarkId,
        bookmarkTitle: item.bookmarkTitle,
        question: item.question,
        answer: item.answer,
        status: item.status,
        daysOverdue: item.daysOverdue,
        priorityScore: Math.round(item.priorityScore),
        nextReviewAt: item.nextReviewAt?.toISOString() || null,
      }));

      // 生成消息
      let message: string;
      if (resultItems.length === 0) {
        message = "暂无待复习的卡片，继续保持！";
      } else if (overdueCount > 0) {
        message = `有 ${overdueCount} 张卡片已逾期，建议尽快复习`;
      } else {
        message = `当前有 ${resultItems.length} 张卡片待复习`;
      }

      logger.info(
        {
          toolName: "get_review_queue",
          userId: context.userId,
          totalCount: queueItems.length,
          filteredCount: resultItems.length,
          overdueCount,
          dueThisWeekCount,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "get_review_queue: Success",
      );

      return {
        success: true,
        data: {
          items: resultItems,
          totalCount: queueItems.length,
          overdueCount,
          dueThisWeekCount,
          message,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: resultItems.length,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "get_review_queue",
          userId: context.userId,
          error: errorMessage,
        },
        "get_review_queue: Failed",
      );

      return {
        success: false,
        error: `获取复习队列失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
