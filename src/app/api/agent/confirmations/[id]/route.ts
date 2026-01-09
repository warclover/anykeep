/**
 * AI Agent 单个确认 API
 *
 * GET /api/agent/confirmations/[id] - 获取单个确认详情
 * PUT /api/agent/confirmations/[id] - 响应确认（确认/取消）
 * DELETE /api/agent/confirmations/[id] - 删除确认记录
 *
 * @version 1.0.0
 * @since 2026-01-09
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  badRequestError,
  notFoundError,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import { confirmationHandler } from "@/lib/ai-agent/core/confirmation-handler";
import { confirmationInterceptor } from "@/lib/ai-agent/safety/confirmation-interceptor";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/agent/confirmations/[id]
 * 获取单个确认详情
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedError("请先登录");
    }

    const { id: confirmationId } = await params;

    // 使用 interceptor 检查状态（包含过期处理）
    const status = await confirmationInterceptor.checkConfirmationStatus(
      confirmationId,
      user.id,
    );

    if (status.status === "not_found" || !status.confirmation) {
      return notFoundError("确认操作不存在或无权访问");
    }

    const confirmation = status.confirmation;

    logger.debug(
      {
        userId: user.id.slice(0, 8) + "...",
        confirmationId,
        status: status.status,
      },
      "Agent confirmation: Retrieved",
    );

    return successResponse({
      confirmationId: confirmation.confirmationId,
      toolName: confirmation.toolName,
      description: confirmation.description,
      impactSummary: confirmation.impactSummary,
      riskLevel: confirmation.riskLevel,
      affectedItems: confirmation.affectedItems,
      params: confirmation.params,
      expiresAt: confirmation.expiresAt.toISOString(),
      status: status.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error({ error: message }, "Agent confirmation: Get failed");
    return internalError(`获取确认详情失败: ${message}`);
  }
}

/**
 * PUT /api/agent/confirmations/[id]
 * 响应确认（确认/取消）
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedError("请先登录");
    }

    const { id: confirmationId } = await params;
    const body = await request.json();
    const { action } = body;

    if (!action || !["confirm", "cancel"].includes(action)) {
      return badRequestError(
        "缺少 action 参数或操作类型无效（confirm/cancel）",
      );
    }

    // 分别处理 confirm 和 cancel 以获得正确的类型推断
    if (action === "confirm") {
      const result = await confirmationInterceptor.confirm(
        confirmationId,
        user.id,
      );

      if (!result.success) {
        return badRequestError(result.error || "确认失败");
      }

      logger.info(
        {
          userId: user.id.slice(0, 8) + "...",
          confirmationId,
          action,
          toolName: result.confirmation?.toolName,
        },
        "Agent confirmation: Confirmed",
      );

      return successResponse({
        confirmationId,
        action,
        success: true,
        confirmation: result.confirmation
          ? {
              toolName: result.confirmation.toolName,
              description: result.confirmation.description,
              riskLevel: result.confirmation.riskLevel,
            }
          : undefined,
      });
    } else {
      // action === "cancel"
      const result = await confirmationInterceptor.cancel(
        confirmationId,
        user.id,
      );

      if (!result.success) {
        return badRequestError(result.error || "取消失败");
      }

      logger.info(
        {
          userId: user.id.slice(0, 8) + "...",
          confirmationId,
          action,
        },
        "Agent confirmation: Cancelled",
      );

      return successResponse({
        confirmationId,
        action,
        success: true,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error({ error: message }, "Agent confirmation: Action failed");
    return internalError(`操作确认失败: ${message}`);
  }
}

/**
 * DELETE /api/agent/confirmations/[id]
 * 删除确认记录
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedError("请先登录");
    }

    const { id: confirmationId } = await params;

    // 先检查确认是否存在且属于当前用户
    const stored = confirmationHandler.get(confirmationId, user.id);

    if (!stored) {
      return notFoundError("确认操作不存在或无权访问");
    }

    // 删除记录
    confirmationHandler.delete(confirmationId);

    logger.info(
      {
        userId: user.id.slice(0, 8) + "...",
        confirmationId,
        toolName: stored.confirmation.toolName,
      },
      "Agent confirmation: Deleted",
    );

    return successResponse({
      deleted: true,
      confirmationId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error({ error: message }, "Agent confirmation: Delete failed");
    return internalError(`删除确认失败: ${message}`);
  }
}
