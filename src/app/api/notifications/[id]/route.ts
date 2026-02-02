/**
 * 单条通知 API
 * GET /api/notifications/[id] - 获取单条通知
 * DELETE /api/notifications/[id] - 删除通知
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NotificationService } from "@/lib/notifications/notification.service";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const notification = await NotificationService.get(user.id, id);

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
  } catch (error) {
    logger.error({ error }, "[API] GET /api/notifications/[id] failed");
    return NextResponse.json(
      { error: "Failed to fetch notification" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await NotificationService.delete(user.id, id);

    return NextResponse.json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error) {
    logger.error({ error }, "[API] DELETE /api/notifications/[id] failed");
    return NextResponse.json(
      { error: "Failed to delete notification" },
      { status: 500 },
    );
  }
}
