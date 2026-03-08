/**
 * 智能分类 v5.0 - VectorSearch Service
 *
 * 使用 Supabase pgvector 进行文件夹相似度搜索
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { initSupabaseAdmin } from "@/lib/supabase/admin-client";
import type { LoggerService } from "../logger";
import { supabaseEnv } from "@/lib/env";
import type {
  VectorSearchConfig,
  VectorSearchRequest,
  SearchResult,
  FolderProfileRow,
} from "./types";
import { VectorSearchError } from "./types";

/**
 * VectorSearch Service 类
 */
export class VectorSearchService {
  private client: SupabaseClient;
  private config: VectorSearchConfig;
  private logger: LoggerService;

  constructor(logger: LoggerService, config?: Partial<VectorSearchConfig>) {
    this.logger = logger.child({ service: "VectorSearchService" });

    this.config = {
      supabaseUrl: config?.supabaseUrl ?? supabaseEnv.url,
      supabaseServiceKey:
        config?.supabaseServiceKey ?? supabaseEnv.serviceRoleKey,
      defaultLimit: config?.defaultLimit ?? 5,
      minSimilarity: config?.minSimilarity ?? 0.3, // v5.1.4: 从 0.5 降至 0.3，适配实际相似度分布
      maxRetries: config?.maxRetries ?? 3,
      retryDelays: config?.retryDelays ?? [1000, 2000, 4000],
    };

    if (!this.config.supabaseUrl || !this.config.supabaseServiceKey) {
      throw new VectorSearchError(
        "Supabase URL and Service Role Key are required",
      );
    }

    this.client = initSupabaseAdmin() as unknown as SupabaseClient;
  }

  /**
   * 执行向量搜索
   */
  async search(request: VectorSearchRequest): Promise<SearchResult[]> {
    this.validateRequest(request);

    const limit = request.limit ?? this.config.defaultLimit;
    const minSimilarity = request.minSimilarity ?? this.config.minSimilarity;

    this.logger.debug("执行向量搜索", {
      userId: request.userId,
      hasContentEmbedding: !!request.contentEmbedding,
      hasBehaviorEmbedding: !!request.behaviorEmbedding,
      alpha: request.alpha,
      limit,
      minSimilarity,
    });

    // 根据提供的向量类型选择搜索策略
    if (request.contentEmbedding && request.behaviorEmbedding) {
      return this.hybridSearch(request, limit, minSimilarity);
    } else if (request.contentEmbedding) {
      return this.contentSearch(request, limit, minSimilarity);
    } else if (request.behaviorEmbedding) {
      return this.behaviorSearch(request, limit, minSimilarity);
    } else {
      throw new VectorSearchError(
        "At least one embedding (content or behavior) is required",
      );
    }
  }

  /**
   * 内容向量搜索
   */
  private async contentSearch(
    request: VectorSearchRequest,
    limit: number,
    minSimilarity: number,
  ): Promise<SearchResult[]> {
    return await this.executeWithRetry(async () => {
      const { data, error } = await this.client.rpc(
        "match_folder_profiles_v5",
        {
          p_user_id: request.userId,
          p_content_embedding: request.contentEmbedding ?? null,
          p_behavior_embedding: null,
          p_alpha: 0, // 纯内容搜索
          p_match_threshold: minSimilarity,
          p_match_count: limit,
        },
      );

      if (error) {
        throw new VectorSearchError(
          `Content search failed: ${error.message}`,
          error,
        );
      }

      const results: SearchResult[] = (data || []).map(
        (row: FolderProfileRow) => ({
          profileId: row.profile_id,
          folderId: row.folder_id,
          folderName: row.folder_name,
          similarity: row.similarity,
          matchType: "content" as const,
        }),
      );

      this.logger.debug("内容搜索完成", {
        resultCount: results.length,
        topSimilarity: results[0]?.similarity,
      });

      return results;
    });
  }

  /**
   * 行为向量搜索
   */
  private async behaviorSearch(
    request: VectorSearchRequest,
    limit: number,
    minSimilarity: number,
  ): Promise<SearchResult[]> {
    return await this.executeWithRetry(async () => {
      const { data, error } = await this.client.rpc(
        "match_folder_profiles_v5",
        {
          p_user_id: request.userId,
          p_content_embedding: null,
          p_behavior_embedding: request.behaviorEmbedding ?? null,
          p_alpha: 1, // 纯行为搜索
          p_match_threshold: minSimilarity,
          p_match_count: limit,
        },
      );

      if (error) {
        throw new VectorSearchError(
          `Behavior search failed: ${error.message}`,
          error,
        );
      }

      const results: SearchResult[] = (data || []).map(
        (row: FolderProfileRow) => ({
          profileId: row.profile_id,
          folderId: row.folder_id,
          folderName: row.folder_name,
          similarity: row.similarity,
          matchType: "behavior" as const,
        }),
      );

      this.logger.debug("行为搜索完成", {
        resultCount: results.length,
        topSimilarity: results[0]?.similarity,
      });

      return results;
    });
  }

  /**
   * 混合向量搜索（内容 + 行为）
   */
  private async hybridSearch(
    request: VectorSearchRequest,
    limit: number,
    minSimilarity: number,
  ): Promise<SearchResult[]> {
    const alpha = request.alpha ?? 0.5; // 默认 50/50 混合

    return await this.executeWithRetry(async () => {
      const { data, error } = await this.client.rpc(
        "match_folder_profiles_v5",
        {
          p_user_id: request.userId,
          p_content_embedding: request.contentEmbedding ?? null,
          p_behavior_embedding: request.behaviorEmbedding ?? null,
          p_alpha: alpha,
          p_match_threshold: minSimilarity,
          p_match_count: limit,
        },
      );

      if (error) {
        throw new VectorSearchError(
          `Hybrid search failed: ${error.message}`,
          error,
        );
      }

      const results: SearchResult[] = (data || []).map(
        (row: FolderProfileRow) => ({
          profileId: row.profile_id,
          folderId: row.folder_id,
          folderName: row.folder_name,
          similarity: row.similarity,
          matchType: "hybrid" as const,
        }),
      );

      this.logger.debug("混合搜索完成", {
        alpha,
        resultCount: results.length,
        topSimilarity: results[0]?.similarity,
      });

      return results;
    });
  }

  /**
   * 验证搜索请求
   */
  private validateRequest(request: VectorSearchRequest): void {
    if (!request.userId) {
      throw new VectorSearchError("User ID is required");
    }

    if (request.contentEmbedding && request.contentEmbedding.length !== 1024) {
      throw new VectorSearchError("Content embedding must be 1024 dimensions");
    }

    if (
      request.behaviorEmbedding &&
      request.behaviorEmbedding.length !== 1024
    ) {
      throw new VectorSearchError("Behavior embedding must be 1024 dimensions");
    }

    if (
      request.alpha !== undefined &&
      (request.alpha < 0 || request.alpha > 1)
    ) {
      throw new VectorSearchError("Alpha coefficient must be between 0 and 1");
    }

    if (request.limit !== undefined && request.limit <= 0) {
      throw new VectorSearchError("Limit must be greater than 0");
    }

    if (
      request.minSimilarity !== undefined &&
      (request.minSimilarity < 0 || request.minSimilarity > 1)
    ) {
      throw new VectorSearchError("Min similarity must be between 0 and 1");
    }
  }

  /**
   * 执行带重试的操作（指数退避）
   * 最多重试 3 次，延迟 1s, 2s, 4s
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    retryCount: number = 0,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const isLastRetry = retryCount >= this.config.maxRetries - 1;

      if (isLastRetry) {
        this.logger.error(
          "操作失败，已达到最大重试次数",
          error instanceof Error ? error : undefined,
          {
            retryCount,
          },
        );
        throw error;
      }

      const delay = this.config.retryDelays[retryCount];
      this.logger.warn("操作失败，准备重试", {
        retryCount: retryCount + 1,
        maxRetries: this.config.maxRetries,
        delayMs: delay,
        error: error instanceof Error ? error.message : String(error),
      });

      await this.sleep(delay);
      return this.executeWithRetry(operation, retryCount + 1);
    }
  }

  /**
   * 延迟执行
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
