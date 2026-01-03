/**
 * Knowledge Studio - Learning Session Detail API
 * @route PUT /api/knowledge-studio/mastery/sessions/[id]
 * @description 更新学习会话（结束会话）
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import type { Database } from "@/types/supabase";

const logger = createLogger("api:knowledge-studio:mastery:sessions:[id]");

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/knowledge-studio/mastery/sessions/[id]
 * 更新学习会话（通常用于结束会话）
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 },
      );
    }

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
      { userId: user.id, sessionId: id, endSession },
      "Updating session",
    );

    // 检查所有权
    type SessionRow =
      Database["public"]["Tables"]["ks_learning_sessions"]["Row"];
    type SessionExistingType = Pick<SessionRow, "id" | "started_at">;
    const { data: existing, error: checkError } = await (
      supabase.from("ks_learning_sessions") as {
        select: (columns: string) => {
          eq: (
            column: string,
            value: string,
          ) => {
            eq: (
              column: string,
              value: string,
            ) => {
              single: () => Promise<{
                data: SessionExistingType | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      }
    )
      .select("id, started_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (checkError || !existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "会话不存在" } },
        { status: 404 },
      );
    }

    // 构建更新对象
    type SessionUpdate =
      Database["public"]["Tables"]["ks_learning_sessions"]["Update"];
    const updates: SessionUpdate = {};

    if (endSession) {
      updates.ended_at = new Date().toISOString();
      // 计算实际时长（如果未提供）
      if (durationMinutes === undefined) {
        const startedAt = new Date(existing.started_at);
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

    const { data, error } = await (
      supabase.from("ks_learning_sessions") as {
        update: (values: SessionUpdate) => {
          eq: (
            column: string,
            value: string,
          ) => {
            eq: (
              column: string,
              value: string,
            ) => {
              select: () => {
                single: () => Promise<{
                  data: SessionRow | null;
                  error: { message: string } | null;
                }>;
              };
            };
          };
        };
      }
    )
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      logger.error({ error: error.message }, "Update session failed");
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "更新学习会话失败" } },
        { status: 500 },
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Update session failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "更新学习会话失败" } },
      { status: 500 },
    );
  }
}
