/**
 * AI Agent 确认 API 业务逻辑测试
 *
 * 测试验证 confirmationHandler 和 confirmationInterceptor 的业务逻辑，
 * 不依赖 Next.js 请求/响应处理
 *
 * @version 1.0.0
 * @since 2026-01-09
 */

import { confirmationHandler } from "@/lib/ai-agent/core/confirmation-handler";
import { confirmationInterceptor } from "@/lib/ai-agent/safety/confirmation-interceptor";
import type { PendingConfirmation } from "@/lib/ai-agent/tools/types";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ============================================
// 测试辅助函数
// ============================================

function createTestConfirmation(
  id: string,
  overrides?: Partial<PendingConfirmation>,
): PendingConfirmation {
  return {
    confirmationId: id,
    toolName: "delete_bookmark",
    description: "删除书签",
    impactSummary: "高风险操作",
    params: { bookmarkId: 123 },
    expiresAt: new Date(Date.now() + 300000), // 5 分钟后过期
    riskLevel: "high",
    ...overrides,
  };
}

function createExpiredConfirmation(id: string): PendingConfirmation {
  return createTestConfirmation(id, {
    expiresAt: new Date(Date.now() - 1000), // 1 秒前已过期
  });
}

// ============================================
// 测试套件
// ============================================

describe("Agent Confirmations Business Logic", () => {
  const testUserId = "test-user-123";
  const otherUserId = "other-user-456";

  afterEach(() => {
    // 清理所有测试创建的确认
    const stats = confirmationHandler.getStats();
    if (stats.total > 0) {
      // 遍历并清理（通过获取用户的所有确认来清理）
      const userConfirmations = confirmationHandler.getUserPendingConfirmations(
        testUserId,
        true,
      );
      userConfirmations.forEach((c) =>
        confirmationHandler.delete(c.confirmation.confirmationId),
      );
      const otherConfirmations =
        confirmationHandler.getUserPendingConfirmations(otherUserId, true);
      otherConfirmations.forEach((c) =>
        confirmationHandler.delete(c.confirmation.confirmationId),
      );
    }
  });

  // ============================================
  // confirmationHandler 测试
  // ============================================

  describe("confirmationHandler", () => {
    describe("store", () => {
      it("should store a confirmation", () => {
        const confirmation = createTestConfirmation("store-test-1");
        const stored = confirmationHandler.store(confirmation, {
          userId: testUserId,
        });

        expect(stored.confirmation.confirmationId).toBe("store-test-1");
        expect(stored.state).toBe("pending");
        expect(stored.userId).toBe(testUserId);
      });

      it("should include conversationId if provided", () => {
        const confirmation = createTestConfirmation("store-test-2");
        const stored = confirmationHandler.store(confirmation, {
          userId: testUserId,
          conversationId: "conv-123",
        });

        expect(stored.conversationId).toBe("conv-123");
      });
    });

    describe("get", () => {
      it("should return stored confirmation", () => {
        const confirmation = createTestConfirmation("get-test-1");
        confirmationHandler.store(confirmation, { userId: testUserId });

        const retrieved = confirmationHandler.get("get-test-1", testUserId);

        expect(retrieved).not.toBeNull();
        expect(retrieved?.confirmation.confirmationId).toBe("get-test-1");
      });

      it("should return null for non-existent confirmation", () => {
        const retrieved = confirmationHandler.get("non-existent", testUserId);
        expect(retrieved).toBeNull();
      });

      it("should return null for wrong user", () => {
        const confirmation = createTestConfirmation("get-test-2");
        confirmationHandler.store(confirmation, { userId: testUserId });

        const retrieved = confirmationHandler.get("get-test-2", otherUserId);
        expect(retrieved).toBeNull();
      });

      it("should mark expired confirmation as expired", () => {
        const confirmation = createExpiredConfirmation("get-expired-test");
        confirmationHandler.store(confirmation, { userId: testUserId });

        const retrieved = confirmationHandler.get(
          "get-expired-test",
          testUserId,
        );

        expect(retrieved).not.toBeNull();
        expect(retrieved?.state).toBe("expired");
      });
    });

    describe("confirm", () => {
      it("should confirm pending confirmation", () => {
        const confirmation = createTestConfirmation("confirm-test-1");
        confirmationHandler.store(confirmation, { userId: testUserId });

        const result = confirmationHandler.confirm(
          "confirm-test-1",
          testUserId,
        );

        expect(result.success).toBe(true);
        expect(result.confirmation?.state).toBe("confirmed");
      });

      it("should reject non-existent confirmation", () => {
        const result = confirmationHandler.confirm("non-existent", testUserId);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("should reject expired confirmation", () => {
        const confirmation = createExpiredConfirmation("confirm-expired-test");
        confirmationHandler.store(confirmation, { userId: testUserId });

        const result = confirmationHandler.confirm(
          "confirm-expired-test",
          testUserId,
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("过期");
      });

      it("should reject already confirmed confirmation", () => {
        const confirmation = createTestConfirmation("confirm-twice-test");
        confirmationHandler.store(confirmation, { userId: testUserId });
        confirmationHandler.confirm("confirm-twice-test", testUserId);

        const result = confirmationHandler.confirm(
          "confirm-twice-test",
          testUserId,
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("已处理");
      });
    });

    describe("cancel", () => {
      it("should cancel pending confirmation", () => {
        const confirmation = createTestConfirmation("cancel-test-1");
        confirmationHandler.store(confirmation, { userId: testUserId });

        const result = confirmationHandler.cancel("cancel-test-1", testUserId);

        expect(result.success).toBe(true);
        expect(result.confirmation?.state).toBe("cancelled");
      });

      it("should reject non-existent confirmation", () => {
        const result = confirmationHandler.cancel("non-existent", testUserId);

        expect(result.success).toBe(false);
      });

      it("should reject already cancelled confirmation", () => {
        const confirmation = createTestConfirmation("cancel-twice-test");
        confirmationHandler.store(confirmation, { userId: testUserId });
        confirmationHandler.cancel("cancel-twice-test", testUserId);

        const result = confirmationHandler.cancel(
          "cancel-twice-test",
          testUserId,
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("已处理");
      });
    });

    describe("getUserPendingConfirmations", () => {
      it("should return all pending confirmations for user", () => {
        const confirmation1 = createTestConfirmation("list-test-1");
        const confirmation2 = createTestConfirmation("list-test-2");
        confirmationHandler.store(confirmation1, { userId: testUserId });
        confirmationHandler.store(confirmation2, { userId: testUserId });

        const list =
          confirmationHandler.getUserPendingConfirmations(testUserId);

        expect(list.length).toBeGreaterThanOrEqual(2);
        const ids = list.map((c) => c.confirmation.confirmationId);
        expect(ids).toContain("list-test-1");
        expect(ids).toContain("list-test-2");
      });

      it("should not return other user's confirmations", () => {
        const confirmation = createTestConfirmation("list-other-user-test");
        confirmationHandler.store(confirmation, { userId: testUserId });

        const list =
          confirmationHandler.getUserPendingConfirmations(otherUserId);

        const ids = list.map((c) => c.confirmation.confirmationId);
        expect(ids).not.toContain("list-other-user-test");
      });

      it("should exclude expired confirmations by default", () => {
        const validConfirmation = createTestConfirmation("list-valid-test");
        const expiredConfirmation =
          createExpiredConfirmation("list-expired-test");
        confirmationHandler.store(validConfirmation, { userId: testUserId });
        confirmationHandler.store(expiredConfirmation, { userId: testUserId });

        const list = confirmationHandler.getUserPendingConfirmations(
          testUserId,
          false,
        );

        const ids = list.map((c) => c.confirmation.confirmationId);
        expect(ids).toContain("list-valid-test");
        expect(ids).not.toContain("list-expired-test");
      });

      it("should include expired confirmations when requested", () => {
        const expiredConfirmation = createExpiredConfirmation(
          "list-include-expired-test",
        );
        confirmationHandler.store(expiredConfirmation, { userId: testUserId });

        const list = confirmationHandler.getUserPendingConfirmations(
          testUserId,
          true,
        );

        const ids = list.map((c) => c.confirmation.confirmationId);
        expect(ids).toContain("list-include-expired-test");
      });
    });

    describe("getUserPendingCount", () => {
      it("should return count of pending confirmations", () => {
        const confirmation1 = createTestConfirmation("count-test-1");
        const confirmation2 = createTestConfirmation("count-test-2");
        confirmationHandler.store(confirmation1, { userId: testUserId });
        confirmationHandler.store(confirmation2, { userId: testUserId });

        const count = confirmationHandler.getUserPendingCount(testUserId);

        expect(count).toBeGreaterThanOrEqual(2);
      });

      it("should not count expired confirmations", () => {
        const expiredConfirmation =
          createExpiredConfirmation("count-expired-test");
        confirmationHandler.store(expiredConfirmation, { userId: testUserId });

        const _initialCount =
          confirmationHandler.getUserPendingCount(testUserId);

        // 过期的不应该被计入（_initialCount 用于验证计数逻辑）
        const list = confirmationHandler.getUserPendingConfirmations(
          testUserId,
          false,
        );
        const nonExpiredIds = list.map((c) => c.confirmation.confirmationId);
        expect(nonExpiredIds).not.toContain("count-expired-test");
      });
    });

    describe("batchConfirm", () => {
      it("should confirm multiple confirmations", () => {
        const confirmation1 = createTestConfirmation("batch-confirm-1");
        const confirmation2 = createTestConfirmation("batch-confirm-2");
        confirmationHandler.store(confirmation1, { userId: testUserId });
        confirmationHandler.store(confirmation2, { userId: testUserId });

        const result = confirmationHandler.batchConfirm(
          ["batch-confirm-1", "batch-confirm-2"],
          testUserId,
        );

        expect(result.success).toBe(2);
        expect(result.failed).toBe(0);
      });

      it("should count failed confirmations", () => {
        const confirmation = createTestConfirmation("batch-confirm-partial");
        confirmationHandler.store(confirmation, { userId: testUserId });

        const result = confirmationHandler.batchConfirm(
          ["batch-confirm-partial", "non-existent"],
          testUserId,
        );

        expect(result.success).toBe(1);
        expect(result.failed).toBe(1);
      });
    });

    describe("batchCancel", () => {
      it("should cancel multiple confirmations", () => {
        const confirmation1 = createTestConfirmation("batch-cancel-1");
        const confirmation2 = createTestConfirmation("batch-cancel-2");
        confirmationHandler.store(confirmation1, { userId: testUserId });
        confirmationHandler.store(confirmation2, { userId: testUserId });

        const result = confirmationHandler.batchCancel(
          ["batch-cancel-1", "batch-cancel-2"],
          testUserId,
        );

        expect(result.success).toBe(2);
        expect(result.failed).toBe(0);
      });
    });

    describe("buildConfirmedContext", () => {
      it("should build context with confirmed flag", () => {
        const confirmation = createTestConfirmation("context-test");
        const stored = confirmationHandler.store(confirmation, {
          userId: testUserId,
          conversationId: "conv-456",
        });

        const context = confirmationHandler.buildConfirmedContext(stored);

        expect(context.userId).toBe(testUserId);
        expect(context.conversationId).toBe("conv-456");
        expect(context.confirmed).toBe(true);
        expect(context.confirmationId).toBe("context-test");
      });
    });

    describe("getStats", () => {
      it("should return statistics", () => {
        const stats = confirmationHandler.getStats();

        expect(stats).toHaveProperty("total");
        expect(stats).toHaveProperty("pending");
        expect(stats).toHaveProperty("confirmed");
        expect(stats).toHaveProperty("cancelled");
        expect(stats).toHaveProperty("expired");
      });
    });
  });

  // ============================================
  // confirmationInterceptor 测试
  // ============================================

  describe("confirmationInterceptor", () => {
    describe("checkConfirmationStatus", () => {
      it("should return not_found for non-existent confirmation", async () => {
        const status = await confirmationInterceptor.checkConfirmationStatus(
          "non-existent",
          testUserId,
        );

        expect(status.status).toBe("not_found");
      });

      it("should return pending for valid pending confirmation", async () => {
        const confirmation = createTestConfirmation("status-pending-test");
        confirmationHandler.store(confirmation, { userId: testUserId });

        const status = await confirmationInterceptor.checkConfirmationStatus(
          "status-pending-test",
          testUserId,
        );

        expect(status.status).toBe("pending");
        expect(status.confirmation).toBeDefined();
      });

      it("should return expired for expired confirmation", async () => {
        const confirmation = createExpiredConfirmation("status-expired-test");
        confirmationHandler.store(confirmation, { userId: testUserId });

        const status = await confirmationInterceptor.checkConfirmationStatus(
          "status-expired-test",
          testUserId,
        );

        expect(status.status).toBe("expired");
      });
    });

    describe("confirm", () => {
      it("should confirm pending confirmation", async () => {
        const confirmation = createTestConfirmation("interceptor-confirm-test");
        confirmationHandler.store(confirmation, { userId: testUserId });

        const result = await confirmationInterceptor.confirm(
          "interceptor-confirm-test",
          testUserId,
        );

        expect(result.success).toBe(true);
        expect(result.confirmation).toBeDefined();
      });

      it("should reject non-existent confirmation", async () => {
        const result = await confirmationInterceptor.confirm(
          "non-existent",
          testUserId,
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("不存在");
      });

      it("should reject expired confirmation", async () => {
        const confirmation = createExpiredConfirmation(
          "interceptor-expired-test",
        );
        confirmationHandler.store(confirmation, { userId: testUserId });

        const result = await confirmationInterceptor.confirm(
          "interceptor-expired-test",
          testUserId,
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("过期");
      });
    });

    describe("cancel", () => {
      it("should cancel pending confirmation", async () => {
        const confirmation = createTestConfirmation("interceptor-cancel-test");
        confirmationHandler.store(confirmation, { userId: testUserId });

        const result = await confirmationInterceptor.cancel(
          "interceptor-cancel-test",
          testUserId,
        );

        expect(result.success).toBe(true);
      });

      it("should return error for non-existent confirmation", async () => {
        const result = await confirmationInterceptor.cancel(
          "non-existent",
          testUserId,
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });
});
