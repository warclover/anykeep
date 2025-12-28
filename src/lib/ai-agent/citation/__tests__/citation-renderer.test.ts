/**
 * 引用渲染器测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { CitationRenderer, getCitationRenderer } from "../citation-renderer";
import type { Citation } from "../types";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ============================================================================
// 测试数据
// ============================================================================

const mockCitations: Citation[] = [
  {
    index: 1,
    bookmarkId: 101,
    title: "React 18 新特性详解",
    url: "https://example.com/react18",
    platform: "wechat",
    summary: "介绍 React 18 的并发特性",
  },
  {
    index: 2,
    bookmarkId: 102,
    title: "Vue 3 组合式 API 指南",
    url: "https://example.com/vue3",
    platform: "zhihu",
  },
  {
    index: 3,
    bookmarkId: 103,
    title: "TypeScript 高级类型技巧",
    url: "https://example.com/ts",
    platform: "bilibili",
    summary: "TypeScript 类型体操入门",
  },
];

// ============================================================================
// 测试套件
// ============================================================================

describe("CitationRenderer", () => {
  let renderer: CitationRenderer;

  beforeEach(() => {
    renderer = new CitationRenderer();
  });

  describe("renderReferences - Markdown 格式", () => {
    it("应生成正确的 Markdown 引用列表", () => {
      const result = renderer.renderReferences(mockCitations);

      expect(result.count).toBe(3);
      expect(result.content).toContain("**参考来源**");
      expect(result.content).toContain("[^1]:");
      // Markdown escapes brackets in title
      expect(result.content).toContain("React 18 新特性详解");
      expect(result.content).toContain("https://example.com/react18");
    });

    it("应正确渲染所有引用", () => {
      const result = renderer.renderReferences(mockCitations);

      expect(result.content).toContain("[^1]:");
      expect(result.content).toContain("[^2]:");
      expect(result.content).toContain("[^3]:");
    });

    it("应支持自定义标题", () => {
      const result = renderer.renderReferences(mockCitations, {
        title: "引用文献",
      });

      expect(result.content).toContain("**引用文献**");
    });

    it("应支持显示平台信息", () => {
      const result = renderer.renderReferences(mockCitations, {
        showPlatform: true,
      });

      expect(result.content).toContain("wechat");
      expect(result.content).toContain("zhihu");
    });

    it("应支持显示摘要", () => {
      const result = renderer.renderReferences(mockCitations, {
        showSummary: true,
      });

      expect(result.content).toContain("介绍 React 18 的并发特性");
      expect(result.content).toContain("TypeScript 类型体操入门");
    });

    it("应处理空引用列表", () => {
      const result = renderer.renderReferences([]);

      expect(result.content).toBe("");
      expect(result.count).toBe(0);
    });
  });

  describe("renderReferences - HTML 格式", () => {
    it("应生成正确的 HTML 引用列表", () => {
      const result = renderer.renderReferences(mockCitations, {
        format: "html",
      });

      // HTML format uses <hr>, <h4>, <ol>, <li>, <a> tags
      expect(result.content).toContain("<hr>");
      expect(result.content).toContain("<h4>");
      expect(result.content).toContain("<a href=");
    });

    it("应包含正确的链接", () => {
      const result = renderer.renderReferences(mockCitations, {
        format: "html",
      });

      expect(result.content).toContain('href="https://example.com/react18"');
      expect(result.content).toContain('target="_blank"');
    });
  });

  describe("renderReferences - Plain 格式", () => {
    it("应生成纯文本引用列表", () => {
      const result = renderer.renderReferences(mockCitations, {
        format: "plain",
      });

      expect(result.count).toBe(3);
      expect(result.content).toContain("[1] React 18 新特性详解");
      expect(result.content).toContain("https://example.com/react18");
    });

    it("应每行一个引用", () => {
      const result = renderer.renderReferences(mockCitations, {
        format: "plain",
      });

      const lines = result.content.split("\n").filter((l) => l.trim());
      expect(lines.length).toBeGreaterThanOrEqual(4); // 标题 + 3 个引用
    });
  });

  describe("renderSingleCitation", () => {
    it("应渲染单个引用", () => {
      const citation = mockCitations[0];
      const result = renderer.renderSingleCitation(citation);

      expect(result).toContain("[^1]:");
      // Title is markdown-escaped
      expect(result).toContain("React 18 新特性详解");
      expect(result).toContain("https://example.com/react18");
    });

    it("应支持 HTML 格式", () => {
      const citation = mockCitations[0];
      // renderSingleCitation takes format as 2nd positional param (string)
      const result = renderer.renderSingleCitation(citation, "html");

      expect(result).toContain("<a href=");
      expect(result).toContain("React 18 新特性详解");
    });
  });

  describe("边界情况", () => {
    it("应处理特殊字符的标题", () => {
      const citations: Citation[] = [
        {
          index: 1,
          bookmarkId: 1,
          title: "Title with [brackets] and (parens)",
          url: "https://example.com",
        },
      ];

      const result = renderer.renderReferences(citations);

      // Markdown escapes brackets and parens: \[ \] \( \)
      expect(result.content).toContain(
        "Title with \\[brackets\\] and \\(parens\\)",
      );
    });

    it("应处理空 URL", () => {
      const citations: Citation[] = [
        {
          index: 1,
          bookmarkId: 1,
          title: "No URL Article",
          url: "",
        },
      ];

      const result = renderer.renderReferences(citations);

      expect(result.content).toContain("No URL Article");
    });

    it("应处理非常长的标题", () => {
      const longTitle = "A".repeat(200);
      const citations: Citation[] = [
        {
          index: 1,
          bookmarkId: 1,
          title: longTitle,
          url: "https://example.com",
        },
      ];

      const result = renderer.renderReferences(citations);

      // 应该包含完整标题（或截断后的标题）
      expect(result.content.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// 单例测试
// ============================================================================

describe("getCitationRenderer", () => {
  it("应返回全局单例", () => {
    const renderer1 = getCitationRenderer();
    const renderer2 = getCitationRenderer();

    expect(renderer1).toBe(renderer2);
  });
});
