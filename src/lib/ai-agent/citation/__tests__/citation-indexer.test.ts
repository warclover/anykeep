/**
 * 引用索引器测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import {
  CitationIndexer,
  getCitationIndexer,
  resetCitationIndexer,
} from "../citation-indexer";
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

describe("CitationIndexer", () => {
  let indexer: CitationIndexer;

  beforeEach(() => {
    resetCitationIndexer();
    indexer = new CitationIndexer();
  });

  describe("indexSearchResults", () => {
    it("应正确索引搜索结果", () => {
      const conversationId = "conv-1";
      const index = indexer.indexSearchResults(
        conversationId,
        mockSearchResults,
        "React Vue",
      );

      expect(index.conversationId).toBe(conversationId);
      expect(index.citations.size).toBe(3);
      expect(index.nextIndex).toBe(4);
    });

    it("应为每个结果分配递增的引用编号", () => {
      const conversationId = "conv-2";
      indexer.indexSearchResults(conversationId, mockSearchResults);

      const citations = indexer.getAllCitations(conversationId);
      expect(citations[0].index).toBe(1);
      expect(citations[1].index).toBe(2);
      expect(citations[2].index).toBe(3);
    });

    it("应正确保存书签信息", () => {
      const conversationId = "conv-3";
      indexer.indexSearchResults(conversationId, mockSearchResults);

      const citation = indexer.getCitationByIndex(conversationId, 1);
      expect(citation).not.toBeNull();
      expect(citation!.bookmarkId).toBe(101);
      expect(citation!.title).toBe("React 18 新特性详解");
      expect(citation!.url).toBe("https://example.com/react18");
      expect(citation!.platform).toBe("wechat");
    });

    it("应支持增量添加引用", () => {
      const conversationId = "conv-4";

      // 第一次添加
      indexer.indexSearchResults(conversationId, mockSearchResults.slice(0, 2));
      expect(indexer.getAllCitations(conversationId).length).toBe(2);

      // 第二次添加
      indexer.indexSearchResults(conversationId, mockSearchResults.slice(2));

      // 应该有 3 个引用，编号连续
      const citations = indexer.getAllCitations(conversationId);
      expect(citations.length).toBe(3);
      expect(citations[2].index).toBe(3);
    });

    it("应避免重复索引相同的书签", () => {
      const conversationId = "conv-5";

      // 添加相同的结果两次
      indexer.indexSearchResults(conversationId, mockSearchResults);
      indexer.indexSearchResults(conversationId, mockSearchResults);

      // 应该仍然只有 3 个引用
      expect(indexer.getAllCitations(conversationId).length).toBe(3);
    });
  });

  describe("getCitation", () => {
    it("应根据书签 ID 获取引用", () => {
      const conversationId = "conv-6";
      indexer.indexSearchResults(conversationId, mockSearchResults);

      const citation = indexer.getCitation(conversationId, 102);
      expect(citation).not.toBeNull();
      expect(citation!.title).toBe("Vue 3 组合式 API 指南");
    });

    it("对不存在的书签应返回 null", () => {
      const conversationId = "conv-7";
      indexer.indexSearchResults(conversationId, mockSearchResults);

      const citation = indexer.getCitation(conversationId, 999);
      expect(citation).toBeNull();
    });

    it("对不存在的会话应返回 null", () => {
      const citation = indexer.getCitation("non-existent", 101);
      expect(citation).toBeNull();
    });
  });

  describe("getCitationByIndex", () => {
    it("应根据引用编号获取引用", () => {
      const conversationId = "conv-8";
      indexer.indexSearchResults(conversationId, mockSearchResults);

      const citation = indexer.getCitationByIndex(conversationId, 2);
      expect(citation).not.toBeNull();
      expect(citation!.bookmarkId).toBe(102);
    });

    it("对无效编号应返回 null", () => {
      const conversationId = "conv-9";
      indexer.indexSearchResults(conversationId, mockSearchResults);

      expect(indexer.getCitationByIndex(conversationId, 0)).toBeNull();
      expect(indexer.getCitationByIndex(conversationId, 10)).toBeNull();
    });
  });

  describe("getCitationRange", () => {
    it("应返回指定范围内的引用", () => {
      const conversationId = "conv-10";
      indexer.indexSearchResults(conversationId, mockSearchResults);

      const range = indexer.getCitationRange(conversationId, 1, 2);
      expect(range.length).toBe(2);
      expect(range[0].index).toBe(1);
      expect(range[1].index).toBe(2);
    });

    it("应处理超出范围的请求", () => {
      const conversationId = "conv-11";
      indexer.indexSearchResults(conversationId, mockSearchResults);

      const range = indexer.getCitationRange(conversationId, 1, 10);
      expect(range.length).toBe(3); // 只有 3 个引用
    });
  });

  describe("hasCitations", () => {
    it("有引用时应返回 true", () => {
      const conversationId = "conv-12";
      indexer.indexSearchResults(conversationId, mockSearchResults);

      expect(indexer.hasCitations(conversationId)).toBe(true);
    });

    it("无引用时应返回 false", () => {
      expect(indexer.hasCitations("non-existent")).toBe(false);
    });

    it("空结果时应返回 false", () => {
      const conversationId = "conv-13";
      indexer.indexSearchResults(conversationId, []);

      expect(indexer.hasCitations(conversationId)).toBe(false);
    });
  });

  describe("clearConversation", () => {
    it("应清除指定会话的引用", () => {
      const conversationId = "conv-14";
      indexer.indexSearchResults(conversationId, mockSearchResults);

      expect(indexer.hasCitations(conversationId)).toBe(true);

      indexer.clearConversation(conversationId);

      expect(indexer.hasCitations(conversationId)).toBe(false);
    });

    it("清除不存在的会话不应报错", () => {
      expect(() => indexer.clearConversation("non-existent")).not.toThrow();
    });
  });

  describe("cleanupExpired", () => {
    it("应清理过期的索引", async () => {
      // 创建一个过期时间很短的索引器
      const shortLivedIndexer = new CitationIndexer(100); // 100ms 过期
      shortLivedIndexer.indexSearchResults("conv-a", mockSearchResults);

      // 等待过期
      await new Promise((resolve) => setTimeout(resolve, 150));

      const cleanedCount = shortLivedIndexer.cleanupExpired();
      expect(cleanedCount).toBe(1);
      expect(shortLivedIndexer.hasCitations("conv-a")).toBe(false);
    });

    it("不应清理未过期的索引", () => {
      const longLivedIndexer = new CitationIndexer(10000); // 10s 过期
      longLivedIndexer.indexSearchResults("conv-b", mockSearchResults);

      const cleanedCount = longLivedIndexer.cleanupExpired();
      expect(cleanedCount).toBe(0);
      expect(longLivedIndexer.hasCitations("conv-b")).toBe(true);
    });
  });

  describe("getStats", () => {
    it("应返回正确的统计信息", () => {
      indexer.indexSearchResults("conv-a", mockSearchResults);
      indexer.indexSearchResults("conv-b", mockSearchResults.slice(0, 2));

      const stats = indexer.getStats();
      expect(stats.conversationCount).toBe(2);
      expect(stats.totalCitations).toBe(5); // 3 + 2
      expect(stats.avgCitationsPerConversation).toBe(2.5);
    });

    it("空索引应返回零统计", () => {
      const stats = indexer.getStats();
      expect(stats.conversationCount).toBe(0);
      expect(stats.totalCitations).toBe(0);
      expect(stats.avgCitationsPerConversation).toBe(0);
    });
  });
});

// ============================================================================
// 单例测试
// ============================================================================

describe("getCitationIndexer", () => {
  beforeEach(() => {
    resetCitationIndexer();
  });

  it("应返回全局单例", () => {
    const indexer1 = getCitationIndexer();
    const indexer2 = getCitationIndexer();

    expect(indexer1).toBe(indexer2);
  });

  it("resetCitationIndexer 应重置单例", () => {
    const indexer1 = getCitationIndexer();
    indexer1.indexSearchResults("test", mockSearchResults);

    resetCitationIndexer();

    const indexer2 = getCitationIndexer();
    expect(indexer2.hasCitations("test")).toBe(false);
  });
});
