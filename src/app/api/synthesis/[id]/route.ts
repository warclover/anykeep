/**
 * 综述详情 API
 *
 * GET /api/synthesis/[id] - 获取单个综述详情
 * DELETE /api/synthesis/[id] - 删除综述
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  type SynthesisReportRow,
  mapRowToReport,
  SynthesisErrorCode,
} from "@/lib/synthesis";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/synthesis/[id] - 获取综述详情
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    // 验证用户
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", code: SynthesisErrorCode.UNAUTHORIZED },
        { status: 401 },
      );
    }

    // 获取报告
    const { data, error } = await supabase
      .from("synthesis_reports")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Report not found", code: SynthesisErrorCode.NOT_FOUND },
        { status: 404 },
      );
    }

    const report = mapRowToReport(data as unknown as SynthesisReportRow);

    return NextResponse.json({ data: report });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Synthesis detail API error",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/synthesis/[id] - 删除综述
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    // 验证用户
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", code: SynthesisErrorCode.UNAUTHORIZED },
        { status: 401 },
      );
    }

    // 删除报告
    const { error } = await supabase
      .from("synthesis_reports")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      logger.error({ error }, "Failed to delete synthesis report");
      return NextResponse.json(
        { error: "Failed to delete report", code: "DELETE_ERROR" },
        { status: 500 },
      );
    }

    logger.info({ reportId: id, userId: user.id }, "Synthesis report deleted");

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Synthesis delete API error",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
