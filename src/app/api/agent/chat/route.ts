/**
 * AI Agent 对话 API
 *
 * POST /api/agent/chat - 与 AI Agent 对话
 *
 * 支持流式响应（Server-Sent Events）
 * 集成 KnowledgeAgent 和 Skills
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { KnowledgeAgent } from "@/lib/ai-agent";
import { logger } from "@/lib/logger";

/**
 * 请求体 Schema
 */
const agentChatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
  bookmarkIds: z.array(z.number().int().positive()).optional(),
  options: z
    .object({
      streaming: z.boolean().optional().default(true),
      maxToolRounds: z.number().int().min(1).max(10).optional(),
      temperature: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

/**
 * POST /api/agent/chat
 * 与 AI Agent 对话
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
    const validation = agentChatRequestSchema.safeParse(body);

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

    const { message, conversationId, bookmarkIds, options } = validation.data;
    const isStream = options?.streaming ?? true;

    logger.info(
      {
        userId: user.id.slice(0, 8) + "...",
        messageLength: message.length,
        conversationId,
        hasBookmarkIds: !!bookmarkIds?.length,
        isStream,
      },
      "Agent Chat: Request received",
    );

    // 3. 创建 Agent 实例
    const agent = new KnowledgeAgent();

    // 4. 构建上下文
    const context = {
      userId: user.id,
      conversationId,
      bookmarkIds,
    };

    const executeOptions = {
      streaming: isStream,
      maxToolRounds: options?.maxToolRounds || 5,
      temperature: options?.temperature || 0.7,
    };

    // 5. 处理响应
    if (isStream) {
      // 流式响应 (Server-Sent Events)
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          try {
            const streamGenerator = agent.executeStream(
              message,
              context,
              executeOptions,
            );

            for await (const chunk of streamGenerator) {
              const data = JSON.stringify(chunk);
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }

            controller.close();
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Agent 执行失败";

            logger.error(
              {
                userId: user.id.slice(0, 8) + "...",
                error: errorMessage,
              },
              "Agent Chat: Stream error",
            );

            const errorChunk = {
              type: "error",
              error: errorMessage,
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`),
            );
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } else {
      // 非流式响应
      const result = await agent.execute(message, context, executeOptions);

      logger.info(
        {
          userId: user.id.slice(0, 8) + "...",
          success: result.success,
          durationMs: result.durationMs,
          toolCallsCount: result.toolCalls.length,
        },
        "Agent Chat: Request completed",
      );

      return new Response(
        JSON.stringify({
          success: result.success,
          data: result,
        }),
        {
          status: result.success ? 200 : 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/agent/chat error",
    );

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Agent 请求处理失败",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
