/**
 * 通知列表 API
 * GET /api/notifications - 获取通知列表
 */

import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { NotificationService } from "@/lib/notifications/notification.service";

export const GET = withAuthMiddleware(async (request, { userId }) => {
  // 解析查询参数
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;
  const priority = searchParams.get("priority")?.split(",") || undefined;
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  const notifications = await NotificationService.list(userId, {
    status,
    priority,
    limit,
    offset,
  });

  return NextResponse.json(
    {
      success: true,
      data: notifications,
      pagination: {
        limit,
        offset,
        hasMore: notifications.length === limit,
      },
    },
    {
      headers: {
        "Cache-Control": "private, max-age=10, stale-while-revalidate=20",
      },
    },
  );
});
