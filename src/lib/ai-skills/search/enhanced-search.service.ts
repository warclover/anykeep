/**
 * 增强搜索服务
 *
 * 整合 QueryParser、ResultRanker、ResponseFormatter
 * 提供智能查询理解和结果排序
 *
 * @version 1.1.0
 * @since 2025-12-25
 * @updated 2025-12-28 添加 RRF 融合和切片搜索支持
 */

import { createClient } from "@/lib/supabase/server";
import { searchBookmarksHybrid } from "@/lib/utils/semantic-search";
import { searchBookmarksFulltext } from "@/lib/utils/fulltext-search";
import { logger } from "@/lib/logger";
import { FeatureFlags } from "@/lib/ai-agent/config/feature-flags";
import { getQueryRewriter } from "@/lib/ai-agent/query";
import { getDashScopeReranker, RRFFusion } from "@/lib/ai-agent/rerank";
import { getChunkSearchService } from "@/lib/chunking";
import { generateEmbedding } from "@/lib/utils/embedding-generator";

import { QueryParser } from "./query-parser";
import { ResultRanker, type BookmarkForRanking } from "./result-ranker";
import { ResponseFormatter, type BookmarkData } from "./response-formatter";
import type {
  ParsedQuery,
  RankedResult,
  FormattedSearchResponse,
} from "./types";

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
  /** 查询改写信息（调试用） */
  queryRewrite?: {
    original: string;
    rewritten: string;
    synonyms: string[];
  };
  /** RRF 融合信息（调试用） */
  rrfFusion?: {
    enabled: boolean;
    sources: string[];
    topScore?: number;
  };
  /** 切片搜索信息（调试用） */
  chunkSearch?: {
    enabled: boolean;
    chunkCount: number;
  };
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
    let queryRewriteInfo:
      | { original: string; rewritten: string; synonyms: string[] }
      | undefined;

    try {
      // 0. 查询改写 (Feature Flag 控制)
      let searchQuery = input.query;
      if (FeatureFlags.ENABLE_QUERY_REWRITE) {
        try {
          const rewriter = getQueryRewriter();
          const rewriteResult = await rewriter.rewrite(input.query);
          searchQuery = rewriteResult.rewritten;
          queryRewriteInfo = {
            original: rewriteResult.original,
            rewritten: rewriteResult.rewritten,
            synonyms: rewriteResult.synonyms,
          };

          logger.debug(
            {
              original: input.query,
              rewritten: searchQuery,
              synonyms: rewriteResult.synonyms,
              cached: rewriteResult.cached,
              latencyMs: rewriteResult.latencyMs,
            },
            "EnhancedSearchService: Query rewritten",
          );
        } catch (rewriteError) {
          // 查询改写失败，降级使用原始查询
          logger.warn(
            {
              error:
                rewriteError instanceof Error
                  ? rewriteError.message
                  : String(rewriteError),
              query: input.query.substring(0, 50),
            },
            "EnhancedSearchService: Query rewrite failed, fallback to original",
          );
        }
      }

      // 1. 解析查询 (使用可能已改写的查询)
      const parsedQuery = this.queryParser.parse(searchQuery);

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
      let rawResults = await this.executeSearch(
        input.userId,
        parsedQuery,
        (input.limit ?? 10) * 2, // 多获取一些用于排序
      );

      // 2.1 切片搜索 (Feature Flag 控制)
      let chunkSearchInfo: { enabled: boolean; chunkCount: number } | undefined;
      let chunkBookmarkIds: Set<number> = new Set();

      if (FeatureFlags.ENABLE_PARENT_CHILD_CHUNKING) {
        try {
          const queryEmbedding = await generateEmbedding(input.query);
          const chunkService = getChunkSearchService();
          const chunkResults = await chunkService.search(
            queryEmbedding,
            input.userId,
            {
              matchThreshold: 0.6,
              matchCount: 20,
              includeParentContext: true,
            },
          );

          // 收集切片搜索命中的书签 ID
          chunkBookmarkIds = new Set(chunkResults.map((c) => c.bookmarkId));
          chunkSearchInfo = {
            enabled: true,
            chunkCount: chunkResults.length,
          };

          logger.debug(
            {
              chunkCount: chunkResults.length,
              uniqueBookmarks: chunkBookmarkIds.size,
              topSimilarity: chunkResults[0]?.similarity,
            },
            "EnhancedSearchService: Chunk search completed",
          );
        } catch (chunkError) {
          logger.warn(
            {
              error:
                chunkError instanceof Error
                  ? chunkError.message
                  : String(chunkError),
            },
            "EnhancedSearchService: Chunk search failed, continuing with bookmark search",
          );
          chunkSearchInfo = { enabled: false, chunkCount: 0 };
        }
      }

      // 2.2 RRF 融合 (Feature Flag 控制)
      let rrfFusionInfo:
        | { enabled: boolean; sources: string[]; topScore?: number }
        | undefined;

      if (FeatureFlags.ENABLE_RRF_FUSION && chunkBookmarkIds.size > 0) {
        try {
          const rrfFusion = new RRFFusion({
            k: 60,
            sourceWeights: {
              bookmark: 1.0,
              chunk: 1.2, // 切片搜索稍微加权（更精准）
            },
          });

          // 构建书签搜索排名列表
          const bookmarkRankList = RRFFusion.createRankList(
            rawResults,
            "bookmark",
            (r) => r.id,
            (r) => r.similarity,
          );

          // 构建切片搜索排名列表（按书签 ID）
          const chunkRankList = Array.from(chunkBookmarkIds).map((id, idx) => ({
            id,
            rank: idx + 1,
            source: "chunk",
            score: 1 - idx * 0.05, // 简单的衰减分数
          }));

          // 融合两个排名列表
          const fusedResults = rrfFusion.fuseTwoLists(
            bookmarkRankList,
            chunkRankList,
          );

          // 根据融合分数重新排序 rawResults
          const idToRRFScore = new Map<number, number>();
          for (const r of fusedResults) {
            idToRRFScore.set(r.id as number, r.rrfScore);
          }

          // 添加仅在切片搜索中出现的书签（需要额外获取）
          const existingIds = new Set(rawResults.map((r) => r.id));
          const missingIds = Array.from(chunkBookmarkIds).filter(
            (id) => !existingIds.has(id),
          );

          // 如果有遗漏的书签，从数据库获取
          if (missingIds.length > 0) {
            const supabase = await createClient();
            const { data: missingBookmarks } = await supabase
              .from("bookmarks")
              .select(
                `
                id, title, url, description, cover_url, platform,
                ai_summary, ai_tags, user_tags, folder_id,
                folders:folder_id(name),
                author, publish_time, created_at
              `,
              )
              .in("id", missingIds);

            if (missingBookmarks) {
              rawResults.push(...(missingBookmarks as DatabaseBookmark[]));
            }
          }

          // 按 RRF 分数排序
          rawResults.sort((a, b) => {
            const scoreA = idToRRFScore.get(a.id) ?? 0;
            const scoreB = idToRRFScore.get(b.id) ?? 0;
            return scoreB - scoreA;
          });

          // 将 RRF 分数注入到 similarity 字段
          for (const r of rawResults) {
            const rrfScore = idToRRFScore.get(r.id);
            if (rrfScore !== undefined) {
              r.similarity = rrfScore;
            }
          }

          rrfFusionInfo = {
            enabled: true,
            sources: ["bookmark", "chunk"],
            topScore: fusedResults[0]?.rrfScore,
          };

          logger.debug(
            {
              bookmarkCount: bookmarkRankList.length,
              chunkBookmarkCount: chunkRankList.length,
              fusedCount: fusedResults.length,
              topScore: fusedResults[0]?.rrfScore,
            },
            "EnhancedSearchService: RRF fusion completed",
          );
        } catch (rrfError) {
          logger.warn(
            {
              error:
                rrfError instanceof Error ? rrfError.message : String(rrfError),
            },
            "EnhancedSearchService: RRF fusion failed, using original order",
          );
          rrfFusionInfo = { enabled: false, sources: [] };
        }
      }

      // 2.5 交叉编码器重排序 (Feature Flag 控制)
      if (FeatureFlags.ENABLE_RERANK && rawResults.length > 1) {
        try {
          const reranker = getDashScopeReranker();

          // 构建文档列表（标题 + 摘要）
          const documents = rawResults.map((r) =>
            `${r.title || ""} ${r.ai_summary || r.description || ""}`.trim(),
          );

          const rerankResults = await reranker.rerank(
            input.query, // 使用原始查询进行重排序
            documents,
            Math.min(rawResults.length, input.limit ?? 10),
          );

          // 按重排序分数重新排列结果
          if (rerankResults.length > 0) {
            const rerankedRawResults: typeof rawResults = [];
            for (const rr of rerankResults) {
              if (rr.index < rawResults.length) {
                // 将重排序分数注入到 similarity 字段
                const result = { ...rawResults[rr.index] };
                result.similarity =
                  (result.similarity ?? 0) * 0.5 + rr.relevanceScore * 0.5;
                rerankedRawResults.push(result);
              }
            }

            // 补充未被重排序的结果
            const rerankedIds = new Set(rerankResults.map((r) => r.index));
            for (let i = 0; i < rawResults.length; i++) {
              if (!rerankedIds.has(i)) {
                rerankedRawResults.push(rawResults[i]);
              }
            }

            rawResults = rerankedRawResults;

            logger.debug(
              {
                originalCount: documents.length,
                rerankedCount: rerankResults.length,
                topScore: rerankResults[0]?.relevanceScore,
              },
              "EnhancedSearchService: Results reranked",
            );
          }
        } catch (rerankError) {
          // 重排序失败，降级使用原始排序
          logger.warn(
            {
              error:
                rerankError instanceof Error
                  ? rerankError.message
                  : String(rerankError),
            },
            "EnhancedSearchService: Rerank failed, fallback to original order",
          );
        }
      }

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
        queryRewrite: input.debug ? queryRewriteInfo : undefined,
        rrfFusion: input.debug ? rrfFusionInfo : undefined,
        chunkSearch: input.debug ? chunkSearchInfo : undefined,
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
