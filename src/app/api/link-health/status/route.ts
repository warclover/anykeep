/**
 * 链接健康检测 API - 获取状态
 *
 * GET /api/link-health/status
 *
 * 功能：
 * - 获取最近一次检测记录
 * - 获取当前书签健康状态统计
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  databaseError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

/**
 * GET /api/link-health/status
 * 获取链接健康状态
 */
export async function GET(_request: NextRequest) {
  try {
    // 1. 身份验证
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 获取最近一次检测记录
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lastCheck, error: checkError } = await (supabase as any)
      .from("link_health_checks")
      .select(
        "id, scope, status, total_checked, healthy_count, failed_count, slow_count, redirect_count, progress, completed_at, created_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 = no rows
      logger.error(
        {
          userId: user.id.slice(0, 8) + "...",
          error: checkError.message,
        },
        "Link Health Status API: Failed to get last check",
      );
    }

    // 3. 获取当前书签健康状态统计（使用 RPC 函数）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: stats, error: statsError } = await (supabase as any).rpc(
      "get_user_health_stats",
    );

    if (statsError) {
      logger.error(
        {
          userId: user.id.slice(0, 8) + "...",
          error: statsError.message,
        },
        "Link Health Status API: Failed to get stats",
      );

      // 回退：手动计算统计
      const fallbackStats = await getFallbackStats(supabase, user.id);
      return successResponse({
        lastCheck: lastCheck || null,
        stats: fallbackStats,
      });
    }

    logger.debug(
      {
        userId: user.id.slice(0, 8) + "...",
        hasLastCheck: !!lastCheck,
        stats,
      },
      "Link Health Status API: Status retrieved",
    );

    return successResponse({
      lastCheck: lastCheck || null,
      stats: stats || {
        total: 0,
        healthy: 0,
        failed: 0,
        slow: 0,
        unknown: 0,
      },
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "Link Health Status API: Request failed",
    );

    return databaseError("获取健康状态失败");
  }
}

/**
 * 回退统计计算（当 RPC 函数不可用时）
 */
async function getFallbackStats(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<{
  total: number;
  healthy: number;
  failed: number;
  slow: number;
  unknown: number;
}> {
  try {
    // 获取总数
    const { count: total } = await supabase
      .from("bookmarks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null);

    // 由于 health_status 字段可能还不存在，返回基础统计
    return {
      total: total || 0,
      healthy: 0,
      failed: 0,
      slow: 0,
      unknown: total || 0,
    };
  } catch {
    return {
      total: 0,
      healthy: 0,
      failed: 0,
      slow: 0,
      unknown: 0,
    };
  }
}
