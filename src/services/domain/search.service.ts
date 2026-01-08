/**
 * Search Service
 *
 * 搜索服务，支持关键词搜索、语义搜索和混合搜索
 *
 * @module services/domain
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { BaseService, ServiceError } from "../core/base.service";
import type {
  SearchRequestInput,
  SearchType,
} from "@/contracts/schemas/search.schema";
import type { BookmarkListItemResponse } from "@/contracts";

/**
 * 搜索结果项
 */
export interface SearchResultItem extends BookmarkListItemResponse {
  score: number;
  matchType: "keyword" | "semantic" | "both";
  highlights?: {
    title?: string;
    description?: string;
  };
}

/**
 * 搜索结果
 */
export interface SearchResult {
  items: SearchResultItem[];
  total: number;
  query: string;
  searchType: SearchType;
  executionTimeMs: number;
}

/**
 * Search Service
 */
export class SearchService extends BaseService {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, userId, "SearchService");
  }

  /**
   * 执行搜索
   */
  async search(params: SearchRequestInput): Promise<SearchResult> {
    const startTime = Date.now();
    const {
      query: searchQuery,
      type: searchType,
      folderId,
      platform,
      tags,
      limit,
      offset,
      minScore,
    } = params;

    return this.withLogging(
      "search",
      async () => {
        let results: SearchResultItem[];

        switch (searchType) {
          case "keyword":
            results = await this.keywordSearch(searchQuery, {
              folderId,
              platform,
              tags,
              limit,
              offset,
            });
            break;
          case "semantic":
            results = await this.semanticSearch(searchQuery, {
              folderId,
              platform,
              tags,
              limit,
              offset,
              minScore,
            });
            break;
          case "hybrid":
          default:
            results = await this.hybridSearch(searchQuery, {
              folderId,
              platform,
              tags,
              limit,
              offset,
              minScore,
            });
            break;
        }

        const executionTimeMs = Date.now() - startTime;

        return {
          items: results,
          total: results.length, // 简化：实际应返回总数
          query: searchQuery,
          searchType,
          executionTimeMs,
        };
      },
      { searchQuery, searchType },
    );
  }

  /**
   * 关键词搜索（全文搜索）
   */
  private async keywordSearch(
    searchQuery: string,
    options: {
      folderId?: number;
      platform?: string;
      tags?: string[];
      limit: number;
      offset: number;
    },
  ): Promise<SearchResultItem[]> {
    const { folderId, platform, tags, limit, offset } = options;

    let dbQuery = this.supabase
      .from("bookmarks")
      .select(
        `
        id,
        url,
        title,
        description,
        platform,
        cover_url,
        folder_id,
        ai_summary,
        ai_tags,
        user_tags,
        is_read,
        is_starred,
        is_in_trash,
        status,
        created_at,
        updated_at,
        starred_at
      `,
      )
      .eq("user_id", this.userId)
      .is("deleted_at", null)
      .eq("is_in_trash", false)
      .textSearch("search_vector", searchQuery, {
        type: "websearch",
        config: "simple",
      });

    if (folderId) {
      dbQuery = dbQuery.eq("folder_id", folderId);
    }

    if (platform) {
      dbQuery = dbQuery.eq("platform", platform);
    }

    if (tags && tags.length > 0) {
      dbQuery = dbQuery.overlaps("user_tags", tags);
    }

    const { data, error } = await dbQuery
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error({ error, searchQuery }, "Keyword search failed");
      throw new ServiceError("DB_ERROR", "Search failed", error);
    }

    return (data || []).map((row, index) => ({
      id: row.id,
      url: row.url,
      title: row.title,
      description: row.description,
      platform: row.platform,
      coverUrl: row.cover_url,
      folderId: row.folder_id,
      aiSummary: row.ai_summary,
      aiTags: row.ai_tags,
      userTags: row.user_tags,
      isRead: row.is_read ?? false,
      isStarred: row.is_starred,
      isInTrash: row.is_in_trash ?? false,
      status: row.status,
      createdAt: row.created_at ?? new Date().toISOString(),
      updatedAt: row.updated_at,
      starredAt: row.starred_at,
      score: 1 - index * 0.01, // 简化的分数计算
      matchType: "keyword" as const,
    }));
  }

  /**
   * 语义搜索（向量搜索）
   *
   * P1: 完整语义搜索实现（当前回退到关键词搜索）
   * 需要：
   * 1. 调用 embedding 服务将 searchQuery 转换为向量
   * 2. 使用 search_bookmarks_by_embedding RPC 进行向量搜索
   */
  private async semanticSearch(
    searchQuery: string,
    options: {
      folderId?: number;
      platform?: string;
      tags?: string[];
      limit: number;
      offset: number;
      minScore: number;
    },
  ): Promise<SearchResultItem[]> {
    // P1: 待实现真正的语义搜索
    // 需要调用 embedding 服务获取查询向量，然后调用 RPC
    // const embedding = await this.embeddingService.embed(searchQuery);
    // const { data, error } = await this.supabase.rpc("search_bookmarks_by_embedding", {
    //   p_user_id: this.userId,
    //   query_embedding: embedding,
    //   match_count: options.limit,
    //   match_threshold: options.minScore,
    //   p_folder_id: options.folderId,
    // });

    // 暂时回退到关键词搜索
    this.logger.warn(
      { searchQuery },
      "Semantic search not implemented, falling back to keyword search",
    );
    const results = await this.keywordSearch(searchQuery, options);

    // 正确标记为关键词搜索（而非语义搜索）
    return results.map((item) => ({
      ...item,
      matchType: "keyword" as const, // 正确标记实际使用的搜索类型
    }));
  }

  /**
   * 混合搜索（RRF 融合）
   */
  private async hybridSearch(
    searchQuery: string,
    options: {
      folderId?: number;
      platform?: string;
      tags?: string[];
      limit: number;
      offset: number;
      minScore: number;
    },
  ): Promise<SearchResultItem[]> {
    const { limit } = options;

    // 并行执行两种搜索
    const [keywordResults, semanticResults] = await Promise.all([
      this.keywordSearch(searchQuery, { ...options, limit: limit * 2 }),
      this.semanticSearch(searchQuery, { ...options, limit: limit * 2 }),
    ]);

    // RRF (Reciprocal Rank Fusion) 融合
    const k = 60; // RRF 常数
    const scoreMap = new Map<
      number,
      {
        score: number;
        item: SearchResultItem;
        matchType: "keyword" | "semantic" | "both";
      }
    >();

    // 处理关键词结果
    keywordResults.forEach((item, rank) => {
      const rrfScore = 1 / (k + rank + 1);
      scoreMap.set(item.id, {
        score: rrfScore,
        item,
        matchType: "keyword",
      });
    });

    // 处理语义结果
    semanticResults.forEach((item, rank) => {
      const rrfScore = 1 / (k + rank + 1);
      const existing = scoreMap.get(item.id);

      if (existing) {
        // 两种搜索都命中
        existing.score += rrfScore;
        existing.matchType = "both";
        // 使用语义搜索的分数（更精确）
        existing.item.score = item.score;
      } else {
        scoreMap.set(item.id, {
          score: rrfScore,
          item,
          matchType: "semantic",
        });
      }
    });

    // 按融合分数排序
    const fused = Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ item, matchType, score }) => ({
        ...item,
        score,
        matchType,
      }));

    return fused;
  }

  /**
   * 搜索建议（自动补全）
   */
  async getSuggestions(prefix: string, limit = 10): Promise<string[]> {
    return this.withLogging(
      "getSuggestions",
      async () => {
        // 从标题中提取建议
        const { data, error } = await this.supabase
          .from("bookmarks")
          .select("title")
          .eq("user_id", this.userId)
          .is("deleted_at", null)
          .eq("is_in_trash", false)
          .ilike("title", `%${prefix}%`)
          .limit(limit);

        if (error) {
          this.logger.error({ error, prefix }, "Get suggestions failed");
          return [];
        }

        // 提取并去重
        const suggestions = new Set<string>();
        for (const row of data || []) {
          if (row.title) {
            suggestions.add(row.title);
          }
        }

        return Array.from(suggestions).slice(0, limit);
      },
      { prefix },
    );
  }

  /**
   * 获取热门搜索
   */
  async getPopularSearches(limit = 10): Promise<string[]> {
    // 简化实现：返回最近使用的标签
    return this.withLogging("getPopularSearches", async () => {
      const { data, error } = await this.supabase
        .from("bookmarks")
        .select("user_tags")
        .eq("user_id", this.userId)
        .is("deleted_at", null)
        .not("user_tags", "is", null)
        .order("updated_at", { ascending: false })
        .limit(100);

      if (error) {
        this.logger.error({ error }, "Get popular searches failed");
        return [];
      }

      // 统计标签频率
      const tagCounts = new Map<string, number>();
      for (const row of data || []) {
        for (const tag of row.user_tags || []) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }

      // 按频率排序
      return Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([tag]) => tag);
    });
  }
}
