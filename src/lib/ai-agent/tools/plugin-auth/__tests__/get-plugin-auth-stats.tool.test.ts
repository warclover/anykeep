/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * get-plugin-auth-stats.tool.ts 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { ToolContext } from "../../types";

// Mock 数据
let mockQueryResult: any = { data: [], error: null };

// Mock Supabase
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn(() => Promise.resolve(mockQueryResult)),
      })),
    }),
  ),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { getPluginAuthStatsTool } from "../get-plugin-auth-stats.tool";

describe("getPluginAuthStatsTool", () => {
  const mockContext: ToolContext = {
    userId: "test-user-123",
    conversationId: "test-conv-456",
  };

  const now = new Date();
  const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const pastDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentDate = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  const createMockAuth = (
    id: string,
    browser: string,
    isExpired = false,
    isRevoked = false,
  ) => ({
    id,
    browser,
    last_used_at: recentDate.toISOString(),
    expires_at: isExpired ? pastDate.toISOString() : futureDate.toISOString(),
    revoked_at: isRevoked ? recentDate.toISOString() : null,
    created_at: pastDate.toISOString(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryResult = { data: [], error: null };
  });

  describe("definition", () => {
    it("should have correct metadata", () => {
      expect(getPluginAuthStatsTool.definition.name).toBe(
        "get_plugin_auth_stats",
      );
      expect(getPluginAuthStatsTool.definition.category).toBe("query");
      expect(getPluginAuthStatsTool.definition.requiresConfirmation).toBe(
        false,
      );
      expect(getPluginAuthStatsTool.definition.estimatedDurationMs).toBe(200);
    });

    it("should have no required parameters", () => {
      const schema = getPluginAuthStatsTool.definition.parameters;
      expect(() => schema.parse({})).not.toThrow();
    });
  });

  describe("execute - empty state", () => {
    it("should return zeros when no authorizations", async () => {
      mockQueryResult = { data: [], error: null };

      const result = await getPluginAuthStatsTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalAuthorizations).toBe(0);
        expect(result.data.activeCount).toBe(0);
        expect(result.data.expiredCount).toBe(0);
        expect(result.data.revokedCount).toBe(0);
        expect(result.data.byBrowser).toHaveLength(0);
        expect(result.data.message).toContain("没有任何插件授权记录");
      }
    });
  });

  describe("execute - with data", () => {
    it("should calculate correct statistics", async () => {
      mockQueryResult = {
        data: [
          createMockAuth("1", "chrome"),
          createMockAuth("2", "chrome"),
          createMockAuth("3", "edge"),
          createMockAuth("4", "firefox", true), // expired
          createMockAuth("5", "chrome", false, true), // revoked
        ],
        error: null,
      };

      const result = await getPluginAuthStatsTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalAuthorizations).toBe(5);
        expect(result.data.activeCount).toBe(3);
        expect(result.data.expiredCount).toBe(1);
        expect(result.data.revokedCount).toBe(1);
      }
    });

    it("should group by browser correctly", async () => {
      mockQueryResult = {
        data: [
          createMockAuth("1", "chrome"),
          createMockAuth("2", "chrome"),
          createMockAuth("3", "edge"),
        ],
        error: null,
      };

      const result = await getPluginAuthStatsTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.byBrowser).toHaveLength(2);

        const chromeStats = result.data.byBrowser.find(
          (b) => b.browser === "chrome",
        );
        expect(chromeStats?.count).toBe(2);
        expect(chromeStats?.activeCount).toBe(2);
        expect(chromeStats?.label).toBe("Chrome");

        const edgeStats = result.data.byBrowser.find(
          (b) => b.browser === "edge",
        );
        expect(edgeStats?.count).toBe(1);
        expect(edgeStats?.activeCount).toBe(1);
        expect(edgeStats?.label).toBe("Edge");
      }
    });

    it("should include lastUsedDescription for browsers", async () => {
      mockQueryResult = {
        data: [createMockAuth("1", "chrome")],
        error: null,
      };

      const result = await getPluginAuthStatsTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        const chromeStats = result.data.byBrowser.find(
          (b) => b.browser === "chrome",
        );
        expect(chromeStats?.lastUsedDescription).toBeDefined();
        expect(chromeStats?.lastUsedDescription).toContain("小时前");
      }
    });

    it("should sort browsers by active count", async () => {
      mockQueryResult = {
        data: [
          createMockAuth("1", "edge"),
          createMockAuth("2", "chrome"),
          createMockAuth("3", "chrome"),
          createMockAuth("4", "chrome"),
        ],
        error: null,
      };

      const result = await getPluginAuthStatsTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        // Chrome (3) should come before Edge (1)
        expect(result.data.byBrowser[0].browser).toBe("chrome");
        expect(result.data.byBrowser[1].browser).toBe("edge");
      }
    });

    it("should generate correct message with browser summary", async () => {
      mockQueryResult = {
        data: [
          createMockAuth("1", "chrome"),
          createMockAuth("2", "chrome"),
          createMockAuth("3", "edge"),
        ],
        error: null,
      };

      const result = await getPluginAuthStatsTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toContain("3 个活跃");
        expect(result.data.message).toContain("Chrome 2 个");
        expect(result.data.message).toContain("Edge 1 个");
      }
    });
  });

  describe("execute - edge cases", () => {
    it("should handle all expired authorizations", async () => {
      mockQueryResult = {
        data: [
          createMockAuth("1", "chrome", true),
          createMockAuth("2", "edge", true),
        ],
        error: null,
      };

      const result = await getPluginAuthStatsTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.activeCount).toBe(0);
        expect(result.data.expiredCount).toBe(2);
        expect(result.data.message).toContain("没有有效的授权");
      }
    });

    it("should track oldest and newest active dates", async () => {
      const oldDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const newDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

      mockQueryResult = {
        data: [
          {
            ...createMockAuth("1", "chrome"),
            created_at: oldDate.toISOString(),
          },
          { ...createMockAuth("2", "edge"), created_at: newDate.toISOString() },
        ],
        error: null,
      };

      const result = await getPluginAuthStatsTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.oldestActiveDate).toBeDefined();
        expect(result.data.newestActiveDate).toBeDefined();
      }
    });
  });

  describe("execute - error handling", () => {
    it("should handle database errors", async () => {
      mockQueryResult = {
        data: null,
        error: { message: "Database connection failed" },
      };

      const result = await getPluginAuthStatsTool.execute({}, mockContext);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("获取授权统计失败");
        expect(result.errorCode).toBe("DB_ERROR");
      }
    });
  });

  describe("execute - metadata", () => {
    it("should include execution time in metadata", async () => {
      mockQueryResult = { data: [], error: null };

      const result = await getPluginAuthStatsTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      expect(result.metadata?.executionTimeMs).toBeDefined();
      expect(result.metadata?.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});
