/**
 * 归档通知 API
 * POST /api/notifications/archive - 归档指定通知
 */

import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { NotificationService } from "@/lib/notifications/notification.service";
import { z } from "zod";

const archiveSchema = z.object({
  id: z.string().uuid(),
});

export const POST = withAuthMiddleware(async (request, { userId }) => {
  const body = await request.json();
  const validation = archiveSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: validation.error.issues },
      { status: 400 },
    );
  }

  const { id } = validation.data;

  await NotificationService.archive(userId, id);

  return NextResponse.json({
    success: true,
    message: "Notification archived",
  });
});
