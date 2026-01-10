/**
 * AtomicFallback - 原子执行器降级机制
 *
 * 职责：
 * - 错误分类（瞬态 vs 永久）
 * - 瞬态错误自动重试
 * - 失败时生成降级响应
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

import { logger } from "@/lib/logger";
import type { UnifiedStreamChunk } from "../output/types";

// ============================================
// 类型定义
// ============================================

/** 错误类型分类 */
export type ErrorCategory = "transient" | "permanent" | "unknown";

/** 降级配置 */
export interface AtomicFallbackConfig {
  /** 是否启用重试 */
  enableRetry: boolean;
  /** 最大重试次数 */
  maxRetries: number;
  /** 重试延迟（毫秒） */
  retryDelayMs: number;
  /** 是否启用降级响应 */
  enableFallbackResponse: boolean;
  /** 降级响应模板 */
  fallbackResponseTemplate?: string;
}

/** 降级结果 */
export interface FallbackResult {
  /** 是否成功（通过重试恢复或生成降级响应） */
  success: boolean;
  /** 降级原因 */
  reason: string;
  /** 重试次数 */
  retryCount: number;
  /** 最终错误（如果没有成功恢复） */
  finalError?: Error;
}

/** 错误分类结果 */
export interface ErrorClassification {
  category: ErrorCategory;
  isRetryable: boolean;
  reason: string;
}

// ============================================
// 常量
// ============================================

/** 默认配置 */
export const DEFAULT_ATOMIC_FALLBACK_CONFIG: AtomicFallbackConfig = {
  enableRetry: true,
  maxRetries: 2,
  retryDelayMs: 1000,
  enableFallbackResponse: true,
  fallbackResponseTemplate: undefined,
};

/** 瞬态错误关键词 */
const TRANSIENT_ERROR_PATTERNS = [
  /timeout/i,
  /network/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /socket hang up/i,
  /rate limit/i,
  /429/,
  /502/,
  /503/,
  /504/,
  /overloaded/i,
  /temporarily unavailable/i,
  /try again/i,
  /retry/i,
];

/** 永久性错误关键词 */
const PERMANENT_ERROR_PATTERNS = [
  /invalid.*key/i,
  /unauthorized/i,
  /forbidden/i,
  /not found/i,
  /invalid.*request/i,
  /bad request/i,
  /validation.*failed/i,
  /401/,
  /403/,
  /404/,
  /400/,
];

// ============================================
// 错误分类器
// ============================================

/**
 * 分类错误类型
 *
 * @param error - 错误对象或消息
 * @returns 错误分类结果
 */
export function classifyError(error: Error | string): ErrorClassification {
  const message = error instanceof Error ? error.message : error;

  // 检查是否为瞬态错误
  for (const pattern of TRANSIENT_ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return {
        category: "transient",
        isRetryable: true,
        reason: `瞬态错误: ${message.slice(0, 100)}`,
      };
    }
  }

  // 检查是否为永久性错误
  for (const pattern of PERMANENT_ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return {
        category: "permanent",
        isRetryable: false,
        reason: `永久性错误: ${message.slice(0, 100)}`,
      };
    }
  }

  // 未知错误，默认不重试
  return {
    category: "unknown",
    isRetryable: false,
    reason: `未知错误: ${message.slice(0, 100)}`,
  };
}

// ============================================
// 降级响应生成器
// ============================================

/**
 * 生成降级响应文本
 *
 * 根据原始用户输入生成一个友好的降级响应
 *
 * @param input - 用户输入
 * @param errorMessage - 错误信息
 * @param template - 自定义模板（可选）
 * @returns 降级响应文本
 */
export function generateFallbackResponse(
  input: string,
  errorMessage: string,
  template?: string,
): string {
  if (template) {
    return template
      .replace("{{input}}", input.slice(0, 50))
      .replace("{{error}}", errorMessage.slice(0, 100));
  }

  // 默认降级响应模板
  const defaultResponses = [
    "抱歉，我暂时无法处理您的请求。请稍后再试，或者尝试换一种方式描述您的需求。",
    "系统遇到了一些问题，无法完成您的请求。您可以：\n1. 稍后重试\n2. 简化您的请求\n3. 联系支持团队获取帮助",
  ];

  // 根据输入长度选择响应
  const responseIndex = input.length > 50 ? 1 : 0;
  return defaultResponses[responseIndex];
}

/**
 * 创建降级响应流块
 *
 * @param input - 用户输入
 * @param errorMessage - 错误信息
 * @param config - 降级配置
 * @returns 流块生成器
 */
export async function* generateFallbackChunks(
  input: string,
  errorMessage: string,
  config: AtomicFallbackConfig,
): AsyncGenerator<UnifiedStreamChunk> {
  const fallbackText = generateFallbackResponse(
    input,
    errorMessage,
    config.fallbackResponseTemplate,
  );

  // 发送降级通知块
  yield {
    type: "fallback" as const,
    data: {
      reason: `AI 服务暂时不可用: ${errorMessage.slice(0, 50)}`,
      originalMode: "atomic",
      fallbackMode: "static",
    },
  };

  // 发送降级文本响应
  yield {
    type: "text" as const,
    data: {
      text: fallbackText,
      isPartial: false,
    },
  };

  // 发送完成块
  yield {
    type: "done" as const,
    data: {
      success: false,
      summary: "fallback_response",
    },
  };
}

// ============================================
// AtomicFallbackHandler 类
// ============================================

/**
 * 原子执行器降级处理器
 *
 * 封装重试逻辑和降级响应生成
 */
export class AtomicFallbackHandler {
  private config: AtomicFallbackConfig;

  constructor(config: Partial<AtomicFallbackConfig> = {}) {
    this.config = {
      ...DEFAULT_ATOMIC_FALLBACK_CONFIG,
      ...config,
    };
  }

  /**
   * 带重试的执行
   *
   * @param executor - 执行函数
   * @param input - 用户输入
   * @param context - 上下文对象
   * @returns 执行结果生成器
   */
  async *executeWithRetry<TContext>(
    executor: (
      input: string,
      context: TContext,
    ) => AsyncGenerator<UnifiedStreamChunk>,
    input: string,
    context: TContext,
  ): AsyncGenerator<UnifiedStreamChunk> {
    let lastError: Error | null = null;
    let retryCount = 0;

    // 尝试执行（包括重试）
    while (retryCount <= this.config.maxRetries) {
      try {
        // 执行并收集所有块
        const chunks: UnifiedStreamChunk[] = [];
        let hasError = false;

        for await (const chunk of executor(input, context)) {
          // 检查是否为错误块
          if (chunk.type === "error") {
            hasError = true;
            lastError = new Error(chunk.data.message);

            // 分类错误
            const classification = classifyError(chunk.data.message);

            // 如果不可重试，直接跳出
            if (!classification.isRetryable) {
              logger.warn(
                {
                  error: chunk.data.message,
                  category: classification.category,
                  retryCount,
                },
                "AtomicFallback: Permanent error, not retrying",
              );
              break;
            }

            // 如果还有重试次数，等待后重试
            if (
              this.config.enableRetry &&
              retryCount < this.config.maxRetries
            ) {
              logger.info(
                {
                  error: chunk.data.message,
                  retryCount: retryCount + 1,
                  maxRetries: this.config.maxRetries,
                },
                "AtomicFallback: Transient error, will retry",
              );
              retryCount++;
              await this.delay(this.config.retryDelayMs * retryCount);
              break; // 跳出内层循环，重新执行
            }
          }

          chunks.push(chunk);
        }

        // 如果没有错误，输出所有块并返回
        if (!hasError) {
          for (const chunk of chunks) {
            yield chunk;
          }
          return;
        }

        // 如果有错误但不可重试，退出重试循环
        if (lastError) {
          const classification = classifyError(lastError.message);
          if (!classification.isRetryable) {
            break;
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const classification = classifyError(lastError.message);

        logger.error(
          {
            error: lastError.message,
            category: classification.category,
            retryCount,
          },
          "AtomicFallback: Execution threw error",
        );

        // 如果不可重试，跳出
        if (!classification.isRetryable) {
          break;
        }

        // 如果还有重试次数，等待后重试
        if (this.config.enableRetry && retryCount < this.config.maxRetries) {
          retryCount++;
          await this.delay(this.config.retryDelayMs * retryCount);
          continue;
        }

        break;
      }
    }

    // 所有重试都失败了，生成降级响应
    if (this.config.enableFallbackResponse && lastError) {
      logger.warn(
        {
          error: lastError.message,
          retryCount,
        },
        "AtomicFallback: All retries failed, generating fallback response",
      );

      yield* generateFallbackChunks(input, lastError.message, this.config);
    } else if (lastError) {
      // 不启用降级响应，返回错误块
      yield {
        type: "error" as const,
        data: {
          message: lastError.message,
          code: "ATOMIC_EXECUTION_FAILED",
          retryable: false,
        },
      };
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AtomicFallbackConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * 获取当前配置
   */
  getConfig(): AtomicFallbackConfig {
    return { ...this.config };
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建原子降级处理器
 */
export function createAtomicFallbackHandler(
  config?: Partial<AtomicFallbackConfig>,
): AtomicFallbackHandler {
  return new AtomicFallbackHandler(config);
}
