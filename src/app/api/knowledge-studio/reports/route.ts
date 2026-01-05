/**
 * Knowledge Studio - 报告 API
 * @route GET/POST /api/knowledge-studio/reports
 * @description 报告列表查询和创建
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import type { Database } from "@/types/supabase";

const logger = createLogger("api:knowledge-studio:reports");

/**
 * 创建报告 Schema
 * 支持 v1 类型（debater, blogger 等）和 v2 ID 格式（category-name，如 geek-arxiv_decoder）
 */
const CreateReportSchema = z.object({
  blueprintType: z.string().min(1, "蓝图类型不能为空"),
  title: z.string().min(1, "标题不能为空"),
  content: z.string().min(1, "内容不能为空"),
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
    .default([]),
  generationMetadata: z
    .object({
      model: z.string().optional(),
      tokensUsed: z.number().optional(),
      durationMs: z.number().optional(),
      sourceBookmarkIds: z.array(z.string()).optional(),
    })
    .optional(),
});

/**
 * 查询参数 Schema
 * blueprintType 支持 v1 类型和 v2 ID 格式
 */
const QueryParamsSchema = z.object({
  blueprintType: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(["created_at", "updated_at", "title"]).default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * GET /api/knowledge-studio/reports
 * 获取报告列表
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

    // 解析查询参数
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = QueryParamsSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: { code: "INVALID_PARAMS", message: "查询参数无效" } },
        { status: 400 },
      );
    }

    const { blueprintType, page, pageSize, sortBy, sortOrder } =
      parseResult.data;
    const offset = (page - 1) * pageSize;

    // 构建查询
    let query = supabase
      .from("synthesis_reports")
      .select("id, blueprint_type, title, created_at, updated_at, version", {
        count: "exact",
      })
      .eq("user_id", user.id)
      .order(sortBy, { ascending: sortOrder === "asc" })
      .range(offset, offset + pageSize - 1);

    if (blueprintType) {
      query = query.eq("blueprint_type", blueprintType);
    }

    const { data: reports, error, count } = await query;

    if (error) {
      logger.error({ userId: user.id, error }, "Failed to fetch reports");
      throw error;
    }

    return NextResponse.json({
      data: reports || [],
      meta: {
        total: count || 0,
        page,
        pageSize,
      },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Reports list failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "获取报告列表失败" } },
      { status: 500 },
    );
  }
}

/**
 * POST /api/knowledge-studio/reports
 * 创建新报告（手动创建，非生成）
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
    const parseResult = CreateReportSchema.safeParse(body);

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

    const { blueprintType, title, content, citations, generationMetadata } =
      parseResult.data;

    // 类型安全的插入操作
    type SynthesisReportInsert =
      Database["public"]["Tables"]["synthesis_reports"]["Insert"];
    type SynthesisReportRow =
      Database["public"]["Tables"]["synthesis_reports"]["Row"];

    const insertData: SynthesisReportInsert = {
      user_id: user.id,
      blueprint_type: blueprintType,
      title,
      content,
      citations: citations || [],
      generation_metadata: generationMetadata || {},
    };

    const { data: report, error } = await supabase
      .from("synthesis_reports")
      .insert(insertData)
      .select()
      .single<SynthesisReportRow>();

    if (error) {
      logger.error({ userId: user.id, error }, "Failed to create report");
      throw error;
    }

    if (!report) {
      logger.error({ userId: user.id }, "No report returned from insert");
      throw new Error("Failed to create report: no data returned");
    }

    logger.info({ userId: user.id, reportId: report.id }, "Report created");

    return NextResponse.json({ data: report }, { status: 201 });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Create report failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "创建报告失败" } },
      { status: 500 },
    );
  }
}
