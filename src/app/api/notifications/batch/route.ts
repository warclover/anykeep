/**
 * 批量操作通知 API
 * DELETE /api/notifications/batch - 批量删除通知
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NotificationService } from "@/lib/notifications/notification.service";
import { logger } from "@/lib/logger";
import { z } from "zod";

const batchDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

export async function DELETE(request: NextRequest) {
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
    const validation = batchDeleteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validation.error.issues },
        { status: 400 },
      );
    }

    const { ids } = validation.data;

    await NotificationService.deleteBatch(user.id, ids);

    return NextResponse.json({
      success: true,
      message: `Deleted ${ids.length} notifications`,
      count: ids.length,
    });
  } catch (error) {
    logger.error({ error }, "[API] DELETE /api/notifications/batch failed");
    return NextResponse.json(
      { error: "Failed to delete notifications" },
      { status: 500 },
    );
  }
}
