/**
 * ConfirmationInterceptor 测试
 *
 * 测试高风险操作确认拦截器的核心功能
 *
 * @version 1.0.0
 * @since 2026-01-09
 */

import {
  ConfirmationInterceptor,
  createConfirmationInterceptor,
} from "../confirmation-interceptor";
import type { Tool, ToolContext, ToolSuccessResult } from "../../tools/types";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock confirmationHandler
jest.mock("../../core/confirmation-handler", () => ({
  confirmationHandler: {
    store: jest.fn(),
    get: jest.fn(),
    confirm: jest.fn(),
    cancel: jest.fn(),
  },
}));

// 导入 mock 后的 confirmationHandler
import { confirmationHandler } from "../../core/confirmation-handler";

// ============================================
// 测试辅助函数
// ============================================

/**
 * 创建测试用 Tool
 */
function createMockTool(
  name: string,
  options: {
    category?:
      | "query"
      | "read"
      | "action"
      | "search"
      | "analysis"
      | "export"
      | "system";
    requiresConfirmation?: boolean;
  } = {},
): Tool {
  return {
    definition: {
      name,
      description: `Test tool: ${name}`,
      category: options.category || "action",
      parameters: {
        parse: jest.fn((params: unknown) => params),
      } as unknown as Tool["definition"]["parameters"],
      requiresConfirmation: options.requiresConfirmation,
    },
    execute: jest.fn().mockResolvedValue({ success: true, data: {} }),
  };
}

/**
 * 创建测试用上下文
 */
function createMockContext(userId: string = "test-user"): ToolContext {
  return {
    userId,
    conversationId: "test-conversation",
  };
}

// ============================================
// 测试套件
// ============================================

describe("ConfirmationInterceptor", () => {
  let interceptor: ConfirmationInterceptor;

  beforeEach(() => {
    jest.clearAllMocks();
    interceptor = new ConfirmationInterceptor();
  });

  // ============================================
  // checkRequiresConfirmation 测试
  // ============================================

  describe("checkRequiresConfirmation", () => {
    it("should require confirmation for high-risk operations", () => {
      const tool = createMockTool("delete_bookmark");
      const params = { bookmarkId: 123 };

      const result = interceptor.checkRequiresConfirmation(tool, params);

      expect(result.requiresConfirmation).toBe(true);
      expect(result.riskLevel).toBe("high");
      expect(result.reason).toContain("高风险操作");
    });

    it("should require confirmation when tool definition has requiresConfirmation", () => {
      const tool = createMockTool("custom_tool", {
        requiresConfirmation: true,
      });
      const params = {};

      const result = interceptor.checkRequiresConfirmation(tool, params);

      expect(result.requiresConfirmation).toBe(true);
      expect(result.reason).toContain("Tool 定义要求确认");
    });

    it("should require confirmation for batch operations exceeding threshold", () => {
      const tool = createMockTool("batch_add_tags");
      const params = { bookmarkIds: Array(60).fill(1) }; // 60 > 50 (default threshold)

      const result = interceptor.checkRequiresConfirmation(tool, params);

      expect(result.requiresConfirmation).toBe(true);
      expect(result.affectedCount).toBe(60);
      expect(result.reason).toContain("批量操作超过阈值");
    });

    it("should not require confirmation for low-risk read operations", () => {
      const tool = createMockTool("list_bookmarks", { category: "query" });
      const params = {};

      const result = interceptor.checkRequiresConfirmation(tool, params);

      expect(result.requiresConfirmation).toBe(false);
    });

    it("should extract affected count from various parameter fields", () => {
      const tool = createMockTool("batch_delete");

      // Test ids field
      let result = interceptor.checkRequiresConfirmation(tool, {
        ids: [1, 2, 3],
      });
      expect(result.affectedCount).toBe(3);

      // Test bookmarkIds field
      result = interceptor.checkRequiresConfirmation(tool, {
        bookmarkIds: [1, 2, 3, 4, 5],
      });
      expect(result.affectedCount).toBe(5);

      // Test count field
      result = interceptor.checkRequiresConfirmation(tool, { count: 10 });
      expect(result.affectedCount).toBe(10);

      // Test single operation
      result = interceptor.checkRequiresConfirmation(tool, { id: 1 });
      expect(result.affectedCount).toBe(1);
    });
  });

  // ============================================
  // intercept 测试
  // ============================================

  describe("intercept", () => {
    it("should intercept high-risk operations and create pending confirmation", async () => {
      const tool = createMockTool("delete_bookmark");
      const params = { bookmarkId: 123 };
      const context = createMockContext();

      const result = await interceptor.intercept(tool, params, context);

      expect(result.intercepted).toBe(true);
      expect(result.confirmation).toBeDefined();
      expect(result.confirmation?.toolName).toBe("delete_bookmark");
      expect(result.confirmation?.riskLevel).toBe("high");
      expect(confirmationHandler.store).toHaveBeenCalled();
    });

    it("should not intercept low-risk operations", async () => {
      const tool = createMockTool("list_bookmarks", { category: "query" });
      const params = {};
      const context = createMockContext();

      const result = await interceptor.intercept(tool, params, context);

      expect(result.intercepted).toBe(false);
      expect(result.confirmation).toBeUndefined();
      expect(confirmationHandler.store).not.toHaveBeenCalled();
    });

    it("should not intercept when disabled", async () => {
      interceptor.updateConfig({ enabled: false });
      const tool = createMockTool("delete_bookmark");
      const params = { bookmarkId: 123 };
      const context = createMockContext();

      const result = await interceptor.intercept(tool, params, context);

      expect(result.intercepted).toBe(false);
    });

    it("should generate proper confirmation details", async () => {
      const tool = createMockTool("batch_delete_bookmarks");
      const params = { bookmarkIds: [1, 2, 3, 4, 5] };
      const context = createMockContext();

      const result = await interceptor.intercept(tool, params, context);

      expect(result.confirmation?.description).toContain("5 项");
      expect(result.confirmation?.impactSummary).toContain("高风险");
      expect(result.confirmation?.affectedItems).toHaveLength(5);
    });
  });

  // ============================================
  // createConfirmationResult 测试
  // ============================================

  describe("createConfirmationResult", () => {
    it("should create proper tool result with pending confirmation", () => {
      const confirmation = {
        confirmationId: "test-id",
        toolName: "delete_bookmark",
        description: "删除书签",
        impactSummary: "高风险操作",
        params: { bookmarkId: 123 },
        expiresAt: new Date(Date.now() + 300000),
        riskLevel: "high" as const,
      };

      const result = interceptor.createConfirmationResult(confirmation);

      expect(result.success).toBe(true);
      const successResult = result as ToolSuccessResult;
      expect(successResult.data).toHaveProperty("__pendingConfirmation");
      expect(successResult.data).toHaveProperty(
        "status",
        "pending_confirmation",
      );
    });
  });

  // ============================================
  // checkConfirmationStatus 测试
  // ============================================

  describe("checkConfirmationStatus", () => {
    it("should return not_found when confirmation does not exist", async () => {
      jest.mocked(confirmationHandler.get).mockReturnValue(null);

      const result = await interceptor.checkConfirmationStatus(
        "non-existent",
        "user-1",
      );

      expect(result.status).toBe("not_found");
    });

    it("should return expired when confirmation is past expiry", async () => {
      const expiredConfirmation = {
        confirmation: {
          confirmationId: "test-id",
          toolName: "test",
          description: "test",
          impactSummary: "test",
          params: {},
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
          riskLevel: "high" as const,
        },
        state: "pending" as const,
        userId: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      jest.mocked(confirmationHandler.get).mockReturnValue(expiredConfirmation);
      jest
        .mocked(confirmationHandler.cancel)
        .mockReturnValue({ success: true });

      const result = await interceptor.checkConfirmationStatus(
        "test-id",
        "user-1",
      );

      expect(result.status).toBe("expired");
      expect(confirmationHandler.cancel).toHaveBeenCalled();
    });

    it("should return current state for valid confirmation", async () => {
      const validConfirmation = {
        confirmation: {
          confirmationId: "test-id",
          toolName: "test",
          description: "test",
          impactSummary: "test",
          params: {},
          expiresAt: new Date(Date.now() + 300000), // Valid for 5 more minutes
          riskLevel: "high" as const,
        },
        state: "pending" as const,
        userId: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      jest.mocked(confirmationHandler.get).mockReturnValue(validConfirmation);

      const result = await interceptor.checkConfirmationStatus(
        "test-id",
        "user-1",
      );

      expect(result.status).toBe("pending");
      expect(result.confirmation).toBeDefined();
    });
  });

  // ============================================
  // confirm 测试
  // ============================================

  describe("confirm", () => {
    it("should confirm valid pending confirmation", async () => {
      const storedConfirmation = {
        confirmation: {
          confirmationId: "test-id",
          toolName: "test",
          description: "test",
          impactSummary: "test",
          params: {},
          expiresAt: new Date(Date.now() + 300000),
          riskLevel: "high" as const,
        },
        state: "pending" as const,
        userId: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      jest.mocked(confirmationHandler.get).mockReturnValue(storedConfirmation);
      jest.mocked(confirmationHandler.confirm).mockReturnValue({
        success: true,
        confirmation: storedConfirmation,
      });

      const result = await interceptor.confirm("test-id", "user-1");

      expect(result.success).toBe(true);
      expect(result.confirmation).toBeDefined();
    });

    it("should reject non-existent confirmation", async () => {
      jest.mocked(confirmationHandler.get).mockReturnValue(null);

      const result = await interceptor.confirm("non-existent", "user-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("不存在");
    });

    it("should reject expired confirmation", async () => {
      const expiredConfirmation = {
        confirmation: {
          confirmationId: "test-id",
          toolName: "test",
          description: "test",
          impactSummary: "test",
          params: {},
          expiresAt: new Date(Date.now() - 1000),
          riskLevel: "high" as const,
        },
        state: "pending" as const,
        userId: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      jest.mocked(confirmationHandler.get).mockReturnValue(expiredConfirmation);
      jest
        .mocked(confirmationHandler.cancel)
        .mockReturnValue({ success: true });

      const result = await interceptor.confirm("test-id", "user-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("过期");
    });
  });

  // ============================================
  // cancel 测试
  // ============================================

  describe("cancel", () => {
    it("should cancel valid confirmation", async () => {
      jest
        .mocked(confirmationHandler.cancel)
        .mockReturnValue({ success: true });

      const result = await interceptor.cancel("test-id", "user-1");

      expect(result.success).toBe(true);
    });

    it("should return error for non-existent confirmation", async () => {
      jest.mocked(confirmationHandler.cancel).mockReturnValue({
        success: false,
        error: "Not found",
      });

      const result = await interceptor.cancel("non-existent", "user-1");

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ============================================
  // 配置测试
  // ============================================

  describe("configuration", () => {
    it("should allow updating configuration", () => {
      interceptor.updateConfig({ batchThreshold: 100, enabled: false });

      const config = interceptor.getConfig();

      expect(config.batchThreshold).toBe(100);
      expect(config.enabled).toBe(false);
    });

    it("should use custom batch threshold", () => {
      interceptor.updateConfig({ batchThreshold: 10 });
      const tool = createMockTool("batch_add_tags");
      const params = { bookmarkIds: Array(15).fill(1) }; // 15 > 10

      const result = interceptor.checkRequiresConfirmation(tool, params);

      expect(result.requiresConfirmation).toBe(true);
      expect(result.reason).toContain("批量操作超过阈值");
    });
  });

  // ============================================
  // 工厂函数测试
  // ============================================

  describe("createConfirmationInterceptor", () => {
    it("should create interceptor with default config", () => {
      const instance = createConfirmationInterceptor();
      const config = instance.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.batchThreshold).toBe(50);
    });

    it("should create interceptor with custom config", () => {
      const instance = createConfirmationInterceptor({
        enabled: false,
        batchThreshold: 25,
      });
      const config = instance.getConfig();

      expect(config.enabled).toBe(false);
      expect(config.batchThreshold).toBe(25);
    });
  });
});
