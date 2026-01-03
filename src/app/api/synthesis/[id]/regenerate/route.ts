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
    // 类型断言: 手动维护类型文件时需要此断言
    type ReportStatusRow = { id: string; status: string; user_id: string };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: report, error: fetchError } = await (supabase.from("synthesis_reports") as any)
      .select("id, status, user_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single() as { data: ReportStatusRow | null; error: { message: string } | null };

    if (fetchError || !report) {
      return NextResponse.json(
        { error: "Report not found", code: SynthesisErrorCode.NOT_FOUND },
        { status: 404 },
      );
    }

    // 使用乐观锁更新状态：将状态检查放入 WHERE 子句
    // 这样可以避免 TOCTOU 竞态条件
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated, error: updateError } = await (supabase.from("synthesis_reports") as any)
      .update({
        status: "pending",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .in("status", ["failed", "cancelled"]) // 乐观锁：只更新符合条件的记录
      .select("id")
      .maybeSingle() as { data: { id: string } | null; error: { message: string } | null };

    if (updateError) {
      logger.error({ error: updateError }, "Failed to reset synthesis status");
      return NextResponse.json(
        { error: "Failed to reset status", code: "UPDATE_ERROR" },
        { status: 500 },
      );
    }

    // 如果没有更新任何记录，说明状态已变更
    if (!updated) {
      // 重新获取当前状态
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: currentReport } = await (supabase.from("synthesis_reports") as any)
        .select("status")
        .eq("id", id)
        .single() as { data: { status: string } | null };

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
