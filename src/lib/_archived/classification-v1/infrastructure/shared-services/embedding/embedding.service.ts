/**
 * 智能分类 v5.0 - Embedding Service
 *
 * 使用阿里百炼 text-embedding-v4 模型生成向量
 * - 支持 64-2048 维度自定义
 * - 支持 100+ 语言
 * - 最大 128K 输入长度
 * - 兼容 OpenAI API 规范
 */

import OpenAI from "openai";
import { aiEnv } from "@/lib/env";
import type { LoggerService } from "../logger";
import type { EmbeddingConfig, EmbeddingResult } from "./types";
import { EmbeddingError } from "./types";

/**
 * Embedding Service 类
 */
export class EmbeddingService {
  private client: OpenAI;
  private config: EmbeddingConfig;
  private logger: LoggerService;

  constructor(logger: LoggerService, config?: Partial<EmbeddingConfig>) {
    this.logger = logger.child({ service: "EmbeddingService" });

    this.config = {
      apiKey: config?.apiKey ?? aiEnv.embeddingApiKey,
      model: config?.model ?? aiEnv.embeddingModel,
      dimensions: config?.dimensions ?? 1024,
      maxRetries: config?.maxRetries ?? 3,
      retryDelays: config?.retryDelays ?? [1000, 2000, 4000],
    };

    if (!this.config.apiKey) {
      throw new EmbeddingError("Embedding API Key is required");
    }

    // 使用兼容 OpenAI 格式的 API (默认阿里百炼 DashScope)
    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: aiEnv.embeddingApiBaseUrl,
    });
  }

  /**
   * 生成文本的 Embedding 向量
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    if (!text || text.trim().length === 0) {
      throw new EmbeddingError("Text cannot be empty");
    }

    // 截断过长的文本（阿里百炼 text-embedding-v4 支持最大 128K 输入长度）
    // 保守估计 1 token ≈ 2 字符，限制在 100K 字符以内
    const truncatedText = text.slice(0, 100000);

    this.logger.debug("生成 Embedding", {
      textLength: truncatedText.length,
      model: this.config.model,
    });

    return await this.executeWithRetry(async () => {
      const response = await this.client.embeddings.create({
        model: this.config.model,
        input: truncatedText,
        dimensions: this.config.dimensions,
      });

      const embedding = response.data[0].embedding;
      const tokens = response.usage.total_tokens;

      this.logger.debug("Embedding 生成成功", {
        dimensions: embedding.length,
        tokens,
      });

      return {
        embedding,
        tokens,
        model: this.config.model,
      };
    });
  }

  /**
   * 批量生成 Embedding（最多 2048 个文本）
   */
  async generateBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    if (texts.length === 0) {
      return [];
    }

    if (texts.length > 2048) {
      throw new EmbeddingError("Batch size cannot exceed 2048");
    }

    this.logger.debug("批量生成 Embedding", {
      count: texts.length,
      model: this.config.model,
    });

    return await this.executeWithRetry(async () => {
      const truncatedTexts = texts.map((text) => text.slice(0, 100000));

      const response = await this.client.embeddings.create({
        model: this.config.model,
        input: truncatedTexts,
        dimensions: this.config.dimensions,
      });

      const results = response.data.map((item: { embedding: number[] }) => ({
        embedding: item.embedding,
        tokens: response.usage.total_tokens / texts.length, // 平均分配
        model: this.config.model,
      }));

      this.logger.debug("批量 Embedding 生成成功", {
        count: results.length,
        totalTokens: response.usage.total_tokens,
      });

      return results;
    });
  }

  /**
   * 执行带重试的操作（指数退避）
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    attempt: number = 0,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const isRetryable = this.isRetryableError(error);
      const canRetry = attempt < this.config.maxRetries && isRetryable;

      if (!canRetry) {
        this.logger.error("Embedding 生成失败", error as Error, {
          attempt,
          retryable: isRetryable,
        });
        throw new EmbeddingError(
          `Failed to generate embedding: ${(error as Error).message}`,
          error as Error,
          isRetryable,
        );
      }

      const delay = this.config.retryDelays[attempt] ?? 4000;
      this.logger.warn("Embedding 生成失败，准备重试", {
        attempt: attempt + 1,
        maxRetries: this.config.maxRetries,
        delay,
      });

      await this.sleep(delay);
      return this.executeWithRetry(operation, attempt + 1);
    }
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();

    // 网络错误、超时、速率限制等可重试
    return (
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("rate limit") ||
      message.includes("429") ||
      message.includes("502") ||
      message.includes("503")
    );
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
