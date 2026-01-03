/**
 * Message Count API v1
 *
 * GET /api/v1/messages/count - 获取未读消息数量
 *
 * @module api/v1/messages/count
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";

interface UnreadCounts {
  total: number;
  silent: number;
  normal: number;
  important: number;
}

/**
 * GET /api/v1/messages/count
 * 获取未读消息数量（分等级统计）
 */
export const GET = withAuthMiddleware(async (_request, { userId }) => {
  const supabase = await createClient();

  // 使用 RPC 函数获取未读数量
  // 类型断言: 手动维护类型文件时需要此断言
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("get_unread_message_counts", {
    p_user_id: userId,
  });

  if (error) {
    logger.error(
      { error: error.message, userId },
      "[v1] Failed to get unread count",
    );
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "获取未读数量失败" },
      },
      { status: 500 },
    );
  }

  // 数据库函数返回单行结果
  const counts: UnreadCounts =
    Array.isArray(data) && data.length > 0
      ? data[0]
      : { total: 0, silent: 0, normal: 0, important: 0 };

  return NextResponse.json({
    success: true,
    data: counts,
  });
});
