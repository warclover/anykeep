/**
 * HistoryMatcher Unit Tests
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { HistoryMatcher } from "../history-matcher";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMock = jest.Mock<(...args: any[]) => any>;

// ============================================================================
// Mocks
// ============================================================================

const mockFindSimilarWithFolders = jest.fn() as AnyMock;

// Mock BookmarkRepository
function createMockBookmarkRepo() {
  return {
    findSimilarWithFolders: mockFindSimilarWithFolders,
  };
}

// Mock context
function createMockContext(overrides = {}) {
  return {
    userId: "user-123",
    title: "测试书签",
    url: "https://example.com",
    embedding: new Array(1024).fill(0.1),
    bookmarkId: 1,
    summary: "",
    tags: [],
    ...overrides,
  };
}

// Mock similar bookmark data
function createSimilarBookmark(overrides = {}) {
  return {
    bookmarkId: 1,
    bookmarkTitle: "类似书签标题",
    folderId: 1,
    folderName: "技术文章",
    similarity: 0.85,
    ...overrides,
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe("HistoryMatcher", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindSimilarWithFolders.mockResolvedValue([]);
  });

  // ============================================================================
  // Constructor Tests
  // ============================================================================

  describe("constructor", () => {
    it("should initialize with default weight", () => {
      const repo = createMockBookmarkRepo();
      const matcher = new HistoryMatcher(repo as never);

      expect(matcher.name).toBe("history");
      expect(matcher.weight).toBeGreaterThan(0);
    });

    it("should accept custom weight", () => {
      const repo = createMockBookmarkRepo();
      const matcher = new HistoryMatcher(repo as never, { weight: 0.5 });

      expect(matcher.weight).toBe(0.5);
    });

    it("should accept custom threshold", () => {
      const repo = createMockBookmarkRepo();
      const matcher = new HistoryMatcher(repo as never, {
        thresholds: { matchCount: 20 },
      });

      expect(matcher).toBeDefined();
    });
  });

  // ============================================================================
  // match() Tests
  // ============================================================================

  describe("match", () => {
    it("should return empty array when no embedding provided", async () => {
      const repo = createMockBookmarkRepo();
      const matcher = new HistoryMatcher(repo as never);
      const context = createMockContext({ embedding: null });

      const results = await matcher.match(context);

      expect(results).toEqual([]);
      expect(mockFindSimilarWithFolders).not.toHaveBeenCalled();
    });

    it("should return empty array when embedding is empty", async () => {
      const repo = createMockBookmarkRepo();
      const matcher = new HistoryMatcher(repo as never);
      const context = createMockContext({ embedding: [] });

      const results = await matcher.match(context);

      expect(results).toEqual([]);
    });

    it("should return empty array when no similar bookmarks found", async () => {
      mockFindSimilarWithFolders.mockResolvedValue([]);
      const repo = createMockBookmarkRepo();
      const matcher = new HistoryMatcher(repo as never);
      const context = createMockContext();

      const results = await matcher.match(context);

      expect(results).toEqual([]);
    });

    it("should return empty array when similar bookmarks have no folders", async () => {
      mockFindSimilarWithFolders.mockResolvedValue([
        createSimilarBookmark({ folderId: null, folderName: null }),
        createSimilarBookmark({ folderId: null, folderName: null }),
      ]);
      const repo = createMockBookmarkRepo();
      const matcher = new HistoryMatcher(repo as never);
      const context = createMockContext();

      const results = await matcher.match(context);

      expect(results).toEqual([]);
    });

    it("should return match results for similar bookmarks", async () => {
      mockFindSimilarWithFolders.mockResolvedValue([
        createSimilarBookmark({
          folderId: 1,
          folderName: "技术文章",
          similarity: 0.9,
        }),
        createSimilarBookmark({
          folderId: 1,
          folderName: "技术文章",
          similarity: 0.85,
        }),
        createSimilarBookmark({
          folderId: 2,
          folderName: "生活随笔",
          similarity: 0.7,
        }),
      ]);
      const repo = createMockBookmarkRepo();
      const matcher = new HistoryMatcher(repo as never);
      const context = createMockContext();

      const results = await matcher.match(context);

      expect(results).toHaveLength(2);
      expect(results[0].folderId).toBe(1);
      expect(results[0].folderName).toBe("技术文章");
      expect(results[1].folderId).toBe(2);
    });

    it("should sort results by count descending", async () => {
      mockFindSimilarWithFolders.mockResolvedValue([
        createSimilarBookmark({
          folderId: 1,
          folderName: "文件夹A",
          similarity: 0.8,
        }),
        createSimilarBookmark({
          folderId: 2,
          folderName: "文件夹B",
          similarity: 0.9,
        }),
        createSimilarBookmark({
          folderId: 2,
          folderName: "文件夹B",
          similarity: 0.85,
        }),
        createSimilarBookmark({
          folderId: 2,
          folderName: "文件夹B",
          similarity: 0.75,
        }),
      ]);
      const repo = createMockBookmarkRepo();
      const matcher = new HistoryMatcher(repo as never);
      const context = createMockContext();

      const results = await matcher.match(context);

      expect(results[0].folderId).toBe(2); // Has 3 matches
      expect(results[1].folderId).toBe(1); // Has 1 match
    });

    it("should calculate score based on proportion and similarity", async () => {
      mockFindSimilarWithFolders.mockResolvedValue([
        createSimilarBookmark({
          folderId: 1,
          folderName: "文件夹",
          similarity: 0.8,
        }),
        createSimilarBookmark({
          folderId: 1,
          folderName: "文件夹",
          similarity: 0.8,
        }),
      ]);
      const repo = createMockBookmarkRepo();
      const matcher = new HistoryMatcher(repo as never);
      const context = createMockContext();

      const results = await matcher.match(context);

      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].score).toBeLessThanOrEqual(100);
    });

    it("should include similar bookmark count in result", async () => {
      mockFindSimilarWithFolders.mockResolvedValue([
        createSimilarBookmark({ folderId: 1 }),
        createSimilarBookmark({ folderId: 1 }),
        createSimilarBookmark({ folderId: 1 }),
      ]);
      const repo = createMockBookmarkRepo();
      const matcher = new HistoryMatcher(repo as never);
      const context = createMockContext();

      const results = await matcher.match(context);

      // Access extended property through metadata (double cast for type safety)
      const result = results[0] as unknown as {
        metadata: { similarCount: number };
      };
      expect(result.metadata.similarCount).toBe(3);
    });

    it("should limit similar titles to 3", async () => {
      mockFindSimilarWithFolders.mockResolvedValue([
        createSimilarBookmark({ folderId: 1, bookmarkTitle: "标题1" }),
        createSimilarBookmark({ folderId: 1, bookmarkTitle: "标题2" }),
        createSimilarBookmark({ folderId: 1, bookmarkTitle: "标题3" }),
        createSimilarBookmark({ folderId: 1, bookmarkTitle: "标题4" }),
        createSimilarBookmark({ folderId: 1, bookmarkTitle: "标题5" }),
      ]);
      const repo = createMockBookmarkRepo();
      const matcher = new HistoryMatcher(repo as never);
      const context = createMockContext();

      const results = await matcher.match(context);

      // Access extended property through metadata with double cast
      const result = results[0] as unknown as {
        metadata: { similarTitles: string[] };
      };
      expect(result.metadata.similarTitles).toHaveLength(3);
    });

    it("should pass bookmarkId to exclude self-match", async () => {
      const repo = createMockBookmarkRepo();
      const matcher = new HistoryMatcher(repo as never);
      const context = createMockContext({ bookmarkId: 42 });

      await matcher.match(context);

      expect(mockFindSimilarWithFolders).toHaveBeenCalledWith(
        expect.any(Array),
        "user-123",
        expect.any(Number),
        42,
      );
    });

    it("should include metadata in result", async () => {
      mockFindSimilarWithFolders.mockResolvedValue([
        createSimilarBookmark({ folderId: 1, similarity: 0.9 }),
      ]);
      const repo = createMockBookmarkRepo();
      const matcher = new HistoryMatcher(repo as never);
      const context = createMockContext();

      const results = await matcher.match(context);

      expect(results[0].metadata).toBeDefined();
      const metadata = results[0].metadata as {
        proportion: number;
        avgSimilarity: number;
      };
      expect(metadata.proportion).toBeDefined();
      expect(metadata.avgSimilarity).toBeDefined();
    });
  });

  // ============================================================================
  // isAvailable() Tests
  // ============================================================================

  describe("isAvailable", () => {
    it("should return true when embedding exists", async () => {
      const repo = createMockBookmarkRepo();
      const matcher = new HistoryMatcher(repo as never);
      const context = createMockContext();

      const available = await matcher.isAvailable(context);

      expect(available).toBe(true);
    });

    it("should return false when embedding is null", async () => {
      const repo = createMockBookmarkRepo();
      const matcher = new HistoryMatcher(repo as never);
      const context = createMockContext({ embedding: null });

      const available = await matcher.isAvailable(context);

      expect(available).toBe(false);
    });

    it("should return false when embedding is empty", async () => {
      const repo = createMockBookmarkRepo();
      const matcher = new HistoryMatcher(repo as never);
      const context = createMockContext({ embedding: [] });

      const available = await matcher.isAvailable(context);

      expect(available).toBe(false);
    });
  });
});
