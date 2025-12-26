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

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { intentCorrectionService } from "@/lib/ai-skills/services";
import { logger } from "@/lib/logger";

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
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
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

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = createCorrectionSchema.safeParse(body);

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

    const data = validation.data;

    // 3. 验证错误意图和正确意图不同
    if (data.wrongIntent === data.correctIntent) {
      return Response.json(
        { success: false, error: "错误意图和正确意图不能相同" },
        { status: 400 },
      );
    }

    logger.info(
      {
        userId: user.id.slice(0, 8) + "...",
        wrongIntent: data.wrongIntent,
        correctIntent: data.correctIntent,
        signal: data.signal,
      },
      "Intent Correction API: Creating correction",
    );

    // 4. 创建纠正记录
    const result = await intentCorrectionService.createCorrection(data);

    if (!result.success) {
      logger.warn(
        { error: result.error },
        "Intent Correction API: Creation failed",
      );
      return Response.json(
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

    return Response.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/agent/intent-correction error",
    );

    return Response.json(
      { success: false, error: "系统错误" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/agent/intent-correction
 * 获取纠正历史或学习统计
 *
 * Query params:
 * - action: "history" | "stats" (default: "history")
 * - limit: number (default: 20)
 * - offset: number (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 验证用户身份
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

    // 2. 解析查询参数
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "history";

    // 3. 根据 action 执行不同操作
    if (action === "stats") {
      const result = await intentCorrectionService.getLearningStats();

      if (!result.success) {
        return Response.json(
          { success: false, error: result.error },
          { status: 400 },
        );
      }

      return Response.json({
        success: true,
        data: result.data,
      });
    }

    if (action === "history") {
      const limit = Math.min(
        parseInt(searchParams.get("limit") || "20", 10),
        100,
      );
      const offset = Math.max(
        parseInt(searchParams.get("offset") || "0", 10),
        0,
      );

      const result = await intentCorrectionService.getCorrectionHistory(
        limit,
        offset,
      );

      if (!result.success) {
        return Response.json(
          { success: false, error: result.error },
          { status: 400 },
        );
      }

      return Response.json({
        success: true,
        data: result.data,
      });
    }

    return Response.json(
      { success: false, error: "未知操作" },
      { status: 400 },
    );
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "GET /api/agent/intent-correction error",
    );

    return Response.json(
      { success: false, error: "系统错误" },
      { status: 500 },
    );
  }
}
