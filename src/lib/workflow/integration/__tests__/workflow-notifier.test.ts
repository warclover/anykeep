/**
 * WorkflowNotifier 单元测试
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { WorkflowNotifier, getWorkflowNotifier } from "../workflow-notifier";
import type { WorkflowNotificationContext } from "../types";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock Supabase - must be before imports
const mockInsert = jest.fn(() => Promise.resolve({ error: null }));
const mockSend = jest.fn(() => Promise.resolve());
const mockRemoveChannel = jest.fn(() => Promise.resolve());

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: jest.fn(() => ({
        insert: mockInsert,
      })),
      channel: jest.fn(() => ({
        send: mockSend,
      })),
      removeChannel: mockRemoveChannel,
    }),
  ),
}));

describe("WorkflowNotifier", () => {
  let notifier: WorkflowNotifier;

  beforeEach(() => {
    notifier = new WorkflowNotifier();
    jest.clearAllMocks();
  });

  describe("generateTitle", () => {
    it("should generate title for completed status", () => {
      const generateTitle = (
        notifier as unknown as {
          generateTitle: (context: WorkflowNotificationContext) => string;
        }
      ).generateTitle.bind(notifier);

      const title = generateTitle({
        userId: "user-123",
        workflowId: "workflow-1",
        workflowName: "周度整理",
        executionId: "exec-123",
        status: "completed",
        summary: "完成",
      });

      expect(title).toBe("「周度整理」执行完成");
    });

    it("should generate title for failed status", () => {
      const generateTitle = (
        notifier as unknown as {
          generateTitle: (context: WorkflowNotificationContext) => string;
        }
      ).generateTitle.bind(notifier);

      const title = generateTitle({
        userId: "user-123",
        workflowId: "workflow-1",
        workflowName: "链接检查",
        executionId: "exec-123",
        status: "failed",
        summary: "失败",
        error: "网络错误",
      });

      expect(title).toBe("「链接检查」执行失败");
    });

    it("should generate title for waiting_confirmation status", () => {
      const generateTitle = (
        notifier as unknown as {
          generateTitle: (context: WorkflowNotificationContext) => string;
        }
      ).generateTitle.bind(notifier);

      const title = generateTitle({
        userId: "user-123",
        workflowId: "workflow-1",
        workflowName: "重复清理",
        executionId: "exec-123",
        status: "waiting_confirmation",
        summary: "等待确认",
      });

      expect(title).toBe("「重复清理」等待确认");
    });

    it("should generate default title for unknown status", () => {
      const generateTitle = (
        notifier as unknown as {
          generateTitle: (context: WorkflowNotificationContext) => string;
        }
      ).generateTitle.bind(notifier);

      const title = generateTitle({
        userId: "user-123",
        workflowId: "workflow-1",
        workflowName: "测试工作流",
        executionId: "exec-123",
        status: "unknown" as "completed",
        summary: "未知状态",
      });

      expect(title).toBe("「测试工作流」状态更新");
    });
  });

  describe("notify", () => {
    const baseContext: WorkflowNotificationContext = {
      userId: "user-123",
      workflowId: "workflow-1",
      workflowName: "周度整理",
      executionId: "exec-123",
      status: "completed",
      summary: "已完成 50 条书签的整理",
    };

    it("should not throw on notify", async () => {
      await expect(notifier.notify(baseContext)).resolves.not.toThrow();
    });

    it("should handle context with outputs", async () => {
      const contextWithOutputs: WorkflowNotificationContext = {
        ...baseContext,
        outputs: {
          organizedCount: 50,
          taggedCount: 30,
        },
      };

      await expect(notifier.notify(contextWithOutputs)).resolves.not.toThrow();
    });

    it("should handle failed status context", async () => {
      const failedContext: WorkflowNotificationContext = {
        ...baseContext,
        status: "failed",
        error: "数据库连接失败",
      };

      await expect(notifier.notify(failedContext)).resolves.not.toThrow();
    });

    it("should handle waiting_confirmation status", async () => {
      const waitingContext: WorkflowNotificationContext = {
        ...baseContext,
        status: "waiting_confirmation",
        summary: "发现 10 条重复书签，是否删除？",
      };

      await expect(notifier.notify(waitingContext)).resolves.not.toThrow();
    });
  });

  describe("singleton", () => {
    it("should return same instance", () => {
      const instance1 = getWorkflowNotifier();
      const instance2 = getWorkflowNotifier();
      expect(instance1).toBe(instance2);
    });
  });
});
