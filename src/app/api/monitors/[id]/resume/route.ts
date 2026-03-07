/**
 * 恢复监控 API
 * POST /api/monitors/[id]/resume - 恢复监控
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
import { CHECK_INTERVAL_HOURS } from "@/lib/monitor/constants";

/**
 * POST /api/monitors/[id]/resume
 * 恢复监控
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
      .select("id, status, check_interval, custom_interval_hours")
      .eq("id", monitorId)
      .eq("user_id", userId)
      .neq("status", "deleted")
      .single();

    if (existError || !existing) {
      return notFoundError("监控不存在或无权操作");
    }

    if (existing.status === "active") {
      return badRequestError("监控已处于活动状态");
    }

    // 2. 计算下次检查时间
    const intervalHours =
      existing.custom_interval_hours ||
      CHECK_INTERVAL_HOURS[
        existing.check_interval as keyof typeof CHECK_INTERVAL_HOURS
      ] ||
      24;
    const nextCheckAt = new Date(Date.now() + intervalHours * 60 * 60 * 1000);

    // 3. 执行恢复
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from("page_monitors")
      .update({
        status: "active",
        consecutive_failures: 0, // 重置连续失败计数
        last_error_message: null, // 清除错误信息
        next_check_at: nextCheckAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", monitorId);

    if (updateError) {
      logger.error({
        operation: "resume_monitor",
        userId,
        monitorId,
        error: updateError.message,
      });
      return databaseError("恢复监控失败");
    }

    logger.info({
      operation: "resume_monitor",
      userId,
      monitorId,
      previousStatus: existing.status,
    });

    return successResponse({
      id: monitorId,
      status: "active",
      nextCheckAt: nextCheckAt.toISOString(),
      message: "监控已恢复",
    });
  },
);
