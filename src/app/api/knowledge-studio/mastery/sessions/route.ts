/**
 * Knowledge Studio - Learning Session API
 * @route GET/POST /api/knowledge-studio/mastery/sessions
 * @description 学习会话管理
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import type { Database } from "@/types/supabase";

const logger = createLogger("api:knowledge-studio:mastery:sessions");

type SessionRow = Database["public"]["Tables"]["ks_learning_sessions"]["Row"];
type SessionInsert =
  Database["public"]["Tables"]["ks_learning_sessions"]["Insert"];

/**
 * GET /api/knowledge-studio/mastery/sessions
 * 获取学习会话列表
 *
 * Query params:
 * - reportId: 报告 ID 筛选
 * - limit: 每页数量 (default: 20)
 * - offset: 偏移量 (default: 0)
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
    const reportId = searchParams.get("reportId");
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    logger.info(
      { userId: user.id, reportId, limit, offset },
      "Fetching learning sessions",
    );

    // 构建基础查询
    let query = supabase
      .from("ks_learning_sessions")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (reportId) {
      query = query.eq("report_id", reportId);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error({ error: error.message }, "Get sessions failed");
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "获取学习会话失败" } },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: data as SessionRow[],
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Get sessions failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "获取学习会话失败" } },
      { status: 500 },
    );
  }
}

/**
 * POST /api/knowledge-studio/mastery/sessions
 * 创建新的学习会话
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
    const { reportId } = body;

    // 参数校验
    if (!reportId) {
      return NextResponse.json(
        { error: { code: "INVALID_PARAMS", message: "reportId 必填" } },
        { status: 400 },
      );
    }

    logger.info({ userId: user.id, reportId }, "Creating learning session");

    const sessionInsertData = {
      user_id: user.id,
      report_id: reportId,
    };

    const { data, error } = await supabase
      .from("ks_learning_sessions")
      .insert(sessionInsertData as SessionInsert)
      .select()
      .single();

    if (error) {
      logger.error({ error: error.message }, "Create session failed");
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "创建学习会话失败" } },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: data as SessionRow }, { status: 201 });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Create session failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "创建学习会话失败" } },
      { status: 500 },
    );
  }
}
