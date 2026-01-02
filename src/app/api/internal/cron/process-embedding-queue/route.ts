/**
 * 增量向量索引处理 API
 *
 * GET /api/internal/cron/process-embedding-queue
 *
 * 定期处理向量更新队列中的待处理任务
 * 建议 Cron 配置：每 5 分钟执行一次
 *
 * @version 1.0.0
 * @since 2026-01-02
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getIncrementalIndexService } from "@/lib/embedding/incremental-index.service";
import { FeatureFlags } from "@/lib/ai-agent/config/feature-flags";
import { logger } from "@/lib/logger";

// 配置
const CRON_SECRET = process.env.CRON_SECRET;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/**
 * GET /api/internal/cron/process-embedding-queue
 *
 * Headers:
 * - Authorization: Bearer <CRON_SECRET>
 *
 * Query:
 * - cleanup: 是否清理旧任务 (true/false)
 * - stats: 是否仅返回统计信息 (true/false)
 */
export async function GET(request: Request) {
  try {
    // 1. 验证授权
    const authHeader = request.headers.get("authorization");
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      logger.warn("Embedding Queue Cron: Unauthorized request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. 检查功能开关
    if (!FeatureFlags.ENABLE_RAG_MONITORING) {
      return NextResponse.json(
        { message: "Incremental indexing is disabled" },
        { status: 200 },
      );
    }

    // 3. 验证环境变量
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      logger.error("Embedding Queue Cron: Missing Supabase credentials");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    // 4. 创建服务客户端
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = getIncrementalIndexService(supabase as any);

    // 5. 解析查询参数
    const url = new URL(request.url);
    const statsOnly = url.searchParams.get("stats") === "true";
    const cleanup = url.searchParams.get("cleanup") === "true";

    // 5. 获取队列统计
    const stats = await service.getQueueStats();

    // 如果只需要统计信息
    if (statsOnly) {
      return NextResponse.json({
        success: true,
        stats,
        timestamp: new Date().toISOString(),
      });
    }

    // 6. 处理队列
    const result = await service.processQueue();

    // 7. 清理旧任务（可选）
    let cleanedUp = 0;
    if (cleanup) {
      cleanedUp = await service.cleanupOldTasks();
    }

    logger.info(
      {
        processed: result.processed,
        failed: result.failed,
        durationMs: result.durationMs,
        cleanedUp,
        pendingBefore: stats?.pending_count ?? 0,
      },
      "Embedding Queue Cron: Complete",
    );

    // 8. 返回结果
    return NextResponse.json({
      success: result.success,
      processed: result.processed,
      failed: result.failed,
      errors: result.errors.length > 0 ? result.errors : undefined,
      cleanedUp: cleanup ? cleanedUp : undefined,
      stats: {
        pendingBefore: stats?.pending_count ?? 0,
        pendingAfter: (stats?.pending_count ?? 0) - result.processed,
        failed24h: stats?.failed_count ?? 0,
      },
      durationMs: result.durationMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Embedding Queue Cron: Error",
    );

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
