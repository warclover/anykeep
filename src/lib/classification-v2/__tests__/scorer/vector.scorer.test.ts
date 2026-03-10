/**
 * VectorScorer 单元测试
 *
 * @module classification-v2/__tests__/scorer
 */

import { VectorScorer } from "../../scorer/vector.scorer";
import type { BookmarkContext, FolderContext, UserContext } from "../../types";

// Mock vector-search
jest.mock("../../infra/vector-search", () => ({
  searchSimilarFolderProfiles: jest.fn(),
}));

import { searchSimilarFolderProfiles } from "../../infra/vector-search";

const mockSearch = searchSimilarFolderProfiles as jest.MockedFunction<
  typeof searchSimilarFolderProfiles
>;

// ============================================================================
// Fixtures
// ============================================================================

function makeBookmark(
  overrides: Partial<BookmarkContext> = {},
): BookmarkContext {
  return {
    bookmarkId: "bm_1",
    title: "React Hooks 入门",
    url: "https://example.com",
    tags: ["React"],
    embedding: Array(1024).fill(0.1),
    normalizedTitle: "react hooks 入门",
    normalizedTags: ["react"],
    ...overrides,
  };
}

function makeFolder(
  id: number,
  name: string,
  overrides: Partial<FolderContext> = {},
): FolderContext {
  return {
    id,
    name,
    normalizedName: name.toLowerCase(),
    aliases: [],
    coreTags: [],
    relatedTags: [],
    sampleTitles: [],
    keywords: [],
    bookmarkCount: 5,
    ...overrides,
  };
}

function makeUserCtx(): UserContext {
  return {
    userId: "user_1",
    weights: {},
    rules: [],
    stage: "mature",
    folderCount: 5,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("VectorScorer", () => {
  const scorer = new VectorScorer();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("基本属性", () => {
    it("name/tier/weight 正确", () => {
      expect(scorer.name).toBe("vector");
      expect(scorer.tier).toBe("fast");
      expect(scorer.defaultWeight).toBe(0.35);
    });
  });

  describe("高相似度结果", () => {
    it("多条相似书签在同一文件夹 → 高分 + 高置信度", async () => {
      mockSearch.mockResolvedValue([
        {
          profileId: "profile_100",
          folderId: 1,
          folderName: "React",
          similarity: 0.85,
        },
        {
          profileId: "profile_101",
          folderId: 1,
          folderName: "React",
          similarity: 0.8,
        },
        {
          profileId: "profile_102",
          folderId: 1,
          folderName: "React",
          similarity: 0.75,
        },
      ]);

      const bookmark = makeBookmark();
      const folders = [makeFolder(1, "React")];

      const results = await scorer.score(bookmark, folders, makeUserCtx());

      expect(results.has(1)).toBe(true);
      const score = results.get(1)!;
      // 3 次匹配 → 高置信度
      expect(score.confidence).toBe(0.8);
      expect(score.value).toBeGreaterThan(0.7);
      expect(score.signals.length).toBeGreaterThanOrEqual(1);
      expect(score.signals[0].type).toBe("vector_sim");
    });
  });

  describe("低相似度结果", () => {
    it("仅 1 条低相似度 → 低置信度", async () => {
      mockSearch.mockResolvedValue([
        {
          profileId: "profile_100",
          folderId: 2,
          folderName: "Python",
          similarity: 0.4,
        },
      ]);

      const bookmark = makeBookmark();
      const folders = [makeFolder(2, "Python")];

      const results = await scorer.score(bookmark, folders, makeUserCtx());

      expect(results.has(2)).toBe(true);
      const score = results.get(2)!;
      expect(score.confidence).toBe(0.5); // < 3 次匹配
      expect(score.value).toBeLessThan(0.7);
    });
  });

  describe("无结果", () => {
    it("向量搜索返回空 → 空 Map", async () => {
      mockSearch.mockResolvedValue([]);

      const results = await scorer.score(
        makeBookmark(),
        [makeFolder(1, "React")],
        makeUserCtx(),
      );

      expect(results.size).toBe(0);
    });
  });

  describe("候选过滤", () => {
    it("相似书签的 folderId 不在候选列表 → 被过滤", async () => {
      mockSearch.mockResolvedValue([
        {
          profileId: "profile_100",
          folderId: 99, // 不在候选中
          folderName: "Vue",
          similarity: 0.9,
        },
      ]);

      const folders = [makeFolder(1, "React")]; // 只有 folderId=1

      const results = await scorer.score(
        makeBookmark(),
        folders,
        makeUserCtx(),
      );

      expect(results.size).toBe(0);
    });

    it("folderId 不在候选列表中 → 被过滤", async () => {
      mockSearch.mockResolvedValue([
        {
          profileId: "profile_100",
          folderId: 999, // 不在候选列表中
          folderName: "Unknown",
          similarity: 0.9,
        },
      ]);

      const results = await scorer.score(
        makeBookmark(),
        [makeFolder(1, "React")],
        makeUserCtx(),
      );

      expect(results.size).toBe(0);
    });
  });

  describe("关键词增强", () => {
    it("标题包含文件夹名 → 分数增强", async () => {
      mockSearch.mockResolvedValue([
        {
          profileId: "profile_100",
          folderId: 1,
          folderName: "React",
          similarity: 0.5,
        },
      ]);

      const bookmark = makeBookmark({
        normalizedTitle: "react hooks 完全指南",
      });
      const folders = [makeFolder(1, "React")];

      const results = await scorer.score(bookmark, folders, makeUserCtx());

      expect(results.has(1)).toBe(true);
      // 关键词增强 → 分数应该高于纯向量相似度 0.5
      expect(results.get(1)!.value).toBeGreaterThan(0.5);
      // 应包含 keyword boost 信号
      const hasKeywordSignal = results
        .get(1)!
        .signals.some((s) => s.type === "keyword");
      expect(hasKeywordSignal).toBe(true);
    });
  });

  describe("多文件夹聚合", () => {
    it("相似书签分布在多个文件夹 → 各自独立评分", async () => {
      mockSearch.mockResolvedValue([
        {
          profileId: "profile_100",
          folderId: 1,
          folderName: "React",
          similarity: 0.8,
        },
        {
          profileId: "profile_101",
          folderId: 2,
          folderName: "Vue",
          similarity: 0.6,
        },
      ]);

      const folders = [makeFolder(1, "React"), makeFolder(2, "Vue")];

      const results = await scorer.score(
        makeBookmark(),
        folders,
        makeUserCtx(),
      );

      expect(results.size).toBe(2);
      // React 应该分数更高（相似度 0.8 vs 0.6）
      expect(results.get(1)!.value).toBeGreaterThan(results.get(2)!.value);
    });
  });
});
