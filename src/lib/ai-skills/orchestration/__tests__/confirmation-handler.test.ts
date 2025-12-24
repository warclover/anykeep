/**
 * ConfirmationHandler 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import {
  ConfirmationHandler,
  createConfirmationHandler,
  confirmationHandler,
} from "../confirmation-handler";
import type { ConfirmationRequestOptions } from "../confirmation-handler";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("ConfirmationHandler", () => {
  let handler: ConfirmationHandler;

  beforeEach(() => {
    handler = new ConfirmationHandler({
      defaultTimeoutMs: 1000, // 1 秒超时便于测试
      maxPendingConfirmations: 10,
      cleanupIntervalMs: 10000,
    });
  });

  afterEach(() => {
    handler.shutdown();
  });

  describe("createConfirmation", () => {
    it("should create a confirmation with generated ID", () => {
      const options: ConfirmationRequestOptions = {
        title: "测试确认",
        message: "确定要执行此操作吗？",
      };

      const confirmation = handler.createConfirmation(options);

      expect(confirmation.id).toMatch(/^confirm_\w+_\w+$/);
      expect(confirmation.title).toBe("测试确认");
      expect(confirmation.message).toBe("确定要执行此操作吗？");
      expect(confirmation.status).toBe("pending");
    });

    it("should use default options when not provided", () => {
      const confirmation = handler.createConfirmation({
        title: "测试",
        message: "消息",
      });

      expect(confirmation.options).toHaveLength(2);
      expect(confirmation.options[0].id).toBe("confirm");
      expect(confirmation.options[1].id).toBe("cancel");
    });

    it("should use custom options when provided", () => {
      const customOptions = [
        { id: "yes", label: "是" },
        { id: "no", label: "否" },
        { id: "maybe", label: "稍后" },
      ];

      const confirmation = handler.createConfirmation({
        title: "测试",
        message: "消息",
        options: customOptions,
      });

      expect(confirmation.options).toHaveLength(3);
      expect(confirmation.options[0].id).toBe("yes");
    });

    it("should set correct expiration time", () => {
      const before = Date.now();
      const confirmation = handler.createConfirmation({
        title: "测试",
        message: "消息",
        timeoutMs: 5000,
      });
      const after = Date.now();

      const expectedMin = before + 5000;
      const expectedMax = after + 5000;

      expect(confirmation.expiresAt.getTime()).toBeGreaterThanOrEqual(
        expectedMin,
      );
      expect(confirmation.expiresAt.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it("should store context data", () => {
      const contextData = { bookmarkIds: [1, 2, 3], action: "delete" };

      const confirmation = handler.createConfirmation({
        title: "测试",
        message: "消息",
        contextData,
      });

      expect(confirmation.contextData).toEqual(contextData);
    });

    it("should store skill ID and user ID", () => {
      const confirmation = handler.createConfirmation({
        title: "测试",
        message: "消息",
        skillId: "batch_organize",
        userId: "user-123",
      });

      expect(confirmation.skillId).toBe("batch_organize");
      expect(confirmation.userId).toBe("user-123");
    });

    it("should store preview data", () => {
      const preview = ["书签1", "书签2", "书签3"];

      const confirmation = handler.createConfirmation({
        title: "测试",
        message: "消息",
        preview,
      });

      expect(confirmation.preview).toEqual(preview);
    });
  });

  describe("getConfirmation", () => {
    it("should retrieve existing confirmation", () => {
      const created = handler.createConfirmation({
        title: "测试",
        message: "消息",
      });

      const retrieved = handler.getConfirmation(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it("should return undefined for non-existent ID", () => {
      const retrieved = handler.getConfirmation("non-existent-id");

      expect(retrieved).toBeUndefined();
    });
  });

  describe("respondToConfirmation", () => {
    it("should update confirmation status to confirmed", () => {
      const confirmation = handler.createConfirmation({
        title: "测试",
        message: "消息",
      });

      const result = handler.respondToConfirmation(confirmation.id, "confirm");

      expect(result).toBe(true);

      const updated = handler.getConfirmation(confirmation.id);
      expect(updated?.status).toBe("confirmed");
    });

    it("should update confirmation status to cancelled", () => {
      const confirmation = handler.createConfirmation({
        title: "测试",
        message: "消息",
      });

      const result = handler.respondToConfirmation(confirmation.id, "cancel");

      expect(result).toBe(true);

      const updated = handler.getConfirmation(confirmation.id);
      expect(updated?.status).toBe("cancelled");
    });

    it("should store response data", () => {
      const confirmation = handler.createConfirmation({
        title: "测试",
        message: "消息",
      });

      const responseData = { notes: "用户备注" };
      handler.respondToConfirmation(confirmation.id, "confirm", responseData);

      const updated = handler.getConfirmation(confirmation.id);
      expect(updated?.response?.selectedOption).toBe("confirm");
      expect(updated?.response?.data).toEqual(responseData);
    });

    it("should return false for non-existent confirmation", () => {
      const result = handler.respondToConfirmation(
        "non-existent-id",
        "confirm",
      );

      expect(result).toBe(false);
    });

    it("should return false for already processed confirmation", () => {
      const confirmation = handler.createConfirmation({
        title: "测试",
        message: "消息",
      });

      handler.respondToConfirmation(confirmation.id, "confirm");
      const result = handler.respondToConfirmation(confirmation.id, "cancel");

      expect(result).toBe(false);
    });
  });

  describe("waitForConfirmation", () => {
    it("should resolve when confirmation is responded", async () => {
      const confirmation = handler.createConfirmation({
        title: "测试",
        message: "消息",
      });

      // 异步响应
      setTimeout(() => {
        handler.respondToConfirmation(confirmation.id, "confirm");
      }, 50);

      const result = await handler.waitForConfirmation(confirmation.id);

      expect(result.confirmed).toBe(true);
      expect(result.selectedOption).toBe("confirm");
      expect(result.status).toBe("confirmed");
    });

    it("should resolve with cancelled status", async () => {
      const confirmation = handler.createConfirmation({
        title: "测试",
        message: "消息",
      });

      setTimeout(() => {
        handler.respondToConfirmation(confirmation.id, "cancel");
      }, 50);

      const result = await handler.waitForConfirmation(confirmation.id);

      expect(result.confirmed).toBe(false);
      expect(result.status).toBe("cancelled");
    });

    it("should reject for non-existent confirmation", async () => {
      await expect(
        handler.waitForConfirmation("non-existent-id"),
      ).rejects.toThrow("确认请求不存在");
    });

    it("should timeout and return expired status", async () => {
      const shortHandler = new ConfirmationHandler({
        defaultTimeoutMs: 100,
        maxPendingConfirmations: 10,
        cleanupIntervalMs: 10000,
      });

      try {
        const confirmation = shortHandler.createConfirmation({
          title: "测试",
          message: "消息",
        });

        const result = await shortHandler.waitForConfirmation(confirmation.id);

        expect(result.confirmed).toBe(false);
        expect(result.status).toBe("expired");
      } finally {
        shortHandler.shutdown();
      }
    });

    it("should include context data in result", async () => {
      const contextData = { bookmarkIds: [1, 2, 3] };

      const confirmation = handler.createConfirmation({
        title: "测试",
        message: "消息",
        contextData,
      });

      setTimeout(() => {
        handler.respondToConfirmation(confirmation.id, "confirm");
      }, 50);

      const result = await handler.waitForConfirmation(confirmation.id);

      expect(result.contextData).toEqual(contextData);
    });
  });

  describe("cancelConfirmation", () => {
    it("should cancel pending confirmation", () => {
      const confirmation = handler.createConfirmation({
        title: "测试",
        message: "消息",
      });

      handler.cancelConfirmation(confirmation.id, "用户取消");

      const updated = handler.getConfirmation(confirmation.id);
      expect(updated?.status).toBe("cancelled");
    });

    it("should resolve waiting promise with cancelled status", async () => {
      const confirmation = handler.createConfirmation({
        title: "测试",
        message: "消息",
      });

      setTimeout(() => {
        handler.cancelConfirmation(confirmation.id);
      }, 50);

      const result = await handler.waitForConfirmation(confirmation.id);

      expect(result.confirmed).toBe(false);
      expect(result.status).toBe("cancelled");
    });

    it("should not affect already processed confirmation", () => {
      const confirmation = handler.createConfirmation({
        title: "测试",
        message: "消息",
      });

      handler.respondToConfirmation(confirmation.id, "confirm");
      handler.cancelConfirmation(confirmation.id);

      const updated = handler.getConfirmation(confirmation.id);
      expect(updated?.status).toBe("confirmed"); // 状态不变
    });
  });

  describe("getPendingByUser", () => {
    it("should return pending confirmations for user", () => {
      handler.createConfirmation({
        title: "测试1",
        message: "消息1",
        userId: "user-1",
      });

      handler.createConfirmation({
        title: "测试2",
        message: "消息2",
        userId: "user-1",
      });

      handler.createConfirmation({
        title: "测试3",
        message: "消息3",
        userId: "user-2",
      });

      const results = handler.getPendingByUser("user-1");

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe("测试1");
      expect(results[1].title).toBe("测试2");
    });

    it("should not return processed confirmations", () => {
      const c1 = handler.createConfirmation({
        title: "测试1",
        message: "消息1",
        userId: "user-1",
      });

      handler.createConfirmation({
        title: "测试2",
        message: "消息2",
        userId: "user-1",
      });

      handler.respondToConfirmation(c1.id, "confirm");

      const results = handler.getPendingByUser("user-1");

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("测试2");
    });
  });

  describe("getPendingBySkill", () => {
    it("should return pending confirmations for skill", () => {
      handler.createConfirmation({
        title: "测试1",
        message: "消息1",
        skillId: "batch_organize",
      });

      handler.createConfirmation({
        title: "测试2",
        message: "消息2",
        skillId: "data_export",
      });

      const results = handler.getPendingBySkill("batch_organize");

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("测试1");
    });
  });

  describe("getStats", () => {
    it("should return correct statistics", () => {
      const c1 = handler.createConfirmation({
        title: "测试1",
        message: "消息1",
      });

      const c2 = handler.createConfirmation({
        title: "测试2",
        message: "消息2",
      });

      handler.createConfirmation({
        title: "测试3",
        message: "消息3",
      });

      handler.respondToConfirmation(c1.id, "confirm");
      handler.cancelConfirmation(c2.id);

      const stats = handler.getStats();

      expect(stats.total).toBe(3);
      expect(stats.pending).toBe(1);
      expect(stats.confirmed).toBe(1);
      expect(stats.cancelled).toBe(1);
    });
  });

  describe("cleanupExpired", () => {
    it("should mark expired confirmations", async () => {
      const shortHandler = new ConfirmationHandler({
        defaultTimeoutMs: 50,
        maxPendingConfirmations: 10,
        cleanupIntervalMs: 10000,
      });

      try {
        const confirmation = shortHandler.createConfirmation({
          title: "测试",
          message: "消息",
        });

        // 等待过期
        await new Promise((resolve) => setTimeout(resolve, 100));

        const cleanedCount = shortHandler.cleanupExpired();

        expect(cleanedCount).toBe(1);

        const updated = shortHandler.getConfirmation(confirmation.id);
        expect(updated?.status).toBe("expired");
      } finally {
        shortHandler.shutdown();
      }
    });
  });

  describe("max pending limit", () => {
    it("should cleanup oldest when limit reached", () => {
      const smallHandler = new ConfirmationHandler({
        defaultTimeoutMs: 10000,
        maxPendingConfirmations: 3,
        cleanupIntervalMs: 10000,
      });

      try {
        const c1 = smallHandler.createConfirmation({
          title: "测试1",
          message: "消息1",
        });

        smallHandler.createConfirmation({
          title: "测试2",
          message: "消息2",
        });

        smallHandler.createConfirmation({
          title: "测试3",
          message: "消息3",
        });

        // 创建第 4 个，应该删除最旧的
        smallHandler.createConfirmation({
          title: "测试4",
          message: "消息4",
        });

        const oldestConfirmation = smallHandler.getConfirmation(c1.id);
        expect(oldestConfirmation?.status).toBe("cancelled");
      } finally {
        smallHandler.shutdown();
      }
    });
  });
});

describe("createConfirmationHandler", () => {
  it("should create new handler instance", () => {
    const handler = createConfirmationHandler();

    expect(handler).toBeInstanceOf(ConfirmationHandler);

    handler.shutdown();
  });

  it("should accept custom config", () => {
    const handler = createConfirmationHandler({
      defaultTimeoutMs: 10000,
      maxPendingConfirmations: 50,
    });

    expect(handler).toBeInstanceOf(ConfirmationHandler);

    handler.shutdown();
  });
});

describe("confirmationHandler singleton", () => {
  it("should be an instance of ConfirmationHandler", () => {
    expect(confirmationHandler).toBeInstanceOf(ConfirmationHandler);
  });
});
