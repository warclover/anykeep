/**
 * ConfirmationHandler 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { ConfirmationHandler } from "../confirmation-handler";
import type { PendingConfirmation } from "../../tools/types";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("ConfirmationHandler", () => {
  let handler: ConfirmationHandler;

  // 创建测试用的 PendingConfirmation
  const createTestConfirmation = (
    id: string,
    toolName: string = "test_tool",
    expiresInMs: number = 5 * 60 * 1000,
  ): PendingConfirmation => ({
    confirmationId: id,
    toolName,
    description: "Test operation",
    impactSummary: "This is a test",
    params: { test: true },
    expiresAt: new Date(Date.now() + expiresInMs),
    riskLevel: "low",
  });

  beforeEach(() => {
    handler = new ConfirmationHandler();
    jest.clearAllMocks();
  });

  describe("store()", () => {
    it("should store a pending confirmation", () => {
      const confirmation = createTestConfirmation("cf_test_1");
      const result = handler.store(confirmation, { userId: "user-1" });

      expect(result.confirmation).toEqual(confirmation);
      expect(result.state).toBe("pending");
      expect(result.userId).toBe("user-1");
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it("should store with conversationId", () => {
      const confirmation = createTestConfirmation("cf_test_2");
      const result = handler.store(confirmation, {
        userId: "user-1",
        conversationId: "conv-123",
      });

      expect(result.conversationId).toBe("conv-123");
    });
  });

  describe("get()", () => {
    it("should retrieve stored confirmation by id", () => {
      const confirmation = createTestConfirmation("cf_test_3");
      handler.store(confirmation, { userId: "user-1" });

      const result = handler.get("cf_test_3", "user-1");

      expect(result).not.toBeNull();
      expect(result?.confirmation.confirmationId).toBe("cf_test_3");
    });

    it("should return null for non-existent confirmation", () => {
      const result = handler.get("non-existent", "user-1");
      expect(result).toBeNull();
    });

    it("should return null for wrong userId", () => {
      const confirmation = createTestConfirmation("cf_test_4");
      handler.store(confirmation, { userId: "user-1" });

      const result = handler.get("cf_test_4", "user-2");
      expect(result).toBeNull();
    });

    it("should mark as expired if past expiresAt", () => {
      // 创建已过期的确认
      const confirmation = createTestConfirmation("cf_expired", "test", -1000);
      handler.store(confirmation, { userId: "user-1" });

      const result = handler.get("cf_expired", "user-1");

      expect(result).not.toBeNull();
      expect(result?.state).toBe("expired");
    });
  });

  describe("confirm()", () => {
    it("should confirm a pending confirmation", () => {
      const confirmation = createTestConfirmation("cf_confirm_1");
      handler.store(confirmation, { userId: "user-1" });

      const result = handler.confirm("cf_confirm_1", "user-1");

      expect(result.success).toBe(true);
      expect(result.confirmation?.state).toBe("confirmed");
    });

    it("should fail for non-existent confirmation", () => {
      const result = handler.confirm("non-existent", "user-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("不存在");
    });

    it("should fail for wrong userId", () => {
      const confirmation = createTestConfirmation("cf_confirm_2");
      handler.store(confirmation, { userId: "user-1" });

      const result = handler.confirm("cf_confirm_2", "user-2");

      expect(result.success).toBe(false);
    });

    it("should fail for expired confirmation", () => {
      const confirmation = createTestConfirmation(
        "cf_confirm_expired",
        "test",
        -1000,
      );
      handler.store(confirmation, { userId: "user-1" });

      const result = handler.confirm("cf_confirm_expired", "user-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("过期");
      expect(result.canRetry).toBe(true);
    });

    it("should fail for already confirmed confirmation", () => {
      const confirmation = createTestConfirmation("cf_confirm_3");
      handler.store(confirmation, { userId: "user-1" });
      handler.confirm("cf_confirm_3", "user-1");

      const result = handler.confirm("cf_confirm_3", "user-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("已处理");
    });
  });

  describe("cancel()", () => {
    it("should cancel a pending confirmation", () => {
      const confirmation = createTestConfirmation("cf_cancel_1");
      handler.store(confirmation, { userId: "user-1" });

      const result = handler.cancel("cf_cancel_1", "user-1");

      expect(result.success).toBe(true);
      expect(result.confirmation?.state).toBe("cancelled");
    });

    it("should fail for already cancelled confirmation", () => {
      const confirmation = createTestConfirmation("cf_cancel_2");
      handler.store(confirmation, { userId: "user-1" });
      handler.cancel("cf_cancel_2", "user-1");

      const result = handler.cancel("cf_cancel_2", "user-1");

      expect(result.success).toBe(false);
    });

    it("should allow cancelling expired confirmation", () => {
      const confirmation = createTestConfirmation(
        "cf_cancel_expired",
        "test",
        -1000,
      );
      handler.store(confirmation, { userId: "user-1" });

      const result = handler.cancel("cf_cancel_expired", "user-1");

      expect(result.success).toBe(true);
      expect(result.confirmation?.state).toBe("cancelled");
    });
  });

  describe("getUserPendingConfirmations()", () => {
    it("should return all pending confirmations for a user", () => {
      handler.store(createTestConfirmation("cf_list_1"), { userId: "user-1" });
      handler.store(createTestConfirmation("cf_list_2"), { userId: "user-1" });
      handler.store(createTestConfirmation("cf_list_3"), { userId: "user-2" });

      const result = handler.getUserPendingConfirmations("user-1");

      expect(result).toHaveLength(2);
    });

    it("should not include confirmed or cancelled", () => {
      handler.store(createTestConfirmation("cf_list_4"), { userId: "user-1" });
      handler.store(createTestConfirmation("cf_list_5"), { userId: "user-1" });
      handler.confirm("cf_list_5", "user-1");

      const result = handler.getUserPendingConfirmations("user-1");

      expect(result).toHaveLength(1);
      expect(result[0].confirmation.confirmationId).toBe("cf_list_4");
    });

    it("should include expired when flag is set", () => {
      handler.store(createTestConfirmation("cf_list_6"), { userId: "user-1" });
      handler.store(createTestConfirmation("cf_list_expired", "test", -1000), {
        userId: "user-1",
      });

      const withExpired = handler.getUserPendingConfirmations("user-1", true);
      const withoutExpired = handler.getUserPendingConfirmations(
        "user-1",
        false,
      );

      expect(withExpired).toHaveLength(2);
      expect(withoutExpired).toHaveLength(1);
    });

    it("should sort by createdAt descending", () => {
      handler.store(createTestConfirmation("cf_oldest"), { userId: "user-1" });
      // 模拟时间差
      jest.advanceTimersByTime(100);
      handler.store(createTestConfirmation("cf_newest"), { userId: "user-1" });

      const result = handler.getUserPendingConfirmations("user-1");

      // 最新的应该在前面
      expect(result[0].confirmation.confirmationId).toBe("cf_newest");
    });
  });

  describe("getUserPendingCount()", () => {
    it("should return correct count", () => {
      handler.store(createTestConfirmation("cf_count_1"), { userId: "user-1" });
      handler.store(createTestConfirmation("cf_count_2"), { userId: "user-1" });
      handler.store(createTestConfirmation("cf_count_3"), { userId: "user-2" });

      expect(handler.getUserPendingCount("user-1")).toBe(2);
      expect(handler.getUserPendingCount("user-2")).toBe(1);
      expect(handler.getUserPendingCount("user-3")).toBe(0);
    });

    it("should not count expired", () => {
      handler.store(createTestConfirmation("cf_count_4"), { userId: "user-1" });
      handler.store(createTestConfirmation("cf_count_expired", "test", -1000), {
        userId: "user-1",
      });

      expect(handler.getUserPendingCount("user-1")).toBe(1);
    });
  });

  describe("buildConfirmedContext()", () => {
    it("should build correct ToolContext", () => {
      const confirmation = createTestConfirmation("cf_context_1");
      const stored = handler.store(confirmation, {
        userId: "user-1",
        conversationId: "conv-456",
      });

      const context = handler.buildConfirmedContext(stored);

      expect(context.userId).toBe("user-1");
      expect(context.conversationId).toBe("conv-456");
      expect(context.confirmed).toBe(true);
      expect(context.confirmationId).toBe("cf_context_1");
    });
  });

  describe("delete()", () => {
    it("should remove confirmation from store", () => {
      const confirmation = createTestConfirmation("cf_delete_1");
      handler.store(confirmation, { userId: "user-1" });

      handler.delete("cf_delete_1");

      const result = handler.get("cf_delete_1", "user-1");
      expect(result).toBeNull();
    });
  });

  describe("batchConfirm()", () => {
    it("should confirm multiple confirmations", () => {
      handler.store(createTestConfirmation("cf_batch_1"), { userId: "user-1" });
      handler.store(createTestConfirmation("cf_batch_2"), { userId: "user-1" });
      handler.store(createTestConfirmation("cf_batch_3"), { userId: "user-1" });

      const result = handler.batchConfirm(
        ["cf_batch_1", "cf_batch_2", "cf_batch_3"],
        "user-1",
      );

      expect(result.success).toBe(3);
      expect(result.failed).toBe(0);
    });

    it("should count failures correctly", () => {
      handler.store(createTestConfirmation("cf_batch_4"), { userId: "user-1" });

      const result = handler.batchConfirm(
        ["cf_batch_4", "non-existent-1", "non-existent-2"],
        "user-1",
      );

      expect(result.success).toBe(1);
      expect(result.failed).toBe(2);
    });
  });

  describe("batchCancel()", () => {
    it("should cancel multiple confirmations", () => {
      handler.store(createTestConfirmation("cf_batch_cancel_1"), {
        userId: "user-1",
      });
      handler.store(createTestConfirmation("cf_batch_cancel_2"), {
        userId: "user-1",
      });

      const result = handler.batchCancel(
        ["cf_batch_cancel_1", "cf_batch_cancel_2"],
        "user-1",
      );

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
    });
  });

  describe("getStats()", () => {
    it("should return correct statistics", () => {
      handler.store(createTestConfirmation("cf_stats_1"), { userId: "user-1" });
      handler.store(createTestConfirmation("cf_stats_2"), { userId: "user-1" });
      handler.store(createTestConfirmation("cf_stats_3"), { userId: "user-1" });
      handler.confirm("cf_stats_2", "user-1");
      handler.cancel("cf_stats_3", "user-1");

      const stats = handler.getStats();

      expect(stats.total).toBe(3);
      expect(stats.pending).toBe(1);
      expect(stats.confirmed).toBe(1);
      expect(stats.cancelled).toBe(1);
      expect(stats.expired).toBe(0);
    });
  });
});
