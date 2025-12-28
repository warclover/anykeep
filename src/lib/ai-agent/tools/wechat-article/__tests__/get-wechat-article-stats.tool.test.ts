/**
 * get-wechat-article-stats.tool.ts 单元测试
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

// Mock WechatArticleService - 使用 jest.fn() 占位，稍后在测试中设置返回值
jest.mock("@/lib/wechat-article/wechat-article.service", () => ({
  wechatArticleService: {
    getUserStats: jest.fn(),
  },
}));

import { getWechatArticleStatsTool } from "../get-wechat-article-stats.tool";
import { wechatArticleService } from "@/lib/wechat-article/wechat-article.service";

// 获取 mock 函数的引用
const mockGetUserStats = wechatArticleService.getUserStats as jest.Mock;

describe("getWechatArticleStatsTool", () => {
  const mockContext: ToolContext = {
    userId: "test-user-123",
    conversationId: "test-conv-456",
  };

  // 默认空统计数据
  const emptyStats = {
    totalArticles: 0,
    totalImages: 0,
    successImages: 0,
    failedImages: 0,
    storageUsed: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // 设置默认返回值
    mockGetUserStats.mockResolvedValue(emptyStats);
  });

  describe("definition", () => {
    it("should have correct metadata", () => {
      expect(getWechatArticleStatsTool.definition.name).toBe(
        "get_wechat_article_stats",
      );
      expect(getWechatArticleStatsTool.definition.category).toBe("query");
      expect(getWechatArticleStatsTool.definition.requiresConfirmation).toBe(
        false,
      );
      expect(getWechatArticleStatsTool.definition.estimatedDurationMs).toBe(
        200,
      );
    });

    it("should have no required parameters", () => {
      const schema = getWechatArticleStatsTool.definition.parameters;
      expect(() => schema.parse({})).not.toThrow();
    });
  });

  describe("execute - empty state", () => {
    it("should return zeros when no articles", async () => {
      mockGetUserStats.mockResolvedValue({
        totalArticles: 0,
        totalImages: 0,
        successImages: 0,
        failedImages: 0,
        storageUsed: 0,
      });

      const result = await getWechatArticleStatsTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalArticles).toBe(0);
        expect(result.data.totalImages).toBe(0);
        expect(result.data.successImages).toBe(0);
        expect(result.data.failedImages).toBe(0);
        expect(result.data.storageUsed).toBe(0);
        expect(result.data.imageSuccessRate).toBe("N/A");
        expect(result.data.message).toContain("还没有收藏微信公众号文章");
      }
    });
  });

  describe("execute - with data", () => {
    it("should calculate correct statistics", async () => {
      mockGetUserStats.mockResolvedValue({
        totalArticles: 100,
        totalImages: 500,
        successImages: 450,
        failedImages: 50,
        storageUsed: 1024 * 1024 * 50, // 50 MB
      });

      const result = await getWechatArticleStatsTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalArticles).toBe(100);
        expect(result.data.totalImages).toBe(500);
        expect(result.data.successImages).toBe(450);
        expect(result.data.failedImages).toBe(50);
        expect(result.data.imageSuccessRate).toBe("90%");
        expect(result.data.storageUsedFormatted).toContain("50");
        expect(result.data.storageUsedFormatted).toContain("MB");
      }
    });

    it("should generate correct message with articles only", async () => {
      mockGetUserStats.mockResolvedValue({
        totalArticles: 25,
        totalImages: 0,
        successImages: 0,
        failedImages: 0,
        storageUsed: 0,
      });

      const result = await getWechatArticleStatsTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toContain("25 篇微信文章");
        expect(result.data.message).not.toContain("图片");
      }
    });

    it("should include image count in message when images exist", async () => {
      mockGetUserStats.mockResolvedValue({
        totalArticles: 10,
        totalImages: 30,
        successImages: 25,
        failedImages: 5,
        storageUsed: 0,
      });

      const result = await getWechatArticleStatsTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toContain("10 篇微信文章");
        expect(result.data.message).toContain("30 张图片");
        expect(result.data.message).toContain("25 张已持久化");
      }
    });

    it("should include storage info in message when storage is used", async () => {
      mockGetUserStats.mockResolvedValue({
        totalArticles: 5,
        totalImages: 0,
        successImages: 0,
        failedImages: 0,
        storageUsed: 1024 * 1024 * 100, // 100 MB
      });

      const result = await getWechatArticleStatsTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toContain("存储空间使用");
        expect(result.data.message).toContain("100");
      }
    });
  });

  describe("execute - storage formatting", () => {
    it("should format bytes correctly", async () => {
      mockGetUserStats.mockResolvedValue({
        totalArticles: 1,
        totalImages: 0,
        successImages: 0,
        failedImages: 0,
        storageUsed: 512,
      });
      const result = await getWechatArticleStatsTool.execute({}, mockContext);
      if (result.success) {
        expect(result.data.storageUsedFormatted).toBe("512 B");
      }
    });

    it("should format KB correctly", async () => {
      mockGetUserStats.mockResolvedValue({
        totalArticles: 1,
        totalImages: 0,
        successImages: 0,
        failedImages: 0,
        storageUsed: 2048,
      });
      const result = await getWechatArticleStatsTool.execute({}, mockContext);
      if (result.success) {
        expect(result.data.storageUsedFormatted).toBe("2.0 KB");
      }
    });

    it("should format MB correctly", async () => {
      mockGetUserStats.mockResolvedValue({
        totalArticles: 1,
        totalImages: 0,
        successImages: 0,
        failedImages: 0,
        storageUsed: 1024 * 1024 * 5.5,
      });
      const result = await getWechatArticleStatsTool.execute({}, mockContext);
      if (result.success) {
        expect(result.data.storageUsedFormatted).toBe("5.5 MB");
      }
    });

    it("should format GB correctly", async () => {
      mockGetUserStats.mockResolvedValue({
        totalArticles: 1,
        totalImages: 0,
        successImages: 0,
        failedImages: 0,
        storageUsed: 1024 * 1024 * 1024 * 2.5,
      });
      const result = await getWechatArticleStatsTool.execute({}, mockContext);
      if (result.success) {
        expect(result.data.storageUsedFormatted).toBe("2.50 GB");
      }
    });

    it("should handle zero storage", async () => {
      mockGetUserStats.mockResolvedValue({
        totalArticles: 1,
        totalImages: 0,
        successImages: 0,
        failedImages: 0,
        storageUsed: 0,
      });
      const result = await getWechatArticleStatsTool.execute({}, mockContext);
      if (result.success) {
        expect(result.data.storageUsedFormatted).toBe("0 B");
      }
    });
  });

  describe("execute - success rate calculation", () => {
    it("should calculate 100% success rate", async () => {
      mockGetUserStats.mockResolvedValue({
        totalArticles: 1,
        totalImages: 100,
        successImages: 100,
        failedImages: 0,
        storageUsed: 0,
      });

      const result = await getWechatArticleStatsTool.execute({}, mockContext);

      if (result.success) {
        expect(result.data.imageSuccessRate).toBe("100%");
      }
    });

    it("should calculate 0% success rate", async () => {
      mockGetUserStats.mockResolvedValue({
        totalArticles: 1,
        totalImages: 50,
        successImages: 0,
        failedImages: 50,
        storageUsed: 0,
      });

      const result = await getWechatArticleStatsTool.execute({}, mockContext);

      if (result.success) {
        expect(result.data.imageSuccessRate).toBe("0%");
      }
    });

    it("should round success rate correctly", async () => {
      mockGetUserStats.mockResolvedValue({
        totalArticles: 1,
        totalImages: 3,
        successImages: 2,
        failedImages: 1,
        storageUsed: 0,
      });

      const result = await getWechatArticleStatsTool.execute({}, mockContext);

      if (result.success) {
        expect(result.data.imageSuccessRate).toBe("67%");
      }
    });

    it("should return N/A when no images", async () => {
      mockGetUserStats.mockResolvedValue({
        totalArticles: 1,
        totalImages: 0,
        successImages: 0,
        failedImages: 0,
        storageUsed: 0,
      });

      const result = await getWechatArticleStatsTool.execute({}, mockContext);

      if (result.success) {
        expect(result.data.imageSuccessRate).toBe("N/A");
      }
    });
  });

  describe("execute - error handling", () => {
    it("should handle service errors gracefully", async () => {
      mockGetUserStats.mockRejectedValue(new Error("Service unavailable"));

      const result = await getWechatArticleStatsTool.execute({}, mockContext);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("获取微信文章统计失败");
        expect(result.errorCode).toBe("EXECUTION_ERROR");
      }
    });

    it("should handle unknown errors", async () => {
      mockGetUserStats.mockRejectedValue("Unknown error");

      const result = await getWechatArticleStatsTool.execute({}, mockContext);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("获取微信文章统计失败");
      }
    });
  });

  describe("execute - metadata", () => {
    it("should include execution time in metadata", async () => {
      mockGetUserStats.mockResolvedValue({
        totalArticles: 10,
        totalImages: 50,
        successImages: 45,
        failedImages: 5,
        storageUsed: 1024 * 1024,
      });

      const result = await getWechatArticleStatsTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      expect(result.metadata?.executionTimeMs).toBeDefined();
      expect(result.metadata?.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should call service with correct userId", async () => {
      mockGetUserStats.mockResolvedValue({
        totalArticles: 1,
        totalImages: 0,
        successImages: 0,
        failedImages: 0,
        storageUsed: 0,
      });

      await getWechatArticleStatsTool.execute({}, mockContext);

      expect(wechatArticleService.getUserStats).toHaveBeenCalledWith(
        mockContext.userId,
      );
    });
  });
});
