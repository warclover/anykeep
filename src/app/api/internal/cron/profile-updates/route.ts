/**
 * Profile Updates Cron API
 * POST /api/cron/profile-updates - 定时更新来源画像
 *
 * @description Vercel Cron 兼容的 API 端点
 * - 查找活跃用户（最近有书签活动的用户）
 * - 为每个用户运行画像更新任务
 * - 支持 Cron 认证头验证
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { profileUpdater } from "@/lib/classification/learning/profile-updater";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * Vercel Cron 认证密钥
 * 在 vercel.json 中配置 cron 任务时会自动发送此 header
 */
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * 活跃用户天数阈值（最近 N 天有活动的用户）
 */
const ACTIVE_USER_DAYS = 7;

/**
 * 每次 Cron 执行的最大用户数（避免超时）
 */
const MAX_USERS_PER_RUN = 10;

/**
 * POST /api/cron/profile-updates
 * 执行定时画像更新任务
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 验证 Cron 认证（生产环境）
    if (process.env.NODE_ENV === "production" && CRON_SECRET) {
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        logger.warn("Cron profile-updates: Invalid authorization");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const supabase = await createClient();

    // 查找活跃用户（最近 N 天有书签活动的用户）
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ACTIVE_USER_DAYS);

    const { data: activeUsers, error: queryError } = await supabase
      .from("bookmarks")
      .select("user_id")
      .gte("created_at", cutoffDate.toISOString())
      .is("deleted_at", null)
      .limit(100);

    if (queryError) {
      logger.error(
        { error: queryError.message },
        "Cron profile-updates: Failed to query active users",
      );
      return NextResponse.json(
        { error: "Failed to query active users" },
        { status: 500 },
      );
    }

    // 去重用户 ID
    const uniqueUserIds = [
      ...new Set(activeUsers?.map((b) => b.user_id) || []),
    ];

    // 限制每次执行的用户数
    const usersToProcess = uniqueUserIds.slice(0, MAX_USERS_PER_RUN);

    logger.info(
      {
        totalActiveUsers: uniqueUserIds.length,
        processingUsers: usersToProcess.length,
        cutoffDate: cutoffDate.toISOString(),
      },
      "Cron profile-updates: Starting profile updates",
    );

    // 为每个用户运行画像更新
    const results: Array<{
      userId: string;
      success: boolean;
      taskResults?: number;
      error?: string;
    }> = [];

    for (const userId of usersToProcess) {
      try {
        const taskResults = await profileUpdater.runFullUpdate(userId);
        results.push({
          userId,
          success: true,
          taskResults: taskResults.length,
        });

        logger.debug(
          { userId, taskResults: taskResults.length },
          "Cron profile-updates: User update completed",
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        results.push({
          userId,
          success: false,
          error: errorMessage,
        });

        logger.error(
          { userId, error: errorMessage },
          "Cron profile-updates: User update failed",
        );
      }
    }

    const duration = Date.now() - startTime;
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    logger.info(
      {
        duration,
        totalUsers: usersToProcess.length,
        successCount,
        failCount,
      },
      "Cron profile-updates: Completed",
    );

    return NextResponse.json({
      success: true,
      message: `Profile updates completed for ${successCount}/${usersToProcess.length} users`,
      duration,
      stats: {
        totalActiveUsers: uniqueUserIds.length,
        processedUsers: usersToProcess.length,
        successCount,
        failCount,
      },
      results,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { error: errorMessage },
      "Cron profile-updates: Unexpected error",
    );

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: errorMessage,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/cron/profile-updates
 * 获取 Cron 任务状态（用于健康检查）
 */
export async function GET() {
  return NextResponse.json({
    status: "ready",
    endpoint: "/api/cron/profile-updates",
    description: "Profile updates cron job endpoint",
    config: {
      activeUserDays: ACTIVE_USER_DAYS,
      maxUsersPerRun: MAX_USERS_PER_RUN,
    },
  });
}
