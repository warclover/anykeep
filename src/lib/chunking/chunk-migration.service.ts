/**
 * Parent-Child 切片迁移服务
 *
 * 将现有书签的长文本内容拆分为 Parent-Child 切片结构
 * 用于提升长文档的精准检索能力
 *
 * @module chunking/chunk-migration.service
 * @version 1.0.0
 * @since 2026-01-02
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { logger } from "@/lib/logger";
import { SemanticChunker } from "./semantic-chunker";
import { generateEmbedding } from "@/lib/utils/embedding-generator";
import type { Chunk, ChunkConfig } from "./types";

/**
 * 迁移候选书签
 */
interface MigrationCandidate {
  id: number;
  user_id: string;
  title: string | null;
  ai_summary: string | null;
  description: string | null;
}

/**
 * 迁移进度
 */
export interface MigrationProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  chunksCreated: number;
  errors: Array<{ bookmarkId: number; error: string }>;
  durationMs: number;
}

/**
 * 迁移选项
 */
export interface MigrationOptions {
  /** 批处理大小 */
  batchSize?: number;
  /** 最小内容长度（字符数），低于此值跳过 */
  minContentLength?: number;
  /** 是否生成 embedding */
  generateEmbeddings?: boolean;
  /** 是否跳过已有切片的书签 */
  skipExisting?: boolean;
  /** 自定义切片配置 */
  chunkConfig?: Partial<ChunkConfig>;
  /** 用户 ID（限制迁移范围） */
  userId?: string;
}

const DEFAULT_OPTIONS: Required<MigrationOptions> = {
  batchSize: 10,
  minContentLength: 200,
  generateEmbeddings: true,
  skipExisting: true,
  chunkConfig: {},
  userId: "",
};

/**
 * Parent-Child 切片迁移服务
 */
export class ChunkMigrationService {
  private supabase: SupabaseClient<Database>;
  private options: Required<MigrationOptions>;
  private chunker: SemanticChunker;

  constructor(supabase: SupabaseClient<Database>, options?: MigrationOptions) {
    this.supabase = supabase;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.chunker = new SemanticChunker(this.options.chunkConfig);
  }

  /**
   * 获取需要迁移的书签数量
   */
  async getMigrationCandidateCount(): Promise<number> {
    let query = this.supabase
      .from("bookmarks")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null);

    // 如果指定了用户 ID，限制范围
    if (this.options.userId) {
      query = query.eq("user_id", this.options.userId);
    }

    // 如果跳过已有切片的书签
    if (this.options.skipExisting) {
      // 使用子查询排除已有切片的书签
      const { data: existingBookmarkIds } = await this.supabase
        .from("bookmark_chunks")
        .select("bookmark_id")
        .limit(10000);

      const ids = existingBookmarkIds?.map((r) => r.bookmark_id) ?? [];
      if (ids.length > 0) {
        query = query.not("id", "in", `(${ids.join(",")})`);
      }
    }

    const { count, error } = await query;

    if (error) {
      logger.error({ error }, "ChunkMigration: Failed to count candidates");
      return 0;
    }

    return count ?? 0;
  }

  /**
   * 获取迁移候选书签
   */
  private async getMigrationCandidates(
    offset: number,
    limit: number,
  ): Promise<MigrationCandidate[]> {
    let query = this.supabase
      .from("bookmarks")
      .select("id, user_id, title, ai_summary, description")
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);

    // 如果指定了用户 ID，限制范围
    if (this.options.userId) {
      query = query.eq("user_id", this.options.userId);
    }

    const { data, error } = await query;

    if (error) {
      logger.error({ error }, "ChunkMigration: Failed to fetch candidates");
      return [];
    }

    const candidates = (data ?? []) as MigrationCandidate[];

    // 如果跳过已有切片的书签，过滤掉
    if (this.options.skipExisting && candidates.length > 0) {
      const bookmarkIds = candidates.map((c) => c.id);
      const { data: existingChunks } = await this.supabase
        .from("bookmark_chunks")
        .select("bookmark_id")
        .in("bookmark_id", bookmarkIds);

      const existingIds = new Set(existingChunks?.map((c) => c.bookmark_id));
      return candidates.filter((c) => !existingIds.has(c.id));
    }

    return candidates;
  }

  /**
   * 执行迁移
   */
  async migrate(): Promise<MigrationProgress> {
    const startTime = Date.now();
    const progress: MigrationProgress = {
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      chunksCreated: 0,
      errors: [],
      durationMs: 0,
    };

    try {
      // 获取总数
      progress.total = await this.getMigrationCandidateCount();

      logger.info(
        { total: progress.total, options: this.options },
        "ChunkMigration: Starting migration",
      );

      if (progress.total === 0) {
        progress.durationMs = Date.now() - startTime;
        return progress;
      }

      // 分批处理
      let offset = 0;

      while (progress.processed < progress.total) {
        const candidates = await this.getMigrationCandidates(
          offset,
          this.options.batchSize,
        );

        if (candidates.length === 0) {
          break;
        }

        // 并行处理批次内的书签
        const results = await Promise.allSettled(
          candidates.map((candidate) => this.migrateBookmark(candidate)),
        );

        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const candidate = candidates[i];

          if (result.status === "fulfilled") {
            if (result.value.skipped) {
              progress.skipped++;
            } else {
              progress.successful++;
              progress.chunksCreated += result.value.chunksCreated;
            }
          } else {
            progress.failed++;
            progress.errors.push({
              bookmarkId: candidate.id,
              error:
                result.reason instanceof Error
                  ? result.reason.message
                  : String(result.reason),
            });
          }

          progress.processed++;
        }

        offset += this.options.batchSize;

        // 进度日志
        logger.info(
          {
            processed: progress.processed,
            total: progress.total,
            successful: progress.successful,
            failed: progress.failed,
          },
          "ChunkMigration: Progress update",
        );
      }

      progress.durationMs = Date.now() - startTime;

      logger.info(
        {
          ...progress,
          durationSeconds: (progress.durationMs / 1000).toFixed(2),
        },
        "ChunkMigration: Migration completed",
      );

      return progress;
    } catch (error) {
      progress.durationMs = Date.now() - startTime;

      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "ChunkMigration: Migration failed",
      );

      return progress;
    }
  }

  /**
   * 迁移单个书签
   */
  private async migrateBookmark(
    bookmark: MigrationCandidate,
  ): Promise<{ skipped: boolean; chunksCreated: number }> {
    // 组合内容
    const content = this.buildContent(bookmark);

    // 检查内容长度
    if (content.length < this.options.minContentLength) {
      return { skipped: true, chunksCreated: 0 };
    }

    // 切片
    const chunks = this.chunker.chunk(content);

    if (chunks.length === 0) {
      return { skipped: true, chunksCreated: 0 };
    }

    // 生成 embedding（如果启用）
    const chunksWithEmbedding = this.options.generateEmbeddings
      ? await this.generateChunkEmbeddings(chunks)
      : chunks.map((c) => ({ ...c, embedding: null }));

    // 保存到数据库
    await this.saveChunks(bookmark.id, chunksWithEmbedding);

    return { skipped: false, chunksCreated: chunks.length };
  }

  /**
   * 构建书签内容
   */
  private buildContent(bookmark: MigrationCandidate): string {
    const parts: string[] = [];

    // 组合可用字段
    if (bookmark.title?.trim()) {
      parts.push(`# ${bookmark.title.trim()}`);
    }
    if (bookmark.ai_summary?.trim()) {
      parts.push(bookmark.ai_summary.trim());
    }
    if (bookmark.description?.trim()) {
      parts.push(bookmark.description.trim());
    }

    return parts.join("\n\n");
  }

  /**
   * 生成切片的 embedding
   */
  private async generateChunkEmbeddings(
    chunks: Chunk[],
  ): Promise<(Chunk & { embedding: number[] | null })[]> {
    const results: (Chunk & { embedding: number[] | null })[] = [];

    // 只为 child 类型的切片生成 embedding（parent 用于上下文，不参与检索）
    for (const chunk of chunks) {
      if (chunk.type === "child") {
        try {
          const embedding = await generateEmbedding(chunk.content);
          results.push({ ...chunk, embedding });
        } catch (error) {
          logger.warn(
            { chunkIndex: chunk.index, error },
            "ChunkMigration: Failed to generate embedding for chunk",
          );
          results.push({ ...chunk, embedding: null });
        }
      } else {
        results.push({ ...chunk, embedding: null });
      }
    }

    return results;
  }

  /**
   * 保存切片到数据库
   */
  private async saveChunks(
    bookmarkId: number,
    chunks: (Chunk & { embedding: number[] | null })[],
  ): Promise<void> {
    // 先创建 parent 切片（获取 ID）
    const parentChunks = chunks.filter((c) => c.type === "parent");
    const childChunks = chunks.filter((c) => c.type === "child");

    // 插入 parent 切片
    const parentIdMap = new Map<number, string>(); // index -> id

    for (const parent of parentChunks) {
      const { data, error } = await (
        this.supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .from("bookmark_chunks") as any
      )
        .insert({
          bookmark_id: bookmarkId,
          chunk_index: parent.index,
          content: parent.content,
          content_hash: parent.contentHash,
          chunk_type: "parent",
          token_count: parent.tokenCount,
          start_offset: parent.startOffset,
          end_offset: parent.endOffset,
          embedding: parent.embedding,
          embedding_version: parent.embedding ? "v3" : null,
        })
        .select("id")
        .single();

      if (error) {
        logger.error(
          { error, bookmarkId, chunkIndex: parent.index },
          "ChunkMigration: Failed to insert parent chunk",
        );
        throw error;
      }

      parentIdMap.set(parent.index, data.id);
    }

    // 插入 child 切片（带 parent_chunk_id）
    if (childChunks.length > 0) {
      const childRecords = childChunks.map((child) => ({
        bookmark_id: bookmarkId,
        chunk_index: child.index,
        content: child.content,
        content_hash: child.contentHash,
        chunk_type: "child" as const,
        token_count: child.tokenCount,
        start_offset: child.startOffset,
        end_offset: child.endOffset,
        embedding: child.embedding,
        embedding_version: child.embedding ? "v3" : null,
        parent_chunk_id:
          child.parentIndex !== undefined
            ? (parentIdMap.get(child.parentIndex) ?? null)
            : null,
      }));

      const { error } = await (
        this.supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .from("bookmark_chunks") as any
      ).insert(childRecords);

      if (error) {
        logger.error(
          { error, bookmarkId },
          "ChunkMigration: Failed to insert child chunks",
        );
        throw error;
      }
    }
  }

  /**
   * 删除书签的所有切片（用于重新迁移）
   */
  async deleteBookmarkChunks(bookmarkId: number): Promise<void> {
    const { error } = await this.supabase
      .from("bookmark_chunks")
      .delete()
      .eq("bookmark_id", bookmarkId);

    if (error) {
      logger.error(
        { error, bookmarkId },
        "ChunkMigration: Failed to delete chunks",
      );
      throw error;
    }
  }

  /**
   * 获取切片统计信息
   */
  async getChunkStats(): Promise<{
    totalChunks: number;
    parentChunks: number;
    childChunks: number;
    bookmarksWithChunks: number;
    avgChunksPerBookmark: number;
  }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase.rpc as any)("get_chunk_stats");

    if (error) {
      logger.error({ error }, "ChunkMigration: Failed to get chunk stats");
      return {
        totalChunks: 0,
        parentChunks: 0,
        childChunks: 0,
        bookmarksWithChunks: 0,
        avgChunksPerBookmark: 0,
      };
    }

    const stats = data?.[0] ?? data;

    return {
      totalChunks: stats?.total_chunks ?? 0,
      parentChunks: stats?.parent_chunks ?? 0,
      childChunks: stats?.child_chunks ?? 0,
      bookmarksWithChunks: stats?.bookmarks_with_chunks ?? 0,
      avgChunksPerBookmark: stats?.avg_chunks_per_bookmark ?? 0,
    };
  }
}

/**
 * 创建迁移服务实例
 */
export function createChunkMigrationService(
  supabase: SupabaseClient<Database>,
  options?: MigrationOptions,
): ChunkMigrationService {
  return new ChunkMigrationService(supabase, options);
}
