/**
 * 暂停监控 API
 * POST /api/monitors/[id]/pause - 暂停监控
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  badRequestError,
  unauthorizedError,
  notFoundError,
  databaseError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/monitors/[id]/pause
 * 暂停监控
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const monitorId = parseInt(id, 10);

    if (isNaN(monitorId) || monitorId <= 0) {
      return badRequestError("无效的监控 ID");
    }

    // 1. 身份验证
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 验证监控所有权和当前状态
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing, error: existError } = await (supabase as any)
      .from("page_monitors")
      .select("id, status")
      .eq("id", monitorId)
      .eq("user_id", user.id)
      .neq("status", "deleted")
      .single();

    if (existError || !existing) {
      return notFoundError("监控不存在或无权操作");
    }

    if (existing.status === "paused") {
      return badRequestError("监控已处于暂停状态");
    }

    if (existing.status === "failed") {
      return badRequestError("监控处于失败状态，请先恢复或删除");
    }

    // 3. 执行暂停
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from("page_monitors")
      .update({
        status: "paused",
        updated_at: new Date().toISOString(),
      })
      .eq("id", monitorId);

    if (updateError) {
      logger.error({
        operation: "pause_monitor",
        userId: user.id,
        monitorId,
        error: updateError.message,
      });
      return databaseError("暂停监控失败");
    }

    logger.info({
      operation: "pause_monitor",
      userId: user.id,
      monitorId,
    });

    return successResponse({
      id: monitorId,
      status: "paused",
      message: "监控已暂停",
    });
  } catch (error) {
    logger.error({
      operation: "pause_monitor",
      error: error instanceof Error ? error.message : String(error),
    });
    return databaseError("暂停监控失败");
  }
}
