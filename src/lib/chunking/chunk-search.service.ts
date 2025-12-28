/**
 * 切片搜索服务
 *
 * 基于 Parent-Child 切片的向量搜索服务
 * - 搜索 Child 切片获取精准匹配
 * - 返回 Parent 上下文保证完整性
 *
 * @module chunking/chunk-search-service
 * @version 1.0.0
 * @since 2025-12-28
 */

import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import type { ChunkType } from "./types";

/**
 * 切片搜索选项
 */
export interface ChunkSearchOptions {
  /** 相似度阈值 (0-1) */
  matchThreshold?: number;
  /** 返回数量 */
  matchCount?: number;
  /** 是否包含 Parent 上下文 */
  includeParentContext?: boolean;
  /** 按书签 ID 过滤 */
  bookmarkIds?: number[];
}

/**
 * 搜索结果
 */
export interface ChunkSearchResultWithContext {
  chunkId: string;
  bookmarkId: number;
  content: string;
  chunkType: ChunkType;
  chunkIndex: number;
  similarity: number;
  parentContent?: string;
  bookmarkTitle?: string;
  bookmarkUrl?: string;
}

/**
 * 默认搜索选项
 */
const DEFAULT_SEARCH_OPTIONS: Required<ChunkSearchOptions> = {
  matchThreshold: 0.5,
  matchCount: 20,
  includeParentContext: true,
  bookmarkIds: [],
};

/**
 * 切片搜索服务
 *
 * 注意：此服务依赖于 bookmark_chunks 表和 search_bookmark_chunks 函数
 * 需要先执行数据库迁移 20251228000006_add_bookmark_chunks.sql
 */
export class ChunkSearchService {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabaseClient?: ReturnType<typeof createClient>) {
    this.supabase =
      supabaseClient ||
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );
  }

  /**
   * 向量搜索切片
   *
   * @param queryEmbedding - 查询向量
   * @param userId - 用户 ID
   * @param options - 搜索选项
   * @returns 搜索结果
   */
  async search(
    queryEmbedding: number[],
    userId: string,
    options?: ChunkSearchOptions,
  ): Promise<ChunkSearchResultWithContext[]> {
    const opts = { ...DEFAULT_SEARCH_OPTIONS, ...options };

    try {
      // 调用数据库函数
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (this.supabase.rpc as any)(
        "search_bookmark_chunks",
        {
          query_embedding: JSON.stringify(queryEmbedding),
          match_threshold: opts.matchThreshold,
          match_count: opts.matchCount,
          p_user_id: userId,
        },
      );

      if (error) {
        logger.error({ error }, "ChunkSearchService: Search failed");
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // 转换结果格式
      const results: ChunkSearchResultWithContext[] = data.map(
        (row: {
          chunk_id: string;
          bookmark_id: number;
          chunk_content: string;
          chunk_type: string;
          chunk_index: number;
          parent_content: string | null;
          similarity: number;
        }) => ({
          chunkId: row.chunk_id,
          bookmarkId: row.bookmark_id,
          content: row.chunk_content,
          chunkType: row.chunk_type as ChunkType,
          chunkIndex: row.chunk_index,
          similarity: row.similarity,
          parentContent: opts.includeParentContext
            ? row.parent_content || undefined
            : undefined,
        }),
      );

      // 如果需要按书签 ID 过滤
      if (opts.bookmarkIds.length > 0) {
        return results.filter((r) => opts.bookmarkIds.includes(r.bookmarkId));
      }

      logger.debug(
        {
          resultCount: results.length,
          topSimilarity: results[0]?.similarity,
        },
        "ChunkSearchService: Search completed",
      );

      return results;
    } catch (err) {
      logger.error({ err }, "ChunkSearchService: Search error");
      return [];
    }
  }

  /**
   * 获取书签的所有切片
   *
   * @param bookmarkId - 书签 ID
   * @returns 切片列表
   */
  async getChunksByBookmark(
    bookmarkId: number,
  ): Promise<ChunkSearchResultWithContext[]> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (this.supabase as any)
        .from("bookmark_chunks")
        .select("*")
        .eq("bookmark_id", bookmarkId)
        .order("chunk_index", { ascending: true });

      if (error) {
        logger.error(
          { error, bookmarkId },
          "ChunkSearchService: Get chunks failed",
        );
        throw error;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data || []).map((row: any) => ({
        chunkId: row.id,
        bookmarkId: row.bookmark_id,
        content: row.content,
        chunkType: row.chunk_type as ChunkType,
        chunkIndex: row.chunk_index,
        similarity: 1, // 非搜索场景，默认为1
      }));
    } catch (err) {
      logger.error({ err, bookmarkId }, "ChunkSearchService: Get chunks error");
      return [];
    }
  }

  /**
   * 保存书签切片
   *
   * @param bookmarkId - 书签 ID
   * @param chunks - 切片数组
   * @param embeddings - 对应的向量嵌入
   * @param embeddingVersion - 嵌入版本
   */
  async saveChunks(
    bookmarkId: number,
    chunks: Array<{
      content: string;
      index: number;
      tokenCount: number;
      startOffset: number;
      endOffset: number;
      parentIndex?: number;
      type: ChunkType;
      contentHash: string;
    }>,
    embeddings: (number[] | null)[],
    embeddingVersion: string = "v1",
  ): Promise<void> {
    if (chunks.length === 0) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = this.supabase as any;

      // 先删除旧的切片
      await supabase
        .from("bookmark_chunks")
        .delete()
        .eq("bookmark_id", bookmarkId);

      // 创建 Parent 切片记录（用于关联）
      const parentChunks = chunks.filter((c) => c.type === "parent");
      const childChunks = chunks.filter((c) => c.type === "child");

      // 先插入 Parent 切片
      const parentRecords = parentChunks.map((chunk) => ({
        bookmark_id: bookmarkId,
        chunk_index: chunk.index,
        content: chunk.content,
        content_hash: chunk.contentHash,
        chunk_type: "parent" as const,
        token_count: chunk.tokenCount,
        start_offset: chunk.startOffset,
        end_offset: chunk.endOffset,
        embedding: embeddings[chunk.index]
          ? JSON.stringify(embeddings[chunk.index])
          : null, // Parent 切片不需要嵌入
        embedding_version: embeddingVersion,
      }));

      const parentIdMap: Map<number, string> = new Map();

      if (parentRecords.length > 0) {
        const { data: insertedParents, error: parentError } = await supabase
          .from("bookmark_chunks")
          .insert(parentRecords)
          .select("id, chunk_index");

        if (parentError) {
          throw parentError;
        }

        // 建立 index -> id 映射
        insertedParents?.forEach((p: { id: string; chunk_index: number }) => {
          parentIdMap.set(p.chunk_index, p.id);
        });
      }

      // 插入 Child 切片（带 parent_chunk_id）
      if (childChunks.length > 0) {
        const childRecords = childChunks.map((chunk) => ({
          bookmark_id: bookmarkId,
          parent_chunk_id:
            chunk.parentIndex !== undefined
              ? parentIdMap.get(chunk.parentIndex) || null
              : null,
          chunk_index: chunk.index,
          content: chunk.content,
          content_hash: chunk.contentHash,
          chunk_type: "child" as const,
          token_count: chunk.tokenCount,
          start_offset: chunk.startOffset,
          end_offset: chunk.endOffset,
          embedding: embeddings[chunk.index]
            ? JSON.stringify(embeddings[chunk.index])
            : null,
          embedding_version: embeddingVersion,
        }));

        const { error: childError } = await supabase
          .from("bookmark_chunks")
          .insert(childRecords);

        if (childError) {
          throw childError;
        }
      }

      logger.debug(
        {
          bookmarkId,
          parentCount: parentChunks.length,
          childCount: childChunks.length,
        },
        "ChunkSearchService: Chunks saved",
      );
    } catch (err) {
      logger.error(
        { err, bookmarkId },
        "ChunkSearchService: Save chunks error",
      );
      throw err;
    }
  }

  /**
   * 删除书签的所有切片
   *
   * @param bookmarkId - 书签 ID
   */
  async deleteChunks(bookmarkId: number): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (this.supabase as any)
        .from("bookmark_chunks")
        .delete()
        .eq("bookmark_id", bookmarkId);

      if (error) {
        throw error;
      }

      logger.debug({ bookmarkId }, "ChunkSearchService: Chunks deleted");
    } catch (err) {
      logger.error(
        { err, bookmarkId },
        "ChunkSearchService: Delete chunks error",
      );
      throw err;
    }
  }

  /**
   * 检查切片是否已存在（通过内容哈希）
   *
   * @param contentHash - 内容哈希
   * @param bookmarkId - 书签 ID
   * @returns 是否存在
   */
  async chunkExists(contentHash: string, bookmarkId: number): Promise<boolean> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (this.supabase as any)
        .from("bookmark_chunks")
        .select("id")
        .eq("bookmark_id", bookmarkId)
        .eq("content_hash", contentHash)
        .limit(1);

      if (error) {
        throw error;
      }

      return (data?.length || 0) > 0;
    } catch (err) {
      logger.error(
        { err, contentHash },
        "ChunkSearchService: Check exists error",
      );
      return false;
    }
  }
}

// 单例实例
let chunkSearchInstance: ChunkSearchService | null = null;

/**
 * 获取 ChunkSearchService 单例
 */
export function getChunkSearchService(
  supabaseClient?: ReturnType<typeof createClient>,
): ChunkSearchService {
  if (!chunkSearchInstance) {
    chunkSearchInstance = new ChunkSearchService(supabaseClient);
  }
  return chunkSearchInstance;
}

/**
 * 重置单例（用于测试）
 */
export function resetChunkSearchService(): void {
  chunkSearchInstance = null;
}
