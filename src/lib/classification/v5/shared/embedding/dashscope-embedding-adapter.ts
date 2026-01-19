/**
 * DashScope Embedding 适配器
 *
 * 将项目现有的 DashScope embedding 服务适配到 v5.0 的 EmbeddingService 接口
 */

import { generateEmbedding } from "@/lib/utils/embedding-generator";
import type { LoggerService } from "../logger";
import type { EmbeddingResult } from "./types";
import { EmbeddingError } from "./types";

/**
 * DashScope Embedding 适配器类
 *
 * 实现与 EmbeddingService 相同的接口，但使用项目现有的 DashScope 服务
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
      this.logger.debug("生成 Embedding (DashScope)", {
        textLength: text.length,
      });

      // 使用项目现有的 DashScope embedding 服务
      const embedding = await generateEmbedding(text);

      // 估算 token 数量（中文约 1.5 字符/token）
      const estimatedTokens = Math.ceil(text.length / 1.5);

      return {
        embedding,
        tokens: estimatedTokens,
        model: "dashscope-v3", // 项目使用的模型
      };
    } catch (error) {
      this.logger.error("Embedding 生成失败 (DashScope)", {
        error: error instanceof Error ? error.message : String(error),
      });

      throw new EmbeddingError(
        `Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
        false, // DashScope 错误通常不可重试
      );
    }
  }
}
