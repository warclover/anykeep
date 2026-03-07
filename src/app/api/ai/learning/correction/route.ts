/**
 * AI 学习纠正 API
 *
 * 记录用户的意图纠正，用于自我进化学习
 *
 * POST /api/ai/learning/correction
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { IntentType, CorrectionSignalType } from "@/lib/ai-learning/types";
import { withAuthMiddleware } from "@/lib/api/middleware";

// =============================================================================
// 类型定义
// =============================================================================

interface CorrectionRequest {
  wrongIntent: IntentType;
  correctIntent: IntentType;
  messageId?: string;
  conversationId?: string;
  userId?: string;
  signal: CorrectionSignalType;
  confidence: number;
  originalInput?: string;
}

interface CorrectionResponse {
  success: boolean;
  data?: {
    id: string;
    createdAt: string;
  };
  error?: string;
}

// =============================================================================
// API Handler
// =============================================================================

export const POST = withAuthMiddleware(async (request, { userId }) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const log = logger.child({ requestId, route: "ai/learning/correction" });

  // 解析请求体
  const body: CorrectionRequest = await request.json();
  const {
    wrongIntent,
    correctIntent,
    messageId,
    conversationId,
    signal,
    confidence,
    originalInput,
  } = body;

  log.info(
    { wrongIntent, correctIntent, signal, confidence },
    "Recording intent correction",
  );

  // 验证参数
  if (!wrongIntent || !correctIntent) {
    return NextResponse.json<CorrectionResponse>(
      { success: false, error: "缺少必需参数" },
      { status: 400 },
    );
  }

  if (wrongIntent === correctIntent) {
    return NextResponse.json<CorrectionResponse>(
      { success: false, error: "纠正前后意图相同" },
      { status: 400 },
    );
  }

  // 存储纠正记录
  // 注意：intent_corrections 表需要先执行数据库迁移
  // 如果表不存在，会优雅降级返回 503
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: insertError } = await (supabase as any)
    .from("intent_corrections")
    .insert({
      user_id: userId,
      original_input: originalInput || "",
      wrong_intent: wrongIntent,
      correct_intent: correctIntent,
      signal: signal || "negative_feedback",
      confidence: confidence || 0.9,
      applied_count: 0,
      metadata: {
        messageId,
        conversationId,
      },
    })
    .select("id, created_at")
    .single();

  if (insertError) {
    log.error({ error: insertError }, "Failed to insert correction");

    // 检查是否是表不存在错误
    if (insertError.code === "42P01") {
      return NextResponse.json<CorrectionResponse>(
        {
          success: false,
          error: "学习功能尚未启用，请先执行数据库迁移",
        },
        { status: 503 },
      );
    }

    return NextResponse.json<CorrectionResponse>(
      { success: false, error: "记录失败" },
      { status: 500 },
    );
  }

  const result = data as { id: string; created_at: string } | null;
  log.info({ correctionId: result?.id }, "Correction recorded successfully");

  return NextResponse.json<CorrectionResponse>({
    success: true,
    data: result
      ? {
          id: result.id,
          createdAt: result.created_at,
        }
      : undefined,
  });
});
