/**
 * Knowledge Studio - Review API
 * @route GET/POST /api/knowledge-studio/mastery/review
 * @description 待复习知识点和复习记录
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api:knowledge-studio:mastery:review");

/**
 * GET /api/knowledge-studio/mastery/review
 * 获取待复习知识点
 *
 * Query params:
 * - limit: 返回数量 (default: 20)
 */
export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    logger.info({ userId: user.id, limit }, "Fetching due for review");

    // 调用 RPC 获取待复习知识点
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)("get_due_for_review", {
      p_user_id: user.id,
      p_limit: limit,
    }) as { data: unknown[] | null; error: { message: string } | null };

    if (error) {
      logger.error({ error: error.message }, "Get due for review failed");
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "获取待复习列表失败" } },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: data || [],
      count: data?.length || 0,
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Get due for review failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "获取待复习列表失败" } },
      { status: 500 },
    );
  }
}

/**
 * POST /api/knowledge-studio/mastery/review
 * 记录复习结果并更新掌握度
 */
export async function POST(request: NextRequest) {
  try {
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
    const { knowledgePointId, sessionId, rating, responseTimeMs = 0 } = body;

    // 参数校验
    if (!knowledgePointId) {
      return NextResponse.json(
        { error: { code: "INVALID_PARAMS", message: "knowledgePointId 必填" } },
        { status: 400 },
      );
    }

    if (rating === undefined || rating < 0 || rating > 5) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PARAMS",
            message: "rating 须为 0-5 之间的整数",
          },
        },
        { status: 400 },
      );
    }

    logger.info(
      { userId: user.id, knowledgePointId, rating },
      "Recording review",
    );

    // 调用 RPC 记录复习并更新掌握度
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)(
      "record_review_and_update_mastery",
      {
        p_user_id: user.id,
        p_knowledge_point_id: knowledgePointId,
        p_session_id: sessionId || null,
        p_rating: rating,
        p_response_time_ms: responseTimeMs,
      },
    );

    if (error) {
      logger.error({ error: error.message }, "Record review failed");
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "记录复习失败" } },
        { status: 500 },
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Record review failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "记录复习失败" } },
      { status: 500 },
    );
  }
}
