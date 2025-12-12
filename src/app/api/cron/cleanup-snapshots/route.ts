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

import { createClient } from "@supabase/supabase-js";
import { successResponse, internalError } from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type { NextRequest } from "next/server";

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

// Supabase Admin Client (bypass RLS)
let supabaseAdmin: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      throw new Error("Missing Supabase credentials");
    }

    supabaseAdmin = createClient(url, serviceKey);
  }
  return supabaseAdmin;
}

/**
 * POST /api/cron/cleanup-snapshots
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 验证 Cron Secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (process.env.NODE_ENV === "production" && cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        logger.warn("[Snapshot Cleanup] Unauthorized cron request");
        return new Response("Unauthorized", { status: 401 });
      }
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

    // 批量处理过期快照
    for (const snapshot of snapshots) {
      try {
        // 1. 删除 Storage 文件
        const storagePaths = [
          snapshot.storage_path,
          snapshot.html_storage_path,
          snapshot.screenshot_storage_path,
        ].filter(Boolean) as string[];

        if (storagePaths.length > 0) {
          const { error: storageError } = await admin.storage
            .from("snapshots")
            .remove(storagePaths);

          if (storageError) {
            logger.warn(
              { snapshotId: snapshot.id, error: storageError.message },
              "[Snapshot Cleanup] Failed to delete storage files",
            );
          } else {
            results.filesDeleted += storagePaths.length;
          }
        }

        // 2. 删除快照记录
        const { error: deleteError } = await admin
          .from("bookmark_snapshots")
          .delete()
          .eq("id", snapshot.id);

        if (deleteError) {
          results.errors.push(
            `Delete snapshot ${snapshot.id}: ${deleteError.message}`,
          );
          continue;
        }

        results.recordsDeleted++;

        // 3. 更新 bookmark 状态（清除快照相关字段）
        // 使用类型断言绕过类型检查（字段存在于数据库但类型文件未同步）
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (admin as any)
          .from("bookmarks")
          .update({
            has_snapshot: false,
            snapshot_status: null,
            last_snapshot_at: null,
          })
          .eq("id", snapshot.bookmark_id);

        if (updateError) {
          logger.warn(
            { bookmarkId: snapshot.bookmark_id, error: updateError.message },
            "[Snapshot Cleanup] Failed to update bookmark status",
          );
        } else {
          results.bookmarksUpdated++;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.errors.push(`Process snapshot ${snapshot.id}: ${message}`);
        logger.error(
          { snapshotId: snapshot.id, error: message },
          "[Snapshot Cleanup] Failed to process snapshot",
        );
      }
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
