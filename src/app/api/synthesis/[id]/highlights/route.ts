/**
 * 综述标注 API 路由
 *
 * GET    /api/synthesis/[id]/highlights - 获取报告的所有标注
 * POST   /api/synthesis/[id]/highlights - 创建新标注
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { logger } from "@/lib/logger";
import {
  toHighlight,
  toHighlightRow,
  type CreateHighlightRequest,
  type SynthesisHighlightRow,
} from "@/lib/synthesis/types/highlight";

/**
 * GET /api/synthesis/[id]/highlights
 * 获取报告的所有标注
 */
export const GET = withAuthMiddleware<{ id: string }>(
  async (_request, { userId, params }) => {
    const supabase = await createClient();
    const { id: reportId } = await params;

    // 查询标注
    const { data, error } = await supabase
      .from("synthesis_highlights")
      .select("*")
      .eq("report_id", reportId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      logger.error({ error, reportId }, "Highlights API: Query error");
      return NextResponse.json(
        {
          error: "查询失败",
          details: error.message,
          code: error.code,
          hint: error.hint,
        },
        { status: 500 },
      );
    }

    const highlights = (data as SynthesisHighlightRow[]).map(toHighlight);

    return NextResponse.json({
      data: highlights,
      total: highlights.length,
    });
  },
);

/**
 * POST /api/synthesis/[id]/highlights
 * 创建新标注
 */
export const POST = withAuthMiddleware<{ id: string }>(
  async (request, { userId, params }) => {
    const supabase = await createClient();
    const { id: reportId } = await params;

    // 解析请求体
    const body: CreateHighlightRequest = await request.json();

    // 验证必填字段
    if (!body.content || !body.position) {
      return NextResponse.json(
        { error: "缺少必填字段: content, position" },
        { status: 400 },
      );
    }

    // 验证报告存在且属于当前用户
    const { data: report, error: reportError } = await supabase
      .from("synthesis_reports")
      .select("id")
      .eq("id", reportId)
      .eq("user_id", userId)
      .single();

    if (reportError || !report) {
      return NextResponse.json(
        { error: "报告不存在或无权访问" },
        { status: 404 },
      );
    }

    // 创建标注
    const row = toHighlightRow(body, reportId, userId);
    const { data, error } = (await supabase
      .from("synthesis_highlights")
      .insert(row)
      .select()
      .single()) as {
      data: SynthesisHighlightRow | null;
      error: { message: string } | null;
    };

    if (error) {
      logger.error({ error, reportId }, "Highlights API: Insert error");
      return NextResponse.json({ error: "创建失败" }, { status: 500 });
    }

    const highlight = toHighlight(data as SynthesisHighlightRow);

    return NextResponse.json({ data: highlight }, { status: 201 });
  },
);
