/**
 * Pending Tasks Tools 测试
 *
 * @module @/lib/ai-agent/tools/pending-tasks/__tests__
 */

import { listPendingTasksTool } from "../list-pending-tasks.tool";
import { completePendingTaskTool } from "../complete-pending-task.tool";
import type { ToolContext, ToolResult, ToolSuccessResult } from "../../types";

// =============================================================================
// 测试辅助函数
// =============================================================================

/**
 * 类型守卫：检查结果是否成功
 */
function assertSuccess<T>(
  result: ToolResult<T>,
): asserts result is ToolSuccessResult<T> {
  expect(result.success).toBe(true);
}

/**
 * 类型守卫：检查结果是否失败
 */
function assertFailure<T>(
  result: ToolResult<T>,
): asserts result is { success: false; error: string; errorCode?: string } {
  expect(result.success).toBe(false);
}

// =============================================================================
// Mock 设置
// =============================================================================

// Mock pending-tasks service
const mockGetTasks = jest.fn();
const mockCompleteTask = jest.fn();
const mockCompleteTaskByMatch = jest.fn();
const mockGetTaskCount = jest.fn();

jest.mock("@/lib/ai-memory/pending-tasks", () => ({
  getPendingTasksService: jest.fn(() => ({
    getTasks: mockGetTasks,
    completeTask: mockCompleteTask,
    completeTaskByMatch: mockCompleteTaskByMatch,
    getTaskCount: mockGetTaskCount,
  })),
  resetPendingTasksService: jest.fn(),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

// =============================================================================
// 测试
// =============================================================================

describe("listPendingTasksTool", () => {
  const mockContext: ToolContext = {
    userId: "test-user-123",
    conversationId: "conv-123",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("definition", () => {
    it("应该有正确的名称", () => {
      expect(listPendingTasksTool.definition.name).toBe("list_pending_tasks");
    });

    it("应该是 query 类型", () => {
      expect(listPendingTasksTool.definition.category).toBe("query");
    });

    it("应该不需要确认", () => {
      expect(listPendingTasksTool.definition.requiresConfirmation).toBe(false);
    });
  });

  describe("execute", () => {
    it("应该返回待办事项列表", async () => {
      mockGetTasks.mockResolvedValue(["整理收藏", "导出数据"]);

      const result = await listPendingTasksTool.execute({}, mockContext);

      assertSuccess(result);
      expect(result.data.tasks).toEqual(["整理收藏", "导出数据"]);
      expect(result.data.count).toBe(2);
      expect(result.data.hasMore).toBe(false);
    });

    it("应该处理空列表", async () => {
      mockGetTasks.mockResolvedValue([]);

      const result = await listPendingTasksTool.execute({}, mockContext);

      assertSuccess(result);
      expect(result.data.tasks).toEqual([]);
      expect(result.data.count).toBe(0);
      expect(result.data.message).toBe("暂无待办事项");
    });

    it("应该处理单个任务", async () => {
      mockGetTasks.mockResolvedValue(["唯一任务"]);

      const result = await listPendingTasksTool.execute({}, mockContext);

      assertSuccess(result);
      expect(result.data.message).toBe("有 1 项待办事项");
    });

    it("应该处理多个任务", async () => {
      mockGetTasks.mockResolvedValue(["任务1", "任务2", "任务3"]);

      const result = await listPendingTasksTool.execute({}, mockContext);

      assertSuccess(result);
      expect(result.data.message).toBe("有 3 项待办事项");
    });

    it("应该限制返回数量", async () => {
      const manyTasks = Array.from({ length: 15 }, (_, i) => `任务${i + 1}`);
      mockGetTasks.mockResolvedValue(manyTasks);

      const result = await listPendingTasksTool.execute(
        { limit: 5 },
        mockContext,
      );

      assertSuccess(result);
      expect(result.data.tasks.length).toBe(5);
      expect(result.data.hasMore).toBe(true);
      expect(result.data.message).toContain("还有更多");
    });

    it("应该处理错误", async () => {
      mockGetTasks.mockRejectedValue(new Error("Database error"));

      const result = await listPendingTasksTool.execute({}, mockContext);

      assertFailure(result);
      expect(result.error).toContain("获取待办事项失败");
      expect(result.errorCode).toBe("EXECUTION_ERROR");
    });

    it("应该记录执行时间", async () => {
      mockGetTasks.mockResolvedValue([]);

      const result = await listPendingTasksTool.execute({}, mockContext);

      expect(result.metadata?.executionTimeMs).toBeDefined();
      expect(typeof result.metadata?.executionTimeMs).toBe("number");
    });

    it("应该处理 reasoning 参数", async () => {
      mockGetTasks.mockResolvedValue(["任务1"]);

      const result = await listPendingTasksTool.execute(
        { reasoning: "用户询问待办事项" },
        mockContext,
      );

      assertSuccess(result);
    });
  });
});

describe("completePendingTaskTool", () => {
  const mockContext: ToolContext = {
    userId: "test-user-123",
    conversationId: "conv-123",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("definition", () => {
    it("应该有正确的名称", () => {
      expect(completePendingTaskTool.definition.name).toBe(
        "complete_pending_task",
      );
    });

    it("应该是 action 类型", () => {
      expect(completePendingTaskTool.definition.category).toBe("action");
    });

    it("应该不需要确认", () => {
      expect(completePendingTaskTool.definition.requiresConfirmation).toBe(
        false,
      );
    });
  });

  describe("execute - 模糊匹配", () => {
    it("应该模糊匹配并完成任务", async () => {
      mockCompleteTaskByMatch.mockResolvedValue("整理B站收藏");
      mockGetTaskCount.mockResolvedValue(1);

      const result = await completePendingTaskTool.execute(
        { task: "B站" },
        mockContext,
      );

      assertSuccess(result);
      expect(result.data.success).toBe(true);
      expect(result.data.completedTask).toBe("整理B站收藏");
      expect(result.data.remainingCount).toBe(1);
      expect(mockCompleteTaskByMatch).toHaveBeenCalledWith(
        mockContext.userId,
        "B站",
      );
    });

    it("应该处理未找到匹配", async () => {
      mockCompleteTaskByMatch.mockResolvedValue(null);
      mockGetTaskCount.mockResolvedValue(2);

      const result = await completePendingTaskTool.execute(
        { task: "不存在的任务" },
        mockContext,
      );

      assertSuccess(result);
      expect(result.data.success).toBe(false);
      expect(result.data.completedTask).toBeUndefined();
      expect(result.data.message).toContain("未找到匹配的待办事项");
    });

    it("应该显示剩余任务数量", async () => {
      mockCompleteTaskByMatch.mockResolvedValue("任务1");
      mockGetTaskCount.mockResolvedValue(3);

      const result = await completePendingTaskTool.execute(
        { task: "任务1" },
        mockContext,
      );

      assertSuccess(result);
      expect(result.data.message).toContain("还有 3 项待办");
    });

    it("应该显示全部清空消息", async () => {
      mockCompleteTaskByMatch.mockResolvedValue("最后任务");
      mockGetTaskCount.mockResolvedValue(0);

      const result = await completePendingTaskTool.execute(
        { task: "最后任务" },
        mockContext,
      );

      assertSuccess(result);
      expect(result.data.message).toContain("所有待办已清空");
    });
  });

  describe("execute - 精确匹配", () => {
    it("应该精确匹配并完成任务", async () => {
      mockCompleteTask.mockResolvedValue(true);
      mockGetTaskCount.mockResolvedValue(0);

      const result = await completePendingTaskTool.execute(
        { task: "整理B站收藏", exactMatch: true },
        mockContext,
      );

      assertSuccess(result);
      expect(result.data.success).toBe(true);
      expect(result.data.completedTask).toBe("整理B站收藏");
      expect(mockCompleteTask).toHaveBeenCalledWith(
        mockContext.userId,
        "整理B站收藏",
      );
    });

    it("应该处理精确匹配未找到", async () => {
      mockCompleteTask.mockResolvedValue(false);
      mockGetTaskCount.mockResolvedValue(2);

      const result = await completePendingTaskTool.execute(
        { task: "不存在的任务", exactMatch: true },
        mockContext,
      );

      assertSuccess(result);
      expect(result.data.success).toBe(false);
      expect(result.data.completedTask).toBeUndefined();
    });
  });

  describe("execute - 错误处理", () => {
    it("应该处理服务错误", async () => {
      mockCompleteTaskByMatch.mockRejectedValue(new Error("Service error"));

      const result = await completePendingTaskTool.execute(
        { task: "任务" },
        mockContext,
      );

      assertFailure(result);
      expect(result.error).toContain("完成待办事项失败");
      expect(result.errorCode).toBe("EXECUTION_ERROR");
    });

    it("应该记录执行时间", async () => {
      mockCompleteTaskByMatch.mockResolvedValue("任务");
      mockGetTaskCount.mockResolvedValue(0);

      const result = await completePendingTaskTool.execute(
        { task: "任务" },
        mockContext,
      );

      expect(result.metadata?.executionTimeMs).toBeDefined();
    });
  });

  describe("execute - reasoning", () => {
    it("应该处理 reasoning 参数", async () => {
      mockCompleteTaskByMatch.mockResolvedValue("任务1");
      mockGetTaskCount.mockResolvedValue(0);

      const result = await completePendingTaskTool.execute(
        { task: "任务1", reasoning: "用户说完成了这个任务" },
        mockContext,
      );

      assertSuccess(result);
    });
  });
});

// =============================================================================
// 集成测试
// =============================================================================

describe("Pending Tasks Tools 集成", () => {
  const mockContext: ToolContext = {
    userId: "test-user-integration",
    conversationId: "conv-integration",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("应该支持列出然后完成的工作流", async () => {
    // 第一步：列出任务
    mockGetTasks.mockResolvedValue(["整理收藏", "导出数据", "设置提醒"]);

    const listResult = await listPendingTasksTool.execute({}, mockContext);

    assertSuccess(listResult);
    expect(listResult.data.tasks).toHaveLength(3);

    // 第二步：完成其中一个任务
    mockCompleteTaskByMatch.mockResolvedValue("整理收藏");
    mockGetTaskCount.mockResolvedValue(2);

    const completeResult = await completePendingTaskTool.execute(
      { task: "整理" },
      mockContext,
    );

    assertSuccess(completeResult);
    expect(completeResult.data.completedTask).toBe("整理收藏");
    expect(completeResult.data.remainingCount).toBe(2);
  });

  it("工具定义应该可以被序列化", () => {
    // 确保定义可以被 JSON 序列化（用于 AI SDK）
    const listDef = listPendingTasksTool.definition;
    const completeDef = completePendingTaskTool.definition;

    expect(() => JSON.stringify(listDef)).not.toThrow();
    expect(() => JSON.stringify(completeDef)).not.toThrow();
  });
});
