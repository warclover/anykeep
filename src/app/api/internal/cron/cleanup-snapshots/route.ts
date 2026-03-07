/**
 * Snapshot Cleanup Cron Job (V4.2.1)
 * 快照清理定时任务
 *
 * POST /api/cron/cleanup-snapshots - 执行过期快照清理
 *
 * @description 由 Vercel Cron 每日调用
 * - 清理过期的快照记录 (expires_at < NOW())
 * - 删除关联的 Storage 文件
 * - 更新 bookmarks 表的快照状态
 *
 * @security 使用 CRON_SECRET 环境变量验证
 *
 * @version 1.0.0
 * @since 2025-12-12
 */

import { getSupabaseAdmin } from "@/lib/supabase/admin-client";
import { successResponse, internalError } from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type { NextRequest } from "next/server";
import {
  verifyInternalRequest,
  internalUnauthorizedResponse,
} from "@/lib/auth/internal-auth";

// Vercel Cron 配置
export const runtime = "nodejs";
export const maxDuration = 300; // 5 分钟超时

// 每批处理的数量
const BATCH_SIZE = 50;

// 快照记录类型（数据库尚未同步到类型文件）
interface ExpiredSnapshot {
  id: number;
  bookmark_id: number;
  user_id: string;
  storage_path: string | null;
  html_storage_path: string | null;
  screenshot_storage_path: string | null;
}

/**
 * POST /api/cron/cleanup-snapshots
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 🔒 安全修复：使用统一的内部 API 认证
    const auth = verifyInternalRequest(request);
    if (!auth.authorized) {
      return internalUnauthorizedResponse(auth.error);
    }

    const admin = getSupabaseAdmin();

    logger.info("[Snapshot Cleanup] Starting expired snapshot cleanup");

    // 统计结果
    const results = {
      expiredFound: 0,
      recordsDeleted: 0,
      filesDeleted: 0,
      bookmarksUpdated: 0,
      errors: [] as string[],
    };

    // 查找过期的快照（使用类型断言绕过类型检查）
    const { data: expiredSnapshots, error: queryError } = await admin
      .from("bookmark_snapshots")
      .select(
        "id, bookmark_id, user_id, storage_path, html_storage_path, screenshot_storage_path",
      )
      .eq("status", "completed")
      .not("expires_at", "is", null)
      .lt("expires_at", new Date().toISOString())
      .limit(BATCH_SIZE);

    if (queryError) {
      throw new Error(
        `Failed to query expired snapshots: ${queryError.message}`,
      );
    }

    const snapshots = expiredSnapshots as ExpiredSnapshot[] | null;
    results.expiredFound = snapshots?.length ?? 0;

    if (!snapshots || snapshots.length === 0) {
      logger.info("[Snapshot Cleanup] No expired snapshots found");
      return successResponse({
        message: "No expired snapshots to clean up",
        ...results,
        duration: Date.now() - startTime,
      });
    }

    logger.info(
      { count: results.expiredFound },
      "[Snapshot Cleanup] Found expired snapshots",
    );

    // 批量处理过期快照（从 N+1 优化为 3 次批量操作）

    // 1. 批量删除 Storage 文件（所有路径合并为一次调用）
    const allStoragePaths = snapshots.flatMap((s) =>
      [s.storage_path, s.html_storage_path, s.screenshot_storage_path].filter(
        Boolean,
      ),
    ) as string[];

    if (allStoragePaths.length > 0) {
      const { error: storageError } = await admin.storage
        .from("snapshots")
        .remove(allStoragePaths);

      if (storageError) {
        logger.warn(
          { error: storageError.message, pathCount: allStoragePaths.length },
          "[Snapshot Cleanup] Failed to batch-delete storage files",
        );
      } else {
        results.filesDeleted = allStoragePaths.length;
      }
    }

    // 2. 批量删除快照记录（一次 .in() 替代 N 次逐条删除）
    const snapshotIds = snapshots.map((s) => s.id);
    const { error: deleteError } = await admin
      .from("bookmark_snapshots")
      .delete()
      .in("id", snapshotIds);

    if (deleteError) {
      results.errors.push(`Batch delete snapshots: ${deleteError.message}`);
      logger.error(
        { error: deleteError.message, snapshotIds },
        "[Snapshot Cleanup] Failed to batch-delete snapshot records",
      );
    } else {
      results.recordsDeleted = snapshotIds.length;
    }

    // 3. 批量更新 bookmark 状态（一次 .in() 替代 N 次逐条更新）
    const bookmarkIds = snapshots.map((s) => s.bookmark_id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (admin as any)
      .from("bookmarks")
      .update({
        has_snapshot: false,
        snapshot_status: null,
        last_snapshot_at: null,
      })
      .in("id", bookmarkIds);

    if (updateError) {
      logger.warn(
        { error: updateError.message, bookmarkIds },
        "[Snapshot Cleanup] Failed to batch-update bookmark statuses",
      );
    } else {
      results.bookmarksUpdated = bookmarkIds.length;
    }

    const duration = Date.now() - startTime;

    logger.info(
      { ...results, duration },
      "[Snapshot Cleanup] Cleanup completed",
    );

    return successResponse({
      message: "Snapshot cleanup completed",
      ...results,
      duration,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error: message }, "[Snapshot Cleanup] Cron job failed");
    return internalError(message);
  }
}

/**
 * GET handler for manual testing
 */
export async function GET(request: NextRequest) {
  // 开发环境允许 GET 请求测试
  if (process.env.NODE_ENV !== "production") {
    return POST(request);
  }
  return new Response("Method not allowed", { status: 405 });
}
