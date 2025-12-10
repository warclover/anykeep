/**
 * AI 对话 API
 * POST /api/chat - 发送对话消息
 *
 * 支持流式响应（Server-Sent Events）和非流式响应
 * 集成成本控制：配额检查、用量记录、响应缓存
 *
 * Phase 4.2 + 4.4: AI 对话功能 + 成本控制
 *
 * @version 1.1.0
 * @since 2025-12-09
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { chatService, type ChatMessage } from "@/lib/chat/chat.service";
import {
  costControlService,
  generateQueryHash,
} from "@/lib/chat/cost-control.service";
import { logger } from "@/lib/logger";

/**
 * 请求体 Schema
 */
const chatRequestSchema = z.object({
  query: z.string().min(1).max(2000),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      })
    )
    .optional(),
  options: z
    .object({
      folderId: z.number().int().positive().optional(),
      bookmarkIds: z.array(z.number().int().positive()).optional(),
      limit: z.number().int().min(1).max(10).optional(),
      temperature: z.number().min(0).max(1).optional(),
      maxTokens: z.number().int().min(100).max(2000).optional(),
      stream: z.boolean().optional(),
    })
    .optional(),
});

/**
 * POST /api/chat
 * 发送对话消息
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
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. 检查用户配额
    const quotaCheck = await costControlService.canChat(user.id);

    if (!quotaCheck.allowed) {
      logger.warn(
        {
          userId: user.id.slice(0, 8) + "...",
          reason: quotaCheck.reason,
          stats: quotaCheck.stats,
        },
        "Chat: Quota exceeded"
      );

      return new Response(
        JSON.stringify({
          success: false,
          error: quotaCheck.reason,
          quotaExceeded: true,
          stats: quotaCheck.stats,
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. 解析并验证请求体
    const body = await request.json();
    const validation = chatRequestSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "请求参数无效",
          details: validation.error.issues,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { query, conversationHistory, options } = validation.data;
    const isStream = options?.stream ?? true; // 默认使用流式响应

    logger.info(
      {
        userId: user.id.slice(0, 8) + "...",
        queryLength: query.length,
        historyLength: conversationHistory?.length || 0,
        isStream,
        remainingConversations: quotaCheck.stats.remaining.conversations,
      },
      "Chat: Request received"
    );

    // 4. 检查缓存（仅非流式且无历史对话时）
    const queryHash = generateQueryHash(
      query,
      options?.folderId?.toString() || ""
    );

    if (!isStream && (!conversationHistory || conversationHistory.length === 0)) {
      const cachedResponse = await costControlService.getCachedResponse(
        user.id,
        queryHash
      );

      if (cachedResponse) {
        logger.info(
          { userId: user.id.slice(0, 8) + "...", queryHash },
          "Chat: Cache hit"
        );

        // 缓存命中不消耗配额
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              answer: cachedResponse,
              citations: [],
              metadata: { cached: true },
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // 5. 构建对话请求
    const chatRequest = {
      userId: user.id,
      query,
      conversationHistory: conversationHistory as ChatMessage[] | undefined,
      options: {
        retrieval: {
          limit: options?.limit || 5,
          folderId: options?.folderId,
          bookmarkIds: options?.bookmarkIds,
        },
        temperature: options?.temperature || 0.7,
        maxTokens: options?.maxTokens || 1000,
        stream: isStream,
      },
    };

    // 6. 处理响应
    if (isStream) {
      // 流式响应
      const encoder = new TextEncoder();
      let totalTokens = 0;

      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const event of chatService.chatStream(chatRequest)) {
              const data = JSON.stringify(event);
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));

              // 跟踪 token 使用（从 done 事件获取）
              if (event.type === "done" && event.data?.tokensUsed) {
                totalTokens = event.data.tokensUsed;
              }
            }

            // 记录用量
            await costControlService.recordUsage(user.id, totalTokens);
            logger.debug(
              { userId: user.id.slice(0, 8) + "...", tokens: totalTokens },
              "Chat: Usage recorded (stream)"
            );

            controller.close();
          } catch (error) {
            const errorEvent = {
              type: "error",
              data: {
                message:
                  error instanceof Error ? error.message : "对话生成失败",
              },
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`)
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
      const response = await chatService.chat(chatRequest);

      // 记录用量
      const tokensUsed = response.metadata?.tokensUsed || 500; // 估算默认值
      await costControlService.recordUsage(user.id, tokensUsed);

      // 缓存响应（无历史对话时）
      if (!conversationHistory || conversationHistory.length === 0) {
        await costControlService.cacheResponse(
          user.id,
          queryHash,
          response.answer
        );
      }

      logger.debug(
        { userId: user.id.slice(0, 8) + "...", tokens: tokensUsed },
        "Chat: Usage recorded (non-stream)"
      );

      return new Response(
        JSON.stringify({
          success: true,
          data: response,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/chat error"
    );

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "对话处理失败",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
