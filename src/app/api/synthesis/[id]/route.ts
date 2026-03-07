/**
 * 综述详情 API
 *
 * GET /api/synthesis/[id] - 获取单个综述详情
 * DELETE /api/synthesis/[id] - 删除综述
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { logger } from "@/lib/logger";
import {
  type SynthesisReportRow,
  mapRowToReport,
  SynthesisErrorCode,
} from "@/lib/synthesis";

/**
 * GET /api/synthesis/[id] - 获取综述详情
 */
export const GET = withAuthMiddleware<{ id: string }>(
  async (_request, { userId, params }) => {
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("synthesis_reports")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Report not found", code: SynthesisErrorCode.NOT_FOUND },
        { status: 404 },
      );
    }

    logger.info(
      {
        reportId: id,
        hasContent: !!data.content,
        contentLength: data.content?.length,
        hasBlueprintType: !!data.blueprint_type,
        blueprintType: data.blueprint_type,
        hasOverview: !!data.overview,
        overviewLength: data.overview?.length,
        hasStatus: !!data.status,
        status: data.status,
        columns: Object.keys(data),
      },
      "Raw report data from database",
    );

    const report = mapRowToReport(data as unknown as SynthesisReportRow);

    logger.info(
      {
        reportId: id,
        hasOverview: !!report.overview,
        overviewLength: report.overview?.length,
        overviewPreview: report.overview?.slice(0, 200),
        hasFullMarkdown: !!report.fullMarkdown,
        fullMarkdownLength: report.fullMarkdown?.length,
        status: report.status,
      },
      "Mapped report data",
    );

    return NextResponse.json({ data: report });
  },
);

/**
 * DELETE /api/synthesis/[id] - 删除综述
 */
export const DELETE = withAuthMiddleware<{ id: string }>(
  async (_request, { userId, params }) => {
    const { id } = await params;
    const supabase = await createClient();

    const { error } = await supabase
      .from("synthesis_reports")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      logger.error({ error }, "Failed to delete synthesis report");
      return NextResponse.json(
        { error: "Failed to delete report", code: "DELETE_ERROR" },
        { status: 500 },
      );
    }

    logger.info({ reportId: id, userId }, "Synthesis report deleted");

    return NextResponse.json({ success: true });
  },
);
