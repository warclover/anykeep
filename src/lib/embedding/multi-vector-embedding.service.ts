/**
 * Multi-Vector Embedding Service
 * V4.2 多向量表征系统核心服务
 *
 * @description
 * 为书签生成多维度向量表征：
 * - title_embedding: 标题向量（轻量级，快速路径使用）
 * - content_embedding: 内容向量（现有 embedding 字段）
 * - tag_embedding: 标签向量（标签语义聚合）
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { generateEmbedding } from "@/lib/utils/embedding-generator";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

/** 多向量嵌入结果 */
export interface MultiVectorResult {
  /** 标题向量 */
  titleEmbedding: number[] | null;
  /** 内容/摘要向量 */
  contentEmbedding: number[] | null;
  /** 标签向量 */
  tagEmbedding: number[] | null;
  /** 生成耗时 (ms) */
  durationMs: number;
}

/** 书签多向量数据 */
export interface BookmarkMultiVector {
  bookmarkId: number;
  title: string;
  summary?: string | null;
  aiTags?: string[] | null;
  userTags?: string[] | null;
}

/** 批量更新结果 */
export interface BatchUpdateResult {
  /** 成功更新数量 */
  successCount: number;
  /** 失败数量 */
  failedCount: number;
  /** 跳过数量（无变化） */
  skippedCount: number;
  /** 失败的书签 ID */
  failedIds: number[];
}

/** 多向量配置 */
export interface MultiVectorConfig {
  /** 是否生成标题向量 */
  generateTitle: boolean;
  /** 是否生成内容向量 */
  generateContent: boolean;
  /** 是否生成标签向量 */
  generateTag: boolean;
  /** 标题最大长度 */
  titleMaxLength: number;
  /** 内容最大长度 */
  contentMaxLength: number;
  /** 标签组合分隔符 */
  tagSeparator: string;
  /** 最小标签数（低于此值不生成标签向量） */
  minTagsForEmbedding: number;
  /** 批处理大小 */
  batchSize: number;
}

const DEFAULT_CONFIG: MultiVectorConfig = {
  generateTitle: true,
  generateContent: true,
  generateTag: true,
  titleMaxLength: 200,
  contentMaxLength: 2000,
  tagSeparator: " | ",
  minTagsForEmbedding: 1,
  batchSize: 10,
};

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * 多向量嵌入服务
 */
export class MultiVectorEmbeddingService {
  private supabase: SupabaseClient<Database>;
  private config: MultiVectorConfig;

  constructor(
    supabase: SupabaseClient<Database>,
    config?: Partial<MultiVectorConfig>,
  ) {
    this.supabase = supabase;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * 为单个书签生成所有向量
   */
  async generateAllVectors(
    bookmark: BookmarkMultiVector,
  ): Promise<MultiVectorResult> {
    const startTime = Date.now();

    const [titleEmbedding, contentEmbedding, tagEmbedding] = await Promise.all([
      this.config.generateTitle
        ? this.generateTitleEmbedding(bookmark.title)
        : null,
      this.config.generateContent
        ? this.generateContentEmbedding(bookmark.title, bookmark.summary)
        : null,
      this.config.generateTag
        ? this.generateTagEmbedding(bookmark.aiTags, bookmark.userTags)
        : null,
    ]);

    const durationMs = Date.now() - startTime;

    logger.debug(
      {
        bookmarkId: bookmark.bookmarkId,
        hasTitle: !!titleEmbedding,
        hasContent: !!contentEmbedding,
        hasTag: !!tagEmbedding,
        durationMs,
      },
      "MultiVector: Generated all vectors",
    );

    return {
      titleEmbedding,
      contentEmbedding,
      tagEmbedding,
      durationMs,
    };
  }

  /**
   * 生成标题向量
   * 使用纯标题文本，适用于快速路径匹配
   */
  async generateTitleEmbedding(title: string): Promise<number[] | null> {
    if (!title || title.trim().length === 0) {
      return null;
    }

    try {
      const truncatedTitle = title.substring(0, this.config.titleMaxLength);
      const embedding = await generateEmbedding(truncatedTitle);
      return embedding;
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        "MultiVector: Failed to generate title embedding",
      );
      return null;
    }
  }

  /**
   * 生成内容向量
   * 合并标题和摘要，用于深度语义匹配
   */
  async generateContentEmbedding(
    title: string,
    summary?: string | null,
  ): Promise<number[] | null> {
    const parts: string[] = [];

    if (title) {
      parts.push(title);
    }

    if (summary) {
      parts.push(summary);
    }

    if (parts.length === 0) {
      return null;
    }

    try {
      const text = parts
        .join("\n\n")
        .substring(0, this.config.contentMaxLength);
      const embedding = await generateEmbedding(text);
      return embedding;
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        "MultiVector: Failed to generate content embedding",
      );
      return null;
    }
  }

  /**
   * 生成标签向量
   * 合并 AI 标签和用户标签，捕获标签语义
   */
  async generateTagEmbedding(
    aiTags?: string[] | null,
    userTags?: string[] | null,
  ): Promise<number[] | null> {
    const allTags: string[] = [];

    if (aiTags && aiTags.length > 0) {
      allTags.push(...aiTags);
    }

    if (userTags && userTags.length > 0) {
      allTags.push(...userTags);
    }

    // 去重并检查最小数量
    const uniqueTags = [...new Set(allTags)];
    if (uniqueTags.length < this.config.minTagsForEmbedding) {
      return null;
    }

    try {
      // 构建标签文本：使用分隔符连接，保持语义关联
      const tagText = uniqueTags.join(this.config.tagSeparator);
      const embedding = await generateEmbedding(tagText);
      return embedding;
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        "MultiVector: Failed to generate tag embedding",
      );
      return null;
    }
  }

  /**
   * 更新单个书签的多向量
   */
  async updateBookmarkVectors(
    bookmarkId: number,
    bookmark: BookmarkMultiVector,
  ): Promise<boolean> {
    try {
      const vectors = await this.generateAllVectors(bookmark);

      const updateData: Record<string, unknown> = {
        embedding_version: 2,
      };

      if (vectors.titleEmbedding) {
        updateData.title_embedding = vectors.titleEmbedding;
        updateData.title_embedding_at = new Date().toISOString();
      }

      if (vectors.contentEmbedding) {
        updateData.embedding = vectors.contentEmbedding;
      }

      if (vectors.tagEmbedding) {
        updateData.tag_embedding = vectors.tagEmbedding;
        updateData.tag_embedding_at = new Date().toISOString();
      }

      const { error } = await this.supabase
        .from("bookmarks")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(updateData as any)
        .eq("id", bookmarkId);

      if (error) {
        logger.error(
          { bookmarkId, error: error.message },
          "MultiVector: Failed to update bookmark vectors",
        );
        return false;
      }

      logger.info(
        { bookmarkId, durationMs: vectors.durationMs },
        "MultiVector: Updated bookmark vectors",
      );
      return true;
    } catch (error) {
      logger.error(
        {
          bookmarkId,
          error: error instanceof Error ? error.message : String(error),
        },
        "MultiVector: Failed to update bookmark vectors",
      );
      return false;
    }
  }

  /**
   * 批量更新书签的多向量
   */
  async batchUpdateBookmarkVectors(
    bookmarks: BookmarkMultiVector[],
  ): Promise<BatchUpdateResult> {
    const result: BatchUpdateResult = {
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      failedIds: [],
    };

    // 分批处理
    for (let i = 0; i < bookmarks.length; i += this.config.batchSize) {
      const batch = bookmarks.slice(i, i + this.config.batchSize);

      // 并行处理每批
      const updateResults = await Promise.all(
        batch.map(async (bookmark) => {
          const success = await this.updateBookmarkVectors(
            bookmark.bookmarkId,
            bookmark,
          );
          return { bookmarkId: bookmark.bookmarkId, success };
        }),
      );

      for (const { bookmarkId, success } of updateResults) {
        if (success) {
          result.successCount++;
        } else {
          result.failedCount++;
          result.failedIds.push(bookmarkId);
        }
      }
    }

    logger.info(
      {
        total: bookmarks.length,
        success: result.successCount,
        failed: result.failedCount,
      },
      "MultiVector: Batch update completed",
    );

    return result;
  }

  /**
   * 获取待迁移到多向量的书签
   */
  async getPendingBookmarks(
    userId: string,
    limit = 100,
  ): Promise<BookmarkMultiVector[]> {
    const { data, error } = await this.supabase
      .from("bookmarks")
      .select("id, title, ai_summary, ai_tags, user_tags")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .or("title_embedding.is.null,tag_embedding.is.null")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      logger.error(
        { userId, error: error.message },
        "MultiVector: Failed to get pending bookmarks",
      );
      return [];
    }

    return (data || []).map((b) => ({
      bookmarkId: b.id,
      title: b.title ?? "",
      summary: b.ai_summary,
      aiTags: b.ai_tags,
      userTags: b.user_tags,
    }));
  }

  /**
   * 为用户迁移所有书签到多向量版本
   */
  async migrateUserBookmarks(
    userId: string,
    progressCallback?: (current: number, total: number) => void,
  ): Promise<BatchUpdateResult> {
    const totalResult: BatchUpdateResult = {
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      failedIds: [],
    };

    let offset = 0;
    const pageSize = 100;

    // 首先获取总数
    const { count } = await this.supabase
      .from("bookmarks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null)
      .or("title_embedding.is.null,tag_embedding.is.null");

    const total = count || 0;

    if (total === 0) {
      logger.info({ userId }, "MultiVector: No bookmarks need migration");
      return totalResult;
    }

    logger.info(
      { userId, total },
      "MultiVector: Starting user bookmark migration",
    );

    while (true) {
      const bookmarks = await this.getPendingBookmarks(userId, pageSize);

      if (bookmarks.length === 0) {
        break;
      }

      const batchResult = await this.batchUpdateBookmarkVectors(bookmarks);

      totalResult.successCount += batchResult.successCount;
      totalResult.failedCount += batchResult.failedCount;
      totalResult.failedIds.push(...batchResult.failedIds);

      offset += bookmarks.length;

      if (progressCallback) {
        progressCallback(Math.min(offset, total), total);
      }

      // 如果返回数量少于 pageSize，说明没有更多数据
      if (bookmarks.length < pageSize) {
        break;
      }
    }

    logger.info(
      {
        userId,
        total: totalResult.successCount + totalResult.failedCount,
        success: totalResult.successCount,
        failed: totalResult.failedCount,
      },
      "MultiVector: User bookmark migration completed",
    );

    return totalResult;
  }

  /**
   * 仅更新标题向量（用于快速路径优化）
   */
  async updateTitleEmbeddingOnly(
    bookmarkId: number,
    title: string,
  ): Promise<boolean> {
    try {
      const embedding = await this.generateTitleEmbedding(title);
      if (!embedding) {
        return false;
      }

      const { error } = await this.supabase
        .from("bookmarks")

        .update({
          title_embedding: embedding,

          title_embedding_at: new Date().toISOString(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .eq("id", bookmarkId);

      if (error) {
        logger.error(
          { bookmarkId, error: error.message },
          "MultiVector: Failed to update title embedding",
        );
        return false;
      }

      return true;
    } catch (error) {
      logger.error(
        {
          bookmarkId,
          error: error instanceof Error ? error.message : String(error),
        },
        "MultiVector: Failed to update title embedding",
      );
      return false;
    }
  }

  /**
   * 仅更新标签向量（当标签变化时调用）
   */
  async updateTagEmbeddingOnly(
    bookmarkId: number,
    aiTags?: string[] | null,
    userTags?: string[] | null,
  ): Promise<boolean> {
    try {
      const embedding = await this.generateTagEmbedding(aiTags, userTags);

      const { error } = await this.supabase
        .from("bookmarks")

        .update({
          tag_embedding: embedding,

          tag_embedding_at: embedding ? new Date().toISOString() : null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .eq("id", bookmarkId);

      if (error) {
        logger.error(
          { bookmarkId, error: error.message },
          "MultiVector: Failed to update tag embedding",
        );
        return false;
      }

      return true;
    } catch (error) {
      logger.error(
        {
          bookmarkId,
          error: error instanceof Error ? error.message : String(error),
        },
        "MultiVector: Failed to update tag embedding",
      );
      return false;
    }
  }

  // ==========================================================================
  // Search Methods
  // ==========================================================================

  /**
   * 基于标题向量的快速搜索
   */
  async searchByTitleVector(
    userId: string,
    queryEmbedding: number[],
    limit = 5,
    minSimilarity = 0.5,
  ): Promise<
    Array<{
      bookmarkId: number;
      title: string;
      folderId: number | null;
      folderName: string | null;
      similarity: number;
    }>
  > {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase.rpc as any)(
      "search_bookmarks_by_title_vector",
      {
        p_user_id: userId,
        p_query_embedding: JSON.stringify(queryEmbedding),
        p_limit: limit,
        p_min_similarity: minSimilarity,
      },
    );

    if (error) {
      logger.warn(
        { error: error.message },
        "MultiVector: Failed to search by title vector",
      );
      return [];
    }

    return (data || []).map(
      (row: {
        bookmark_id: number;
        title: string;
        folder_id: number | null;
        folder_name: string | null;
        similarity: number;
      }) => ({
        bookmarkId: row.bookmark_id,
        title: row.title,
        folderId: row.folder_id,
        folderName: row.folder_name,
        similarity: row.similarity,
      }),
    );
  }

  /**
   * 多向量融合搜索
   */
  async searchMultiVector(
    userId: string,
    queryEmbedding: number[],
    weights?: { title?: number; content?: number; tag?: number },
    limit = 10,
  ): Promise<
    Array<{
      bookmarkId: number;
      title: string;
      folderId: number | null;
      folderName: string | null;
      titleSimilarity: number;
      contentSimilarity: number;
      tagSimilarity: number;
      weightedSimilarity: number;
    }>
  > {
    const titleWeight = weights?.title ?? 0.3;
    const contentWeight = weights?.content ?? 0.5;
    const tagWeight = weights?.tag ?? 0.2;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase.rpc as any)(
      "search_bookmarks_multi_vector",
      {
        p_user_id: userId,
        p_query_embedding: JSON.stringify(queryEmbedding),
        p_title_weight: titleWeight,
        p_content_weight: contentWeight,
        p_tag_weight: tagWeight,
        p_limit: limit,
      },
    );

    if (error) {
      logger.warn(
        { error: error.message },
        "MultiVector: Failed to search multi-vector",
      );
      return [];
    }

    return (data || []).map(
      (row: {
        bookmark_id: number;
        title: string;
        folder_id: number | null;
        folder_name: string | null;
        title_similarity: number;
        content_similarity: number;
        tag_similarity: number;
        weighted_similarity: number;
      }) => ({
        bookmarkId: row.bookmark_id,
        title: row.title,
        folderId: row.folder_id,
        folderName: row.folder_name,
        titleSimilarity: row.title_similarity,
        contentSimilarity: row.content_similarity,
        tagSimilarity: row.tag_similarity,
        weightedSimilarity: row.weighted_similarity,
      }),
    );
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * 创建多向量嵌入服务实例
 */
export function createMultiVectorEmbeddingService(
  supabase: SupabaseClient<Database>,
  config?: Partial<MultiVectorConfig>,
): MultiVectorEmbeddingService {
  return new MultiVectorEmbeddingService(supabase, config);
}

export default MultiVectorEmbeddingService;
