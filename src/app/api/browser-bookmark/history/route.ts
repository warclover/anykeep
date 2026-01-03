/**
 * 导入历史记录 API
 * GET /api/browser-bookmark/history - 获取导入历史列表
 * POST /api/browser-bookmark/history - 创建导入历史记录
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  badRequestError,
  databaseError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { MessageService } from "@/lib/messages/server";
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
export async function GET(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 解析查询参数
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "20", 10), 1),
      100,
    );
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);
    const source = searchParams.get("source") as ImportSource | null;

    // 3. 构建查询
    let query = supabase
      .from("import_history")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // 按来源筛选
    if (source && VALID_IMPORT_SOURCES.includes(source)) {
      query = query.eq("import_source", source);
    }

    // 4. 执行查询
    const { data: history, error: queryError, count } = await query;

    if (queryError) {
      logger.error(
        { error: queryError, userId: user.id },
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
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Import history: Unexpected error in GET",
    );
    return badRequestError("获取导入历史失败");
  }
}

/**
 * POST /api/browser-bookmark/history
 * 创建导入历史记录
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 解析请求体
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

    // 3. 验证必填字段
    if (!import_source || !VALID_IMPORT_SOURCES.includes(import_source)) {
      return badRequestError(`无效的导入来源: ${import_source}`);
    }

    if (!import_batch_id) {
      return badRequestError("缺少导入批次 ID");
    }

    if (typeof total_count !== "number" || total_count < 0) {
      return badRequestError("total_count 必须是非负数");
    }

    // 4. 构建插入数据
    const insertData = {
      user_id: user.id,
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

    // 5. 插入数据库
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created, error: insertError } = await (supabase
      .from("import_history") as any)
      .insert(insertData)
      .select()
      .single() as { data: { id: number; [key: string]: unknown } | null; error: { message: string } | null };

    if (insertError) {
      logger.error(
        { error: insertError, userId: user.id, batchId: import_batch_id },
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
    await MessageService.notifyImportComplete(
      user.id,
      created.id,
      total_count || 0,
      success_count || 0,
      failed_count || 0,
      "浏览器书签", // 默认文件夹名称
    ).catch((err) => {
      logger.warn({ error: err }, "Failed to create import message");
    });

    return successResponse({
      history: created,
      message: "导入历史记录已创建",
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Import history: Unexpected error in POST",
    );
    return badRequestError("创建导入历史记录失败");
  }
}

/**
 * DELETE /api/browser-bookmark/history
 * 删除导入历史记录
 *
 * Query params:
 * - id: 历史记录 ID
 * - batch_id: 或按批次 ID 删除
 */
export async function DELETE(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 解析查询参数
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const batchId = searchParams.get("batch_id");

    if (!id && !batchId) {
      return badRequestError("需要提供 id 或 batch_id 参数");
    }

    // 3. 执行删除
    let query = supabase.from("import_history").delete().eq("user_id", user.id);

    if (id) {
      query = query.eq("id", parseInt(id, 10));
    } else if (batchId) {
      query = query.eq("import_batch_id", batchId);
    }

    const { error: deleteError } = await query;

    if (deleteError) {
      logger.error(
        { error: deleteError, userId: user.id, id, batchId },
        "Import history: Failed to delete record",
      );
      return databaseError("删除导入历史记录失败", deleteError);
    }

    logger.info(
      { userId: user.id, id, batchId },
      "Import history: Record deleted",
    );

    return successResponse({
      message: "导入历史记录已删除",
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Import history: Unexpected error in DELETE",
    );
    return badRequestError("删除导入历史记录失败");
  }
}
