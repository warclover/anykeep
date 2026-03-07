/**
 * 单条通知 API
 * GET /api/notifications/[id] - 获取单条通知
 * DELETE /api/notifications/[id] - 删除通知
 */

import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { NotificationService } from "@/lib/notifications/notification.service";

export const GET = withAuthMiddleware<{ id: string }>(
  async (_request, { userId, params }) => {
    const { id } = await params;

    const notification = await NotificationService.get(userId, id);

    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: notification,
    });
  },
);

export const DELETE = withAuthMiddleware<{ id: string }>(
  async (_request, { userId, params }) => {
    const { id } = await params;

    await NotificationService.delete(userId, id);

    return NextResponse.json({
      success: true,
      message: "Notification deleted",
    });
  },
);
