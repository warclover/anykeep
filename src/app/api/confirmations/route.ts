/**
 * Pending Confirmations API
 * V4.2 待确认消息 API
 *
 * GET /api/confirmations - 获取待确认消息列表
 * POST /api/confirmations - 批量操作确认消息（支持 ids 和 confirmationIds 参数）
 *
 * @version 1.2.0
 * @since 2025-12-11
 * @updated 2025-12-14 - 合并 /api/confirmations/batch 路由
 * @updated 2026-03-07 - 迁移到 withAuthMiddleware
 */

import { successResponse, badRequestError } from "@/lib/utils/api-response";
import { confirmationService } from "@/lib/confirmation";
import type {
  ConfirmationStatus,
  ConfirmationType,
} from "@/types/confirmation";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * GET /api/confirmations
 * 获取待确认消息列表
 */
export const GET = withAuthMiddleware(async (request, { userId }) => {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as ConfirmationStatus | null;
  const type = searchParams.get("type") as ConfirmationType | null;
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const pendingOnly = searchParams.get("pendingOnly") === "true";

  // 构建过滤条件
  const filters: Parameters<
    typeof confirmationService.getUserConfirmations
  >[1] = {
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
    confirmationService.getDisplayData(userId, filters),
    confirmationService.getPendingCount(userId),
  ]);

  return successResponse({
    confirmations,
    total: confirmations.length,
    pendingCount,
    limit,
    offset,
  });
});

/**
 * POST /api/confirmations
 * 批量操作确认消息
 *
 * 支持两种参数格式（向后兼容）:
 * - { action, confirmationIds } - 原始格式
 * - { action, ids } - 简化格式
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const body = await request.json();
  const { action, confirmationIds, ids } = body;

  // 支持两种参数格式：confirmationIds 或 ids
  const targetIds = confirmationIds || ids;

  if (!action || !Array.isArray(targetIds) || targetIds.length === 0) {
    return badRequestError("缺少 action 或 ids/confirmationIds");
  }

  let result: { success: number; failed: number };

  switch (action) {
    case "confirm":
      result = await confirmationService.batchConfirm(userId, targetIds);
      break;
    case "reject":
      result = await confirmationService.batchReject(userId, targetIds);
      break;
    default:
      return badRequestError(`未知操作: ${action}`);
  }

  return successResponse({
    action,
    ...result,
    total: targetIds.length,
  });
});
