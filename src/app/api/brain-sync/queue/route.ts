/**
 * Brain-Sync 复习队列 API
 * GET /api/brain-sync/queue - 获取待复习的 Flashcards
 *
 * @module api/brain-sync/queue
 * @version 1.0.0
 * @since 2025-12-29
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-auth";
import {
  successResponse,
  unauthorizedError,
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import {
  calculatePriority,
  sortByPriority,
  calculateQueueStats,
} from "@/lib/ai-skills/shared/review";
import type { ReviewQueueItem } from "@/lib/ai-skills/shared/review";
import type {
  ReviewPreferencesRow,
  PendingFlashcardRow,
} from "@/types/brain-sync";

/**
 * GET /api/brain-sync/queue
 * 获取用户的待复习 Flashcards 队列
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    const supabase = await createClient();

    // 2. 获取用户偏好设置（使用类型断言处理新表）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: preferences, error: prefError } = (await (supabase as any)
      .from("review_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single()) as {
      data: ReviewPreferencesRow | null;
      error: { code: string; message: string } | null;
    };

    // 如果没有偏好设置或功能未启用
    if (prefError && prefError.code !== "PGRST116") {
      logger.error(
        { error: prefError, userId: user.id },
        "Brain-Sync: Failed to fetch preferences",
      );
      return databaseError("获取复习偏好失败");
    }

    if (!preferences?.enabled) {
      return successResponse({
        queue: [],
        stats: {
          total: 0,
          overdue: 0,
          dueToday: 0,
          upcoming: 0,
          avgPriority: 0,
          avgEaseFactor: 0,
        },
        message: "主动复习功能未启用，请在设置中开启",
      });
    }

    // 3. 获取 URL 参数
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const _includeCompleted = searchParams.get("includeCompleted") === "true";

    // 4. 调用数据库函数获取待复习队列
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pendingFlashcards, error: queueError } = (await (
      supabase as any
    ).rpc("get_pending_flashcards", {
      p_user_id: user.id,
      p_limit: Math.min(limit, preferences.weekly_limit || 10),
      p_included_folders: preferences.included_folder_ids || null,
      p_excluded_folders: preferences.excluded_folder_ids || null,
    })) as {
      data: PendingFlashcardRow[] | null;
      error: { message: string } | null;
    };

    if (queueError) {
      logger.error(
        { error: queueError, userId: user.id },
        "Brain-Sync: Failed to fetch review queue",
      );
      return databaseError("获取复习队列失败");
    }

    // 5. 转换为 ReviewQueueItem 格式并计算优先级
    const now = new Date();
    const queueItems: ReviewQueueItem[] = (pendingFlashcards || []).map(
      (item: PendingFlashcardRow) => {
        const nextReviewAt = item.next_review_at
          ? new Date(item.next_review_at)
          : null;
        const daysOverdue = nextReviewAt
          ? Math.floor(
              (now.getTime() - nextReviewAt.getTime()) / (1000 * 60 * 60 * 24),
            )
          : 0;

        return {
          flashcardId: item.id,
          bookmarkId: item.bookmark_id,
          bookmarkTitle: item.bookmark_title,
          bookmarkUrl: item.bookmark_url,
          question: item.question,
          answer: item.answer,
          sourceParagraph: item.source_paragraph || undefined,
          status: item.status as "pending" | "learning" | "mastered",
          nextReviewAt,
          daysOverdue,
          easeFactor: item.ease_factor || 2.5,
          intervalDays: item.interval_days || 1,
          repetitions: item.repetitions || 0,
          priorityScore: 0, // 后续计算
        };
      },
    );

    // 6. 按优先级排序
    const sortedQueue = sortByPriority(queueItems);

    // 7. 计算统计信息
    const stats = calculateQueueStats(sortedQueue);

    // 8. 获取本周队列信息（如果存在）
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1); // 周一
    weekStart.setHours(0, 0, 0, 0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: weeklyQueue } = (await (supabase as any)
      .from("weekly_review_queue")
      .select("completed_ids, flashcard_ids")
      .eq("user_id", user.id)
      .eq("week_start", weekStart.toISOString().split("T")[0])
      .single()) as {
      data: {
        completed_ids: number[] | null;
        flashcard_ids: number[] | null;
      } | null;
    };

    const weeklyProgress = weeklyQueue
      ? {
          total: weeklyQueue.flashcard_ids?.length || 0,
          completed: weeklyQueue.completed_ids?.length || 0,
        }
      : null;

    logger.info(
      {
        userId: user.id,
        queueSize: sortedQueue.length,
        overdue: stats.overdue,
      },
      "Brain-Sync: Queue fetched successfully",
    );

    return successResponse({
      queue: sortedQueue.map((item) => ({
        ...item,
        priority: calculatePriority(item),
      })),
      stats,
      weeklyProgress,
      preferences: {
        enabled: preferences.enabled,
        weeklyLimit: preferences.weekly_limit,
        preferredDay: preferences.preferred_day,
        preferredTime: preferences.preferred_time,
      },
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Brain-Sync: Queue API error",
    );
    return internalError("获取复习队列失败");
  }
}
