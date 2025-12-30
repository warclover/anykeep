/**
 * revoke-all-plugin-authorizations.tool.ts 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { ToolContext } from "../../types";

// Mock 数据
let mockRpcResult: any = { data: 0, error: null };
let mockUpdateResult: any = { data: [], error: null };

// Mock Supabase
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      rpc: jest.fn(() => Promise.resolve(mockRpcResult)),
      from: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        select: jest.fn(() => Promise.resolve(mockUpdateResult)),
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

import { revokeAllPluginAuthorizationsTool } from "../revoke-all-plugin-authorizations.tool";

describe("revokeAllPluginAuthorizationsTool", () => {
  const mockContext: ToolContext = {
    userId: "test-user-123",
    conversationId: "test-conv-456",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRpcResult = { data: 0, error: null };
    mockUpdateResult = { data: [], error: null };
  });

  describe("definition", () => {
    it("should have correct metadata", () => {
      expect(revokeAllPluginAuthorizationsTool.definition.name).toBe(
        "revoke_all_plugin_authorizations",
      );
      expect(revokeAllPluginAuthorizationsTool.definition.category).toBe(
        "action",
      );
      expect(
        revokeAllPluginAuthorizationsTool.definition.requiresConfirmation,
      ).toBe(true);
      expect(
        revokeAllPluginAuthorizationsTool.definition.estimatedDurationMs,
      ).toBe(300);
    });

    it("should accept optional browser filter", () => {
      const schema = revokeAllPluginAuthorizationsTool.definition.parameters;

      // No browser - should pass
      expect(() => schema.parse({})).not.toThrow();

      // With browser - should pass
      expect(() => schema.parse({ browser: "chrome" })).not.toThrow();
    });
  });

  describe("execute - revoke all", () => {
    it("should revoke all authorizations successfully", async () => {
      mockRpcResult = { data: 3, error: null };

      const result = await revokeAllPluginAuthorizationsTool.execute(
        {},
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.revokedCount).toBe(3);
        expect(result.data.browser).toBeNull();
        expect(result.data.message).toContain("已撤销所有");
        expect(result.data.message).toContain("3");
      }
    });

    it("should return zero count when no authorizations", async () => {
      mockRpcResult = { data: 0, error: null };

      const result = await revokeAllPluginAuthorizationsTool.execute(
        {},
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.revokedCount).toBe(0);
        expect(result.data.message).toContain("没有找到有效的插件授权");
      }
    });

    it("should handle RPC errors", async () => {
      mockRpcResult = { data: null, error: { message: "RPC failed" } };

      const result = await revokeAllPluginAuthorizationsTool.execute(
        {},
        mockContext,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("撤销所有授权失败");
        expect(result.errorCode).toBe("DB_ERROR");
      }
    });
  });

  describe("execute - revoke by browser", () => {
    it("should revoke authorizations for specific browser", async () => {
      mockUpdateResult = {
        data: [{ id: "auth-1" }, { id: "auth-2" }],
        error: null,
      };

      const result = await revokeAllPluginAuthorizationsTool.execute(
        { browser: "chrome" },
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.revokedCount).toBe(2);
        expect(result.data.browser).toBe("chrome");
        expect(result.data.message).toContain("Chrome");
        expect(result.data.message).toContain("2");
      }
    });

    it("should return zero count when no authorizations for browser", async () => {
      mockUpdateResult = { data: [], error: null };

      const result = await revokeAllPluginAuthorizationsTool.execute(
        { browser: "firefox" },
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.revokedCount).toBe(0);
        expect(result.data.message).toContain("Firefox");
        expect(result.data.message).toContain("没有找到");
      }
    });

    it("should handle update errors for browser filter", async () => {
      mockUpdateResult = {
        data: null,
        error: { message: "Update failed" },
      };

      const result = await revokeAllPluginAuthorizationsTool.execute(
        { browser: "edge" },
        mockContext,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Edge");
        expect(result.errorCode).toBe("DB_ERROR");
      }
    });
  });

  describe("execute - with confirmReason", () => {
    it("should accept confirmReason parameter", async () => {
      mockRpcResult = { data: 1, error: null };

      const result = await revokeAllPluginAuthorizationsTool.execute(
        { confirmReason: "账号安全问题" },
        mockContext,
      );

      expect(result.success).toBe(true);
    });
  });

  describe("execute - metadata", () => {
    it("should include execution time in metadata", async () => {
      mockRpcResult = { data: 0, error: null };

      const result = await revokeAllPluginAuthorizationsTool.execute(
        {},
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.executionTimeMs).toBeDefined();
      expect(result.metadata?.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should report affectedCount matching revokedCount", async () => {
      mockRpcResult = { data: 5, error: null };

      const result = await revokeAllPluginAuthorizationsTool.execute(
        {},
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.affectedCount).toBe(5);
    });
  });
});
