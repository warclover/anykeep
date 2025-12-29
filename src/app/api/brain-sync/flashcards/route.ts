/**
 * Brain-Sync Flashcards 管理 API
 * GET /api/brain-sync/flashcards - 获取 Flashcards 列表
 * DELETE /api/brain-sync/flashcards - 批量删除 Flashcards
 *
 * @module api/brain-sync/flashcards
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
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type { FlashcardWithBookmark } from "@/types/brain-sync";

/**
 * GET /api/brain-sync/flashcards
 * 获取用户的 Flashcards 列表
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const bookmarkId = searchParams.get("bookmarkId");
    const status = searchParams.get("status"); // pending, learning, mastered
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const supabase = await createClient();

    // 3. 构建查询（使用类型断言处理新表）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("flashcards")
      .select(
        `
        id,
        bookmark_id,
        question,
        answer,
        source_paragraph,
        status,
        difficulty,
        ease_factor,
        interval_days,
        repetitions,
        next_review_at,
        last_reviewed_at,
        created_at,
        bookmarks!inner(id, title, url)
      `,
        { count: "exact" },
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // 可选筛选
    if (bookmarkId) {
      query = query.eq("bookmark_id", parseInt(bookmarkId, 10));
    }
    if (status && ["pending", "learning", "mastered"].includes(status)) {
      query = query.eq("status", status);
    }

    // 4. 执行查询
    const { data: flashcards, error: queryError, count } = await query;

    if (queryError) {
      logger.error(
        { error: queryError, userId: user.id },
        "Brain-Sync: Failed to fetch flashcards",
      );
      return databaseError("获取 Flashcards 失败");
    }

    // 5. 格式化响应
    const typedFlashcards = flashcards as FlashcardWithBookmark[] | null;
    const formattedFlashcards = (typedFlashcards || []).map((fc) => ({
      id: fc.id,
      bookmarkId: fc.bookmark_id,
      bookmarkTitle: fc.bookmarks?.title || "",
      bookmarkUrl: fc.bookmarks?.url || "",
      question: fc.question,
      answer: fc.answer,
      sourceParagraph: fc.source_paragraph,
      status: fc.status,
      difficulty: fc.difficulty,
      easeFactor: fc.ease_factor,
      intervalDays: fc.interval_days,
      repetitions: fc.repetitions,
      nextReviewAt: fc.next_review_at,
      lastReviewedAt: fc.last_reviewed_at,
      createdAt: fc.created_at,
    }));

    logger.info(
      {
        userId: user.id,
        count: typedFlashcards?.length,
        totalCount: count,
      },
      "Brain-Sync: Flashcards fetched",
    );

    return successResponse({
      flashcards: formattedFlashcards,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: offset + limit < (count || 0),
      },
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Brain-Sync: Get flashcards error",
    );
    return internalError("获取 Flashcards 失败");
  }
}

/**
 * 删除请求体验证 Schema
 */
const deleteFlashcardsSchema = z.object({
  flashcardIds: z.array(z.number().int().positive()).min(1).max(100),
});

/**
 * DELETE /api/brain-sync/flashcards
 * 批量删除 Flashcards
 */
export async function DELETE(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = deleteFlashcardsSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { flashcardIds } = validation.data;

    const supabase = await createClient();

    // 3. 删除 Flashcards（RLS 确保只能删除自己的）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError, count } = await (supabase as any)
      .from("flashcards")
      .delete({ count: "exact" })
      .in("id", flashcardIds)
      .eq("user_id", user.id);

    if (deleteError) {
      logger.error(
        { error: deleteError, flashcardIds, userId: user.id },
        "Brain-Sync: Failed to delete flashcards",
      );
      return databaseError("删除 Flashcards 失败");
    }

    logger.info(
      {
        userId: user.id,
        requestedCount: flashcardIds.length,
        deletedCount: count,
      },
      "Brain-Sync: Flashcards deleted",
    );

    return successResponse({
      success: true,
      deletedCount: count || 0,
      message: `成功删除 ${count || 0} 个 Flashcards`,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Brain-Sync: Delete flashcards error",
    );
    return internalError("删除 Flashcards 失败");
  }
}
