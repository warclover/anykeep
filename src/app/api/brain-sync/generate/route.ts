/**
 * Brain-Sync Flashcard 生成 API
 * POST /api/brain-sync/generate - 手动生成 Flashcards
 *
 * @module api/brain-sync/generate
 * @version 1.0.0
 * @since 2025-12-29
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-auth";
import {
  successResponse,
  unauthorizedError,
  handleValidationError,
  notFoundError,
  databaseError,
  internalError,
  badRequestError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import {
  generateFlashcards,
  filterValidFlashcards,
} from "@/lib/ai-skills/shared/review";
import type { FlashcardDifficulty } from "@/lib/ai-skills/shared/review";

/**
 * 请求体验证 Schema
 */
const generateFlashcardsSchema = z.object({
  bookmarkId: z.number().int().positive(),
  count: z.number().int().min(1).max(10).default(3),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
});

/**
 * POST /api/brain-sync/generate
 * 手动为书签生成 Flashcards
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
    const validation = generateFlashcardsSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { bookmarkId, count, difficulty } = validation.data;

    const supabase = await createClient();

    // 3. 获取书签内容
    const { data: bookmark, error: bookmarkError } = await supabase
      .from("bookmarks")
      .select("id, title, ai_summary, description, url")
      .eq("id", bookmarkId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (bookmarkError || !bookmark) {
      logger.warn(
        { bookmarkId, userId: user.id, error: bookmarkError },
        "Brain-Sync: Bookmark not found",
      );
      return notFoundError("书签不存在或无权限访问");
    }

    // 4. 检查是否有足够的内容生成 Flashcards
    const content = bookmark.ai_summary || bookmark.description || "";
    if (content.length < 50) {
      return badRequestError(
        "书签内容太短，无法生成有效的 Flashcards。请确保书签有足够的摘要或描述。",
      );
    }

    // 5. 检查已存在的 Flashcards 数量
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: existingCount } = await (supabase as any)
      .from("flashcards")
      .select("id", { count: "exact", head: true })
      .eq("bookmark_id", bookmarkId)
      .eq("user_id", user.id);

    if ((existingCount || 0) >= 10) {
      return badRequestError(
        "该书签已有 10 个 Flashcards，达到上限。请删除一些后再生成。",
      );
    }

    // 6. 生成 Flashcards
    logger.info(
      { bookmarkId, count, difficulty, userId: user.id },
      "Brain-Sync: Generating flashcards",
    );

    const generationResult = await generateFlashcards({
      title: bookmark.title,
      summary: bookmark.ai_summary || "",
      content: content,
      count: Math.min(count, 10 - (existingCount || 0)), // 不超过上限
      difficulty: difficulty as FlashcardDifficulty,
    });

    if (!generationResult.success || generationResult.flashcards.length === 0) {
      logger.warn(
        {
          bookmarkId,
          error: generationResult.error,
          userId: user.id,
        },
        "Brain-Sync: Flashcard generation failed",
      );
      return badRequestError(
        generationResult.error || "生成 Flashcards 失败，请稍后重试",
      );
    }

    // 7. 验证并过滤低质量卡片
    const validFlashcards = filterValidFlashcards(generationResult.flashcards);

    if (validFlashcards.length === 0) {
      return badRequestError(
        "生成的 Flashcards 质量不符合要求，请尝试其他难度级别",
      );
    }

    // 8. 批量插入 Flashcards
    const flashcardsToInsert = validFlashcards.map((fc) => ({
      user_id: user.id,
      bookmark_id: bookmarkId,
      question: fc.question,
      answer: fc.answer,
      source_paragraph: fc.sourceParagraph || null,
      difficulty,
      status: "pending",
      ease_factor: 2.5,
      interval_days: 1,
      repetitions: 0,
      next_review_at: new Date().toISOString(), // 立即可复习
    }));

    const { data: insertedFlashcards, error: insertError } =
      await // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase 类型推断限制
      (supabase as any)
        .from("flashcards")
        .insert(flashcardsToInsert)
        .select("id, question, answer, difficulty, status");

    if (insertError) {
      // 检查是否是重复问题
      if (insertError.code === "23505") {
        logger.warn(
          { bookmarkId, error: insertError, userId: user.id },
          "Brain-Sync: Duplicate flashcard questions",
        );
        return badRequestError(
          "部分问题已存在，请删除重复的 Flashcards 后重试",
        );
      }

      logger.error(
        { bookmarkId, error: insertError, userId: user.id },
        "Brain-Sync: Failed to insert flashcards",
      );
      return databaseError("保存 Flashcards 失败");
    }

    logger.info(
      {
        bookmarkId,
        generatedCount: validFlashcards.length,
        insertedCount: insertedFlashcards?.length,
        userId: user.id,
      },
      "Brain-Sync: Flashcards generated successfully",
    );

    return successResponse(
      {
        success: true,
        bookmarkId,
        flashcards: insertedFlashcards || [],
        message: `成功生成 ${insertedFlashcards?.length || 0} 个 Flashcards`,
      },
      201,
    );
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Brain-Sync: Generate API error",
    );
    return internalError("生成 Flashcards 失败");
  }
}
