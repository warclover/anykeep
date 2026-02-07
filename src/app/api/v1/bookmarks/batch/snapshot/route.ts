/**
 * Bookmark Batch Snapshot API v1
 *
 * POST /api/v1/bookmarks/batch/snapshot - 批量创建快照
 *
 * 调用数据库函数 atomic_batch_create_snapshots 实现原子化批量操作
 * 相比逐个调用单个 API，性能提升 4-5 倍
 *
 * @module api/v1/bookmarks/batch/snapshot
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware, validateBody } from "@/lib/api/middleware";
import { BatchSnapshotSchema } from "@/contracts";
import { checkRateLimit } from "@/lib/utils/rate-limiter";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api-v1-batch-snapshot");

/**
 * 批量快照响应类型
 */
interface BatchSnapshotResult {
  total_requested: number;
  total_created: number;
  total_skipped: number;
  available_slots: number;
  created_snapshot_ids: number[];
}

/**
 * POST /api/v1/bookmarks/batch/snapshot
 *
 * 批量创建书签快照
 *
 * 速率限制：每小时 10 次
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const startTime = Date.now();

  // 速率限制检查
  const rateLimitResult = checkRateLimit(
    userId,
    "/api/v1/bookmarks/batch/snapshot",
  );
  if (!rateLimitResult.allowed) {
    logger.warn(
      { userId, resetMs: rateLimitResult.resetMs },
      "Batch snapshot rate limited",
    );
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "操作过于频繁，请稍后再试",
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil(rateLimitResult.resetMs / 1000).toString(),
        },
      },
    );
  }

  // 验证请求体
  const body = await validateBody(request, BatchSnapshotSchema);
  const { ids, snapshotType } = body;

  logger.info(
    { userId, count: ids.length, snapshotType },
    "Batch snapshot request",
  );

  const supabase = await createClient();

  // 1. 验证书签所有权
  const { data: ownedBookmarks, error: ownershipError } = await supabase
    .from("bookmarks")
    .select("id, url")
    .in("id", ids)
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (ownershipError) {
    logger.error({ error: ownershipError }, "Ownership check failed");
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "DATABASE_ERROR",
          message: "验证书签所有权失败",
        },
      },
      { status: 500 },
    );
  }

  // 过滤有效书签（必须有 URL）
  const validBookmarks = ownedBookmarks?.filter((b) => b.url) || [];
  const validIds = validBookmarks.map((b) => b.id);

  if (validIds.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "NO_VALID_BOOKMARKS",
          message: "没有可创建快照的有效书签",
        },
      },
      { status: 400 },
    );
  }

  // 2. 调用原子化批量创建函数
  // 注意：atomic_batch_create_snapshots 是手动创建的 RPC 函数，尚未在 supabase.generated.ts 中定义
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(
    "atomic_batch_create_snapshots",
    {
      p_user_id: userId,
      p_bookmark_ids: validIds,
      p_snapshot_type: snapshotType,
      p_trigger_source: "batch",
      p_max_batch_size: 50,
    },
  );

  if (error) {
    logger.error({ error, userId }, "Batch snapshot creation failed");

    // 检查是否是配额不足
    if (error.message?.includes("quota") || error.message?.includes("配额")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "QUOTA_EXCEEDED",
            message: "快照配额不足，请升级会员或清理过期快照",
          },
        },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SNAPSHOT_CREATION_FAILED",
          message: "批量创建快照失败",
        },
      },
      { status: 500 },
    );
  }

  const result = (data as BatchSnapshotResult[])?.[0];

  if (!result) {
    logger.error({ userId }, "No result from batch snapshot function");
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "NO_RESULT",
          message: "批量创建快照未返回结果",
        },
      },
      { status: 500 },
    );
  }

  const duration = Date.now() - startTime;
  logger.info(
    {
      userId,
      duration,
      totalRequested: result.total_requested,
      totalCreated: result.total_created,
      totalSkipped: result.total_skipped,
      availableSlots: result.available_slots,
    },
    "Batch snapshot completed",
  );

  return NextResponse.json({
    success: true,
    data: {
      totalRequested: ids.length,
      totalValid: validIds.length,
      totalCreated: result.total_created,
      totalSkipped: result.total_skipped,
      availableSlots: result.available_slots,
      createdSnapshotIds: result.created_snapshot_ids,
      message:
        result.total_created > 0
          ? `成功创建 ${result.total_created} 个快照`
          : "所有书签已有快照或配额不足",
    },
  });
});
