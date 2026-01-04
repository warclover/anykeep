/**
 * 搜索 API 路由
 * GET /api/search - 搜索书签（支持关键词、语义、混合搜索）
 *
 * @version 2.0.0
 * @updated 2026-01-02 升级使用 EnhancedSearchService，支持智能过滤器提取
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  badRequestError,
  internalError,
} from "@/lib/utils/api-response";
import {
  searchBookmarksSemantic,
  searchBookmarksHybrid,
} from "@/lib/utils/semantic-search";
import { searchBookmarksFulltext } from "@/lib/utils/fulltext-search";
import { EnhancedSearchService } from "@/lib/ai-skills/search/enhanced-search.service";
import type { ExtractedFilter } from "@/lib/ai-skills/search/filter-extractor.types";
import { logger } from "@/lib/logger";
import { getRAGMetricsCollector } from "@/lib/monitoring/rag/metrics-collector";
import { FeatureFlags } from "@/lib/ai-agent/config/feature-flags";

/**
 * 搜索模式
 * - keyword: 仅关键词搜索（全文搜索）
 * - semantic: 仅语义搜索（向量相似度）
 * - hybrid: 混合搜索（关键词 + 语义）
 * - enhanced: 增强搜索（智能过滤器提取 + 混合搜索）
 */
type SearchMode = "keyword" | "semantic" | "hybrid" | "enhanced";

/**
 * GET /api/search
 *
 * Query Parameters:
 * - q: 搜索关键词（必填）
 * - mode: 搜索模式 (keyword | semantic | hybrid | enhanced)，默认 enhanced
 * - limit: 结果数量限制，默认 20，最大 100
 * - threshold: 语义搜索相似度阈值 (0-1)，默认 0.5
 * - debug: 是否返回调试信息（true/false）
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");
    const mode = (searchParams.get("mode") || "enhanced") as SearchMode;
    const limitParam = searchParams.get("limit");
    const thresholdParam = searchParams.get("threshold");
    const debug = searchParams.get("debug") === "true";

    // 验证必填参数
    if (!query || query.trim().length < 2) {
      return badRequestError("搜索关键词至少需要2个字符");
    }

    // 解析可选参数
    const limit = Math.min(
      Math.max(parseInt(limitParam || "20", 10) || 20, 1),
      100,
    );
    const threshold = Math.min(
      Math.max(parseFloat(thresholdParam || "0.5") || 0.5, 0),
      1,
    );

    logger.info(
      {
        userId: user.id,
        query: query.substring(0, 50),
        mode,
        limit,
        threshold,
        debug,
        action: "search_request",
      },
      "Search: Request received",
    );

    // 3. 执行搜索
    // 增强模式使用 EnhancedSearchService
    if (mode === "enhanced") {
      const searchStartTime = performance.now();
      const enhancedSearch = new EnhancedSearchService();
      const output = await enhancedSearch.search({
        query,
        userId: user.id,
        limit,
        debug,
      });
      const searchLatencyMs = Math.round(performance.now() - searchStartTime);

      // 记录 RAG 指标
      if (FeatureFlags.ENABLE_RAG_MONITORING) {
        try {
          const collector = getRAGMetricsCollector();
          // 从搜索结果中获取最高相似度分数（如果存在）
          const firstResult = output.response?.results[0] as
            | { similarity?: number }
            | undefined;
          const maxSimilarity = firstResult?.similarity ?? 0;
          collector.recordSearch(
            searchLatencyMs,
            output.response?.results.length ?? 0,
            maxSimilarity,
            user.id,
          );
        } catch (metricsError) {
          // 指标记录失败不影响搜索结果
          logger.warn(
            {
              error:
                metricsError instanceof Error
                  ? metricsError.message
                  : String(metricsError),
            },
            "Search: Failed to record RAG metrics",
          );
        }
      }

      logger.info(
        {
          userId: user.id,
          query: query.substring(0, 50),
          mode: "enhanced",
          resultCount: output.response?.results.length ?? 0,
          filterCount: output.filterExtraction?.filters.length ?? 0,
          executionTimeMs: output.executionTimeMs,
          action: "search_complete",
        },
        "Search: Enhanced search complete",
      );

      // 返回增强搜索结果
      return successResponse({
        query,
        mode: "enhanced",
        searchType: "enhanced",
        results: output.response?.results ?? [],
        count: output.response?.results.length ?? 0,
        // 过滤器提取信息
        filterExtraction: output.filterExtraction
          ? {
              enabled: output.filterExtraction.enabled,
              filters: output.filterExtraction.filters.map((f) => ({
                type: f.type,
                expression: f.expression,
                // 序列化特定字段
                ...serializeFilter(f),
              })),
              cleanedQuery: output.filterExtraction.cleanedQuery,
              confidence: output.filterExtraction.confidence,
              latencyMs: output.filterExtraction.latencyMs,
            }
          : undefined,
        // 查询改写信息（如果启用）
        queryRewrite: output.queryRewrite,
        // 执行时间
        executionTimeMs: output.executionTimeMs,
        // 调试信息
        ...(debug && {
          debug: {
            parsedQuery: output.parsedQuery,
            rrfFusion: output.rrfFusion,
            chunkSearch: output.chunkSearch,
          },
        }),
      });
    }

    // 其他模式使用原有逻辑
    const searchStartTime = performance.now();
    let results: unknown[] = [];
    let searchType = mode;
    let error: Error | null = null;

    switch (mode) {
      case "keyword": {
        // 仅关键词搜索
        const keywordResult = await searchBookmarksFulltext(
          supabase,
          user.id,
          query,
          limit,
        );
        results = keywordResult.data || [];
        error = keywordResult.error
          ? new Error(String(keywordResult.error))
          : null;
        break;
      }

      case "semantic": {
        // 仅语义搜索
        const semanticResult = await searchBookmarksSemantic(
          supabase,
          user.id,
          query,
          { threshold, limit },
        );
        results = semanticResult.data || [];
        error = semanticResult.error;
        break;
      }

      case "hybrid":
      default: {
        // 混合搜索
        const hybridResult = await searchBookmarksHybrid(
          supabase,
          user.id,
          query,
          { threshold, limit },
        );
        results = hybridResult.data || [];
        error = hybridResult.error;
        searchType = hybridResult.searchType;
        break;
      }
    }

    if (error) {
      logger.error(
        {
          error: error.message,
          query: query.substring(0, 50),
          mode,
          action: "search_error",
        },
        "Search: Error occurred",
      );
      // 搜索失败时返回空结果而不是错误，提升用户体验
      results = [];
    }

    // 记录 RAG 指标（非增强模式）
    const searchLatencyMs = Math.round(performance.now() - searchStartTime);
    if (FeatureFlags.ENABLE_RAG_MONITORING) {
      try {
        const collector = getRAGMetricsCollector();
        // 对于非增强模式，相似度分数可能不可用，使用默认值
        const maxSimilarity =
          (results[0] as { similarity?: number })?.similarity ?? 0.5;
        collector.recordSearch(
          searchLatencyMs,
          results.length,
          maxSimilarity,
          user.id,
        );
      } catch (metricsError) {
        // 指标记录失败不影响搜索结果
        logger.warn(
          {
            error:
              metricsError instanceof Error
                ? metricsError.message
                : String(metricsError),
          },
          "Search: Failed to record RAG metrics",
        );
      }
    }

    logger.info(
      {
        userId: user.id,
        query: query.substring(0, 50),
        mode,
        searchType,
        resultCount: results.length,
        action: "search_complete",
      },
      "Search: Complete",
    );

    // 4. 返回结果
    return successResponse({
      query,
      mode,
      searchType,
      results,
      count: results.length,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "search",
      },
      "GET /api/search error",
    );
    return internalError("搜索失败，请稍后重试");
  }
}

/**
 * 序列化过滤器特定字段
 * 将 Date 对象转为 ISO 字符串，便于 JSON 传输
 */
function serializeFilter(filter: ExtractedFilter): Record<string, unknown> {
  switch (filter.type) {
    case "time_range":
      return {
        start: filter.start.toISOString(),
        end: filter.end.toISOString(),
      };
    case "platform":
      return { platform: filter.platform };
    case "tag":
      return { tags: filter.tags, matchMode: filter.matchMode };
    case "folder":
      return {
        folderName: filter.folderName,
        folderId: filter.folderId,
        includeSubfolders: filter.includeSubfolders,
      };
    case "starred":
      return { isStarred: filter.isStarred };
    case "read_status":
      return { isRead: filter.isRead };
    case "content_type":
      return { contentType: filter.contentType };
    case "sort":
      return { field: filter.field, direction: filter.direction };
    case "limit":
      return { count: filter.count };
    default:
      return {};
  }
}
