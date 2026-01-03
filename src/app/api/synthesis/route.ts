/**
 * 综述列表与创建 API
 *
 * GET /api/synthesis - 获取综述列表
 * POST /api/synthesis - 创建综述（异步）
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  type SynthesisListQuery,
  type CreateSynthesisRequest,
  type SynthesisListResponse,
  type SynthesisReportRow,
  mapRowToSummary,
  SynthesisErrorCode,
} from "@/lib/synthesis";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_BOOKMARKS_COUNT,
} from "@/lib/synthesis/constants";

/**
 * GET /api/synthesis - 获取综述列表
 */
export async function GET(request: NextRequest) {
  try {
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

    // 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const query: SynthesisListQuery = {
      sourceType:
        (searchParams.get("sourceType") as SynthesisListQuery["sourceType"]) ||
        "all",
      depthMode:
        (searchParams.get("depthMode") as SynthesisListQuery["depthMode"]) ||
        "all",
      status:
        (searchParams.get("status") as SynthesisListQuery["status"]) || "all",
      search: searchParams.get("search") || undefined,
      sort:
        (searchParams.get("sort") as SynthesisListQuery["sort"]) || "createdAt",
      order:
        (searchParams.get("order") as SynthesisListQuery["order"]) || "desc",
      page: parseInt(searchParams.get("page") || "1", 10),
      pageSize: Math.min(
        parseInt(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE), 10),
        MAX_PAGE_SIZE,
      ),
    };

    // 构建查询
    let dbQuery = supabase
      .from("synthesis_reports")
      .select("*", { count: "exact" })
      .eq("user_id", user.id);

    // 筛选条件
    if (query.sourceType && query.sourceType !== "all") {
      dbQuery = dbQuery.eq("source_type", query.sourceType);
    }
    if (query.depthMode && query.depthMode !== "all") {
      dbQuery = dbQuery.eq("depth_mode", query.depthMode);
    }
    if (query.status && query.status !== "all") {
      dbQuery = dbQuery.eq("status", query.status);
    }

    // 搜索
    if (query.search) {
      dbQuery = dbQuery.or(
        `title.ilike.%${query.search}%,overview.ilike.%${query.search}%`,
      );
    }

    // 排序
    const sortColumn =
      query.sort === "wordCount"
        ? "word_count"
        : query.sort === "updatedAt"
          ? "updated_at"
          : "created_at";
    dbQuery = dbQuery.order(sortColumn, { ascending: query.order === "asc" });

    // 分页
    const page = query.page || 1;
    const pageSize = query.pageSize || DEFAULT_PAGE_SIZE;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    dbQuery = dbQuery.range(from, to);

    const { data, error, count } = await dbQuery;

    if (error) {
      logger.error({ error }, "Failed to fetch synthesis reports");
      return NextResponse.json(
        { error: "Failed to fetch reports", code: "FETCH_ERROR" },
        { status: 500 },
      );
    }

    const response: SynthesisListResponse = {
      data: ((data || []) as unknown as SynthesisReportRow[]).map(
        mapRowToSummary,
      ),
      pagination: {
        page,
        pageSize,
        total: count || 0,
        hasMore: (count || 0) > page * pageSize,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Synthesis list API error",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/synthesis - 创建综述（异步启动）
 */
export async function POST(request: NextRequest) {
  try {
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

    // 解析请求体
    const body: CreateSynthesisRequest = await request.json();
    const { sourceType, sourceId, bookmarkIds, depthMode, outputStyle, title } =
      body;

    // 验证参数
    if (!sourceType || !depthMode) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          code: SynthesisErrorCode.INVALID_PARAMS,
        },
        { status: 400 },
      );
    }

    // 验证来源
    if (sourceType === "folder" || sourceType === "tag") {
      if (!sourceId) {
        return NextResponse.json(
          {
            error: "sourceId is required for folder/tag source type",
            code: SynthesisErrorCode.INVALID_PARAMS,
          },
          { status: 400 },
        );
      }
    } else if (sourceType === "selection") {
      if (!bookmarkIds || bookmarkIds.length < MIN_BOOKMARKS_COUNT) {
        return NextResponse.json(
          {
            error: `At least ${MIN_BOOKMARKS_COUNT} bookmarks are required`,
            code: SynthesisErrorCode.INSUFFICIENT_CONTENT,
          },
          { status: 400 },
        );
      }
    }

    // 生成标题
    let reportTitle = title;
    if (!reportTitle) {
      if (sourceType === "folder" && sourceId) {
        // 类型断言: 手动维护类型文件时需要此断言
        type FolderNameRow = { name: string };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: folder } = await (supabase.from("folders") as any)
          .select("name")
          .eq("id", parseInt(sourceId, 10))
          .single() as { data: FolderNameRow | null };
        reportTitle = folder?.name ? `${folder.name} 综述` : "主题综述";
      } else if (sourceType === "tag" && sourceId) {
        reportTitle = `#${sourceId} 综述`;
      } else if (sourceType === "selection") {
        reportTitle = `${bookmarkIds?.length || 0} 篇书签综述`;
      } else {
        reportTitle = "主题综述";
      }
    }

    // 创建报告记录（pending 状态）
    // 类型断言: 手动维护类型文件时需要此断言
    type SynthesisReportInsertRow = {
      id: string;
      title: string;
      status: string;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: report, error: insertError } = await (supabase.from("synthesis_reports") as any)
      .insert({
        user_id: user.id,
        title: reportTitle,
        source_type: sourceType,
        source_id: sourceId || null,
        source_bookmark_ids: bookmarkIds || null,
        depth_mode: depthMode,
        output_style: outputStyle || "narrative", // [S1] 输出风格
        status: "pending",
        source_count: bookmarkIds?.length || 0,
      })
      .select()
      .single() as { data: SynthesisReportInsertRow | null; error: { message: string } | null };

    if (insertError || !report) {
      logger.error({ error: insertError }, "Failed to create synthesis report");
      return NextResponse.json(
        { error: "Failed to create report", code: "CREATE_ERROR" },
        { status: 500 },
      );
    }

    logger.info(
      {
        reportId: report.id,
        userId: user.id,
        sourceType,
        depthMode,
        outputStyle: outputStyle || "narrative",
      },
      "Synthesis report created",
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          id: report.id,
          title: report.title,
          status: report.status,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Synthesis create API error",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
