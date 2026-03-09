/**
 * 插件专用 - AI Agent 聊天端点
 *
 * POST /api/plugin/agent/chat
 *
 * 支持：
 * - JWT Token 认证
 * - 浏览器上下文注入
 * - SSE 流式响应
 * - 意图理解与工具调用
 *
 * @version 1.0.0
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  verifyPluginAuth,
  createUnauthorizedResponse,
  hasScope,
} from "@/lib/auth/plugin-middleware";
import {
  browserContextSchema,
  formatBrowserContextForPrompt,
  detectPlatformFromUrl,
} from "@/lib/auth/plugin-browser-context";
import { getUnifiedEngine, type UnifiedStreamChunk } from "@/lib/ai-skills";
import { logger } from "@/lib/logger";
import { createServiceClient } from "@/lib/supabase/server";

// ============================================
// 请求 Schema
// ============================================

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const pluginChatRequestSchema = z.object({
  /** 用户消息 */
  message: z.string().min(1).max(2000),
  /** 会话 ID */
  conversationId: z.string().uuid().optional(),
  /** 消息历史 */
  messageHistory: z.array(messageSchema).max(20).optional(),
  /** 浏览器上下文 */
  browserContext: browserContextSchema.optional(),
  /** 快速操作类型 */
  quickAction: z
    .enum([
      "save_page", // 保存当前页面
      "save_selection", // 保存选中内容
      "summarize", // 总结页面
      "extract_links", // 提取链接
      "ask_about_page", // 询问页面内容
    ])
    .optional(),
  /** 执行选项 */
  options: z
    .object({
      /** 是否启用流式响应 */
      streaming: z.boolean().optional().default(true),
      /** 温度参数 */
      temperature: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

// ============================================
// SSE 流式响应辅助
// ============================================

/**
 * 创建 SSE 编码器
 */
function createSSEEncoder() {
  const encoder = new TextEncoder();
  return {
    encode: (data: unknown): Uint8Array => {
      const jsonStr = JSON.stringify(data);
      return encoder.encode(`data: ${jsonStr}\n\n`);
    },
    encodeDone: (): Uint8Array => {
      return encoder.encode("data: [DONE]\n\n");
    },
  };
}

/**
 * 流式响应块类型
 */
interface PluginStreamChunk {
  type: "text" | "action" | "bookmark_created" | "error" | "done";
  data: {
    text?: string;
    action?: string;
    bookmark?: {
      id: number;
      url: string;
      title: string;
    };
    message?: string;
    conversationId?: string;
  };
}

// ============================================
// 快速操作处理
// ============================================

/**
 * 处理快速保存操作
 */
async function handleQuickSave(
  userId: string,
  browserContext: z.infer<typeof browserContextSchema>,
): Promise<{
  success: boolean;
  bookmark?: { id: number; url: string; title: string };
  error?: string;
}> {
  if (!browserContext.page?.url || !browserContext.page?.title) {
    return { success: false, error: "页面 URL 或标题缺失" };
  }

  const serviceClient = await createServiceClient();
  const url = browserContext.page.url;
  const title = browserContext.page.title;

  // 类型断言: 手动维护类型文件时需要此断言
  type BookmarkIdRow = { id: number };

  // 检查是否已存在
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = (await (serviceClient.from("bookmarks") as any)
    .select("id")
    .eq("user_id", userId)
    .eq("url", url)
    .single()) as { data: BookmarkIdRow | null };

  if (existing) {
    return {
      success: true,
      bookmark: { id: existing.id, url, title },
    };
  }

  // 检测平台
  const platform = detectPlatformFromUrl(url);

  // 创建收藏
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bookmark, error } = (await (
    serviceClient.from("bookmarks") as any
  )
    .insert({
      user_id: userId,
      url,
      title: title.substring(0, 500),
      description: browserContext.page.description?.substring(0, 2000) || null,
      platform,
      cover_url: browserContext.page.ogImage || null,
      author: browserContext.page.author || null,
      source_name: browserContext.page.siteName || null,
    })
    .select("id")
    .single()) as {
    data: BookmarkIdRow | null;
    error: { message: string } | null;
  };

  if (error) {
    logger.error(
      { error: error.message, userId },
      "Plugin Agent: Failed to save bookmark",
    );
    return { success: false, error: "保存失败" };
  }

  if (!bookmark) {
    return { success: false, error: "保存失败" };
  }

  return {
    success: true,
    bookmark: { id: bookmark.id, url, title },
  };
}

// ============================================
// 主处理函数
// ============================================

export async function POST(request: NextRequest) {
  // 1. 验证插件认证
  const authResult = await verifyPluginAuth(request);

  if (!authResult.success) {
    return createUnauthorizedResponse(authResult.error);
  }

  // 检查权限
  if (!hasScope(authResult, "bookmarks:read")) {
    return new Response(
      JSON.stringify({ error: "forbidden", message: "Insufficient scope" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    // 2. 解析请求
    const body = await request.json();
    const validation = pluginChatRequestSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: "invalid_request",
          message: "请求参数无效",
          details: validation.error.issues,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const {
      message,
      conversationId: providedConversationId,
      messageHistory,
      browserContext,
      quickAction,
      options,
    } = validation.data;

    const conversationId = providedConversationId || randomUUID();
    const isStream = options?.streaming ?? true;

    logger.info(
      {
        userId: authResult.userId.slice(0, 8) + "...",
        conversationId: conversationId.slice(0, 8) + "...",
        quickAction,
        hasContext: !!browserContext,
      },
      "Plugin Agent: Request received",
    );

    // 3. 处理快速操作
    if (quickAction === "save_page" && browserContext) {
      const saveResult = await handleQuickSave(
        authResult.userId,
        browserContext,
      );

      if (saveResult.success && saveResult.bookmark) {
        return new Response(
          JSON.stringify({
            success: true,
            type: "bookmark_created",
            bookmark: saveResult.bookmark,
            message: `已保存「${saveResult.bookmark.title}」`,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            error: saveResult.error || "保存失败",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    // 4. 构建增强的系统提示
    let additionalContext = "";

    // 添加浏览器上下文
    if (browserContext) {
      const contextText = formatBrowserContextForPrompt(browserContext);
      if (contextText) {
        additionalContext += contextText + "\n\n";
      }
    }

    // 5. 使用统一引擎处理请求
    const unifiedEngine = getUnifiedEngine();

    if (!unifiedEngine.isReady()) {
      return new Response(
        JSON.stringify({
          error: "service_unavailable",
          message: "AI 引擎正在初始化，请稍后重试",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    const engineContext = {
      userId: authResult.userId,
      conversationId,
      messageHistory: messageHistory?.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      systemPrompt: additionalContext || undefined,
    };

    // 6. 执行并返回响应
    if (isStream) {
      const sseEncoder = createSSEEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          try {
            // 发送会话 ID
            const initChunk: PluginStreamChunk = {
              type: "text",
              data: { conversationId },
            };
            controller.enqueue(sseEncoder.encode(initChunk));

            let finalConversationId = conversationId;

            // 通过统一引擎流式执行
            for await (const chunk of unifiedEngine.execute(
              message,
              engineContext,
            )) {
              if (chunk.type === "text" && chunk.data?.text) {
                const textChunk: PluginStreamChunk = {
                  type: "text",
                  data: { text: chunk.data.text },
                };
                controller.enqueue(sseEncoder.encode(textChunk));
              } else if (chunk.type === "done") {
                finalConversationId =
                  chunk.data?.conversationId || conversationId;
              }
            }

            // 发送完成信号
            const doneChunk: PluginStreamChunk = {
              type: "done",
              data: { conversationId: finalConversationId },
            };
            controller.enqueue(sseEncoder.encode(doneChunk));
            controller.enqueue(sseEncoder.encodeDone());
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            logger.error({ error: errorMessage }, "Plugin Agent: Stream error");

            const errorChunk: PluginStreamChunk = {
              type: "error",
              data: { message: "处理请求时出错" },
            };
            controller.enqueue(sseEncoder.encode(errorChunk));
            controller.enqueue(sseEncoder.encodeDone());
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Conversation-Id": conversationId,
        },
      });
    } else {
      // 非流式响应：收集所有输出
      const chunks: UnifiedStreamChunk[] = [];

      for await (const chunk of unifiedEngine.execute(message, engineContext)) {
        chunks.push(chunk);
      }

      const doneChunk = chunks.find((c) => c.type === "done");
      const textChunks = chunks
        .filter((c) => c.type === "text")
        .map((c) => c.data?.text || "")
        .join("");

      return new Response(
        JSON.stringify({
          success: doneChunk?.data?.success ?? true,
          conversationId: doneChunk?.data?.conversationId || conversationId,
          content: textChunks,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, "Plugin Agent: Request error");

    return new Response(
      JSON.stringify({
        error: "server_error",
        message: "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
