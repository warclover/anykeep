/**
 * 记忆 Prompt 构建器单元测试
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import {
  buildMemoryPrompt,
  buildMemoryReminder,
  estimateTokens,
  isEmptyMemoryContext,
} from "../memory-prompt-builder";
import type { EpisodicMemoryContext } from "../types";

describe("memory-prompt-builder", () => {
  // ===========================================================================
  // buildMemoryPrompt 测试
  // ===========================================================================

  describe("buildMemoryPrompt", () => {
    it("should return empty string for empty context", () => {
      const emptyContext: EpisodicMemoryContext = {
        recentSummaries: [],
        pendingIntents: [],
        preferences: null,
      };

      const result = buildMemoryPrompt(emptyContext);
      expect(result).toBe("");
    });

    it("should build prompt with recent summaries", () => {
      const context: EpisodicMemoryContext = {
        recentSummaries: [
          {
            summary: "用户询问了关于B站收藏的整理方法",
            intents: ["整理", "B站"],
            timeAgo: "2小时前",
          },
          {
            summary: "用户导出了前端相关的收藏",
            intents: ["导出"],
            timeAgo: "1天前",
          },
        ],
        pendingIntents: [],
        preferences: null,
      };

      const result = buildMemoryPrompt(context);

      expect(result).toContain("## 情景记忆");
      expect(result).toContain("### 最近对话");
      expect(result).toContain("2小时前");
      expect(result).toContain("B站收藏");
      expect(result).toContain("（整理、B站）");
    });

    it("should build prompt with pending intents", () => {
      const context: EpisodicMemoryContext = {
        recentSummaries: [],
        pendingIntents: ["导出B站收藏", "整理前端文章"],
        preferences: null,
      };

      const result = buildMemoryPrompt(context);

      expect(result).toContain("## 情景记忆");
      expect(result).toContain("### 待处理事项");
      expect(result).toContain("导出B站收藏");
      expect(result).toContain("整理前端文章");
      expect(result).toContain("主动询问");
    });

    it("should build prompt with user preferences", () => {
      const context: EpisodicMemoryContext = {
        recentSummaries: [],
        pendingIntents: [],
        preferences: {
          positiveRate: 0.85,
          commonActions: ["search", "organize", "export"],
          totalInteractions: 50,
          positiveCount: 42,
          negativeCount: 8,
        },
      };

      const result = buildMemoryPrompt(context);

      expect(result).toContain("## 情景记忆");
      expect(result).toContain("### 用户偏好");
      expect(result).toContain("历史满意度");
      expect(result).toContain("较高");
      expect(result).toContain("常用功能");
      expect(result).toContain("search");
      expect(result).toContain("累计交互：50 次");
    });

    it("should show correct satisfaction description based on rate", () => {
      const makeContext = (rate: number): EpisodicMemoryContext => ({
        recentSummaries: [],
        pendingIntents: [],
        preferences: {
          positiveRate: rate,
          commonActions: [],
          totalInteractions: 100,
          positiveCount: Math.round(rate * 100),
          negativeCount: Math.round((1 - rate) * 100),
        },
      });

      // 非常高 (>= 0.9)
      expect(buildMemoryPrompt(makeContext(0.95))).toContain("非常高");

      // 较高 (>= 0.7)
      expect(buildMemoryPrompt(makeContext(0.75))).toContain("较高");

      // 一般 (>= 0.5)
      expect(buildMemoryPrompt(makeContext(0.55))).toContain("一般");

      // 较低 (< 0.5)
      expect(buildMemoryPrompt(makeContext(0.3))).toContain("较低");
    });

    it("should truncate long content based on token budget", () => {
      const longSummary = "这是一个非常非常长的摘要".repeat(100);
      const context: EpisodicMemoryContext = {
        recentSummaries: [
          {
            summary: longSummary,
            intents: ["测试"],
            timeAgo: "1小时前",
          },
        ],
        pendingIntents: [],
        preferences: null,
      };

      const result = buildMemoryPrompt(context, 100); // 限制 100 tokens

      // 应该被截断
      expect(result.length).toBeLessThan(longSummary.length);
      expect(result).toContain("截断");
    });
  });

  // ===========================================================================
  // buildMemoryReminder 测试
  // ===========================================================================

  describe("buildMemoryReminder", () => {
    it("should return null for empty context", () => {
      const emptyContext: EpisodicMemoryContext = {
        recentSummaries: [],
        pendingIntents: [],
        preferences: null,
      };

      const result = buildMemoryReminder(emptyContext);
      expect(result).toBeNull();
    });

    it("should include pending intent reminder", () => {
      const context: EpisodicMemoryContext = {
        recentSummaries: [],
        pendingIntents: ["导出B站收藏"],
        preferences: null,
      };

      const result = buildMemoryReminder(context);

      expect(result).not.toBeNull();
      expect(result).toContain("<system-reminder>");
      expect(result).toContain("导出B站收藏");
      expect(result).toContain("主动询问");
    });

    it("should include low satisfaction warning", () => {
      const context: EpisodicMemoryContext = {
        recentSummaries: [],
        pendingIntents: [],
        preferences: {
          positiveRate: 0.3,
          commonActions: [],
          totalInteractions: 20,
          positiveCount: 6,
          negativeCount: 14,
        },
      };

      const result = buildMemoryReminder(context);

      expect(result).not.toBeNull();
      expect(result).toContain("<system-reminder>");
      expect(result).toContain("满意度较低");
      expect(result).toContain("询问确认");
    });
  });

  // ===========================================================================
  // estimateTokens 测试
  // ===========================================================================

  describe("estimateTokens", () => {
    it("should estimate tokens for Chinese text", () => {
      const chineseText = "这是一段中文测试文本";
      const tokens = estimateTokens(chineseText);

      // 中文约 1.5 字符/token
      expect(tokens).toBeGreaterThan(chineseText.length / 2);
      expect(tokens).toBeLessThan(chineseText.length);
    });

    it("should estimate tokens for English text", () => {
      const englishText = "This is a test sentence for token estimation";
      const tokens = estimateTokens(englishText);

      // 英文约 4 字符/token
      expect(tokens).toBeGreaterThan(englishText.length / 6);
      expect(tokens).toBeLessThan(englishText.length / 2);
    });

    it("should estimate tokens for mixed text", () => {
      const mixedText = "这是中文 and this is English 混合文本";
      const tokens = estimateTokens(mixedText);

      // 混合约 2.5 字符/token
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(mixedText.length);
    });
  });

  // ===========================================================================
  // isEmptyMemoryContext 测试
  // ===========================================================================

  describe("isEmptyMemoryContext", () => {
    it("should return true for undefined", () => {
      expect(isEmptyMemoryContext(undefined)).toBe(true);
    });

    it("should return true for empty context", () => {
      const emptyContext: EpisodicMemoryContext = {
        recentSummaries: [],
        pendingIntents: [],
        preferences: null,
      };
      expect(isEmptyMemoryContext(emptyContext)).toBe(true);
    });

    it("should return false if has recent summaries", () => {
      const context: EpisodicMemoryContext = {
        recentSummaries: [{ summary: "test", intents: [], timeAgo: "1h" }],
        pendingIntents: [],
        preferences: null,
      };
      expect(isEmptyMemoryContext(context)).toBe(false);
    });

    it("should return false if has pending intents", () => {
      const context: EpisodicMemoryContext = {
        recentSummaries: [],
        pendingIntents: ["test intent"],
        preferences: null,
      };
      expect(isEmptyMemoryContext(context)).toBe(false);
    });

    it("should return false if has preferences", () => {
      const context: EpisodicMemoryContext = {
        recentSummaries: [],
        pendingIntents: [],
        preferences: {
          positiveRate: 0.8,
          commonActions: [],
          totalInteractions: 10,
          positiveCount: 8,
          negativeCount: 2,
        },
      };
      expect(isEmptyMemoryContext(context)).toBe(false);
    });
  });
});
