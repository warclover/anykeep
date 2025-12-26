/**
 * AI 请求取消 API
 *
 * POST /api/agent/cancel - 取消正在执行的请求
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getRequestRegistry } from "@/lib/ai-skills/engine/request-registry";
import { logger } from "@/lib/logger";

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
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "请先登录" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = cancelRequestSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "请求参数无效",
          details: validation.error.issues,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const { requestId, reason } = validation.data;

    // 3. 获取请求注册表
    const registry = getRequestRegistry();
    const requestInfo = registry.get(requestId);

    // 4. 验证请求存在且属于当前用户
    if (!requestInfo) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "请求不存在或已完成",
          code: "REQUEST_NOT_FOUND",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    // 安全检查：只能取消自己的请求
    if (requestInfo.userId !== user.id) {
      logger.warn(
        {
          requestId,
          requestUserId: requestInfo.userId.slice(0, 8) + "...",
          callerUserId: user.id.slice(0, 8) + "...",
        },
        "Cancel API: Unauthorized cancel attempt",
      );

      return new Response(
        JSON.stringify({
          success: false,
          error: "无权取消此请求",
          code: "UNAUTHORIZED",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    // 5. 执行取消
    const cancelled = registry.cancel(requestId, reason || "用户取消");

    if (!cancelled) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "请求已被取消或已完成",
          code: "ALREADY_CANCELLED",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    logger.info(
      {
        requestId,
        userId: user.id.slice(0, 8) + "...",
        reason,
      },
      "Cancel API: Request cancelled successfully",
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "请求已取消",
        requestId,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/agent/cancel error",
    );

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "取消请求失败",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

/**
 * DELETE /api/agent/cancel
 * 取消用户的所有正在执行的请求
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
      return new Response(
        JSON.stringify({ success: false, error: "请先登录" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    // 2. 解析请求参数（可选的取消原因）
    const url = new URL(request.url);
    const reason = url.searchParams.get("reason") || "用户取消所有请求";

    // 3. 取消用户的所有请求
    const registry = getRequestRegistry();
    const cancelledCount = registry.cancelByUser(user.id, reason);

    logger.info(
      {
        userId: user.id.slice(0, 8) + "...",
        cancelledCount,
        reason,
      },
      "Cancel API: All user requests cancelled",
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `已取消 ${cancelledCount} 个请求`,
        cancelledCount,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "DELETE /api/agent/cancel error",
    );

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "取消请求失败",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
