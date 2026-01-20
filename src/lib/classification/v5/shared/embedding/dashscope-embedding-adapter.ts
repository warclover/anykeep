/**
 * DashScope Embedding 适配器
 *
 * 将项目现有的 DashScope embedding 服务适配到 v5.0 的 EmbeddingService 接口
 *
 * @version 2.0.0
 * @since 2026-01-20
 */

import {
  generateEmbedding,
  generateEmbeddingsBatch,
  getActiveModelConfig,
} from "@/lib/utils/embedding-generator";
import type { LoggerService } from "../logger";
import type { EmbeddingResult } from "./types";
import { EmbeddingError } from "./types";

/**
 * DashScope Embedding 适配器类
 *
 * 实现与 EmbeddingService 相同的接口，但使用项目现有的百炼/DashScope 服务
 */
export class DashScopeEmbeddingAdapter {
  private logger: LoggerService;

  constructor(logger: LoggerService) {
    this.logger = logger.child({ service: "DashScopeEmbeddingAdapter" });
  }

  /**
   * 生成文本的 Embedding 向量
   *
   * @param text - 输入文本
   * @returns Embedding 结果
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    if (!text || text.trim().length === 0) {
      throw new EmbeddingError("Text cannot be empty");
    }

    try {
      const modelConfig = getActiveModelConfig();

      this.logger.debug("生成 Embedding (DashScope)", {
        textLength: text.length,
        modelId: modelConfig.id,
      });

      // 使用项目现有的百炼/DashScope embedding 服务
      const embedding = await generateEmbedding(text);

      // 估算 token 数量（中文约 1.5 字符/token）
      const estimatedTokens = Math.ceil(text.length / 1.5);

      return {
        embedding,
        tokens: estimatedTokens,
        model: modelConfig.modelName,
      };
    } catch (error) {
      const errorInstance =
        error instanceof Error ? error : new Error(String(error));
      this.logger.error("Embedding 生成失败 (DashScope)", errorInstance);

      const isRetryable = this.isRetryableError(error);

      throw new EmbeddingError(
        `Failed to generate embedding: ${errorInstance.message}`,
        errorInstance,
        isRetryable,
      );
    }
  }

  /**
   * 批量生成 Embedding（与 EmbeddingService 接口一致）
   *
   * @param texts - 文本数组（最多 2048 个）
   * @returns Embedding 结果数组
   */
  async generateBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    if (texts.length === 0) {
      return [];
    }

    if (texts.length > 2048) {
      throw new EmbeddingError("Batch size cannot exceed 2048");
    }

    try {
      const modelConfig = getActiveModelConfig();

      this.logger.debug("批量生成 Embedding (DashScope)", {
        count: texts.length,
        modelId: modelConfig.id,
      });

      // 使用项目现有的批量 embedding 服务
      const embeddings = await generateEmbeddingsBatch(texts);

      // 估算平均 token 数量
      const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
      const avgTokens = Math.ceil(totalChars / texts.length / 1.5);

      const results: EmbeddingResult[] = embeddings.map((embedding) => ({
        embedding,
        tokens: avgTokens,
        model: modelConfig.modelName,
      }));

      this.logger.debug("批量 Embedding 生成成功 (DashScope)", {
        count: results.length,
      });

      return results;
    } catch (error) {
      const errorInstance =
        error instanceof Error ? error : new Error(String(error));
      this.logger.error("批量 Embedding 生成失败 (DashScope)", errorInstance, {
        count: texts.length,
      });

      throw new EmbeddingError(
        `Failed to generate batch embeddings: ${errorInstance.message}`,
        errorInstance,
        this.isRetryableError(error),
      );
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

    return (
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("429") ||
      message.includes("502") ||
      message.includes("503") ||
      message.includes("504")
    );
  }
}
