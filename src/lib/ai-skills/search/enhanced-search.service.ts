/**
 * 增强搜索服务
 *
 * 整合 QueryParser、ResultRanker、ResponseFormatter
 * 提供智能查询理解和结果排序
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import { createClient } from "@/lib/supabase/server";
import { searchBookmarksHybrid } from "@/lib/utils/semantic-search";
import { searchBookmarksFulltext } from "@/lib/utils/fulltext-search";
import { logger } from "@/lib/logger";

import {
  QueryParser,
  ResultRanker,
  ResponseFormatter,
  type ParsedQuery,
  type BookmarkForRanking,
  type BookmarkData,
  type FormattedSearchResponse,
  type RankedResult,
} from "./index";

// ============================================
// 类型定义
// ============================================

/**
 * 增强搜索输入
 */
export interface EnhancedSearchInput {
  /** 用户原始查询 */
  query: string;
  /** 用户 ID */
  userId: string;
  /** 返回数量限制 */
  limit?: number;
  /** 是否包含调试信息 */
  debug?: boolean;
}

/**
 * 增强搜索输出
 */
export interface EnhancedSearchOutput {
  /** 是否成功 */
  success: boolean;
  /** 格式化的响应 */
  response?: FormattedSearchResponse;
  /** 解析后的查询（调试用） */
  parsedQuery?: ParsedQuery;
  /** 排序后的结果（调试用） */
  rankedResults?: RankedResult[];
  /** 错误信息 */
  error?: string;
  /** 执行时间 (ms) */
  executionTimeMs: number;
}

/**
 * 数据库书签记录
 */
interface DatabaseBookmark {
  id: number;
  title: string | null;
  url: string | null;
  description: string | null;
  cover_url: string | null;
  platform: string | null;
  ai_summary: string | null;
  ai_tags: string[] | null;
  user_tags: string[] | null;
  folder_id: number | null;
  folders?: Array<{ name: string }> | { name: string } | null;
  author: string | null;
  publish_time: string | null;
  created_at: string;
  similarity?: number;
  // 用户行为字段（如果有）
  access_count?: number;
  last_accessed_at?: string;
  is_starred?: boolean;
}

// ============================================
// EnhancedSearchService 类
// ============================================

/**
 * 增强搜索服务
 *
 * 提供完整的搜索流程：
 * 1. QueryParser 解析自然语言查询
 * 2. 调用数据库搜索（关键词/语义）
 * 3. ResultRanker 对结果重新排序
 * 4. ResponseFormatter 格式化输出
 */
export class EnhancedSearchService {
  private queryParser: QueryParser;
  private resultRanker: ResultRanker;
  private responseFormatter: ResponseFormatter;

  constructor() {
    this.queryParser = new QueryParser();
    this.resultRanker = new ResultRanker();
    this.responseFormatter = new ResponseFormatter();
  }

  /**
   * 执行增强搜索
   */
  async search(input: EnhancedSearchInput): Promise<EnhancedSearchOutput> {
    const startTime = performance.now();

    try {
      // 1. 解析查询
      const parsedQuery = this.queryParser.parse(input.query);

      logger.debug(
        {
          original: input.query,
          keywords: parsedQuery.keywords,
          timeRange: parsedQuery.timeRange?.original,
          platform: parsedQuery.platform,
          intent: parsedQuery.searchIntent,
        },
        "EnhancedSearchService: Query parsed",
      );

      // 2. 执行数据库搜索
      const rawResults = await this.executeSearch(
        input.userId,
        parsedQuery,
        (input.limit ?? 10) * 2, // 多获取一些用于排序
      );

      // 3. 转换为排序输入格式
      const bookmarksForRanking = rawResults.map((b) =>
        this.toBookmarkForRanking(b),
      );

      // 4. 执行排序
      const rankedResults = this.resultRanker.rank(
        bookmarksForRanking,
        parsedQuery,
      );

      // 5. 准备格式化数据
      const bookmarkDataMap = new Map<number, BookmarkData>();
      for (const raw of rawResults) {
        bookmarkDataMap.set(raw.id, this.toBookmarkData(raw));
      }

      // 6. 格式化响应
      const queryTimeMs = Math.round(performance.now() - startTime);
      const response = this.responseFormatter.format(
        rankedResults.slice(0, input.limit ?? 10),
        bookmarkDataMap,
        parsedQuery,
        queryTimeMs,
      );

      logger.info(
        {
          userId: input.userId,
          query: input.query.substring(0, 50),
          resultCount: response.results.length,
          queryTimeMs,
        },
        "EnhancedSearchService: Search completed",
      );

      return {
        success: true,
        response,
        parsedQuery: input.debug ? parsedQuery : undefined,
        rankedResults: input.debug ? rankedResults : undefined,
        executionTimeMs: queryTimeMs,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          userId: input.userId,
          query: input.query.substring(0, 50),
          error: errorMessage,
        },
        "EnhancedSearchService: Search failed",
      );

      return {
        success: false,
        error: errorMessage,
        executionTimeMs: Math.round(performance.now() - startTime),
      };
    }
  }

  /**
   * 执行数据库搜索
   */
  private async executeSearch(
    userId: string,
    parsedQuery: ParsedQuery,
    limit: number,
  ): Promise<DatabaseBookmark[]> {
    const supabase = await createClient();

    // 构建搜索关键词
    const searchQuery = parsedQuery.keywords.join(" ") || parsedQuery.original;

    // 根据模糊程度选择搜索模式
    if (parsedQuery.fuzzyLevel === "exact") {
      // 精确匹配：使用关键词搜索
      const { data, error } = await searchBookmarksFulltext(
        supabase,
        userId,
        searchQuery,
        limit,
      );

      if (error) {
        throw new Error(`关键词搜索失败: ${error}`);
      }

      return this.applyQueryFilters(
        data || [],
        parsedQuery,
      ) as DatabaseBookmark[];
    } else {
      // 短语/模糊匹配：使用混合搜索
      const { data, error } = await searchBookmarksHybrid(
        supabase,
        userId,
        searchQuery,
        { threshold: 0.5, limit },
      );

      if (error) {
        throw new Error(`混合搜索失败: ${error.message}`);
      }

      return this.applyQueryFilters(
        data || [],
        parsedQuery,
      ) as DatabaseBookmark[];
    }
  }

  /**
   * 应用查询过滤器（时间范围、平台）
   */
  private applyQueryFilters(
    results: DatabaseBookmark[],
    parsedQuery: ParsedQuery,
  ): DatabaseBookmark[] {
    let filtered = results;

    // 时间范围过滤
    if (parsedQuery.timeRange) {
      const { start, end } = parsedQuery.timeRange;
      filtered = filtered.filter((r) => {
        const createdAt = new Date(r.created_at);
        return createdAt >= start && createdAt <= end;
      });
    }

    // 平台过滤
    if (parsedQuery.platform && parsedQuery.platform !== "all") {
      const platformLower = parsedQuery.platform.toLowerCase();
      filtered = filtered.filter((r) => {
        const platform = (r.platform || "").toLowerCase();
        // 处理浏览器书签的多种平台名
        if (platformLower === "browser") {
          return ["browser", "chrome", "edge", "firefox", "safari"].includes(
            platform,
          );
        }
        return platform === platformLower;
      });
    }

    return filtered;
  }

  /**
   * 转换为排序输入格式
   */
  private toBookmarkForRanking(raw: DatabaseBookmark): BookmarkForRanking {
    return {
      id: raw.id,
      title: raw.title || "",
      summary: raw.ai_summary || raw.description || "",
      createdAt: new Date(raw.created_at),
      lastAccessedAt: raw.last_accessed_at
        ? new Date(raw.last_accessed_at)
        : undefined,
      accessCount: raw.access_count,
      isFavorite: raw.is_starred,
      tagCount: (raw.ai_tags?.length || 0) + (raw.user_tags?.length || 0),
      vectorScore: raw.similarity,
    };
  }

  /**
   * 转换为格式化数据
   */
  private toBookmarkData(raw: DatabaseBookmark): BookmarkData {
    const folder = Array.isArray(raw.folders) ? raw.folders[0] : raw.folders;

    return {
      id: raw.id,
      title: raw.title || "",
      url: raw.url || "",
      summary: raw.ai_summary || raw.description || undefined,
      platform: raw.platform || "unknown",
      createdAt: new Date(raw.created_at),
      tags: [...(raw.ai_tags || []), ...(raw.user_tags || [])],
      folderName: folder?.name,
    };
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建增强搜索服务实例
 */
export function createEnhancedSearchService(): EnhancedSearchService {
  return new EnhancedSearchService();
}

// ============================================
// 单例导出
// ============================================

/**
 * 默认增强搜索服务实例
 */
export const enhancedSearchService = new EnhancedSearchService();
