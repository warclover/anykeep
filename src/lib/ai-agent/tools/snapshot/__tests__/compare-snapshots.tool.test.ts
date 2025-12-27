/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Compare Snapshots Tool 单元测试
 *
 * @description 测试快照对比工具的核心功能
 */

import type {
  ToolContext,
  ToolSuccessResult,
  ToolErrorResult,
} from "../../types";

// Mock Supabase
const _mockSingle = jest.fn();
const _mockLimit = jest.fn();
const _mockOrder = jest.fn();
const _mockEq = jest.fn();
const _mockSelect = jest.fn();
const _mockFrom = jest.fn();

const createMockChain = () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
  };
  return chain;
};

const mockSupabaseClient = {
  from: jest.fn(() => createMockChain()),
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

// Import tool after mocking
import { compareSnapshotsTool } from "../compare-snapshots.tool";

describe("Compare Snapshots Tool", () => {
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

  describe("definition", () => {
    it("正确定义 Tool 元数据", () => {
      expect(compareSnapshotsTool.definition.name).toBe("compare_snapshots");
      expect(compareSnapshotsTool.definition.category).toBe("query");
      expect(compareSnapshotsTool.definition.requiresConfirmation).toBe(false);
      expect(compareSnapshotsTool.definition.description).toContain("对比");
    });

    it("参数 Schema 正确验证", () => {
      const validParams = { snapshotId: 1 };
      const result =
        compareSnapshotsTool.definition.parameters.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it("参数 Schema 拒绝无效输入", () => {
      const invalidParams = { snapshotId: "abc" };
      const result =
        compareSnapshotsTool.definition.parameters.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it("支持可选的 compareWithSnapshotId 参数", () => {
      const params = { snapshotId: 1, compareWithSnapshotId: 2 };
      const result =
        compareSnapshotsTool.definition.parameters.safeParse(params);
      expect(result.success).toBe(true);
    });

    it("支持可选的 versionNumber 参数", () => {
      const params = { snapshotId: 1, versionNumber: 3 };
      const result =
        compareSnapshotsTool.definition.parameters.safeParse(params);
      expect(result.success).toBe(true);
    });
  });

  describe("execute", () => {
    const setupMockChain = (responses: Record<string, any>) => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        const chain = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
        };

        // 设置最终返回值
        if (responses[table]) {
          if (responses[table].useSingle) {
            chain.single.mockResolvedValue(responses[table].result);
          } else {
            chain.limit.mockReturnValue({
              single: jest.fn().mockResolvedValue(responses[table].result),
            });
          }
        } else {
          chain.single.mockResolvedValue({
            data: null,
            error: { message: "Not found" },
          });
        }

        return chain;
      });
    };

    it("源快照不存在时返回错误", async () => {
      setupMockChain({
        bookmark_snapshots: {
          useSingle: true,
          result: { data: null, error: { message: "Not found" } },
        },
      });

      const result = await compareSnapshotsTool.execute(
        { snapshotId: 999 },
        mockContext,
      );

      expect(result.success).toBe(false);
      expect((result as ToolErrorResult).error).toContain("源快照不存在");
    });

    it("无权访问时返回错误", async () => {
      setupMockChain({
        bookmark_snapshots: {
          useSingle: true,
          result: {
            data: {
              id: 1,
              bookmark_id: 100,
              content_hash: "abc123",
              readable_text_content: "Test content",
              word_count: 10,
              captured_at: "2025-12-20T10:00:00Z",
              bookmarks: {
                id: 100,
                title: "Test Bookmark",
                user_id: "other-user-456", // 不同的用户
              },
            },
            error: null,
          },
        },
      });

      const result = await compareSnapshotsTool.execute(
        { snapshotId: 1 },
        mockContext,
      );

      expect(result.success).toBe(false);
      expect((result as ToolErrorResult).error).toContain("无权访问");
    });

    it("指定对比目标快照不存在时返回错误", async () => {
      // 第一次调用返回源快照
      const callCount = { bookmark_snapshots: 0 };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        const chain = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
        };

        if (table === "bookmark_snapshots") {
          callCount.bookmark_snapshots++;
          if (callCount.bookmark_snapshots === 1) {
            // 源快照存在
            chain.single.mockResolvedValue({
              data: {
                id: 1,
                bookmark_id: 100,
                content_hash: "abc123",
                readable_text_content: "Test content",
                word_count: 10,
                captured_at: "2025-12-20T10:00:00Z",
                bookmarks: {
                  id: 100,
                  title: "Test Bookmark",
                  user_id: mockContext.userId,
                },
              },
              error: null,
            });
          } else {
            // 对比目标不存在
            chain.single.mockResolvedValue({
              data: null,
              error: { message: "Not found" },
            });
          }
        }

        return chain;
      });

      const result = await compareSnapshotsTool.execute(
        { snapshotId: 1, compareWithSnapshotId: 999 },
        mockContext,
      );

      expect(result.success).toBe(false);
      expect((result as ToolErrorResult).error).toContain("对比目标快照不存在");
    });

    it("成功对比两个快照并返回差异", async () => {
      const sourceContent = "Hello World\nThis is line 2\nThis is line 3";
      const targetContent =
        "Hello World\nThis is modified line 2\nThis is line 3";

      const callCount = { bookmark_snapshots: 0 };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        const chain = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
        };

        if (table === "bookmark_snapshots") {
          callCount.bookmark_snapshots++;
          if (callCount.bookmark_snapshots === 1) {
            chain.single.mockResolvedValue({
              data: {
                id: 1,
                bookmark_id: 100,
                content_hash: "hash1",
                readable_text_content: sourceContent,
                word_count: 10,
                captured_at: "2025-12-21T10:00:00Z",
                bookmarks: {
                  id: 100,
                  title: "Test Bookmark",
                  user_id: mockContext.userId,
                },
              },
              error: null,
            });
          } else {
            chain.single.mockResolvedValue({
              data: {
                id: 2,
                content_hash: "hash2",
                readable_text_content: targetContent,
                word_count: 10,
                captured_at: "2025-12-20T10:00:00Z",
              },
              error: null,
            });
          }
        }

        return chain;
      });

      const result = await compareSnapshotsTool.execute(
        { snapshotId: 1, compareWithSnapshotId: 2 },
        mockContext,
      );

      expect(result.success).toBe(true);
      const data = (result as ToolSuccessResult<any>).data;
      expect(data.source.id).toBe(1);
      expect(data.target.id).toBe(2);
      expect(data.stats).toBeDefined();
      expect(data.changes).toBeDefined();
      expect(data.summary).toBeDefined();
    });

    it("内容完全相同时返回无变化", async () => {
      const sameContent = "Hello World\nThis is line 2";

      const callCount = { bookmark_snapshots: 0 };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        const chain = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
        };

        if (table === "bookmark_snapshots") {
          callCount.bookmark_snapshots++;
          if (callCount.bookmark_snapshots === 1) {
            chain.single.mockResolvedValue({
              data: {
                id: 1,
                bookmark_id: 100,
                content_hash: "samehash",
                readable_text_content: sameContent,
                word_count: 5,
                captured_at: "2025-12-21T10:00:00Z",
                bookmarks: {
                  id: 100,
                  title: "Test Bookmark",
                  user_id: mockContext.userId,
                },
              },
              error: null,
            });
          } else {
            chain.single.mockResolvedValue({
              data: {
                id: 2,
                content_hash: "samehash",
                readable_text_content: sameContent,
                word_count: 5,
                captured_at: "2025-12-20T10:00:00Z",
              },
              error: null,
            });
          }
        }

        return chain;
      });

      const result = await compareSnapshotsTool.execute(
        { snapshotId: 1, compareWithSnapshotId: 2 },
        mockContext,
      );

      expect(result.success).toBe(true);
      const data = (result as ToolSuccessResult<any>).data;
      expect(data.stats.totalChanges).toBe(0);
      expect(data.stats.similarityScore).toBe(100);
      expect(data.hasSignificantChanges).toBe(false);
      expect(data.summary).toContain("没有变化");
    });

    it("显著变更时正确标记", async () => {
      // 内容完全不同
      const sourceContent = "Completely new content with different text";
      const targetContent = "Old content that is totally different from source";

      const callCount = { bookmark_snapshots: 0 };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        const chain = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
        };

        if (table === "bookmark_snapshots") {
          callCount.bookmark_snapshots++;
          if (callCount.bookmark_snapshots === 1) {
            chain.single.mockResolvedValue({
              data: {
                id: 1,
                bookmark_id: 100,
                content_hash: "hash1",
                readable_text_content: sourceContent,
                word_count: 7,
                captured_at: "2025-12-21T10:00:00Z",
                bookmarks: {
                  id: 100,
                  title: "Test Bookmark",
                  user_id: mockContext.userId,
                },
              },
              error: null,
            });
          } else {
            chain.single.mockResolvedValue({
              data: {
                id: 2,
                content_hash: "hash2",
                readable_text_content: targetContent,
                word_count: 8,
                captured_at: "2025-12-20T10:00:00Z",
              },
              error: null,
            });
          }
        }

        return chain;
      });

      const result = await compareSnapshotsTool.execute(
        { snapshotId: 1, compareWithSnapshotId: 2 },
        mockContext,
      );

      expect(result.success).toBe(true);
      const data = (result as ToolSuccessResult<any>).data;
      expect(data.stats.totalChanges).toBeGreaterThan(0);
      expect(data.stats.similarityScore).toBeLessThan(80);
      expect(data.hasSignificantChanges).toBe(true);
      expect(data.summary).toContain("显著变更");
    });
  });
});
