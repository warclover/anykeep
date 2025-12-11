/**
 * Batch Confirmations API
 * V4.3 批量处理确认消息
 *
 * POST /api/confirmations/batch - 批量确认/拒绝
 *
 * @version 1.0.0
 * @since 2025-12-12
 */

import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  badRequestError,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import { confirmationService } from "@/lib/confirmation";
import type { NextRequest } from "next/server";

/**
 * POST /api/confirmations/batch
 * 批量操作确认消息
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedError("请先登录");
    }

    const body = await request.json();
    const { action, ids } = body;

    if (!action || !Array.isArray(ids) || ids.length === 0) {
      return badRequestError("缺少 action 或 ids");
    }

    let result: { success: number; failed: number };

    switch (action) {
      case "confirm":
        result = await confirmationService.batchConfirm(user.id, ids);
        break;
      case "reject":
        result = await confirmationService.batchReject(user.id, ids);
        break;
      default:
        return badRequestError(`未知操作: ${action}`);
    }

    return successResponse({
      action,
      ...result,
      total: ids.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return internalError(`批量操作失败: ${message}`);
  }
}
