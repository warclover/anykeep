/**
 * AI 快捷操作 API
 *
 * POST /api/ai/quick-actions - 执行 AI 快捷操作
 *
 * 支持的操作类型：
 * - auto-tag: 智能标签推荐
 * - auto-classify: 智能分类（文件夹推荐）
 * - extract-key: 提取关键要点
 * - rate-quality: 内容质量评估
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import { NextResponse } from "next/server";
import { executeQuickAction, QuickActionRequestSchema } from "@/lib/ai-actions";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * POST /api/ai/quick-actions
 * 执行 AI 快捷操作
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  // 解析并验证请求体
  const body = await request.json();
  const validation = QuickActionRequestSchema.safeParse(body);

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

  const { action, bookmarkId, autoApply } = validation.data;

  logger.info(
    {
      userId: userId.slice(0, 8) + "...",
      action,
      bookmarkId,
      autoApply,
    },
    "AI Quick Action: Request received",
  );

  // 执行快捷操作
  const result = await executeQuickAction(userId, {
    action,
    bookmarkId,
    autoApply,
  });

  logger.info(
    {
      userId: userId.slice(0, 8) + "...",
      action,
      bookmarkId,
      success: result.success,
      durationMs: result.success ? result.durationMs : undefined,
    },
    "AI Quick Action: Request completed",
  );

  // 返回结果
  return NextResponse.json(result, {
    status: result.success ? 200 : 400,
  });
});
