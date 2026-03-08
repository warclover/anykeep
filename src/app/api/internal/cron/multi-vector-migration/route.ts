/**
 * 定时任务: 多向量数据迁移
 * V4.2 存量数据迁移 - 为缺少 title_embedding 或 tag_embedding 的书签生成向量
 *
 * Vercel Cron: 0 4 * * * (每日凌晨 4:00 运行)
 *
 * @version 1.0.0
 * @since 2025-12-12
 */

import { NextResponse } from "next/server";
import { initSupabaseAdmin } from "@/lib/supabase/admin-client";
import { logger } from "@/lib/logger";
import { createMultiVectorEmbeddingService } from "@/lib/embedding";
import {
  verifyInternalRequest,
  internalUnauthorizedResponse,
} from "@/lib/auth/internal-auth";

// 使用 Service Role Key 以绕过 RLS
const supabaseAdmin = initSupabaseAdmin();

// 每次迁移的最大书签数
const MAX_BOOKMARKS_PER_RUN = 200;
// 每批处理大小
const BATCH_SIZE = 10;

/**
 * GET /api/cron/multi-vector-migration
 * 定时迁移存量书签到多向量版本
 */
export async function GET(request: Request) {
  try {
    // Verify internal request using unified auth
    const auth = verifyInternalRequest(request);
    if (!auth.authorized) {
      return internalUnauthorizedResponse(auth.error);
    }

    logger.info("Starting multi-vector migration cron job");
    const startTime = Date.now();

    // 统计
    let totalProcessed = 0;
    let totalSuccess = 0;
    let totalFailed = 0;
    const failedIds: number[] = [];

    // 获取需要迁移的用户列表（按待迁移数量排序）
    const { data: usersWithPending, error: userError } = await supabaseAdmin
      .from("bookmarks")
      .select("user_id")
      .is("deleted_at", null)
      .or("title_embedding.is.null,tag_embedding.is.null")
      .limit(1000);

    if (userError) {
      logger.error(
        { error: userError.message },
        "MultiVector Cron: Failed to get users with pending bookmarks",
      );
      return NextResponse.json(
        { error: "Failed to get users" },
        { status: 500 },
      );
    }

    // 统计每个用户的待迁移数量
    const userPendingCounts = new Map<string, number>();
    // 类型断言: 手动维护类型文件时需要此断言
    type UserIdRow = { user_id: string };
    for (const row of (usersWithPending as UserIdRow[] | null) || []) {
      const count = userPendingCounts.get(row.user_id) || 0;
      userPendingCounts.set(row.user_id, count + 1);
    }

    // 按待迁移数量降序排列用户
    const sortedUsers = Array.from(userPendingCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([userId]) => userId);

    if (sortedUsers.length === 0) {
      logger.info("MultiVector Cron: No bookmarks need migration");
      return NextResponse.json({
        message: "No bookmarks need migration",
        totalProcessed: 0,
        totalSuccess: 0,
        totalFailed: 0,
        durationMs: Date.now() - startTime,
      });
    }

    logger.info(
      { userCount: sortedUsers.length },
      "MultiVector Cron: Found users with pending bookmarks",
    );

    // 创建服务实例
    const multiVectorService = createMultiVectorEmbeddingService(
      supabaseAdmin,
      {
        batchSize: BATCH_SIZE,
      },
    );

    // 为每个用户迁移书签（限制总量）
    let remainingQuota = MAX_BOOKMARKS_PER_RUN;

    for (const userId of sortedUsers) {
      if (remainingQuota <= 0) break;

      // 获取该用户待迁移的书签
      const userBatchSize = Math.min(remainingQuota, 50);
      const pendingBookmarks = await multiVectorService.getPendingBookmarks(
        userId,
        userBatchSize,
      );

      if (pendingBookmarks.length === 0) continue;

      logger.debug(
        { userId, count: pendingBookmarks.length },
        "MultiVector Cron: Processing user bookmarks",
      );

      // 批量迁移
      const result =
        await multiVectorService.batchUpdateBookmarkVectors(pendingBookmarks);

      totalProcessed += pendingBookmarks.length;
      totalSuccess += result.successCount;
      totalFailed += result.failedCount;
      failedIds.push(...result.failedIds);
      remainingQuota -= pendingBookmarks.length;
    }

    const durationMs = Date.now() - startTime;

    logger.info(
      {
        totalProcessed,
        totalSuccess,
        totalFailed,
        failedIdCount: failedIds.length,
        durationMs,
      },
      "MultiVector Cron: Migration completed",
    );

    return NextResponse.json({
      message: "Migration completed",
      totalProcessed,
      totalSuccess,
      totalFailed,
      failedIds: failedIds.slice(0, 20), // 只返回前20个失败ID
      durationMs,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, "MultiVector Cron: Migration failed");
    return NextResponse.json(
      { error: "Migration failed", details: errorMessage },
      { status: 500 },
    );
  }
}
