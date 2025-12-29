/**
 * Messages API v1
 *
 * GET  /api/v1/messages - 获取消息列表
 * POST /api/v1/messages/read - 批量标记已读
 *
 * @module api/v1/messages
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";

type DateGroup = "today" | "yesterday" | "this_week" | "earlier";

interface MessageWithGroup {
  id: string;
  type: string;
  title: string;
  content: string | null;
  level: string;
  status: string;
  created_at: string;
  date_group: DateGroup;
  total_count?: number;
}

interface MessageGroup {
  date_group: DateGroup;
  label: string;
  messages: MessageWithGroup[];
}

const DATE_GROUP_LABELS: Record<DateGroup, string> = {
  today: "今天",
  yesterday: "昨天",
  this_week: "本周",
  earlier: "更早",
};

// 查询参数 Schema
const QuerySchema = z.object({
  status: z.enum(["unread", "read", "archived", "all"]).default("all"),
  level: z.enum(["silent", "normal", "important"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * GET /api/v1/messages
 * 获取消息列表
 */
export const GET = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const params = QuerySchema.safeParse({
      status: searchParams.get("status") || "all",
      level: searchParams.get("level") || undefined,
      page: searchParams.get("page") || 1,
      limit: searchParams.get("limit") || 20,
    });

    if (!params.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "查询参数验证失败",
            details: params.error.flatten().fieldErrors,
          },
        },
        { status: 400 },
      );
    }

    const { status, level, page, limit } = params.data;
    const offset = (page - 1) * limit;
    const statusFilter = status === "all" ? null : status;

    // 使用 RPC 函数获取消息
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: messagesWithCount, error } = await (supabase.rpc as any)(
      "get_messages_with_count",
      {
        p_user_id: userId,
        p_status: statusFilter ?? undefined,
        p_level: level || undefined,
        p_limit: limit,
        p_offset: offset,
      },
    );

    if (error) {
      logger.error(
        { error: error.message, userId },
        "[v1] Failed to get messages",
      );
      return NextResponse.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "获取消息列表失败" },
        },
        { status: 500 },
      );
    }

    const messages = messagesWithCount as MessageWithGroup[] | null;
    const total = messages?.[0]?.total_count ?? 0;

    // 按日期分组
    const groups = groupMessagesByDate(messages || []);

    return NextResponse.json({
      success: true,
      data: {
        groups,
        pagination: {
          page,
          limit,
          total,
          hasMore: offset + (messages?.length || 0) < total,
        },
      },
    });
  },
);

/**
 * 按日期分组消息
 */
function groupMessagesByDate(messages: MessageWithGroup[]): MessageGroup[] {
  if (!messages || messages.length === 0) {
    return [];
  }

  const groupMap = new Map<DateGroup, MessageWithGroup[]>();

  for (const message of messages) {
    const group = message.date_group;
    if (!groupMap.has(group)) {
      groupMap.set(group, []);
    }
    groupMap.get(group)!.push(message);
  }

  const orderedGroups: DateGroup[] = [
    "today",
    "yesterday",
    "this_week",
    "earlier",
  ];
  const result: MessageGroup[] = [];

  for (const group of orderedGroups) {
    const groupMessages = groupMap.get(group);
    if (groupMessages && groupMessages.length > 0) {
      result.push({
        date_group: group,
        label: DATE_GROUP_LABELS[group],
        messages: groupMessages,
      });
    }
  }

  return result;
}
