/**
 * 智能分类 v2 - 反馈处理入口
 *
 * POST /api/classification/v2/feedback - 提交反馈
 * GET /api/classification/v2/feedback - 获取统计
 *
 * 合并原有端点：
 * - /api/classification/feedback
 * - /api/classification/v2/feedback（原 v5/feedback）
 *
 * @version 2.0.0
 * @since 2026-01-24 Phase 3
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Json } from "@/types/supabase";
import { withAuthMiddleware } from "@/lib/api/middleware";

// 导入纠错缓存（v2 内化版）
import { getCorrectionCache } from "@/lib/classification-v2/infra/correction-cache";

/**
 * 反馈类型枚举
 */
const FEEDBACK_TYPES = [
  "accept", // 接受建议
  "reject", // 拒绝建议
  "modify", // 修改到其他文件夹
  "confirm", // 确认分类
  "wrong_folder", // 错误文件夹
  "better_folder", // 有更好选择
  "folder_not_exist", // 文件夹不存在
  "confidence_too_high", // 置信度过高
  "confidence_too_low", // 置信度过低
  "helpful", // 有帮助
  "other", // 其他
] as const;

/**
 * 拒绝原因枚举
 */
const REJECT_REASONS = [
  "wrong_category", // 分类错误
  "irrelevant", // 内容不相关
  "low_confidence", // 置信度太低
  "prefer_inbox", // 偏好待整理
  "other", // 其他
] as const;

/**
 * 提交反馈 Schema
 */
const feedbackSchema = z.object({
  // 必需字段
  feedbackType: z.enum(FEEDBACK_TYPES),

  // 书签信息
  bookmarkId: z.union([z.string(), z.number()]).transform(String),
  bookmarkUrl: z.string().url().optional(),

  // 建议信息（AI 给出的）
  suggestedFolderId: z
    .union([z.string(), z.number()])
    .transform(String)
    .nullable()
    .optional(),
  suggestedFolderName: z.string().max(100).nullable().optional(),
  suggestionId: z.number().int().positive().optional(),
  confidence: z.number().min(0).max(100).optional(),

  // 实际/修正信息（用户选择的）
  actualFolderId: z
    .union([z.string(), z.number()])
    .transform(String)
    .optional(),
  actualFolderName: z.string().max(100).optional(),

  // 附加信息
  comment: z.string().max(500).optional(),
  rejectReason: z.enum(REJECT_REASONS).optional(),
  traceId: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/classification/v2/feedback
 * 提交分类反馈
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const startTime = Date.now();

  const supabase = await createClient();

  // 2. 解析并验证请求体
  const body = await request.json();
  const validation = feedbackSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        error: "请求参数无效",
        details: validation.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const {
    feedbackType,
    bookmarkId,
    bookmarkUrl,
    suggestedFolderId,
    suggestedFolderName,
    suggestionId,
    confidence,
    actualFolderId,
    actualFolderName,
    comment,
    rejectReason,
    traceId,
    context,
  } = validation.data;

  // 3. 验证书签所有权
  const { data: bookmark, error: bookmarkError } = await supabase
    .from("bookmarks")
    .select("id, user_id")
    .eq("id", parseInt(bookmarkId, 10))
    .eq("user_id", userId)
    .single();

  if (bookmarkError || !bookmark) {
    return NextResponse.json(
      { success: false, error: "书签不存在或无权访问" },
      { status: 404 },
    );
  }

  // 4. 构建反馈上下文
  const feedbackContext: Record<string, unknown> = {
    ...(context || {}),
    bookmarkId,
    suggestedFolderId,
    suggestedFolderName,
    confidence,
    traceId,
    rejectReason,
  };

  // 5. 存储反馈记录
  // 映射新类型到数据库支持的类型
  const dbFeedbackType = mapFeedbackTypeToDb(feedbackType);

  const { data: feedback, error: createError } = await supabase
    .from("classification_feedback")
    .insert({
      user_id: userId,
      feedback_type: dbFeedbackType,
      suggestion_id: suggestionId || null,
      comment: comment || null,
      suggested_correct_folder_id: actualFolderId
        ? parseInt(actualFolderId, 10)
        : null,
      suggested_correct_folder_name: actualFolderName || null,
      context: feedbackContext as Json,
      folder_id: actualFolderId
        ? parseInt(actualFolderId, 10)
        : suggestedFolderId
          ? parseInt(suggestedFolderId, 10)
          : null,
    })
    .select("id")
    .single();

  if (createError) {
    logger.error(
      { error: createError.message, userId },
      "Classification v2 feedback: Failed to create record",
    );
    return NextResponse.json(
      { success: false, error: "提交反馈失败" },
      { status: 500 },
    );
  }

  // 6. 更新纠错缓存（用于后续分类优化）
  let cacheUpdated = false;
  if (bookmarkUrl && actualFolderId && actualFolderName) {
    const correctionCache = getCorrectionCache();

    if (feedbackType === "accept" || feedbackType === "confirm") {
      correctionCache.set(
        userId,
        bookmarkUrl,
        parseInt(actualFolderId, 10),
        actualFolderName,
        "user_select",
      );
      cacheUpdated = true;
    } else if (
      feedbackType === "reject" ||
      feedbackType === "modify" ||
      feedbackType === "wrong_folder"
    ) {
      correctionCache.set(
        userId,
        bookmarkUrl,
        parseInt(actualFolderId, 10),
        actualFolderName,
        "user_move",
      );
      cacheUpdated = true;
    }
  }

  const latencyMs = Date.now() - startTime;

  logger.info(
    {
      userId,
      feedbackId: feedback?.id,
      feedbackType,
      bookmarkId,
      suggestionId,
      traceId,
      cacheUpdated,
      latencyMs,
    },
    "Classification v2 feedback: Submitted",
  );

  // 7. 返回成功
  return NextResponse.json({
    success: true,
    data: {
      feedbackId: feedback?.id,
      cacheUpdated,
      message: "感谢您的反馈！",
    },
  });
});

/**
 * GET /api/classification/v2/feedback
 * 获取用户反馈统计
 */
export const GET = withAuthMiddleware(async (_request, { userId }) => {
  const supabase = await createClient();

  // 2. 获取反馈统计
  type FeedbackRow = { feedback_type: string };
  const { data: feedbacks, error: fetchError } = (await supabase
    .from("classification_feedback")
    .select("feedback_type")
    .eq("user_id", userId)) as unknown as {
    data: FeedbackRow[] | null;
    error: { message: string } | null;
  };

  if (fetchError) {
    logger.error(
      { error: fetchError, userId },
      "Classification v2 feedback: Failed to fetch stats",
    );
    return NextResponse.json(
      { success: false, error: "获取反馈统计失败" },
      { status: 500 },
    );
  }

  // 3. 计算统计
  const stats: Record<string, number> = {};
  FEEDBACK_TYPES.forEach((type) => {
    stats[type] = 0;
  });

  feedbacks?.forEach((f) => {
    const type = f.feedback_type;
    if (type in stats) {
      stats[type]++;
    }
  });

  const total = feedbacks?.length || 0;
  const positiveCount = stats.accept + stats.confirm + stats.helpful;
  const negativeCount = stats.reject + stats.wrong_folder + stats.modify;

  // 4. 返回统计
  return NextResponse.json({
    success: true,
    data: {
      total,
      positiveCount,
      negativeCount,
      neutralCount: total - positiveCount - negativeCount,
      byType: stats,
    },
  });
});

/**
 * 映射反馈类型到数据库支持的类型
 */
function mapFeedbackTypeToDb(
  feedbackType: (typeof FEEDBACK_TYPES)[number],
):
  | "wrong_folder"
  | "better_folder"
  | "folder_not_exist"
  | "confidence_too_high"
  | "confidence_too_low"
  | "helpful"
  | "other" {
  switch (feedbackType) {
    case "accept":
    case "confirm":
      return "helpful";
    case "reject":
    case "modify":
      return "wrong_folder";
    case "wrong_folder":
      return "wrong_folder";
    case "better_folder":
      return "better_folder";
    case "folder_not_exist":
      return "folder_not_exist";
    case "confidence_too_high":
      return "confidence_too_high";
    case "confidence_too_low":
      return "confidence_too_low";
    case "helpful":
      return "helpful";
    case "other":
    default:
      return "other";
  }
}
