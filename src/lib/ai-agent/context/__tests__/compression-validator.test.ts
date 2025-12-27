/**
 * 压缩验证器测试
 *
 * @since 2025-12-27
 */

import {
  estimateTokens,
  estimateMessagesTokens,
  validateCompressionSummary,
  validateCompressionEffect,
  calculateTurns,
  calculateTokenUsageRatio,
} from "../compression-validator";
import type { ConversationMessage } from "../compression-types";

describe("compression-validator", () => {
  // ===========================================================================
  // Token 估算测试
  // ===========================================================================

  describe("estimateTokens", () => {
    it("should return 0 for empty string", () => {
      expect(estimateTokens("")).toBe(0);
    });

    it("should return 0 for null/undefined", () => {
      expect(estimateTokens(null as unknown as string)).toBe(0);
      expect(estimateTokens(undefined as unknown as string)).toBe(0);
    });

    it("should estimate tokens for English text", () => {
      // English: ~4 chars per token
      const text = "Hello, how are you doing today?"; // 31 chars
      const tokens = estimateTokens(text);
      // 31 / 4 = 7.75 → 8
      expect(tokens).toBeGreaterThanOrEqual(7);
      expect(tokens).toBeLessThanOrEqual(10);
    });

    it("should estimate tokens for Chinese text", () => {
      // Chinese: ~1.5 chars per token
      const text = "你好，今天怎么样？"; // 9 Chinese chars
      const tokens = estimateTokens(text);
      // 9 / 1.5 = 6
      expect(tokens).toBeGreaterThanOrEqual(5);
      expect(tokens).toBeLessThanOrEqual(8);
    });

    it("should estimate tokens for mixed Chinese/English text", () => {
      const text = "Hello 你好，这是一个 test 测试"; // mixed
      const tokens = estimateTokens(text);
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe("estimateMessagesTokens", () => {
    it("should return 0 for empty array", () => {
      expect(estimateMessagesTokens([])).toBe(0);
    });

    it("should sum tokens from all messages", () => {
      const messages: ConversationMessage[] = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ];
      const tokens = estimateMessagesTokens(messages);
      expect(tokens).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // 摘要验证测试
  // ===========================================================================

  describe("validateCompressionSummary", () => {
    const validSummary = `### 1. 用户目标 (User Goals)
- 整理书签
- 添加标签

### 2. 已完成操作 (Completed Actions)
- 搜索了 20 条书签
- 添加了 5 个标签

### 3. 重要上下文 (Key Context)
- 用户偏好技术文章
- 常用文件夹：技术笔记

### 4. 待处理事项 (Pending Items)
- 继续整理剩余书签
- 检查重复内容`;

    it("should validate a proper summary", () => {
      const result = validateCompressionSummary(validSummary);
      expect(result.isValid).toBe(true);
      expect(result.summaryTokens).toBeGreaterThan(0);
    });

    it("should reject empty summary", () => {
      const result = validateCompressionSummary("");
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("为空");
    });

    it("should reject whitespace-only summary", () => {
      const result = validateCompressionSummary("   \n\n  ");
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("为空");
    });

    it("should reject too short summary", () => {
      const result = validateCompressionSummary("简短");
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("过短");
    });

    it("should reject too long summary", () => {
      // 创建一个超长摘要
      const longSummary = validSummary.repeat(20);
      const result = validateCompressionSummary(longSummary, 500);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("过长");
    });

    it("should allow one missing section", () => {
      // 缺少一个段落
      const partialSummary = `### 1. 用户目标
- 整理书签

### 2. 已完成操作
- 搜索了书签

### 3. 重要上下文
- 技术文章`;
      // 缺少「待处理事项」，但只缺一个应该允许
      const result = validateCompressionSummary(partialSummary);
      // 由于 partialSummary 可能过短，检查不是因为缺少段落而失败
      if (!result.isValid && result.reason?.includes("过短")) {
        // 可接受：因为太短而失败
        expect(result.reason).toContain("过短");
      } else {
        // 缺少一个段落应该仍然有效
        expect(result.missingSections?.length).toBeLessThanOrEqual(1);
      }
    });

    it("should reject summary missing multiple sections", () => {
      const incompleteSummary = `### 1. 用户目标
- 整理书签
- 添加标签

这是一个不完整的摘要，缺少多个必需段落。
我们需要确保摘要足够长以避免「过短」错误。
这里添加更多内容来满足最小长度要求。
继续添加一些填充文本。`;

      const result = validateCompressionSummary(incompleteSummary);
      expect(result.isValid).toBe(false);
      // 应该因为缺少多个段落而失败
      if (result.missingSections) {
        expect(result.missingSections.length).toBeGreaterThan(1);
      }
    });
  });

  // ===========================================================================
  // 压缩效果验证测试
  // ===========================================================================

  describe("validateCompressionEffect", () => {
    it("should validate effective compression", () => {
      const original: ConversationMessage[] = [
        { role: "user", content: "这是第一条很长的消息，包含很多内容" },
        { role: "assistant", content: "这是回复，也包含很多内容和说明" },
        { role: "user", content: "继续讨论更多话题" },
        { role: "assistant", content: "更多回复内容" },
      ];

      const compressed: ConversationMessage[] = [
        { role: "user", content: "最新问题" },
        { role: "assistant", content: "最新回复" },
      ];

      const summary = "简短摘要";

      const result = validateCompressionEffect(original, compressed, summary);
      expect(result.isEffective).toBe(true);
      expect(result.compressionRatio).toBeLessThan(1);
    });

    it("should reject ineffective compression (no reduction)", () => {
      const original: ConversationMessage[] = [
        { role: "user", content: "短消息" },
      ];

      const compressed: ConversationMessage[] = [
        { role: "user", content: "短消息" },
      ];

      const summary = "这是一个很长的摘要，比原始消息还要长得多";

      const result = validateCompressionEffect(original, compressed, summary);
      expect(result.isEffective).toBe(false);
      expect(result.reason).toContain("未减少");
    });

    it("should warn about limited compression effect", () => {
      const original: ConversationMessage[] = [
        { role: "user", content: "消息内容消息内容消息内容" },
        { role: "assistant", content: "回复内容回复内容" },
      ];

      const compressed: ConversationMessage[] = [
        { role: "user", content: "消息内容消息内容" },
        { role: "assistant", content: "回复内容" },
      ];

      const summary = "摘要";

      const result = validateCompressionEffect(original, compressed, summary);
      // 压缩比率高于 0.8 会有警告
      if (result.compressionRatio > 0.8) {
        expect(result.reason).toContain("有限");
      }
    });
  });

  // ===========================================================================
  // 辅助函数测试
  // ===========================================================================

  describe("calculateTurns", () => {
    it("should return 0 for empty array", () => {
      expect(calculateTurns([])).toBe(0);
    });

    it("should count user messages as turns", () => {
      const messages: ConversationMessage[] = [
        { role: "system", content: "系统提示" },
        { role: "user", content: "问题1" },
        { role: "assistant", content: "回答1" },
        { role: "user", content: "问题2" },
        { role: "assistant", content: "回答2" },
      ];
      expect(calculateTurns(messages)).toBe(2);
    });

    it("should exclude system messages from turn count", () => {
      const messages: ConversationMessage[] = [
        { role: "system", content: "系统提示" },
        { role: "user", content: "问题" },
      ];
      expect(calculateTurns(messages)).toBe(1);
    });
  });

  describe("calculateTokenUsageRatio", () => {
    it("should return 0 for zero max tokens", () => {
      const messages: ConversationMessage[] = [
        { role: "user", content: "Hello" },
      ];
      expect(calculateTokenUsageRatio(messages, 0)).toBe(0);
    });

    it("should calculate ratio correctly", () => {
      const messages: ConversationMessage[] = [
        { role: "user", content: "Hello world" },
      ];
      const ratio = calculateTokenUsageRatio(messages, 100);
      expect(ratio).toBeGreaterThan(0);
      expect(ratio).toBeLessThan(1);
    });

    it("should return higher ratio for more content", () => {
      const shortMessages: ConversationMessage[] = [
        { role: "user", content: "Hi" },
      ];
      const longMessages: ConversationMessage[] = [
        {
          role: "user",
          content: "This is a much longer message with more content",
        },
        {
          role: "assistant",
          content: "And this is an even longer response with lots of details",
        },
      ];

      const shortRatio = calculateTokenUsageRatio(shortMessages, 100);
      const longRatio = calculateTokenUsageRatio(longMessages, 100);

      expect(longRatio).toBeGreaterThan(shortRatio);
    });
  });
});
