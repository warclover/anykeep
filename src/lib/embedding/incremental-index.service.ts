/**
 * 增量向量索引服务
 *
 * 处理书签向量的增量更新，从队列中获取任务并批量处理
 *
 * @module lib/embedding/incremental-index.service
 * @version 1.0.0
 * @since 2026-01-02
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { logger } from "@/lib/logger";
import { createMultiVectorEmbeddingService } from "./multi-vector-embedding.service";
import { generateEmbedding } from "@/lib/utils/embedding-generator";

/**
 * 队列任务类型
 */
interface EmbeddingTask {
  id: number;
  bookmark_id: number;
  user_id: string;
  update_type: "title" | "tags" | "content" | "full";
  priority: number;
  created_at: string;
  retry_count: number;
}

/**
 * 队列统计信息
 */
interface QueueStats {
  pending_count: number;
  processed_24h: number;
  failed_count: number;
  pending_title: number;
  pending_tags: number;
  pending_content: number;
  pending_full: number;
  oldest_pending: string | null;
  avg_processing_time_seconds: number | null;
}

/**
 * 处理结果
 */
interface ProcessResult {
  success: boolean;
  processed: number;
  failed: number;
  errors: Array<{ taskId: number; error: string }>;
  durationMs: number;
}

/**
 * 增量向量索引服务
 */
export class IncrementalIndexService {
  private supabase: SupabaseClient<Database>;
  private batchSize: number;

  constructor(supabase: SupabaseClient<Database>, batchSize = 20) {
    this.supabase = supabase;
    this.batchSize = batchSize;
  }

  /**
   * 获取队列统计信息
   */
  async getQueueStats(): Promise<QueueStats | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from("embedding_queue_stats")
      .select("*")
      .single();

    if (error) {
      logger.error(
        { error },
        "IncrementalIndexService: Failed to get queue stats",
      );
      return null;
    }

    return data as QueueStats;
  }

  /**
   * 获取待处理任务
   */
  async getPendingTasks(limit?: number): Promise<EmbeddingTask[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase.rpc as any)(
      "get_pending_embedding_tasks",
      {
        p_limit: limit ?? this.batchSize,
        p_lock_for_update: true,
      },
    );

    if (error) {
      logger.error(
        { error },
        "IncrementalIndexService: Failed to get pending tasks",
      );
      return [];
    }

    return (data ?? []) as EmbeddingTask[];
  }

  /**
   * 处理队列中的任务
   */
  async processQueue(): Promise<ProcessResult> {
    const startTime = Date.now();
    const result: ProcessResult = {
      success: true,
      processed: 0,
      failed: 0,
      errors: [],
      durationMs: 0,
    };

    try {
      // 获取待处理任务
      const tasks = await this.getPendingTasks();

      if (tasks.length === 0) {
        logger.info("IncrementalIndexService: No pending tasks");
        result.durationMs = Date.now() - startTime;
        return result;
      }

      logger.info(
        { taskCount: tasks.length },
        "IncrementalIndexService: Processing queue",
      );

      // 按书签分组任务（同一书签可能有多个更新类型）
      const tasksByBookmark = new Map<number, EmbeddingTask[]>();
      for (const task of tasks) {
        const existing = tasksByBookmark.get(task.bookmark_id) ?? [];
        existing.push(task);
        tasksByBookmark.set(task.bookmark_id, existing);
      }

      // 批量处理
      const completedTaskIds: number[] = [];

      for (const [bookmarkId, bookmarkTasks] of tasksByBookmark) {
        try {
          await this.processBookmarkTasks(bookmarkId, bookmarkTasks);
          completedTaskIds.push(...bookmarkTasks.map((t) => t.id));
          result.processed += bookmarkTasks.length;
        } catch (error) {
          result.failed += bookmarkTasks.length;
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          for (const task of bookmarkTasks) {
            result.errors.push({ taskId: task.id, error: errorMessage });
            await this.markTaskFailed(task.id, errorMessage);
          }

          logger.error(
            { bookmarkId, error: errorMessage },
            "IncrementalIndexService: Failed to process bookmark",
          );
        }
      }

      // 标记已完成的任务
      if (completedTaskIds.length > 0) {
        await this.markTasksCompleted(completedTaskIds);
      }

      result.durationMs = Date.now() - startTime;

      logger.info(
        {
          processed: result.processed,
          failed: result.failed,
          durationMs: result.durationMs,
        },
        "IncrementalIndexService: Queue processing complete",
      );

      return result;
    } catch (error) {
      result.success = false;
      result.durationMs = Date.now() - startTime;

      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "IncrementalIndexService: Queue processing failed",
      );

      return result;
    }
  }

  /**
   * 处理单个书签的所有任务
   */
  private async processBookmarkTasks(
    bookmarkId: number,
    tasks: EmbeddingTask[],
  ): Promise<void> {
    // 确定需要更新哪些向量
    const updateTypes = new Set(tasks.map((t) => t.update_type));

    // 创建多向量服务实例
    const multiVectorService = createMultiVectorEmbeddingService(this.supabase);

    // 如果有 'full' 类型，则更新所有向量
    if (updateTypes.has("full")) {
      await this.updateAllVectors(bookmarkId, multiVectorService);
      return;
    }

    // 否则按类型分别更新，需要先获取书签数据
    const needsBookmark = updateTypes.has("title") || updateTypes.has("tags");
    let bookmark: {
      title: string | null;
      ai_tags: string[] | null;
      user_tags: string[] | null;
    } | null = null;

    if (needsBookmark) {
      const { data, error } = await this.supabase
        .from("bookmarks")
        .select("title, ai_tags, user_tags")
        .eq("id", bookmarkId)
        .single();

      if (error || !data) {
        throw new Error(
          `Bookmark ${bookmarkId} not found for embedding update`,
        );
      }
      bookmark = data;
    }

    if (updateTypes.has("title") && bookmark) {
      await multiVectorService.updateTitleEmbeddingOnly(
        bookmarkId,
        bookmark.title ?? "",
      );
    }

    if (updateTypes.has("tags") && bookmark) {
      await multiVectorService.updateTagEmbeddingOnly(
        bookmarkId,
        bookmark.ai_tags,
        bookmark.user_tags,
      );
    }

    if (updateTypes.has("content")) {
      await this.updateContentVector(bookmarkId);
    }
  }

  /**
   * 更新所有向量
   */
  private async updateAllVectors(
    bookmarkId: number,
    multiVectorService: ReturnType<typeof createMultiVectorEmbeddingService>,
  ): Promise<void> {
    // 获取书签数据
    const { data: bookmark, error } = await this.supabase
      .from("bookmarks")
      .select("id, title, ai_summary, description, user_tags, ai_tags")
      .eq("id", bookmarkId)
      .single();

    if (error || !bookmark) {
      throw new Error(`Bookmark ${bookmarkId} not found`);
    }

    // 生成所有向量
    const vectors = await multiVectorService.generateAllVectors({
      bookmarkId: bookmark.id,
      title: bookmark.title ?? "",
      summary: bookmark.ai_summary ?? bookmark.description ?? "",
      aiTags: bookmark.ai_tags ?? [],
      userTags: bookmark.user_tags ?? [],
    });

    // 更新数据库
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this.supabase.from("bookmarks").update as any)({
      title_embedding: vectors.titleEmbedding,
      embedding: vectors.contentEmbedding,
      tag_embedding: vectors.tagEmbedding,
      embedding_version: "v3",
      title_embedding_at: vectors.titleEmbedding
        ? new Date().toISOString()
        : null,
      tag_embedding_at: vectors.tagEmbedding ? new Date().toISOString() : null,
    }).eq("id", bookmarkId);
  }

  /**
   * 更新内容向量
   */
  private async updateContentVector(bookmarkId: number): Promise<void> {
    // 获取书签数据
    const { data: bookmark, error } = await this.supabase
      .from("bookmarks")
      .select("id, title, ai_summary, description")
      .eq("id", bookmarkId)
      .single();

    if (error || !bookmark) {
      throw new Error(`Bookmark ${bookmarkId} not found`);
    }

    // 生成内容向量（主 embedding 字段）
    const contentText = [
      bookmark.title,
      bookmark.ai_summary,
      bookmark.description,
    ]
      .filter(Boolean)
      .join(" ");

    if (contentText.trim()) {
      const embedding = await generateEmbedding(contentText);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.supabase.from("bookmarks").update as any)({
        embedding,
        embedding_version: "v3",
      }).eq("id", bookmarkId);
    }
  }

  /**
   * 标记任务完成
   */
  private async markTasksCompleted(taskIds: number[]): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.supabase.rpc as any)(
      "mark_embedding_task_completed",
      {
        p_task_ids: taskIds,
      },
    );

    if (error) {
      logger.error(
        { error, taskIds },
        "IncrementalIndexService: Failed to mark tasks completed",
      );
    }
  }

  /**
   * 标记任务失败
   */
  private async markTaskFailed(
    taskId: number,
    errorMessage: string,
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.supabase.rpc as any)(
      "mark_embedding_task_failed",
      {
        p_task_id: taskId,
        p_error_message: errorMessage.substring(0, 1000), // 限制长度
      },
    );

    if (error) {
      logger.error(
        { error, taskId },
        "IncrementalIndexService: Failed to mark task as failed",
      );
    }
  }

  /**
   * 手动将书签加入更新队列
   */
  async enqueueBookmark(
    bookmarkId: number,
    userId: string,
    updateType: "title" | "tags" | "content" | "full" = "full",
    priority = 5,
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.supabase.rpc as any)(
      "queue_embedding_update",
      {
        p_bookmark_id: bookmarkId,
        p_user_id: userId,
        p_update_type: updateType,
        p_priority: priority,
      },
    );

    if (error) {
      logger.error(
        { error, bookmarkId, updateType },
        "IncrementalIndexService: Failed to enqueue bookmark",
      );
      throw error;
    }
  }

  /**
   * 清理已处理的旧任务（保留最近 7 天）
   */
  async cleanupOldTasks(): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase as any)
      .from("bookmark_embedding_queue")
      .delete()
      .lt(
        "processed_at",
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      )
      .select("id");

    if (error) {
      logger.error(
        { error },
        "IncrementalIndexService: Failed to cleanup old tasks",
      );
      return 0;
    }

    const count = data?.length ?? 0;
    if (count > 0) {
      logger.info({ count }, "IncrementalIndexService: Cleaned up old tasks");
    }

    return count;
  }
}

// 单例工厂
let serviceInstance: IncrementalIndexService | null = null;

export function getIncrementalIndexService(
  supabase: SupabaseClient<Database>,
): IncrementalIndexService {
  if (!serviceInstance) {
    serviceInstance = new IncrementalIndexService(supabase);
  }
  return serviceInstance;
}

export function resetIncrementalIndexService(): void {
  serviceInstance = null;
}
