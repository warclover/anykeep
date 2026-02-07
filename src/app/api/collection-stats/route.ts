/**
 * Collection Stats API
 *
 * GET /api/collection-stats - 获取收藏统计数据用于整理前后对比
 *
 * @version 2.0.0 - 使用 RPC 函数优化性能（6次查询 → 1次）
 * @since 2026-01-10
 * @updated 2026-02-07
 */

import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type { OrganizeSnapshot } from "@/lib/organize/types";

/**
 * GET /api/collection-stats
 * 获取收藏统计快照
 *
 * 性能优化：使用 RPC 函数将 6 次数据库查询合并为 1 次
 * @see migrations/20260207110001_add_collection_stats_rpc.sql
 */
export async function GET() {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 调用 RPC 函数获取所有统计数据（单次查询）
    const { data: stats, error: statsError } = await supabase.rpc(
      "get_collection_stats",
      { p_user_id: user.id },
    );

    if (statsError) {
      logger.error(
        { error: statsError },
        "Failed to get collection stats via RPC",
      );
      throw statsError;
    }

    // 3. 构建快照响应
    const snapshot: OrganizeSnapshot = {
      timestamp: new Date().toISOString(),
      total: stats?.total ?? 0,
      uncategorized: stats?.uncategorized ?? 0,
      duplicates: stats?.duplicates ?? 0,
      untagged: stats?.untagged ?? 0,
      stale: stats?.stale ?? 0,
    };

    return successResponse(snapshot);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "GET /api/collection-stats error",
    );
    return internalError("获取统计数据失败");
  }
}
