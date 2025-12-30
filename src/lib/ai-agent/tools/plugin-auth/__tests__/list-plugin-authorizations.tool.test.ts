/**
 * list-plugin-authorizations.tool.ts 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { ToolContext } from "../../types";

// Mock 数据
let mockQueryResult: any = { data: [], error: null };

// 创建一个支持完整链式调用的 Mock 查询构建器
const createMockQueryBuilder = () => {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    is: jest.fn(() => builder),
    not: jest.fn(() => builder),
    gt: jest.fn(() => builder),
    lte: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    // 使其可被 await - 返回 mockQueryResult
    then: (resolve: any) => resolve(mockQueryResult),
  };
  return builder;
};

// Mock Supabase
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: jest.fn(() => createMockQueryBuilder()),
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

import { listPluginAuthorizationsTool } from "../list-plugin-authorizations.tool";

describe("listPluginAuthorizationsTool", () => {
  const mockContext: ToolContext = {
    userId: "test-user-123",
    conversationId: "test-conv-456",
  };

  const now = new Date();
  const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days later
  const pastDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
  const recentDate = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago

  const mockAuthorizationRow = {
    id: "auth-uuid-1",
    user_id: "test-user-123",
    browser: "chrome",
    extension_version: "1.2.0",
    created_at: pastDate.toISOString(),
    last_used_at: recentDate.toISOString(),
    expires_at: futureDate.toISOString(),
    revoked_at: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryResult = { data: [], error: null };
  });

  describe("definition", () => {
    it("should have correct metadata", () => {
      expect(listPluginAuthorizationsTool.definition.name).toBe(
        "list_plugin_authorizations",
      );
      expect(listPluginAuthorizationsTool.definition.category).toBe("query");
      expect(listPluginAuthorizationsTool.definition.requiresConfirmation).toBe(
        false,
      );
      expect(listPluginAuthorizationsTool.definition.estimatedDurationMs).toBe(
        200,
      );
    });

    it("should have valid parameters schema", () => {
      const schema = listPluginAuthorizationsTool.definition.parameters;
      const parsed = schema.parse({});
      expect(parsed.status).toBe("active");
      expect(parsed.limit).toBe(20);
    });

    it("should accept browser filter", () => {
      const schema = listPluginAuthorizationsTool.definition.parameters;
      const parsed = schema.parse({ browser: "chrome" });
      expect(parsed.browser).toBe("chrome");
    });
  });

  describe("execute - success cases", () => {
    it("should return empty list when no authorizations", async () => {
      mockQueryResult = { data: [], error: null };

      const result = await listPluginAuthorizationsTool.execute(
        {},
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.authorizations).toHaveLength(0);
        expect(result.data.total).toBe(0);
        expect(result.data.activeCount).toBe(0);
        expect(result.data.message).toContain("没有");
      }
    });

    it("should return authorizations list", async () => {
      mockQueryResult = {
        data: [mockAuthorizationRow],
        error: null,
      };

      const result = await listPluginAuthorizationsTool.execute(
        {},
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.authorizations).toHaveLength(1);
        expect(result.data.authorizations[0].browser).toBe("chrome");
        expect(result.data.authorizations[0].browserLabel).toBe("Chrome");
        expect(result.data.authorizations[0].status).toBe("active");
        expect(result.data.authorizations[0].lastUsedDescription).toBeDefined();
      }
    });

    it("should filter by browser", async () => {
      mockQueryResult = {
        data: [mockAuthorizationRow],
        error: null,
      };

      const result = await listPluginAuthorizationsTool.execute(
        { browser: "chrome" },
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toContain("Chrome");
      }
    });

    it("should handle multiple authorizations", async () => {
      mockQueryResult = {
        data: [
          mockAuthorizationRow,
          { ...mockAuthorizationRow, id: "auth-uuid-2", browser: "edge" },
          { ...mockAuthorizationRow, id: "auth-uuid-3", browser: "firefox" },
        ],
        error: null,
      };

      const result = await listPluginAuthorizationsTool.execute(
        {},
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.authorizations).toHaveLength(3);
        expect(result.data.total).toBe(3);
      }
    });

    it("should correctly identify expired authorizations", async () => {
      const expiredAuth = {
        ...mockAuthorizationRow,
        expires_at: pastDate.toISOString(), // Expired
      };
      mockQueryResult = { data: [expiredAuth], error: null };

      const result = await listPluginAuthorizationsTool.execute(
        { status: "all" },
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.authorizations[0].status).toBe("expired");
        expect(result.data.activeCount).toBe(0);
      }
    });

    it("should correctly identify revoked authorizations", async () => {
      const revokedAuth = {
        ...mockAuthorizationRow,
        revoked_at: recentDate.toISOString(),
      };
      mockQueryResult = { data: [revokedAuth], error: null };

      const result = await listPluginAuthorizationsTool.execute(
        { status: "all" },
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.authorizations[0].status).toBe("revoked");
      }
    });
  });

  describe("execute - error handling", () => {
    it("should handle database errors", async () => {
      mockQueryResult = {
        data: null,
        error: { message: "Database connection failed" },
      };

      const result = await listPluginAuthorizationsTool.execute(
        {},
        mockContext,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("查询授权列表失败");
        expect(result.errorCode).toBe("DB_ERROR");
      }
    });
  });

  describe("execute - metadata", () => {
    it("should include execution time in metadata", async () => {
      mockQueryResult = { data: [], error: null };

      const result = await listPluginAuthorizationsTool.execute(
        {},
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.executionTimeMs).toBeDefined();
      expect(result.metadata?.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});
