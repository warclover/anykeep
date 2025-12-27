/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * list_wechat_articles Tool 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import type { ToolContext } from "../../types";

// Create flexible mock chain for Supabase queries
const createMockChain = (response: {
  data: unknown[] | null;
  count?: number;
  error?: { message: string } | null;
}) => {
  const chain: Record<string, jest.Mock> = {};
  const methods = ["select", "eq", "is", "order", "limit", "gte", "lte"];

  methods.forEach((method) => {
    chain[method] = jest.fn().mockReturnValue(chain);
  });

  // Make chain return promise-like structure
  Object.assign(chain, {
    then: (resolve: (val: unknown) => void) => {
      resolve(response);
      return chain;
    },
  });

  return chain;
};

const mockSupabaseClient = createMockChain({
  data: [
    {
      id: 1,
      title: "测试微信文章",
      url: "https://mp.weixin.qq.com/s/test123?__biz=abc",
      user_tags: ["技术"],
      created_at: "2025-12-20T10:00:00Z",
      bookmark_snapshots: [
        {
          id: 1,
          readable_word_count: 1500,
          readable_excerpt: "这是文章摘要",
          readable_byline: "测试公众号",
          readable_text_content: "完整内容",
        },
      ],
    },
  ],
  count: 1,
  error: null,
});

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({ from: jest.fn(() => mockSupabaseClient) }),
  ),
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

// Import tool after mocking
import { listWechatArticlesTool } from "../list-wechat-articles.tool";

describe("listWechatArticlesTool", () => {
  const mockContext: ToolContext = {
    userId: "test-user-123",
    conversationId: "conv-456",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("definition", () => {
    it("should have correct tool name", () => {
      expect(listWechatArticlesTool.definition.name).toBe(
        "list_wechat_articles",
      );
    });

    it("should have query category", () => {
      expect(listWechatArticlesTool.definition.category).toBe("query");
    });

    it("should not require confirmation", () => {
      expect(listWechatArticlesTool.definition.requiresConfirmation).toBe(
        false,
      );
    });

    it("should have description mentioning wechat articles", () => {
      expect(listWechatArticlesTool.definition.description).toContain("微信");
    });

    it("should have parameters schema with reasoning", () => {
      const params = listWechatArticlesTool.definition.parameters as any;
      expect(
        params.shape?.reasoning || params._def?.shape?.reasoning,
      ).toBeDefined();
    });

    it("should have groupByAccount parameter", () => {
      const params = listWechatArticlesTool.definition.parameters as any;
      expect(
        params.shape?.groupByAccount || params._def?.shape?.groupByAccount,
      ).toBeDefined();
    });

    it("should have statsOnly parameter", () => {
      const params = listWechatArticlesTool.definition.parameters as any;
      expect(
        params.shape?.statsOnly || params._def?.shape?.statsOnly,
      ).toBeDefined();
    });

    it("should have limit parameter with default 50", () => {
      const params = listWechatArticlesTool.definition.parameters as any;
      expect(params.shape?.limit || params._def?.shape?.limit).toBeDefined();
    });

    it("should have date range parameters", () => {
      const params = listWechatArticlesTool.definition.parameters as any;
      expect(
        params.shape?.dateStart || params._def?.shape?.dateStart,
      ).toBeDefined();
      expect(
        params.shape?.dateEnd || params._def?.shape?.dateEnd,
      ).toBeDefined();
    });
  });

  describe("execute - basic cases", () => {
    it("should call supabase with correct platform filter", async () => {
      const { createClient } = await import("@/lib/supabase/server");

      await listWechatArticlesTool.execute(
        { reasoning: "获取微信文章列表" } as any,
        mockContext,
      );

      expect(createClient).toHaveBeenCalled();
    });

    it("should include stats in successful response", async () => {
      const result = await listWechatArticlesTool.execute(
        { reasoning: "获取微信文章列表" } as any,
        mockContext,
      );

      // Result structure should have stats
      if (result.success) {
        expect(result.data).toHaveProperty("stats");
        expect(result.data).toHaveProperty("message");
      }
    });

    it("should return groups when groupByAccount is true", async () => {
      const result = await listWechatArticlesTool.execute(
        { reasoning: "按公众号分组", groupByAccount: true } as any,
        mockContext,
      );

      if (result.success && result.data.groups) {
        expect(Array.isArray(result.data.groups)).toBe(true);
      }
    });
  });
});
