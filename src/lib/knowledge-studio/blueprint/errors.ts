/**
 * Blueprint Error Classes
 * @module knowledge-studio/blueprint
 *
 * Shared error classes and utilities for blueprint generation.
 */

// ============================================================
// Rate Limit Error
// ============================================================

/**
 * 429 速率限制错误
 */
export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter?: number,
    public provider?: string,
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * 检测是否为 429 速率限制错误
 */
export function isRateLimitError(error: unknown): {
  isRateLimit: boolean;
  retryAfter?: number;
} {
  if (!(error instanceof Error)) {
    return { isRateLimit: false };
  }

  const message = error.message.toLowerCase();

  // 检测 429 状态码或速率限制关键词
  if (
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("请求过于频繁")
  ) {
    // 尝试从错误消息中提取 retryAfter
    const retryAfterMatch = message.match(/retryafter["\s:]+(\d+)/i);
    const retryAfter = retryAfterMatch
      ? parseInt(retryAfterMatch[1], 10)
      : undefined;

    return { isRateLimit: true, retryAfter };
  }

  return { isRateLimit: false };
}

// ============================================================
// Parse Errors
// ============================================================

/**
 * 大纲解析错误
 */
export class OutlineParseError extends Error {
  constructor(
    message: string,
    public rawContent: string,
  ) {
    super(message);
    this.name = "OutlineParseError";
  }
}

/**
 * 大纲验证错误
 */
export class OutlineValidationError extends Error {
  constructor(
    message: string,
    public outline: unknown,
  ) {
    super(message);
    this.name = "OutlineValidationError";
  }
}
