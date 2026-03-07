/**
 * AI 反馈 API
 *
 * 端点：POST /api/agent/feedback
 * 功能：保存用户对 AI 回答的反馈
 *
 * @version 1.0.0
 * @since 2025-12-25
 * @see {@link @/lib/ai-skills/services/feedback.service} FeedbackService
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { FeedbackReason } from "@/components/ai/phase4/types";
import { withAuthMiddleware } from "@/lib/api/middleware";

// =============================================================================
// 请求验证 Schema
// =============================================================================

const feedbackRequestSchema = z.object({
  conversationId: z.string().min(1, "conversationId 不能为空"),
  messageId: z.string().min(1, "messageId 不能为空"),
  type: z.enum(["positive", "negative"]),
  negativeReason: z
    .enum([
      "wrong_intent",
      "inaccurate_result",
      "bad_format",
      "incomplete",
      "too_slow",
      "privacy_concern",
      "unhelpful",
      "other",
    ])
    .optional(),
  comment: z.string().max(500).optional(),
  context: z
    .object({
      originalMessage: z.string().optional(),
      classifiedIntent: z.string().optional(),
      toolUsed: z.string().optional(),
      executionMode: z.enum(["atomic", "orchestration"]).optional(),
      skillId: z.string().optional(),
    })
    .optional(),
});

// =============================================================================
// API Handler
// =============================================================================

/**
 * POST /api/agent/feedback
 * 提交用户反馈
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  // 1. 解析并验证请求体
  const body = await request.json();
  const validation = feedbackRequestSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        error: "请求参数无效",
        details: validation.error.issues,
      },
      { status: 400 },
    );
  }

  const { conversationId, messageId, type, negativeReason, comment, context } =
    validation.data;

  logger.info(
    {
      userId: userId.slice(0, 8) + "...",
      messageId,
      type,
      negativeReason,
    },
    "Agent Feedback: Request received",
  );

  // 2. 插入反馈
  const supabase = await createClient();
  // 类型断言: 手动维护类型文件时需要此断言
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (supabase.from("ai_feedback") as any)
    .upsert(
      {
        user_id: userId,
        conversation_id: conversationId,
        message_id: messageId,
        type,
        negative_reason: negativeReason || null,
        negative_comment: comment || null,
        original_message: context?.originalMessage ?? null,
        classified_intent: context?.classifiedIntent ?? null,
        tool_used: context?.toolUsed ?? null,
        execution_mode: context?.executionMode ?? null,
        skill_id: context?.skillId ?? null,
      },
      {
        onConflict: "user_id,message_id",
      },
    )
    .select("id")
    .single()) as {
    data: { id: string } | null;
    error: { message: string } | null;
  };

  if (error) {
    logger.error({ error }, "Agent Feedback: Failed to save");
    return NextResponse.json(
      { success: false, error: "保存反馈失败" },
      { status: 500 },
    );
  }

  logger.info(
    { feedbackId: data?.id, type },
    "Agent Feedback: Saved successfully",
  );

  return NextResponse.json({
    success: true,
    data: { id: data?.id },
  });
});

/**
 * GET /api/agent/feedback
 * 获取用户反馈统计
 */
export const GET = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "stats";

  if (action === "stats") {
    // 获取统计数据
    const { data, error } = await supabase.rpc("get_ai_feedback_stats", {
      p_user_id: userId,
    });

    if (error) {
      logger.error({ error }, "Agent Feedback: Failed to get stats");
      return NextResponse.json(
        { success: false, error: "获取统计失败" },
        { status: 500 },
      );
    }

    const stats = data?.[0] ?? {
      total_count: 0,
      positive_count: 0,
      negative_count: 0,
      satisfaction_rate: 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        totalCount: stats.total_count,
        positiveCount: stats.positive_count,
        negativeCount: stats.negative_count,
        satisfactionRate: stats.satisfaction_rate,
      },
    });
  }

  if (action === "reasons") {
    // 获取负反馈原因分布
    const { data, error } = await supabase.rpc(
      "get_negative_feedback_reasons",
      { p_limit: 100 },
    );

    if (error) {
      logger.error({ error }, "Agent Feedback: Failed to get reasons");
      return NextResponse.json(
        { success: false, error: "获取原因统计失败" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: (data ?? []).map(
        (item: { reason: string; count: number; percentage: number }) => ({
          reason: item.reason as FeedbackReason,
          count: item.count,
          percentage: item.percentage,
        }),
      ),
    });
  }

  return NextResponse.json(
    { success: false, error: "未知操作" },
    { status: 400 },
  );
});
