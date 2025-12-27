/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * revoke-plugin-authorization.tool.ts 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { ToolContext } from "../../types";

// Mock 数据
let mockSelectResult: any = { data: null, error: null };

// Mock Supabase
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(() => Promise.resolve(mockSelectResult)),
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

import { revokePluginAuthorizationTool } from "../revoke-plugin-authorization.tool";

describe("revokePluginAuthorizationTool", () => {
  const mockContext: ToolContext = {
    userId: "test-user-123",
    conversationId: "test-conv-456",
  };

  const validAuthId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectResult = { data: null, error: null };
  });

  describe("definition", () => {
    it("should have correct metadata", () => {
      expect(revokePluginAuthorizationTool.definition.name).toBe(
        "revoke_plugin_authorization",
      );
      expect(revokePluginAuthorizationTool.definition.category).toBe("action");
      expect(
        revokePluginAuthorizationTool.definition.requiresConfirmation,
      ).toBe(false);
      expect(revokePluginAuthorizationTool.definition.estimatedDurationMs).toBe(
        150,
      );
    });

    it("should require valid UUID for authorizationId", () => {
      const schema = revokePluginAuthorizationTool.definition.parameters;

      // Valid UUID should pass
      expect(() =>
        schema.parse({ authorizationId: validAuthId }),
      ).not.toThrow();

      // Invalid UUID should fail
      expect(() => schema.parse({ authorizationId: "invalid-uuid" })).toThrow();
    });
  });

  describe("execute - success cases", () => {
    it("should revoke authorization successfully", async () => {
      mockSelectResult = {
        data: {
          id: validAuthId,
          browser: "chrome",
          revoked_at: null,
        },
        error: null,
      };

      const result = await revokePluginAuthorizationTool.execute(
        { authorizationId: validAuthId },
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.revokedId).toBe(validAuthId);
        expect(result.data.browser).toBe("chrome");
        expect(result.data.browserLabel).toBe("Chrome");
        expect(result.data.message).toContain("已撤销");
        expect(result.data.message).toContain("Chrome");
      }
    });
  });

  describe("execute - error cases", () => {
    it("should return error when authorization not found", async () => {
      mockSelectResult = { data: null, error: null };

      const result = await revokePluginAuthorizationTool.execute(
        { authorizationId: validAuthId },
        mockContext,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("授权不存在或无权操作");
        expect(result.errorCode).toBe("NOT_FOUND");
      }
    });

    it("should return error when authorization already revoked", async () => {
      mockSelectResult = {
        data: {
          id: validAuthId,
          browser: "chrome",
          revoked_at: new Date().toISOString(),
        },
        error: null,
      };

      const result = await revokePluginAuthorizationTool.execute(
        { authorizationId: validAuthId },
        mockContext,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("该授权已被撤销");
        expect(result.errorCode).toBe("ALREADY_REVOKED");
      }
    });

    it("should handle database select errors", async () => {
      mockSelectResult = {
        data: null,
        error: { message: "Database error" },
      };

      const result = await revokePluginAuthorizationTool.execute(
        { authorizationId: validAuthId },
        mockContext,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe("NOT_FOUND");
      }
    });
  });

  describe("execute - metadata", () => {
    it("should include execution time in metadata", async () => {
      mockSelectResult = {
        data: { id: validAuthId, browser: "chrome", revoked_at: null },
        error: null,
      };

      const result = await revokePluginAuthorizationTool.execute(
        { authorizationId: validAuthId },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.executionTimeMs).toBeDefined();
      expect(result.metadata?.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should report affectedCount as 1 on success", async () => {
      mockSelectResult = {
        data: { id: validAuthId, browser: "chrome", revoked_at: null },
        error: null,
      };

      const result = await revokePluginAuthorizationTool.execute(
        { authorizationId: validAuthId },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.affectedCount).toBe(1);
    });
  });
});
