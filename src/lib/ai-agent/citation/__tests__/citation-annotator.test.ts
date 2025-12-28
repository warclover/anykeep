/**
 * 引用标注器测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { CitationAnnotator, getCitationAnnotator } from "../citation-annotator";
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
  },
];

// ============================================================================
// 测试套件
// ============================================================================

describe("CitationAnnotator", () => {
  let annotator: CitationAnnotator;

  beforeEach(() => {
    annotator = new CitationAnnotator();
  });

  describe("detectOrdinals", () => {
    it("应检测中文序数词（第一、第二）", () => {
      const text = "根据第一篇文章和第二条收藏";
      const ordinals = annotator.detectOrdinals(text);

      expect(ordinals.length).toBe(2);
      expect(ordinals).toContain(1);
      expect(ordinals).toContain(2);
    });

    it("应检测阿拉伯数字序数词（第1篇）", () => {
      const text = "第1篇介绍了基础概念，第2篇深入探讨";
      const ordinals = annotator.detectOrdinals(text);

      expect(ordinals.length).toBe(2);
      expect(ordinals).toContain(1);
      expect(ordinals).toContain(2);
    });

    it("应检测带量词的序数词（第三条、第四个）", () => {
      const text = "第三条收藏很有用，第四个书签也不错";
      const ordinals = annotator.detectOrdinals(text);

      expect(ordinals.length).toBe(2);
      expect(ordinals).toContain(3);
      expect(ordinals).toContain(4);
    });

    it("应处理没有序数词的文本", () => {
      const text = "这是一段普通的文本";
      const ordinals = annotator.detectOrdinals(text);

      expect(ordinals.length).toBe(0);
    });

    it("应返回排序后的序数列表", () => {
      const text = "先看第三篇，再看第一篇";
      const ordinals = annotator.detectOrdinals(text);

      // 应该按顺序排列
      expect(ordinals).toEqual([1, 3]);
    });
  });

  describe("annotate", () => {
    it("应在序数词后插入引用标注", () => {
      const text = "根据第一篇文章，React 18 引入了并发特性。";
      const result = annotator.annotate(text, mockCitations);

      expect(result.annotatedText).toContain("第一篇[^1]");
      expect(result.usedCitations.length).toBe(1);
      expect(result.usedCitations[0]).toBe(1);
    });

    it("应处理多个序数引用", () => {
      const text = "第一篇介绍了 React，第二篇讲解了 Vue。";
      const result = annotator.annotate(text, mockCitations);

      expect(result.annotatedText).toContain("第一篇[^1]");
      expect(result.annotatedText).toContain("第二篇[^2]");
      expect(result.usedCitations.length).toBe(2);
    });

    it("应忽略超出范围的序数引用", () => {
      const text = "第一篇和第十篇都很好。";
      const result = annotator.annotate(text, mockCitations);

      // 只有第一篇应该被标注
      expect(result.annotatedText).toContain("第一篇[^1]");
      expect(result.annotatedText).toContain("第十篇"); // 保持原样
      expect(result.annotatedText).not.toContain("[^10]");
      expect(result.usedCitations.length).toBe(1);
    });

    it("应避免重复标注已有的引用", () => {
      const text = "根据第一篇[^1]文章";
      const result = annotator.annotate(text, mockCitations);

      // 不应该变成 [^1][^1]
      expect(result.annotatedText).toBe("根据第一篇[^1]文章");
      expect(result.usedCitations.length).toBe(0); // 已有标注不计入新增
    });

    it("应处理空文本", () => {
      const result = annotator.annotate("", mockCitations);

      expect(result.annotatedText).toBe("");
      expect(result.usedCitations.length).toBe(0);
    });

    it("应处理空引用列表", () => {
      const text = "第一篇文章提到";
      const result = annotator.annotate(text, []);

      expect(result.annotatedText).toBe(text);
      expect(result.usedCitations.length).toBe(0);
    });
  });

  describe("extractExistingCitations", () => {
    it("应提取已有的 [^N] 格式引用", () => {
      const text = "这是引用[^1]和另一个引用[^3]";
      const citations = annotator.extractExistingCitations(text);

      expect(citations).toContain(1);
      expect(citations).toContain(3);
      expect(citations.length).toBe(2);
    });

    it("应处理没有引用的文本", () => {
      const text = "这是普通文本";
      const citations = annotator.extractExistingCitations(text);

      expect(citations.length).toBe(0);
    });

    it("应处理连续引用", () => {
      const text = "综合[^1][^2][^3]三篇文章";
      const citations = annotator.extractExistingCitations(text);

      expect(citations).toEqual([1, 2, 3]);
    });

    it("应去重重复引用", () => {
      const text = "引用[^1]再次引用[^1]";
      const citations = annotator.extractExistingCitations(text);

      expect(citations).toEqual([1]);
    });
  });

  describe("复杂场景", () => {
    it("应正确处理混合中英文文本", () => {
      const text =
        "第一篇讲解了 React Hooks，第二篇是 Vue Composition API 入门。";
      const result = annotator.annotate(text, mockCitations);

      expect(result.annotatedText).toContain("第一篇[^1]");
      expect(result.annotatedText).toContain("第二篇[^2]");
    });

    it("应处理同一引用多次出现", () => {
      const text = "第一篇很好，我再看看第一篇的内容。";
      const result = annotator.annotate(text, mockCitations);

      // 两处都应该标注
      const matches = result.annotatedText.match(/\[\^1\]/g);
      expect(matches?.length).toBe(2);
    });

    it("应保持原文其他内容不变", () => {
      const text = "Hello! 第一篇文章提到了重要概念。这是普通文本。";
      const result = annotator.annotate(text, mockCitations);

      expect(result.annotatedText).toContain("Hello!");
      expect(result.annotatedText).toContain("这是普通文本。");
    });
  });
});

// ============================================================================
// 单例测试
// ============================================================================

describe("getCitationAnnotator", () => {
  it("应返回全局单例", () => {
    const annotator1 = getCitationAnnotator();
    const annotator2 = getCitationAnnotator();

    expect(annotator1).toBe(annotator2);
  });
});
