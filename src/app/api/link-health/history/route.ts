/**
 * 链接健康检测 API - 获取历史记录
 *
 * GET /api/link-health/history
 *
 * 功能：
 * - 获取检测历史记录列表
 * - 支持分页
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  badRequestError,
  databaseError,
} from "@/lib/utils/api-response";
import { safeParseInt } from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

/**
 * GET /api/link-health/history
 * 获取检测历史记录
 *
 * Query params:
 * - limit: 每页数量（默认 10，最大 50）
 * - offset: 偏移量（默认 0）
 */
export async function GET(request: NextRequest) {
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

    // 2. 解析分页参数
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      safeParseInt(searchParams.get("limit"), 10) || 10,
      50,
    );
    const offset = safeParseInt(searchParams.get("offset"), 0) || 0;

    if (limit < 1 || offset < 0) {
      return badRequestError("分页参数无效");
    }

    // 3. 查询历史记录
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const {
      data: records,
      error: queryError,
      count,
    } = await (supabase as any)
      .from("link_health_checks")
      .select(
        "id, scope, folder_id, total_checked, healthy_count, failed_count, slow_count, redirect_count, status, progress, created_at, completed_at",
        { count: "exact" },
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (queryError) {
      logger.error(
        {
          userId: user.id.slice(0, 8) + "...",
          error: queryError.message,
        },
        "Link Health History API: Query failed",
      );
      return databaseError("获取历史记录失败");
    }

    logger.debug(
      {
        userId: user.id.slice(0, 8) + "...",
        recordCount: records?.length || 0,
        total: count,
        limit,
        offset,
      },
      "Link Health History API: Records retrieved",
    );

    return successResponse({
      records: records || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "Link Health History API: Request failed",
    );

    return databaseError("获取历史记录失败");
  }
}
