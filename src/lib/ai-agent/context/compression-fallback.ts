/**
 * 压缩降级策略
 *
 * 当 LLM 压缩失败时，提供多级降级方案：
 * 1. 重试（瞬态错误）
 * 2. 简单截断（保留最近 N 轮）
 * 3. 返回原始消息（最终兜底）
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { logger } from "@/lib/logger";
import type {
  ConversationMessage,
  CompressionResult,
} from "./compression-types";
import {
  estimateMessagesTokens,
  calculateTurns,
} from "./compression-validator";

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 错误类型分类
 */
export type CompressionErrorType =
  | "transient" // 瞬态错误（网络、超时），可重试
  | "validation" // 验证错误（摘要无效），不可重试
  | "model" // 模型错误（不可用），不可重试
  | "unknown"; // 未知错误

/**
 * 降级策略级别
 */
export type FallbackLevel =
  | "full_compression" // 完整 LLM 压缩
  | "simple_truncation" // 简单截断（无摘要）
  | "original"; // 返回原始消息

/**
 * 降级结果
 */
export interface FallbackResult {
  /** 最终消息 */
  messages: ConversationMessage[];
  /** 使用的降级级别 */
  level: FallbackLevel;
  /** 是否成功压缩/截断 */
  compressed: boolean;
  /** 摘要（仅完整压缩时存在） */
  summary?: string;
  /** 性能指标 */
  metrics?: {
    originalTokens: number;
    finalTokens: number;
    compressionRatio: number;
  };
  /** 降级原因（如果发生降级） */
  fallbackReason?: string;
}

/**
 * 降级配置
 */
export interface FallbackConfig {
  /** 是否启用重试 */
  enableRetry: boolean;
  /** 最大重试次数 */
  maxRetries: number;
  /** 重试延迟（毫秒） */
  retryDelayMs: number;
  /** 简单截断时保留的轮次数 */
  truncationKeepTurns: number;
  /** 是否启用简单截断降级 */
  enableTruncationFallback: boolean;
}

/**
 * 默认降级配置
 */
export const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  enableRetry: true,
  maxRetries: 1,
  retryDelayMs: 1000,
  truncationKeepTurns: 8,
  enableTruncationFallback: true,
};

// =============================================================================
// 错误分类
// =============================================================================

/**
 * 分类压缩错误类型
 *
 * @param error 错误对象或消息
 * @returns 错误类型
 */
export function classifyCompressionError(
  error: Error | string | undefined,
): CompressionErrorType {
  if (!error) return "unknown";

  const message = typeof error === "string" ? error : error.message;
  const lowerMessage = message.toLowerCase();

  // 瞬态错误（可重试）
  if (
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("network") ||
    lowerMessage.includes("econnreset") ||
    lowerMessage.includes("econnrefused") ||
    lowerMessage.includes("socket") ||
    lowerMessage.includes("rate limit") ||
    lowerMessage.includes("429") ||
    lowerMessage.includes("503") ||
    lowerMessage.includes("502")
  ) {
    return "transient";
  }

  // 验证错误（不可重试）
  if (
    lowerMessage.includes("validation") ||
    lowerMessage.includes("过短") ||
    lowerMessage.includes("过长") ||
    lowerMessage.includes("缺少") ||
    lowerMessage.includes("为空") ||
    lowerMessage.includes("未减少")
  ) {
    return "validation";
  }

  // 模型错误（不可重试）
  if (
    lowerMessage.includes("model") ||
    lowerMessage.includes("provider") ||
    lowerMessage.includes("failed to get model") ||
    lowerMessage.includes("api key")
  ) {
    return "model";
  }

  return "unknown";
}

/**
 * 判断错误是否可重试（压缩相关）
 */
export function isCompressionRetryable(
  errorType: CompressionErrorType,
): boolean {
  return errorType === "transient";
}

// =============================================================================
// 简单截断策略
// =============================================================================

/**
 * 简单截断消息（无 LLM 调用）
 *
 * 保留最近 N 轮对话，丢弃早期消息
 *
 * @param messages 原始消息
 * @param keepTurns 保留轮次数
 * @returns 截断后的消息和指标
 */
export function simpleTruncate(
  messages: ConversationMessage[],
  keepTurns: number,
): {
  messages: ConversationMessage[];
  metrics: {
    originalTokens: number;
    finalTokens: number;
    compressionRatio: number;
  };
} {
  // 分离系统消息和对话消息
  const systemMessages = messages.filter((m) => m.role === "system");
  const dialogMessages = messages.filter((m) => m.role !== "system");

  // 计算保留消息数量（一轮 = 1 用户 + 1 助手）
  const keepMessageCount = keepTurns * 2;

  // 如果对话消息不足以截断，全部保留
  if (dialogMessages.length <= keepMessageCount) {
    const tokens = estimateMessagesTokens(messages);
    return {
      messages,
      metrics: {
        originalTokens: tokens,
        finalTokens: tokens,
        compressionRatio: 1,
      },
    };
  }

  // 保留最近的消息
  const keptDialog = dialogMessages.slice(-keepMessageCount);
  const truncatedMessages = [...systemMessages, ...keptDialog];

  // 计算指标
  const originalTokens = estimateMessagesTokens(messages);
  const finalTokens = estimateMessagesTokens(truncatedMessages);

  return {
    messages: truncatedMessages,
    metrics: {
      originalTokens,
      finalTokens,
      compressionRatio: finalTokens / originalTokens,
    },
  };
}

// =============================================================================
// 降级执行器
// =============================================================================

/**
 * 带降级策略的压缩执行器
 *
 * @param messages 原始消息
 * @param compress 压缩函数（由调用方提供）
 * @param config 降级配置
 * @param context 日志上下文
 * @returns 降级结果
 */
export async function executeWithFallback(
  messages: ConversationMessage[],
  compress: () => Promise<CompressionResult>,
  config: FallbackConfig = DEFAULT_FALLBACK_CONFIG,
  context?: { userId?: string; conversationId?: string; traceId?: string },
): Promise<FallbackResult> {
  const originalTokens = estimateMessagesTokens(messages);
  const originalTurns = calculateTurns(messages);

  // 级别 1: 尝试完整 LLM 压缩
  let lastError: Error | string | undefined;
  let attempts = 0;
  const maxAttempts = config.enableRetry ? config.maxRetries + 1 : 1;

  while (attempts < maxAttempts) {
    attempts++;

    try {
      const result = await compress();

      if (result.success) {
        logger.info(
          {
            ...context,
            level: "full_compression",
            attempts,
            originalTurns,
            compressionRatio: result.metrics?.compressionRatio,
          },
          "CompressionFallback: Full compression succeeded",
        );

        return {
          messages: result.messages,
          level: "full_compression",
          compressed: true,
          summary: result.summary,
          metrics: {
            originalTokens,
            finalTokens:
              result.metrics?.compressedTokens ||
              estimateMessagesTokens(result.messages),
            compressionRatio: result.metrics?.compressionRatio || 1,
          },
        };
      }

      // 压缩失败（非异常）
      lastError = result.reason || "Unknown compression failure";
      break; // 非异常失败不重试
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorType = classifyCompressionError(lastError);

      logger.warn(
        {
          ...context,
          attempt: attempts,
          maxAttempts,
          errorType,
          error: lastError instanceof Error ? lastError.message : lastError,
        },
        "CompressionFallback: Compression attempt failed",
      );

      // 只有瞬态错误才重试
      if (!isCompressionRetryable(errorType) || attempts >= maxAttempts) {
        break;
      }

      // 重试前等待
      await sleep(config.retryDelayMs);
    }
  }

  // 级别 2: 简单截断降级
  if (
    config.enableTruncationFallback &&
    originalTurns > config.truncationKeepTurns
  ) {
    const truncateResult = simpleTruncate(messages, config.truncationKeepTurns);

    logger.info(
      {
        ...context,
        level: "simple_truncation",
        fallbackReason: String(lastError),
        originalTurns,
        keptTurns: config.truncationKeepTurns,
        compressionRatio: truncateResult.metrics.compressionRatio,
      },
      "CompressionFallback: Fell back to simple truncation",
    );

    return {
      messages: truncateResult.messages,
      level: "simple_truncation",
      compressed: true,
      metrics: truncateResult.metrics,
      fallbackReason: `LLM 压缩失败，已降级为简单截断: ${lastError}`,
    };
  }

  // 级别 3: 返回原始消息
  logger.warn(
    {
      ...context,
      level: "original",
      fallbackReason: String(lastError),
      originalTurns,
    },
    "CompressionFallback: Returning original messages (all fallbacks exhausted)",
  );

  return {
    messages,
    level: "original",
    compressed: false,
    metrics: {
      originalTokens,
      finalTokens: originalTokens,
      compressionRatio: 1,
    },
    fallbackReason: `所有压缩策略失败: ${lastError}`,
  };
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 异步等待
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
