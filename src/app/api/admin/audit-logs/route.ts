/**
 * 审计日志 API
 *
 * @description 查询用户审计日志、记录变更历史和统计信息
 * @since 2025-12-24 (Phase 3.4)
 *
 * 注意：RPC 函数类型需要在数据库迁移应用后重新生成
 * npm run supabase:gen:types
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const LOG_TAG = "[AuditLogs API]";

// 审计日志记录类型
interface AuditLogEntry {
  id: number;
  event_type: string;
  event_timestamp: string;
  table_name: string;
  record_id: string;
  changed_fields: string[] | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  user_email?: string;
}

// 审计统计类型
interface AuditStatistics {
  table_name: string;
  insert_count: number;
  update_count: number;
  delete_count: number;
  total_count: number;
}

/**
 * GET /api/admin/audit-logs
 *
 * 查询用户审计日志
 *
 * Query Params:
 * - limit: 返回数量限制 (默认 100)
 * - offset: 偏移量 (默认 0)
 * - tableName: 过滤表名 (可选)
 * - startDate: 开始日期 (可选, ISO 8601)
 * - endDate: 结束日期 (可选, ISO 8601)
 * - recordId: 记录 ID (可选，与 tableName 配合查询记录历史)
 * - stats: 是否返回统计信息 (可选, 'true')
 * - days: 统计天数 (默认 30)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const isStats = searchParams.get("stats") === "true";
    const recordId = searchParams.get("recordId");
    const tableName = searchParams.get("tableName");

    // 统计查询
    if (isStats) {
      const days = parseInt(searchParams.get("days") || "30", 10);

      // 使用类型断言，因为 RPC 函数类型需要在迁移后生成
      const { data, error } = await (supabase.rpc as CallableFunction)(
        "get_audit_statistics",
        {
          p_user_id: user.id,
          p_days: days,
        },
      );

      if (error) {
        logger.error({ error, tag: LOG_TAG }, "Failed to get audit statistics");
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          statistics: data as AuditStatistics[],
          period: { days },
        },
      });
    }

    // 记录历史查询
    if (recordId && tableName) {
      const { data, error } = await (supabase.rpc as CallableFunction)(
        "get_record_audit_history",
        {
          p_table_name: tableName,
          p_record_id: recordId,
        },
      );

      if (error) {
        logger.error({ error, tag: LOG_TAG }, "Failed to get record history");
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          history: data as AuditLogEntry[],
          record: { tableName, recordId },
        },
      });
    }

    // 用户操作历史查询
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const { data, error } = await (supabase.rpc as CallableFunction)(
      "get_user_audit_history",
      {
        p_user_id: user.id,
        p_limit: Math.min(limit, 1000), // 最大 1000 条
        p_offset: offset,
        p_table_name: tableName || null,
        p_start_date: startDate || null,
        p_end_date: endDate || null,
      },
    );

    if (error) {
      logger.error({ error, tag: LOG_TAG }, "Failed to get audit history");
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    const logs = data as AuditLogEntry[] | null;

    return NextResponse.json({
      success: true,
      data: {
        logs,
        pagination: {
          limit,
          offset,
          hasMore: logs?.length === limit,
        },
        filters: {
          tableName,
          startDate,
          endDate,
        },
      },
    });
  } catch (error) {
    logger.error({ error, tag: LOG_TAG }, "Unexpected error in audit logs API");
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/audit-logs/cleanup
 *
 * 清理过期审计日志（管理员功能）
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { action, retentionDays = 90 } = body;

    if (action !== "cleanup") {
      return NextResponse.json(
        { success: false, error: "Invalid action" },
        { status: 400 },
      );
    }

    // 注意：清理功能可能需要管理员权限检查
    // 这里暂时只允许清理用户自己的日志
    logger.info(
      { userId: user.id, retentionDays, tag: LOG_TAG },
      "Cleanup requested",
    );

    const { data, error } = await (supabase.rpc as CallableFunction)(
      "cleanup_old_audit_logs",
      {
        p_retention_days: retentionDays,
      },
    );

    if (error) {
      logger.error({ error, tag: LOG_TAG }, "Failed to cleanup audit logs");
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        deletedCount: data as number,
        retentionDays,
      },
    });
  } catch (error) {
    logger.error({ error, tag: LOG_TAG }, "Unexpected error in cleanup");
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
