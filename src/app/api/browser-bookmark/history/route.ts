/**
 * 导入历史记录 API
 * GET /api/browser-bookmark/history - 获取导入历史列表
 * POST /api/browser-bookmark/history - 创建导入历史记录
 */

import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import {
  successResponse,
  badRequestError,
  databaseError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { Notify } from "@/lib/notifications/server";
import type { ImportSource, Json } from "@/types/supabase";

// 有效的导入来源列表
const VALID_IMPORT_SOURCES: ImportSource[] = [
  "browser_chrome",
  "browser_edge",
  "browser_firefox",
  "browser_safari",
  "api",
  "share_sheet",
  "manual",
];

/**
 * GET /api/browser-bookmark/history
 * 获取用户的导入历史记录
 *
 * Query params:
 * - limit: 返回数量限制 (默认 20, 最大 100)
 * - offset: 偏移量 (默认 0)
 * - source: 按导入来源筛选
 */
export const GET = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();

  // 1. 解析查询参数
  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") || "20", 10), 1),
    100,
  );
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);
  const source = searchParams.get("source") as ImportSource | null;

  // 2. 构建查询
  let query = supabase
    .from("import_history")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // 按来源筛选
  if (source && VALID_IMPORT_SOURCES.includes(source)) {
    query = query.eq("import_source", source);
  }

  // 3. 执行查询
  const { data: history, error: queryError, count } = await query;

  if (queryError) {
    logger.error(
      { error: queryError, userId },
      "Import history: Failed to fetch history",
    );
    return databaseError("获取导入历史失败", queryError);
  }

  return successResponse({
    history: history || [],
    total: count || 0,
    limit,
    offset,
  });
});

/**
 * POST /api/browser-bookmark/history
 * 创建导入历史记录
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();

  // 1. 解析请求体
  const body = await request.json();
  const {
    import_source,
    import_batch_id,
    total_count,
    success_count,
    failed_count,
    skipped_count,
    folders_created,
    duration_ms,
    error_details,
    options,
  } = body;

  // 2. 验证必填字段
  if (!import_source || !VALID_IMPORT_SOURCES.includes(import_source)) {
    return badRequestError(`无效的导入来源: ${import_source}`);
  }

  if (!import_batch_id) {
    return badRequestError("缺少导入批次 ID");
  }

  if (typeof total_count !== "number" || total_count < 0) {
    return badRequestError("total_count 必须是非负数");
  }

  // 3. 构建插入数据
  const insertData = {
    user_id: userId,
    import_source: import_source as ImportSource,
    import_batch_id,
    total_count: total_count || 0,
    success_count: success_count || 0,
    failed_count: failed_count || 0,
    skipped_count: skipped_count || 0,
    folders_created: folders_created || 0,
    duration_ms: duration_ms || null,
    error_details: (error_details || null) as Json,
    options: (options || null) as Json,
  };

  // 4. 插入数据库

  const { data: created, error: insertError } = (await (
    supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase 类型推断限制
      .from("import_history") as any
  )
    .insert(insertData)
    .select()
    .single()) as {
    data: { id: number; [key: string]: unknown } | null;
    error: { message: string } | null;
  };

  if (insertError) {
    logger.error(
      { error: insertError, userId, batchId: import_batch_id },
      "Import history: Failed to create record",
    );
    return databaseError("创建导入历史记录失败", insertError);
  }

  if (!created) {
    return databaseError("创建导入历史记录失败", { message: "返回数据为空" });
  }

  logger.info(
    {
      historyId: created.id,
      batchId: import_batch_id,
      source: import_source,
      total: total_count,
      success: success_count,
    },
    "Import history: Record created",
  );

  // 发送导入完成消息通知
  await Notify.importComplete(
    userId,
    total_count || 0,
    success_count || 0,
    String(created.id),
  ).catch((err) => {
    logger.warn({ error: err }, "Failed to create import notification");
  });

  return successResponse({
    history: created,
    message: "导入历史记录已创建",
  });
});

/**
 * DELETE /api/browser-bookmark/history
 * 删除导入历史记录
 *
 * Query params:
 * - id: 历史记录 ID
 * - batch_id: 或按批次 ID 删除
 */
export const DELETE = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();

  // 1. 解析查询参数
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const batchId = searchParams.get("batch_id");

  if (!id && !batchId) {
    return badRequestError("需要提供 id 或 batch_id 参数");
  }

  // 2. 执行删除
  let query = supabase.from("import_history").delete().eq("user_id", userId);

  if (id) {
    query = query.eq("id", parseInt(id, 10));
  } else if (batchId) {
    query = query.eq("import_batch_id", batchId);
  }

  const { error: deleteError } = await query;

  if (deleteError) {
    logger.error(
      { error: deleteError, userId, id, batchId },
      "Import history: Failed to delete record",
    );
    return databaseError("删除导入历史记录失败", deleteError);
  }

  logger.info({ userId, id, batchId }, "Import history: Record deleted");

  return successResponse({
    message: "导入历史记录已删除",
  });
});
