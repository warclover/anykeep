/**
 * AI 统一智能 API
 *
 * POST /api/agent/unified - 统一智能入口
 *
 * 支持：
 * - 智能路由（自动选择原子模式或编排模式）
 * - 流式响应（Server-Sent Events）
 * - 统一输出协议
 * - 渐进式启用
 * - 请求取消支持
 *
 * @version 1.1.0
 * @since 2025-12-24
 * @updated 2025-12-27 - 添加请求取消支持
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import {
  KnowledgeAgent,
  agentMemory,
  getQuickStats,
  formatStatsForPrompt,
} from "@/lib/ai-agent";
import {
  getEpisodicMemoryService,
  isEmptyMemoryContext,
} from "@/lib/ai-agent/memory";
import { FeatureFlags } from "@/lib/ai-agent/config/feature-flags";
import {
  getUnifiedEngine,
  type UnifiedStreamChunk,
  explicitToolRouter,
} from "@/lib/ai-skills";
import { getRequestRegistry } from "@/lib/ai-skills/engine/request-registry";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/utils/rate-limiter";
import type { ToolType } from "@/components/ai/phase4/types";

/**
 * 请求体 Schema
 */
const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

/**
 * Phase 4: 显式工具选择 Schema
 */
const explicitToolSchema = z.object({
  /** 用户选择的工具 ID */
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
  /** 是否跳过意图分类 */
  skipIntentClassification: z.boolean().default(true),
});

/**
 * Phase 4: 上下文引用 Schema
 */
const contextReferencesSchema = z.object({
  /** 书签 ID 列表 */
  bookmarkIds: z.array(z.number().int().positive()).optional(),
  /** 文件夹 ID 列表 */
  folderIds: z.array(z.number().int().positive()).optional(),
  /** 标签名称列表 */
  tagNames: z.array(z.string()).optional(),
  /** 前次输出的消息 ID */
  previousOutputId: z.string().optional(),
  /** 搜索查询 */
  searchQuery: z.string().optional(),
});

const unifiedChatRequestSchema = z.object({
  /** 用户消息 */
  message: z.string().min(1).max(2000),
  /** 会话 ID */
  conversationId: z.string().uuid().optional(),
  /** 前端维护的消息历史（限制最多 50 条） */
  messageHistory: z.array(messageSchema).max(50).optional(),
  /** 关联的书签 ID（限制最多 100 个） */
  bookmarkIds: z.array(z.number().int().positive()).max(100).optional(),
  /** 关联的文件夹 ID */
  folderId: z.number().int().positive().optional(),
  /** Phase 4: 显式工具选择 */
  explicitTool: explicitToolSchema.optional(),
  /** Phase 4: 上下文引用 */
  contextReferences: contextReferencesSchema.optional(),
  /** 附件上下文（用户提供的收藏/文件内容） */
  attachmentContext: z.string().max(20000).optional(),
  /** 执行选项 */
  options: z
    .object({
      /** 是否启用统一引擎 */
      enableUnified: z.boolean().optional().default(true),
      /** 是否启用流式响应 */
      streaming: z.boolean().optional().default(true),
      /** 是否包含路由信息（调试用） */
      includeRoutingInfo: z.boolean().optional().default(false),
      /** 强制使用指定模式 */
      forceMode: z.enum(["atomic", "orchestration"]).optional(),
      /** 强制使用指定 Skill */
      forceSkill: z.string().optional(),
      /** 最大工具调用轮数 */
      maxToolRounds: z.number().int().min(1).max(10).optional(),
      /** 温度参数 */
      temperature: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

// 环境变量配置
const UNIFIED_ENGINE_ENABLED =
  process.env.UNIFIED_ENGINE_ENABLED === "true" || true; // 默认启用

/**
 * POST /api/agent/unified
 * 统一智能入口
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

    // 1.5 速率限制检查
    const rateLimitResult = checkRateLimit(user.id, "/api/agent/unified");
    if (!rateLimitResult.allowed) {
      logger.warn(
        {
          userId: user.id.slice(0, 8) + "...",
          remaining: rateLimitResult.remaining,
          resetMs: rateLimitResult.resetMs,
        },
        "Unified API: Rate limit exceeded",
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: "请求过于频繁，请稍后再试",
          retryAfter: Math.ceil(rateLimitResult.resetMs / 1000),
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": "0",
            "Retry-After": Math.ceil(rateLimitResult.resetMs / 1000).toString(),
          },
        },
      );
    }

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = unifiedChatRequestSchema.safeParse(body);

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

    const {
      message,
      conversationId: providedConversationId,
      messageHistory,
      bookmarkIds,
      folderId,
      explicitTool,
      contextReferences,
      attachmentContext,
      options,
    } = validation.data;

    // 确保有会话 ID（用于记忆功能）
    const conversationId = providedConversationId || randomUUID();

    const isStream = options?.streaming ?? true;
    const enableUnified =
      UNIFIED_ENGINE_ENABLED && (options?.enableUnified ?? true);

    // Phase 4: 处理显式工具选择
    let forceMode = options?.forceMode;
    let forceSkill = options?.forceSkill;

    if (explicitTool?.skipIntentClassification) {
      const explicitRoute = explicitToolRouter.route({
        tool: explicitTool.toolId as ToolType,
        message,
        userId: user.id,
        conversationId,
        contextReferences: contextReferences
          ? {
              bookmarkIds: contextReferences.bookmarkIds,
              folderIds: contextReferences.folderIds,
              previousOutputId: contextReferences.previousOutputId,
            }
          : undefined,
      });

      forceMode = explicitRoute.mode;
      forceSkill = explicitRoute.suggestedSkill || undefined;

      logger.info(
        {
          explicitTool: explicitTool.toolId,
          routedMode: forceMode,
          routedSkill: forceSkill,
          routingDurationMs: explicitRoute.routingDurationMs,
        },
        "Unified API: Explicit tool routing applied",
      );
    }

    // 合并上下文引用中的书签 ID
    const allBookmarkIds = [
      ...(bookmarkIds || []),
      ...(contextReferences?.bookmarkIds || []),
    ];

    logger.info(
      {
        userId: user.id.slice(0, 8) + "...",
        messageLength: message.length,
        conversationId,
        enableUnified,
        isStream,
        forceMode,
        forceSkill,
        hasExplicitTool: !!explicitTool,
        hasContextReferences: !!contextReferences,
      },
      "Unified API: Request received",
    );

    // 3. 获取用户数据统计
    const quickStats = await getQuickStats(user.id);
    const statsContext = formatStatsForPrompt(quickStats);

    // 3.5 获取情景记忆（如果启用）
    let episodicMemory = undefined;
    if (FeatureFlags.ENABLE_EPISODIC_MEMORY) {
      try {
        const memoryService = getEpisodicMemoryService();
        const memoryContext = await memoryService.getMemoryContext(user.id);
        if (!isEmptyMemoryContext(memoryContext)) {
          episodicMemory = memoryContext;
          logger.debug(
            {
              userId: user.id.slice(0, 8) + "...",
              hasSummaries: memoryContext.recentSummaries.length > 0,
              pendingIntents: memoryContext.pendingIntents.length,
              hasPreferences: !!memoryContext.preferences,
            },
            "Unified API: Loaded episodic memory",
          );
        }
      } catch (error) {
        // 情景记忆加载失败不应阻塞主流程
        logger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
            userId: user.id.slice(0, 8) + "...",
          },
          "Unified API: Failed to load episodic memory, continuing without it",
        );
      }
    }

    // 4. 决定使用哪种模式
    const unifiedEngine = getUnifiedEngine();

    if (enableUnified && unifiedEngine.isReady()) {
      // 使用统一引擎
      return handleUnifiedEngine(
        message,
        {
          userId: user.id,
          conversationId,
          bookmarkIds: allBookmarkIds.length > 0 ? allBookmarkIds : undefined,
          folderId: folderId || contextReferences?.folderIds?.[0],
          messageHistory: messageHistory?.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          totalBookmarks: quickStats.totalBookmarks,
          totalFolders: quickStats.folderCount,
          debug: options?.includeRoutingInfo,
          attachmentContext,
          episodicMemory, // 传递情景记忆
        },
        {
          includeRoutingInfo: options?.includeRoutingInfo,
          forceMode,
          forceSkill,
        },
        isStream,
        user.id,
      );
    } else {
      // 回退到原有 KnowledgeAgent
      return handleKnowledgeAgent(
        message,
        {
          userId: user.id,
          conversationId,
          bookmarkIds: allBookmarkIds.length > 0 ? allBookmarkIds : undefined,
          messageHistory: messageHistory?.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          systemPrompt: statsContext,
          attachmentContext,
        },
        {
          streaming: isStream,
          maxToolRounds: options?.maxToolRounds || 5,
          temperature: options?.temperature || 0.7,
        },
        user.id,
      );
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/agent/unified error",
    );

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "请求处理失败",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

/**
 * 使用统一引擎处理请求
 */
async function handleUnifiedEngine(
  message: string,
  context: Parameters<ReturnType<typeof getUnifiedEngine>["execute"]>[1],
  options: Parameters<ReturnType<typeof getUnifiedEngine>["execute"]>[2],
  isStream: boolean,
  userId: string,
): Promise<Response> {
  const unifiedEngine = getUnifiedEngine();
  const registry = getRequestRegistry();

  // 生成请求 ID 并注册
  const requestId = `req-${randomUUID()}`;
  const requestInfo = registry.register(
    requestId,
    userId,
    message.slice(0, 50),
  );

  // 将取消信号和令牌添加到上下文
  const contextWithCancellation = {
    ...context,
    signal: requestInfo.abortController.signal,
    cancellationToken: requestInfo.cancellationTokenSource.token,
    requestId,
  };

  if (isStream) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 首先发送请求 ID（用于取消）
          const initChunk: UnifiedStreamChunk = {
            type: "init" as "text", // 使用 text 类型承载 init 信息
            data: {
              text: "", // 空文本
              requestId, // 附加请求 ID
            } as { text: string; requestId?: string },
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(initChunk)}\n\n`),
          );

          for await (const chunk of unifiedEngine.execute(
            message,
            contextWithCancellation,
            options,
          )) {
            // 检查是否已取消
            if (requestInfo.isCancelled) {
              const cancelledChunk: UnifiedStreamChunk = {
                type: "cancelled" as "error",
                data: {
                  message: "请求已取消",
                  code: "CANCELLED",
                  retryable: false,
                },
              };
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(cancelledChunk)}\n\n`),
              );
              break;
            }

            const data = JSON.stringify(chunk);

            // Debug: 记录 deliverable 块的大小
            if (chunk.type === "deliverable") {
              logger.info(
                {
                  chunkType: chunk.type,
                  dataLength: data.length,
                  contentPreview: data.slice(0, 300),
                },
                "Unified API: Sending deliverable chunk",
              );
            }
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
          controller.close();
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "统一引擎执行失败";

          logger.error(
            {
              userId: userId.slice(0, 8) + "...",
              error: errorMessage,
              requestId,
            },
            "Unified API: Stream error",
          );

          const errorChunk: UnifiedStreamChunk = {
            type: "error",
            data: {
              message: errorMessage,
              retryable: true,
            },
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`),
          );
          controller.close();
        } finally {
          // 清理请求注册
          registry.unregister(requestId);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Request-Id": requestId, // 在响应头中也返回请求 ID
      },
    });
  } else {
    // 非流式：收集所有输出
    try {
      const chunks: UnifiedStreamChunk[] = [];

      for await (const chunk of unifiedEngine.execute(
        message,
        contextWithCancellation,
        options,
      )) {
        chunks.push(chunk);
      }

      // 查找最后的 done 块
      const doneChunk = chunks.find((c) => c.type === "done");

      return new Response(
        JSON.stringify({
          success: doneChunk?.data?.success ?? false,
          requestId,
          data: {
            chunks,
            summary: doneChunk?.data?.summary,
            mode: doneChunk?.data?.mode,
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        },
      );
    } finally {
      // 清理请求注册
      registry.unregister(requestId);
    }
  }
}

/**
 * 使用原有 KnowledgeAgent 处理请求
 */
async function handleKnowledgeAgent(
  message: string,
  context: {
    userId: string;
    conversationId?: string;
    bookmarkIds?: number[];
    messageHistory?: Array<{ role: "user" | "assistant"; content: string }>;
    systemPrompt?: string;
    attachmentContext?: string;
  },
  options: {
    streaming: boolean;
    maxToolRounds: number;
    temperature: number;
  },
  userId: string,
): Promise<Response> {
  const agent = new KnowledgeAgent({}, agentMemory);

  // 构建完整的 System Prompt（包含附件上下文）
  let fullSystemPrompt = agent.getConfig().systemPrompt;

  if (context.systemPrompt) {
    fullSystemPrompt = `${fullSystemPrompt}\n\n${context.systemPrompt}`;
  }

  if (context.attachmentContext) {
    fullSystemPrompt = `${fullSystemPrompt}\n\n${context.attachmentContext}`;
  }

  // 注入统计数据到 System Prompt
  const agentContext = {
    userId: context.userId,
    conversationId: context.conversationId,
    bookmarkIds: context.bookmarkIds,
    messageHistory: context.messageHistory,
    systemPrompt:
      fullSystemPrompt !== agent.getConfig().systemPrompt
        ? fullSystemPrompt
        : undefined,
  };

  if (options.streaming) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const streamGenerator = agent.executeStream(
            message,
            agentContext,
            options,
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
              userId: userId.slice(0, 8) + "...",
              error: errorMessage,
            },
            "Unified API: Agent stream error",
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
    const result = await agent.execute(message, agentContext, options);

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
}
