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
 *
 * @version 1.0.0
 * @since 2025-12-24
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
  getUnifiedEngine,
  type UnifiedStreamChunk,
  explicitToolRouter,
} from "@/lib/ai-skills";
import { logger } from "@/lib/logger";
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
  /** 前端维护的消息历史 */
  messageHistory: z.array(messageSchema).optional(),
  /** 关联的书签 ID */
  bookmarkIds: z.array(z.number().int().positive()).optional(),
  /** 关联的文件夹 ID */
  folderId: z.number().int().positive().optional(),
  /** Phase 4: 显式工具选择 */
  explicitTool: explicitToolSchema.optional(),
  /** Phase 4: 上下文引用 */
  contextReferences: contextReferencesSchema.optional(),
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

  if (isStream) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of unifiedEngine.execute(
            message,
            context,
            options,
          )) {
            const data = JSON.stringify(chunk);
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
    // 非流式：收集所有输出
    const chunks: UnifiedStreamChunk[] = [];

    for await (const chunk of unifiedEngine.execute(
      message,
      context,
      options,
    )) {
      chunks.push(chunk);
    }

    // 查找最后的 done 块
    const doneChunk = chunks.find((c) => c.type === "done");

    return new Response(
      JSON.stringify({
        success: doneChunk?.data?.success ?? false,
        data: {
          chunks,
          summary: doneChunk?.data?.summary,
          mode: doneChunk?.data?.mode,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
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
  },
  options: {
    streaming: boolean;
    maxToolRounds: number;
    temperature: number;
  },
  userId: string,
): Promise<Response> {
  const agent = new KnowledgeAgent({}, agentMemory);

  // 注入统计数据到 System Prompt
  const agentContext = {
    userId: context.userId,
    conversationId: context.conversationId,
    bookmarkIds: context.bookmarkIds,
    messageHistory: context.messageHistory,
    systemPrompt: context.systemPrompt
      ? `${agent.getConfig().systemPrompt}\n\n${context.systemPrompt}`
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
