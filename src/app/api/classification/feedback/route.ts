/**
 * 分类反馈 API
 * POST /api/classification/feedback - 提交分类反馈
 * GET /api/classification/feedback - 获取反馈统计
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/supabase";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

// 反馈类型枚举
const FEEDBACK_TYPES = [
  "wrong_folder",
  "better_folder",
  "folder_not_exist",
  "confidence_too_high",
  "confidence_too_low",
  "helpful",
  "other",
] as const;

type FeedbackType = (typeof FEEDBACK_TYPES)[number];

/**
 * 提交反馈 Schema
 */
const submitFeedbackSchema = z.object({
  feedbackType: z.enum(FEEDBACK_TYPES),
  suggestionId: z.number().int().positive().optional(),
  organizationSuggestionId: z.number().int().positive().optional(),
  comment: z.string().max(500).optional(),
  suggestedCorrectFolderId: z.number().int().positive().optional(),
  suggestedCorrectFolderName: z.string().max(100).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/classification/feedback
 * 提交分类反馈
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
    const validation = submitFeedbackSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const {
      feedbackType,
      suggestionId,
      organizationSuggestionId,
      comment,
      suggestedCorrectFolderId,
      suggestedCorrectFolderName,
      context,
    } = validation.data;

    // 3. 创建反馈记录
    const { data: feedback, error: createError } = await supabase
      .from("classification_feedback")
      .insert({
        user_id: user.id,
        feedback_type: feedbackType,
        suggestion_id: suggestionId || null,
        organization_suggestion_id: organizationSuggestionId || null,
        comment: comment || null,
        suggested_correct_folder_id: suggestedCorrectFolderId || null,
        suggested_correct_folder_name: suggestedCorrectFolderName || null,
        context: (context || {}) as Json,
      })
      .select("id")
      .single();

    if (createError) {
      logger.error(
        { error: createError, userId: user.id },
        "Failed to create feedback",
      );
      return internalError("提交反馈失败");
    }

    logger.info(
      {
        userId: user.id,
        feedbackId: feedback.id,
        feedbackType,
        suggestionId,
        organizationSuggestionId,
      },
      "Feedback submitted",
    );

    // 4. 返回成功
    return successResponse({
      feedbackId: feedback.id,
      message: "感谢您的反馈！",
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/classification/feedback error",
    );
    return internalError("提交反馈失败");
  }
}

/**
 * GET /api/classification/feedback
 * 获取用户反馈统计
 */
export async function GET() {
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

    // 2. 获取反馈统计
    const { data: feedbacks, error: fetchError } = await supabase
      .from("classification_feedback")
      .select("feedback_type")
      .eq("user_id", user.id);

    if (fetchError) {
      logger.error(
        { error: fetchError, userId: user.id },
        "Failed to fetch feedback stats",
      );
      return internalError("获取反馈统计失败");
    }

    // 3. 计算统计
    const stats: Record<FeedbackType, number> = {
      wrong_folder: 0,
      better_folder: 0,
      folder_not_exist: 0,
      confidence_too_high: 0,
      confidence_too_low: 0,
      helpful: 0,
      other: 0,
    };

    feedbacks?.forEach((f) => {
      const type = f.feedback_type as FeedbackType;
      if (type in stats) {
        stats[type]++;
      }
    });

    const total = feedbacks?.length || 0;
    const positiveCount = stats.helpful;
    const negativeCount = total - positiveCount;

    // 4. 返回统计
    return successResponse({
      total,
      positiveCount,
      negativeCount,
      byType: stats,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "GET /api/classification/feedback error",
    );
    return internalError("获取反馈统计失败");
  }
}
