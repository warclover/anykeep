/**
 * 通知计数 API
 * GET /api/notifications/count - 获取未读通知计数
 */

import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { NotificationService } from "@/lib/notifications/notification.service";

export const GET = withAuthMiddleware(async (_request, { userId }) => {
  const counts = await NotificationService.getUnreadCounts(userId);

  return NextResponse.json({
    success: true,
    data: counts,
  });
});
