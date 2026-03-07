/**
 * 批量操作通知 API
 * DELETE /api/notifications/batch - 批量删除通知
 */

import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { NotificationService } from "@/lib/notifications/notification.service";
import { z } from "zod";

const batchDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

export const DELETE = withAuthMiddleware(async (request, { userId }) => {
  const body = await request.json();
  const validation = batchDeleteSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: validation.error.issues },
      { status: 400 },
    );
  }

  const { ids } = validation.data;

  await NotificationService.deleteBatch(userId, ids);

  return NextResponse.json({
    success: true,
    message: `Deleted ${ids.length} notifications`,
    count: ids.length,
  });
});
