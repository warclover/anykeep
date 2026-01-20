/**
 * 智能分类 v5.1 - Embedding 生成安全封装器
 *
 * 提供超时控制、错误处理和降级策略
 *
 * @module classification/v5/folder-profiler/safe-embedding-wrapper
 * @version 1.0.0
 * @since 2026-01-20
 */

import type { EmbeddingService } from "../shared/embedding";
import type { LoggerService } from "../shared/logger";

/**
 * SafeEmbeddingWrapper 配置
 */
export interface SafeEmbeddingConfig {
  /** 超时时间（毫秒），默认 5000 */
  timeoutMs: number;
  /** 向量维度，默认 1024 */
  dimension: number;
  /** 最大重试次数，默认 1 */
  maxRetries: number;
  /** 重试延迟（毫秒），默认 500 */
  retryDelayMs: number;
}

/**
 * 生成结果
 */
export interface SafeEmbeddingResult {
  /** 向量嵌入 */
  embedding: number[];
  /** 是否为降级结果（零向量） */
  isFallback: boolean;
  /** 处理延迟（毫秒） */
  latencyMs: number;
  /** 重试次数 */
  retryCount: number;
}

/**
 * 错误分类
 */
type ErrorType = "transient" | "validation" | "timeout" | "unknown";

/**
 * Embedding 生成安全封装器
 *
 * 为所有 embedding 生成调用提供统一的：
 * - 超时控制
 * - 错误捕获与降级
 * - 重试机制（仅瞬态错误）
 * - 结构化日志
 */
export class SafeEmbeddingWrapper {
  private logger: LoggerService;
  private embeddingService: EmbeddingService;
  private config: SafeEmbeddingConfig;

  constructor(
    logger: LoggerService,
    embeddingService: EmbeddingService,
    config?: Partial<SafeEmbeddingConfig>,
  ) {
    this.logger = logger.child({ service: "SafeEmbeddingWrapper" });
    this.embeddingService = embeddingService;
    this.config = {
      timeoutMs: config?.timeoutMs ?? 5000,
      dimension: config?.dimension ?? 1024,
      maxRetries: config?.maxRetries ?? 1,
      retryDelayMs: config?.retryDelayMs ?? 500,
    };
  }

  /**
   * 安全生成 embedding
   *
   * @param text - 输入文本
   * @param context - 调用上下文（用于日志）
   * @returns 生成结果，失败时返回零向量
   *
   * @example
   * const result = await wrapper.generate("教程笔记", { stage: "StageA" });
   * if (result.isFallback) {
   *   logger.warn("使用降级向量");
   * }
   */
  async generate(
    text: string,
    context?: Record<string, unknown>,
  ): Promise<SafeEmbeddingResult> {
    const startTime = Date.now();

    // 边缘情况：空文本
    if (!text || text.trim().length === 0) {
      this.logger.debug("空文本，返回零向量", { context });
      return {
        embedding: this.createZeroVector(),
        isFallback: true,
        latencyMs: Date.now() - startTime,
        retryCount: 0,
      };
    }

    let lastError: Error | undefined;
    let retryCount = 0;

    // 重试循环
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await Promise.race([
          this.embeddingService.generateEmbedding(text),
          this.createTimeout(),
        ]);

        // 成功：记录并返回
        const latencyMs = Date.now() - startTime;
        this.logger.debug("Embedding 生成成功", {
          textLength: text.length,
          latencyMs,
          retryCount,
          context,
        });

        return {
          embedding: result.embedding,
          isFallback: false,
          latencyMs,
          retryCount,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorType = this.classifyError(lastError);

        // 仅瞬态错误可重试
        if (errorType === "transient" && attempt < this.config.maxRetries) {
          retryCount++;
          this.logger.debug("Embedding 生成失败，准备重试", {
            attempt: attempt + 1,
            maxRetries: this.config.maxRetries,
            errorType,
            error: lastError.message,
            context,
          });
          await this.delay(this.config.retryDelayMs);
          continue;
        }

        // 不可重试或已达重试上限
        break;
      }
    }

    // 所有尝试失败：降级为零向量
    const latencyMs = Date.now() - startTime;
    this.logger.warn("Embedding 生成失败，降级为零向量", {
      error: {
        name: lastError?.name ?? "UnknownError",
        message: lastError?.message ?? "Unknown error",
      },
      textLength: text.length,
      latencyMs,
      retryCount,
      context,
    });

    return {
      embedding: this.createZeroVector(),
      isFallback: true,
      latencyMs,
      retryCount,
    };
  }

  /**
   * 批量安全生成 embedding
   *
   * @param texts - 输入文本数组
   * @param context - 调用上下文
   * @returns 生成结果数组
   */
  async generateBatch(
    texts: string[],
    context?: Record<string, unknown>,
  ): Promise<SafeEmbeddingResult[]> {
    return Promise.all(
      texts.map((text, index) =>
        this.generate(text, { ...context, batchIndex: index }),
      ),
    );
  }

  /**
   * 创建零向量
   */
  private createZeroVector(): number[] {
    return new Array(this.config.dimension).fill(0);
  }

  /**
   * 创建超时 Promise
   */
  private createTimeout(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("Embedding generation timeout")),
        this.config.timeoutMs,
      );
    });
  }

  /**
   * 错误分类
   */
  private classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase();

    // 超时
    if (message.includes("timeout")) {
      return "timeout";
    }

    // 瞬态错误（网络、服务暂时不可用）
    if (
      message.includes("network") ||
      message.includes("econnreset") ||
      message.includes("econnrefused") ||
      message.includes("429") ||
      message.includes("502") ||
      message.includes("503") ||
      message.includes("504")
    ) {
      return "transient";
    }

    // 验证错误
    if (
      message.includes("invalid") ||
      message.includes("validation") ||
      message.includes("400")
    ) {
      return "validation";
    }

    return "unknown";
  }

  /**
   * 延迟
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 获取配置（用于测试）
   */
  getConfig(): SafeEmbeddingConfig {
    return { ...this.config };
  }
}
