/**
 * Multi-Vector Migration API
 * V4.2 存量数据多向量迁移接口
 *
 * @description
 * 为用户存量书签生成多向量表征（title_embedding, tag_embedding）
 *
 * POST: 开始迁移任务
 * GET: 获取迁移状态/待迁移数量
 *
 * @version 1.0.0
 * @since 2025-12-12
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createMultiVectorEmbeddingService } from "@/lib/embedding";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

interface MigrationStatusResponse {
  /** 待迁移书签数量 */
  pendingCount: number;
  /** 已迁移书签数量 */
  migratedCount: number;
  /** 总书签数量 */
  totalCount: number;
  /** 迁移进度百分比 */
  progress: number;
}

interface MigrationResult {
  /** 成功迁移数量 */
  successCount: number;
  /** 失败数量 */
  failedCount: number;
  /** 失败的书签 ID */
  failedIds: number[];
  /** 耗时 (ms) */
  durationMs: number;
}

// ============================================================================
// GET - 获取迁移状态
// ============================================================================

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 获取待迁移数量
    const { count: pendingCount } = await supabase
      .from("bookmarks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .or("title_embedding.is.null,tag_embedding.is.null");

    // 获取已迁移数量
    const { count: migratedCount } = await supabase
      .from("bookmarks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .not("title_embedding", "is", null)
      .not("tag_embedding", "is", null);

    // 获取总数
    const { count: totalCount } = await supabase
      .from("bookmarks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("deleted_at", null);

    const pending = pendingCount ?? 0;
    const migrated = migratedCount ?? 0;
    const total = totalCount ?? 0;

    const response: MigrationStatusResponse = {
      pendingCount: pending,
      migratedCount: migrated,
      totalCount: total,
      progress: total > 0 ? Math.round((migrated / total) * 100) : 100,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Migration API: Failed to get status",
    );
    return NextResponse.json(
      { error: "Failed to get migration status" },
      { status: 500 },
    );
  }
}

// ============================================================================
// POST - 开始迁移
// ============================================================================

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 解析请求参数
    const body = await request.json().catch(() => ({}));
    const batchSize = Math.min(Math.max(body.batchSize ?? 50, 1), 100);

    const startTime = Date.now();

    // 创建服务实例
    const multiVectorService = createMultiVectorEmbeddingService(supabase, {
      batchSize: 10, // 内部批处理大小
    });

    // 获取待迁移书签
    const pendingBookmarks = await multiVectorService.getPendingBookmarks(
      user.id,
      batchSize,
    );

    if (pendingBookmarks.length === 0) {
      return NextResponse.json({
        message: "No bookmarks need migration",
        successCount: 0,
        failedCount: 0,
        failedIds: [],
        durationMs: Date.now() - startTime,
      });
    }

    // 执行批量迁移
    const result =
      await multiVectorService.batchUpdateBookmarkVectors(pendingBookmarks);

    const durationMs = Date.now() - startTime;

    logger.info(
      {
        userId: user.id,
        requested: batchSize,
        processed: pendingBookmarks.length,
        success: result.successCount,
        failed: result.failedCount,
        durationMs,
      },
      "Migration API: Batch migration completed",
    );

    const response: MigrationResult = {
      successCount: result.successCount,
      failedCount: result.failedCount,
      failedIds: result.failedIds,
      durationMs,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Migration API: Failed to migrate",
    );
    return NextResponse.json(
      { error: "Failed to migrate bookmarks" },
      { status: 500 },
    );
  }
}
