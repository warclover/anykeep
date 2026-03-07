/**
 * AI 请求取消 API
 *
 * POST /api/agent/cancel - 取消正在执行的请求
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestRegistry } from "@/lib/ai-skills/engine/request-registry";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * 请求体 Schema
 */
const cancelRequestSchema = z.object({
  /** 要取消的请求 ID */
  requestId: z.string().min(1),
  /** 取消原因（可选） */
  reason: z.string().max(200).optional(),
});

/**
 * POST /api/agent/cancel
 * 取消正在执行的 AI 请求
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  // 1. 解析并验证请求体
  const body = await request.json();
  const validation = cancelRequestSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        error: "请求参数无效",
        details: validation.error.issues,
      },
      { status: 400 },
    );
  }

  const { requestId, reason } = validation.data;

  // 2. 获取请求注册表
  const registry = getRequestRegistry();
  const requestInfo = registry.get(requestId);

  // 3. 验证请求存在且属于当前用户
  if (!requestInfo) {
    return NextResponse.json(
      {
        success: false,
        error: "请求不存在或已完成",
        code: "REQUEST_NOT_FOUND",
      },
      { status: 404 },
    );
  }

  // 安全检查：只能取消自己的请求
  if (requestInfo.userId !== userId) {
    logger.warn(
      {
        requestId,
        requestUserId: requestInfo.userId.slice(0, 8) + "...",
        callerUserId: userId.slice(0, 8) + "...",
      },
      "Cancel API: Unauthorized cancel attempt",
    );

    return NextResponse.json(
      {
        success: false,
        error: "无权取消此请求",
        code: "UNAUTHORIZED",
      },
      { status: 403 },
    );
  }

  // 4. 执行取消
  const cancelled = registry.cancel(requestId, reason || "用户取消");

  if (!cancelled) {
    return NextResponse.json(
      {
        success: false,
        error: "请求已被取消或已完成",
        code: "ALREADY_CANCELLED",
      },
      { status: 400 },
    );
  }

  logger.info(
    {
      requestId,
      userId: userId.slice(0, 8) + "...",
      reason,
    },
    "Cancel API: Request cancelled successfully",
  );

  return NextResponse.json({
    success: true,
    message: "请求已取消",
    requestId,
  });
});

/**
 * DELETE /api/agent/cancel
 * 取消用户的所有正在执行的请求
 */
export const DELETE = withAuthMiddleware(async (request, { userId }) => {
  // 1. 解析请求参数（可选的取消原因）
  const url = new URL(request.url);
  const reason = url.searchParams.get("reason") || "用户取消所有请求";

  // 2. 取消用户的所有请求
  const registry = getRequestRegistry();
  const cancelledCount = registry.cancelByUser(userId, reason);

  logger.info(
    {
      userId: userId.slice(0, 8) + "...",
      cancelledCount,
      reason,
    },
    "Cancel API: All user requests cancelled",
  );

  return NextResponse.json({
    success: true,
    message: `已取消 ${cancelledCount} 个请求`,
    cancelledCount,
  });
});
