/**
 * MD Content Chunker 单元测试
 *
 * 测试长文档分块功能
 */

import {
  needsChunking,
  chunkContent,
  mergeSummaries,
  MdContentChunker,
} from "../md-content-chunker";
import type { ChunkSummary } from "../types";

describe("MdContentChunker", () => {
  describe("needsChunking", () => {
    it("should return false for short content", () => {
      const content = "Short content";
      expect(needsChunking(content)).toBe(false);
    });

    it("should return true for content exceeding default threshold", () => {
      const content = "a".repeat(6000);
      expect(needsChunking(content)).toBe(true);
    });

    it("should respect custom threshold", () => {
      const content = "a".repeat(1000);
      expect(needsChunking(content, 500)).toBe(true);
      expect(needsChunking(content, 2000)).toBe(false);
    });
  });

  describe("chunkContent", () => {
    it("should not chunk short content", () => {
      const content = "# Title\n\nShort paragraph.";
      const result = chunkContent(content);

      expect(result.wasChunked).toBe(false);
      expect(result.chunks.length).toBe(1);
      expect(result.strategy).toBe("none");
    });

    it("should chunk long content by headings", () => {
      const content = `# Section 1
${"Lorem ipsum ".repeat(500)}

# Section 2
${"Dolor sit amet ".repeat(500)}

# Section 3
${"Consectetur adipiscing ".repeat(500)}`;

      const result = chunkContent(content, {
        maxChars: 5000,
        splitByHeading: true,
      });

      expect(result.wasChunked).toBe(true);
      expect(result.chunks.length).toBeGreaterThan(1);
      expect(result.strategy).toBe("heading");
    });

    it("should preserve code blocks", () => {
      const codeBlock =
        "```javascript\nconst foo = 'bar';\nconsole.log(foo);\n```";
      const content = `# Title

${codeBlock}

Some text after code.

${"More content ".repeat(500)}`;

      const result = chunkContent(content, {
        maxChars: 500,
        preserveCodeBlocks: true,
      });

      // 代码块应该完整保留在某个分块中
      const hasCompleteCodeBlock = result.chunks.some((chunk) =>
        chunk.content.includes(codeBlock),
      );
      expect(hasCompleteCodeBlock).toBe(true);
    });

    it("should handle empty content", () => {
      const result = chunkContent("");
      expect(result.chunks.length).toBe(1);
      expect(result.chunks[0].content).toBe("");
    });
  });

  describe("mergeSummaries", () => {
    it("should return empty for no summaries", () => {
      const result = mergeSummaries([]);

      expect(result.summary).toBe("");
      expect(result.keyPoints).toEqual([]);
      expect(result.keywords).toEqual([]);
    });

    it("should return single summary unchanged", () => {
      const summaries: ChunkSummary[] = [
        {
          chunkIndex: 0,
          summary: "This is a summary",
          keyPoints: ["Point 1", "Point 2"],
          keywords: ["keyword1", "keyword2"],
        },
      ];

      const result = mergeSummaries(summaries);

      expect(result.summary).toBe("This is a summary");
      expect(result.keyPoints).toEqual(["Point 1", "Point 2"]);
      expect(result.keywords).toEqual(["keyword1", "keyword2"]);
    });

    it("should merge multiple summaries", () => {
      const summaries: ChunkSummary[] = [
        {
          chunkIndex: 0,
          summary: "First part summary",
          keyPoints: ["Point A", "Point B"],
          keywords: ["react", "typescript"],
        },
        {
          chunkIndex: 1,
          summary: "Second part summary",
          keyPoints: ["Point C", "Point A"], // Point A is duplicate
          keywords: ["react", "nodejs"], // react is duplicate
        },
      ];

      const result = mergeSummaries(summaries);

      // 摘要应该合并
      expect(result.summary).toContain("First part summary");
      expect(result.summary).toContain("Second part summary");

      // 要点应该去重
      expect(result.keyPoints).toContain("Point A");
      expect(result.keyPoints).toContain("Point B");
      expect(result.keyPoints).toContain("Point C");

      // 关键词应该去重，且按频率排序
      expect(result.keywords[0]).toBe("react"); // 出现2次
    });
  });

  describe("MdContentChunker object", () => {
    it("should export all functions", () => {
      expect(MdContentChunker.needsChunking).toBeDefined();
      expect(MdContentChunker.chunkContent).toBeDefined();
      expect(MdContentChunker.mergeSummaries).toBeDefined();
    });
  });
});
