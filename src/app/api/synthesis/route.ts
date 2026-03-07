/**
 * 综述列表与创建 API
 *
 * GET /api/synthesis - 获取综述列表
 * POST /api/synthesis - 创建综述（异步）
 *
 * @version 1.1.0
 * @since 2025-12-29
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { logger } from "@/lib/logger";
import {
  type SynthesisListQuery,
  type CreateSynthesisRequest,
  type SynthesisListResponse,
  type SynthesisReportRow,
  mapRowToSummary,
  SynthesisErrorCode,
} from "@/lib/synthesis";
import { generateSynthesisTitle } from "@/lib/synthesis/utils/title-generator";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_BOOKMARKS_COUNT,
  SYNTHESIS_LIST_FIELDS,
} from "@/lib/synthesis/constants";

/** 列表 GET 短期缓存，减少重复请求 */
const LIST_CACHE_CONTROL = "private, max-age=30, stale-while-revalidate=60";

/**
 * GET /api/synthesis - 获取综述列表
 */
export const GET = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();

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

    // 构建查询（列表仅查列表所需字段，排除 full_markdown/embedding/content 等大字段以加快加载）
    let dbQuery = supabase
      .from("synthesis_reports")
      .select(SYNTHESIS_LIST_FIELDS, { count: "exact" })
      .eq("user_id", userId);

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

    // Supabase 返回的数据可能缺少某些可选字段（如 embedding）
    // 使用 unknown 中间转换确保类型安全
    const rows = (data ?? []) as unknown as SynthesisReportRow[];

    const response: SynthesisListResponse = {
      data: rows.map(mapRowToSummary),
      pagination: {
        page,
        pageSize,
        total: count || 0,
        hasMore: (count || 0) > page * pageSize,
      },
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": LIST_CACHE_CONTROL },
    });
  },
);

/**
 * POST /api/synthesis - 创建综述（异步启动）
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();

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
        const { data: folder } = await supabase
          .from("folders")
          .select("name")
          .eq("id", parseInt(sourceId, 10))
          .single();
        reportTitle = folder?.name ? `${folder.name} 对比分析` : "对比分析";
      } else if (sourceType === "tag" && sourceId) {
        reportTitle = `#${sourceId} 对比分析`;
      } else if (
        sourceType === "selection" &&
        bookmarkIds &&
        bookmarkIds.length > 0
      ) {
        // 查询书签标题，用于生成有意义的标题
        const { data: bookmarks } = await supabase
          .from("bookmarks")
          .select("title")
          .in(
            "id",
            bookmarkIds.map((id) => Number(id)),
          );

        if (bookmarks && bookmarks.length > 0) {
          const titles = bookmarks.map((b) => b.title);
          reportTitle = generateSynthesisTitle(titles);
        } else {
          reportTitle = `${bookmarkIds.length} 篇收藏对比分析`;
        }
      } else {
        reportTitle = "对比分析";
      }
    }

    // 创建报告记录（pending 状态）
    // 注意：source_bookmark_ids 字段类型为 BIGINT[]（已通过迁移修复）
    const bookmarkIdsForDb = bookmarkIds?.map((id) => Number(id)) || null;

    const { data: report, error: insertError } = await supabase
      .from("synthesis_reports")
      .insert({
        user_id: userId,
        title: reportTitle,
        source_type: sourceType,
        source_id: sourceId || null,
        source_bookmark_ids: bookmarkIdsForDb,
        depth_mode: depthMode,
        output_style: outputStyle || "narrative",
        blueprint_type: "thematic",
        content: "",
        status: "pending",
        source_count: bookmarkIds?.length || 0,
      })
      .select()
      .single();

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
        userId,
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
  },
);
