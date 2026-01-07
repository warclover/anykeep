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

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  badRequestError,
  internalError,
} from "@/lib/utils/api-response";
import { createSearchHistoryService } from "@/lib/ai-skills/search/search-history.service";
import { logger } from "@/lib/logger";

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
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedError("请先登录");
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "all";
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
    const days = Math.min(parseInt(searchParams.get("days") || "30"), 90);

    const service = createSearchHistoryService(supabase, user.id);

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

    return successResponse(result);
  } catch (error) {
    logger.error({ error }, "[SearchHistory API] GET 失败");
    return internalError("获取搜索历史失败");
  }
}

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
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedError("请先登录");
    }

    const body = await request.json();
    const { query, keywords, resultCount, platformFilter, timeFilter } = body;

    if (!query || typeof query !== "string") {
      return badRequestError("query 为必填字段");
    }

    if (!Array.isArray(keywords)) {
      return badRequestError("keywords 必须是数组");
    }

    const service = createSearchHistoryService(supabase, user.id);
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
  } catch (error) {
    logger.error({ error }, "[SearchHistory API] POST 失败");
    return internalError("记录搜索历史失败");
  }
}

/**
 * DELETE /api/search/history
 *
 * 清空搜索历史
 *
 * Query Parameters:
 * - id: 可选，指定删除单条记录
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedError("请先登录");
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    const service = createSearchHistoryService(supabase, user.id);

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
  } catch (error) {
    logger.error({ error }, "[SearchHistory API] DELETE 失败");
    return internalError("删除搜索历史失败");
  }
}
