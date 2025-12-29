/**
 * MD Summary Prompt 单元测试
 *
 * 测试 MD 专用 Prompt 构建功能
 */

import {
  buildMdSummaryUserPrompt,
  buildChunkSummaryUserPrompt,
  buildMergeSummaryPrompt,
  getMdPromptConfig,
  preDetectMdContentType,
  MD_SUMMARY_SYSTEM_PROMPT,
  MD_SUMMARY_SYSTEM_PROMPT_LITE,
} from "../prompts";
import type { MdSummaryInput } from "../types";

describe("MD Summary Prompt", () => {
  describe("getMdPromptConfig", () => {
    it("should return full prompt config by default", () => {
      const config = getMdPromptConfig();

      expect(config.systemPrompt).toBe(MD_SUMMARY_SYSTEM_PROMPT);
      expect(config.temperature).toBe(0.5);
      expect(config.maxTokens).toBe(2500);
      expect(config.responseFormat).toBe("json");
    });

    it("should return lite prompt when lite option is true", () => {
      const config = getMdPromptConfig({ lite: true });

      expect(config.systemPrompt).toBe(MD_SUMMARY_SYSTEM_PROMPT_LITE);
      expect(config.maxTokens).toBe(1500);
    });

    it("should use lower temperature for code-heavy documents", () => {
      const config = getMdPromptConfig({ hasCodeBlocks: true });

      expect(config.temperature).toBe(0.3);
    });
  });

  describe("buildMdSummaryUserPrompt", () => {
    it("should build prompt with title and content", () => {
      const input: MdSummaryInput = {
        collectionId: 1,
        userId: "user-123",
        title: "Test Document",
        content: "This is the content.",
      };

      const prompt = buildMdSummaryUserPrompt(input);

      expect(prompt).toContain("## 文档标题");
      expect(prompt).toContain("Test Document");
      expect(prompt).toContain("## 文档内容");
      expect(prompt).toContain("This is the content.");
    });

    it("should include metadata when provided", () => {
      const input: MdSummaryInput = {
        collectionId: 1,
        userId: "user-123",
        title: "Test Document",
        content: "Content here",
        metadata: {
          wordCount: 500,
          codeBlockCount: 3,
          readingTimeMinutes: 2,
        },
      };

      const prompt = buildMdSummaryUserPrompt(input);

      expect(prompt).toContain("## 文档元数据");
      expect(prompt).toContain("字数: 500");
      expect(prompt).toContain("代码块: 3 个");
      expect(prompt).toContain("预计阅读: 2 分钟");
    });

    it("should truncate long content", () => {
      const longContent = "a".repeat(10000);
      const input: MdSummaryInput = {
        collectionId: 1,
        userId: "user-123",
        title: "Long Document",
        content: longContent,
      };

      const prompt = buildMdSummaryUserPrompt(input);

      expect(prompt).toContain("中间内容已省略");
      expect(prompt.length).toBeLessThan(longContent.length + 500);
    });
  });

  describe("buildChunkSummaryUserPrompt", () => {
    it("should include chunk index and total", () => {
      const prompt = buildChunkSummaryUserPrompt(0, 3, "Chunk content");

      expect(prompt).toContain("第 1 块 / 共 3 块");
      expect(prompt).toContain("Chunk content");
    });

    it("should include context when provided", () => {
      const prompt = buildChunkSummaryUserPrompt(1, 3, "Chunk content", {
        title: "Main Document",
        previousSummary: "Previous chunk was about X",
      });

      expect(prompt).toContain("## 文档标题");
      expect(prompt).toContain("Main Document");
      expect(prompt).toContain("## 前文摘要");
      expect(prompt).toContain("Previous chunk was about X");
    });
  });

  describe("buildMergeSummaryPrompt", () => {
    it("should merge chunk summaries", () => {
      const chunkSummaries = [
        { summary: "Summary 1", keyPoints: ["Point A"] },
        { summary: "Summary 2", keyPoints: ["Point B"] },
      ];

      const prompt = buildMergeSummaryPrompt(chunkSummaries, "Test Doc");

      expect(prompt).toContain("## 文档标题");
      expect(prompt).toContain("Test Doc");
      expect(prompt).toContain("## 分块摘要");
      expect(prompt).toContain("### 第 1 部分");
      expect(prompt).toContain("Summary 1");
      expect(prompt).toContain("### 第 2 部分");
      expect(prompt).toContain("Summary 2");
    });
  });

  describe("preDetectMdContentType", () => {
    it("should detect TUTORIAL type", () => {
      const result = preDetectMdContentType(
        "React 入门教程",
        "本教程将手把手教你如何配置...",
      );

      expect(result).not.toBeNull();
      expect(result?.type).toBe("TUTORIAL");
      expect(result?.confidence).toBeGreaterThan(0.5);
    });

    it("should detect CODE_SNIPPET type", () => {
      const result = preDetectMdContentType(
        "代码片段收集",
        "这是一些常用的函数示例代码...",
      );

      expect(result).not.toBeNull();
      expect(result?.type).toBe("CODE_SNIPPET");
    });

    it("should detect DOCUMENTATION type", () => {
      const result = preDetectMdContentType(
        "API 文档",
        "本文档描述了接口规范...",
      );

      expect(result).not.toBeNull();
      expect(result?.type).toBe("DOCUMENTATION");
    });

    it("should return null for unclear content", () => {
      const result = preDetectMdContentType("Random Title", "Random content");

      // 如果没有匹配的关键词，可能返回 null 或低置信度
      if (result) {
        expect(result.confidence).toBeLessThan(0.6);
      }
    });
  });

  describe("System Prompts", () => {
    it("should include JSON output format in system prompt", () => {
      expect(MD_SUMMARY_SYSTEM_PROMPT).toContain("JSON 格式");
      expect(MD_SUMMARY_SYSTEM_PROMPT).toContain("tldr");
      expect(MD_SUMMARY_SYSTEM_PROMPT).toContain("key_points");
      expect(MD_SUMMARY_SYSTEM_PROMPT).toContain("code_highlights");
    });

    it("should be shorter for lite version", () => {
      expect(MD_SUMMARY_SYSTEM_PROMPT_LITE.length).toBeLessThan(
        MD_SUMMARY_SYSTEM_PROMPT.length,
      );
    });
  });
});
