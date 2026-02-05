/**
 * Embedding Consumer
 *
 * 向量生成消费者 - 为书签内容生成向量嵌入
 *
 * @module jobs/consumers
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { BaseConsumer } from "./base-consumer";
import type { JobContext, JobResult, GenerateEmbeddingPayload } from "../types";
import { generateEmbedding } from "@/lib/embedding";

// 本地类型定义
interface BookmarkEmbeddingRow {
  id: number;
  title: string | null;
  description: string | null;
  ai_summary: string | null;
  user_tags: string[] | null;
  ai_tags: string[] | null;
}

/**
 * 向量生成消费者
 *
 * 职责：
 * - 提取书签的可嵌入文本（标题、描述、摘要等）
 * - 调用 OpenAI/DeepSeek API 生成向量
 * - 更新书签的 embedding 字段
 */
export class EmbeddingConsumer extends BaseConsumer {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, {
      name: "EmbeddingConsumer",
      jobTypes: ["GENERATE_EMBEDDING"],
      pollIntervalMs: 5000,
      batchSize: 3, // 向量生成较慢，减少并发
      concurrency: 2,
    });
  }

  protected async execute(context: JobContext): Promise<JobResult> {
    const payload = context.payload as unknown as GenerateEmbeddingPayload;
    const { bookmarkId, text: providedText } = payload;

    if (!bookmarkId) {
      return {
        success: false,
        error: "Missing bookmarkId in payload",
      };
    }

    try {
      // 获取书签内容（不含 content 列，因为表中没有该字段）
      const fetchResult = await context.supabase
        .from("bookmarks")
        .select("id, title, description, ai_summary, user_tags, ai_tags")
        .eq("id", bookmarkId)
        .single();

      const bookmark = fetchResult.data as BookmarkEmbeddingRow | null;
      const fetchError = fetchResult.error as Error | null;

      if (fetchError || !bookmark) {
        return {
          success: false,
          error: `Bookmark ${bookmarkId} not found`,
        };
      }

      // 构建嵌入文本
      const textToEmbed = providedText || this.buildEmbeddingText(bookmark);

      if (!textToEmbed || textToEmbed.trim().length < 10) {
        // 文本太短，跳过嵌入
        this.logger.warn(
          { bookmarkId },
          "Text too short for embedding, skipping",
        );
        return {
          success: true,
          data: { skipped: true, reason: "Text too short" },
        };
      }

      // 生成向量
      const embedding = await generateEmbedding(textToEmbed);

      if (!embedding || embedding.length === 0) {
        return {
          success: false,
          error: "Failed to generate embedding: empty result",
        };
      }

      // 将向量转换为 pgvector 字符串格式
      const embeddingStr = `[${embedding.join(",")}]`;

      // 更新书签
      const { error: updateError } = await context.supabase
        .from("bookmarks")
        .update({
          embedding: embeddingStr,
          status: "EMBEDDING_DONE",
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookmarkId);

      if (updateError) {
        return {
          success: false,
          error: `Failed to update bookmark: ${updateError.message}`,
        };
      }

      this.logger.info(
        {
          bookmarkId,
          textLength: textToEmbed.length,
          embeddingDim: embedding.length,
        },
        "Embedding generated",
      );

      return {
        success: true,
        data: {
          bookmarkId,
          textLength: textToEmbed.length,
          embeddingDim: embedding.length,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      // 检查是否是速率限制错误
      if (message.includes("rate limit") || message.includes("429")) {
        this.logger.warn({ bookmarkId }, "Rate limited, will retry");
      }

      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * 构建嵌入文本
   *
   * 优先级：AI 摘要 > 描述 > 标题
   * 同时包含标签信息以提升语义搜索准确度
   */
  private buildEmbeddingText(bookmark: {
    title: string | null;
    description: string | null;
    ai_summary: string | null;
    user_tags: string[] | null;
    ai_tags: string[] | null;
  }): string {
    const parts: string[] = [];

    // 标题（始终包含）
    if (bookmark.title) {
      parts.push(bookmark.title);
    }

    // AI 摘要（最重要）
    if (bookmark.ai_summary) {
      parts.push(bookmark.ai_summary);
    }

    // 描述
    if (bookmark.description) {
      parts.push(bookmark.description);
    }

    // 标签（作为语义补充）
    const allTags = [
      ...(bookmark.user_tags || []),
      ...(bookmark.ai_tags || []),
    ];
    if (allTags.length > 0) {
      parts.push(`标签: ${allTags.join(", ")}`);
    }

    return parts.join("\n\n");
  }
}
