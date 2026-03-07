/**
 * AI 待办事项 API 路由
 *
 * 管理 AI 待办事项的完成操作
 *
 * @module @/app/api/ai-memory/pending/route
 * @version 1.0.0
 * @since 2026-01-13
 */

import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { getEpisodicMemoryService } from "@/lib/ai-agent/memory/episodic-memory";
import { logger } from "@/lib/logger";

// ============================================
// DELETE - 完成待办事项
// ============================================

export const DELETE = withAuthMiddleware(async (request, { userId }) => {
  const body = await request.json();
  const { task } = body;

  if (!task || typeof task !== "string") {
    return NextResponse.json(
      { success: false, error: "Missing or invalid task parameter" },
      { status: 400 },
    );
  }

  const episodicMemory = getEpisodicMemoryService();
  await episodicMemory.removePendingIntent(userId, task);

  logger.info({ userId, task }, "Pending task completed via API");

  return NextResponse.json({
    success: true,
    data: { completed: true, task },
  });
});
