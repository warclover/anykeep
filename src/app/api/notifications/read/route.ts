/**
 * 标记通知已读 API
 * POST /api/notifications/read - 标记指定通知为已读
 * POST /api/notifications/read?all=true - 全部标记已读
 */

import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { NotificationService } from "@/lib/notifications/notification.service";
import { z } from "zod";

const readSchema = z.object({
  ids: z.array(z.string().uuid()).optional(),
});

export const POST = withAuthMiddleware(async (request, { userId }) => {
  // 检查是否是全部标记已读
  const { searchParams } = new URL(request.url);
  const markAll = searchParams.get("all") === "true";

  if (markAll) {
    const count = await NotificationService.markAllAsRead(userId);
    return NextResponse.json({
      success: true,
      message: `Marked ${count} notifications as read`,
      count,
    });
  }

  // 解析请求体
  const body = await request.json();
  const validation = readSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: validation.error.issues },
      { status: 400 },
    );
  }

  const { ids } = validation.data;

  if (!ids || ids.length === 0) {
    return NextResponse.json(
      { error: "No notification IDs provided" },
      { status: 400 },
    );
  }

  const count = await NotificationService.markAsRead(userId, ids);

  return NextResponse.json({
    success: true,
    message: `Marked ${count} notifications as read`,
    count,
  });
});
