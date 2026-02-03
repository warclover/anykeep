/**
 * Conversations API
 * P1: 会话历史管理 API
 *
 * GET /api/conversations - 获取会话列表
 * POST /api/conversations - 创建新会话
 *
 * @version 1.0.0
 * @since 2026-01-13
 */

import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import type { NextRequest } from "next/server";

// =============================================================================
// Types
// =============================================================================

interface ConversationListItem {
  id: string;
  title: string;
  lastMessage: string;
  messageCount: number;
  lastIntent: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SessionMemoryRow {
  conversation_id: string;
  state: {
    messages?: Array<{
      role: string;
      content: string;
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

/**
 * Extract last message preview
 */
function extractLastMessage(state: SessionMemoryRow["state"]): string {
  const messages = state?.messages || [];
  const lastMsg = messages[messages.length - 1];
  if (lastMsg) {
    const content = lastMsg.content;
    return content.length > 50 ? content.slice(0, 50) + "..." : content;
  }
  return "";
}

// =============================================================================
// GET /api/conversations
// =============================================================================

/**
 * GET /api/conversations
 * Get conversation list for current user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedError("请先登录");
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Query conversations from ai_session_memory
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
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return internalError(`Failed to fetch conversations: ${error.message}`);
    }

    // Transform to frontend-friendly format
    const conversations: ConversationListItem[] = (
      data as SessionMemoryRow[]
    ).map((row) => ({
      id: row.conversation_id,
      title: extractTitle(row.state),
      lastMessage: extractLastMessage(row.state),
      messageCount: row.message_count,
      lastIntent: row.last_intent,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    // Get total count
    const { count } = await supabase
      .from("ai_session_memory")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    return successResponse({
      conversations,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return internalError(`Failed to fetch conversations: ${message}`);
  }
}

// =============================================================================
// POST /api/conversations
// =============================================================================

/**
 * POST /api/conversations
 * Create a new conversation
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedError("请先登录");
    }

    // Generate new conversation ID
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Insert new conversation record
    const { error } = await supabase.from("ai_session_memory").insert({
      user_id: user.id,
      conversation_id: conversationId,
      state: { messages: [] },
      message_count: 0,
    });

    if (error) {
      return internalError(`Failed to create conversation: ${error.message}`);
    }

    return successResponse({ conversationId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return internalError(`Failed to create conversation: ${message}`);
  }
}
