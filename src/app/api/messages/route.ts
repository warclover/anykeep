/**
 * 消息列表 API
 * GET /api/messages - 获取消息列表（分页、筛选、按日期分组）
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  handleValidationError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type { MessageGroup, MessageWithGroup, DateGroup } from "@/lib/messages";

// 请求参数验证
const getMessagesSchema = z.object({
  status: z
    .enum(["unread", "read", "archived", "all"])
    .optional()
    .default("all"),
  level: z.enum(["silent", "normal", "important"]).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// 日期分组标签
const DATE_GROUP_LABELS: Record<DateGroup, string> = {
  today: "今天",
  yesterday: "昨天",
  this_week: "本周",
  earlier: "更早",
};

export async function GET(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const rawParams = {
      status: searchParams.get("status") || undefined,
      level: searchParams.get("level") || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
    };

    const validation = getMessagesSchema.safeParse(rawParams);
    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { status, level, page, limit } = validation.data;
    const offset = (page - 1) * limit;

    // 3. 获取消息列表（使用数据库函数）
    const statusFilter = status === "all" ? null : status;

    const { data: messages, error: listError } = await supabase.rpc(
      "get_messages_grouped",
      {
        p_user_id: user.id,
        p_status: statusFilter ?? undefined,
        p_level: level || undefined,
        p_limit: limit,
        p_offset: offset,
      },
    );

    if (listError) {
      logger.error(
        { error: listError, userId: user.id },
        "Failed to get messages",
      );
      return internalError("获取消息列表失败");
    }

    // 4. 获取总数
    const { data: totalResult, error: countError } = await supabase.rpc(
      "get_messages_count",
      {
        p_user_id: user.id,
        p_status: statusFilter ?? undefined,
        p_level: level || undefined,
      },
    );

    if (countError) {
      logger.error(
        { error: countError, userId: user.id },
        "Failed to get messages count",
      );
    }

    const total = totalResult ?? 0;

    // 5. 按日期分组
    const groups = groupMessagesByDate(messages as MessageWithGroup[]);

    // 6. 返回响应
    return successResponse({
      groups,
      pagination: {
        page,
        limit,
        total,
        hasMore: offset + (messages?.length || 0) < total,
      },
    });
  } catch (error) {
    logger.error({ error }, "GET /api/messages error");
    return internalError("获取消息列表失败");
  }
}

/**
 * 按日期分组消息
 */
function groupMessagesByDate(messages: MessageWithGroup[]): MessageGroup[] {
  if (!messages || messages.length === 0) {
    return [];
  }

  const groupMap = new Map<DateGroup, MessageWithGroup[]>();

  // 按 date_group 分组
  for (const message of messages) {
    const group = message.date_group;
    if (!groupMap.has(group)) {
      groupMap.set(group, []);
    }
    groupMap.get(group)!.push(message);
  }

  // 转换为数组，保持顺序
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
