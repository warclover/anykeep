/**
 * 综述重新生成 API
 *
 * POST /api/synthesis/[id]/regenerate - 重新生成失败的综述
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { SynthesisErrorCode } from "@/lib/synthesis";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/synthesis/[id]/regenerate - 重新生成综述
 *
 * 只能重新生成状态为 failed 或 cancelled 的报告
 */
export async function POST(_request: NextRequest, context: RouteContext) {
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
    const { data: report, error: fetchError } = await supabase
      .from("synthesis_reports")
      .select("id, status, user_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !report) {
      return NextResponse.json(
        { error: "Report not found", code: SynthesisErrorCode.NOT_FOUND },
        { status: 404 },
      );
    }

    // 检查状态
    const allowedStatuses = ["failed", "cancelled"];
    if (!allowedStatuses.includes(report.status)) {
      return NextResponse.json(
        {
          error: "Only failed or cancelled reports can be regenerated",
          code: "INVALID_STATUS",
        },
        { status: 400 },
      );
    }

    // 重置状态为 pending
    const { error: updateError } = await supabase
      .from("synthesis_reports")
      .update({
        status: "pending",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) {
      logger.error({ error: updateError }, "Failed to reset synthesis status");
      return NextResponse.json(
        { error: "Failed to reset status", code: "UPDATE_ERROR" },
        { status: 500 },
      );
    }

    logger.info(
      { reportId: id, userId: user.id },
      "Synthesis report marked for regeneration",
    );

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Synthesis regenerate API error",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
