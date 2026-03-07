/**
 * AI Agent 确认 API
 *
 * GET /api/agent/confirmations - 获取用户待确认操作列表
 * POST /api/agent/confirmations - 批量操作确认（确认/取消）
 *
 * 处理 AI Agent 高风险操作的确认流程
 *
 * @version 1.0.0
 * @since 2026-01-09
 */

import {
  successResponse,
  badRequestError,
  internalError,
} from "@/lib/utils/api-response";
import { confirmationHandler } from "@/lib/ai-agent/core/confirmation-handler";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * GET /api/agent/confirmations
 * 获取用户待确认操作列表
 */
export const GET = withAuthMiddleware(async (request, { userId }) => {
  try {
    const { searchParams } = new URL(request.url);
    const includeExpired = searchParams.get("includeExpired") === "true";

    // 获取用户的待确认操作
    const confirmations = confirmationHandler.getUserPendingConfirmations(
      userId,
      includeExpired,
    );

    // 获取待确认数量
    const pendingCount = confirmationHandler.getUserPendingCount(userId);

    logger.debug(
      {
        userId: userId.slice(0, 8) + "...",
        total: confirmations.length,
        pendingCount,
      },
      "Agent confirmations: List retrieved",
    );

    return successResponse({
      confirmations: confirmations.map((stored) => ({
        confirmationId: stored.confirmation.confirmationId,
        toolName: stored.confirmation.toolName,
        description: stored.confirmation.description,
        impactSummary: stored.confirmation.impactSummary,
        riskLevel: stored.confirmation.riskLevel,
        affectedItems: stored.confirmation.affectedItems,
        expiresAt: stored.confirmation.expiresAt.toISOString(),
        state: stored.state,
        createdAt: stored.createdAt.toISOString(),
      })),
      total: confirmations.length,
      pendingCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error({ error: message }, "Agent confirmations: List failed");
    return internalError(`获取待确认操作失败: ${message}`);
  }
});

/**
 * POST /api/agent/confirmations
 * 批量操作确认
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  try {
    const body = await request.json();
    const { action, confirmationIds } = body;

    if (
      !action ||
      !Array.isArray(confirmationIds) ||
      confirmationIds.length === 0
    ) {
      return badRequestError("缺少 action 或 confirmationIds");
    }

    if (!["confirm", "cancel"].includes(action)) {
      return badRequestError(`未知操作: ${action}`);
    }

    let result: { success: number; failed: number };

    if (action === "confirm") {
      result = confirmationHandler.batchConfirm(confirmationIds, userId);
    } else {
      result = confirmationHandler.batchCancel(confirmationIds, userId);
    }

    logger.info(
      {
        userId: userId.slice(0, 8) + "...",
        action,
        total: confirmationIds.length,
        success: result.success,
        failed: result.failed,
      },
      "Agent confirmations: Batch action completed",
    );

    return successResponse({
      action,
      ...result,
      total: confirmationIds.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(
      { error: message },
      "Agent confirmations: Batch action failed",
    );
    return internalError(`批量操作失败: ${message}`);
  }
});
