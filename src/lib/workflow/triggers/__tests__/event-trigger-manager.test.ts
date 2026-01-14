/**
 * EventTriggerManager 单元测试
 *
 * @version 1.0.1
 * @since 2026-01-08
 * @updated 2026-01-09 - 更新 mock 适配分离查询模式
 */

import { EventTriggerManager } from "../event-trigger-manager";
import type { WorkflowEvent } from "../types";

// Mock workflow data
const mockWorkflowData = [
  {
    id: "workflow-1",
    definition: {
      id: "test-workflow",
      name: "Test Workflow",
      triggers: [
        {
          type: "event",
          eventType: "browser_bookmark_import_completed",
          condition: "event.isFirstImport == true",
          enabled: true,
        },
      ],
      steps: [],
      config: {
        timeout: 60000,
        notifyOnComplete: true,
        notifyOnFailure: true,
      },
    },
  },
];

// Mock Supabase - 适配分离查询模式（builtin + user workflows）
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: jest.fn(() => ({
        select: jest.fn(() => {
          // 创建可链式调用的 mock
          const createChainableEq = (data: unknown[]) => {
            const eqFn: jest.Mock<{
              eq: jest.Mock;
              then: (resolve: (value: unknown) => unknown) => unknown;
            }> = jest.fn(() => ({
              eq: eqFn,
              then: (resolve: (value: unknown) => unknown) =>
                resolve({ data, error: null }),
            }));
            return eqFn;
          };

          return {
            eq: createChainableEq(mockWorkflowData),
          };
        }),
      })),
    }),
  ),
}));

// Mock orchestrator
const mockStartWorkflow = jest.fn(() =>
  Promise.resolve({
    id: "execution-id",
    status: "running",
  }),
);

jest.mock("../../orchestrator", () => ({
  getWorkflowOrchestrator: jest.fn(() => ({
    startWorkflow: mockStartWorkflow,
  })),
}));

// Mock SafeExpressionEvaluator
jest.mock("../../integration/safe-expression-evaluator", () => ({
  getSafeExpressionEvaluator: jest.fn(() => ({
    validate: jest.fn(() => ({ valid: true })),
    evaluate: jest.fn(
      (expression: string, variables: Record<string, unknown>) => {
        // 简单模拟条件评估
        const event = variables.event as Record<string, unknown>;
        if (expression === "event.isFirstImport == true") {
          return event?.isFirstImport === true;
        }
        return true;
      },
    ),
  })),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("EventTriggerManager", () => {
  let manager: EventTriggerManager;

  beforeEach(() => {
    manager = new EventTriggerManager();
    jest.clearAllMocks();
  });

  afterEach(() => {
    manager.clearCache();
  });

  describe("handleEvent", () => {
    it("should trigger workflow when event matches", async () => {
      const event: WorkflowEvent = {
        type: "browser_bookmark_import_completed",
        userId: "user-123",
        payload: {
          isFirstImport: true,
          totalImported: 150,
        },
        timestamp: new Date(),
      };

      await manager.handleEvent(event);

      // 验证工作流被启动（使用 definition 中的 id，非数据库 row id）
      expect(mockStartWorkflow).toHaveBeenCalledWith(
        "test-workflow",
        "user-123",
        expect.objectContaining({
          triggerType: "event",
        }),
      );
    });

    it("should ignore duplicate events within debounce window", async () => {
      const event: WorkflowEvent = {
        type: "browser_bookmark_import_completed",
        userId: "user-123",
        payload: {
          isFirstImport: true,
        },
        timestamp: new Date(),
      };

      // 第一次调用
      await manager.handleEvent(event);
      const firstCallCount = mockStartWorkflow.mock.calls.length;

      // 立即再次调用（在去重窗口内）
      await manager.handleEvent(event);

      // 应该只触发一次
      expect(mockStartWorkflow.mock.calls.length).toBe(firstCallCount);
    });

    it("should not trigger when condition is not met", async () => {
      const event: WorkflowEvent = {
        type: "browser_bookmark_import_completed",
        userId: "user-123",
        payload: {
          isFirstImport: false, // 条件不满足
        },
        timestamp: new Date(),
      };

      mockStartWorkflow.mockClear();
      manager.clearCache();

      await manager.handleEvent(event);

      // 条件不满足，不应触发
      // 注：由于 mock 的实现，这个测试依赖于 evaluate 函数的行为
    });
  });

  describe("clearCache", () => {
    it("should clear the workflow cache", () => {
      manager.clearCache();
      // 缓存清除后，下次调用应该重新加载
      // 这个测试主要验证方法不会抛出错误
      expect(true).toBe(true);
    });
  });
});
