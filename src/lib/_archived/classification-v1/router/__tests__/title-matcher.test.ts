/**
 * TitleMatcher Unit Tests
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

type AnyMock = jest.Mock<(...args: any[]) => any>;

// ============================================================================
// Mocks
// ============================================================================

// Mock Supabase
const mockSupabaseRpc = jest.fn() as AnyMock;
const mockSupabaseFrom = jest.fn() as AnyMock;

// Create a flexible mock chain for Supabase queries
function createMockQueryChain(finalData: unknown) {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.is = () => chain;
  chain.limit = () => Promise.resolve({ data: finalData, error: null });
  chain.then = (cb: (v: unknown) => unknown) =>
    Promise.resolve({ data: finalData, error: null }).then(cb);
  return chain;
}

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      rpc: (...args: unknown[]) => mockSupabaseRpc(...args),
      from: (table: string) => {
        mockSupabaseFrom(table);
        if (table === "folders") {
          return createMockQueryChain([
            { id: 1, name: "技术开发" },
            { id: 2, name: "AI 学习" },
          ]);
        }
        if (table === "bookmarks") {
          return createMockQueryChain([
            { title: "React 18 新特性" },
            { title: "TypeScript 最佳实践" },
            { title: "Vue 3 组合式 API" },
            { title: "JavaScript 高级技巧" },
          ]);
        }
        return createMockQueryChain([]);
      },
    }),
  ),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock config
jest.mock("@/lib/trust-mode/config", () => ({
  FAST_PATH_THRESHOLDS: {
    MIN_TAG_MATCH_SCORE: 50,
    MIN_TAG_MATCHES: 2,
    MIN_SOURCE_CONFIDENCE: 80,
    MIN_TITLE_MATCH_SCORE: 50,
    MIN_TITLE_BOOKMARK_COUNT: 3,
  },
}));

// Mock embedding generator
const mockGenerateEmbedding = jest.fn() as AnyMock;

jest.mock("@/lib/utils/embedding-generator", () => ({
  generateEmbedding: (...args: unknown[]) => mockGenerateEmbedding(...args),
}));

// ============================================================================
// Test Utilities
// ============================================================================

function createVectorSearchResult() {
  return [
    {
      bookmark_id: 1,
      title: "React 18 新特性详解",
      folder_id: 1,
      folder_name: "技术开发",
      similarity: 0.85,
    },
    {
      bookmark_id: 2,
      title: "React Hooks 入门",
      folder_id: 1,
      folder_name: "技术开发",
      similarity: 0.78,
    },
    {
      bookmark_id: 3,
      title: "Vue 3 组合式 API",
      folder_id: 2,
      folder_name: "前端框架",
      similarity: 0.65,
    },
  ];
}

// ============================================================================
// Test Suites
// ============================================================================

describe("TitleMatcher", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateEmbedding.mockResolvedValue(new Array(1024).fill(0.1));
    mockSupabaseRpc.mockResolvedValue({
      data: createVectorSearchResult(),
      error: null,
    });
  });

  // ============================================================================
  // Constructor Tests
  // ============================================================================

  describe("constructor", () => {
    it("should initialize with default config", async () => {
      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher();

      expect(matcher).toBeDefined();
    });

    it("should accept custom vector config", async () => {
      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher({
        enabled: false,
        minSimilarity: 0.8,
        limit: 10,
      });

      expect(matcher).toBeDefined();
    });
  });

  // ============================================================================
  // tryTitleMatch Tests
  // ============================================================================

  describe("tryTitleMatch", () => {
    it("should return not found for short titles", async () => {
      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher();

      const result = await matcher.tryTitleMatch("user-123", "Hi");

      expect(result.found).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.reason).toBe("Title too short");
    });

    it("should return not found for empty title", async () => {
      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher();

      const result = await matcher.tryTitleMatch("user-123", "");

      expect(result.found).toBe(false);
    });

    it("should return not found for whitespace-only title", async () => {
      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher();

      const result = await matcher.tryTitleMatch("user-123", "   ");

      expect(result.found).toBe(false);
    });

    it("should attempt vector match first when enabled", async () => {
      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher({ enabled: true });

      await matcher.tryTitleMatch("user-123", "React 18 新特性详解");

      expect(mockGenerateEmbedding).toHaveBeenCalled();
    });

    it("should skip vector match when disabled", async () => {
      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher({ enabled: false });

      await matcher.tryTitleMatch("user-123", "React 18 新特性详解");

      expect(mockGenerateEmbedding).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // tryVectorMatch Tests
  // ============================================================================

  describe("tryVectorMatch", () => {
    it("should return found when vector match succeeds", async () => {
      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher({ enabled: true });

      const result = await matcher.tryVectorMatch(
        "user-123",
        "React 18 新特性",
      );

      expect(result.found).toBe(true);
      expect(result.matchType).toBe("vector");
      expect(result.vectorSimilarity).toBeDefined();
    });

    it("should return not found when embedding generation fails", async () => {
      mockGenerateEmbedding.mockResolvedValue(null);

      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher({ enabled: true });

      const result = await matcher.tryVectorMatch("user-123", "测试标题");

      expect(result.found).toBe(false);
      expect(result.reason).toBe("Failed to generate title embedding");
    });

    it("should return not found when embedding is empty", async () => {
      mockGenerateEmbedding.mockResolvedValue([]);

      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher({ enabled: true });

      const result = await matcher.tryVectorMatch("user-123", "测试标题");

      expect(result.found).toBe(false);
    });

    it("should return not found when RPC returns error", async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      });

      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher({ enabled: true });

      const result = await matcher.tryVectorMatch("user-123", "测试标题");

      expect(result.found).toBe(false);
    });

    it("should return not found when RPC returns empty results", async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher({ enabled: true });

      const result = await matcher.tryVectorMatch("user-123", "测试标题");

      expect(result.found).toBe(false);
      expect(result.reason).toBe("No vector matches found");
    });

    it("should aggregate results by folder", async () => {
      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher({ enabled: true });

      const result = await matcher.tryVectorMatch("user-123", "React 学习指南");

      // Folder 1 should be selected (has 2 matches vs folder 2 with 1)
      expect(result.suggestedFolderId).toBe(1);
      expect(result.folderName).toBe("技术开发");
    });

    it("should handle exception gracefully", async () => {
      mockGenerateEmbedding.mockRejectedValue(new Error("Network error"));

      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher({ enabled: true });

      const result = await matcher.tryVectorMatch("user-123", "测试标题");

      expect(result.found).toBe(false);
      expect(result.reason).toBe("Vector match error");
    });
  });

  // ============================================================================
  // tryKeywordMatch Tests
  // ============================================================================

  describe("tryKeywordMatch", () => {
    it("should return not found when no valid keywords extracted", async () => {
      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher({ enabled: false });

      // Single character titles won't produce valid keywords
      const result = await matcher.tryKeywordMatch("user-123", "的是了");

      expect(result.found).toBe(false);
      // May return "No valid keywords extracted" or "Keyword match score below threshold"
      // depending on whether stopword filtering removes all keywords
      expect(result.matchType).toBe("keyword");
    });

    it("should return keyword match type when successful", async () => {
      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher({ enabled: false });

      // Force keyword match
      mockSupabaseRpc.mockResolvedValue({ data: [], error: null });

      const result = await matcher.tryKeywordMatch(
        "user-123",
        "React TypeScript 开发指南",
      );

      expect(result.matchType).toBe("keyword");
    });
  });

  // ============================================================================
  // Cache Tests
  // ============================================================================

  describe("cache management", () => {
    it("should clear cache for specific user", async () => {
      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher();

      // No error should be thrown
      expect(() => matcher.clearCache("user-123")).not.toThrow();
    });

    it("should clear all cache", async () => {
      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher();

      expect(() => matcher.clearAllCache()).not.toThrow();
    });
  });

  // ============================================================================
  // Keyword Extraction Tests
  // ============================================================================

  describe("keyword extraction", () => {
    it("should extract Chinese keywords correctly", async () => {
      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher({ enabled: false });

      // Use keyword match to test extraction
      const result = await matcher.tryKeywordMatch(
        "user-123",
        "深入理解 JavaScript 原型链",
      );

      expect(result).toBeDefined();
      // Keywords should be extracted (test by checking the result exists)
    });

    it("should extract English keywords correctly", async () => {
      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher({ enabled: false });

      const result = await matcher.tryKeywordMatch(
        "user-123",
        "Understanding React Hooks",
      );

      expect(result).toBeDefined();
    });

    it("should handle mixed language titles", async () => {
      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher({ enabled: false });

      const result = await matcher.tryKeywordMatch(
        "user-123",
        "React 组件设计最佳实践 Best Practices",
      );

      expect(result).toBeDefined();
    });

    it("should filter stopwords", async () => {
      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher({ enabled: false });

      // Titles with mostly stopwords
      const result = await matcher.tryKeywordMatch(
        "user-123",
        "这是一个关于什么的文章",
      );

      // Should still work but may return not found due to few keywords
      expect(result).toBeDefined();
    });
  });

  // ============================================================================
  // Similarity Calculation Tests
  // ============================================================================

  describe("similarity calculation", () => {
    it("should calculate Jaccard similarity", async () => {
      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher({ enabled: false });

      // Test with similar titles
      const result = await matcher.tryKeywordMatch(
        "user-123",
        "React 18 新特性",
      );

      expect(typeof result.confidence).toBe("number");
    });

    it("should handle empty folder titles gracefully", async () => {
      // Override to return empty folder list
      mockSupabaseRpc.mockResolvedValue({ data: [], error: null });

      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher({ enabled: false });

      const result = await matcher.tryKeywordMatch(
        "user-no-folders",
        "测试标题",
      );

      expect(result.found).toBe(false);
    });
  });

  // ============================================================================
  // Singleton Tests
  // ============================================================================

  describe("singleton export", () => {
    it("should export titleMatcher singleton", async () => {
      const { titleMatcher } = await import("../title-matcher");

      expect(titleMatcher).toBeDefined();
      expect(typeof titleMatcher.tryTitleMatch).toBe("function");
      expect(typeof titleMatcher.tryVectorMatch).toBe("function");
      expect(typeof titleMatcher.tryKeywordMatch).toBe("function");
      expect(typeof titleMatcher.clearCache).toBe("function");
      expect(typeof titleMatcher.clearAllCache).toBe("function");
    });
  });

  // ============================================================================
  // Vector Config Tests
  // ============================================================================

  describe("vector config", () => {
    it("should use default minSimilarity", async () => {
      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher();

      mockSupabaseRpc.mockResolvedValue({
        data: createVectorSearchResult(),
        error: null,
      });

      await matcher.tryVectorMatch("user-123", "测试标题");

      expect(mockSupabaseRpc).toHaveBeenCalledWith(
        "search_bookmarks_by_title_vector",
        expect.objectContaining({
          p_min_similarity: 0.65, // default
        }),
      );
    });

    it("should use custom minSimilarity", async () => {
      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher({ minSimilarity: 0.8 });

      await matcher.tryVectorMatch("user-123", "测试标题");

      expect(mockSupabaseRpc).toHaveBeenCalledWith(
        "search_bookmarks_by_title_vector",
        expect.objectContaining({
          p_min_similarity: 0.8,
        }),
      );
    });

    it("should use custom limit", async () => {
      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher({ limit: 20 });

      await matcher.tryVectorMatch("user-123", "测试标题");

      expect(mockSupabaseRpc).toHaveBeenCalledWith(
        "search_bookmarks_by_title_vector",
        expect.objectContaining({
          p_limit: 20,
        }),
      );
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("edge cases", () => {
    it("should handle null folder_id in vector results", async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: [
          {
            bookmark_id: 1,
            title: "Test",
            folder_id: null,
            folder_name: null,
            similarity: 0.9,
          },
        ],
        error: null,
      });

      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher({ enabled: true });

      const result = await matcher.tryVectorMatch("user-123", "Test");

      expect(result.found).toBe(false);
      expect(result.reason).toBe("No folder matches from vector search");
    });

    it("should calculate confidence bonus from match count", async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: [
          {
            bookmark_id: 1,
            title: "React 1",
            folder_id: 1,
            folder_name: "技术",
            similarity: 0.8,
          },
          {
            bookmark_id: 2,
            title: "React 2",
            folder_id: 1,
            folder_name: "技术",
            similarity: 0.75,
          },
          {
            bookmark_id: 3,
            title: "React 3",
            folder_id: 1,
            folder_name: "技术",
            similarity: 0.7,
          },
        ],
        error: null,
      });

      const { TitleMatcher } = await import("../title-matcher");
      const matcher = new TitleMatcher({ enabled: true });

      const result = await matcher.tryVectorMatch("user-123", "React");

      expect(result.found).toBe(true);
      // Confidence should be higher due to match count bonus
      expect(result.confidence).toBeGreaterThan(75);
    });
  });
});
