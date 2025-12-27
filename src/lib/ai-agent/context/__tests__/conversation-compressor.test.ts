/**
 * ConversationCompressor 测试
 *
 * @since 2025-12-27
 */

import { ConversationCompressor } from "../conversation-compressor";
import type { ConversationMessage } from "../compression-types";

// Mock dependencies
jest.mock("@/lib/ai-providers", () => ({
  aiProviderRouter: {
    getModel: jest.fn().mockReturnValue({
      // Mock model
    }),
  },
  getTierProviderConfig: jest.fn().mockReturnValue({
    name: "deepseek",
    model: "deepseek-chat",
  }),
}));

jest.mock("ai", () => ({
  generateText: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { generateText } from "ai";
import { aiProviderRouter } from "@/lib/ai-providers";

describe("ConversationCompressor", () => {
  let compressor: ConversationCompressor;

  beforeEach(() => {
    jest.clearAllMocks();
    compressor = new ConversationCompressor();
  });

  // ===========================================================================
  // 配置测试
  // ===========================================================================

  describe("configuration", () => {
    it("should use default config when none provided", () => {
      const config = compressor.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.trigger.turnThreshold).toBe(12);
      expect(config.trigger.tokenUsageThreshold).toBe(0.8);
      expect(config.retention.keepRecentTurns).toBe(6);
    });

    it("should allow custom config override", () => {
      const customCompressor = new ConversationCompressor({
        trigger: {
          turnThreshold: 20,
          tokenUsageThreshold: 0.9,
          minTurnsBeforeCompression: 10,
        },
      });
      const config = customCompressor.getConfig();
      expect(config.trigger.turnThreshold).toBe(20);
      expect(config.trigger.tokenUsageThreshold).toBe(0.9);
    });

    it("should update config via updateConfig", () => {
      compressor.updateConfig({ enabled: false });
      expect(compressor.getConfig().enabled).toBe(false);
    });
  });

  // ===========================================================================
  // shouldCompress 测试
  // ===========================================================================

  describe("shouldCompress", () => {
    it("should return false when disabled", () => {
      const disabledCompressor = new ConversationCompressor({ enabled: false });
      const messages = createMessages(20);
      const result = disabledCompressor.shouldCompress(messages, 8000);

      expect(result.needed).toBe(false);
      expect(result.reason).toContain("禁用");
    });

    it("should return false when turns below minimum", () => {
      const messages = createMessages(4); // 2 turns
      const result = compressor.shouldCompress(messages, 8000);

      expect(result.needed).toBe(false);
      expect(result.reason).toContain("未达到最小阈值");
    });

    it("should return true when turns reach threshold", () => {
      const messages = createMessages(24); // 12 turns
      const result = compressor.shouldCompress(messages, 8000);

      expect(result.needed).toBe(true);
      expect(result.reason).toContain("轮次");
      expect(result.currentTurns).toBe(12);
    });

    it("should return true when token usage reaches threshold", () => {
      // 创建长消息以触发 Token 阈值
      const messages = createLongMessages(14, 1000); // 7 turns, long content
      const result = compressor.shouldCompress(messages, 2000); // 低 max tokens

      expect(result.needed).toBe(true);
      if (result.tokenUsageRatio) {
        expect(result.tokenUsageRatio).toBeGreaterThanOrEqual(0.8);
      }
    });

    it("should return current turns and token ratio in result", () => {
      const messages = createMessages(16); // 8 turns
      const result = compressor.shouldCompress(messages, 8000);

      expect(result.currentTurns).toBe(8);
      expect(result.tokenUsageRatio).toBeDefined();
    });
  });

  // ===========================================================================
  // compress 测试
  // ===========================================================================

  describe("compress", () => {
    const mockContext = {
      userId: "test-user",
      conversationId: "test-conv",
      baseSystemPrompt: "You are a helpful assistant",
    };

    const validSummary = `### 1. 用户目标 (User Goals)
- 整理书签

### 2. 已完成操作 (Completed Actions)
- 搜索了书签

### 3. 重要上下文 (Key Context)
- 技术文章偏好

### 4. 待处理事项 (Pending Items)
- 继续整理`;

    beforeEach(() => {
      (aiProviderRouter.getModel as jest.Mock).mockReturnValue({});
    });

    it("should return failure when disabled", async () => {
      const disabledCompressor = new ConversationCompressor({ enabled: false });
      const messages = createMessages(20);
      const result = await disabledCompressor.compress(messages, mockContext);

      expect(result.success).toBe(false);
      expect(result.reason).toContain("禁用");
      expect(result.messages).toEqual(messages);
    });

    it("should return failure when no messages to compress", async () => {
      const messages = createMessages(4); // Only 2 turns, below keepRecentTurns=6
      const result = await compressor.compress(messages, mockContext);

      expect(result.success).toBe(false);
      expect(result.reason).toContain("没有需要压缩的消息");
    });

    it("should call LLM and return compressed messages on success", async () => {
      (generateText as jest.Mock).mockResolvedValue({
        text: validSummary,
        usage: { inputTokens: 100, outputTokens: 50 },
        finishReason: "stop",
      });

      // 使用长消息以确保压缩后确实更短
      const messages = createLongMessages(30, 200); // 15 turns, long content
      const result = await compressor.compress(messages, mockContext);

      expect(generateText).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.messages.length).toBeLessThan(messages.length);
    });

    it("should return failure when summary validation fails", async () => {
      (generateText as jest.Mock).mockResolvedValue({
        text: "太短", // Too short summary
        usage: { inputTokens: 100, outputTokens: 5 },
        finishReason: "stop",
      });

      const messages = createMessages(30);
      const result = await compressor.compress(messages, mockContext);

      expect(result.success).toBe(false);
      expect(result.reason).toContain("过短");
    });

    it("should return failure when LLM call fails", async () => {
      (generateText as jest.Mock).mockRejectedValue(new Error("API error"));

      const messages = createMessages(30);
      const result = await compressor.compress(messages, mockContext);

      expect(result.success).toBe(false);
      expect(result.reason).toContain("执行失败");
      expect(result.error).toBeDefined();
    });

    it("should return failure when model not available", async () => {
      (aiProviderRouter.getModel as jest.Mock).mockReturnValue(null);

      const messages = createMessages(30);
      const result = await compressor.compress(messages, mockContext);

      expect(result.success).toBe(false);
      expect(result.reason).toContain("Failed to get model");
    });

    it("should include metrics on successful compression", async () => {
      (generateText as jest.Mock).mockResolvedValue({
        text: validSummary,
        usage: { inputTokens: 500, outputTokens: 100 },
        finishReason: "stop",
      });

      // 使用长消息以确保压缩后确实更短
      const messages = createLongMessages(30, 200);
      const result = await compressor.compress(messages, mockContext);

      expect(result.success).toBe(true);
      expect(result.metrics).toBeDefined();
      expect(result.metrics?.originalMessageCount).toBe(30);
      expect(result.metrics?.compressedMessageCount).toBeLessThan(30);
      expect(result.metrics?.compressionRatio).toBeLessThan(1);
      expect(result.metrics?.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ===========================================================================
  // 辅助函数
  // ===========================================================================

  /**
   * 创建指定数量的测试消息
   */
  function createMessages(count: number): ConversationMessage[] {
    const messages: ConversationMessage[] = [];
    for (let i = 0; i < count; i++) {
      messages.push({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `消息 ${i + 1}`,
      });
    }
    return messages;
  }

  /**
   * 创建长内容的测试消息
   */
  function createLongMessages(
    count: number,
    contentLength: number,
  ): ConversationMessage[] {
    const messages: ConversationMessage[] = [];
    const longContent = "这是一段很长的内容。".repeat(
      Math.ceil(contentLength / 10),
    );
    for (let i = 0; i < count; i++) {
      messages.push({
        role: i % 2 === 0 ? "user" : "assistant",
        content: longContent,
      });
    }
    return messages;
  }
});
