/**
 * 监控管理 API
 * GET /api/monitors - 获取监控列表
 * POST /api/monitors - 创建新监控
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createMonitorSchema,
  listMonitorsQuerySchema,
  type MonitorResponse,
  type MonitorStatsResponse,
} from "./validation";
import {
  successResponse,
  badRequestError,
  unauthorizedError,
  quotaExceededError,
  databaseError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { MONITOR_QUOTA, CHECK_INTERVAL_HOURS } from "@/lib/monitor/constants";
import { isUrlMonitorable } from "@/lib/monitor/page-fetcher";

/**
 * GET /api/monitors
 * 获取用户的监控列表和统计信息
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

    // 2. 解析查询参数
    const { searchParams } = new URL(request.url);
    const queryResult = listMonitorsQuerySchema.safeParse({
      status: searchParams.get("status") || "all",
      limit: searchParams.get("limit") || 50,
      offset: searchParams.get("offset") || 0,
    });

    if (!queryResult.success) {
      return badRequestError(queryResult.error.issues[0].message);
    }

    const { status, limit, offset } = queryResult.data;

    // 3. 获取用户会员信息
    const { data: profile } = await supabase
      .from("profiles")
      .select("membership_type")
      .eq("id", user.id)
      .single();

    const membershipType =
      (profile?.membership_type as "FREE" | "PRO") || "FREE";
    const quotaConfig = MONITOR_QUOTA[membershipType];

    // 4. 构建查询
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
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
        created_at,
        updated_at,
        bookmarks!inner (
          id,
          title,
          url
        )
      `,
      )
      .eq("user_id", user.id)
      .neq("status", "deleted");

    // 按状态筛选
    if (status !== "all") {
      query = query.eq("status", status);
    }

    // 分页和排序
    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: monitors, error: queryError } = await query;

    if (queryError) {
      logger.error({
        operation: "list_monitors",
        userId: user.id,
        error: queryError.message,
      });
      return databaseError("获取监控列表失败");
    }

    // 5. 获取统计信息
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: statsData } = await (supabase as any)
      .from("page_monitors")
      .select("status")
      .eq("user_id", user.id)
      .neq("status", "deleted");

    const stats: MonitorStatsResponse = {
      total: statsData?.length || 0,
      active:
        statsData?.filter((m: { status: string }) => m.status === "active")
          .length || 0,
      paused:
        statsData?.filter((m: { status: string }) => m.status === "paused")
          .length || 0,
      failed:
        statsData?.filter((m: { status: string }) => m.status === "failed")
          .length || 0,
      quotaUsed: statsData?.length || 0,
      quotaMax: quotaConfig.maxCount,
    };

    // 6. 转换响应格式
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedMonitors: MonitorResponse[] = (monitors || []).map(
      (m: any) => ({
        id: m.id,
        bookmarkId: m.bookmark_id,
        bookmarkTitle: m.bookmarks?.title || "未命名",
        bookmarkUrl: m.bookmarks?.url || "",
        checkInterval: m.check_interval,
        customIntervalHours: m.custom_interval_hours,
        status: m.status,
        changeCount: m.change_count,
        lastCheckedAt: m.last_checked_at,
        nextCheckAt: m.next_check_at,
        consecutiveFailures: m.consecutive_failures,
        lastErrorMessage: m.last_error_message,
        notificationEnabled: m.notification_enabled,
        createdAt: m.created_at,
        updatedAt: m.updated_at,
      }),
    );

    return successResponse({
      monitors: formattedMonitors,
      stats,
      pagination: {
        offset,
        limit,
        total: stats.total,
      },
    });
  } catch (error) {
    logger.error({
      operation: "list_monitors",
      error: error instanceof Error ? error.message : String(error),
    });
    return databaseError("获取监控列表失败");
  }
}

/**
 * POST /api/monitors
 * 创建新监控
 */
export async function POST(request: NextRequest) {
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

    // 2. 请求验证
    const body = await request.json();
    const parseResult = createMonitorSchema.safeParse(body);

    if (!parseResult.success) {
      return badRequestError(parseResult.error.issues[0].message);
    }

    const {
      bookmarkId,
      checkInterval,
      customIntervalHours,
      notificationEnabled,
    } = parseResult.data;

    // 3. 获取用户会员信息和配额检查
    const { data: profile } = await supabase
      .from("profiles")
      .select("membership_type")
      .eq("id", user.id)
      .single();

    const membershipType =
      (profile?.membership_type as "FREE" | "PRO") || "FREE";
    const quotaConfig = MONITOR_QUOTA[membershipType];

    // 检查检查间隔是否允许
    if (!quotaConfig.allowedIntervals.includes(checkInterval)) {
      return badRequestError(
        `当前会员等级不支持 ${checkInterval} 检查间隔，请升级到 PRO 会员`,
      );
    }

    // 检查配额
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: currentCount } = await (supabase as any)
      .from("page_monitors")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .neq("status", "deleted");

    if ((currentCount || 0) >= quotaConfig.maxCount) {
      return quotaExceededError(
        `监控配额已达上限（${quotaConfig.maxCount}个），请删除不需要的监控或升级会员`,
      );
    }

    // 4. 验证书签所有权
    const { data: bookmark, error: bookmarkError } = await supabase
      .from("bookmarks")
      .select("id, url, title")
      .eq("id", bookmarkId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (bookmarkError || !bookmark) {
      return badRequestError("书签不存在或无权操作");
    }

    // 5. 检查 URL 是否可监控
    const urlCheck = isUrlMonitorable(bookmark.url);
    if (!urlCheck.canMonitor) {
      return badRequestError(urlCheck.reason || "该链接不支持监控");
    }

    // 6. 检查是否已存在监控
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from("page_monitors")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("bookmark_id", bookmarkId)
      .neq("status", "deleted")
      .single();

    if (existing) {
      return badRequestError("该书签已设置监控，无需重复创建");
    }

    // 7. 计算下次检查时间
    const intervalHours =
      customIntervalHours || CHECK_INTERVAL_HOURS[checkInterval];
    const nextCheckAt = new Date(Date.now() + intervalHours * 60 * 60 * 1000);

    // 8. 创建监控
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newMonitor, error: createError } = await (supabase as any)
      .from("page_monitors")
      .insert({
        user_id: user.id,
        bookmark_id: bookmarkId,
        check_interval: checkInterval,
        custom_interval_hours:
          checkInterval === "custom" ? customIntervalHours : null,
        notification_enabled: notificationEnabled,
        status: "active",
        next_check_at: nextCheckAt.toISOString(),
      })
      .select("id")
      .single();

    if (createError) {
      logger.error({
        operation: "create_monitor",
        userId: user.id,
        bookmarkId,
        error: createError.message,
      });
      return databaseError("创建监控失败");
    }

    logger.info({
      operation: "create_monitor",
      userId: user.id,
      monitorId: newMonitor.id,
      bookmarkId,
      checkInterval,
    });

    return successResponse(
      {
        id: newMonitor.id,
        message: "监控创建成功",
        nextCheckAt: nextCheckAt.toISOString(),
      },
      201,
    );
  } catch (error) {
    logger.error({
      operation: "create_monitor",
      error: error instanceof Error ? error.message : String(error),
    });
    return databaseError("创建监控失败");
  }
}
