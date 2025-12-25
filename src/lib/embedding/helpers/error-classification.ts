/**
 * 嵌入生成错误分类
 *
 * V4.2.5: 改进异常处理，区分错误类型
 *
 * @module embedding/helpers/error-classification
 * @version 1.0.0
 * @since 2025-12-25
 */

// ============================================
// 类型定义
// ============================================

/** 嵌入生成错误类型 */
export type EmbeddingErrorType =
  | "api_error"
  | "rate_limit"
  | "timeout"
  | "input_error"
  | "network_error"
  | "unknown";

/** 错误分类结果 */
export interface ClassifiedError {
  type: EmbeddingErrorType;
  retryable: boolean;
  message: string;
}

// ============================================
// 错误分类函数
// ============================================

/**
 * 分类嵌入生成错误
 * 用于改进日志和决定是否应该重试
 */
export function classifyEmbeddingError(error: unknown): ClassifiedError {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  // API 速率限制
  if (
    lowerMessage.includes("rate") ||
    lowerMessage.includes("429") ||
    lowerMessage.includes("quota")
  ) {
    return { type: "rate_limit", retryable: true, message };
  }

  // 超时错误
  if (
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("timed out") ||
    lowerMessage.includes("aborted")
  ) {
    return { type: "timeout", retryable: true, message };
  }

  // 网络错误
  if (
    lowerMessage.includes("network") ||
    lowerMessage.includes("econnrefused") ||
    lowerMessage.includes("fetch failed")
  ) {
    return { type: "network_error", retryable: true, message };
  }

  // 输入错误（不应重试）
  if (
    lowerMessage.includes("invalid") ||
    lowerMessage.includes("empty") ||
    lowerMessage.includes("too long")
  ) {
    return { type: "input_error", retryable: false, message };
  }

  // API 错误
  if (
    lowerMessage.includes("api") ||
    lowerMessage.includes("401") ||
    lowerMessage.includes("403") ||
    lowerMessage.includes("500")
  ) {
    return { type: "api_error", retryable: false, message };
  }

  return { type: "unknown", retryable: false, message };
}
