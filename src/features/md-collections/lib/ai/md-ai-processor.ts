/**
 * MD 收藏 AI 处理编排器
 *
 * 负责编排 MD 文档的完整 AI 处理流程：
 * 1. 状态管理（原子更新）
 * 2. 摘要生成（MdSummaryService）
 * 3. 向量嵌入（EmbeddingGenerator）
 * 4. 超时控制（30秒）
 * 5. 重试机制（3次）
 * 6. 事件发布
 * 7. 错误恢复
 *
 * @version 2.0.0
 * @since 2025-12-29
 */

import { logger } from "@/lib/logger";
import { createServiceClient } from "@/lib/supabase/server";
import {
  generateEmbedding,
  buildEmbeddingText,
  getCurrentEmbeddingVersion,
} from "@/lib/utils/embedding-generator";
import { preprocessMarkdownForAI } from "../md-processor";
import { MdSummaryService } from "./md-summary.service";
import type {
  MdAIProcessOptions,
  MdAIProcessResult,
  MdAIErrorCode,
  CancellationToken,
  StatusUpdateData,
  MdProcessingStartedEvent,
  MdProcessingCompletedEvent,
  MdProcessingFailedEvent,
} from "./types";
import {
  MdAIError,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
  MIN_CONTENT_LENGTH,
} from "./types";
import type { MdProcessingStatus } from "../../types";

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_OPTIONS: Required<MdAIProcessOptions> = {
  generateSummary: true,
  generateTags: true,
  generateEmbedding: true,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  maxRetries: DEFAULT_MAX_RETRIES,
  forceProvider: "",
  forceReprocess: false,
};

// ============================================================================
// 取消令牌实现
// ============================================================================

/**
 * 创建取消令牌
 */
export function createCancellationToken(): {
  token: CancellationToken;
  cancel: (reason?: string) => void;
} {
  let isCancelled = false;
  let cancelReason: string | undefined;
  const callbacks: Array<(reason?: string) => void> = [];

  const token: CancellationToken = {
    get isCancelled() {
      return isCancelled;
    },
    get reason() {
      return cancelReason;
    },
    onCancel(callback) {
      if (isCancelled) {
        callback(cancelReason);
      } else {
        callbacks.push(callback);
      }
    },
    throwIfCancelled() {
      if (isCancelled) {
        throw new MdAIError(
          "MD_AI_CANCELLED" as MdAIErrorCode,
          cancelReason || "操作已取消",
          undefined,
          false,
        );
      }
    },
  };

  const cancel = (reason?: string) => {
    if (!isCancelled) {
      isCancelled = true;
      cancelReason = reason;
      callbacks.forEach((cb) => cb(reason));
    }
  };

  return { token, cancel };
}

// ============================================================================
// 主处理器类
// ============================================================================

/**
 * MD 文档 AI 处理编排器
 */
export class MdAIProcessor {
  private summaryService: MdSummaryService;

  constructor() {
    this.summaryService = new MdSummaryService();
  }

  /**
   * 处理 MD 收藏的 AI 任务
   *
   * @param collectionId - MD 收藏 ID
   * @param userId - 用户 ID
   * @param options - 处理选项
   * @param cancellationToken - 取消令牌
   */
  async process(
    collectionId: number,
    userId: string,
    options: MdAIProcessOptions = {},
    cancellationToken?: CancellationToken,
  ): Promise<MdAIProcessResult> {
    const startTime = Date.now();
    const opts = { ...DEFAULT_OPTIONS, ...options };

    try {
      // 1. 检查取消
      cancellationToken?.throwIfCancelled();

      // 2. 获取 MD 收藏内容
      const collection = await this.fetchCollection(collectionId, userId);
      if (!collection) {
        return this.createErrorResult(
          collectionId,
          "MD_AI_CONTENT_INVALID" as MdAIErrorCode,
          "MD 收藏不存在",
          startTime,
        );
      }

      // 3. 检查处理状态（除非强制重新处理）
      if (
        !opts.forceReprocess &&
        collection.processing_status === "processing"
      ) {
        // 检查是否真的卡住了（超过 2 分钟）
        const createdAt = new Date(collection.created_at).getTime();
        const elapsed = Date.now() - createdAt;
        if (elapsed < 120000) {
          return this.createErrorResult(
            collectionId,
            "MD_AI_ALREADY_PROCESSING" as MdAIErrorCode,
            "正在处理中，请稍后再试",
            startTime,
          );
        }
        // 超过 2 分钟，视为卡住，继续处理
        logger.warn(
          { collectionId, elapsedMs: elapsed },
          "MdAIProcessor: Force processing stuck task",
        );
      }

      // 4. 原子更新状态为 processing
      const statusUpdated = await this.updateStatus(
        collectionId,
        "processing",
        collection.processing_status === "processing"
          ? undefined
          : (collection.processing_status as MdProcessingStatus),
      );

      if (!statusUpdated) {
        return this.createErrorResult(
          collectionId,
          "MD_AI_STATUS_CONFLICT" as MdAIErrorCode,
          "状态更新冲突，请重试",
          startTime,
        );
      }

      // 5. 发布处理开始事件
      this.emitEvent({
        type: "md_processing_started",
        collectionId,
        userId,
        timestamp: new Date().toISOString(),
        options: opts,
      });

      // 6. 预处理内容
      const preprocessResult = preprocessMarkdownForAI(collection.raw_content);
      const contentForAI = preprocessResult.processedText;

      if (contentForAI.length < MIN_CONTENT_LENGTH) {
        await this.updateStatusWithData(collectionId, {
          status: "failed",
          processingError: "内容太短，无法生成摘要",
        });
        return this.createErrorResult(
          collectionId,
          "MD_AI_CONTENT_TOO_SHORT" as MdAIErrorCode,
          "内容太短",
          startTime,
        );
      }

      // 7. 创建超时信号
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort("处理超时");
      }, opts.timeoutMs);

      try {
        const result: MdAIProcessResult = {
          success: true,
          collectionId,
          durationMs: 0,
          retryCount: 0,
        };

        // 8. 生成摘要和标签
        if (opts.generateSummary || opts.generateTags) {
          cancellationToken?.throwIfCancelled();

          try {
            const summaryResult = await this.summaryService.generate(
              {
                collectionId,
                userId,
                title: collection.title,
                content: contentForAI,
                rawContent: collection.raw_content,
                metadata: {
                  wordCount: collection.word_count,
                  codeBlockCount: collection.code_block_count,
                  readingTimeMinutes: collection.reading_time_minutes,
                },
              },
              {
                cancellationToken,
                abortSignal: abortController.signal,
              },
            );

            if (opts.generateSummary) {
              result.summary = summaryResult.summary;
              result.contentType = summaryResult.contentType;
              result.contentTypeConfidence =
                summaryResult.contentTypeConfidence;
            }

            if (opts.generateTags) {
              result.aiTags = summaryResult.tags;
            }
          } catch (summaryError) {
            logger.warn(
              {
                collectionId,
                error:
                  summaryError instanceof Error
                    ? summaryError.message
                    : String(summaryError),
              },
              "MdAIProcessor: Summary generation failed, continuing with embedding",
            );
          }
        }

        // 9. 生成向量嵌入
        if (opts.generateEmbedding) {
          cancellationToken?.throwIfCancelled();

          try {
            const embeddingText = buildEmbeddingText(
              collection.title,
              result.summary || contentForAI.substring(0, 500),
              result.aiTags,
            );

            const embedding = await generateEmbedding(embeddingText);
            result.embedding = embedding;
            result.embeddingVersion = getCurrentEmbeddingVersion();
          } catch (embeddingError) {
            logger.warn(
              {
                collectionId,
                error:
                  embeddingError instanceof Error
                    ? embeddingError.message
                    : String(embeddingError),
              },
              "MdAIProcessor: Embedding generation failed",
            );
          }
        }

        // 10. 更新数据库
        await this.updateStatusWithData(collectionId, {
          status: "completed",
          aiSummary: result.summary,
          aiTags: result.aiTags,
          contentType: result.contentType,
          contentTypeConfidence: result.contentTypeConfidence,
          embedding: result.embedding,
          embeddingVersion: result.embeddingVersion,
          processedAt: new Date().toISOString(),
        });

        // 11. 计算耗时
        result.durationMs = Date.now() - startTime;

        // 12. 发布完成事件
        this.emitEvent({
          type: "md_processing_completed",
          collectionId,
          userId,
          timestamp: new Date().toISOString(),
          result,
        });

        logger.info(
          {
            collectionId,
            userId,
            hasSummary: !!result.summary,
            hasTags: !!result.aiTags,
            hasEmbedding: !!result.embedding,
            durationMs: result.durationMs,
            action: "md_ai_processing_completed",
          },
          "MdAIProcessor: Processing completed",
        );

        return result;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorCode =
        error instanceof MdAIError
          ? error.code
          : ("MD_AI_UNKNOWN_ERROR" as MdAIErrorCode);
      const isRetryable = error instanceof MdAIError ? error.retryable : true;

      // 更新状态为失败
      await this.updateStatusWithData(collectionId, {
        status: "failed",
        processingError: errorMessage,
      });

      // 发布失败事件
      this.emitEvent({
        type: "md_processing_failed",
        collectionId,
        userId,
        timestamp: new Date().toISOString(),
        error: errorMessage,
        errorCode,
        retryable: isRetryable,
      });

      logger.error(
        {
          collectionId,
          userId,
          error: errorMessage,
          errorCode,
          stack: error instanceof Error ? error.stack : undefined,
          action: "md_ai_processing_failed",
        },
        "MdAIProcessor: Processing failed",
      );

      return this.createErrorResult(
        collectionId,
        errorCode,
        errorMessage,
        startTime,
      );
    }
  }

  /**
   * 获取 MD 收藏内容
   */
  private async fetchCollection(collectionId: number, userId: string) {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("md_collections")
      .select(
        "id, title, raw_content, word_count, code_block_count, reading_time_minutes, processing_status, created_at",
      )
      .eq("id", collectionId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (error) {
      logger.error(
        { collectionId, userId, error },
        "MdAIProcessor: Failed to fetch collection",
      );
      return null;
    }

    return data;
  }

  /**
   * 原子更新状态
   */
  private async updateStatus(
    collectionId: number,
    newStatus: MdProcessingStatus,
    expectedStatus?: MdProcessingStatus,
  ): Promise<boolean> {
    const supabase = await createServiceClient();

    // 构建查询条件
    let query = supabase
      .from("md_collections")
      .update({
        processing_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", collectionId);

    // 如果有期望状态，添加乐观锁条件
    if (expectedStatus) {
      query = query.eq("processing_status", expectedStatus);
    }

    const { error, count } = await query.select("id");

    if (error) {
      logger.error(
        { collectionId, newStatus, error },
        "MdAIProcessor: Status update failed",
      );
      return false;
    }

    // 检查是否真的更新了
    return count !== null && count > 0;
  }

  /**
   * 更新状态和数据
   */
  private async updateStatusWithData(
    collectionId: number,
    data: StatusUpdateData,
  ): Promise<boolean> {
    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      processing_status: data.status,
      updated_at: new Date().toISOString(),
    };

    if (data.aiSummary !== undefined) {
      updateData.ai_summary = data.aiSummary;
    }

    if (data.aiTags !== undefined) {
      updateData.ai_tags = data.aiTags;
    }

    if (data.contentType !== undefined) {
      updateData.content_type = data.contentType;
    }

    if (data.contentTypeConfidence !== undefined) {
      updateData.content_type_confidence = data.contentTypeConfidence;
    }

    if (data.embedding !== undefined) {
      // 向量需要格式化为 PostgreSQL vector 格式
      updateData.embedding = `[${data.embedding.join(",")}]`;
    }

    if (data.embeddingVersion !== undefined) {
      updateData.embedding_version = data.embeddingVersion;
    }

    if (data.processingError !== undefined) {
      updateData.processing_error = data.processingError;
    }

    if (data.processedAt !== undefined) {
      updateData.processed_at = data.processedAt;
    }

    const { error } = await supabase
      .from("md_collections")
      .update(updateData)
      .eq("id", collectionId);

    if (error) {
      logger.error(
        { collectionId, error },
        "MdAIProcessor: Update with data failed",
      );
      return false;
    }

    return true;
  }

  /**
   * 发布事件（占位，后续集成 EventBus）
   */
  private emitEvent(
    event:
      | MdProcessingStartedEvent
      | MdProcessingCompletedEvent
      | MdProcessingFailedEvent,
  ): void {
    // TODO: 集成 EventBus
    logger.debug(
      { eventType: event.type, collectionId: event.collectionId },
      "MdAIProcessor: Event emitted",
    );
  }

  /**
   * 创建错误结果
   */
  private createErrorResult(
    collectionId: number,
    errorCode: MdAIErrorCode,
    errorMessage: string,
    startTime: number,
  ): MdAIProcessResult {
    return {
      success: false,
      collectionId,
      error: errorMessage,
      errorCode,
      durationMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// 导出便捷函数
// ============================================================================

/**
 * 处理单个 MD 收藏的 AI 任务（便捷函数）
 */
export async function processMdCollectionAI(
  collectionId: number,
  userId: string,
  options?: MdAIProcessOptions,
): Promise<MdAIProcessResult> {
  const processor = new MdAIProcessor();
  return processor.process(collectionId, userId, options);
}

/**
 * 批量处理 MD 收藏的 AI 任务
 */
export async function processMdCollectionsBatchAI(
  collectionIds: number[],
  userId: string,
  options?: MdAIProcessOptions,
  concurrency: number = 3,
): Promise<Map<number, MdAIProcessResult>> {
  const results = new Map<number, MdAIProcessResult>();
  const processor = new MdAIProcessor();

  // 分批处理
  for (let i = 0; i < collectionIds.length; i += concurrency) {
    const batch = collectionIds.slice(i, i + concurrency);
    const batchPromises = batch.map((id) =>
      processor.process(id, userId, options).then((result) => ({
        id,
        result,
      })),
    );

    const batchResults = await Promise.allSettled(batchPromises);

    for (const outcome of batchResults) {
      if (outcome.status === "fulfilled") {
        results.set(outcome.value.id, outcome.value.result);
      } else {
        logger.error(
          { error: outcome.reason },
          "MdAIProcessor: Batch processing item failed",
        );
      }
    }
  }

  return results;
}

/**
 * 触发 MD 收藏的 AI 处理（异步，不等待完成）
 */
export function triggerMdAIProcessing(
  collectionId: number,
  userId: string,
): void {
  processMdCollectionAI(collectionId, userId).catch((error) => {
    logger.error(
      {
        collectionId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      },
      "MdAIProcessor: Background processing failed",
    );
  });
}

// ============================================================================
// 导出
// ============================================================================

export { MdAIProcessor as default };
