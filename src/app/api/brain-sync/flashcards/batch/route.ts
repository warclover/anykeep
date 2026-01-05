/**
 * Brain-Sync Flashcards 批量操作 API
 * POST /api/brain-sync/flashcards/batch - 批量创建 Flashcards
 *
 * @module api/brain-sync/flashcards/batch
 * @version 1.0.0
 * @since 2026-01-05
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-auth";
import {
  successResponse,
  unauthorizedError,
  handleValidationError,
  databaseError,
  internalError,
  badRequestError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

/**
 * Flashcard 插入数据验证 Schema
 */
const flashcardInsertSchema = z.object({
  bookmark_id: z.number().int().positive(),
  question: z.string().min(10, "问题至少需要 10 个字符"),
  answer: z.string().optional().default(""),
  source_paragraph: z.string().optional(),
  question_depth: z
    .enum(["understand", "apply", "analyze", "evaluate"])
    .optional(),
  thinking_hint: z.string().optional(),
  key_points: z.array(z.string()).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional().default("medium"),
});

/**
 * 批量创建请求体验证 Schema
 */
const batchCreateSchema = z.object({
  flashcards: z
    .array(flashcardInsertSchema)
    .min(1, "至少需要一个 Flashcard")
    .max(20, "单次最多创建 20 个 Flashcards"),
});

/**
 * POST /api/brain-sync/flashcards/batch
 * 批量创建 Flashcards
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
    const validation = batchCreateSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { flashcards } = validation.data;

    const supabase = await createClient();

    // 3. 验证书签所有权
    const bookmarkIds = [...new Set(flashcards.map((fc) => fc.bookmark_id))];

    const { data: ownedBookmarks, error: bookmarkError } = await supabase
      .from("bookmarks")
      .select("id")
      .in("id", bookmarkIds)
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (bookmarkError) {
      logger.error(
        { error: bookmarkError, userId: user.id },
        "Brain-Sync: Failed to verify bookmark ownership",
      );
      return databaseError("验证书签权限失败");
    }

    const ownedBookmarkIds = new Set(ownedBookmarks?.map((b) => b.id) || []);
    const unauthorizedBookmarks = bookmarkIds.filter(
      (id) => !ownedBookmarkIds.has(id),
    );

    if (unauthorizedBookmarks.length > 0) {
      return badRequestError(
        `无权访问以下书签: ${unauthorizedBookmarks.join(", ")}`,
      );
    }

    // 4. 批量插入 Flashcards
    const flashcardsToInsert = flashcards.map((fc) => ({
      user_id: user.id,
      bookmark_id: fc.bookmark_id,
      question: fc.question,
      answer: fc.answer || "",
      source_paragraph: fc.source_paragraph || null,
      difficulty: fc.difficulty || "medium",
      status: "pending",
      ease_factor: 2.5,
      interval_days: 1,
      repetitions: 0,
      next_review_at: new Date().toISOString(),
      // v2 字段
      question_depth: fc.question_depth || null,
      thinking_hint: fc.thinking_hint || null,
      key_points: fc.key_points || null,
    }));

    logger.info(
      { count: flashcardsToInsert.length, userId: user.id },
      "Brain-Sync: Batch inserting flashcards",
    );

    const { data: insertedFlashcards, error: insertError } =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("flashcards")
        .insert(flashcardsToInsert)
        .select("id, question, question_depth, difficulty, status");

    if (insertError) {
      // 检查是否是重复问题
      if (insertError.code === "23505") {
        logger.warn(
          { error: insertError, userId: user.id },
          "Brain-Sync: Duplicate flashcard questions in batch",
        );
        return badRequestError(
          "部分问题已存在，请删除重复的 Flashcards 后重试",
        );
      }

      logger.error(
        { error: insertError, userId: user.id },
        "Brain-Sync: Failed to batch insert flashcards",
      );
      return databaseError("批量创建 Flashcards 失败");
    }

    const insertedCount = insertedFlashcards?.length || 0;
    const flashcardIds =
      insertedFlashcards?.map((fc: { id: number }) => fc.id) || [];

    logger.info(
      {
        requestedCount: flashcards.length,
        insertedCount,
        userId: user.id,
      },
      "Brain-Sync: Batch flashcards created successfully",
    );

    return successResponse(
      {
        success: true,
        insertedCount,
        flashcardIds,
        message: `成功创建 ${insertedCount} 个 Flashcards`,
      },
      201,
    );
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Brain-Sync: Batch create API error",
    );
    return internalError("批量创建 Flashcards 失败");
  }
}
