/**
 * 单个监控管理 API
 * GET /api/monitors/[id] - 获取监控详情
 * PUT /api/monitors/[id] - 更新监控设置
 * DELETE /api/monitors/[id] - 删除监控
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  updateMonitorSchema,
  type MonitorDetailResponse,
  type CheckRecordResponse,
} from "../validation";
import {
  successResponse,
  badRequestError,
  notFoundError,
  databaseError,
} from "@/lib/utils/api-response";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { logger } from "@/lib/logger";
import {
  MONITOR_QUOTA,
  CHECK_INTERVAL_HOURS,
  type CheckInterval,
} from "@/lib/monitor/constants";
import type { PageMonitorUpdate } from "@/types/supabase";

/**
 * 监控 JOIN 书签查询结果类型
 * Supabase 的 `bookmarks!inner` JOIN 返回嵌套对象，生成类型不包含此结构
 */
interface MonitorWithBookmark {
  id: number;
  bookmark_id: number;
  check_interval: CheckInterval;
  custom_interval_hours: number | null;
  status: "active" | "paused" | "failed" | "deleted";
  change_count: number;
  last_checked_at: string | null;
  next_check_at: string | null;
  consecutive_failures: number;
  last_error_message: string | null;
  notification_enabled: boolean;
  baseline_snapshot_id: number | null;
  baseline_content_hash: string | null;
  created_at: string;
  updated_at: string;
  bookmarks: { id: number; title: string; url: string } | null;
}

/**
 * 检查日志行类型
 */
interface CheckLogRow {
  id: number;
  check_result: string;
  checked_at: string;
  similarity_score: number | null;
  change_summary: string | null;
  error_message: string | null;
  duration_ms: number | null;
}

/**
 * GET /api/monitors/[id]
 * 获取单个监控的详细信息
 */
export const GET = withAuthMiddleware<{ id: string }>(
  async (request: NextRequest, { userId, params }) => {
    const { id } = await params;
    const monitorId = parseInt(id, 10);

    if (isNaN(monitorId) || monitorId <= 0) {
      return badRequestError("无效的监控 ID");
    }

    // 1. 获取监控详情
    const supabase = await createClient();
    // Supabase JOIN 查询 (bookmarks!inner) 的返回类型无法自动推断，使用显式类型断言
    const { data: monitor, error: queryError } = (await supabase
      .from("page_monitors")
      .select(
        `
      id,
      bookmark_id,
      check_interval,
      custom_interval_hours,
      status,
      change_count,
      last_checked_at,
      next_check_at,
      consecutive_failures,
      last_error_message,
      notification_enabled,
      baseline_snapshot_id,
      baseline_content_hash,
      created_at,
      updated_at,
      bookmarks!inner (
        id,
        title,
        url
      )
    `,
      )
      .eq("id", monitorId)
      .eq("user_id", userId)
      .neq("status", "deleted")
      .single()) as unknown as {
      data: MonitorWithBookmark | null;
      error: { message: string } | null;
    };

    if (queryError || !monitor) {
      return notFoundError("监控不存在或无权访问");
    }

    // 2. 获取最近的检查记录
    const { data: recentLogs } = (await supabase
      .from("monitor_check_logs")
      .select(
        `
      id,
      check_result,
      checked_at,
      similarity_score,
      change_summary,
      error_message,
      duration_ms
    `,
      )
      .eq("monitor_id", monitorId)
      .order("checked_at", { ascending: false })
      .limit(10)) as unknown as { data: CheckLogRow[] | null };

    // 3. 转换响应格式
    const response: MonitorDetailResponse = {
      id: monitor.id,
      bookmarkId: monitor.bookmark_id,
      bookmarkTitle: monitor.bookmarks?.title || "未命名",
      bookmarkUrl: monitor.bookmarks?.url || "",
      checkInterval: monitor.check_interval,
      customIntervalHours: monitor.custom_interval_hours,
      status: monitor.status,
      changeCount: monitor.change_count,
      lastCheckedAt: monitor.last_checked_at,
      nextCheckAt: monitor.next_check_at,
      consecutiveFailures: monitor.consecutive_failures,
      lastErrorMessage: monitor.last_error_message,
      notificationEnabled: monitor.notification_enabled,
      baselineSnapshotId: monitor.baseline_snapshot_id,
      createdAt: monitor.created_at,
      updatedAt: monitor.updated_at,
      recentChecks: (recentLogs || []).map(
        (log: CheckLogRow): CheckRecordResponse => ({
          id: log.id,
          result: log.check_result,
          checkedAt: log.checked_at,
          similarityScore: log.similarity_score,
          changeSummary: log.change_summary,
          errorMessage: log.error_message,
          durationMs: log.duration_ms,
        }),
      ),
    };

    return successResponse(response);
  },
);

/**
 * PUT /api/monitors/[id]
 * 更新监控设置
 */
export const PUT = withAuthMiddleware<{ id: string }>(
  async (request: NextRequest, { userId, params }) => {
    const { id } = await params;
    const monitorId = parseInt(id, 10);

    if (isNaN(monitorId) || monitorId <= 0) {
      return badRequestError("无效的监控 ID");
    }

    // 1. 请求验证
    const body = await request.json();
    const parseResult = updateMonitorSchema.safeParse(body);

    if (!parseResult.success) {
      return badRequestError(parseResult.error.issues[0].message);
    }

    const { checkInterval, customIntervalHours, notificationEnabled } =
      parseResult.data;

    // 2. 验证监控所有权
    const supabase = await createClient();
    const { data: existing, error: existError } = await supabase
      .from("page_monitors")
      .select("id, status, check_interval")
      .eq("id", monitorId)
      .eq("user_id", userId)
      .neq("status", "deleted")
      .single();

    if (existError || !existing) {
      return notFoundError("监控不存在或无权操作");
    }

    // 3. 检查会员权限（如果更改检查间隔）
    if (checkInterval) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("membership_type")
        .eq("id", userId)
        .single();

      const membershipType =
        (profile?.membership_type as string as "FREE" | "PRO") || "FREE";
      const quotaConfig = MONITOR_QUOTA[membershipType];

      if (!quotaConfig.allowedIntervals.includes(checkInterval)) {
        return badRequestError(
          `当前会员等级不支持 ${checkInterval} 检查间隔，请升级到 PRO 会员`,
        );
      }
    }

    // 4. 构建更新数据
    const updateData: PageMonitorUpdate & { updated_at: string } = {
      updated_at: new Date().toISOString(),
    };

    if (checkInterval !== undefined) {
      updateData.check_interval = checkInterval;
      // 重新计算下次检查时间
      const intervalHours =
        checkInterval === "custom"
          ? customIntervalHours
          : CHECK_INTERVAL_HOURS[checkInterval];
      if (intervalHours) {
        updateData.next_check_at = new Date(
          Date.now() + intervalHours * 60 * 60 * 1000,
        ).toISOString();
      }
    }

    if (customIntervalHours !== undefined) {
      updateData.custom_interval_hours =
        checkInterval === "custom" ? customIntervalHours : null;
    }

    if (notificationEnabled !== undefined) {
      updateData.notification_enabled = notificationEnabled;
    }

    // 5. 执行更新
    const { error: updateError } = await supabase
      .from("page_monitors")
      .update(updateData)
      .eq("id", monitorId);

    if (updateError) {
      logger.error({
        operation: "update_monitor",
        userId,
        monitorId,
        error: updateError.message,
      });
      return databaseError("更新监控失败");
    }

    logger.info({
      operation: "update_monitor",
      userId,
      monitorId,
      changes: Object.keys(updateData),
    });

    return successResponse({
      id: monitorId,
      message: "监控设置已更新",
    });
  },
);

/**
 * DELETE /api/monitors/[id]
 * 删除监控（软删除）
 */
export const DELETE = withAuthMiddleware<{ id: string }>(
  async (request: NextRequest, { userId, params }) => {
    const { id } = await params;
    const monitorId = parseInt(id, 10);

    if (isNaN(monitorId) || monitorId <= 0) {
      return badRequestError("无效的监控 ID");
    }

    // 1. 验证监控所有权
    const supabase = await createClient();
    const { data: existing, error: existError } = await supabase
      .from("page_monitors")
      .select("id, status")
      .eq("id", monitorId)
      .eq("user_id", userId)
      .neq("status", "deleted")
      .single();

    if (existError || !existing) {
      return notFoundError("监控不存在或无权操作");
    }

    // 2. 执行软删除
    const { error: deleteError } = await supabase
      .from("page_monitors")
      .update({
        status: "deleted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", monitorId);

    if (deleteError) {
      logger.error({
        operation: "delete_monitor",
        userId,
        monitorId,
        error: deleteError.message,
      });
      return databaseError("删除监控失败");
    }

    logger.info({
      operation: "delete_monitor",
      userId,
      monitorId,
    });

    return successResponse({
      id: monitorId,
      message: "监控已删除",
    });
  },
);
