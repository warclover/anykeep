/**
 * Summary Feedback API
 *
 * POST /api/summary/feedback - 提交摘要反馈
 * GET /api/summary/feedback - 获取用户反馈列表
 *
 * @version 1.0.0
 * @since 2025-12-12
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  forbiddenError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { getQualityTrackerService } from "@/lib/summary";

/**
 * 提交反馈 Schema
 */
const submitFeedbackSchema = z.object({
  /** 书签 ID */
  bookmarkId: z.number().int().positive(),
  /** 评分 (1-5) */
  rating: z.number().int().min(1).max(5),
  /** 文字反馈（可选） */
  feedback: z.string().max(500).optional(),
});

/**
 * 获取反馈 Schema
 */
const getFeedbackSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

/**
 * POST /api/summary/feedback
 * 提交摘要反馈
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

    const { bookmarkId, rating, feedback } = validation.data;

    // 3. 验证书签归属
    // 类型断言: 手动维护类型文件时需要此断言
    type BookmarkOwnerRow = { id: number; user_id: string };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bookmark, error: bookmarkError } = await (supabase.from("bookmarks") as any)
      .select("id, user_id")
      .eq("id", bookmarkId)
      .single() as { data: BookmarkOwnerRow | null; error: { message: string } | null };

    if (bookmarkError || !bookmark) {
      return internalError("书签不存在");
    }

    if (bookmark.user_id !== user.id) {
      return forbiddenError("无权操作此书签");
    }

    // 4. 记录反馈
    const qualityTracker = getQualityTrackerService(supabase);
    await qualityTracker.recordFeedback(bookmarkId, user.id, rating, feedback);

    logger.info(
      {
        userId: user.id,
        bookmarkId,
        rating,
        hasFeedback: !!feedback,
      },
      "Summary feedback submitted",
    );

    // 5. 返回成功
    return successResponse({
      success: true,
      message: "感谢您的反馈！",
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/summary/feedback error",
    );
    return internalError("提交反馈失败");
  }
}

/**
 * GET /api/summary/feedback
 * 获取用户反馈列表
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

    // 2. 解析查询参数
    const { searchParams } = new URL(request.url);
    const validation = getFeedbackSchema.safeParse({
      limit: searchParams.get("limit"),
    });

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { limit } = validation.data;

    // 3. 获取反馈列表
    const qualityTracker = getQualityTrackerService(supabase);
    const feedbacks = await qualityTracker.getUserFeedbacks(user.id, limit);

    // 4. 返回结果
    return successResponse({
      feedbacks,
      count: feedbacks.length,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "GET /api/summary/feedback error",
    );
    return internalError("获取反馈列表失败");
  }
}
