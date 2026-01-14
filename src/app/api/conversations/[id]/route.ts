/**
 * Conversation Detail API
 * P1: 会话详情 API
 *
 * GET /api/conversations/[id] - 获取会话详情
 * DELETE /api/conversations/[id] - 删除会话
 *
 * @version 1.0.0
 * @since 2026-01-13
 */

import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  notFoundError,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import type { NextRequest } from "next/server";

// =============================================================================
// Types
// =============================================================================

interface ConversationDetail {
  id: string;
  title: string;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: string;
  }>;
  messageCount: number;
  lastIntent: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SessionMemoryRow {
  conversation_id: string;
  state: {
    messages?: Array<{
      id?: string;
      role: string;
      content: string;
      createdAt?: string | Date;
    }>;
  };
  message_count: number;
  last_intent: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Extract title from first user message
 */
function extractTitle(state: SessionMemoryRow["state"]): string {
  const messages = state?.messages || [];
  const firstUserMsg = messages.find((m) => m.role === "user");
  if (firstUserMsg) {
    const content = firstUserMsg.content;
    return content.length > 30 ? content.slice(0, 30) + "..." : content;
  }
  return "New Conversation";
}

// =============================================================================
// GET /api/conversations/[id]
// =============================================================================

/**
 * GET /api/conversations/[id]
 * Get conversation detail with full messages
 */
export async function GET(
  _request: NextRequest,
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

    // Query conversation from ai_session_memory
    const { data, error } = await supabase
      .from("ai_session_memory")
      .select(
        `
        conversation_id,
        state,
        message_count,
        last_intent,
        created_at,
        updated_at
      `,
      )
      .eq("user_id", user.id)
      .eq("conversation_id", conversationId)
      .single();

    if (error || !data) {
      return notFoundError("Conversation not found");
    }

    const row = data as SessionMemoryRow;

    // Transform messages
    const messages = (row.state?.messages || []).map((m, index) => ({
      id: m.id || `msg_${index}`,
      role: m.role,
      content: m.content,
      createdAt:
        m.createdAt instanceof Date
          ? m.createdAt.toISOString()
          : m.createdAt || row.created_at,
    }));

    const conversation: ConversationDetail = {
      id: row.conversation_id,
      title: extractTitle(row.state),
      messages,
      messageCount: row.message_count,
      lastIntent: row.last_intent,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    return successResponse({ conversation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return internalError(`Failed to fetch conversation: ${message}`);
  }
}

// =============================================================================
// DELETE /api/conversations/[id]
// =============================================================================

/**
 * DELETE /api/conversations/[id]
 * Delete a conversation
 */
export async function DELETE(
  _request: NextRequest,
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

    // Delete conversation from ai_session_memory
    const { error } = await supabase
      .from("ai_session_memory")
      .delete()
      .eq("user_id", user.id)
      .eq("conversation_id", conversationId);

    if (error) {
      return internalError(`Failed to delete conversation: ${error.message}`);
    }

    return successResponse({ deleted: true, conversationId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return internalError(`Failed to delete conversation: ${message}`);
  }
}
