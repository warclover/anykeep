/**
 * Knowledge Studio - 单个报告 API
 * @route GET/PUT/DELETE /api/knowledge-studio/reports/[id]
 * @description 报告详情、更新、删除
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import type { Database } from "@/types/supabase";

import { withAuthMiddleware } from "@/lib/api/middleware";
const logger = createLogger("api:knowledge-studio:reports:[id]");

/**
 * 更新报告 Schema
 */
const UpdateReportSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  citations: z
    .array(
      z.object({
        bookmarkId: z.string(),
        title: z.string(),
        url: z.string(),
        excerpt: z.string().optional(),
        position: z.number().optional(),
      }),
    )
    .optional(),
});

/**
 * GET /api/knowledge-studio/reports/[id]
 * 获取报告详情
 */
export const GET = withAuthMiddleware<{ id: string }>(
  async (_request, { userId, params }) => {
    const { id: reportId } = await params;
    const supabase = await createClient();
    const { data: report, error } = await supabase
      .from("synthesis_reports")
      .select("*")
      .eq("id", reportId)
      .eq("user_id", userId)
      .single();

    if (error || !report) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "报告不存在" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: report });
  },
);

/**
 * PUT /api/knowledge-studio/reports/[id]
 * 更新报告
 */
export const PUT = withAuthMiddleware<{ id: string }>(
  async (request, { userId, params }) => {
    const { id: reportId } = await params;
    const supabase = await createClient();
    const body = await request.json();
    const parseResult = UpdateReportSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "请求参数无效",
            details: parseResult.error.flatten(),
          },
        },
        { status: 400 },
      );
    }

    // 检查报告是否存在且属于当前用户
    type SynthesisReportRow =
      Database["public"]["Tables"]["synthesis_reports"]["Row"];
    const { data: existing } = await supabase
      .from("synthesis_reports")
      .select("id, version")
      .eq("id", reportId)
      .eq("user_id", userId)
      .single<Pick<SynthesisReportRow, "id" | "version">>();

    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "报告不存在" } },
        { status: 404 },
      );
    }

    // 更新报告，版本号 +1
    type SynthesisReportUpdate =
      Database["public"]["Tables"]["synthesis_reports"]["Update"];
    const updateData: SynthesisReportUpdate = {
      ...parseResult.data,
      version: (existing.version || 1) + 1,
      updated_at: new Date().toISOString(),
    };

    const { data: report, error } = await supabase
      .from("synthesis_reports")
      .update(updateData)
      .eq("id", reportId)
      .eq("user_id", userId)
      .select()
      .single<SynthesisReportRow>();

    if (error) {
      logger.error(
        { userId: userId, reportId, error },
        "Failed to update report",
      );
      throw error;
    }

    logger.info(
      { userId: userId, reportId, version: report?.version },
      "Report updated",
    );

    return NextResponse.json({ data: report });
  },
);

/**
 * DELETE /api/knowledge-studio/reports/[id]
 * 删除报告
 */
export const DELETE = withAuthMiddleware<{ id: string }>(
  async (_request, { userId, params }) => {
    const { id: reportId } = await params;
    const supabase = await createClient();
    const { error } = await supabase
      .from("synthesis_reports")
      .delete()
      .eq("id", reportId)
      .eq("user_id", userId);

    if (error) {
      logger.error(
        { userId: userId, reportId, error },
        "Failed to delete report",
      );
      throw error;
    }

    logger.info({ userId: userId, reportId }, "Report deleted");

    return NextResponse.json({ data: { success: true } });
  },
);
