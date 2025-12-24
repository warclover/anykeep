/**
 * AI Agent 确认操作 API (V1.0.0 - Deprecated)
 *
 * @deprecated 此端点已弃用，建议使用统一的流式响应处理确认：
 * - Tool 确认：通过 /api/agent/chat 流式响应中的 confirmation 块处理
 * - Skill 确认：通过 /api/agent/unified 流式响应中的 confirmation 块处理
 *
 * 此端点仍保留以向后兼容，但会在响应头中包含弃用警告。
 *
 * POST /api/agent/confirm - 确认执行待确认的 AI 操作
 *
 * @version 1.0.0 - Deprecated
 * @deprecated 2025-12-24
 * @since 2025-12-23
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { toolRegistry, registerDefaultTools } from "@/lib/ai-agent/tools";
import { logger } from "@/lib/logger";

// 确保 Tools 已注册
registerDefaultTools();

/**
 * 请求体 Schema
 */
const confirmRequestSchema = z.object({
  confirmationId: z.string().min(1),
  toolName: z.string().min(1),
  params: z.record(z.string(), z.unknown()),
  action: z.enum(["confirm", "cancel"]),
});

/**
 * POST /api/agent/confirm
 * @deprecated Use streaming confirmation responses instead
 * 确认或取消 AI 操作
 */
export async function POST(request: NextRequest) {
  // Log deprecation warning
  logger.warn(
    { endpoint: "/api/agent/confirm", method: "POST" },
    "Deprecated endpoint called. Use streaming confirmation responses instead.",
  );

  // Common deprecation headers
  const deprecationHeaders = {
    "Content-Type": "application/json",
    Deprecation: "true",
    Sunset: "2025-06-01",
    Link: '</api/agent/unified>; rel="successor-version"',
    "X-Deprecation-Notice":
      "This endpoint is deprecated. Use /api/agent/unified or /api/agent/chat streaming responses instead.",
  };

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
        { status: 401, headers: deprecationHeaders },
      );
    }

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = confirmRequestSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "请求参数无效",
          details: validation.error.issues,
        }),
        { status: 400, headers: deprecationHeaders },
      );
    }

    const { confirmationId, toolName, params, action } = validation.data;

    logger.info(
      {
        userId: user.id.slice(0, 8) + "...",
        confirmationId,
        toolName,
        action,
      },
      "Agent Confirm: Request received",
    );

    // 3. 如果是取消操作，直接返回
    if (action === "cancel") {
      logger.info(
        {
          userId: user.id.slice(0, 8) + "...",
          confirmationId,
          toolName,
        },
        "Agent Confirm: Operation cancelled",
      );

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            cancelled: true,
            confirmationId,
            message: "操作已取消",
          },
        }),
        {
          status: 200,
          headers: deprecationHeaders,
        },
      );
    }

    // 4. 检查 Tool 是否存在
    if (!toolRegistry.has(toolName)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `未知的操作类型: ${toolName}`,
        }),
        { status: 400, headers: deprecationHeaders },
      );
    }

    // 5. 执行已确认的 Tool
    const context = {
      userId: user.id,
      confirmed: true,
      confirmationId,
    };

    const result = await toolRegistry.execute(toolName, params, context);

    logger.info(
      {
        userId: user.id.slice(0, 8) + "...",
        confirmationId,
        toolName,
        success: result.success,
      },
      "Agent Confirm: Operation executed",
    );

    return new Response(
      JSON.stringify({
        success: result.success,
        data: result.success ? result.data : undefined,
        error: result.success ? undefined : result.error,
      }),
      {
        status: result.success ? 200 : 500,
        headers: deprecationHeaders,
      },
    );
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/agent/confirm error",
    );

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "确认操作处理失败",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          Deprecation: "true",
          Sunset: "2025-06-01",
          Link: '</api/agent/unified>; rel="successor-version"',
          "X-Deprecation-Notice":
            "This endpoint is deprecated. Use /api/agent/unified or /api/agent/chat streaming responses instead.",
        },
      },
    );
  }
}
