/**
 * 引用增强器测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import {
  CitationEnricher,
  getCitationEnricher,
  resetCitationEnricher,
} from "../citation-enricher";
import { resetCitationIndexer } from "../citation-indexer";
import type { SearchResultItem } from "../types";

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

const mockSearchResults: SearchResultItem[] = [
  {
    bookmarkId: 101,
    title: "React 18 新特性详解",
    url: "https://example.com/react18",
    summary: "介绍 React 18 的并发特性",
    platform: "wechat",
    score: 0.95,
  },
  {
    bookmarkId: 102,
    title: "Vue 3 组合式 API 指南",
    url: "https://example.com/vue3",
    summary: "Vue 3 Composition API 最佳实践",
    platform: "zhihu",
    score: 0.88,
  },
  {
    bookmarkId: 103,
    title: "TypeScript 高级类型技巧",
    url: "https://example.com/ts",
    summary: "TypeScript 类型体操入门",
    platform: "bilibili",
    score: 0.82,
  },
];

// ============================================================================
// 测试套件
// ============================================================================

describe("CitationEnricher", () => {
  let enricher: CitationEnricher;

  beforeEach(() => {
    resetCitationEnricher();
    resetCitationIndexer();
    enricher = new CitationEnricher();
  });

  describe("processSearchResults", () => {
    it("应处理搜索结果并返回引用块数据", () => {
      const conversationId = "conv-1";
      const result = enricher.processSearchResults(
        conversationId,
        mockSearchResults,
        "React Vue",
      );

      expect(result.indexed).toBe(true);
      expect(result.totalCitations).toBe(3);
      expect(result.citationSummary.length).toBe(3);
      expect(result.query).toBe("React Vue");
    });

    it("应正确生成引用摘要", () => {
      const conversationId = "conv-2";
      const result = enricher.processSearchResults(
        conversationId,
        mockSearchResults,
      );

      expect(result.citationSummary[0]).toEqual({
        index: 1,
        title: "React 18 新特性详解",
        bookmarkId: 101,
      });
    });

    it("应过滤低置信度结果", () => {
      const conversationId = "conv-3";
      const lowScoreResults: SearchResultItem[] = [
        ...mockSearchResults,
        {
          bookmarkId: 104,
          title: "低相关性文章",
          url: "https://example.com/low",
          score: 0.1, // 低于默认阈值 0.3
        },
      ];

      const result = enricher.processSearchResults(
        conversationId,
        lowScoreResults,
      );

      // 低分结果应被过滤
      expect(result.totalCitations).toBe(3);
    });

    it("应处理空结果", () => {
      const conversationId = "conv-4";
      const result = enricher.processSearchResults(conversationId, []);

      expect(result.indexed).toBe(true);
      expect(result.totalCitations).toBe(0);
      expect(result.citationSummary.length).toBe(0);
    });
  });

  describe("enrichResponse", () => {
    it("应增强包含序数引用的响应文本", () => {
      const conversationId = "conv-5";
      enricher.processSearchResults(conversationId, mockSearchResults);

      const text = "根据第一篇文章，React 18 引入了并发特性。";
      const result = enricher.enrichResponse(text, conversationId);

      expect(result.hasCitations).toBe(true);
      expect(result.enrichedText).toContain("[^1]");
      expect(result.citations.length).toBeGreaterThan(0);
    });

    it("应追加引用列表", () => {
      const conversationId = "conv-6";
      enricher.processSearchResults(conversationId, mockSearchResults);

      const text = "第一篇介绍了 React，第二篇讲解了 Vue。";
      const result = enricher.enrichResponse(text, conversationId);

      expect(result.enrichedText).toContain("参考来源");
      expect(result.enrichedText).toContain("[React 18 新特性详解]");
    });

    it("应返回正确的统计信息", () => {
      const conversationId = "conv-7";
      enricher.processSearchResults(conversationId, mockSearchResults);

      const text = "第一篇和第二篇都很有用。";
      const result = enricher.enrichResponse(text, conversationId);

      expect(result.stats.total).toBe(2);
      expect(result.stats.inlineCount).toBeGreaterThanOrEqual(0);
      expect(result.stats.listCount).toBeGreaterThanOrEqual(0);
    });

    it("对没有引用的会话应返回原文", () => {
      const conversationId = "conv-8";
      const text = "这是普通文本";
      const result = enricher.enrichResponse(text, conversationId);

      expect(result.hasCitations).toBe(false);
      expect(result.enrichedText).toBe(text);
      expect(result.citations.length).toBe(0);
    });

    it("对没有序数引用的文本应返回原文", () => {
      const conversationId = "conv-9";
      enricher.processSearchResults(conversationId, mockSearchResults);

      const text = "这是没有引用任何文章的普通文本。";
      const result = enricher.enrichResponse(text, conversationId);

      // 没有使用任何引用，所以不追加引用列表
      expect(result.hasCitations).toBe(false);
    });
  });

  describe("hasCitations", () => {
    it("有引用时应返回 true", () => {
      const conversationId = "conv-10";
      enricher.processSearchResults(conversationId, mockSearchResults);

      expect(enricher.hasCitations(conversationId)).toBe(true);
    });

    it("无引用时应返回 false", () => {
      expect(enricher.hasCitations("non-existent")).toBe(false);
    });
  });

  describe("getCitations", () => {
    it("应返回会话的所有引用", () => {
      const conversationId = "conv-11";
      enricher.processSearchResults(conversationId, mockSearchResults);

      const citations = enricher.getCitations(conversationId);
      expect(citations.length).toBe(3);
    });
  });

  describe("getCitationByIndex", () => {
    it("应根据编号获取引用", () => {
      const conversationId = "conv-12";
      enricher.processSearchResults(conversationId, mockSearchResults);

      const citation = enricher.getCitationByIndex(conversationId, 2);
      expect(citation).not.toBeNull();
      expect(citation!.bookmarkId).toBe(102);
    });

    it("对无效编号应返回 null", () => {
      const conversationId = "conv-13";
      enricher.processSearchResults(conversationId, mockSearchResults);

      expect(enricher.getCitationByIndex(conversationId, 10)).toBeNull();
    });
  });

  describe("clearCitations", () => {
    it("应清除会话的引用", () => {
      const conversationId = "conv-14";
      enricher.processSearchResults(conversationId, mockSearchResults);

      expect(enricher.hasCitations(conversationId)).toBe(true);

      enricher.clearCitations(conversationId);

      expect(enricher.hasCitations(conversationId)).toBe(false);
    });
  });

  describe("配置", () => {
    it("应支持更新配置", () => {
      const enricher = new CitationEnricher({
        autoAnnotate: false,
      });

      enricher.updateConfig({ appendReferences: false });

      const config = enricher.getConfig();
      expect(config.autoAnnotate).toBe(false);
      expect(config.appendReferences).toBe(false);
    });

    it("应使用自定义引用列表标题", () => {
      const enricher = new CitationEnricher({
        referencesTitle: "引用文献",
      });

      const conversationId = "conv-15";
      enricher.processSearchResults(conversationId, mockSearchResults);

      const text = "第一篇文章很好。";
      const result = enricher.enrichResponse(text, conversationId);

      expect(result.enrichedText).toContain("引用文献");
    });
  });
});

// ============================================================================
// 单例测试
// ============================================================================

describe("getCitationEnricher", () => {
  beforeEach(() => {
    resetCitationEnricher();
    resetCitationIndexer();
  });

  it("应返回全局单例", () => {
    const enricher1 = getCitationEnricher();
    const enricher2 = getCitationEnricher();

    expect(enricher1).toBe(enricher2);
  });

  it("resetCitationEnricher 应重置单例", () => {
    const enricher1 = getCitationEnricher();
    enricher1.processSearchResults("test", mockSearchResults);

    resetCitationEnricher();
    resetCitationIndexer();

    const enricher2 = getCitationEnricher();
    expect(enricher2.hasCitations("test")).toBe(false);
  });
});

// ============================================================================
// 集成测试
// ============================================================================

describe("CitationEnricher 集成测试", () => {
  beforeEach(() => {
    resetCitationEnricher();
    resetCitationIndexer();
  });

  it("应完成完整的引用追踪流程", () => {
    const enricher = new CitationEnricher();
    const conversationId = "integration-test";

    // 1. 处理搜索结果
    const citationData = enricher.processSearchResults(
      conversationId,
      mockSearchResults,
      "React",
    );

    expect(citationData.indexed).toBe(true);
    expect(citationData.totalCitations).toBe(3);

    // 2. 增强 AI 响应
    const aiResponse = `找到 3 条关于 React 的收藏：

1. 第一篇介绍了 React 18 的新特性
2. 第二篇是 Vue 3 组合式 API 指南
3. 第三篇讲解了 TypeScript 类型技巧

综合来看，第一篇对理解 React 18 最有帮助。`;

    const result = enricher.enrichResponse(aiResponse, conversationId);

    // 3. 验证结果
    expect(result.hasCitations).toBe(true);
    expect(result.enrichedText).toContain("[^1]");
    expect(result.enrichedText).toContain("[^2]");
    expect(result.enrichedText).toContain("[^3]");
    expect(result.enrichedText).toContain("参考来源");
    expect(result.stats.total).toBeGreaterThan(0);
  });
});
