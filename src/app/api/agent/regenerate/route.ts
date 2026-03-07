/**
 * AI 重新生成 API
 *
 * POST /api/agent/regenerate - 重新生成 AI 响应
 *
 * 功能：
 * - 重新执行之前的 AI 请求
 * - 支持流式响应
 * - 保留原始上下文和工具选择
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
// Note: KnowledgeAgent imports removed - using UnifiedEngine instead
import {
  getUnifiedEngine,
  type UnifiedStreamChunk,
  explicitToolRouter,
} from "@/lib/ai-skills";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/utils/rate-limiter";
import type { ToolType } from "@/components/ai/phase4/types";
import { withAuthMiddleware } from "@/lib/api/middleware";

// =============================================================================
// 请求验证 Schema
// =============================================================================

/**
 * 上下文引用 Schema
 */
const contextReferencesSchema = z.object({
  bookmarkIds: z.array(z.number().int().positive()).optional(),
  folderIds: z.array(z.number().int().positive()).optional(),
  tagNames: z.array(z.string()).optional(),
  previousOutputId: z.string().optional(),
  searchQuery: z.string().optional(),
});

/**
 * 显式工具选择 Schema
 */
const explicitToolSchema = z.object({
  toolId: z.enum([
    "search",
    "stats",
    "organize",
    "tag",
    "dedupe",
    "summarize",
    "extract",
    "review",
    "export",
  ]),
  skipIntentClassification: z.boolean().default(true),
});

/**
 * 重新生成请求 Schema
 */
const regenerateRequestSchema = z.object({
  /** 原始用户消息 */
  originalMessage: z.string().min(1).max(2000),
  /** 会话 ID */
  conversationId: z.string().uuid(),
  /** 原始消息 ID（用于追踪） */
  originalMessageId: z.string().optional(),
  /** 关联的书签 ID */
  bookmarkIds: z.array(z.number().int().positive()).max(100).optional(),
  /** 关联的文件夹 ID */
  folderId: z.number().int().positive().optional(),
  /** 显式工具选择 */
  explicitTool: explicitToolSchema.optional(),
  /** 上下文引用 */
  contextReferences: contextReferencesSchema.optional(),
  /** 是否使用流式响应 */
  streaming: z.boolean().default(true),
});

// =============================================================================
// POST /api/agent/regenerate
// =============================================================================

export const POST = withAuthMiddleware(async (request, { userId }) => {
  const startTime = Date.now();

  // 1. 速率限制检查
  const rateLimitResult = checkRateLimit(userId, "agent_regenerate");
  if (!rateLimitResult.allowed) {
    logger.warn(
      {
        userId: userId.slice(0, 8) + "...",
        remaining: rateLimitResult.remaining,
      },
      "Agent Regenerate: Rate limit exceeded",
    );
    const retryAfterSec = Math.ceil(rateLimitResult.resetMs / 1000);
    return NextResponse.json(
      {
        success: false,
        error: "请求过于频繁，请稍后再试",
        retryAfter: retryAfterSec,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSec),
        },
      },
    );
  }

  // 2. 解析并验证请求体
  const body = await request.json();
  const validation = regenerateRequestSchema.safeParse(body);

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

  const {
    originalMessage,
    conversationId,
    originalMessageId,
    bookmarkIds,
    folderId,
    explicitTool,
    contextReferences,
    streaming,
  } = validation.data;

  logger.info(
    {
      userId: userId.slice(0, 8) + "...",
      conversationId,
      originalMessageId,
      hasExplicitTool: !!explicitTool,
      streaming,
    },
    "Agent Regenerate: Request received",
  );

  // 3. 准备请求参数（复用 unified API 的逻辑）
  const messageId = randomUUID();

  // 4. 流式响应处理
  if (streaming) {
    return handleStreamingRegenerate({
      userId,
      message: originalMessage,
      conversationId,
      messageId,
      originalMessageId,
      bookmarkIds,
      folderId,
      explicitTool,
      contextReferences,
      startTime,
    });
  }

  // 5. 非流式响应（简化版）
  return handleNonStreamingRegenerate({
    userId,
    message: originalMessage,
    conversationId,
    messageId,
    bookmarkIds,
    folderId,
    explicitTool,
    contextReferences,
    startTime,
  });
});

// =============================================================================
// 流式响应处理
// =============================================================================

interface RegenerateParams {
  userId: string;
  message: string;
  conversationId: string;
  messageId: string;
  originalMessageId?: string;
  bookmarkIds?: number[];
  folderId?: number;
  explicitTool?: z.infer<typeof explicitToolSchema>;
  contextReferences?: z.infer<typeof contextReferencesSchema>;
  startTime: number;
}

async function handleStreamingRegenerate(
  params: RegenerateParams,
): Promise<NextResponse> {
  const {
    userId,
    message,
    conversationId,
    messageId: _messageId,
    originalMessageId,
    bookmarkIds,
    folderId,
    explicitTool,
    contextReferences,
    startTime,
  } = params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendChunk = (chunk: UnifiedStreamChunk) => {
        const data = `data: ${JSON.stringify(chunk)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      try {
        // 发送开始标记
        sendChunk({
          type: "routing",
          data: {
            mode: "atomic",
            skill: null,
            reason: originalMessageId
              ? `重新生成消息 ${originalMessageId.slice(0, 8)}...`
              : "重新生成响应",
          },
        });

        // 获取统一引擎
        const engine = getUnifiedEngine();

        // 确定执行模式
        let toolType: ToolType = "auto";
        if (explicitTool) {
          toolType = explicitTool.toolId as ToolType;
        }

        // 处理显式工具选择
        if (explicitTool && explicitTool.skipIntentClassification) {
          const routeResult = explicitToolRouter.route({
            tool: toolType,
            message,
            userId,
            conversationId,
            contextReferences: contextReferences
              ? {
                  bookmarkIds: contextReferences.bookmarkIds,
                  folderIds: contextReferences.folderIds,
                  previousOutputId: contextReferences.previousOutputId,
                }
              : undefined,
          });

          sendChunk({
            type: "routing",
            data: {
              mode: routeResult.mode,
              skill: routeResult.suggestedSkill ?? null,
              reason: routeResult.reason,
            },
          });
        }

        // 执行引擎（流式）
        const streamGenerator = engine.execute(message, {
          userId,
          conversationId,
          bookmarkIds,
          folderId,
        });

        // 转发流式响应
        for await (const chunk of streamGenerator) {
          sendChunk(chunk);
        }

        // 发送完成标记
        sendChunk({
          type: "done",
          data: {
            success: true,
            durationMs: Date.now() - startTime,
            conversationId,
          },
        });

        controller.close();
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            userId: userId.slice(0, 8) + "...",
            conversationId,
          },
          "Agent Regenerate: Stream error",
        );

        sendChunk({
          type: "error",
          data: {
            message: error instanceof Error ? error.message : "重新生成失败",
          },
        });

        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// =============================================================================
// 非流式响应处理
// =============================================================================

async function handleNonStreamingRegenerate(
  params: RegenerateParams,
): Promise<NextResponse> {
  const {
    userId,
    message,
    conversationId,
    messageId,
    bookmarkIds,
    folderId,
    explicitTool: _explicitTool,
    contextReferences: _contextReferences,
    startTime,
  } = params;

  const engine = getUnifiedEngine();

  // 收集所有流式响应
  const chunks: UnifiedStreamChunk[] = [];
  let fullText = "";

  const streamGenerator = engine.execute(message, {
    userId,
    conversationId,
    bookmarkIds,
    folderId,
  });

  for await (const chunk of streamGenerator) {
    chunks.push(chunk);
    if (chunk.type === "text" && chunk.data.text) {
      fullText += chunk.data.text;
    }
  }

  // 提取交付物
  const deliverables = chunks
    .filter((c) => c.type === "deliverable")
    .map((c) => c.data);

  logger.info(
    {
      userId: userId.slice(0, 8) + "...",
      conversationId,
      messageId,
      durationMs: Date.now() - startTime,
      textLength: fullText.length,
      deliverableCount: deliverables.length,
    },
    "Agent Regenerate: Non-streaming complete",
  );

  return NextResponse.json({
    success: true,
    data: {
      messageId,
      content: fullText,
      deliverables,
      durationMs: Date.now() - startTime,
    },
  });
}
