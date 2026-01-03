/**
 * Knowledge Studio - 单个报告 API
 * @route GET/PUT/DELETE /api/knowledge-studio/reports/[id]
 * @description 报告详情、更新、删除
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import type { Database } from "@/types/supabase";

const logger = createLogger("api:knowledge-studio:reports:[id]");

interface RouteContext {
  params: Promise<{ id: string }>;
}

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
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: reportId } = await context.params;
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

    const { data: report, error } = await supabase
      .from("synthesis_reports")
      .select("*")
      .eq("id", reportId)
      .eq("user_id", user.id)
      .single();

    if (error || !report) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "报告不存在" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: report });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Get report failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "获取报告失败" } },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/knowledge-studio/reports/[id]
 * 更新报告
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id: reportId } = await context.params;
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
    const supabaseQuery = supabase.from("synthesis_reports") as unknown as {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          eq: (
            column: string,
            value: string,
          ) => {
            single: () => Promise<{
              data: Pick<SynthesisReportRow, "id" | "version"> | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };
    const { data: existing } = await supabaseQuery
      .select("id, version")
      .eq("id", reportId)
      .eq("user_id", user.id)
      .single();

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

    const supabaseQuery = supabase.from("synthesis_reports") as unknown as {
      update: (values: SynthesisReportUpdate) => {
        eq: (
          column: string,
          value: string,
        ) => {
          eq: (
            column: string,
            value: string,
          ) => {
            select: () => {
              single: () => Promise<{
                data: SynthesisReportRow | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      };
    };
    const { data: report, error } = await supabaseQuery
      .update(updateData)
      .eq("id", reportId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      logger.error(
        { userId: user.id, reportId, error },
        "Failed to update report",
      );
      throw error;
    }

    logger.info(
      { userId: user.id, reportId, version: report?.version },
      "Report updated",
    );

    return NextResponse.json({ data: report });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Update report failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "更新报告失败" } },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/knowledge-studio/reports/[id]
 * 删除报告
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: reportId } = await context.params;
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

    const { error } = await supabase
      .from("synthesis_reports")
      .delete()
      .eq("id", reportId)
      .eq("user_id", user.id);

    if (error) {
      logger.error(
        { userId: user.id, reportId, error },
        "Failed to delete report",
      );
      throw error;
    }

    logger.info({ userId: user.id, reportId }, "Report deleted");

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Delete report failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "删除报告失败" } },
      { status: 500 },
    );
  }
}
