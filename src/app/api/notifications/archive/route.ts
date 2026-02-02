/**
 * 归档通知 API
 * POST /api/notifications/archive - 归档指定通知
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NotificationService } from "@/lib/notifications/notification.service";
import { logger } from "@/lib/logger";
import { z } from "zod";

const archiveSchema = z.object({
  id: z.string().uuid(),
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

    const body = await request.json();
    const validation = archiveSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validation.error.issues },
        { status: 400 },
      );
    }

    const { id } = validation.data;

    await NotificationService.archive(user.id, id);

    return NextResponse.json({
      success: true,
      message: "Notification archived",
    });
  } catch (error) {
    logger.error({ error }, "[API] POST /api/notifications/archive failed");
    return NextResponse.json(
      { error: "Failed to archive notification" },
      { status: 500 },
    );
  }
}
