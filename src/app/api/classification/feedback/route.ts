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

// V4.0 导入纠错缓存
import { getCorrectionCache } from "@/lib/classification/services/advanced";

// 反馈类型枚举
const FEEDBACK_TYPES = [
  "wrong_folder",
  "better_folder",
  "folder_not_exist",
  "confidence_too_high",
  "confidence_too_low",
  "helpful",
  "reject", // V4.0: 明确拒绝
  "confirm", // V4.0: 确认分类
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

  // V4.0 拒绝机制扩展
  bookmarkId: z.number().int().positive().optional(),
  bookmarkUrl: z.string().url().optional(),
  originalFolderId: z.number().int().positive().nullable().optional(),
  originalFolderName: z.string().max(100).optional(),
  originalConfidence: z.number().min(0).max(100).optional(),
  traceId: z.string().optional(),
  rejectReason: z
    .enum([
      "wrong_category", // 分类错误
      "irrelevant", // 内容不相关
      "low_confidence", // 置信度太低
      "prefer_inbox", // 偏好待整理
      "other", // 其他
    ])
    .optional(),
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
      // V4.0 拒绝机制扩展
      bookmarkId,
      bookmarkUrl,
      originalFolderId,
      originalFolderName,
      originalConfidence,
      traceId,
      rejectReason,
    } = validation.data;

    // 3. 创建反馈记录
    const feedbackContext: Record<string, unknown> = {
      ...(context || {}),
      // V4.0 扩展字段
      bookmarkId,
      originalFolderId,
      originalFolderName,
      originalConfidence,
      traceId,
      rejectReason,
    };

    // Note: feedbackType 包含 V4.0 新增类型 (reject, confirm)
    // 数据库迁移会添加这些枚举值，这里使用类型断言确保编译通过
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: feedback, error: createError } = await (supabase
      .from("classification_feedback") as any)
      .insert({
        user_id: user.id,
        feedback_type: feedbackType as
          | "wrong_folder"
          | "better_folder"
          | "folder_not_exist"
          | "confidence_too_high"
          | "confidence_too_low"
          | "helpful"
          | "other",
        suggestion_id: suggestionId || null,
        organization_suggestion_id: organizationSuggestionId || null,
        comment: comment || null,
        suggested_correct_folder_id: suggestedCorrectFolderId || null,
        suggested_correct_folder_name: suggestedCorrectFolderName || null,
        context: feedbackContext as Json,
        // V4.0: 扩展字段（如果表支持）
        folder_id: suggestedCorrectFolderId || originalFolderId || null,
      })
      .select("id")
      .single() as { data: { id: number } | null; error: { message: string } | null };

    if (createError) {
      logger.error(
        { error: createError, userId: user.id },
        "Failed to create feedback",
      );
      return internalError("提交反馈失败");
    }

    if (!feedback) {
      return internalError("创建反馈记录失败");
    }

    // V4.0: 处理确认/拒绝反馈 - 更新纠错缓存
    if (bookmarkUrl) {
      const correctionCache = getCorrectionCache();

      if (
        feedbackType === "confirm" &&
        suggestedCorrectFolderId &&
        suggestedCorrectFolderName
      ) {
        // 确认分类 -> 添加到纠错缓存（来源：用户选择）
        correctionCache.set(
          user.id,
          bookmarkUrl,
          suggestedCorrectFolderId,
          suggestedCorrectFolderName,
          "user_select",
        );

        logger.info(
          {
            userId: user.id,
            bookmarkUrl,
            folderId: suggestedCorrectFolderId,
            folderName: suggestedCorrectFolderName,
          },
          "Correction cache updated (confirm)",
        );
      } else if (feedbackType === "reject" || feedbackType === "wrong_folder") {
        // 拒绝/错误分类 -> 如果有正确文件夹，添加到缓存（来源：用户移动）
        if (suggestedCorrectFolderId && suggestedCorrectFolderName) {
          correctionCache.set(
            user.id,
            bookmarkUrl,
            suggestedCorrectFolderId,
            suggestedCorrectFolderName,
            "user_move",
          );

          logger.info(
            {
              userId: user.id,
              bookmarkUrl,
              originalFolderId,
              correctedFolderId: suggestedCorrectFolderId,
              correctedFolderName: suggestedCorrectFolderName,
            },
            "Correction cache updated (reject with correction)",
          );
        }
      }
    }

    logger.info(
      {
        userId: user.id,
        feedbackId: feedback.id,
        feedbackType,
        suggestionId,
        organizationSuggestionId,
        traceId,
        rejectReason,
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
    // 类型断言: 手动维护类型文件时需要此断言
    type FeedbackRow = { feedback_type: string };
    const { data: feedbacks, error: fetchError } = await supabase
      .from("classification_feedback")
      .select("feedback_type")
      .eq("user_id", user.id) as unknown as {
      data: FeedbackRow[] | null;
      error: { message: string } | null;
    };

    if (fetchError) {
      logger.error(
        { error: fetchError, userId: user.id },
        "Failed to fetch feedback stats",
      );
      return internalError("获取反馈统计失败");
    }

    // 3. 计算统计（包含 V4.0 新增类型）
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
