/**
 * Knowledge Studio - Learning Session Detail API
 * @route PUT /api/knowledge-studio/mastery/sessions/[id]
 * @description 更新学习会话（结束会话）
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import type { Database } from "@/types/supabase";

import { withAuthMiddleware } from "@/lib/api/middleware";
const logger = createLogger("api:knowledge-studio:mastery:sessions:[id]");

// 类型定义
type SessionRow = Database["public"]["Tables"]["ks_learning_sessions"]["Row"];
type SessionUpdate =
  Database["public"]["Tables"]["ks_learning_sessions"]["Update"];

/**
 * PUT /api/knowledge-studio/mastery/sessions/[id]
 * 更新学习会话（通常用于结束会话）
 */
export const PUT = withAuthMiddleware<{ id: string }>(
  async (request, { userId, params }) => {
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();
    const {
      endSession = false,
      pointsStudied,
      pointsReviewed,
      correctAnswers,
      totalAnswers,
      durationMinutes,
    } = body;

    logger.info(
      { userId: userId, sessionId: id, endSession },
      "Updating session",
    );

    // 检查所有权 - 使用标准 Supabase 模式
    const { data: existing, error: checkError } = await supabase
      .from("ks_learning_sessions")
      .select("id, started_at")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (checkError || !existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "会话不存在" } },
        { status: 404 },
      );
    }

    // 类型断言
    const existingSession = existing as { id: string; started_at: string };

    // 构建更新对象
    const updates: SessionUpdate = {};

    if (endSession) {
      updates.ended_at = new Date().toISOString();
      // 计算实际时长（如果未提供）
      if (durationMinutes === undefined) {
        const startedAt = new Date(existingSession.started_at);
        updates.duration_minutes = Math.round(
          (Date.now() - startedAt.getTime()) / 60000,
        );
      }
    }

    if (pointsStudied !== undefined) updates.points_studied = pointsStudied;
    if (pointsReviewed !== undefined) updates.points_reviewed = pointsReviewed;
    if (correctAnswers !== undefined) updates.correct_answers = correctAnswers;
    if (totalAnswers !== undefined) updates.total_answers = totalAnswers;
    if (durationMinutes !== undefined)
      updates.duration_minutes = durationMinutes;

    // 使用标准 Supabase 更新模式
    const { data, error } = await supabase
      .from("ks_learning_sessions")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      logger.error({ error: error.message }, "Update session failed");
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "更新学习会话失败" } },
        { status: 500 },
      );
    }

    // 类型断言在结果层
    const session = data as SessionRow | null;

    return NextResponse.json({ data: session });
  },
);
