/**
 * 搜索历史 API
 *
 * GET /api/search/history - 获取最近搜索和热门关键词
 * POST /api/search/history - 记录搜索（通常由搜索 API 内部调用）
 * DELETE /api/search/history - 清空搜索历史
 * DELETE /api/search/history/[id] - 删除单条搜索历史
 *
 * @version 1.0.0
 * @since 2026-01-07
 */

import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  badRequestError,
  internalError,
} from "@/lib/utils/api-response";
import { createSearchHistoryService } from "@/lib/ai-skills/search/search-history.service";

/**
 * GET /api/search/history
 *
 * 获取搜索历史数据
 *
 * Query Parameters:
 * - type: "recent" | "keywords" | "all" (默认 "all")
 * - limit: 数量限制 (默认 10)
 * - days: 热门关键词统计天数 (默认 30)
 */
export const GET = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type") || "all";
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
  const days = Math.min(parseInt(searchParams.get("days") || "30"), 90);

  const service = createSearchHistoryService(supabase, userId);

  const result: {
    recentSearches?: {
      id: string;
      query: string;
      resultCount: number;
      createdAt: Date;
    }[];
    hotKeywords?: { keyword: string; count: number }[];
  } = {};

  if (type === "recent" || type === "all") {
    result.recentSearches = await service.getRecentSearches(limit);
  }

  if (type === "keywords" || type === "all") {
    result.hotKeywords = await service.getHotKeywords(limit, days);
  }

  return NextResponse.json(
    { success: true, data: result },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
});

/**
 * POST /api/search/history
 *
 * 记录搜索历史
 *
 * Body:
 * - query: string (必填)
 * - keywords: string[] (必填)
 * - resultCount: number (必填)
 * - platformFilter?: string
 * - timeFilter?: string
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();

  const body = await request.json();
  const { query, keywords, resultCount, platformFilter, timeFilter } = body;

  if (!query || typeof query !== "string") {
    return badRequestError("query 为必填字段");
  }

  if (!Array.isArray(keywords)) {
    return badRequestError("keywords 必须是数组");
  }

  const service = createSearchHistoryService(supabase, userId);
  const searchId = await service.recordSearch({
    query,
    keywords,
    resultCount: resultCount || 0,
    platformFilter,
    timeFilter,
  });

  if (!searchId) {
    return internalError("记录搜索历史失败");
  }

  return successResponse({ id: searchId });
});

/**
 * DELETE /api/search/history
 *
 * 清空搜索历史
 *
 * Query Parameters:
 * - id: 可选，指定删除单条记录
 */
export const DELETE = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();

  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get("id");

  const service = createSearchHistoryService(supabase, userId);

  if (id) {
    // 删除单条
    const success = await service.deleteSearch(id);
    if (!success) {
      return internalError("删除失败");
    }
    return successResponse({ deleted: id });
  } else {
    // 清空全部
    const success = await service.clearHistory();
    if (!success) {
      return internalError("清空失败");
    }
    return successResponse({ cleared: true });
  }
});
