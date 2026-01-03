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

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

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
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json(
        { success: false, error: "请先登录" },
        { status: 401 },
      );
    }

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = undoRequestSchema.safeParse(body);

    if (!validation.success) {
      return Response.json(
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
        userId: user.id.slice(0, 8) + "...",
        snapshotId,
      },
      "Agent Undo: Request received",
    );

    // 3. 调用 RPC 执行撤销
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)("revert_ai_operation_snapshot", {
      p_snapshot_id: snapshotId,
      p_user_id: user.id,
    }) as {
      data: { success: boolean; restored_count: number; error_message: string }[] | null;
      error: { message: string } | null;
    };

    if (error) {
      logger.error({ error }, "Agent Undo: RPC failed");
      return Response.json(
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
      return Response.json(
        { success: false, error: result.error_message },
        { status: 400 },
      );
    }

    logger.info(
      { snapshotId, restoredCount: result.restored_count },
      "Agent Undo: Completed successfully",
    );

    return Response.json({
      success: true,
      data: {
        restoredCount: result.restored_count,
        message: `已撤销，恢复了 ${result.restored_count} 个书签`,
      },
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/agent/undo error",
    );

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "撤销操作失败",
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/agent/undo
 * 获取可撤销操作列表
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json(
        { success: false, error: "请先登录" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    // 查询未过期、未撤销的快照
    const { data, error } = await supabase
      .from("ai_operation_snapshots")
      .select(
        "id, operation_type, summary, created_at, expires_at, bookmark_ids",
      )
      .eq("user_id", user.id)
      .eq("is_reverted", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      logger.error({ error }, "Agent Undo: Failed to get undoable operations");
      return Response.json(
        { success: false, error: "获取可撤销操作失败" },
        { status: 500 },
      );
    }

    const operations = (data ?? []).map(
      (item: {
        id: string;
        operation_type: string;
        summary: string | null;
        created_at: string;
        expires_at: string;
        bookmark_ids: number[];
      }) => ({
        snapshotId: item.id,
        operationType: item.operation_type,
        description: item.summary || `${item.operation_type} 操作`,
        createdAt: item.created_at,
        expiresAt: item.expires_at,
        affectedCount: item.bookmark_ids?.length || 0,
        timeRemaining: formatTimeRemaining(new Date(item.expires_at)),
      }),
    );

    return Response.json({
      success: true,
      data: operations,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "GET /api/agent/undo error",
    );

    return Response.json(
      { success: false, error: "获取可撤销操作失败" },
      { status: 500 },
    );
  }
}

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
