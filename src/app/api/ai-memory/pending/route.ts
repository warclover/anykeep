/**
 * AI 待办事项 API 路由
 *
 * 管理 AI 待办事项的完成操作
 *
 * @module @/app/api/ai-memory/pending/route
 * @version 1.0.0
 * @since 2026-01-13
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEpisodicMemoryService } from "@/lib/ai-agent/memory/episodic-memory";
import { logger } from "@/lib/logger";

// ============================================
// DELETE - 完成待办事项
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { task } = body;

    if (!task || typeof task !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid task parameter" },
        { status: 400 },
      );
    }

    const episodicMemory = getEpisodicMemoryService();
    await episodicMemory.removePendingIntent(user.id, task);

    logger.info({ userId: user.id, task }, "Pending task completed via API");

    return NextResponse.json({
      success: true,
      data: { completed: true, task },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : "Unknown error" },
      "Failed to complete pending task",
    );

    return NextResponse.json(
      { success: false, error: "Failed to complete pending task" },
      { status: 500 },
    );
  }
}
