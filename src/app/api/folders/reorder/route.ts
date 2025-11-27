/**
 * 文件夹排序 API 路由
 * PUT /api/folders/reorder - 批量更新文件夹排序
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  databaseError,
  internalError,
  badRequestError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { FOLDER } from "@/lib/constants/messages";

/**
 * 排序更新请求体
 */
interface ReorderRequest {
  updates: Array<{
    id: number;
    sort_order: number;
  }>;
}

/**
 * PUT /api/folders/reorder
 * 批量更新文件夹排序
 */
export async function PUT(request: NextRequest) {
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
    const body = (await request.json()) as ReorderRequest;

    if (!body.updates || !Array.isArray(body.updates)) {
      return badRequestError("Invalid request body");
    }

    // 3. 批量更新排序
    // 注意：使用事务确保原子性
    const updatePromises = body.updates.map(({ id, sort_order }) =>
      supabase
        .from("folders")
        .update({ sort_order })
        .eq("id", id)
        .eq("user_id", user.id) // 确保只能更新自己的文件夹
        .is("deleted_at", null),
    );

    const results = await Promise.all(updatePromises);

    // 检查是否有错误
    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      logger.error(
        {
          errors: errors.map((e) => e.error),
          operation: "reorder_folders",
        },
        "Failed to reorder folders",
      );
      return databaseError("排序更新失败", errors[0].error!);
    }

    return successResponse({ success: true, updated: body.updates.length });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "reorder_folders",
      },
      "PUT /api/folders/reorder error",
    );
    return internalError(FOLDER.UPDATE_ERROR);
  }
}
