/**
 * 压缩 Prompt 测试
 *
 * @since 2025-12-27
 */

import {
  ANYKEEP_COMPRESSION_PROMPT,
  COMPRESSION_USER_PROMPT,
  formatConversationHistory,
  buildCompressionPrompt,
  buildSummaryBlock,
  mergeSystemPromptWithSummary,
  getCompressionMessages,
} from "../compression-prompt";
import type { ConversationMessage } from "../compression-types";

describe("compression-prompt", () => {
  // ===========================================================================
  // 常量测试
  // ===========================================================================

  describe("constants", () => {
    it("should have ANYKEEP_COMPRESSION_PROMPT defined", () => {
      expect(ANYKEEP_COMPRESSION_PROMPT).toBeDefined();
      expect(ANYKEEP_COMPRESSION_PROMPT).toContain("AnyKeep");
      expect(ANYKEEP_COMPRESSION_PROMPT).toContain("{conversation_history}");
    });

    it("should have COMPRESSION_USER_PROMPT defined", () => {
      expect(COMPRESSION_USER_PROMPT).toBeDefined();
      expect(COMPRESSION_USER_PROMPT.length).toBeGreaterThan(0);
    });

    it("ANYKEEP_COMPRESSION_PROMPT should contain all 4 sections", () => {
      expect(ANYKEEP_COMPRESSION_PROMPT).toContain("用户目标");
      expect(ANYKEEP_COMPRESSION_PROMPT).toContain("已完成操作");
      expect(ANYKEEP_COMPRESSION_PROMPT).toContain("重要上下文");
      expect(ANYKEEP_COMPRESSION_PROMPT).toContain("待处理事项");
    });
  });

  // ===========================================================================
  // formatConversationHistory 测试
  // ===========================================================================

  describe("formatConversationHistory", () => {
    it("should return placeholder for empty messages", () => {
      const result = formatConversationHistory([]);
      expect(result).toContain("无对话历史");
    });

    it("should format user messages", () => {
      const messages: ConversationMessage[] = [
        { role: "user", content: "你好" },
      ];
      const result = formatConversationHistory(messages);
      expect(result).toContain("用户");
      expect(result).toContain("你好");
    });

    it("should format assistant messages", () => {
      const messages: ConversationMessage[] = [
        { role: "assistant", content: "你好！有什么可以帮您？" },
      ];
      const result = formatConversationHistory(messages);
      expect(result).toContain("助手");
      expect(result).toContain("你好！有什么可以帮您？");
    });

    it("should exclude system messages", () => {
      const messages: ConversationMessage[] = [
        { role: "system", content: "系统提示" },
        { role: "user", content: "用户消息" },
      ];
      const result = formatConversationHistory(messages);
      expect(result).not.toContain("系统提示");
      expect(result).toContain("用户消息");
    });

    it("should include message numbers", () => {
      const messages: ConversationMessage[] = [
        { role: "user", content: "第一条" },
        { role: "assistant", content: "第二条" },
        { role: "user", content: "第三条" },
      ];
      const result = formatConversationHistory(messages);
      expect(result).toContain("[1]");
      expect(result).toContain("[2]");
      expect(result).toContain("[3]");
    });

    it("should include timestamp if provided", () => {
      const timestamp = new Date("2025-12-27T10:00:00");
      const messages: ConversationMessage[] = [
        { role: "user", content: "消息", timestamp },
      ];
      const result = formatConversationHistory(messages);
      // 检查是否包含日期/时间信息
      expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}|\d{4}\/\d{1,2}\/\d{1,2}/);
    });
  });

  // ===========================================================================
  // buildCompressionPrompt 测试
  // ===========================================================================

  describe("buildCompressionPrompt", () => {
    it("should build prompt with conversation history", () => {
      const messages: ConversationMessage[] = [
        { role: "user", content: "搜索技术文章" },
        { role: "assistant", content: "找到 10 篇技术文章" },
      ];
      const result = buildCompressionPrompt(messages);

      expect(result).toContain("AnyKeep");
      expect(result).toContain("搜索技术文章");
      expect(result).toContain("找到 10 篇技术文章");
      expect(result).not.toContain("{conversation_history}");
    });

    it("should replace placeholder correctly", () => {
      const messages: ConversationMessage[] = [
        { role: "user", content: "测试消息" },
      ];
      const result = buildCompressionPrompt(messages);
      expect(result).not.toContain("{conversation_history}");
    });
  });

  // ===========================================================================
  // buildSummaryBlock 测试
  // ===========================================================================

  describe("buildSummaryBlock", () => {
    it("should build summary block with header", () => {
      const summary = "这是压缩摘要内容";
      const result = buildSummaryBlock(summary);

      expect(result).toContain("对话历史摘要");
      expect(result).toContain(summary);
      expect(result).toContain("---");
    });

    it("should include continuation hint", () => {
      const summary = "摘要";
      const result = buildSummaryBlock(summary);

      expect(result).toContain("以下是最近的对话");
    });
  });

  // ===========================================================================
  // mergeSystemPromptWithSummary 测试
  // ===========================================================================

  describe("mergeSystemPromptWithSummary", () => {
    it("should merge base prompt with summary", () => {
      const basePrompt = "你是一个智能助手";
      const summary = "用户之前讨论了书签整理";
      const result = mergeSystemPromptWithSummary(basePrompt, summary);

      expect(result).toContain(basePrompt);
      expect(result).toContain(summary);
      expect(result).toContain("对话历史摘要");
    });

    it("should preserve base prompt at the beginning", () => {
      const basePrompt = "基础提示";
      const summary = "摘要内容";
      const result = mergeSystemPromptWithSummary(basePrompt, summary);

      expect(result.indexOf(basePrompt)).toBeLessThan(result.indexOf(summary));
    });
  });

  // ===========================================================================
  // getCompressionMessages 测试
  // ===========================================================================

  describe("getCompressionMessages", () => {
    it("should return array with system and user messages", () => {
      const messages: ConversationMessage[] = [
        { role: "user", content: "测试" },
      ];
      const result = getCompressionMessages(messages);

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe("system");
      expect(result[1].role).toBe("user");
    });

    it("should include compression prompt in system message", () => {
      const messages: ConversationMessage[] = [
        { role: "user", content: "测试内容" },
      ];
      const result = getCompressionMessages(messages);

      expect(result[0].content).toContain("AnyKeep");
      expect(result[0].content).toContain("测试内容");
    });

    it("should use COMPRESSION_USER_PROMPT as user message", () => {
      const messages: ConversationMessage[] = [
        { role: "user", content: "测试" },
      ];
      const result = getCompressionMessages(messages);

      expect(result[1].content).toBe(COMPRESSION_USER_PROMPT);
    });
  });
});
