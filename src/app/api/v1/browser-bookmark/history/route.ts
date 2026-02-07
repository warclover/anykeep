/**
 * Browser Bookmark History API v1
 *
 * GET    /api/v1/browser-bookmark/history - 获取导入历史列表
 * POST   /api/v1/browser-bookmark/history - 创建导入历史记录
 * DELETE /api/v1/browser-bookmark/history - 删除导入历史记录
 *
 * @module api/v1/browser-bookmark/history
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { Notify } from "@/lib/notifications/server";
import type { ImportSource, Json } from "@/types/supabase";

const VALID_IMPORT_SOURCES: ImportSource[] = [
  "browser_chrome",
  "browser_edge",
  "browser_firefox",
  "browser_safari",
  "api",
  "share_sheet",
  "manual",
];

// 查询参数 Schema
const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  source: z
    .enum(VALID_IMPORT_SOURCES as [ImportSource, ...ImportSource[]])
    .optional(),
});

// 创建历史 Schema
const CreateHistorySchema = z.object({
  import_source: z.enum(
    VALID_IMPORT_SOURCES as [ImportSource, ...ImportSource[]],
  ),
  import_batch_id: z.string().min(1),
  total_count: z.number().int().min(0),
  success_count: z.number().int().min(0).default(0),
  failed_count: z.number().int().min(0).default(0),
  skipped_count: z.number().int().min(0).default(0),
  folders_created: z.number().int().min(0).default(0),
  duration_ms: z.number().int().min(0).optional(),
  error_details: z.unknown().optional(),
  options: z.unknown().optional(),
});

/**
 * GET /api/v1/browser-bookmark/history
 * 获取导入历史列表
 */
export const GET = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const params = QuerySchema.safeParse({
      limit: searchParams.get("limit") || 20,
      offset: searchParams.get("offset") || 0,
      source: searchParams.get("source") || undefined,
    });

    if (!params.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "查询参数验证失败",
            details: params.error.flatten().fieldErrors,
          },
        },
        { status: 400 },
      );
    }

    const { limit, offset, source } = params.data;

    // 构建查询
    let query = supabase
      .from("import_history")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (source) {
      query = query.eq("import_source", source);
    }

    const { data: history, error, count } = await query;

    if (error) {
      logger.error(
        { error: error.message, userId },
        "[v1] Failed to fetch import history",
      );
      return NextResponse.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "获取导入历史失败" },
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        items: history || [],
        total: count || 0,
        limit,
        offset,
      },
    });
  },
);

/**
 * POST /api/v1/browser-bookmark/history
 * 创建导入历史记录
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();

    // 解析请求体
    const body = await request.json();
    const validation = CreateHistorySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "请求参数验证失败",
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 },
      );
    }

    const data = validation.data;

    // 插入数据库
    const insertResult = await supabase
      .from("import_history")
      .insert({
        user_id: userId,
        import_source: data.import_source,
        import_batch_id: data.import_batch_id,
        total_count: data.total_count,
        success_count: data.success_count,
        failed_count: data.failed_count,
        skipped_count: data.skipped_count,
        folders_created: data.folders_created,
        duration_ms: data.duration_ms || null,
        error_details: (data.error_details || null) as Json,
        options: (data.options || null) as Json,
      })
      .select()
      .single();

    const created = insertResult.data as { id: number } | null;
    const error = insertResult.error as { message: string } | null;

    if (error || !created) {
      logger.error(
        { error: error?.message, userId },
        "[v1] Failed to create import history",
      );
      return NextResponse.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "创建导入历史记录失败" },
        },
        { status: 500 },
      );
    }

    logger.info(
      {
        historyId: created.id,
        batchId: data.import_batch_id,
        source: data.import_source,
        total: data.total_count,
        success: data.success_count,
      },
      "[v1] Import history created",
    );

    // 发送通知
    await Notify.importComplete(
      userId,
      data.total_count,
      data.success_count,
      String(created.id),
    ).catch((err) => {
      logger.warn({ error: err }, "[v1] Failed to create import notification");
    });

    return NextResponse.json({
      success: true,
      data: {
        id: created.id,
        message: "导入历史记录已创建",
      },
    });
  },
);

/**
 * DELETE /api/v1/browser-bookmark/history
 * 删除导入历史记录
 */
export const DELETE = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const id = searchParams.get("id");
    const batchId = searchParams.get("batch_id");

    if (!id && !batchId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "需要提供 id 或 batch_id 参数",
          },
        },
        { status: 400 },
      );
    }

    let query = supabase.from("import_history").delete().eq("user_id", userId);

    if (id) {
      query = query.eq("id", parseInt(id, 10));
    } else if (batchId) {
      query = query.eq("import_batch_id", batchId);
    }

    const { error } = await query;

    if (error) {
      logger.error(
        { error: error.message, userId },
        "[v1] Failed to delete import history",
      );
      return NextResponse.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "删除导入历史记录失败" },
        },
        { status: 500 },
      );
    }

    logger.info({ userId, id, batchId }, "[v1] Import history deleted");

    return NextResponse.json({
      success: true,
      data: { message: "导入历史记录已删除" },
    });
  },
);
