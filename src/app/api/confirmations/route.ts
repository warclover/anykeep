/**
 * Pending Confirmations API
 * V4.2 待确认消息 API
 *
 * GET /api/confirmations - 获取待确认消息列表
 * POST /api/confirmations/batch - 批量处理确认消息
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  badRequestError,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import { confirmationService } from "@/lib/confirmation";
import type { ConfirmationStatus, ConfirmationType } from "@/types/confirmation";
import type { NextRequest } from "next/server";

/**
 * GET /api/confirmations
 * 获取待确认消息列表
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedError("请先登录");
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as ConfirmationStatus | null;
    const type = searchParams.get("type") as ConfirmationType | null;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const pendingOnly = searchParams.get("pendingOnly") === "true";

    // 构建过滤条件
    const filters: Parameters<typeof confirmationService.getUserConfirmations>[1] = {
      limit,
      offset,
    };

    if (status) {
      filters.status = status;
    }

    if (type) {
      filters.type = type;
    }

    if (pendingOnly) {
      filters.pendingOnly = true;
    }

    // 获取数据
    const [confirmations, pendingCount] = await Promise.all([
      confirmationService.getDisplayData(user.id, filters),
      confirmationService.getPendingCount(user.id),
    ]);

    return successResponse({
      confirmations,
      total: confirmations.length,
      pendingCount,
      limit,
      offset,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return internalError(`获取待确认消息失败: ${message}`);
  }
}

/**
 * POST /api/confirmations
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
    const { action, confirmationIds } = body;

    if (!action || !Array.isArray(confirmationIds) || confirmationIds.length === 0) {
      return badRequestError("缺少 action 或 confirmationIds");
    }

    let result: { success: number; failed: number };

    switch (action) {
      case "confirm":
        result = await confirmationService.batchConfirm(user.id, confirmationIds);
        break;
      case "reject":
        result = await confirmationService.batchReject(user.id, confirmationIds);
        break;
      default:
        return badRequestError(`未知操作: ${action}`);
    }

    return successResponse({
      action,
      ...result,
      total: confirmationIds.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return internalError(`批量操作失败: ${message}`);
  }
}
