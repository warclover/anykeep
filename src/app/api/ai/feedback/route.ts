/**
 * AI 反馈 API
 *
 * POST /api/ai/feedback - 提交反馈
 *
 * Phase 4: 用户反馈收集
 * Phase 3 Batch 6: 集成自我进化学习
 *
 * @version 1.1.0
 * @since 2025-12-25
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { feedbackService } from "@/lib/ai-skills/services";
import { feedbackIntegration } from "@/lib/ai-learning";
import { logger } from "@/lib/logger";

/**
 * 请求体 Schema
 */
const feedbackRequestSchema = z.object({
  /** 消息 ID */
  messageId: z.string().min(1),
  /** 会话 ID */
  conversationId: z.string().optional(),
  /** 反馈类型 */
  type: z.enum(["positive", "negative"]),
  /** 负面反馈原因 */
  negativeReason: z
    .enum([
      // UI 使用的值
      "wrong_intent",
      "inaccurate_result",
      "bad_format",
      "incomplete",
      "other",
      // API 兼容的值
      "inaccurate",
      "irrelevant",
      "slow",
      "confusing",
    ])
    .optional(),
  /** 用户评论 */
  comment: z.string().max(1000).optional(),
  /** 上下文信息 */
  context: z
    .object({
      originalMessage: z.string().optional(),
      classifiedIntent: z.string().optional(),
      toolUsed: z.string().optional(),
      executionMode: z.string().optional(),
      skillId: z.string().optional(),
    })
    .optional(),
});

/**
 * POST /api/ai/feedback
 * 提交 AI 反馈
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json(
        { success: false, error: "请先登录" },
        { status: 401 },
      );
    }

    // 解析请求体
    const body = await request.json();
    const validation = feedbackRequestSchema.safeParse(body);

    if (!validation.success) {
      return Response.json(
        {
          success: false,
          error: "请求参数无效",
          details: validation.error.issues,
        },
        { status: 400 },
      );
    }

    const {
      messageId,
      conversationId,
      type,
      negativeReason,
      comment,
      context,
    } = validation.data;

    // 提交反馈到存储
    const result = await feedbackService.submitFeedback({
      messageId,
      conversationId: conversationId || "",
      type,
      negativeReason,
      comment,
      context,
    });

    if (!result.success) {
      logger.warn(
        { messageId, type, error: result.error },
        "AI Feedback API: Submit failed",
      );
      return Response.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    // Phase 3 Batch 6: 集成自我进化学习
    // 负面反馈可能触发学习记录
    let learningResult: { learningRecorded?: boolean; correctionId?: string } =
      {
        learningRecorded: false,
        correctionId: undefined,
      };
    if (type === "negative" && negativeReason) {
      try {
        learningResult = await feedbackIntegration.handleFeedback(user.id, {
          messageId,
          conversationId: conversationId || "",
          type,
          negativeReason,
          comment,
          context,
        });

        if (learningResult.learningRecorded) {
          logger.info(
            {
              userId: user.id.slice(0, 8) + "...",
              correctionId: learningResult.correctionId,
            },
            "AI Feedback API: Learning recorded from feedback",
          );
        }
      } catch (learningError) {
        // 学习记录失败不应影响反馈提交
        logger.warn(
          {
            error:
              learningError instanceof Error
                ? learningError.message
                : String(learningError),
          },
          "AI Feedback API: Learning integration failed (non-blocking)",
        );
      }
    }

    logger.info(
      {
        userId: user.id.slice(0, 8) + "...",
        messageId,
        type,
        hasComment: !!comment,
        learningRecorded: learningResult.learningRecorded,
      },
      "AI Feedback API: Feedback submitted",
    );

    return Response.json({
      success: true,
      data: {
        ...result.data,
        learningRecorded: learningResult.learningRecorded,
      },
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "AI Feedback API: Unexpected error",
    );

    return Response.json(
      { success: false, error: "系统错误" },
      { status: 500 },
    );
  }
}
