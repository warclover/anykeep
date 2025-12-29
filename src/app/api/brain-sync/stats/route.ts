/**
 * Brain-Sync 统计数据 API
 * GET /api/brain-sync/stats - 获取复习统计数据
 *
 * @module api/brain-sync/stats
 * @version 1.0.0
 * @since 2025-12-29
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-auth";
import {
  successResponse,
  unauthorizedError,
  badRequestError,
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type { ReviewStatsResult, ReviewSessionRow } from "@/types/brain-sync";

/**
 * 有效的时间范围
 */
const VALID_TIME_RANGES = ["week", "month", "all"] as const;
type TimeRange = (typeof VALID_TIME_RANGES)[number];

/**
 * GET /api/brain-sync/stats
 * 获取复习统计数据
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const timeRange = (searchParams.get("timeRange") || "month") as TimeRange;

    if (!VALID_TIME_RANGES.includes(timeRange)) {
      return badRequestError(
        `无效的时间范围，支持: ${VALID_TIME_RANGES.join(", ")}`,
      );
    }

    const supabase = await createClient();

    // 3. 调用数据库函数获取统计（使用类型断言处理新表）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: stats, error: statsError } = (await (supabase as any).rpc(
      "get_review_stats",
      {
        p_user_id: user.id,
        p_time_range: timeRange,
      },
    )) as { data: ReviewStatsResult | null; error: { message: string } | null };

    if (statsError) {
      logger.error(
        { error: statsError, userId: user.id },
        "Brain-Sync: Failed to fetch stats",
      );
      return databaseError("获取统计数据失败");
    }

    // 4. 获取趋势数据（最近7天每日复习数）
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: dailySessions, error: trendError } = (await (supabase as any)
      .from("review_sessions")
      .select("created_at, response")
      .eq("user_id", user.id)
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: true })) as {
      data: Pick<ReviewSessionRow, "created_at" | "response">[] | null;
      error: { message: string } | null;
    };

    if (trendError) {
      logger.warn(
        { error: trendError, userId: user.id },
        "Brain-Sync: Failed to fetch trend data",
      );
    }

    // 5. 聚合每日数据
    const dailyTrend: Record<
      string,
      { total: number; mastered: number; fuzzy: number; forgotten: number }
    > = {};

    if (dailySessions) {
      for (const session of dailySessions) {
        const date = new Date(session.created_at).toISOString().split("T")[0];
        if (!dailyTrend[date]) {
          dailyTrend[date] = { total: 0, mastered: 0, fuzzy: 0, forgotten: 0 };
        }
        dailyTrend[date].total++;
        if (session.response in dailyTrend[date]) {
          dailyTrend[date][
            session.response as keyof (typeof dailyTrend)[string]
          ]++;
        }
      }
    }

    // 6. 获取连续复习天数（streak）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recentSessions } = (await (supabase as any)
      .from("review_sessions")
      .select("created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100)) as { data: Pick<ReviewSessionRow, "created_at">[] | null };

    let streakDays = 0;
    if (recentSessions && recentSessions.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const reviewDates = new Set(
        recentSessions.map(
          (s) => new Date(s.created_at).toISOString().split("T")[0],
        ),
      );

      // 从今天开始往回数连续复习天数
      const currentDate = new Date(today);
      while (reviewDates.has(currentDate.toISOString().split("T")[0])) {
        streakDays++;
        currentDate.setDate(currentDate.getDate() - 1);
      }
    }

    // 7. 计算本周进度
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: weeklyQueue } = (await (supabase as any)
      .from("weekly_review_queue")
      .select("flashcard_ids, completed_ids")
      .eq("user_id", user.id)
      .eq("week_start", weekStart.toISOString().split("T")[0])
      .single()) as {
      data: {
        flashcard_ids: number[] | null;
        completed_ids: number[] | null;
      } | null;
    };

    const weeklyProgress = weeklyQueue
      ? {
          total: weeklyQueue.flashcard_ids?.length || 0,
          completed: weeklyQueue.completed_ids?.length || 0,
          percentage: weeklyQueue.flashcard_ids?.length
            ? Math.round(
                ((weeklyQueue.completed_ids?.length || 0) /
                  weeklyQueue.flashcard_ids.length) *
                  100,
              )
            : 0,
        }
      : { total: 0, completed: 0, percentage: 0 };

    logger.info(
      {
        userId: user.id,
        timeRange,
        totalFlashcards: stats?.total_flashcards,
        streakDays,
      },
      "Brain-Sync: Stats fetched successfully",
    );

    return successResponse({
      stats: {
        totalFlashcards: stats?.total_flashcards || 0,
        masteredCount: stats?.mastered_count || 0,
        learningCount: stats?.learning_count || 0,
        pendingCount: stats?.pending_count || 0,
        masteredRate: stats?.mastered_rate || 0,
        sessionsInPeriod: stats?.sessions_in_period || 0,
        avgResponseTimeMs: stats?.avg_response_time_ms || null,
        timeRange,
      },
      trend: {
        dailyData: Object.entries(dailyTrend).map(([date, data]) => ({
          date,
          ...data,
        })),
      },
      streak: {
        currentDays: streakDays,
        message:
          streakDays > 0
            ? `已连续复习 ${streakDays} 天，继续保持！`
            : "今天开始复习，开启你的连续学习之旅！",
      },
      weeklyProgress,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Brain-Sync: Stats API error",
    );
    return internalError("获取统计数据失败");
  }
}
