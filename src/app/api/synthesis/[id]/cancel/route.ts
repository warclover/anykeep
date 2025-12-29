/**
 * 综述取消 API
 *
 * POST /api/synthesis/[id]/cancel - 取消正在进行的综述生成
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
 * POST /api/synthesis/[id]/cancel - 取消综述生成
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

    // 获取报告当前状态
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

    // 只能取消进行中的任务
    const cancellableStatuses = ["pending", "generating"];
    if (!cancellableStatuses.includes(report.status)) {
      return NextResponse.json(
        {
          error: "Only pending or generating reports can be cancelled",
          code: "INVALID_STATUS",
          currentStatus: report.status,
        },
        { status: 400 },
      );
    }

    // 更新状态为已取消
    const { error: updateError } = await supabase
      .from("synthesis_reports")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) {
      logger.error({ error: updateError }, "Failed to cancel synthesis");
      return NextResponse.json(
        { error: "Failed to cancel", code: "UPDATE_ERROR" },
        { status: 500 },
      );
    }

    logger.info({ reportId: id, userId: user.id }, "Synthesis cancelled");

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Synthesis cancel API error",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
