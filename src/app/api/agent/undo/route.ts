/**
 * AI 撤销操作 API
 *
 * 端点：
 * - POST /api/agent/undo - 执行撤销
 * - GET /api/agent/undo - 获取可撤销操作列表
 *
 * @version 1.0.0
 * @since 2025-12-25
 * @see {@link @/lib/ai-skills/services/snapshot.manager} SnapshotManager
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";

// =============================================================================
// 请求验证 Schema
// =============================================================================

const undoRequestSchema = z.object({
  snapshotId: z.string().uuid("snapshotId 必须是有效的 UUID"),
});

// =============================================================================
// API Handlers
// =============================================================================

/**
 * POST /api/agent/undo
 * 执行撤销操作
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  // 1. 解析并验证请求体
  const body = await request.json();
  const validation = undoRequestSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        error: "请求参数无效",
        details: validation.error.issues,
      },
      { status: 400 },
    );
  }

  const { snapshotId } = validation.data;

  logger.info(
    {
      userId: userId.slice(0, 8) + "...",
      snapshotId,
    },
    "Agent Undo: Request received",
  );

  // 2. 调用 RPC 执行撤销
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (supabase.rpc as any)(
    "revert_ai_operation_snapshot",
    {
      p_snapshot_id: snapshotId,
      p_user_id: userId,
    },
  )) as {
    data:
      | { success: boolean; restored_count: number; error_message: string }[]
      | null;
    error: { message: string } | null;
  };

  if (error) {
    logger.error({ error }, "Agent Undo: RPC failed");
    return NextResponse.json(
      { success: false, error: "撤销操作失败" },
      { status: 500 },
    );
  }

  const result = data?.[0] ?? {
    success: false,
    restored_count: 0,
    error_message: "未知错误",
  };

  if (!result.success) {
    logger.warn(
      { snapshotId, message: result.error_message },
      "Agent Undo: Rejected",
    );
    return NextResponse.json(
      { success: false, error: result.error_message },
      { status: 400 },
    );
  }

  logger.info(
    { snapshotId, restoredCount: result.restored_count },
    "Agent Undo: Completed successfully",
  );

  return NextResponse.json({
    success: true,
    data: {
      restoredCount: result.restored_count,
      message: `已撤销，恢复了 ${result.restored_count} 个书签`,
    },
  });
});

/**
 * GET /api/agent/undo
 * 获取可撤销操作列表
 */
export const GET = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  // 查询未过期、未撤销的快照
  const { data, error } = await supabase
    .from("ai_operation_snapshots")
    .select(
      "id, operation_type, operation_description, created_at, expires_at, affected_bookmark_ids",
    )
    .eq("user_id", userId)
    .eq("is_reverted", false)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logger.error({ error }, "Agent Undo: Failed to get undoable operations");
    return NextResponse.json(
      { success: false, error: "获取可撤销操作失败" },
      { status: 500 },
    );
  }

  const operations = (data ?? []).map(
    (item: {
      id: string;
      operation_type: string;
      operation_description: string | null;
      created_at: string;
      expires_at: string;
      affected_bookmark_ids: number[] | null;
    }) => ({
      snapshotId: item.id,
      operationType: item.operation_type,
      description: item.operation_description || `${item.operation_type} 操作`,
      createdAt: item.created_at,
      expiresAt: item.expires_at,
      affectedCount: item.affected_bookmark_ids?.length || 0,
      timeRemaining: formatTimeRemaining(new Date(item.expires_at)),
    }),
  );

  return NextResponse.json({
    success: true,
    data: operations,
  });
});

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 格式化剩余时间
 */
function formatTimeRemaining(expiresAt: Date): string {
  const now = new Date();
  const diff = expiresAt.getTime() - now.getTime();

  if (diff <= 0) {
    return "已过期";
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours} 小时 ${minutes} 分钟`;
  }
  if (minutes > 0) {
    return `${minutes} 分钟`;
  }
  return "即将过期";
}
