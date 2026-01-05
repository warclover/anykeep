/**
 * Brain-Sync 从报告生成 Flashcard API
 * POST /api/brain-sync/generate-from-report - 从合成报告生成 Flashcards
 *
 * @module api/brain-sync/generate-from-report
 * @version 1.0.0
 * @since 2026-01-05
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { getCachedUser } from "@/lib/supabase/cached-auth";
import {
  successResponse,
  unauthorizedError,
  handleValidationError,
  badRequestError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { generateFlashcardsV2 } from "@/lib/ai-skills/shared/review";

/**
 * 请求体验证 Schema
 */
const generateFromReportSchema = z.object({
  reportId: z.string().min(1),
  content: z.string().min(50, "报告内容太短，至少需要 50 个字符"),
  bookmarkIds: z.array(z.string()).optional().default([]),
  maxPerParagraph: z.number().int().min(1).max(5).default(3),
});

/**
 * POST /api/brain-sync/generate-from-report
 * 从合成报告生成 Flashcards（仅生成预览，不保存）
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = generateFromReportSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { reportId, content, maxPerParagraph } = validation.data;

    // 3. 从报告内容生成 Flashcards
    logger.info(
      { reportId, contentLength: content.length, userId: user.id },
      "Brain-Sync: Generating flashcards from report",
    );

    // 提取报告标题（从第一行或前 100 字）
    const titleMatch = content.match(/^#\s*(.+)$/m);
    const title = titleMatch?.[1] || content.slice(0, 100).split("\n")[0];

    // 使用 v2 深度问题生成
    const generationResult = await generateFlashcardsV2({
      title,
      summary: content.slice(0, 500),
      content,
      count: maxPerParagraph,
      difficulty: "medium",
    });

    if (!generationResult.success || generationResult.flashcards.length === 0) {
      logger.warn(
        {
          reportId,
          error: generationResult.error,
          userId: user.id,
        },
        "Brain-Sync: Report flashcard generation failed",
      );
      return badRequestError(
        generationResult.error || "生成 Flashcards 失败，请稍后重试",
      );
    }

    logger.info(
      {
        reportId,
        generatedCount: generationResult.flashcards.length,
        userId: user.id,
      },
      "Brain-Sync: Report flashcards generated successfully",
    );

    return successResponse({
      success: true,
      flashcards: generationResult.flashcards,
      message: `成功生成 ${generationResult.flashcards.length} 个深度复习卡片预览`,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Brain-Sync: Generate from report API error",
    );
    return internalError("生成 Flashcards 失败");
  }
}
