/**
 * find-related-by-topic.tool.ts 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { ToolContext } from "../../types";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock 函数 - 这些需要在 jest.mock 之前定义
const mockGetBookmarkCluster = jest.fn();
const mockSupabaseSingle = jest.fn();
const mockSupabaseIn = jest.fn();

// Mock Supabase
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => {
    const chainable: Record<string, jest.Mock> = {};
    chainable.select = jest.fn(() => chainable);
    chainable.eq = jest.fn(() => chainable);
    chainable.in = jest.fn((...args) => mockSupabaseIn(...args));
    chainable.single = jest.fn(() => mockSupabaseSingle());
    return Promise.resolve({
      from: jest.fn(() => chainable),
    });
  }),
}));

// Mock TopicClustererService
jest.mock("@/lib/knowledge-link/services/topic-clusterer.service", () => ({
  getTopicClustererService: jest.fn(() => ({
    getBookmarkCluster: mockGetBookmarkCluster,
  })),
}));

import { findRelatedByTopicTool } from "../find-related-by-topic.tool";

describe("findRelatedByTopicTool", () => {
  const mockContext: ToolContext = {
    userId: "test-user-123",
    conversationId: "test-conv-456",
  };

  // 创建 Mock 聚类数据
  const createMockCluster = (options?: {
    bookmarkCount?: number;
    label?: string;
    cohesion?: number;
    tags?: string[];
  }) => ({
    clusterId: "cluster-1",
    label: options?.label || "技术文章",
    cohesion: options?.cohesion || 0.85,
    representativeTags: options?.tags || ["编程", "技术"],
    bookmarkIds: Array.from(
      { length: options?.bookmarkCount || 5 },
      (_, i) => i + 1,
    ),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // 重置所有 mock 的默认返回值
    mockSupabaseSingle.mockResolvedValue({ data: null, error: null });
    mockSupabaseIn.mockResolvedValue({ data: [], error: null });
    mockGetBookmarkCluster.mockResolvedValue(null);
  });

  describe("definition", () => {
    it("should have correct metadata", () => {
      expect(findRelatedByTopicTool.definition.name).toBe(
        "find_related_by_topic",
      );
      expect(findRelatedByTopicTool.definition.category).toBe("query");
      expect(findRelatedByTopicTool.definition.requiresConfirmation).toBe(
        false,
      );
      expect(findRelatedByTopicTool.definition.estimatedDurationMs).toBe(400);
    });

    it("should require bookmarkId parameter", () => {
      const schema = findRelatedByTopicTool.definition.parameters;
      expect(() => schema.parse({})).toThrow();
      expect(() => schema.parse({ bookmarkId: 1 })).not.toThrow();
    });

    it("should validate bookmarkId is positive integer", () => {
      const schema = findRelatedByTopicTool.definition.parameters;
      expect(() => schema.parse({ bookmarkId: 0 })).toThrow();
      expect(() => schema.parse({ bookmarkId: -1 })).toThrow();
      expect(() => schema.parse({ bookmarkId: 1.5 })).toThrow();
      expect(() => schema.parse({ bookmarkId: 42 })).not.toThrow();
    });

    it("should validate limit range", () => {
      const schema = findRelatedByTopicTool.definition.parameters;
      expect(() => schema.parse({ bookmarkId: 1, limit: 0 })).toThrow();
      expect(() => schema.parse({ bookmarkId: 1, limit: 51 })).toThrow();
      expect(() => schema.parse({ bookmarkId: 1, limit: 10 })).not.toThrow();
    });

    it("should have default limit of 10", () => {
      const schema = findRelatedByTopicTool.definition.parameters;
      const result = schema.parse({ bookmarkId: 1 });
      expect(result.limit).toBe(10);
    });
  });

  describe("execute - bookmark not found", () => {
    it("should return NOT_FOUND when bookmark does not exist", async () => {
      mockSupabaseSingle.mockResolvedValue({ data: null, error: null });

      const result = await findRelatedByTopicTool.execute(
        { bookmarkId: 999 },
        mockContext,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("书签不存在或无权访问");
        expect(result.errorCode).toBe("NOT_FOUND");
      }
    });

    it("should return NOT_FOUND when database error", async () => {
      mockSupabaseSingle.mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      });

      const result = await findRelatedByTopicTool.execute(
        { bookmarkId: 1 },
        mockContext,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe("NOT_FOUND");
      }
    });
  });

  describe("execute - no cluster", () => {
    it("should return empty related list when no cluster found", async () => {
      mockSupabaseSingle.mockResolvedValue({
        data: { id: 1, title: "测试书签", url: "https://test.com" },
        error: null,
      });
      mockGetBookmarkCluster.mockResolvedValue(null);

      const result = await findRelatedByTopicTool.execute(
        { bookmarkId: 1 },
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.bookmarkId).toBe(1);
        expect(result.data.cluster).toBeNull();
        expect(result.data.relatedBookmarks).toHaveLength(0);
        expect(result.data.message).toContain("尚未加入任何主题簇");
      }
    });
  });

  describe("execute - with cluster", () => {
    it("should return cluster info and related bookmarks", async () => {
      mockSupabaseSingle.mockResolvedValue({
        data: { id: 1, title: "测试书签", url: "https://test.com" },
        error: null,
      });
      mockGetBookmarkCluster.mockResolvedValue(
        createMockCluster({ bookmarkCount: 5 }),
      );
      mockSupabaseIn.mockResolvedValue({
        data: [
          { id: 2, title: "相关书签1", url: "https://related1.com" },
          { id: 3, title: "相关书签2", url: "https://related2.com" },
        ],
        error: null,
      });

      const result = await findRelatedByTopicTool.execute(
        { bookmarkId: 1 },
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.bookmarkId).toBe(1);
        expect(result.data.cluster).not.toBeNull();
        expect(result.data.cluster?.label).toBe("技术文章");
        expect(result.data.cluster?.cohesion).toBe(0.85);
        expect(result.data.relatedBookmarks).toHaveLength(2);
        expect(result.data.message).toContain("技术文章");
        expect(result.data.message).toContain("2 个相关书签");
      }
    });

    it("should include topic labels in message when available", async () => {
      mockSupabaseSingle.mockResolvedValue({
        data: { id: 1, title: "AI文章", url: "https://ai.com" },
        error: null,
      });
      mockGetBookmarkCluster.mockResolvedValue(
        createMockCluster({
          label: "人工智能",
          tags: ["AI", "机器学习", "深度学习"],
        }),
      );
      mockSupabaseIn.mockResolvedValue({
        data: [{ id: 2, title: "ML文章", url: "https://ml.com" }],
        error: null,
      });

      const result = await findRelatedByTopicTool.execute(
        { bookmarkId: 1 },
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toContain("主题关键词");
        expect(result.data.cluster?.representativeTags).toContain("AI");
      }
    });

    it("should handle cluster with no other bookmarks", async () => {
      mockSupabaseSingle.mockResolvedValue({
        data: { id: 1, title: "唯一书签", url: "https://only.com" },
        error: null,
      });
      mockGetBookmarkCluster.mockResolvedValue(
        createMockCluster({ bookmarkCount: 1 }),
      );
      mockSupabaseIn.mockResolvedValue({ data: [], error: null });

      const result = await findRelatedByTopicTool.execute(
        { bookmarkId: 1 },
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.relatedBookmarks).toHaveLength(0);
        expect(result.data.message).toContain("暂无其他书签");
      }
    });

    it("should include strength in related bookmarks", async () => {
      mockSupabaseSingle.mockResolvedValue({
        data: { id: 1, title: "测试", url: "https://test.com" },
        error: null,
      });
      mockGetBookmarkCluster.mockResolvedValue(
        createMockCluster({ cohesion: 0.78 }),
      );
      mockSupabaseIn.mockResolvedValue({
        data: [{ id: 2, title: "相关", url: "https://related.com" }],
        error: null,
      });

      const result = await findRelatedByTopicTool.execute(
        { bookmarkId: 1 },
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.relatedBookmarks[0].strength).toBe(0.78);
        expect(result.data.relatedBookmarks[0].topicLabel).toBe("技术文章");
      }
    });
  });

  describe("execute - error handling", () => {
    it("should handle service errors gracefully", async () => {
      mockSupabaseSingle.mockResolvedValue({
        data: { id: 1, title: "测试", url: "https://test.com" },
        error: null,
      });
      mockGetBookmarkCluster.mockRejectedValue(new Error("Service error"));

      const result = await findRelatedByTopicTool.execute(
        { bookmarkId: 1 },
        mockContext,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("查找相关内容失败");
        expect(result.errorCode).toBe("EXECUTION_ERROR");
      }
    });
  });

  describe("execute - metadata", () => {
    it("should include execution time in metadata for success case", async () => {
      mockSupabaseSingle.mockResolvedValue({
        data: { id: 1, title: "测试", url: "https://test.com" },
        error: null,
      });
      mockGetBookmarkCluster.mockResolvedValue(null);

      const result = await findRelatedByTopicTool.execute(
        { bookmarkId: 1 },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.executionTimeMs).toBeDefined();
      expect(result.metadata?.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should include execution time in metadata for error case", async () => {
      mockSupabaseSingle.mockResolvedValue({ data: null, error: null });

      const result = await findRelatedByTopicTool.execute(
        { bookmarkId: 1 },
        mockContext,
      );

      // Error case (NOT_FOUND) doesn't include metadata
      expect(result.success).toBe(false);
    });

    it("should include affectedCount in success metadata", async () => {
      mockSupabaseSingle.mockResolvedValue({
        data: { id: 1, title: "测试", url: "https://test.com" },
        error: null,
      });
      mockGetBookmarkCluster.mockResolvedValue(
        createMockCluster({ bookmarkCount: 5 }),
      );
      mockSupabaseIn.mockResolvedValue({
        data: [
          { id: 2, title: "相关1", url: "https://r1.com" },
          { id: 3, title: "相关2", url: "https://r2.com" },
        ],
        error: null,
      });

      const result = await findRelatedByTopicTool.execute(
        { bookmarkId: 1 },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.affectedCount).toBe(2);
    });
  });
});
