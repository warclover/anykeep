/**
 * list_messages Tool
 *
 * 获取用户消息列表，支持状态筛选和分页
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  MessageType,
  MessageLevel,
  MessageStatus,
  DateGroup,
} from "@/lib/messages/types";

// ============================================
// 参数定义
// ============================================

const paramsSchema = z.object({
  status: z
    .enum(["unread", "read", "all"])
    .optional()
    .default("all")
    .describe("消息状态筛选：unread-未读，read-已读，all-全部"),
  level: z
    .enum(["silent", "normal", "important"])
    .optional()
    .describe("消息级别筛选：silent-静默，normal-普通，important-重要"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe("返回数量，默认 20，最大 50"),
  page: z.number().int().min(1).optional().default(1).describe("页码，默认 1"),
});

type ListMessagesParams = z.infer<typeof paramsSchema>;

// ============================================
// 结果类型
// ============================================

interface MessageItem {
  id: number;
  type: MessageType;
  level: MessageLevel;
  title: string;
  content: string | null;
  status: MessageStatus;
  dateGroup: DateGroup;
  createdAt: string;
  readAt: string | null;
  actionUrl: string | null;
}

interface ListMessagesResult {
  messages: MessageItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  unreadCount: number;
}

// ============================================
// 日期分组计算
// ============================================

function calculateDateGroup(dateStr: string): DateGroup {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  if (date >= today) return "today";
  if (date >= yesterday) return "yesterday";
  if (date >= weekAgo) return "this_week";
  return "earlier";
}

// ============================================
// Tool 实现
// ============================================

export const listMessagesTool: Tool<ListMessagesParams, ListMessagesResult> = {
  definition: {
    name: "list_messages",
    description: `获取用户消息列表。

功能：
- 查看系统消息、通知、操作结果
- 支持按状态（未读/已读）筛选
- 支持按级别（重要/普通/静默）筛选
- 分页加载

使用场景：
- "看看我的消息"
- "有什么未读消息"
- "查看重要通知"
- "最近有什么系统消息"

返回：消息列表、分页信息、未读数统计`,
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 300,
  },

  async execute(
    params: ListMessagesParams,
    context: ToolContext,
  ): Promise<ToolResult<ListMessagesResult>> {
    const startTime = performance.now();
    const supabase = await createClient();

    const { status = "all", level, limit = 20, page = 1 } = params;
    const offset = (page - 1) * limit;

    // 构建查询
    let query = supabase
      .from("messages")
      .select(
        "id, type, level, title, content, status, created_at, read_at, action_url",
        { count: "exact" },
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // 状态筛选
    if (status !== "all") {
      query = query.eq("status", status);
    }

    // 级别筛选
    if (level) {
      query = query.eq("level", level);
    }

    const { data, count, error } = await query;

    if (error) {
      logger.error(
        {
          toolName: "list_messages",
          userId: context.userId,
          params,
          error: error.message,
        },
        "list_messages: DB Error",
      );

      return {
        success: false,
        error: error.message,
        errorCode: "DB_ERROR",
      };
    }

    // 获取未读数
    const { count: unreadCount } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("status", "unread");

    // 转换结果
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: MessageItem[] = (data || []).map((item: any) => ({
      id: item.id,
      type: item.type as MessageType,
      level: item.level as MessageLevel,
      title: item.title,
      content: item.content,
      status: item.status as MessageStatus,
      dateGroup: calculateDateGroup(item.created_at),
      createdAt: item.created_at,
      readAt: item.read_at,
      actionUrl: item.action_url,
    }));

    const total = count ?? 0;
    const hasMore = offset + messages.length < total;

    logger.info(
      {
        toolName: "list_messages",
        userId: context.userId,
        params,
        resultCount: messages.length,
        total,
        unreadCount: unreadCount ?? 0,
        executionTimeMs: Math.round(performance.now() - startTime),
      },
      "list_messages: Success",
    );

    return {
      success: true,
      data: {
        messages,
        pagination: {
          page,
          limit,
          total,
          hasMore,
        },
        unreadCount: unreadCount ?? 0,
      },
      metadata: {
        executionTimeMs: Math.round(performance.now() - startTime),
        affectedCount: messages.length,
      },
    };
  },
};
