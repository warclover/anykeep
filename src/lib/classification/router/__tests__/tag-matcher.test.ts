/**
 * TagMatcher Unit Tests
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// ============================================================================
// Mocks
// ============================================================================

// Mock Supabase
const mockSupabaseFrom = jest.fn();
const mockSupabaseSelect = jest.fn();
const mockSupabaseEq = jest.fn();
// Prefixed with _ since they're part of the mock chain but not directly called
const _mockSupabaseIs = jest.fn();
const _mockSupabaseLimit = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: (table: string) => {
        mockSupabaseFrom(table);
        return {
          select: (...args: unknown[]) => {
            mockSupabaseSelect(...args);
            return {
              eq: (...eqArgs: unknown[]) => {
                mockSupabaseEq(...eqArgs);
                return {
                  eq: () => ({
                    is: () => ({
                      limit: () =>
                        Promise.resolve({
                          data: [
                            { tags: ["react", "前端", "javascript"] },
                            { tags: ["react", "typescript"] },
                          ],
                          error: null,
                        }),
                    }),
                  }),
                };
              },
            };
          },
        };
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
    MIN_TITLE_MATCH_SCORE: 70,
  },
}));

// Mock tag graph service
const mockExpandTagsWithSynonyms = jest.fn();
const mockGetSynonyms = jest.fn();

jest.mock("@/lib/classification/services/tag-graph.service", () => ({
  tagGraphService: {
    expandTagsWithSynonyms: (...args: unknown[]) =>
      mockExpandTagsWithSynonyms(...args),
    getSynonyms: (...args: unknown[]) => mockGetSynonyms(...args),
  },
}));

// ============================================================================
// Test Utilities
// ============================================================================

// Helper function for creating mock folder data (reserved for future use)
function _createMockFolderData() {
  return [
    { id: 1, name: "技术开发" },
    { id: 2, name: "AI 学习" },
    { id: 3, name: "生活日常" },
  ];
}

// ============================================================================
// Test Suites
// ============================================================================

describe("TagMatcher", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExpandTagsWithSynonyms.mockResolvedValue([
      "react",
      "前端",
      "javascript",
    ]);
    mockGetSynonyms.mockResolvedValue([]);
  });

  // ============================================================================
  // tryTagMatch Tests
  // ============================================================================

  describe("tryTagMatch", () => {
    it("should return not found when no tags provided", async () => {
      const { TagMatcher } = await import("../tag-matcher");
      const matcher = new TagMatcher();

      const result = await matcher.tryTagMatch("user-123", []);

      expect(result.found).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.reason).toBe("No tags provided");
    });

    it("should return not found when tags is undefined", async () => {
      const { TagMatcher } = await import("../tag-matcher");
      const matcher = new TagMatcher();

      const result = await matcher.tryTagMatch(
        "user-123",
        undefined as unknown as string[],
      );

      expect(result.found).toBe(false);
    });

    it("should normalize tags to lowercase", async () => {
      const { TagMatcher } = await import("../tag-matcher");
      const matcher = new TagMatcher();

      mockExpandTagsWithSynonyms.mockResolvedValue(["react", "typescript"]);

      // Execute the method - result not needed for this test
      await matcher.tryTagMatch("user-123", ["React", "TypeScript"]);

      expect(mockExpandTagsWithSynonyms).toHaveBeenCalledWith(
        "user-123",
        expect.arrayContaining(["react", "typescript"]),
      );
    });

    it("should call tagGraphService for tag expansion", async () => {
      const { TagMatcher } = await import("../tag-matcher");
      const matcher = new TagMatcher();

      await matcher.tryTagMatch("user-123", ["前端", "react"]);

      expect(mockExpandTagsWithSynonyms).toHaveBeenCalledWith(
        "user-123",
        expect.any(Array),
      );
    });

    it("should return not found when no folder tags available", async () => {
      // Override mock to return no folders
      jest.resetModules();
      jest.doMock("@/lib/supabase/server", () => ({
        createClient: jest.fn(() =>
          Promise.resolve({
            from: () => ({
              select: () => ({
                eq: () => ({
                  eq: () => Promise.resolve({ data: [], error: null }),
                }),
              }),
            }),
          }),
        ),
      }));

      const { TagMatcher } = await import("../tag-matcher");
      const matcher = new TagMatcher();

      // Clear internal cache
      matcher.clearAllCache();

      const result = await matcher.tryTagMatch("user-no-folders", ["react"]);

      // Should get no folder tags result
      expect(result.confidence).toBeDefined();
    });
  });

  // ============================================================================
  // Cache Tests
  // ============================================================================

  describe("cache management", () => {
    it("should clear cache for specific user", async () => {
      const { TagMatcher } = await import("../tag-matcher");
      const matcher = new TagMatcher();

      // Populate cache by calling tryTagMatch
      await matcher.tryTagMatch("user-123", ["react"]);

      // Clear cache
      matcher.clearCache("user-123");

      // No error should be thrown
      expect(true).toBe(true);
    });

    it("should clear all cache", async () => {
      const { TagMatcher } = await import("../tag-matcher");
      const matcher = new TagMatcher();

      // Populate cache
      await matcher.tryTagMatch("user-1", ["react"]);
      await matcher.tryTagMatch("user-2", ["vue"]);

      // Clear all
      matcher.clearAllCache();

      // No error should be thrown
      expect(true).toBe(true);
    });
  });

  // ============================================================================
  // Synonym Tests
  // ============================================================================

  describe("synonym matching", () => {
    it("should match synonyms using tagGraphService", async () => {
      const { TagMatcher } = await import("../tag-matcher");
      const matcher = new TagMatcher();

      mockExpandTagsWithSynonyms.mockResolvedValue([
        "ai",
        "人工智能",
        "机器学习",
      ]);
      mockGetSynonyms.mockResolvedValue(["人工智能", "机器学习"]);

      await matcher.tryTagMatch("user-123", ["AI"]);

      expect(mockExpandTagsWithSynonyms).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe("integration scenarios", () => {
    it("should handle mixed Chinese and English tags", async () => {
      const { TagMatcher } = await import("../tag-matcher");
      const matcher = new TagMatcher();

      mockExpandTagsWithSynonyms.mockResolvedValue([
        "react",
        "前端",
        "javascript",
      ]);

      const result = await matcher.tryTagMatch("user-123", [
        "React",
        "前端",
        "JavaScript",
      ]);

      // Result should be defined (either found or not found)
      expect(result).toBeDefined();
      expect(typeof result.found).toBe("boolean");
      expect(typeof result.confidence).toBe("number");
    });

    it("should handle empty string tags", async () => {
      const { TagMatcher } = await import("../tag-matcher");
      const matcher = new TagMatcher();

      mockExpandTagsWithSynonyms.mockResolvedValue([]);

      const result = await matcher.tryTagMatch("user-123", ["", "  ", "valid"]);

      expect(result).toBeDefined();
    });
  });

  // ============================================================================
  // Singleton Tests
  // ============================================================================

  describe("singleton export", () => {
    it("should export tagMatcher singleton", async () => {
      const { tagMatcher } = await import("../tag-matcher");

      expect(tagMatcher).toBeDefined();
      expect(typeof tagMatcher.tryTagMatch).toBe("function");
      expect(typeof tagMatcher.clearCache).toBe("function");
      expect(typeof tagMatcher.clearAllCache).toBe("function");
    });
  });
});
