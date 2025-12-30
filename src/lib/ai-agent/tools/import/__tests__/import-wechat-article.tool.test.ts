/**
 * import_wechat_article Tool 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import type { ToolContext } from "../../types";

// Mock wechat-article module
jest.mock("@/lib/wechat-article", () => ({
  isWechatArticleUrl: jest.fn((url: string) =>
    url.includes("mp.weixin.qq.com"),
  ),
  autoFetchWechatArticle: jest.fn(),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Create mock Supabase chain factory
const createMockFromChain = (responses: {
  selectResponse?: { data: any; error: any };
  insertResponse?: { data: any; error: any };
}) => {
  const chain: any = {};

  // All chain methods return chain for fluent API
  ["select", "eq", "is", "single", "order", "limit"].forEach((method) => {
    chain[method] = jest.fn().mockReturnValue(chain);
  });

  // Override single to return selectResponse (for checking existing)
  chain.single = jest
    .fn()
    .mockResolvedValue(responses.selectResponse || { data: null, error: null });

  // Insert returns different chain
  chain.insert = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue(
        responses.insertResponse || {
          data: null,
          error: { message: "No insert response" },
        },
      ),
    }),
  });

  return chain;
};

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

// Import tool after mocking
import { importWechatArticleTool } from "../import-wechat-article.tool";
import {
  isWechatArticleUrl,
  autoFetchWechatArticle,
} from "@/lib/wechat-article";
import { createClient } from "@/lib/supabase/server";

describe("importWechatArticleTool", () => {
  const mockContext: ToolContext = {
    userId: "test-user-123",
    conversationId: "conv-456",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock setup - no existing bookmark, successful insert
    const mockChain = createMockFromChain({
      selectResponse: { data: null, error: null },
      insertResponse: {
        data: {
          id: 1,
          title: "微信文章 (获取中...)",
          url: "https://mp.weixin.qq.com/s/test",
          created_at: "2025-12-27T10:00:00Z",
        },
        error: null,
      },
    });

    (createClient as jest.Mock).mockResolvedValue({
      from: jest.fn().mockReturnValue(mockChain),
    });
  });

  describe("definition", () => {
    it("should have correct tool name", () => {
      expect(importWechatArticleTool.definition.name).toBe(
        "import_wechat_article",
      );
    });

    it("should have action category", () => {
      expect(importWechatArticleTool.definition.category).toBe("action");
    });

    it("should not require confirmation", () => {
      expect(importWechatArticleTool.definition.requiresConfirmation).toBe(
        false,
      );
    });

    it("should have description mentioning wechat import", () => {
      expect(importWechatArticleTool.definition.description).toContain("微信");
      expect(importWechatArticleTool.definition.description).toContain("导入");
    });

    it("should have required url parameter", () => {
      const params = importWechatArticleTool.definition.parameters as any;
      expect(params.shape?.url || params._def?.shape?.url).toBeDefined();
    });

    it("should have reasoning parameter", () => {
      const params = importWechatArticleTool.definition.parameters as any;
      expect(
        params.shape?.reasoning || params._def?.shape?.reasoning,
      ).toBeDefined();
    });

    it("should have optional folderId parameter", () => {
      const params = importWechatArticleTool.definition.parameters as any;
      expect(
        params.shape?.folderId || params._def?.shape?.folderId,
      ).toBeDefined();
    });

    it("should have optional tags parameter", () => {
      const params = importWechatArticleTool.definition.parameters as any;
      expect(params.shape?.tags || params._def?.shape?.tags).toBeDefined();
    });

    it("should have crawlImmediately parameter", () => {
      const params = importWechatArticleTool.definition.parameters as any;
      expect(
        params.shape?.crawlImmediately || params._def?.shape?.crawlImmediately,
      ).toBeDefined();
    });
  });

  describe("execute - URL validation", () => {
    it("should reject non-wechat URLs", async () => {
      (isWechatArticleUrl as jest.Mock).mockReturnValue(false);

      const result = await importWechatArticleTool.execute(
        {
          url: "https://example.com/article",
          reasoning: "导入文章",
          crawlImmediately: true,
        },
        mockContext,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("微信公众号");
      }
    });

    it("should validate URL using isWechatArticleUrl", async () => {
      (isWechatArticleUrl as jest.Mock).mockReturnValue(true);

      await importWechatArticleTool.execute(
        {
          url: "https://mp.weixin.qq.com/s/test123",
          reasoning: "导入文章",
          crawlImmediately: true,
        },
        mockContext,
      );

      expect(isWechatArticleUrl).toHaveBeenCalledWith(
        "https://mp.weixin.qq.com/s/test123",
      );
    });
  });

  describe("execute - successful import", () => {
    beforeEach(() => {
      (isWechatArticleUrl as jest.Mock).mockReturnValue(true);
      (autoFetchWechatArticle as jest.Mock).mockImplementation(jest.fn());
    });

    it("should return success with bookmark data", async () => {
      const result = await importWechatArticleTool.execute(
        {
          url: "https://mp.weixin.qq.com/s/test123",
          reasoning: "导入微信文章",
          crawlImmediately: true,
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty("bookmark");
        expect(result.data).toHaveProperty("message");
        expect(result.data).toHaveProperty("crawlStatus");
        expect(result.data).toHaveProperty("isExisting");
      }
    });

    it("should include execution metadata", async () => {
      const result = await importWechatArticleTool.execute(
        {
          url: "https://mp.weixin.qq.com/s/test123",
          reasoning: "导入微信文章",
          crawlImmediately: true,
        },
        mockContext,
      );

      expect(result.metadata).toBeDefined();
      expect(result.metadata!.executionTimeMs).toBeDefined();
    });

    it("should trigger auto-fetch by default", async () => {
      await importWechatArticleTool.execute(
        {
          url: "https://mp.weixin.qq.com/s/test123",
          reasoning: "导入微信文章",
          crawlImmediately: true,
        },
        mockContext,
      );

      // autoFetchWechatArticle should be called with (id, userId, url)
      expect(autoFetchWechatArticle).toHaveBeenCalled();
    });

    it("should handle auto-fetch failure gracefully", async () => {
      // Auto-fetch throws but import should still succeed
      (autoFetchWechatArticle as jest.Mock).mockImplementation(() => {
        throw new Error("Fetch failed");
      });

      const result = await importWechatArticleTool.execute(
        {
          url: "https://mp.weixin.qq.com/s/test123",
          reasoning: "导入文章",
          crawlImmediately: true,
        },
        mockContext,
      );

      // Import should still succeed
      expect(result.success).toBe(true);
    });
  });

  describe("execute - existing bookmark", () => {
    it("should return existing bookmark info when URL already saved", async () => {
      (isWechatArticleUrl as jest.Mock).mockReturnValue(true);

      const mockChain = createMockFromChain({
        selectResponse: {
          data: { id: 99, title: "已存在的文章" },
          error: null,
        },
        insertResponse: { data: null, error: null },
      });

      (createClient as jest.Mock).mockResolvedValue({
        from: jest.fn().mockReturnValue(mockChain),
      });

      const result = await importWechatArticleTool.execute(
        {
          url: "https://mp.weixin.qq.com/s/existing",
          reasoning: "导入文章",
          crawlImmediately: true,
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isExisting).toBe(true);
      }
    });
  });
});
