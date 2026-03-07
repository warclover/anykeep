/**
 * AI 意图纠正 API
 *
 * 端点：
 * - POST /api/agent/intent-correction - 提交意图纠正
 * - GET /api/agent/intent-correction - 获取纠正历史/统计
 *
 * Phase 4: 支持 Batch 6 自我进化学习
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { intentCorrectionService } from "@/lib/ai-skills/services";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";

// =============================================================================
// 请求验证 Schema
// =============================================================================

/**
 * 创建纠正请求 Schema
 */
const createCorrectionSchema = z.object({
  originalInput: z.string().min(1).max(2000),
  wrongIntent: z.enum([
    "query",
    "action",
    "organize",
    "analyze",
    "learn",
    "create",
    "chitchat",
  ]),
  correctIntent: z.enum([
    "query",
    "action",
    "organize",
    "analyze",
    "learn",
    "create",
    "chitchat",
  ]),
  signal: z.enum([
    "explicit_wrong",
    "correction_follow",
    "reformulation",
    "negative_feedback",
  ]),
  confidence: z.number().min(0).max(1).optional(),
  conversationId: z.string().optional(),
  messageId: z.string().optional(),
});

// =============================================================================
// API Handlers
// =============================================================================

/**
 * POST /api/agent/intent-correction
 * 提交意图纠正
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  // 1. 解析并验证请求体
  const body = await request.json();
  const validation = createCorrectionSchema.safeParse(body);

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

  const data = validation.data;

  // 2. 验证错误意图和正确意图不同
  if (data.wrongIntent === data.correctIntent) {
    return NextResponse.json(
      { success: false, error: "错误意图和正确意图不能相同" },
      { status: 400 },
    );
  }

  logger.info(
    {
      userId: userId.slice(0, 8) + "...",
      wrongIntent: data.wrongIntent,
      correctIntent: data.correctIntent,
      signal: data.signal,
    },
    "Intent Correction API: Creating correction",
  );

  // 3. 创建纠正记录
  const result = await intentCorrectionService.createCorrection(data);

  if (!result.success) {
    logger.warn(
      { error: result.error },
      "Intent Correction API: Creation failed",
    );
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 },
    );
  }

  logger.info(
    {
      correctionId: result.data?.id,
      wrongIntent: data.wrongIntent,
      correctIntent: data.correctIntent,
    },
    "Intent Correction API: Correction created successfully",
  );

  return NextResponse.json({
    success: true,
    data: result.data,
  });
});

/**
 * GET /api/agent/intent-correction
 * 获取纠正历史或学习统计
 *
 * Query params:
 * - action: "history" | "stats" (default: "history")
 * - limit: number (default: 20)
 * - offset: number (default: 0)
 */
export const GET = withAuthMiddleware(async (request) => {
  // 1. 解析查询参数
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "history";

  // 2. 根据 action 执行不同操作
  if (action === "stats") {
    const result = await intentCorrectionService.getLearningStats();

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  }

  if (action === "history") {
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "20", 10),
      100,
    );
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    const result = await intentCorrectionService.getCorrectionHistory(
      limit,
      offset,
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  }

  return NextResponse.json(
    { success: false, error: "未知操作" },
    { status: 400 },
  );
});
