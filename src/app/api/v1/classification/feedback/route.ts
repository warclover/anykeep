/**
 * Classification Feedback API v1
 *
 * GET  /api/v1/classification/feedback - 获取反馈统计
 * POST /api/v1/classification/feedback - 提交分类反馈
 *
 * @module api/v1/classification/feedback
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";
import type { Json } from "@/types/supabase";
import { getCorrectionCache } from "@/lib/classification/services/advanced";

// 反馈类型
const FEEDBACK_TYPES = [
  "wrong_folder",
  "better_folder",
  "folder_not_exist",
  "confidence_too_high",
  "confidence_too_low",
  "helpful",
  "reject",
  "confirm",
  "other",
] as const;

type FeedbackType = (typeof FEEDBACK_TYPES)[number];

// 提交反馈 Schema
const SubmitFeedbackSchema = z.object({
  feedbackType: z.enum(FEEDBACK_TYPES),
  suggestionId: z.number().int().positive().optional(),
  comment: z.string().max(500).optional(),
  suggestedCorrectFolderId: z.number().int().positive().optional(),
  suggestedCorrectFolderName: z.string().max(100).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  bookmarkId: z.number().int().positive().optional(),
  bookmarkUrl: z.string().url().optional(),
  originalFolderId: z.number().int().positive().nullable().optional(),
  originalFolderName: z.string().max(100).optional(),
  originalConfidence: z.number().min(0).max(100).optional(),
  rejectReason: z
    .enum([
      "wrong_category",
      "irrelevant",
      "low_confidence",
      "prefer_inbox",
      "other",
    ])
    .optional(),
});

/**
 * GET /api/v1/classification/feedback
 * 获取反馈统计
 */
export const GET = withAuthMiddleware(async (_request, { userId }) => {
  const supabase = await createClient();

  // 类型断言: 手动维护类型文件时需要此断言
  type FeedbackRow = { feedback_type: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: feedbacks, error: fetchError } = await (supabase.from("classification_feedback") as any)
    .select("feedback_type")
    .eq("user_id", userId) as { data: FeedbackRow[] | null; error: { message: string } | null };

  if (fetchError) {
    logger.error(
      { error: fetchError, userId },
      "[v1] Failed to fetch feedback stats",
    );
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "获取反馈统计失败" },
      },
      { status: 500 },
    );
  }

  // 计算统计
  const stats: Record<FeedbackType, number> = {
    wrong_folder: 0,
    better_folder: 0,
    folder_not_exist: 0,
    confidence_too_high: 0,
    confidence_too_low: 0,
    helpful: 0,
    reject: 0,
    confirm: 0,
    other: 0,
  };

  feedbacks?.forEach((f) => {
    const type = f.feedback_type as FeedbackType;
    if (type in stats) stats[type]++;
  });

  const total = feedbacks?.length || 0;
  const positiveCount = stats.helpful + stats.confirm;
  const negativeCount = stats.wrong_folder + stats.reject;

  return NextResponse.json({
    success: true,
    data: {
      total,
      positiveCount,
      negativeCount,
      byType: stats,
    },
  });
});

/**
 * POST /api/v1/classification/feedback
 * 提交分类反馈
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();

    // 解析请求体
    const body = await request.json();
    const validation = SubmitFeedbackSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "请求参数验证失败",
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 },
      );
    }

    const {
      feedbackType,
      suggestionId,
      comment,
      suggestedCorrectFolderId,
      suggestedCorrectFolderName,
      context,
      bookmarkId,
      bookmarkUrl,
      originalFolderId,
      originalFolderName,
      originalConfidence,
      rejectReason,
    } = validation.data;

    // 创建反馈记录
    const feedbackContext: Record<string, unknown> = {
      ...(context || {}),
      bookmarkId,
      originalFolderId,
      originalFolderName,
      originalConfidence,
      rejectReason,
    };

    // 类型断言: 手动维护类型文件时需要此断言
    type FeedbackInsertRow = { id: number };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: feedback, error: createError } = await (supabase.from("classification_feedback") as any)
      .insert({
        user_id: userId,
        feedback_type: feedbackType as
          | "wrong_folder"
          | "better_folder"
          | "folder_not_exist"
          | "confidence_too_high"
          | "confidence_too_low"
          | "helpful"
          | "other",
        suggestion_id: suggestionId || null,
        comment: comment || null,
        suggested_correct_folder_id: suggestedCorrectFolderId || null,
        suggested_correct_folder_name: suggestedCorrectFolderName || null,
        context: feedbackContext as Json,
        folder_id: suggestedCorrectFolderId || originalFolderId || null,
      })
      .select("id")
      .single() as { data: FeedbackInsertRow | null; error: { message: string } | null };

    if (createError || !feedback) {
      logger.error(
        { error: createError, userId },
        "[v1] Failed to create feedback",
      );
      return NextResponse.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "提交反馈失败" },
        },
        { status: 500 },
      );
    }

    // 更新纠错缓存
    if (bookmarkUrl) {
      const correctionCache = getCorrectionCache();

      if (
        feedbackType === "confirm" &&
        suggestedCorrectFolderId &&
        suggestedCorrectFolderName
      ) {
        correctionCache.set(
          userId,
          bookmarkUrl,
          suggestedCorrectFolderId,
          suggestedCorrectFolderName,
          "user_select",
        );
      } else if (
        (feedbackType === "reject" || feedbackType === "wrong_folder") &&
        suggestedCorrectFolderId &&
        suggestedCorrectFolderName
      ) {
        correctionCache.set(
          userId,
          bookmarkUrl,
          suggestedCorrectFolderId,
          suggestedCorrectFolderName,
          "user_move",
        );
      }
    }

    logger.info(
      { userId, feedbackId: feedback.id, feedbackType },
      "[v1] Feedback submitted",
    );

    return NextResponse.json({
      success: true,
      data: {
        feedbackId: feedback.id,
        message: "感谢您的反馈！",
      },
    });
  },
);
