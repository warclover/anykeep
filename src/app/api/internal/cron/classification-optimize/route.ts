/**
 * Classification Optimization Cron Job
 * V4.2 分类优化定时任务
 *
 * POST /api/cron/classification-optimize - 执行周期优化
 *
 * @description 由 Vercel Cron 或外部调度器调用
 * - 运行画像更新
 * - 执行缓存预热
 * - 清理过期数据
 *
 * @security 使用 CRON_SECRET 环境变量验证
 *
 * @version 1.0.0
 * @since 2025-12-11
 *
 * @todo 迁移到 classification-v2：
 *   - feedbackLoopService.runPeriodicOptimization → handleFeedback() 批量处理
 *   - fastPathCacheManager → classification-v2/infra/cache.ts
 */

import { createClient } from "@/lib/supabase/server";
import { successResponse, internalError } from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { feedbackLoopService } from "@/lib/classification-learning/feedback-loop";
import { fastPathCacheManager } from "@/lib/classification/router/cache-manager";
import type { NextRequest } from "next/server";
import {
  verifyInternalRequest,
  internalUnauthorizedResponse,
} from "@/lib/auth/internal-auth";

// Vercel Cron 配置
export const runtime = "nodejs";
export const maxDuration = 300; // 5 分钟超时

/**
 * POST /api/cron/classification-optimize
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 🔒 安全修复：使用统一的内部 API 认证
    const auth = verifyInternalRequest(request);
    if (!auth.authorized) {
      return internalUnauthorizedResponse(auth.error);
    }

    const supabase = await createClient();

    // 获取活跃用户列表（最近 7 天有活动）
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 类型断言: 手动维护类型文件时需要此断言
    type UserIdType = { user_id: string };
    const { data: activeUsers, error: usersError } = (await supabase
      .from("bookmarks")
      .select("user_id")
      .gte("created_at", sevenDaysAgo.toISOString())
      .limit(100)) as unknown as {
      data: UserIdType[] | null;
      error: { message: string } | null;
    };

    if (usersError) {
      throw new Error(`Failed to fetch active users: ${usersError.message}`);
    }

    // 去重用户 ID
    const uniqueUserIds = [
      ...new Set((activeUsers || []).map((u) => u.user_id)),
    ];

    logger.info(
      { userCount: uniqueUserIds.length },
      "Starting periodic optimization",
    );

    // 优化结果统计
    const results = {
      usersProcessed: 0,
      usersSkipped: 0,
      errors: [] as string[],
      cacheWarmed: 0,
    };

    // 为每个用户运行优化
    for (const userId of uniqueUserIds) {
      try {
        // 运行周期优化
        await feedbackLoopService.runPeriodicOptimization(userId);
        results.usersProcessed++;

        // 预热缓存
        await fastPathCacheManager.warmupUserCache(userId);
        results.cacheWarmed++;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        results.errors.push(`User ${userId}: ${errorMessage}`);
        results.usersSkipped++;
      }
    }

    // 全局缓存清理
    const cacheStats = fastPathCacheManager.getStats();

    const duration = Date.now() - startTime;

    logger.info(
      {
        ...results,
        duration,
        cacheHitRate: cacheStats.hitRate,
      },
      "Periodic optimization completed",
    );

    return successResponse({
      status: "completed",
      duration,
      results: {
        usersProcessed: results.usersProcessed,
        usersSkipped: results.usersSkipped,
        cacheWarmed: results.cacheWarmed,
        errorCount: results.errors.length,
      },
      cacheStats: {
        hitRate: cacheStats.hitRate,
        totalHits: cacheStats.hits,
        totalMisses: cacheStats.misses,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { error: errorMessage, duration: Date.now() - startTime },
      "Periodic optimization failed",
    );
    return internalError("优化任务执行失败");
  }
}

/**
 * GET /api/cron/classification-optimize
 * 获取优化任务状态
 *
 * @security 使用 internal auth 保护
 */
export async function GET(request: NextRequest) {
  const auth = verifyInternalRequest(request);
  if (!auth.authorized) {
    return internalUnauthorizedResponse(auth.error);
  }

  const cacheStats = fastPathCacheManager.getStats();

  return successResponse({
    status: "ready",
    cacheStats: {
      hitRate: cacheStats.hitRate,
      totalHits: cacheStats.hits,
      totalMisses: cacheStats.misses,
      size: cacheStats.size,
    },
    nextRun: "Configured via vercel.json or external scheduler",
  });
}
