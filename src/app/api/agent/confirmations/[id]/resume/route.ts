/**
 * AI Agent 确认恢复执行 API
 *
 * POST /api/agent/confirmations/[id]/resume - 确认后恢复执行工具
 *
 * 当用户确认高风险操作后，调用此端点重新执行原始工具
 *
 * @version 1.0.0
 * @since 2026-01-09
 */

import {
  successResponse,
  badRequestError,
  notFoundError,
  internalError,
} from "@/lib/utils/api-response";
import { confirmationHandler } from "@/lib/ai-agent/core/confirmation-handler";
import { confirmationInterceptor } from "@/lib/ai-agent/safety/confirmation-interceptor";
import { toolRegistry } from "@/lib/ai-agent/tools/tool-registry";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * POST /api/agent/confirmations/[id]/resume
 * 确认后恢复执行工具
 *
 * 前置条件：确认状态必须是 "confirmed"
 * 执行流程：
 * 1. 验证确认状态
 * 2. 获取原始工具和参数
 * 3. 构建已确认的上下文
 * 4. 执行工具
 * 5. 返回结果
 */
export const POST = withAuthMiddleware<{ id: string }>(
  async (_request, { userId, params }) => {
    try {
      const { id: confirmationId } = await params;

      // 1. 检查确认状态
      const status = await confirmationInterceptor.checkConfirmationStatus(
        confirmationId,
        userId,
      );

      if (status.status === "not_found") {
        return notFoundError("确认操作不存在或无权访问");
      }

      if (status.status === "expired") {
        return badRequestError("确认操作已过期，请重新发起操作");
      }

      if (status.status === "cancelled") {
        return badRequestError("确认操作已取消");
      }

      if (status.status !== "confirmed" && status.status !== "pending") {
        return badRequestError(`确认状态无效: ${status.status}`);
      }

      // 如果是 pending 状态，先确认
      if (status.status === "pending") {
        const confirmResult = await confirmationInterceptor.confirm(
          confirmationId,
          userId,
        );
        if (!confirmResult.success) {
          return badRequestError(confirmResult.error || "确认失败");
        }
      }

      // 确保 confirmation 存在
      if (!status.confirmation) {
        return notFoundError("确认记录不存在");
      }

      const confirmation = status.confirmation;

      // 2. 获取工具
      const tool = toolRegistry.get(confirmation.toolName);
      if (!tool) {
        logger.error(
          { toolName: confirmation.toolName, confirmationId },
          "Agent confirmation resume: Tool not found",
        );
        return internalError(`工具不存在: ${confirmation.toolName}`);
      }

      // 3. 构建已确认的上下文
      const stored = confirmationHandler.get(confirmationId, userId);
      if (!stored) {
        return notFoundError("确认记录不存在");
      }
      const confirmedContext =
        confirmationHandler.buildConfirmedContext(stored);

      // 4. 执行工具（跳过拦截器，因为已确认）
      const toolParams = confirmation.params as Record<string, unknown>;
      logger.info(
        {
          userId: userId.slice(0, 8) + "...",
          confirmationId,
          toolName: confirmation.toolName,
          params: toolParams ? Object.keys(toolParams) : [],
        },
        "Agent confirmation resume: Executing tool",
      );

      const result = await tool.execute(toolParams, confirmedContext);

      // 5. 清理确认记录
      confirmationHandler.delete(confirmationId);

      logger.info(
        {
          userId: userId.slice(0, 8) + "...",
          confirmationId,
          toolName: confirmation.toolName,
          success: result.success,
        },
        "Agent confirmation resume: Tool executed",
      );

      // 根据结果类型构建响应
      const resultPayload = result.success
        ? { success: true, data: result.data }
        : { success: false, error: result.error };

      return successResponse({
        confirmationId,
        toolName: confirmation.toolName,
        executed: true,
        result: resultPayload,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error({ error: message }, "Agent confirmation resume: Failed");
      return internalError(`恢复执行失败: ${message}`);
    }
  },
);
