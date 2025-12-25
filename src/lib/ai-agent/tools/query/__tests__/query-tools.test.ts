/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Query Tools 单元测试
 *
 * @description 测试查询类 Tools 的核心功能
 */

import type { ToolContext, ToolSuccessResult, ToolErrorResult } from "../../types";

// Mock Supabase
const mockSelect = jest.fn();
const mockFrom = jest.fn(() => ({
  select: mockSelect,
}));
const mockSupabaseClient = {
  from: mockFrom,
};

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
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

// Import tools after mocking
import { listRecentTool } from "../list-recent.tool";
import { countTotalTool } from "../count-total.tool";
import { getStatsTool } from "../get-stats.tool";

describe("Query Tools", () => {
  const mockContext: ToolContext = {
    userId: "test-user-123",
    conversationId: "conv-456",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("listRecentTool", () => {
    describe("definition", () => {
      it("正确定义 Tool 元数据", () => {
        expect(listRecentTool.definition.name).toBe("list_recent");
        expect(listRecentTool.definition.category).toBe("query");
        expect(listRecentTool.definition.requiresConfirmation).toBe(false);
        expect(listRecentTool.definition.description).toContain("最近收藏");
      });
    });

    describe("execute", () => {
      const createMockChain = (result: {
        data: unknown[] | null;
        count?: number | null;
        error?: { message: string } | null;
      }) => {
        const chain = {
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue(result),
        };
        mockSelect.mockReturnValue(chain);
        return chain;
      };

      it("成功返回最近书签列表", async () => {
        const mockBookmarks = [
          {
            id: 1,
            title: "React 教程",
            url: "https://react.dev",
            platform: "WECHAT",
            user_tags: ["react", "frontend"],
            created_at: "2025-12-20T10:00:00Z",
          },
          {
            id: 2,
            title: "Vue 入门",
            url: "https://vuejs.org",
            platform: "JUEJIN",
            user_tags: ["vue"],
            created_at: "2025-12-19T10:00:00Z",
          },
        ];

        createMockChain({
          data: mockBookmarks,
          count: 50,
          error: null,
        });

        const result = await listRecentTool.execute({ limit: 10 }, mockContext);

        expect(result.success).toBe(true);
        const successResult = result as ToolSuccessResult<{ bookmarks: unknown[]; total: number }>;
        expect(successResult.data.bookmarks).toHaveLength(2);
        expect((successResult.data.bookmarks[0] as { title: string }).title).toBe("React 教程");
        expect((successResult.data.bookmarks[0] as { tags: string[] }).tags).toEqual(["react", "frontend"]);
        expect(successResult.data.total).toBe(50);
        expect(result.metadata?.executionTimeMs).toBeGreaterThanOrEqual(0);
      });

      it("使用默认 limit 值", async () => {
        const chain = createMockChain({ data: [], count: 0, error: null });

        await listRecentTool.execute({ limit: 10 }, mockContext);

        expect(chain.limit).toHaveBeenCalledWith(10);
      });

      it("处理空结果", async () => {
        createMockChain({ data: [], count: 0, error: null });

        const result = await listRecentTool.execute({ limit: 5 }, mockContext);

        expect(result.success).toBe(true);
        const successResult = result as ToolSuccessResult<{ bookmarks: unknown[]; total: number }>;
        expect(successResult.data.bookmarks).toEqual([]);
        expect(successResult.data.total).toBe(0);
      });

      it("处理 null 数据", async () => {
        createMockChain({ data: null, count: null, error: null });

        const result = await listRecentTool.execute({ limit: 5 }, mockContext);

        expect(result.success).toBe(true);
        const successResult = result as ToolSuccessResult<{ bookmarks: unknown[]; total: number }>;
        expect(successResult.data.bookmarks).toEqual([]);
        expect(successResult.data.total).toBe(0);
      });

      it("处理数据库错误", async () => {
        createMockChain({
          data: null,
          error: { message: "Connection refused" },
        });

        const result = await listRecentTool.execute({ limit: 5 }, mockContext);

        expect(result.success).toBe(false);
        const errorResult = result as ToolErrorResult;
        expect(errorResult.error).toBe("Connection refused");
        expect(errorResult.errorCode).toBe("DB_ERROR");
      });

      it("处理缺失字段", async () => {
        const mockBookmarks = [
          {
            id: 1,
            title: null,
            url: "https://example.com",
            platform: null,
            user_tags: null,
            created_at: "2025-12-20T10:00:00Z",
          },
        ];

        createMockChain({ data: mockBookmarks, count: 1, error: null });

        const result = await listRecentTool.execute({ limit: 5 }, mockContext);

        expect(result.success).toBe(true);
        const successResult = result as ToolSuccessResult<{ bookmarks: Array<{ title: string; platform: string; tags: string[] }>; total: number }>;
        expect(successResult.data.bookmarks[0].title).toBe("");
        expect(successResult.data.bookmarks[0].platform).toBe("OTHER");
        expect(successResult.data.bookmarks[0].tags).toEqual([]);
      });

      it("记录执行日志", async () => {
        createMockChain({ data: [], count: 0, error: null });

        await listRecentTool.execute({ limit: 5 }, mockContext);

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { logger } = require("@/lib/logger");
        expect(logger.info).toHaveBeenCalledWith(
          expect.objectContaining({
            toolName: "list_recent",
            userId: "test-user-123",
          }),
          expect.any(String),
        );
      });
    });
  });

  describe("countTotalTool", () => {
    describe("definition", () => {
      it("正确定义 Tool 元数据", () => {
        expect(countTotalTool.definition.name).toBe("count_total");
        expect(countTotalTool.definition.category).toBe("query");
        expect(countTotalTool.definition.requiresConfirmation).toBe(false);
      });
    });

    describe("execute", () => {
      const createMockChain = (result: {
        count?: number | null;
        error?: { message: string } | null;
      }) => {
        const chain = {
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockResolvedValue(result),
        };
        mockSelect.mockReturnValue(chain);
        return chain;
      };

      it("成功返回收藏总数", async () => {
        createMockChain({ count: 150, error: null });

        const result = await countTotalTool.execute({}, mockContext);

        expect(result.success).toBe(true);
        const successResult = result as ToolSuccessResult<{ total: number }>;
        expect(successResult.data.total).toBe(150);
        expect(result.metadata?.affectedCount).toBe(150);
      });

      it("处理零收藏", async () => {
        createMockChain({ count: 0, error: null });

        const result = await countTotalTool.execute({}, mockContext);

        expect(result.success).toBe(true);
        const successResult = result as ToolSuccessResult<{ total: number }>;
        expect(successResult.data.total).toBe(0);
      });

      it("处理 null count", async () => {
        createMockChain({ count: null, error: null });

        const result = await countTotalTool.execute({}, mockContext);

        expect(result.success).toBe(true);
        const successResult = result as ToolSuccessResult<{ total: number }>;
        expect(successResult.data.total).toBe(0);
      });

      it("处理数据库错误", async () => {
        createMockChain({ error: { message: "Permission denied" } });

        const result = await countTotalTool.execute({}, mockContext);

        expect(result.success).toBe(false);
        const errorResult = result as ToolErrorResult;
        expect(errorResult.error).toBe("Permission denied");
        expect(errorResult.errorCode).toBe("DB_ERROR");
      });
    });
  });

  describe("getStatsTool", () => {
    describe("definition", () => {
      it("正确定义 Tool 元数据", () => {
        expect(getStatsTool.definition.name).toBe("get_stats");
        expect(getStatsTool.definition.category).toBe("query");
        expect(getStatsTool.definition.requiresConfirmation).toBe(false);
        expect(getStatsTool.definition.description).toContain("统计信息");
      });
    });

    describe("execute", () => {
      const createMockChains = (options: {
        bookmarks?: unknown[];
        foldersCount?: number;
        ratedBookmarks?: { rating: number }[];
        error?: { message: string };
      }) => {
        const bookmarksChain = {
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          not: jest.fn().mockResolvedValue({
            data: options.bookmarks ?? [],
            error: options.error ?? null,
          }),
        };

        const foldersChain = {
          eq: jest.fn().mockResolvedValue({
            count: options.foldersCount ?? 0,
            error: null,
          }),
        };

        const ratedChain = {
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
        };

        // Handle the nested not calls for rated bookmarks
        let notCallCount = 0;
        ratedChain.not.mockImplementation(() => {
          notCallCount++;
          if (notCallCount === 2) {
            // Second not() call returns the result
            return Promise.resolve({
              data: options.ratedBookmarks ?? [],
              error: null,
            });
          }
          return ratedChain;
        });

        mockSelect.mockImplementation(
          (fields: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.head) {
              // folders count query
              return foldersChain;
            }
            if (fields.includes("rating") && !fields.includes("platform")) {
              // rated bookmarks query
              return ratedChain;
            }
            // bookmarks query
            return bookmarksChain;
          },
        );

        return { bookmarksChain, foldersChain, ratedChain };
      };

      it("成功返回完整统计信息", async () => {
        const now = new Date();
        const recentDate = new Date(
          now.getTime() - 2 * 24 * 60 * 60 * 1000,
        ).toISOString();

        const mockBookmarks = [
          {
            id: 1,
            platform: "WECHAT",
            user_tags: ["react", "frontend"],
            rating: 5,
            created_at: recentDate,
          },
          {
            id: 2,
            platform: "WECHAT",
            user_tags: ["react"],
            rating: 4,
            created_at: recentDate,
          },
          {
            id: 3,
            platform: "JUEJIN",
            user_tags: ["vue"],
            rating: null,
            created_at: recentDate,
          },
        ];

        createMockChains({
          bookmarks: mockBookmarks,
          foldersCount: 5,
          ratedBookmarks: [{ rating: 5 }, { rating: 4 }],
        });

        const result = await getStatsTool.execute(
          {
            include_trends: true,
            include_tags: true,
            include_platforms: true,
            tags_limit: 10,
          },
          mockContext,
        );

        expect(result.success).toBe(true);
        const successResult = result as ToolSuccessResult<any>;
        expect(successResult.data.overview).toBeDefined();
        expect(successResult.data.overview.totalBookmarks).toBe(3);
        expect(successResult.data.overview.totalFolders).toBe(5);
        expect(successResult.data.overview.totalTags).toBe(3); // react, frontend, vue
        expect(successResult.data.trends).toBeDefined();
        expect(successResult.data.topTags).toBeDefined();
        expect(successResult.data.platforms).toBeDefined();
      });

      it("只返回总览统计（禁用可选项）", async () => {
        createMockChains({
          bookmarks: [],
          foldersCount: 0,
          ratedBookmarks: [],
        });

        const result = await getStatsTool.execute(
          {
            include_trends: false,
            include_tags: false,
            include_platforms: false,
            tags_limit: 10,
          },
          mockContext,
        );

        expect(result.success).toBe(true);
        const successResult = result as ToolSuccessResult<any>;
        expect(successResult.data.overview).toBeDefined();
        expect(successResult.data.trends).toBeUndefined();
        expect(successResult.data.topTags).toBeUndefined();
        expect(successResult.data.platforms).toBeUndefined();
      });

      it("处理空数据", async () => {
        createMockChains({
          bookmarks: [],
          foldersCount: 0,
          ratedBookmarks: [],
        });

        const result = await getStatsTool.execute({ include_trends: true, include_tags: true, include_platforms: true, tags_limit: 10 }, mockContext);

        expect(result.success).toBe(true);
        const successResult = result as ToolSuccessResult<any>;
        expect(successResult.data.overview.totalBookmarks).toBe(0);
        expect(successResult.data.overview.totalTags).toBe(0);
        expect(successResult.data.overview.averageRating).toBeUndefined();
      });

      it("处理数据库错误", async () => {
        createMockChains({
          error: { message: "Query timeout" },
        });

        const result = await getStatsTool.execute({ include_trends: true, include_tags: true, include_platforms: true, tags_limit: 10 }, mockContext);

        expect(result.success).toBe(false);
        const errorResult = result as ToolErrorResult;
        expect(errorResult.error).toBe("Query timeout");
        expect(errorResult.errorCode).toBe("DB_ERROR");
      });

      it("正确计算平均评分", async () => {
        createMockChains({
          bookmarks: [
            {
              id: 1,
              platform: "WECHAT",
              user_tags: [],
              rating: 5,
              created_at: new Date().toISOString(),
            },
            {
              id: 2,
              platform: "WECHAT",
              user_tags: [],
              rating: 3,
              created_at: new Date().toISOString(),
            },
          ],
          foldersCount: 1,
          ratedBookmarks: [{ rating: 5 }, { rating: 3 }],
        });

        const result = await getStatsTool.execute(
          {
            include_trends: false,
            include_tags: false,
            include_platforms: false,
            tags_limit: 10,
          },
          mockContext,
        );

        expect(result.success).toBe(true);
        const successResult = result as ToolSuccessResult<any>;
        expect(successResult.data.overview.ratedBookmarks).toBe(2);
        expect(successResult.data.overview.averageRating).toBe(4); // (5 + 3) / 2
      });

      it("正确排序热门标签", async () => {
        createMockChains({
          bookmarks: [
            {
              id: 1,
              platform: "WECHAT",
              user_tags: ["react", "js"],
              rating: null,
              created_at: new Date().toISOString(),
            },
            {
              id: 2,
              platform: "WECHAT",
              user_tags: ["react", "js"],
              rating: null,
              created_at: new Date().toISOString(),
            },
            {
              id: 3,
              platform: "WECHAT",
              user_tags: ["react"],
              rating: null,
              created_at: new Date().toISOString(),
            },
            {
              id: 4,
              platform: "WECHAT",
              user_tags: ["vue"],
              rating: null,
              created_at: new Date().toISOString(),
            },
          ],
          foldersCount: 0,
          ratedBookmarks: [],
        });

        const result = await getStatsTool.execute(
          {
            include_trends: false,
            include_tags: true,
            include_platforms: false,
            tags_limit: 10,
          },
          mockContext,
        );

        expect(result.success).toBe(true);
        const successResult = result as ToolSuccessResult<any>;
        expect(successResult.data.topTags).toBeDefined();
        expect(successResult.data.topTags[0].name).toBe("react");
        expect(successResult.data.topTags[0].count).toBe(3);
        expect(successResult.data.topTags[1].name).toBe("js");
        expect(successResult.data.topTags[1].count).toBe(2);
      });

      it("正确计算平台分布百分比", async () => {
        createMockChains({
          bookmarks: [
            {
              id: 1,
              platform: "WECHAT",
              user_tags: [],
              rating: null,
              created_at: new Date().toISOString(),
            },
            {
              id: 2,
              platform: "WECHAT",
              user_tags: [],
              rating: null,
              created_at: new Date().toISOString(),
            },
            {
              id: 3,
              platform: "WECHAT",
              user_tags: [],
              rating: null,
              created_at: new Date().toISOString(),
            },
            {
              id: 4,
              platform: "JUEJIN",
              user_tags: [],
              rating: null,
              created_at: new Date().toISOString(),
            },
          ],
          foldersCount: 0,
          ratedBookmarks: [],
        });

        const result = await getStatsTool.execute(
          {
            include_trends: false,
            include_tags: false,
            include_platforms: true,
            tags_limit: 10,
          },
          mockContext,
        );

        expect(result.success).toBe(true);
        const successResult = result as ToolSuccessResult<any>;
        expect(successResult.data.platforms).toBeDefined();

        const wechat = successResult.data.platforms.find(
          (p: { platform: string }) => p.platform === "WECHAT",
        );
        const juejin = successResult.data.platforms.find(
          (p: { platform: string }) => p.platform === "JUEJIN",
        );

        expect(wechat?.count).toBe(3);
        expect(wechat?.percentage).toBe(75); // 3/4 = 75%
        expect(juejin?.count).toBe(1);
        expect(juejin?.percentage).toBe(25); // 1/4 = 25%
      });
    });
  });
});
