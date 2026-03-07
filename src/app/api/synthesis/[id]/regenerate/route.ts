/**
 * 综述重新生成 API
 *
 * POST /api/synthesis/[id]/regenerate - 重新生成失败的综述
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { logger } from "@/lib/logger";
import { SynthesisErrorCode } from "@/lib/synthesis";

/**
 * POST /api/synthesis/[id]/regenerate - 重新生成综述
 *
 * 只能重新生成状态为 failed 或 cancelled 的报告
 */
export const POST = withAuthMiddleware<{ id: string }>(
  async (_request, { userId, params }) => {
    const { id } = await params;
    const supabase = await createClient();

    // 获取报告
    type ReportStatusRow = { id: string; status: string; user_id: string };
    const { data: report, error: fetchError } = (await supabase
      .from("synthesis_reports")
      .select("id, status, user_id")
      .eq("id", id)
      .eq("user_id", userId)
      .single()) as {
      data: ReportStatusRow | null;
      error: { message: string } | null;
    };

    if (fetchError || !report) {
      return NextResponse.json(
        { error: "Report not found", code: SynthesisErrorCode.NOT_FOUND },
        { status: 404 },
      );
    }

    // 使用乐观锁更新状态
    const { data: updated, error: updateError } = (await supabase
      .from("synthesis_reports")
      .update({
        status: "pending",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .in("status", ["failed", "cancelled"])
      .select("id")
      .maybeSingle()) as {
      data: { id: string } | null;
      error: { message: string } | null;
    };

    if (updateError) {
      logger.error({ error: updateError }, "Failed to reset synthesis status");
      return NextResponse.json(
        { error: "Failed to reset status", code: "UPDATE_ERROR" },
        { status: 500 },
      );
    }

    if (!updated) {
      const { data: currentReport } = (await supabase
        .from("synthesis_reports")
        .select("status")
        .eq("id", id)
        .single()) as { data: { status: string } | null };

      return NextResponse.json(
        {
          error: "Only failed or cancelled reports can be regenerated",
          code: "INVALID_STATUS",
          currentStatus: currentReport?.status || report.status,
        },
        { status: 400 },
      );
    }

    logger.info(
      { reportId: id, userId },
      "Synthesis report marked for regeneration",
    );

    return NextResponse.json({ success: true, data: { id } });
  },
);
