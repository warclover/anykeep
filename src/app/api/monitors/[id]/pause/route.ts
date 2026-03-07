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
  notFoundError,
  databaseError,
} from "@/lib/utils/api-response";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { logger } from "@/lib/logger";

/**
 * POST /api/monitors/[id]/pause
 * 暂停监控
 */
export const POST = withAuthMiddleware<{ id: string }>(
  async (request: NextRequest, { userId, params }) => {
    const { id } = await params;
    const monitorId = parseInt(id, 10);

    if (isNaN(monitorId) || monitorId <= 0) {
      return badRequestError("无效的监控 ID");
    }

    // 1. 验证监控所有权和当前状态
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing, error: existError } = await (supabase as any)
      .from("page_monitors")
      .select("id, status")
      .eq("id", monitorId)
      .eq("user_id", userId)
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

    // 2. 执行暂停
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
        userId,
        monitorId,
        error: updateError.message,
      });
      return databaseError("暂停监控失败");
    }

    logger.info({
      operation: "pause_monitor",
      userId,
      monitorId,
    });

    return successResponse({
      id: monitorId,
      status: "paused",
      message: "监控已暂停",
    });
  },
);
