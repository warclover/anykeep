/**
 * 文件夹排序 API 路由
 * PUT /api/folders/reorder - 批量更新文件夹排序
 *
 * V4.2.2: 使用数据库事务函数 batch_reorder_folders 确保原子性
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import {
  successResponse,
  databaseError,
  badRequestError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import {} from "@/lib/constants/messages";

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
 * 事务函数返回类型
 */
interface BatchReorderResult {
  success: boolean;
  updatedCount: number;
  requestedCount?: number;
  error?: string;
  message?: string;
}

/**
 * PUT /api/folders/reorder
 * 批量更新文件夹排序
 */
export const PUT = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();

    // 2. 解析请求体
    const body = (await request.json()) as ReorderRequest;

    if (!body.updates || !Array.isArray(body.updates)) {
      return badRequestError("Invalid request body");
    }

    if (body.updates.length === 0) {
      return successResponse({ success: true, updated: 0 });
    }

    // 3. 使用事务函数执行原子批量排序
    // 注意：直接传送数组对象，Supabase 会自动序列化为 JSONB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcResult, error: rpcError } = (await (supabase.rpc as any)(
      "batch_reorder_folders",
      {
        p_user_id: userId,
        p_updates: body.updates,
      },
    )) as { data: unknown; error: { message: string } | null };

    if (rpcError) {
      logger.error(
        {
          error: rpcError,
          updateCount: body.updates.length,
          operation: "batch_reorder_folders",
        },
        "RPC batch_reorder_folders failed",
      );
      return databaseError("排序更新失败", rpcError);
    }

    // 解析事务函数返回结果
    const result = rpcResult as unknown as BatchReorderResult;

    if (!result.success) {
      logger.error(
        {
          error: result.error,
          operation: "batch_reorder_folders",
        },
        "batch_reorder_folders returned error",
      );
      return databaseError(
        "排序更新失败",
        new Error(result.error || "Unknown error"),
      );
    }

    // P0-2 修复：检查部分成功的情况
    const requestedCount = body.updates.length;
    const updatedCount = result.updatedCount;
    const isPartialSuccess = updatedCount < requestedCount;

    if (isPartialSuccess) {
      logger.warn(
        {
          userId,
          requestedCount,
          updatedCount,
          action: "folders_reordered_partial",
        },
        "Partial folder reorder: some folders were not updated (possibly deleted or unauthorized)",
      );
    } else {
      logger.info(
        {
          userId,
          requestedCount,
          updatedCount,
          action: "folders_reordered",
        },
        "Folders reordered successfully (atomic)",
      );
    }

    return successResponse({
      success: true,
      updated: updatedCount,
      requested: requestedCount,
      // 向前端报告是否有部分失败
      partialSuccess: isPartialSuccess,
    });
  },
);
