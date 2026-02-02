/**
 * 标记通知已读 API
 * POST /api/notifications/read - 标记指定通知为已读
 * POST /api/notifications/read?all=true - 全部标记已读
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NotificationService } from "@/lib/notifications/notification.service";
import { logger } from "@/lib/logger";
import { z } from "zod";

const readSchema = z.object({
  ids: z.array(z.string().uuid()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 检查是否是全部标记已读
    const { searchParams } = new URL(request.url);
    const markAll = searchParams.get("all") === "true";

    if (markAll) {
      const count = await NotificationService.markAllAsRead(user.id);
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

    const count = await NotificationService.markAsRead(user.id, ids);

    return NextResponse.json({
      success: true,
      message: `Marked ${count} notifications as read`,
      count,
    });
  } catch (error) {
    logger.error({ error }, "[API] POST /api/notifications/read failed");
    return NextResponse.json(
      { error: "Failed to mark notifications as read" },
      { status: 500 },
    );
  }
}
