/**
 * MD 收藏功能 - AI 处理适配器
 * P2-007: Markdown 内容收藏
 *
 * 复用现有的 SummaryService 和 EmbeddingGenerator
 * 实现 MD 内容的 AI 摘要和向量嵌入生成
 */

import { logger } from "@/lib/logger";
import { createServiceClient } from "@/lib/supabase/server";
import { SummaryService } from "@/lib/summary/services/summary.service";
import {
  generateEmbedding,
  buildEmbeddingText,
  getCurrentEmbeddingVersion,
} from "@/lib/utils/embedding-generator";
import { preprocessMarkdownForAI } from "./md-processor";

/**
 * AI 处理结果
 */
export interface MdAIProcessResult {
  success: boolean;
  summary?: string;
  aiTags?: string[];
  embedding?: number[];
  embeddingVersion?: string;
  error?: string;
}

/**
 * AI 处理选项
 */
export interface MdAIProcessOptions {
  /** 是否生成摘要 */
  generateSummary?: boolean;
  /** 是否生成标签 */
  generateTags?: boolean;
  /** 是否生成向量嵌入 */
  generateEmbedding?: boolean;
}

const DEFAULT_OPTIONS: MdAIProcessOptions = {
  generateSummary: true,
  generateTags: true,
  generateEmbedding: true,
};

/**
 * 处理单个 MD 收藏的 AI 任务
 *
 * @param collectionId - MD 收藏 ID
 * @param userId - 用户 ID
 * @param options - 处理选项
 */
export async function processMdCollectionAI(
  collectionId: number,
  userId: string,
  options: MdAIProcessOptions = DEFAULT_OPTIONS,
): Promise<MdAIProcessResult> {
  const startTime = Date.now();

  // 本地类型定义
  interface MdCollectionRow {
    id: number;
    title: string | null;
    raw_content: string | null;
    processing_status: string | null;
  }

  try {
    // 1. 获取 MD 收藏内容
    const supabase = await createServiceClient();
    const { data: collection, error: fetchError } = (await (
      supabase.from("md_collections") as any
    ) // eslint-disable-line @typescript-eslint/no-explicit-any
      .select("id, title, raw_content, processing_status")
      .eq("id", collectionId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single()) as { data: MdCollectionRow | null; error: Error | null };

    if (fetchError || !collection) {
      logger.error(
        { collectionId, userId, error: fetchError },
        "MdAIProcessor: Failed to fetch collection",
      );
      return { success: false, error: "MD 收藏不存在" };
    }

    // 2. 更新处理状态为 processing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("md_collections") as any)
      .update({ processing_status: "processing" })
      .eq("id", collectionId);

    // 3. 预处理 Markdown 内容
    const preprocessResult = preprocessMarkdownForAI(
      collection.raw_content ?? "",
    );
    const contentForAI = preprocessResult.processedText;

    const result: MdAIProcessResult = { success: true };

    // 4. 生成摘要和标签（使用 SummaryService）
    if (options.generateSummary || options.generateTags) {
      try {
        const summaryService = new SummaryService();
        const summaryResult = await summaryService.generate({
          bookmarkId: collectionId, // 复用 bookmarkId 字段
          userId,
          title: collection.title ?? "",
          content: contentForAI,
          contentType: "article", // MD 收藏默认视为文章类型
        });

        if (summaryResult.summary && options.generateSummary) {
          result.summary = summaryResult.summary;
        }

        if (summaryResult.tags && options.generateTags) {
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
        // 摘要失败不影响嵌入生成
      }
    }

    // 5. 生成向量嵌入
    if (options.generateEmbedding) {
      try {
        // 构建用于嵌入的文本
        const embeddingText = buildEmbeddingText(
          collection.title ?? "",
          result.summary || contentForAI.substring(0, 500), // 优先使用摘要
          result.aiTags,
        );

        const embedding = await generateEmbedding(embeddingText);
        result.embedding = embedding;
        result.embeddingVersion = String(getCurrentEmbeddingVersion());
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
        // 嵌入失败不影响整体结果
      }
    }

    // 6. 更新数据库
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      processing_status: "completed",
      processed_at: new Date().toISOString(),
    };

    if (result.summary) {
      updateData.ai_summary = result.summary;
    }

    if (result.aiTags) {
      updateData.ai_tags = result.aiTags;
    }

    if (result.embedding) {
      // 向量需要格式化为 PostgreSQL vector 格式
      updateData.embedding = `[${result.embedding.join(",")}]`;
      updateData.embedding_version = result.embeddingVersion;
    }

    const { error: updateError } = await (
      supabase.from("md_collections") as any
    ) // eslint-disable-line @typescript-eslint/no-explicit-any
      .update(updateData)
      .eq("id", collectionId);

    if (updateError) {
      logger.error(
        { collectionId, error: updateError },
        "MdAIProcessor: Failed to update collection with AI results",
      );
      // 即使更新失败也返回处理结果
    }

    const duration = Date.now() - startTime;
    logger.info(
      {
        collectionId,
        userId,
        hasSummary: !!result.summary,
        hasTags: !!result.aiTags,
        hasEmbedding: !!result.embedding,
        durationMs: duration,
        action: "md_ai_processing_completed",
      },
      "MdAIProcessor: Processing completed",
    );

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // 更新状态为失败
    try {
      const supabase = await createServiceClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("md_collections") as any)
        .update({
          processing_status: "failed",
          processing_error: errorMessage,
        })
        .eq("id", collectionId);
    } catch {
      // 忽略状态更新失败
    }

    logger.error(
      {
        collectionId,
        userId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        action: "md_ai_processing_failed",
      },
      "MdAIProcessor: Processing failed",
    );

    return { success: false, error: errorMessage };
  }
}

/**
 * 批量处理 MD 收藏的 AI 任务
 *
 * @param collectionIds - MD 收藏 ID 数组
 * @param userId - 用户 ID
 * @param options - 处理选项
 * @param concurrency - 并发数（默认 3）
 */
export async function processMdCollectionsBatchAI(
  collectionIds: number[],
  userId: string,
  options: MdAIProcessOptions = DEFAULT_OPTIONS,
  concurrency: number = 3,
): Promise<Map<number, MdAIProcessResult>> {
  const results = new Map<number, MdAIProcessResult>();

  // 分批处理
  for (let i = 0; i < collectionIds.length; i += concurrency) {
    const batch = collectionIds.slice(i, i + concurrency);
    const batchPromises = batch.map((id) =>
      processMdCollectionAI(id, userId, options).then((result) => ({
        id,
        result,
      })),
    );

    const batchResults = await Promise.allSettled(batchPromises);

    for (const outcome of batchResults) {
      if (outcome.status === "fulfilled") {
        results.set(outcome.value.id, outcome.value.result);
      } else {
        // 如果某个处理完全失败，记录错误
        logger.error(
          { error: outcome.reason },
          "MdAIProcessor: Batch processing item failed completely",
        );
      }
    }
  }

  return results;
}

/**
 * 触发 MD 收藏的 AI 处理（异步，不等待完成）
 *
 * @param collectionId - MD 收藏 ID
 * @param userId - 用户 ID
 */
export function triggerMdAIProcessing(
  collectionId: number,
  userId: string,
): void {
  // 异步执行，不阻塞
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
