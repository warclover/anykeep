/**
 * 会话管理 API
 *
 * POST /api/agent/session/end - 结束会话并生成摘要
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { agentMemory } from "@/lib/ai-agent";
import { generateConversationSummary } from "@/lib/ai-agent/memory";
import { FeatureFlags } from "@/lib/ai-agent/config/feature-flags";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * 请求体 Schema
 */
const endSessionSchema = z.object({
  /** 会话 ID */
  conversationId: z.string().uuid(),
  /** 消息历史（如果内存中没有会话数据） */
  messageHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .optional(),
});

/**
 * POST /api/agent/session/end
 * 结束会话并生成摘要
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  // 1. 解析请求体
  const body = await request.json();
  const validation = endSessionSchema.safeParse(body);

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

  const { conversationId, messageHistory } = validation.data;

  logger.info(
    {
      userId: userId.slice(0, 8) + "...",
      conversationId,
      hasMessageHistory: !!messageHistory,
      messageCount: messageHistory?.length ?? 0,
    },
    "Session end API: Request received",
  );

  // 2. 检查功能是否启用
  if (!FeatureFlags.ENABLE_EPISODIC_MEMORY) {
    logger.debug("Session end API: Episodic memory disabled, skipping");
    return NextResponse.json({
      success: true,
      summaryGenerated: false,
      reason: "episodic_memory_disabled",
    });
  }

  // 3. 尝试从内存获取会话，或使用前端提供的历史
  let conversation = agentMemory.getConversation(conversationId);

  if (!conversation && messageHistory && messageHistory.length > 0) {
    // 使用前端提供的消息历史构建临时会话对象
    const now = new Date();
    conversation = {
      id: conversationId,
      userId,
      agentType: "knowledge",
      messages: messageHistory.map((m, i) => ({
        id: `msg-${i}`,
        role: m.role,
        content: m.content,
        createdAt: now,
      })),
      createdAt: now,
      updatedAt: now,
    };

    logger.debug(
      {
        conversationId,
        messageCount: messageHistory.length,
      },
      "Session end API: Using frontend message history",
    );
  }

  if (!conversation) {
    logger.warn(
      { conversationId },
      "Session end API: No conversation data available",
    );
    return NextResponse.json({
      success: true,
      summaryGenerated: false,
      reason: "no_conversation_data",
    });
  }

  // 4. 检查是否有足够的消息
  const userMessages = conversation.messages.filter((m) => m.role === "user");
  if (userMessages.length === 0) {
    logger.debug(
      { conversationId },
      "Session end API: No user messages, skipping summary",
    );
    return NextResponse.json({
      success: true,
      summaryGenerated: false,
      reason: "no_user_messages",
    });
  }

  // 5. 生成并保存摘要
  const summaryGenerated = await generateConversationSummary(conversation);

  // 6. 清理内存中的会话
  agentMemory.clearConversation(conversationId);

  logger.info(
    {
      userId: userId.slice(0, 8) + "...",
      conversationId,
      summaryGenerated,
      messageCount: conversation.messages.length,
    },
    "Session end API: Session ended",
  );

  return NextResponse.json({
    success: true,
    summaryGenerated,
    messageCount: conversation.messages.length,
  });
});
