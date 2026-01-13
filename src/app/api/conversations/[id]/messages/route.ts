/**
 * Conversation Messages API
 * P1: 会话消息更新 API
 *
 * PUT /api/conversations/[id]/messages - 更新会话消息
 *
 * @version 1.0.0
 * @since 2026-01-13
 */

import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  badRequestError,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import type { NextRequest } from "next/server";
import type { Json } from "@/types/supabase";

// =============================================================================
// Types
// =============================================================================

interface MessagePayload {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface UpdateMessagesRequest {
  messages: MessagePayload[];
}

// =============================================================================
// PUT /api/conversations/[id]/messages
// =============================================================================

/**
 * PUT /api/conversations/[id]/messages
 * Update conversation messages
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedError("请先登录");
    }

    const { id: conversationId } = await params;

    // Parse request body
    const body: UpdateMessagesRequest = await request.json();

    if (!body.messages || !Array.isArray(body.messages)) {
      return badRequestError("缺少 messages 参数");
    }

    // Validate messages
    const validMessages = body.messages.filter(
      (m) =>
        m &&
        typeof m.id === "string" &&
        typeof m.role === "string" &&
        typeof m.content === "string",
    );

    if (validMessages.length === 0) {
      return badRequestError("没有有效的消息");
    }

    // Extract last intent from the last user message
    let lastIntent: string | null = null;
    const lastUserMsg = [...validMessages]
      .reverse()
      .find((m) => m.role === "user");
    if (lastUserMsg) {
      // Simple intent detection from content (can be enhanced)
      const content = lastUserMsg.content.toLowerCase();
      if (
        content.includes("搜索") ||
        content.includes("查找") ||
        content.includes("找")
      ) {
        lastIntent = "search";
      } else if (content.includes("整理") || content.includes("分类")) {
        lastIntent = "organize";
      } else if (content.includes("删除") || content.includes("移除")) {
        lastIntent = "delete";
      } else if (content.includes("导出") || content.includes("下载")) {
        lastIntent = "export";
      }
    }

    // Convert messages to Json compatible format
    const messagesJson: Json = validMessages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    }));

    // Update ai_session_memory table
    const { error } = await supabase
      .from("ai_session_memory")
      .update({
        state: { messages: messagesJson } as Json,
        message_count: validMessages.length,
        last_intent: lastIntent,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("conversation_id", conversationId);

    if (error) {
      // If record doesn't exist, create it
      if (error.code === "PGRST116") {
        const { error: insertError } = await supabase
          .from("ai_session_memory")
          .insert({
            user_id: user.id,
            conversation_id: conversationId,
            state: { messages: messagesJson } as Json,
            message_count: validMessages.length,
            last_intent: lastIntent,
          });

        if (insertError) {
          return internalError(
            `Failed to save messages: ${insertError.message}`,
          );
        }
      } else {
        return internalError(`Failed to save messages: ${error.message}`);
      }
    }

    return successResponse({
      conversationId,
      messageCount: validMessages.length,
      lastIntent,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return internalError(`Failed to save messages: ${message}`);
  }
}
