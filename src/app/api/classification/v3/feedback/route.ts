/**
 * V3.0 分类反馈 API
 *
 * POST /api/classification/v3/feedback - 记录用户反馈
 * GET /api/classification/v3/feedback - 获取用户分类统计和权重调整
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { FeedbackLoopService } from "@/lib/classification/v3/services/feedback-loop.service";

// 用户反馈动作枚举
const USER_ACTIONS = [
  "accepted",
  "rejected",
  "changed_folder",
  "undo",
  "ignored",
  "manual_move",
] as const;

/**
 * 提交反馈 Schema
 */
const feedbackSchema = z.object({
  bookmarkId: z.number().int().positive(),
  action: z.enum(USER_ACTIONS),
  chosenFolderId: z.number().int().positive().optional(),
});

/**
 * POST /api/classification/v3/feedback
 * 记录用户对分类结果的反馈
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
      return unauthorizedError("请先登录");
    }

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = feedbackSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { bookmarkId, action, chosenFolderId } = validation.data;

    // 3. 记录反馈
    const feedbackService = new FeedbackLoopService(supabase);
    await feedbackService.recordFeedback(
      bookmarkId,
      user.id,
      action,
      chosenFolderId,
    );

    logger.info(
      {
        userId: user.id,
        bookmarkId,
        action,
        chosenFolderId,
      },
      "V3 Feedback recorded",
    );

    // 4. 返回成功
    return successResponse({
      success: true,
      message: "反馈已记录",
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/classification/v3/feedback error",
    );
    return internalError("记录反馈失败");
  }
}

/**
 * GET /api/classification/v3/feedback
 * 获取用户分类统计和动态权重调整
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
      return unauthorizedError("请先登录");
    }

    // 2. 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get("days") || "30", 10);

    // 3. 获取统计和权重调整
    const feedbackService = new FeedbackLoopService(supabase);
    const [stats, weights] = await Promise.all([
      feedbackService.getUserStats(user.id, days),
      feedbackService.getWeightAdjustments(user.id),
    ]);

    // 4. 返回结果
    return successResponse({
      stats,
      weights,
      period: {
        days,
        startDate: new Date(
          Date.now() - days * 24 * 60 * 60 * 1000,
        ).toISOString(),
        endDate: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "GET /api/classification/v3/feedback error",
    );
    return internalError("获取分类统计失败");
  }
}
