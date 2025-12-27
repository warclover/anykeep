/**
 * 压缩降级策略测试
 *
 * @since 2025-12-27
 */

import {
  classifyCompressionError,
  isCompressionRetryable,
  simpleTruncate,
  executeWithFallback,
  DEFAULT_FALLBACK_CONFIG,
} from "../compression-fallback";
import type {
  ConversationMessage,
  CompressionResult,
} from "../compression-types";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("compression-fallback", () => {
  // ===========================================================================
  // 错误分类测试
  // ===========================================================================

  describe("classifyCompressionError", () => {
    it("should classify timeout errors as transient", () => {
      expect(classifyCompressionError("Request timeout")).toBe("transient");
      expect(classifyCompressionError(new Error("connection timeout"))).toBe(
        "transient",
      );
    });

    it("should classify network errors as transient", () => {
      expect(classifyCompressionError("Network error occurred")).toBe(
        "transient",
      );
      expect(classifyCompressionError(new Error("ECONNRESET"))).toBe(
        "transient",
      );
      expect(classifyCompressionError(new Error("ECONNREFUSED"))).toBe(
        "transient",
      );
    });

    it("should classify rate limit errors as transient", () => {
      expect(classifyCompressionError("Rate limit exceeded")).toBe("transient");
      expect(classifyCompressionError(new Error("429 Too Many Requests"))).toBe(
        "transient",
      );
    });

    it("should classify server errors as transient", () => {
      expect(
        classifyCompressionError(new Error("503 Service Unavailable")),
      ).toBe("transient");
      expect(classifyCompressionError(new Error("502 Bad Gateway"))).toBe(
        "transient",
      );
    });

    it("should classify validation errors as validation", () => {
      expect(classifyCompressionError("摘要过短")).toBe("validation");
      expect(classifyCompressionError("摘要过长")).toBe("validation");
      expect(classifyCompressionError("摘要为空")).toBe("validation");
      expect(classifyCompressionError("缺少必要字段")).toBe("validation");
      expect(classifyCompressionError("Token 未减少")).toBe("validation");
    });

    it("should classify model errors as model", () => {
      expect(classifyCompressionError("Failed to get model")).toBe("model");
      expect(classifyCompressionError("Provider not available")).toBe("model");
      expect(classifyCompressionError("Invalid API key")).toBe("model");
    });

    it("should classify unknown errors", () => {
      expect(classifyCompressionError("Something went wrong")).toBe("unknown");
      expect(classifyCompressionError(undefined)).toBe("unknown");
      expect(classifyCompressionError("")).toBe("unknown");
    });
  });

  describe("isCompressionRetryable", () => {
    it("should return true for transient errors", () => {
      expect(isCompressionRetryable("transient")).toBe(true);
    });

    it("should return false for non-transient errors", () => {
      expect(isCompressionRetryable("validation")).toBe(false);
      expect(isCompressionRetryable("model")).toBe(false);
      expect(isCompressionRetryable("unknown")).toBe(false);
    });
  });

  // ===========================================================================
  // 简单截断测试
  // ===========================================================================

  describe("simpleTruncate", () => {
    function createMessages(count: number): ConversationMessage[] {
      const messages: ConversationMessage[] = [];
      for (let i = 0; i < count; i++) {
        messages.push({
          role: i % 2 === 0 ? "user" : "assistant",
          content: `消息内容 ${i + 1}，这是一段测试文本。`,
        });
      }
      return messages;
    }

    it("should keep all messages when count is below threshold", () => {
      const messages = createMessages(10); // 5 turns
      const result = simpleTruncate(messages, 8); // keep 8 turns

      expect(result.messages.length).toBe(10);
      expect(result.metrics.compressionRatio).toBe(1);
    });

    it("should truncate messages when count exceeds threshold", () => {
      const messages = createMessages(20); // 10 turns
      const result = simpleTruncate(messages, 4); // keep 4 turns = 8 messages

      expect(result.messages.length).toBe(8);
      expect(result.metrics.compressionRatio).toBeLessThan(1);
    });

    it("should keep recent messages, not old ones", () => {
      const messages = createMessages(10);
      const result = simpleTruncate(messages, 2); // keep 2 turns = 4 messages

      expect(result.messages.length).toBe(4);
      // Should keep last 4 messages (消息 7, 8, 9, 10)
      expect(result.messages[0].content).toContain("消息内容 7");
      expect(result.messages[3].content).toContain("消息内容 10");
    });

    it("should preserve system messages", () => {
      const messages: ConversationMessage[] = [
        { role: "system", content: "System prompt" },
        { role: "user", content: "User 1" },
        { role: "assistant", content: "Assistant 1" },
        { role: "user", content: "User 2" },
        { role: "assistant", content: "Assistant 2" },
        { role: "user", content: "User 3" },
        { role: "assistant", content: "Assistant 3" },
      ];

      const result = simpleTruncate(messages, 1); // keep 1 turn

      // Should keep system message + last 2 dialog messages
      expect(result.messages.length).toBe(3);
      expect(result.messages[0].role).toBe("system");
      expect(result.messages[1].content).toBe("User 3");
      expect(result.messages[2].content).toBe("Assistant 3");
    });

    it("should calculate metrics correctly", () => {
      const messages = createMessages(20);
      const result = simpleTruncate(messages, 4);

      expect(result.metrics.originalTokens).toBeGreaterThan(0);
      expect(result.metrics.finalTokens).toBeGreaterThan(0);
      expect(result.metrics.finalTokens).toBeLessThan(
        result.metrics.originalTokens,
      );
      expect(result.metrics.compressionRatio).toBeLessThan(1);
    });
  });

  // ===========================================================================
  // executeWithFallback 测试
  // ===========================================================================

  describe("executeWithFallback", () => {
    function createMessages(count: number): ConversationMessage[] {
      const messages: ConversationMessage[] = [];
      for (let i = 0; i < count; i++) {
        messages.push({
          role: i % 2 === 0 ? "user" : "assistant",
          content: `测试消息内容 ${i + 1}，这是一段较长的文本用于测试。`.repeat(
            5,
          ),
        });
      }
      return messages;
    }

    const mockContext = {
      userId: "test-user",
      conversationId: "test-conv",
    };

    it("should return full_compression level on success", async () => {
      const messages = createMessages(20);
      const mockCompress = jest.fn().mockResolvedValue({
        success: true,
        messages: messages.slice(-8),
        summary: "Test summary",
        metrics: {
          originalTokens: 1000,
          compressedTokens: 400,
          compressionRatio: 0.4,
        },
      } as CompressionResult);

      const result = await executeWithFallback(
        messages,
        mockCompress,
        DEFAULT_FALLBACK_CONFIG,
        mockContext,
      );

      expect(result.level).toBe("full_compression");
      expect(result.compressed).toBe(true);
      expect(result.summary).toBe("Test summary");
      expect(mockCompress).toHaveBeenCalledTimes(1);
    });

    it("should retry on transient errors", async () => {
      const messages = createMessages(20);
      const mockCompress = jest
        .fn()
        .mockRejectedValueOnce(new Error("Network timeout"))
        .mockResolvedValueOnce({
          success: true,
          messages: messages.slice(-8),
          summary: "Test summary",
          metrics: {
            originalTokens: 1000,
            compressedTokens: 400,
            compressionRatio: 0.4,
          },
        } as CompressionResult);

      const result = await executeWithFallback(
        messages,
        mockCompress,
        { ...DEFAULT_FALLBACK_CONFIG, retryDelayMs: 10 },
        mockContext,
      );

      expect(result.level).toBe("full_compression");
      expect(result.compressed).toBe(true);
      expect(mockCompress).toHaveBeenCalledTimes(2);
    });

    it("should not retry on validation errors", async () => {
      const messages = createMessages(20);
      const mockCompress = jest.fn().mockRejectedValue(new Error("摘要过短"));

      const result = await executeWithFallback(
        messages,
        mockCompress,
        { ...DEFAULT_FALLBACK_CONFIG, retryDelayMs: 10 },
        mockContext,
      );

      // Should fall back to truncation after validation error
      expect(result.level).toBe("simple_truncation");
      expect(result.compressed).toBe(true);
      expect(mockCompress).toHaveBeenCalledTimes(1);
    });

    it("should fallback to simple_truncation when compression fails", async () => {
      const messages = createMessages(20);
      const mockCompress = jest.fn().mockResolvedValue({
        success: false,
        messages: messages,
        reason: "Compression validation failed",
      } as CompressionResult);

      const result = await executeWithFallback(
        messages,
        mockCompress,
        DEFAULT_FALLBACK_CONFIG,
        mockContext,
      );

      expect(result.level).toBe("simple_truncation");
      expect(result.compressed).toBe(true);
      expect(result.fallbackReason).toContain("简单截断");
      expect(result.messages.length).toBeLessThan(messages.length);
    });

    it("should return original when truncation is disabled and compression fails", async () => {
      const messages = createMessages(20);
      const mockCompress = jest.fn().mockResolvedValue({
        success: false,
        messages: messages,
        reason: "Compression failed",
      } as CompressionResult);

      const result = await executeWithFallback(
        messages,
        mockCompress,
        { ...DEFAULT_FALLBACK_CONFIG, enableTruncationFallback: false },
        mockContext,
      );

      expect(result.level).toBe("original");
      expect(result.compressed).toBe(false);
      expect(result.messages.length).toBe(messages.length);
    });

    it("should return original when message count is below truncation threshold", async () => {
      const messages = createMessages(10); // 5 turns
      const mockCompress = jest.fn().mockResolvedValue({
        success: false,
        messages: messages,
        reason: "Compression failed",
      } as CompressionResult);

      const result = await executeWithFallback(
        messages,
        mockCompress,
        { ...DEFAULT_FALLBACK_CONFIG, truncationKeepTurns: 8 }, // 8 turns threshold
        mockContext,
      );

      // 5 turns <= 8 turns threshold, so no truncation possible
      expect(result.level).toBe("original");
      expect(result.compressed).toBe(false);
    });

    it("should handle maximum retries exceeded", async () => {
      const messages = createMessages(20);
      const mockCompress = jest
        .fn()
        .mockRejectedValue(new Error("Network error"));

      const result = await executeWithFallback(
        messages,
        mockCompress,
        { ...DEFAULT_FALLBACK_CONFIG, maxRetries: 2, retryDelayMs: 10 },
        mockContext,
      );

      expect(result.level).toBe("simple_truncation");
      expect(mockCompress).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it("should include metrics in all fallback levels", async () => {
      const messages = createMessages(20);
      const mockCompress = jest.fn().mockResolvedValue({
        success: false,
        messages: messages,
        reason: "Failed",
      } as CompressionResult);

      const result = await executeWithFallback(
        messages,
        mockCompress,
        DEFAULT_FALLBACK_CONFIG,
        mockContext,
      );

      expect(result.metrics).toBeDefined();
      expect(result.metrics?.originalTokens).toBeGreaterThan(0);
      expect(result.metrics?.finalTokens).toBeGreaterThan(0);
      expect(result.metrics?.compressionRatio).toBeDefined();
    });
  });
});
