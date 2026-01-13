/**
 * AI 记忆 API 路由
 *
 * 提供 AI 跨会话记忆的 CRUD 操作
 *
 * @module @/app/api/ai-memory/route
 * @version 1.0.0
 * @since 2026-01-13
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEpisodicMemoryService } from "@/lib/ai-agent/memory/episodic-memory";
import { logger } from "@/lib/logger";

// ============================================
// GET - 获取 AI 记忆
// ============================================

export async function GET() {
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

    const episodicMemory = getEpisodicMemoryService();
    const memoryContext = await episodicMemory.getMemoryContext(user.id);

    // 聚合学习偏好
    const learnedPreferences: Record<string, string> = {};
    for (const summary of memoryContext.recentSummaries) {
      // 从摘要中提取学习偏好（如果有）
      const prefs = (summary as { learnedPreferences?: Record<string, string> })
        .learnedPreferences;
      if (prefs) {
        Object.assign(learnedPreferences, prefs);
      }
    }

    const data = {
      recentSummaries: memoryContext.recentSummaries.map((s) => ({
        summary: s.summary,
        intents: s.intents,
        timeAgo: s.timeAgo,
        learnedPreferences: (
          s as { learnedPreferences?: Record<string, string> }
        ).learnedPreferences,
      })),
      pendingIntents: memoryContext.pendingIntents,
      learnedPreferences,
    };

    logger.info(
      {
        userId: user.id,
        summaryCount: data.recentSummaries.length,
        pendingCount: data.pendingIntents.length,
        preferencesCount: Object.keys(learnedPreferences).length,
      },
      "AI memory fetched",
    );

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : "Unknown error" },
      "Failed to fetch AI memory",
    );

    return NextResponse.json(
      { success: false, error: "Failed to fetch AI memory" },
      { status: 500 },
    );
  }
}

// ============================================
// DELETE - 清除 AI 记忆
// ============================================

export async function DELETE() {
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

    // 删除用户的所有会话摘要
    const { error } = await supabase
      .from("ai_conversation_summaries")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      logger.error(
        { error: error.message, userId: user.id },
        "Failed to delete AI memory",
      );
      return NextResponse.json(
        { success: false, error: "Failed to delete AI memory" },
        { status: 500 },
      );
    }

    logger.info({ userId: user.id }, "AI memory cleared");

    return NextResponse.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : "Unknown error" },
      "Failed to delete AI memory",
    );

    return NextResponse.json(
      { success: false, error: "Failed to delete AI memory" },
      { status: 500 },
    );
  }
}
