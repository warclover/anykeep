/**
 * 通知计数 API
 * GET /api/notifications/count - 获取未读通知计数
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NotificationService } from "@/lib/notifications/notification.service";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const counts = await NotificationService.getUnreadCounts(user.id);

    return NextResponse.json({
      success: true,
      data: counts,
    });
  } catch (error) {
    logger.error({ error }, "[API] GET /api/notifications/count failed");
    return NextResponse.json(
      { error: "Failed to fetch notification counts" },
      { status: 500 },
    );
  }
}
