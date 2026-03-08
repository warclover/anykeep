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
  quotaExceededError,
  databaseError,
} from "@/lib/utils/api-response";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { logger } from "@/lib/logger";
import {
  MONITOR_QUOTA,
  CHECK_INTERVAL_HOURS,
  type CheckInterval,
} from "@/lib/monitor/constants";
import { isUrlMonitorable } from "@/lib/monitor/page-fetcher";

/**
 * 监控列表 JOIN 查询结果类型
 */
interface MonitorListItem {
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
  created_at: string;
  updated_at: string;
  bookmarks: { id: number; title: string; url: string } | null;
}

/**
 * create_monitor_atomic RPC 返回类型
 */
interface CreateMonitorAtomicResult {
  success: boolean;
  monitor_id?: number;
  error_code?: string;
  error_message?: string;
}

/**
 * GET /api/monitors
 * 获取用户的监控列表和统计信息
 */
export const GET = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    // 1. 解析查询参数
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

    // 2. 获取用户会员信息
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("membership_type")
      .eq("id", userId)
      .single();

    const membershipType =
      (profile?.membership_type as string as "FREE" | "PRO") || "FREE";
    const quotaConfig = MONITOR_QUOTA[membershipType];

    // 3. 构建查询
    // Supabase JOIN 查询 (bookmarks!inner) 的返回类型无法自动推断
    let query = supabase
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
      .eq("user_id", userId)
      .neq("status", "deleted");

    // 按状态筛选
    if (status !== "all") {
      query = query.eq("status", status);
    }

    // 分页和排序
    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: monitors, error: queryError } = (await query) as unknown as {
      data: MonitorListItem[] | null;
      error: { message: string } | null;
    };

    if (queryError) {
      logger.error({
        operation: "list_monitors",
        userId,
        error: queryError.message,
      });
      return databaseError("获取监控列表失败");
    }

    // 4. 获取统计信息
    const { data: statsData } = await supabase
      .from("page_monitors")
      .select("status")
      .eq("user_id", userId)
      .neq("status", "deleted");

    const statsRows = (statsData || []) as Array<{ status: string }>;
    const stats: MonitorStatsResponse = {
      total: statsRows.length,
      active: statsRows.filter((m) => m.status === "active").length,
      paused: statsRows.filter((m) => m.status === "paused").length,
      failed: statsRows.filter((m) => m.status === "failed").length,
      quotaUsed: statsRows.length,
      quotaMax: quotaConfig.maxCount,
    };

    // 5. 转换响应格式
    const formattedMonitors: MonitorResponse[] = (monitors || []).map(
      (m: MonitorListItem): MonitorResponse => ({
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
  },
);

/**
 * POST /api/monitors
 * 创建新监控
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    // 1. 请求验证
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

    // 2. 获取用户会员信息和配额检查
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("membership_type")
      .eq("id", userId)
      .single();

    const membershipType =
      (profile?.membership_type as string as "FREE" | "PRO") || "FREE";
    const quotaConfig = MONITOR_QUOTA[membershipType];

    // 检查检查间隔是否允许
    if (!quotaConfig.allowedIntervals.includes(checkInterval)) {
      return badRequestError(
        `当前会员等级不支持 ${checkInterval} 检查间隔，请升级到 PRO 会员`,
      );
    }

    // 早期配额检查（优化：快速失败，避免不必要的后续查询）
    // 注意：原子函数 create_monitor_atomic 会再次检查以防止并发问题
    const { count: currentCount } = await supabase
      .from("page_monitors")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "deleted");

    if ((currentCount || 0) >= quotaConfig.maxCount) {
      return quotaExceededError(
        `监控配额已达上限（${quotaConfig.maxCount}个），请删除不需要的监控或升级会员`,
      );
    }

    // 3. 验证书签所有权
    const { data: bookmark, error: bookmarkError } = await supabase
      .from("bookmarks")
      .select("id, url, title")
      .eq("id", bookmarkId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single()
      .then<{
        data: { id: number; url: string; title: string } | null;
        error: { message: string } | null;
      }>((result) => ({
        data: result.data as { id: number; url: string; title: string } | null,
        error: result.error as { message: string } | null,
      }));

    if (bookmarkError || !bookmark) {
      return badRequestError("书签不存在或无权操作");
    }

    // 4. 检查 URL 是否可监控
    const urlCheck = isUrlMonitorable(bookmark.url);
    if (!urlCheck.canMonitor) {
      return badRequestError(urlCheck.reason || "该链接不支持监控");
    }

    // 5. 使用原子 RPC 函数创建监控（解决 TOCTOU 漏洞）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- create_monitor_atomic RPC 不在 Supabase 生成类型中
    const { data: result, error: rpcError } = (await (supabase.rpc as any)(
      "create_monitor_atomic",
      {
        p_user_id: userId,
        p_bookmark_id: bookmarkId,
        p_check_interval: checkInterval,
        p_custom_interval_hours:
          checkInterval === "custom" ? customIntervalHours : null,
        p_notification_enabled: notificationEnabled,
        p_quota_limit: quotaConfig.maxCount,
      },
    )) as {
      data: CreateMonitorAtomicResult | CreateMonitorAtomicResult[] | null;
      error: { message: string } | null;
    };

    if (rpcError) {
      logger.error({
        operation: "create_monitor",
        userId,
        bookmarkId,
        error: rpcError.message,
      });
      return databaseError("创建监控失败");
    }

    // 解析 RPC 返回结果
    const rpcResult = Array.isArray(result) ? result[0] : result;

    if (!rpcResult?.success) {
      const errorCode = rpcResult?.error_code;
      const errorMessage = rpcResult?.error_message || "创建监控失败";

      if (errorCode === "QUOTA_EXCEEDED") {
        return quotaExceededError(errorMessage);
      }
      if (errorCode === "ALREADY_EXISTS") {
        return badRequestError(errorMessage);
      }
      return badRequestError(errorMessage);
    }

    // 计算下次检查时间（用于返回）
    const intervalHours =
      customIntervalHours || CHECK_INTERVAL_HOURS[checkInterval];
    const nextCheckAt = new Date(Date.now() + intervalHours * 60 * 60 * 1000);

    logger.info({
      operation: "create_monitor",
      userId,
      monitorId: rpcResult.monitor_id,
      bookmarkId,
      checkInterval,
    });

    return successResponse(
      {
        id: rpcResult.monitor_id,
        message: "监控创建成功",
        nextCheckAt: nextCheckAt.toISOString(),
      },
      201,
    );
  },
);
