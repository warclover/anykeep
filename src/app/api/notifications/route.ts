/**
 * 通知列表 API
 * GET /api/notifications - 获取通知列表
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NotificationService } from "@/lib/notifications/notification.service";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const priority = searchParams.get("priority")?.split(",") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const notifications = await NotificationService.list(user.id, {
      status,
      priority,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: notifications,
      pagination: {
        limit,
        offset,
        hasMore: notifications.length === limit,
      },
    });
  } catch (error) {
    logger.error({ error }, "[API] GET /api/notifications failed");
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 },
    );
  }
}
